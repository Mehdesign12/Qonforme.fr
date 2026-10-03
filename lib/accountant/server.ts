/**
 * Accès du comptable : accès à la base, côté serveur uniquement (clé
 * service_role). Aucune politique RLS n'ouvre ces tables au navigateur, et
 * les tables existantes (invoices, credit_notes…) gardent les leurs : le
 * comptable ne les lit jamais avec sa propre session.
 *
 * Règle de sécurité de tout ce module : l'identifiant de l'entreprise lue
 * (`owner_id`) vient toujours de la ligne d'accès, retrouvée par son
 * identifiant ET par le compte connecté du comptable, jamais de la requête.
 * Chaque requête du comptable repasse par authorizeDossier() : une révocation
 * coupe l'accès à la requête suivante.
 *
 * Tant que la migration 20261003_accountant_access.sql n'est pas appliquée,
 * tout renvoie « indisponible » sans erreur (isMissingSchemaError).
 */
import type { SupabaseClient } from "@supabase/supabase-js"
import { createAdminClient } from "@/lib/supabase/server"
import { isMissingSchemaError } from "@/lib/supabase/schema-guard"
import { sendEmail } from "@/lib/email/resend"
import { buildAccountantInvitationEmail } from "@/lib/email/templates/accountant-invitation"
import {
  EVENT_RETENTION_DAYS, MAX_INVITES_PER_DAY, MAX_LIVE_ACCESSES, RESEND_COOLDOWN_MS, VIEW_LOG_INTERVAL_MS,
  accessStatus, cleanLabel, inviteExpiry, isIssuedInvoice, isUuid, maskEmail, normalizeEmail, toAccessView, type VatLine,
} from "@/lib/accountant/rules"
import { hashInviteToken, inviteUrl, isInviteTokenShape, newInviteToken } from "@/lib/accountant/token"
import { loadSupplierInvoices } from "@/lib/accountant/suppliers"
import { buildDossier } from "@/lib/accountant/dossier"
import {
  ACCESS_COLUMNS, ACCESS_TABLE, EVENTS_TABLE,
  type AccessOverview, type AccessRow, type AccessView, type DossierData,
  type DossierSummary, type EventAction, type EventView, type InvitationState, type Period,
} from "@/lib/accountant/types"

type Db = SupabaseClient
type DbError = { code?: string | null; message?: string | null } | null

export type Failure = { ok: false; status: number; error: string }
const fail = (status: number, error: string): Failure => ({ ok: false, status, error })

const UNAVAILABLE = "L'accès comptable n'est pas encore activé sur Qonforme."

/** Erreur de base inattendue (réseau…) : remontée à la route, qui répond 500/503. */
function raise(error: DbError, where: string): never {
  console.error(`[accountant] ${where}`, error)
  throw new Error(`[accountant] ${where}: ${error?.message ?? "erreur inconnue"}`)
}

/* ------------------------------------------------------------------ */
/* Journal                                                             */
/* ------------------------------------------------------------------ */

/**
 * Écrit une entrée du journal, puis efface celles de plus d'un an de la même
 * entreprise. Lève une erreur si l'écriture échoue : une consultation ou un
 * export qui ne serait pas journalisé n'a pas lieu.
 */
export async function recordEvent(
  db: Db,
  params: { access: Pick<AccessRow, "id" | "owner_id">; actorId: string | null; action: EventAction; period?: Period | null; detail?: string | null; now?: Date },
): Promise<void> {
  const now = params.now ?? new Date()
  const { error } = await db.from(EVENTS_TABLE).insert({
    access_id: params.access.id,
    owner_id: params.access.owner_id,
    actor_id: params.actorId,
    action: params.action,
    period_from: params.period?.from ?? null,
    period_to: params.period?.to ?? null,
    detail: params.detail ? params.detail.slice(0, 200) : null,
    created_at: now.toISOString(),
  })
  if (error) raise(error, "recordEvent")

  const cutoff = new Date(now.getTime() - EVENT_RETENTION_DAYS * 86_400_000).toISOString()
  const { error: purgeErr } = await db.from(EVENTS_TABLE).delete().eq("owner_id", params.access.owner_id).lt("created_at", cutoff)
  if (purgeErr) console.error("[accountant] purge du journal", purgeErr)
}

