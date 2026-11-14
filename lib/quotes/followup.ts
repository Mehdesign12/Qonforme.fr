/**
 * Email de suivi à l'artisan : « Le devis … a-t-il été accepté ? » (14/11/2026).
 *
 * Constat (PostHog, 14/11) : les inscrits font leurs devis, les téléchargent en PDF
 * et ne reviennent pas facturer. Un email, environ 10 jours après l'envoi du devis
 * (ou le téléchargement de son PDF), propose de le marquer accepté et de préparer
 * la facture en un clic (`/quotes/<id>?accepte=1`).
 *
 * Règles :
 *  - devis « envoyé » (date d'envoi, sinon date du devis) ou brouillon dont le PDF a
 *    été téléchargé (`pdf_downloaded_at`), il y a 10 à 45 jours, encore valable,
 *    pas encore facturé ;
 *  - un seul email par devis (`artisan_followup_at`, réservé avant l'envoi, rendu
 *    si l'envoi échoue), au plus un par compte et par passage ;
 *  - du lundi au samedi, de 9 h à 19 h (heure de Paris), jamais après une
 *    désinscription des conseils (email_preferences.onboarding_emails = false) ;
 *  - sans la migration 20261114_quote_pdf_followup.sql : rien ne part.
 *
 * Lancé par /api/cron/onboarding. Ne lève jamais.
 */
import type { SupabaseClient } from "@supabase/supabase-js"
import { isMissingSchemaError } from "@/lib/supabase/schema-guard"
import { daysBetween, parisDayOf, todayInParis } from "@/lib/utils/paris-date"
import { isSequenceSendingTime } from "@/lib/onboarding/sequence"
import { listUnsubscribeHeaders, unsubscribePageUrl } from "@/lib/onboarding/unsubscribe"
import { sendAccountEmail } from "@/lib/email/journal"
import { buildQuoteFollowupEmail } from "@/lib/email/templates/quote-followup-artisan"

export const FOLLOWUP_AFTER_DAYS = 10
export const FOLLOWUP_MAX_DAYS = 45
export const FOLLOWUP_PER_RUN = 20

export interface FollowupQuote {
  id: string
  user_id: string
  status: string
  quote_number: string | null
  total_ttc: number | null
  issue_date: string | null
  valid_until: string | null
  sent_at: string | null
  pdf_downloaded_at: string | null
  converted_invoice_id: string | null
  client: { name: string | null } | { name: string | null }[] | null
}

/** Date de départ du suivi (jour de Paris) et son origine, ou null si le devis n'en a pas. */
export function followupStart(q: Pick<FollowupQuote, "status" | "sent_at" | "issue_date" | "pdf_downloaded_at">): { day: string; origin: "sent" | "downloaded" } | null {
  if (q.status === "sent") {
    const at = q.sent_at ? parisDayOf(q.sent_at) : q.issue_date
    return at ? { day: at, origin: "sent" } : null
  }
  if (q.status === "draft" && q.pdf_downloaded_at) return { day: parisDayOf(q.pdf_downloaded_at), origin: "downloaded" }
  return null
}

/** Le devis appelle son email de suivi aujourd'hui. Fonction pure. */
export function isFollowupDue(q: FollowupQuote, today: string): boolean {
  if (q.converted_invoice_id) return false
  if (q.valid_until && q.valid_until < today) return false
  const start = followupStart(q)
  if (!start) return false
  const age = daysBetween(start.day, today)
  return age >= FOLLOWUP_AFTER_DAYS && age <= FOLLOWUP_MAX_DAYS
}

/** Un devis par compte (le plus ancien), au plus `limit`. Fonction pure. */
export function pickFollowups(quotes: FollowupQuote[], today: string, limit = FOLLOWUP_PER_RUN): FollowupQuote[] {
  const byUser = new Map<string, FollowupQuote>()
  for (const q of quotes) {
    if (!isFollowupDue(q, today)) continue
    const prev = byUser.get(q.user_id)
    if (!prev || followupStart(q)!.day < followupStart(prev)!.day) byUser.set(q.user_id, q)
  }
  return Array.from(byUser.values()).slice(0, limit)
}

