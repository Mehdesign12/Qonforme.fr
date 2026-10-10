/**
 * Envoi du résumé hebdomadaire SEO et de son aperçu (Paramètres › Rapports).
 *
 * Anti-doublon : chaque essai insère sa ligne seo_digests AVANT l'envoi
 * (statut « sending ») ; sa clé unique empêche deux envois du même essai,
 * même si deux passages du cron se chevauchent. Après l'envoi, la ligne passe
 * à « sent » ou « failed ». Sans adresse de l'administrateur (ADMIN_EMAIL) ou
 * sans clé Resend, la semaine est notée « skipped » avec la raison, sans
 * nouvel essai.
 *
 * Nouveaux essais : 3 essais par semaine ISO au plus, une ligne chacun
 * (`period_key` « 2026-W42 », puis « 2026-W42#2 », « 2026-W42#3 »). Un essai
 * « failed », ou resté « sending » plus de 15 minutes (envoi interrompu), est
 * refait au passage suivant de la tâche ou par un lancement manuel.
 *
 * Aperçu : 3 envois par heure au plus, chacun noté (kind « preview »). La
 * limite tient même avec des demandes simultanées (deux onglets) : la ligne
 * de l'aperçu est insérée d'abord, puis les aperçus de l'heure sont comptés,
 * le sien compris (reserveSlot).
 */
import { randomBytes } from "node:crypto"
import { sendEmail } from "@/lib/email/resend"
import { renderSeoDigest } from "@/lib/email/templates/seo-digest"
import { must, type SeoDb } from "@/lib/seo/db"
import { SITE_ORIGIN } from "@/lib/seo/site"
import { buildDigest } from "@/lib/seo/reports/digest"
import { currentWeekKey } from "@/lib/seo/reports/schedule"
import type { DigestSections } from "@/lib/seo/reports/types"

export const PREVIEW_LIMIT_PER_HOUR = 3

/** Adresse de l'administrateur (ADMIN_EMAIL) ; null si absente ou invalide. */
export function digestRecipient(): string | null {
  const raw = process.env.ADMIN_EMAIL?.trim()
  return raw && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(raw) ? raw : null
}

/** Origine des liens de l'email (l'admin vit sur le domaine de l'application). */
export function digestBaseUrl(): string {
  return (process.env.NEXT_PUBLIC_APP_URL?.trim() || SITE_ORIGIN).replace(/\/+$/, "")
}

/** Raison pour laquelle aucun email ne peut partir ; null si tout est prêt. */
export function deliveryProblem(): string | null {
  if (!digestRecipient()) return "Adresse de l'administrateur absente : ajoutez ADMIN_EMAIL dans les variables d'environnement."
  if (!process.env.RESEND_API_KEY?.trim()) return "Resend n'est pas configuré : ajoutez RESEND_API_KEY dans les variables d'environnement."
  return null
}

/** Message d'erreur sûr à enregistrer (jamais de clé, longueur bornée). */
function safeError(error: unknown): string {
  let message = error instanceof Error ? error.message : String(error)
  const key = process.env.RESEND_API_KEY?.trim()
  if (key && key.length >= 6) message = message.split(key).join("•••")
  return message.replace(/Bearer\s+\S+/gi, "Bearer •••").slice(0, 500)
}

export type WeeklyDigestOutcome =
  | { status: "sent"; periodKey: string; subject: string }
  | { status: "failed"; periodKey: string; subject?: string; error: string }
  | { status: "skipped"; periodKey: string; reason: string }
  | { status: "duplicate"; periodKey: string }

/** Essais par semaine ISO au plus. */
export const DIGEST_MAX_ATTEMPTS = 3
/** Un essai resté « sending » plus longtemps est tenu pour interrompu. */
export const DIGEST_STALE_MS = 15 * 60_000

/** Clé d'un essai : « 2026-W42 », puis « 2026-W42#2 », « 2026-W42#3 ». */
export function attemptKey(week: string, attempt: number): string {
  return attempt <= 1 ? week : `${week}#${attempt}`
}