/**
 * Consultation d'un dossier : date de dernière consultation à chaque fois,
 * entrée « a consulté » au plus toutes les 30 minutes (rechargements et
 * changements de période comptent pour une seule consultation).
 */
export async function recordView(db: Db, access: AccessRow, now: Date = new Date()): Promise<void> {
  const { error } = await db.from(ACCESS_TABLE).update({ last_seen_at: now.toISOString() }).eq("id", access.id)
  if (error) raise(error, "recordView last_seen_at")

  const { data: last, error: lastErr } = await db
    .from(EVENTS_TABLE)
    .select("created_at")
    .eq("access_id", access.id)
    .eq("action", "viewed")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle()
  if (lastErr) raise(lastErr, "recordView dernière consultation")
  const lastAt = last ? new Date(String(last.created_at)).getTime() : 0
  if (now.getTime() - lastAt < VIEW_LOG_INTERVAL_MS) return
  await recordEvent(db, { access, actorId: access.accountant_id, action: "viewed", now })
}

/** Export : date de dernière consultation et entrée du journal (obligatoire, voir recordEvent). */
export async function recordExport(
  db: Db,
  access: AccessRow,
  action: Extract<EventAction, "export_fec" | "export_csv" | "export_pdf_zip">,
  period: Period,
  detail: string | null,
  now: Date = new Date(),
): Promise<void> {
  await recordEvent(db, { access, actorId: access.accountant_id, action, period, detail, now })
  const { error } = await db.from(ACCESS_TABLE).update({ last_seen_at: now.toISOString() }).eq("id", access.id)
  if (error) console.error("[accountant] last_seen_at", error)
}

/* ------------------------------------------------------------------ */
/* Côté artisan : Paramètres › Accès comptable                         */
/* ------------------------------------------------------------------ */

export interface Owner {
  id: string
  email: string | null
  /** Prénom et nom, pour l'email d'invitation. */
  name: string | null
}

/** Accès en cours (invitations comprises) et journal des 12 derniers mois. */
export async function getOverview(ownerId: string, db: Db = createAdminClient(), now: Date = new Date()): Promise<AccessOverview> {
  const { data: live, error } = await db
    .from(ACCESS_TABLE)
    .select(ACCESS_COLUMNS)
    .eq("owner_id", ownerId)
    .is("revoked_at", null)
    .order("invited_at", { ascending: false })
  if (error) {
    if (isMissingSchemaError(error)) return { available: false, accesses: [], events: [] }
    raise(error, "getOverview accès")
  }
  const rows = ((live ?? []) as AccessRow[]).filter((r) => r.owner_id === ownerId)
  const accesses = rows.map((r) => toAccessView(r, now)).filter((v): v is AccessView => v !== null)

  const since = new Date(now.getTime() - EVENT_RETENTION_DAYS * 86_400_000).toISOString()
  const { data: ev, error: evErr } = await db
    .from(EVENTS_TABLE)
    .select("id, access_id, owner_id, action, period_from, period_to, detail, created_at")
    .eq("owner_id", ownerId)
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(100)
  if (evErr) {
    if (isMissingSchemaError(evErr)) return { available: true, accesses, events: [] }
    raise(evErr, "getOverview journal")
  }
  const events = ((ev ?? []) as Record<string, unknown>[]).filter((e) => e.owner_id === ownerId)

  // Adresse de chaque accès cité (accès révoqués compris)
  const people = new Map<string, { email: string; label: string | null }>(rows.map((r) => [r.id, { email: r.email, label: r.label }]))
  const unknownIds = Array.from(new Set(events.map((e) => String(e.access_id)).filter((id) => !people.has(id))))
  if (unknownIds.length > 0) {
    const { data: more, error: moreErr } = await db.from(ACCESS_TABLE).select("id, owner_id, email, label").eq("owner_id", ownerId).in("id", unknownIds)
    if (moreErr) raise(moreErr, "getOverview adresses")
    for (const r of (more ?? []) as { id: string; owner_id: string; email: string; label: string | null }[]) {
      if (r.owner_id === ownerId) people.set(r.id, { email: r.email, label: r.label })
    }
  }

  return {
    available: true,
    accesses,
    events: events.map((e): EventView => {
      const who = people.get(String(e.access_id))
      return {
        id: String(e.id),
        accessId: String(e.access_id),
        email: who?.email ?? "",
        label: who?.label ?? null,
        action: e.action as EventAction,
        periodFrom: (e.period_from as string | null) ?? null,
        periodTo: (e.period_to as string | null) ?? null,
        detail: (e.detail as string | null) ?? null,
        at: String(e.created_at),
      }
    }),
  }
}

