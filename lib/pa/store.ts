/**
 * Raccordement d'un compte à Super PDP : lecture et écriture de la table
 * `pa_connections` (serveur seul, clé service_role), jetons chiffrés, vérification
 * de l'état auprès de la plateforme.
 *
 * Rotation des jetons : chaque usage du jeton de rafraîchissement en donne un
 * nouveau et invalide l'ancien. Deux rafraîchissements simultanés (tâche
 * planifiée + clic de l'artisan) perdraient l'autorisation : un verrou en base
 * (`sync_lock_until`, écriture conditionnelle) sérialise tout ce qui touche aux
 * jetons ; le nouveau jeton est enregistré avant tout autre appel.
 */
import type { SupabaseClient } from "@supabase/supabase-js"
import { superPdpConfig, type PaMode, type SuperPdpConfig } from "@/lib/pa/superpdp/config"
import { paKey, seal, unseal } from "@/lib/pa/superpdp/crypto"
import { OAuthError, refreshTokens, type Fetch, type TokenSet } from "@/lib/pa/superpdp/oauth"
import { ApiError, createSuperPdpApi, type SuperPdpApi } from "@/lib/pa/superpdp/api"
import { derivePaStatus, isPaStatus, type PaStatus } from "@/lib/pa/status"

export const PA_TABLE = "pa_connections"

export interface ConnectionRow {
  user_id: string
  provider: string
  mode: PaMode
  status: string
  siren: string | null
  electronic_address: string | null
  platform_company_id: number | null
  company_verification: string | null
  identity_verification: string | null
  directory_status: string | null
  refresh_token_enc: string | null
  access_token_enc: string | null
  access_expires_at: string | null
  invoices_cursor: number | null
  events_cursor: number | null
  last_check_at: string | null
  last_sync_at: string | null
  last_sync_error: string | null
  sync_lock_until: string | null
  active_since: string | null
  notify_digest: boolean
  notify_each: boolean
  notify_failure: boolean
  notify_email: string | null
  activation_notified_at: string | null
  failure_notified_at: string | null
  last_digest_at: string | null
  pending_digest_count: number
  created_at: string
  updated_at: string
}

interface DbError { code?: string; message?: string }

/** Table absente : migration 20261030_pa_connections.sql pas encore appliquée. */
export function isMissingTable(error: DbError | null | undefined): boolean {
  if (!error) return false
  return /42P01|PGRST205|schema cache|does not exist/i.test(`${error.code ?? ""} ${error.message ?? ""}`)
}

export type LoadResult = { ok: true; row: ConnectionRow | null } | { ok: false; reason: "missing" | "error"; message?: string }

export async function loadConnection(admin: SupabaseClient, userId: string): Promise<LoadResult> {
  const { data, error } = await admin.from(PA_TABLE).select("*").eq("user_id", userId).maybeSingle()
  if (error) return isMissingTable(error) ? { ok: false, reason: "missing" } : { ok: false, reason: "error", message: error.message }
  return { ok: true, row: (data as ConnectionRow | null) ?? null }
}

export async function updateConnection(admin: SupabaseClient, userId: string, patch: Partial<ConnectionRow>): Promise<boolean> {
  const { error } = await admin.from(PA_TABLE).update({ ...patch, updated_at: new Date().toISOString() }).eq("user_id", userId)
  if (error) console.error("[pa] écriture du raccordement:", error.message)
  return !error
}

/** Enregistre un raccordement tout juste autorisé (retour du flux OAuth). */
export async function saveNewConnection(
  admin: SupabaseClient,
  p: { userId: string; mode: PaMode; siren: string | null; tokens: TokenSet; email: string | null },
): Promise<boolean> {
  const key = paKey("token")
  const now = new Date().toISOString()
  const { error } = await admin.from(PA_TABLE).upsert({
    user_id: p.userId,
    provider: "superpdp",
    mode: p.mode,
    status: "verifying",
    siren: p.siren,
    refresh_token_enc: p.tokens.refreshToken ? seal(p.tokens.refreshToken, key) : null,
    access_token_enc: seal(p.tokens.accessToken, key),
    access_expires_at: p.tokens.expiresAt,
    notify_email: p.email,
    last_sync_error: null,
    failure_notified_at: null,
    sync_lock_until: null,
    updated_at: now,
  }, { onConflict: "user_id" })
  if (error) console.error("[pa] enregistrement du raccordement:", error.message)
  return !error
}

/* ------------------------------------------------------------------ */
/* Verrou                                                              */
/* ------------------------------------------------------------------ */

export async function claimLock(admin: SupabaseClient, userId: string, seconds: number): Promise<boolean> {
  const now = new Date()
  const until = new Date(now.getTime() + seconds * 1000).toISOString()
  const { data, error } = await admin
    .from(PA_TABLE)
    .update({ sync_lock_until: until })
    .eq("user_id", userId)
    .or(`sync_lock_until.is.null,sync_lock_until.lt."${now.toISOString()}"`)
    .select("user_id")
  if (error) {
    console.error("[pa] verrou:", error.message)
    return false
  }
  return Array.isArray(data) && data.length === 1
}

export async function releaseLock(admin: SupabaseClient, userId: string): Promise<void> {
  await admin.from(PA_TABLE).update({ sync_lock_until: null }).eq("user_id", userId)
}

/* ------------------------------------------------------------------ */
/* Jeton d'accès                                                        */
/* ------------------------------------------------------------------ */