export type FollowupResult = { sent: number; skipped: number; errors: string[]; inactive?: boolean }

const clientName = (c: FollowupQuote["client"]) => (Array.isArray(c) ? c[0]?.name : c?.name) ?? null

export async function runQuoteFollowups(admin: SupabaseClient, now = new Date()): Promise<FollowupResult> {
  const res: FollowupResult = { sent: 0, skipped: 0, errors: [] }
  try {
    if (!isSequenceSendingTime(now)) return res
    const today = todayInParis(now)
    const { data, error } = await admin
      .from("quotes")
      .select("id,user_id,status,quote_number,total_ttc,issue_date,valid_until,sent_at,pdf_downloaded_at,converted_invoice_id,client:clients(name)")
      .is("artisan_followup_at", null)
      .in("status", ["draft", "sent"])
      .order("created_at", { ascending: true })
      .limit(1000)
    if (error) {
      if (isMissingSchemaError(error)) return { ...res, inactive: true }
      res.errors.push(`Lecture des devis : ${error.message}`)
      return res
    }
    const picked = pickFollowups((data ?? []) as FollowupQuote[], today)
    if (picked.length === 0) return res

    const ids = picked.map((q) => q.user_id)
    const prefs = await admin.from("email_preferences").select("user_id,onboarding_emails").in("user_id", ids)
    if (prefs.error && !isMissingSchemaError(prefs.error)) {
      res.errors.push(`Lecture des préférences : ${prefs.error.message}`)
      return res
    }
    const optedOut = new Set(((prefs.data ?? []) as { user_id: string; onboarding_emails: boolean }[])
      .filter((r) => r.onboarding_emails === false).map((r) => r.user_id))

    for (const q of picked) {
      if (optedOut.has(q.user_id)) { res.skipped++; continue }
      const unsubscribeUrl = unsubscribePageUrl(q.user_id)
      const headers = listUnsubscribeHeaders(q.user_id)
      if (!unsubscribeUrl || !headers) { res.errors.push("Secret de désinscription absent"); return res }

      const { data: user, error: userError } = await admin.auth.admin.getUserById(q.user_id)
      if (userError || !user?.user?.email) { res.skipped++; continue }
      const meta = (user.user.user_metadata ?? {}) as { first_name?: unknown }

      // Réservation : un seul email par devis, même si deux passages se croisent
      const stamp = now.toISOString()
      const { data: claimed, error: claimError } = await admin
        .from("quotes").update({ artisan_followup_at: stamp })
        .eq("id", q.id).is("artisan_followup_at", null).select("id")
      if (claimError) { res.errors.push(`${q.id}: ${claimError.message}`); continue }
      if (!claimed || claimed.length === 0) { res.skipped++; continue }

      const start = followupStart(q)!
      const { subject, html } = buildQuoteFollowupEmail({
        quoteId: q.id,
        quoteNumber: q.quote_number,
        clientName: clientName(q.client),
        totalTtc: q.total_ttc,
        origin: start.origin,
        firstName: typeof meta.first_name === "string" ? meta.first_name : null,
        unsubscribeUrl,
      })
      const out = await sendAccountEmail(admin, {
        userId: q.user_id, category: "account", template: "quote_followup", to: user.user.email, subject, html, headers,
      })
      if ("error" in out) {
        await admin.from("quotes").update({ artisan_followup_at: null }).eq("id", q.id).eq("artisan_followup_at", stamp)
        res.errors.push(`${q.id}: ${out.error}`)
      } else if ("taken" in out) res.skipped++
      else res.sent++
    }
  } catch (err) {
    res.errors.push(err instanceof Error ? err.message : String(err))
  }
  return res
}