/** Envoie l'email d'invitation. Faux si l'envoi échoue (jamais d'exception). */
async function sendInvitation(db: Db, owner: Owner, row: AccessRow, token: string): Promise<boolean> {
  try {
    const { data: company } = await db.from("companies").select("name").eq("user_id", owner.id).maybeSingle()
    const { subject, html } = buildAccountantInvitationEmail({
      companyName: (company?.name as string | undefined)?.trim() || owner.name || "Une entreprise",
      inviterName: owner.name,
      label: row.label,
      email: row.email,
      url: inviteUrl(token),
      expiresAt: row.expires_at,
    })
    await sendEmail({ to: row.email, subject, html, fromName: "Qonforme" })
    return true
  } catch (err) {
    console.error("[accountant] envoi de l'invitation", err)
    return false
  }
}

export type InviteResult = { ok: true; access: AccessView } | Failure

/** Nouveau jeton et nouvel email pour une invitation en attente ou expirée. */
async function resendRow(db: Db, owner: Owner, row: AccessRow, label: string | null, now: Date): Promise<InviteResult> {
  if (now.getTime() - new Date(row.invited_at).getTime() < RESEND_COOLDOWN_MS) {
    return fail(429, "L'invitation vient de partir. Patientez une minute avant de la renvoyer.")
  }
  const { token, hash } = newInviteToken()
  const { data, error } = await db
    .from(ACCESS_TABLE)
    .update({ token_hash: hash, invited_at: now.toISOString(), expires_at: inviteExpiry(now), label })
    .eq("id", row.id)
    .eq("owner_id", owner.id)
    .is("revoked_at", null)
    .is("accepted_at", null)
    .select(ACCESS_COLUMNS)
    .maybeSingle()
  if (error) raise(error, "resend")
  if (!data) return fail(409, "Cette invitation vient d'être acceptée ou annulée.")
  const updated = data as AccessRow
  if (!(await sendInvitation(db, owner, updated, token))) {
    return fail(502, "L'email d'invitation n'a pas pu partir. Réessayez dans un instant.")
  }
  await recordEvent(db, { access: updated, actorId: owner.id, action: "reinvited", now })
  return { ok: true, access: toAccessView(updated, now)! }
}

/**
 * Invite un comptable. Une adresse déjà invitée (en attente ou expirée)
 * reçoit une nouvelle invitation ; une adresse qui a déjà accès est refusée.
 */