export class ConnectionError extends Error {
  constructor(public kind: "expired" | "unavailable" | "not_configured", message: string) {
    super(message)
    this.name = "ConnectionError"
  }
}

/**
 * Jeton d'accès valide pour ce raccordement, rafraîchi au besoin.
 * À appeler SOUS VERROU (claimLock) : le rafraîchissement fait tourner le jeton.
 */
export async function accessTokenFor(
  admin: SupabaseClient,
  row: ConnectionRow,
  opts: { cfg?: SuperPdpConfig | null; fetch?: Fetch; now?: () => number } = {},
): Promise<string> {
  const now = opts.now ?? Date.now
  const key = paKey("token")
  const cfg = opts.cfg === undefined ? superPdpConfig(row.mode) : opts.cfg
  if (!cfg) throw new ConnectionError("not_configured", "Super PDP n'est pas configuré pour ce mode.")

  const current = unseal(row.access_token_enc, key)
  const exp = row.access_expires_at ? Date.parse(row.access_expires_at) : 0
  if (current && exp - now() > 60_000) return current

  const refresh = unseal(row.refresh_token_enc, key)
  if (!refresh) {
    await markExpired(admin, row.user_id)
    throw new ConnectionError("expired", "Autorisation à renouveler.")
  }
  let tokens: TokenSet
  try {
    tokens = await refreshTokens(cfg, refresh, opts.fetch, now)
  } catch (err) {
    if (err instanceof OAuthError && err.kind === "revoked") {
      await markExpired(admin, row.user_id)
      throw new ConnectionError("expired", "Autorisation expirée ou retirée chez Super PDP.")
    }
    throw new ConnectionError("unavailable", err instanceof Error ? err.message : "Super PDP indisponible.")
  }
  const patch: Partial<ConnectionRow> = {
    access_token_enc: seal(tokens.accessToken, key),
    access_expires_at: tokens.expiresAt,
    // Rotation : le nouveau jeton remplace l'ancien, qui ne sert plus
    ...(tokens.refreshToken ? { refresh_token_enc: seal(tokens.refreshToken, key) } : {}),
  }
  const saved = await updateConnection(admin, row.user_id, patch)
  if (!saved) throw new ConnectionError("unavailable", "Enregistrement du jeton impossible.")
  Object.assign(row, patch)
  return tokens.accessToken
}

async function markExpired(admin: SupabaseClient, userId: string) {
  await updateConnection(admin, userId, { status: "expired", access_token_enc: null, refresh_token_enc: null, access_expires_at: null })
}

/** Client API prêt à l'emploi pour ce raccordement (sous verrou). */
export async function apiFor(admin: SupabaseClient, row: ConnectionRow, opts: { fetch?: Fetch } = {}): Promise<SuperPdpApi> {
  const token = await accessTokenFor(admin, row, opts)
  return createSuperPdpApi(token, opts.fetch)
}

/* ------------------------------------------------------------------ */
/* Vérification de l'état                                               */
/* ------------------------------------------------------------------ */

/**
 * Interroge la plateforme et enregistre l'état. Sous verrou. Panne de la
 * plateforme : l'état enregistré ne change pas (on ne conclut rien d'une panne).
 */
export async function checkConnection(
  admin: SupabaseClient,
  row: ConnectionRow,
  opts: { fetch?: Fetch } = {},
): Promise<{ status: PaStatus; changed: boolean }> {
  const before = isPaStatus(row.status) ? row.status : "verifying"
  let api: SuperPdpApi
  try {
    api = await apiFor(admin, row, opts)
  } catch (err) {
    if (err instanceof ConnectionError && err.kind === "expired") return { status: "expired", changed: before !== "expired" }
    throw err
  }

  const session = await api.session()
  const patch: Partial<ConnectionRow> = {
    company_verification: session.company_verification_status,
    identity_verification: session.user_identity_verification_status ?? null,
    last_check_at: new Date().toISOString(),
  }
  let derived: { status: PaStatus; address: string | null }
  if (session.company_verification_status !== "verified") {
    derived = derivePaStatus({ company: session.company_verification_status, identity: session.user_identity_verification_status })
  } else {
    const company = await api.company().catch((e) => (e instanceof ApiError && e.status === 403 ? null : Promise.reject(e)))
    const siren = company?.number && /^\d{9}$/.test(company.number) ? company.number : row.siren
    const entries = (await api.directoryEntries()).filter((e) => !e.is_replyto)
    let active: string[] | null = null
    if (siren && row.mode === "live") {
      active = await api.frenchDirectory(siren).then((list) => list.filter((e) => e.is_active).map((e) => e.identifier)).catch(() => null)
    }
    derived = derivePaStatus({
      company: "verified",
      identity: session.user_identity_verification_status,
      entries: entries.map((e) => ({ identifier: e.identifier, status: e.status })),
      // En bac à sable, l'annuaire officiel ne connaît pas les entreprises fictives
      activeInFrenchDirectory: row.mode === "live" ? active : null,
    })
    if (company?.id) patch.platform_company_id = company.id
    if (siren) patch.siren = siren
    patch.directory_status = entries[0]?.status ?? null
  }
  patch.status = derived.status
  if (derived.address) patch.electronic_address = derived.address
  if (derived.status === "active" && !row.active_since) patch.active_since = new Date().toISOString()
  await updateConnection(admin, row.user_id, patch)
  Object.assign(row, patch)
  return { status: derived.status, changed: derived.status !== before }
}