export interface DigestAttempt {
  periodKey: string
  attempt: number
  status: "sending" | "sent" | "failed" | "skipped"
  createdAt: string
  sentAt: string | null
  /** Motif d'échec ou de non-envoi, sans clé. */
  error: string | null
}

type DigestRow = { period_key: string; status: string; created_at: string; sent_at: string | null; error: string | null }

function attemptOf(row: DigestRow): DigestAttempt {
  const n = Number(row.period_key.split("#")[1] ?? 1)
  return {
    periodKey: row.period_key,
    attempt: Number.isFinite(n) && n >= 1 ? n : 1,
    status: (["sending", "sent", "failed", "skipped"].includes(row.status) ? row.status : "failed") as DigestAttempt["status"],
    createdAt: row.created_at,
    sentAt: row.sent_at ?? null,
    error: row.error ? safeError(row.error) : null,
  }
}

/** Essais de la semaine ISO `week`, dans l'ordre. */
export async function readWeekAttempts(db: SeoDb, week: string): Promise<DigestAttempt[]> {
  const keys = Array.from({ length: DIGEST_MAX_ATTEMPTS }, (_, i) => attemptKey(week, i + 1))
  const rows = (must(
    await db.from("seo_digests").select("period_key, status, created_at, sent_at, error").in("period_key", keys),
    "les résumés hebdomadaires",
  ) ?? []) as DigestRow[]
  return rows.map(attemptOf).sort((a, b) => a.attempt - b.attempt)
}

/**
 * État de la semaine :
 * - none : aucun essai ;
 * - done : envoyé, non envoyé faute de configuration, ou 3 essais épuisés ;
 * - retry : dernier essai en échec ou interrompu, nouvel essai possible maintenant ;
 * - wait : envoi en cours (moins de 15 minutes).
 */
export type WeekDigestState =
  | { kind: "none" }
  | { kind: "done"; last: DigestAttempt }
  | { kind: "retry"; last: DigestAttempt; next: number }
  | { kind: "wait"; last: DigestAttempt }

export function weekDigestState(attempts: DigestAttempt[], now: Date): WeekDigestState {
  const last = attempts[attempts.length - 1]
  if (!last) return { kind: "none" }
  if (last.status === "sent" || last.status === "skipped") return { kind: "done", last }
  const stale = last.status === "sending" && now.getTime() - Date.parse(last.createdAt) >= DIGEST_STALE_MS
  if (last.status === "sending" && !stale) return { kind: "wait", last }
  if (last.attempt >= DIGEST_MAX_ATTEMPTS) return { kind: "done", last }
  return { kind: "retry", last, next: last.attempt + 1 }
}

/** Dernier essai d'un résumé hebdomadaire (toutes semaines) ; null s'il n'y en a aucun. */
export async function lastWeeklyAttempt(db: SeoDb): Promise<DigestAttempt | null> {
  const row = must(
    await db
      .from("seo_digests")
      .select("period_key, status, created_at, sent_at, error")
      .eq("kind", "weekly")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    "les résumés hebdomadaires",
  ) as DigestRow | null
  return row ? attemptOf(row) : null
}