export async function inviteAccountant(params: {
  owner: Owner
  email: unknown
  label: unknown
  db?: Db
  now?: Date
}): Promise<InviteResult> {
  const { owner } = params
  const db = params.db ?? createAdminClient()
  const now = params.now ?? new Date()
  const email = normalizeEmail(params.email)
  if (!email) return fail(400, "Saisissez une adresse email valide.")
  if (owner.email && email === owner.email.trim().toLowerCase()) {
    return fail(400, "Saisissez l'adresse de votre comptable : celle-ci est la vôtre.")
  }
  const label = cleanLabel(params.label)

  const { data: live, error } = await db.from(ACCESS_TABLE).select(ACCESS_COLUMNS).eq("owner_id", owner.id).is("revoked_at", null)
  if (error) {
    if (isMissingSchemaError(error)) return fail(503, UNAVAILABLE)
    raise(error, "invite lecture")
  }
  const rows = ((live ?? []) as AccessRow[]).filter((r) => r.owner_id === owner.id)
  const existing = rows.find((r) => r.email === email)
  if (existing) {
    if (accessStatus(existing, now) === "active") return fail(409, "Cette personne a déjà accès à votre facturation.")
    return resendRow(db, owner, existing, label ?? existing.label, now)
  }
  if (rows.length >= MAX_LIVE_ACCESSES) {
    return fail(409, `Vous avez déjà ${MAX_LIVE_ACCESSES} accès ou invitations en cours. Retirez-en un pour en ajouter un autre.`)
  }

  const since = new Date(now.getTime() - 86_400_000).toISOString()
  const { count, error: countErr } = await db
    .from(ACCESS_TABLE)
    .select("id", { count: "exact", head: true })
    .eq("owner_id", owner.id)
    .gte("created_at", since)
  if (countErr) raise(countErr, "invite quota")
  if ((count ?? 0) >= MAX_INVITES_PER_DAY) return fail(429, "Trop d'invitations aujourd'hui. Réessayez demain.")

  const { token, hash } = newInviteToken()
  const { data: inserted, error: insErr } = await db
    .from(ACCESS_TABLE)
    .insert({
      owner_id: owner.id,
      email,
      label,
      token_hash: hash,
      invited_at: now.toISOString(),
      expires_at: inviteExpiry(now),
      created_at: now.toISOString(),
    })
    .select(ACCESS_COLUMNS)
    .single()
  if (insErr) {
    if (insErr.code === "23505") return fail(409, "Une invitation est déjà en cours pour cette adresse.")
    if (isMissingSchemaError(insErr)) return fail(503, UNAVAILABLE)
    raise(insErr, "invite insertion")
  }
  const row = inserted as AccessRow
  if (!(await sendInvitation(db, owner, row, token))) {
    // Pas d'invitation sans email : la ligne est close aussitôt
    await db.from(ACCESS_TABLE).update({ revoked_at: now.toISOString(), token_hash: null }).eq("id", row.id).eq("owner_id", owner.id)
    return fail(502, "L'email d'invitation n'a pas pu partir. Réessayez dans un instant.")
  }
  await recordEvent(db, { access: row, actorId: owner.id, action: "invited", now })
  return { ok: true, access: toAccessView(row, now)! }
}

/** Ligne d'accès d'une entreprise, ou null (identifiant mal formé, inconnu ou d'un autre compte). */
async function ownedAccess(db: Db, ownerId: string, accessId: unknown): Promise<AccessRow | null> {
  if (!isUuid(accessId)) return null
  const { data, error } = await db.from(ACCESS_TABLE).select(ACCESS_COLUMNS).eq("id", accessId).eq("owner_id", ownerId).maybeSingle()
  if (error) {
    if (isMissingSchemaError(error)) return null
    raise(error, "ownedAccess")
  }
  const row = data as AccessRow | null
  return row && row.owner_id === ownerId ? row : null
}

/** Renvoie une invitation en attente ou expirée (nouveau lien, l'ancien cesse de fonctionner). */
export async function resendInvitation(params: { owner: Owner; accessId: unknown; db?: Db; now?: Date }): Promise<InviteResult> {
  const db = params.db ?? createAdminClient()
  const now = params.now ?? new Date()
  const row = await ownedAccess(db, params.owner.id, params.accessId)
  if (!row || accessStatus(row, now) === "revoked") return fail(404, "Invitation introuvable.")
  if (accessStatus(row, now) === "active") return fail(409, "Cette invitation a déjà été acceptée.")
  return resendRow(db, params.owner, row, row.label, now)
}

