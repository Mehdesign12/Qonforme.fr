/**
 * Journal des emails envoyés au titulaire d'un compte (table account_emails,
 * migration 20261110_account_emails.sql) et liens de retour suivis.
 *
 * - `sendAccountEmail` réserve une ligne, remplace les liens vers le site par
 *   des liens de retour signés (/api/emails/c), envoie, puis note l'identifiant
 *   Resend. Table absente (migration pas appliquée) : l'email part comme avant,
 *   sans journal. Une panne d'écriture du journal n'empêche jamais l'envoi
 *   d'un email déjà réservé.
 * - Les clics passent par nos liens de retour : fiables, sans pixel. Les
 *   ouvertures ne sont pas suivies (décision du 10/11/2026).
 * - La copie gardée est le HTML d'origine (sans liens de retour) : l'ouvrir
 *   dans l'admin ne compte jamais un clic.
 *
 * Côté serveur seulement (node:crypto, clé service_role).
 */
import { createHmac, timingSafeEqual } from "node:crypto"
import type { SupabaseClient } from "@supabase/supabase-js"
import { sendEmail } from "@/lib/email/resend"
import { isMissingSchemaError } from "@/lib/supabase/schema-guard"
import { appBaseUrl, unsubscribeSecret } from "@/lib/onboarding/unsubscribe"
import { safeNextPath } from "@/lib/stripe/access"

export const EMAIL_CATEGORIES = ["onboarding", "reprise", "manual", "account"] as const
export type EmailCategory = (typeof EMAIL_CATEGORIES)[number]

export const EMAIL_STATUSES = ["sending", "sent", "delivered", "bounced", "complained", "failed"] as const
export type EmailStatus = (typeof EMAIL_STATUSES)[number]

/** Copies gardées 12 mois. */
export const EMAIL_RETENTION_DAYS = 365

const SCOPE = "account-email-click:v1"
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const UNIQUE_VIOLATION = "23505"

/* ------------------------------------------------------------------ */
/* Liens de retour                                                     */
/* ------------------------------------------------------------------ */

function clickMac(secret: string, emailId: string, path: string): string {
  return createHmac("sha256", secret).update(`${SCOPE}:${emailId.toLowerCase()}:${path}`).digest("base64url")
}

/** Lien de retour signé vers `path` (chemin du site), ou null sans secret. */
export function trackedLink(emailId: string, path: string, base = appBaseUrl(), secret = unsubscribeSecret()): string | null {
  if (!secret || !UUID.test(emailId) || !safeNextPath(path)) return null
  const s = clickMac(secret, emailId, path)
  return `${base}/api/emails/c?e=${encodeURIComponent(emailId.toLowerCase())}&p=${encodeURIComponent(path)}&s=${s}`
}

/** Chemin de destination si le lien est valable, sinon null. */
export function verifyTrackedLink(
  params: { e: unknown; p: unknown; s: unknown },
  secret = unsubscribeSecret(),
): { emailId: string; path: string } | null {
  const { e, p, s } = params
  if (!secret || typeof e !== "string" || typeof p !== "string" || typeof s !== "string") return null
  if (!UUID.test(e) || s.length !== 43) return null
  const path = safeNextPath(p)
  if (!path) return null
  const expected = Buffer.from(clickMac(secret, e, path))
  const given = Buffer.from(s)
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null
  return { emailId: e.toLowerCase(), path }
}