/** Dernier résumé hebdomadaire envoyé (date d'envoi) ; null s'il n'y en a aucun. */
export async function lastWeeklySentAt(db: SeoDb): Promise<string | null> {
  const row = must(
    await db
      .from("seo_digests")
      .select("sent_at")
      .eq("kind", "weekly")
      .eq("status", "sent")
      .order("sent_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    "les résumés hebdomadaires",
  ) as { sent_at: string | null } | null
  return row?.sent_at ?? null
}

async function insertDigestRow(db: SeoDb, row: Record<string, unknown>): Promise<"inserted" | "duplicate"> {
  const res = await db.from("seo_digests").insert(row)
  if (res.error && res.error.code === "23505") return "duplicate"
  must(res, "l'enregistrement du résumé")
  return "inserted"
}

async function finishDigestRow(db: SeoDb, periodKey: string, patch: Record<string, unknown>): Promise<void> {
  const { error } = await db.from("seo_digests").update(patch).eq("period_key", periodKey)
  if (error) console.error(`[seo-digest] état du résumé ${periodKey} non enregistré`, error.message)
}

async function deliver(
  db: SeoDb,
  periodKey: string,
  now: Date,
  opts: { sections?: DigestSections; preview: boolean },
): Promise<{ ok: true; subject: string } | { ok: false; subject?: string; error: string }> {
  let subject: string | undefined
  try {
    const digest = await buildDigest(db, now, opts.sections)
    const rendered = renderSeoDigest(digest, { baseUrl: digestBaseUrl(), preview: opts.preview })
    subject = rendered.subject
    await finishDigestRow(db, periodKey, { subject, payload: digest })
    await sendEmail({ to: digestRecipient() as string, subject: rendered.subject, html: rendered.html, fromName: "Qonforme" })
    await finishDigestRow(db, periodKey, { status: "sent", sent_at: new Date().toISOString(), error: null })
    return { ok: true, subject }
  } catch (error) {
    const message = safeError(error)
    console.error(`[seo-digest] envoi ${periodKey} en échec : ${message}`)
    await finishDigestRow(db, periodKey, { status: "failed", error: message })
    return { ok: false, subject, error: message }
  }
}

/**
 * Résumé de la semaine ISO en cours (heure de Paris) : un envoi réussi par
 * semaine, 3 essais au plus. « duplicate » si la semaine est déjà traitée ou
 * si un envoi est en cours.
 */
export async function sendWeeklyDigest(db: SeoDb, now: Date): Promise<WeeklyDigestOutcome> {
  const week = currentWeekKey(now)
  const state = weekDigestState(await readWeekAttempts(db, week), now)
  if (state.kind === "done" || state.kind === "wait") return { status: "duplicate", periodKey: state.last.periodKey }
  const periodKey = attemptKey(week, state.kind === "retry" ? state.next : 1)
  // Essai précédent interrompu : noté en échec avant d'en lancer un autre
  if (state.kind === "retry" && state.last.status === "sending") {
    const { error } = await db
      .from("seo_digests")
      .update({ status: "failed", error: "Envoi interrompu : aucune réponse en 15 minutes." })
      .eq("period_key", state.last.periodKey)
      .eq("status", "sending")
    if (error) console.error(`[seo-digest] essai ${state.last.periodKey} non clos`, error.message)
  }
  const createdAt = now.toISOString()
  const problem = deliveryProblem()
  if (problem) {
    const inserted = await insertDigestRow(db, { period_key: periodKey, kind: "weekly", status: "skipped", error: problem, created_at: createdAt })
    return inserted === "duplicate" ? { status: "duplicate", periodKey } : { status: "skipped", periodKey, reason: problem }
  }
  const inserted = await insertDigestRow(db, { period_key: periodKey, kind: "weekly", status: "sending", created_at: createdAt })
  if (inserted === "duplicate") return { status: "duplicate", periodKey }
  const result = await deliver(db, periodKey, now, { preview: false })
  return result.ok
    ? { status: "sent", periodKey, subject: result.subject }
    : { status: "failed", periodKey, subject: result.subject, error: result.error }
}

/** Erreur d'un aperçu, avec le code HTTP de la route. */
export class DigestPreviewError extends Error {
  readonly status: number
  constructor(status: number, message: string) {
    super(message)
    this.name = "DigestPreviewError"
    this.status = status
  }
}

type SlotRow = { period_key: string; created_at: string; status: string }

/**
 * Ordre d'arrivée : date de création, puis aperçu déjà traité avant aperçu
 * en cours, puis clé (unique) pour départager.
 */
function bySlotOrder(a: SlotRow, b: SlotRow): number {
  const byDate = Date.parse(a.created_at) - Date.parse(b.created_at)
  if (byDate !== 0 && Number.isFinite(byDate)) return byDate
  const byStatus = Number(a.status === "sending") - Number(b.status === "sending")
  if (byStatus !== 0) return byStatus
  return a.period_key < b.period_key ? -1 : a.period_key > b.period_key ? 1 : 0
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

/**
 * Réserve une place d'aperçu dans l'heure. La ligne « sending » est déjà
 * insérée : on compte les aperçus de l'heure qui ne sont pas « skipped ».
 * Règle sûre : un aperçu ne part que si, à sa dernière lecture, moins de 3
 * AUTRES aperçus non refusés existent dans l'heure (le dernier lecteur de
 * plusieurs demandes simultanées les voit tous : jamais plus de 3 envois).
 * Un aperçu déjà derrière 3 autres est refusé tout de suite ; un aperçu
 * parmi les 3 premiers relit après un court délai, le temps que les
 * demandes simultanées refusées le soient (au pire, il est refusé aussi).
 * Rend { ok: false, freeAt } si la limite est atteinte (freeAt : heure où une place se libère).
 */
async function reserveSlot(db: SeoDb, periodKey: string, now: Date): Promise<{ ok: true } | { ok: false; freeAt: Date }> {
  const since = new Date(now.getTime() - 3_600_000).toISOString()
  const attempts = 5
  for (let attempt = 0; attempt < attempts; attempt++) {
    const rows = (must(
      await db
        .from("seo_digests")
        .select("period_key, created_at, status")
        .eq("kind", "preview")
        .in("status", ["sending", "sent", "failed"])
        .gte("created_at", since)
        .order("created_at", { ascending: true })
        .limit(50),
      "les aperçus envoyés",
    ) ?? []) as SlotRow[]
    const sorted = rows.slice().sort(bySlotOrder)
    const others = sorted.filter((r) => r.period_key !== periodKey)
    const mine = sorted.find((r) => r.period_key === periodKey)
    const before = mine ? others.filter((r) => bySlotOrder(r, mine) < 0).length : others.length
    if (others.length < PREVIEW_LIMIT_PER_HOUR) return { ok: true }
    if (before >= PREVIEW_LIMIT_PER_HOUR || attempt === attempts - 1) {
      const oldest = others[others.length - PREVIEW_LIMIT_PER_HOUR]?.created_at ?? others[0]?.created_at ?? now.toISOString()
      return { ok: false, freeAt: new Date(Date.parse(oldest) + 3_600_000) }
    }
    await sleep(60 + Math.floor(Math.random() * 120) * (attempt + 1))
  }
  return { ok: false, freeAt: new Date(now.getTime() + 3_600_000) }
}

/**
 * Aperçu envoyé à l'adresse de l'administrateur avec les sections choisies
 * (celles affichées dans la page, même non enregistrées).
 */
export async function sendPreviewDigest(db: SeoDb, now: Date, sections: DigestSections): Promise<{ subject: string }> {
  const problem = deliveryProblem()
  if (problem) throw new DigestPreviewError(409, problem)

  const periodKey = `preview-${now.toISOString()}-${randomBytes(4).toString("hex")}`
  await insertDigestRow(db, { period_key: periodKey, kind: "preview", status: "sending", created_at: now.toISOString() })
  const slot = await reserveSlot(db, periodKey, now)
  if (!slot.ok) {
    await finishDigestRow(db, periodKey, { status: "skipped", error: `Limite de ${PREVIEW_LIMIT_PER_HOUR} aperçus par heure atteinte.` })
    const at = slot.freeAt.toLocaleTimeString("fr-FR", { timeZone: "Europe/Paris", hour: "2-digit", minute: "2-digit" })
    throw new DigestPreviewError(429, `${PREVIEW_LIMIT_PER_HOUR} aperçus par heure au plus : réessayez à partir de ${at}.`)
  }

  const result = await deliver(db, periodKey, now, { sections, preview: true })
  if (!result.ok) throw new DigestPreviewError(502, "L'aperçu n'a pas pu partir : Resend a refusé l'envoi. Réessayez dans un instant.")
  return { subject: result.subject }
}