/**
 * Retire un accès ou annule une invitation, avec effet immédiat : le jeton
 * est effacé, et chaque requête du comptable vérifie `revoked_at`.
 */
export async function revokeAccess(params: { ownerId: string; accessId: unknown; db?: Db; now?: Date }): Promise<{ ok: true } | Failure> {
  const db = params.db ?? createAdminClient()
  const now = params.now ?? new Date()
  const row = await ownedAccess(db, params.ownerId, params.accessId)
  if (!row) return fail(404, "Accès introuvable.")
  if (row.revoked_at) return { ok: true }
  const { data, error } = await db
    .from(ACCESS_TABLE)
    .update({ revoked_at: now.toISOString(), token_hash: null })
    .eq("id", row.id)
    .eq("owner_id", params.ownerId)
    .is("revoked_at", null)
    .select("id")
  if (error) raise(error, "revoke")
  if ((data ?? []).length > 0) {
    await recordEvent(db, { access: row, actorId: params.ownerId, action: row.accepted_at ? "revoked" : "cancelled", now })
  }
  return { ok: true }
}

/* ------------------------------------------------------------------ */
/* Côté comptable : invitation                                         */
/* ------------------------------------------------------------------ */

async function companyNameOf(db: Db, ownerId: string): Promise<string> {
  const { data } = await db.from("companies").select("name").eq("user_id", ownerId).maybeSingle()
  return (data?.name as string | undefined)?.trim() || "Une entreprise"
}

async function rowByToken(db: Db, token: string): Promise<{ row: AccessRow | null; missing: boolean }> {
  const { data, error } = await db.from(ACCESS_TABLE).select(ACCESS_COLUMNS).eq("token_hash", hashInviteToken(token)).maybeSingle()
  if (error) {
    if (isMissingSchemaError(error)) return { row: null, missing: true }
    raise(error, "rowByToken")
  }
  return { row: (data as AccessRow | null) ?? null, missing: false }
}

/** État d'une invitation pour la page /invitation-comptable. Une invitation acceptée ou annulée n'a plus de jeton : « introuvable ». */
export async function resolveInvitation(
  token: unknown,
  viewer: { id: string; email: string | null } | null,
  db: Db = createAdminClient(),
  now: Date = new Date(),
): Promise<InvitationState> {
  if (!isInviteTokenShape(token)) return { state: "not_found" }
  try {
    const { row, missing } = await rowByToken(db, token)
    if (missing) return { state: "unavailable" }
    if (!row) return { state: "not_found" }
    const status = accessStatus(row, now)
    if (status === "revoked" || status === "active") return { state: "not_found" }
    const companyName = await companyNameOf(db, row.owner_id)
    if (status === "expired") return { state: "expired", companyName }
    return {
      state: "valid",
      companyName,
      maskedEmail: maskEmail(row.email),
      expiresAt: row.expires_at,
      emailMatches: viewer ? (viewer.email ?? "").trim().toLowerCase() === row.email : null,
      isOwner: viewer?.id === row.owner_id,
    }
  } catch {
    return { state: "unavailable" }
  }
}

/**
 * Acceptation par le comptable connecté. Conditions : jeton valide et non
 * expiré, compte connecté à l'adresse invitée, compte différent de celui de
 * l'entreprise. L'écriture est conditionnelle (jeton, non accepté, non
 * révoqué, non expiré) : deux acceptations simultanées n'en font qu'une.
 */