/** Liens jamais réécrits : désinscription (doit marcher tel quel, RFC 8058). */
const UNTRACKED = [/^\/desinscription/, /^\/api\/emails\//]

const decodeAttr = (v: string) => v.replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;/g, "'")
const encodeAttr = (v: string) => v.replace(/&/g, "&amp;").replace(/"/g, "&quot;")

/**
 * Remplace chaque `href` vers le site par un lien de retour signé.
 * Les liens externes, les ancres et la désinscription restent tels quels.
 */
export function wrapLinks(html: string, emailId: string, base = appBaseUrl(), secret = unsubscribeSecret()): string {
  if (!secret) return html
  const escapedBase = base.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
  const re = new RegExp(`href="${escapedBase}(/[^"]*)?"`, "g")
  return html.replace(re, (whole, rawPath: string | undefined) => {
    const path = decodeAttr(rawPath || "/")
    if (UNTRACKED.some((u) => u.test(path))) return whole
    const link = trackedLink(emailId, path, base, secret)
    return link ? `href="${encodeAttr(link)}"` : whole
  })
}

/* ------------------------------------------------------------------ */
/* Envoi journalisé                                                    */
/* ------------------------------------------------------------------ */

export interface AccountEmail {
  userId: string
  category: EmailCategory
  /** Modèle (« welcome », « reprise_company_1 », « manual_free »…). */
  template: string
  to: string
  subject: string
  html: string
  headers?: Record<string, string>
  /** Admin qui a lancé un envoi à la main. */
  sentBy?: string | null
}

export type AccountEmailResult =
  | { sent: true; journalId: string | null }
  /** Email de reprise déjà envoyé (ou en cours d'envoi) à ce compte. */
  | { taken: true }
  | { error: string }

type Db = SupabaseClient

/**
 * Envoie un email au titulaire d'un compte et l'inscrit au journal.
 * Une réservation de reprise qui échoue est retirée (l'email repartira) ;
 * un autre échec reste au journal, marqué « failed ».
 */
export async function sendAccountEmail(admin: Db, mail: AccountEmail): Promise<AccountEmailResult> {
  const send = (html: string) =>
    sendEmail({ to: mail.to, subject: mail.subject, html, fromName: "Qonforme", headers: mail.headers })

  let reserved: { data: unknown; error: { code?: string; message: string } | null }
  try {
    reserved = await admin
    .from("account_emails")
    .insert({
      user_id: mail.userId,
      category: mail.category,
      template: mail.template,
      subject: mail.subject,
      sent_to: mail.to,
      html: mail.html,
      sent_by: mail.sentBy ?? null,
      status: "sending",
    })
    .select("id")
    .single()
  } catch (err) {
    reserved = { data: null, error: { message: err instanceof Error ? err.message : String(err) } }
  }
  const { data, error } = reserved

  if (error || !data) {
    if (error?.code === UNIQUE_VIOLATION) return { taken: true }
    if (error && !isMissingSchemaError(error)) {
      // Journal illisible : une reprise ne part pas (risque de doublon), le reste part sans journal
      if (mail.category === "reprise") return { error: `Journal : ${error.message}` }
      console.error("[emails] journal indisponible :", error.message)
    }
    try {
      await send(mail.html)
      return { sent: true, journalId: null }
    } catch (err) {
      return { error: err instanceof Error ? err.message : String(err) }
    }
  }

  const id = (data as { id: string }).id
  try {
    const { id: resendId } = await send(wrapLinks(mail.html, id))
    const { error: upError } = await admin
      .from("account_emails")
      .update({ status: "sent", resend_id: resendId || null, sent_at: new Date().toISOString() })
      .eq("id", id)
      .eq("status", "sending")
    if (upError) console.error("[emails] journal non mis à jour", id, upError.message)
    return { sent: true, journalId: id }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    if (mail.category === "reprise") {
      await admin.from("account_emails").delete().eq("id", id)
    } else {
      await admin.from("account_emails").update({ status: "failed", error: message.slice(0, 500) }).eq("id", id)
    }
    return { error: message }
  }
}

/** Compte un clic sur un lien de retour. Ne lève jamais. */
export async function recordClick(admin: Db, emailId: string, now = new Date()): Promise<void> {
  try {
    const { data, error } = await admin
      .from("account_emails")
      .select("click_count, first_clicked_at")
      .eq("id", emailId)
      .maybeSingle()
    if (error || !data) return
    const row = data as { click_count: number | null; first_clicked_at: string | null }
    await admin
      .from("account_emails")
      .update({ click_count: (row.click_count ?? 0) + 1, first_clicked_at: row.first_clicked_at ?? now.toISOString() })
      .eq("id", emailId)
  } catch (err) {
    console.error("[emails] clic non compté :", err)
  }
}

/* ------------------------------------------------------------------ */
/* Événements Resend                                                   */
/* ------------------------------------------------------------------ */

export interface ResendEvent {
  type: string
  created_at?: string
  data?: { email_id?: string }
}

/** Mise à jour du journal pour un événement Resend (null : rien à faire). */
export function eventUpdate(event: ResendEvent): Record<string, string> | null {
  const at = event.created_at && !Number.isNaN(Date.parse(event.created_at)) ? new Date(event.created_at).toISOString() : new Date().toISOString()
  switch (event.type) {
    case "email.delivered":
      return { status: "delivered", delivered_at: at }
    case "email.bounced":
      return { status: "bounced", bounced_at: at }
    case "email.complained":
      return { status: "complained" }
    case "email.opened":
      return { opened_at: at }
    default:
      return null
  }
}

/** Applique un événement Resend. `false` : erreur passagère (Resend réessaiera). */
export async function applyResendEvent(admin: Db, event: ResendEvent): Promise<boolean> {
  const resendId = event.data?.email_id
  const update = eventUpdate(event)
  if (!resendId || !update) return true

  let query = admin.from("account_emails").update(update).eq("resend_id", resendId)
  // Un « remis » arrivé après un rejet ne l'efface pas ; une ouverture garde la première date
  if (event.type === "email.delivered") query = query.in("status", ["sending", "sent"])
  if (event.type === "email.opened") query = query.is("opened_at", null)
  const { error } = await query
  if (!error) return true
  if (isMissingSchemaError(error)) return true
  console.error("[webhooks/resend]", error.message)
  return false
}