export async function acceptInvitation(params: {
  token: unknown
  user: { id: string; email: string | null }
  db?: Db
  now?: Date
}): Promise<{ ok: true; accessId: string } | Failure> {
  const db = params.db ?? createAdminClient()
  const now = params.now ?? new Date()
  const { user } = params
  if (!isInviteTokenShape(params.token)) return fail(404, "Ce lien d'invitation n'est plus valide.")
  const token = params.token

  const { row, missing } = await rowByToken(db, token)
  if (missing) return fail(503, UNAVAILABLE)
  const status = row ? accessStatus(row, now) : "revoked"
  if (!row || status === "revoked" || status === "active") return fail(404, "Ce lien d'invitation n'est plus valide.")
  if (status === "expired") return fail(410, "Cette invitation a expiré. Demandez à l'entreprise de vous la renvoyer.")
  if (row.owner_id === user.id) {
    return fail(403, "Cette invitation vient de votre propre compte : elle est destinée à votre comptable.")
  }
  if ((user.email ?? "").trim().toLowerCase() !== row.email) {
    return fail(403, `Cette invitation est destinée à ${maskEmail(row.email)}. Connectez-vous avec cette adresse.`)
  }

  // Accès déjà ouvert à ce comptable pour cette entreprise : l'invitation en double est close
  const already = await findLiveAccess(db, row.owner_id, user.id)
  if (already) {
    await db.from(ACCESS_TABLE).update({ revoked_at: now.toISOString(), token_hash: null }).eq("id", row.id).is("accepted_at", null)
    return { ok: true, accessId: already }
  }

  const { data, error } = await db
    .from(ACCESS_TABLE)
    .update({ accountant_id: user.id, accepted_at: now.toISOString(), token_hash: null })
    .eq("id", row.id)
    .eq("token_hash", hashInviteToken(token))
    .is("accepted_at", null)
    .is("revoked_at", null)
    .gt("expires_at", now.toISOString())
    .select(ACCESS_COLUMNS)
    .maybeSingle()
  if (error) {
    if (error.code === "23505") {
      const existing = await findLiveAccess(db, row.owner_id, user.id)
      if (existing) return { ok: true, accessId: existing }
    }
    raise(error, "accept")
  }
  if (!data) return fail(409, "Cette invitation vient d'être utilisée ou annulée.")
  await recordEvent(db, { access: data as AccessRow, actorId: user.id, action: "accepted", now })
  return { ok: true, accessId: (data as AccessRow).id }
}

async function findLiveAccess(db: Db, ownerId: string, accountantId: string): Promise<string | null> {
  const { data, error } = await db
    .from(ACCESS_TABLE)
    .select(ACCESS_COLUMNS)
    .eq("owner_id", ownerId)
    .eq("accountant_id", accountantId)
    .is("revoked_at", null)
  if (error) raise(error, "findLiveAccess")
  const hit = ((data ?? []) as AccessRow[]).find((r) => r.owner_id === ownerId && r.accountant_id === accountantId && accessStatus(r) === "active")
  return hit?.id ?? null
}

/* ------------------------------------------------------------------ */
/* Côté comptable : dossiers                                           */
/* ------------------------------------------------------------------ */

/** Accès actifs du comptable connecté, avec l'entreprise de chacun. */
export async function listDossiers(accountantId: string, db: Db = createAdminClient()): Promise<{ available: boolean; dossiers: DossierSummary[] }> {
  const { data, error } = await db
    .from(ACCESS_TABLE)
    .select(ACCESS_COLUMNS)
    .eq("accountant_id", accountantId)
    .is("revoked_at", null)
    .order("accepted_at", { ascending: false })
  if (error) {
    if (isMissingSchemaError(error)) return { available: false, dossiers: [] }
    raise(error, "listDossiers")
  }
  const rows = ((data ?? []) as AccessRow[]).filter((r) => r.accountant_id === accountantId && accessStatus(r) === "active")
  if (rows.length === 0) return { available: true, dossiers: [] }

  const { data: companies, error: compErr } = await db
    .from("companies")
    .select("user_id, name, siren, city")
    .in("user_id", rows.map((r) => r.owner_id))
  if (compErr) raise(compErr, "listDossiers entreprises")
  const byOwner = new Map(((companies ?? []) as { user_id: string; name: string | null; siren: string | null; city: string | null }[]).map((c) => [c.user_id, c]))

  return {
    available: true,
    dossiers: rows
      .map((r) => {
        const c = byOwner.get(r.owner_id)
        return {
          accessId: r.id,
          companyName: c?.name?.trim() || "Entreprise sans nom",
          siren: c?.siren ?? null,
          city: c?.city ?? null,
          acceptedAt: r.accepted_at,
          lastSeenAt: r.last_seen_at,
        }
      })
      .sort((a, b) => a.companyName.localeCompare(b.companyName, "fr")),
  }
}

/** Vrai si le compte a au moins un dossier ouvert (redirection d'un comptable sans entreprise). Faux en cas d'erreur. */
export async function hasDossiers(userId: string, db: Db = createAdminClient()): Promise<boolean> {
  try {
    const { dossiers } = await listDossiers(userId, db)
    return dossiers.length > 0
  } catch {
    return false
  }
}

/**
 * Autorisation d'une requête du comptable sur un dossier : l'accès doit
 * exister, appartenir au compte connecté, être accepté et non révoqué.
 * null sinon (la route répond 404, sans dire si le dossier existe).
 */
export async function authorizeDossier(accessId: unknown, accountantId: string, db: Db = createAdminClient()): Promise<AccessRow | null> {
  if (!isUuid(accessId) || !accountantId) return null
  const { data, error } = await db
    .from(ACCESS_TABLE)
    .select(ACCESS_COLUMNS)
    .eq("id", accessId)
    .eq("accountant_id", accountantId)
    .is("revoked_at", null)
    .maybeSingle()
  if (error) {
    if (isMissingSchemaError(error)) return null
    raise(error, "authorizeDossier")
  }
  const row = data as AccessRow | null
  if (!row || row.id !== accessId || row.accountant_id !== accountantId || accessStatus(row) !== "active") return null
  return row
}

/* ------------------------------------------------------------------ */
/* Lecture des documents d'un dossier                                  */
/* ------------------------------------------------------------------ */

const PAGE = 1000
const MAX_DOCS = 20_000

/**
 * Toutes les lignes d'une requête, page par page : PostgREST plafonne une
 * réponse (1 000 lignes par défaut sur Supabase), une année de factures peut
 * dépasser.
 */
async function fetchAll(build: () => { range: (a: number, b: number) => PromiseLike<{ data: unknown; error: DbError }> }, where: string): Promise<Record<string, unknown>[]> {
  const all: Record<string, unknown>[] = []
  for (let from = 0; from < MAX_DOCS; from += PAGE) {
    const { data, error } = await build().range(from, from + PAGE - 1)
    if (error) raise(error, where)
    const rows = (data ?? []) as Record<string, unknown>[]
    all.push(...rows)
    if (rows.length < PAGE) break
  }
  return all
}

const one = <T>(v: T | T[] | null | undefined): T | null => (Array.isArray(v) ? v[0] ?? null : v ?? null)

export const INVOICE_LIST_COLUMNS =
  "id, user_id, invoice_number, status, issue_date, due_date, subtotal_ht, total_vat, total_ttc, lines, client:clients(id, name, siren, vat_number)"
export const CREDIT_LIST_COLUMNS =
  "id, user_id, credit_note_number, issue_date, subtotal_ht, total_vat, total_ttc, lines, reason, client:clients(id, name, siren, vat_number), original_invoice:invoices(id, invoice_number)"
export const INVOICE_PDF_COLUMNS = "*, client:clients(id,name,email,address,zip_code,city,country,siren,vat_number)"
export const CREDIT_PDF_COLUMNS =
  "*, client:clients(id,name,email,address,zip_code,city,country,siren,vat_number), original_invoice:invoices(id,invoice_number,issue_date,total_ttc)"
export const COMPANY_PDF_COLUMNS = "name,siren,siret,vat_number,address,zip_code,city,country,iban,legal_notice,accent_color,logo_url,email"

/**
 * Factures émises d'une entreprise sur la période : jamais un brouillon ni une
 * facture annulée, filtrées en base puis revérifiées ici (isIssuedInvoice,
 * user_id), au cas où une requête serait mal construite.
 */
export async function fetchIssuedInvoices(db: Db, ownerId: string, period: Period, columns = INVOICE_LIST_COLUMNS): Promise<Record<string, unknown>[]> {
  const rows = await fetchAll(
    () => db
      .from("invoices")
      .select(columns)
      .eq("user_id", ownerId)
      .gte("issue_date", period.from)
      .lte("issue_date", period.to)
      .neq("status", "draft")
      .neq("status", "cancelled")
      .not("invoice_number", "is", null)
      .order("issue_date", { ascending: true })
      .order("invoice_number", { ascending: true }),
    "factures",
  )
  return rows.filter((r) => r.user_id === ownerId && isIssuedInvoice(r as { status?: string; invoice_number?: string }))
}

/** Avoirs d'une entreprise sur la période (un avoir est toujours émis : pas de brouillon). */
export async function fetchCreditNotes(db: Db, ownerId: string, period: Period, columns = CREDIT_LIST_COLUMNS): Promise<Record<string, unknown>[]> {
  const rows = await fetchAll(
    () => db
      .from("credit_notes")
      .select(columns)
      .eq("user_id", ownerId)
      .gte("issue_date", period.from)
      .lte("issue_date", period.to)
      .order("issue_date", { ascending: true })
      .order("credit_note_number", { ascending: true }),
    "avoirs",
  )
  return rows.filter((r) => r.user_id === ownerId)
}

/** Dossier d'une période : documents, totaux et TVA. L'appelant a vérifié l'accès (authorizeDossier). */
export async function loadDossier(params: { ownerId: string; period: Period; today: string; db?: Db }): Promise<DossierData> {
  const db = params.db ?? createAdminClient()
  const { ownerId, period, today } = params

  const [{ data: company, error: compErr }, rawInvoices, rawCredits, supplierInvoices] = await Promise.all([
    db.from("companies").select("name, siren, city").eq("user_id", ownerId).maybeSingle(),
    fetchIssuedInvoices(db, ownerId, period),
    fetchCreditNotes(db, ownerId, period),
    loadSupplierInvoices(db, ownerId, period),
  ])
  if (compErr) raise(compErr, "loadDossier entreprise")

  return buildDossier({
    company: company as { name: string | null; siren: string | null; city: string | null } | null,
    period,
    today,
    supplierInvoices,
    invoices: rawInvoices.map((r) => ({
      id: String(r.id),
      invoice_number: (r.invoice_number as string | null) ?? null,
      status: String(r.status),
      issue_date: String(r.issue_date),
      due_date: (r.due_date as string | null) ?? null,
      subtotal_ht: r.subtotal_ht as number | null,
      total_vat: r.total_vat as number | null,
      total_ttc: r.total_ttc as number | null,
      lines: (r.lines as VatLine[] | null) ?? null,
      client_name: (one(r.client as { name?: string } | null)?.name as string | undefined) ?? null,
    })),
    creditNotes: rawCredits.map((r) => ({
      id: String(r.id),
      credit_note_number: String(r.credit_note_number),
      issue_date: String(r.issue_date),
      subtotal_ht: r.subtotal_ht as number | null,
      total_vat: r.total_vat as number | null,
      total_ttc: r.total_ttc as number | null,
      lines: (r.lines as VatLine[] | null) ?? null,
      reason: (r.reason as string | null) ?? null,
      client_name: (one(r.client as { name?: string } | null)?.name as string | undefined) ?? null,
      original_invoice_number: (one(r.original_invoice as { invoice_number?: string } | null)?.invoice_number as string | undefined) ?? null,
    })),
  })
}
