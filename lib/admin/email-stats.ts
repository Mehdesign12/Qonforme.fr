/**
 * Mesures par modèle d'email (Admin › Emails) : envoyés, remis, rejetés,
 * cliqués, et part des comptes qui ont franchi l'étape visée dans les 7 jours
 * suivant l'email. Lu dans la base, sans traceur.
 *
 * Étape visée par modèle :
 *   premier devis    un devis créé après l'email ;
 *   envoyer le devis un devis envoyé (sent_at) après l'email ;
 *   devis → facture  une facture créée après l'email ;
 *   Essentiel        un abonnement créé après l'email ;
 *   entreprise       un SIREN enregistré aujourd'hui (la date d'enregistrement
 *                    n'est pas gardée : approximation, dite sur l'écran).
 * Les autres modèles (bienvenue, rappel, email libre, inactivité) n'ont pas
 * d'étape mesurée.
 */
import type { SupabaseClient } from "@supabase/supabase-js"
import { isMissingSchemaError } from "@/lib/supabase/schema-guard"
import { hasSiren } from "@/lib/admin/onboarding-progress"

export type StepTarget = "quote_created" | "quote_sent" | "invoice_created" | "subscribed" | "company"

export const TEMPLATE_TARGETS: Record<string, StepTarget> = {
  first_quote: "quote_created",
  nudge_7d: "quote_created",
  manual_first_quote: "quote_created",
  reprise_quote_send_1: "quote_sent",
  reprise_quote_send_2: "quote_sent",
  manual_quote_send: "quote_sent",
  quote_to_invoice: "invoice_created",
  essentiel: "subscribed",
  reprise_company_1: "company",
  reprise_company_2: "company",
  reprise_company_3: "company",
  manual_company: "company",
}

export const STEP_WINDOW_DAYS = 7

export interface StatEmail {
  user_id: string
  template: string
  category: string
  status: string
  sent_at: string
  first_clicked_at: string | null
}

/** Dates des gestes de chaque compte (ISO), et SIREN présent. */
export interface AccountEvents {
  quoteCreated: string[]
  quoteSent: string[]
  invoiceCreated: string[]
  subscribed: string[]
  hasSiren: boolean
}

export interface TemplateStats {
  template: string
  category: string
  sent: number
  bounced: number
  clicked: number
  /** null : pas d'étape mesurée pour ce modèle. */
  reached: number | null
}

const DAY = 86_400_000

function reachedAfter(dates: string[], sentAt: string): boolean {
  const from = new Date(sentAt).getTime()
  return dates.some((d) => {
    const t = new Date(d).getTime()
    return t >= from && t <= from + STEP_WINDOW_DAYS * DAY
  })
}

export function stepReached(target: StepTarget, ev: AccountEvents | undefined, sentAt: string): boolean {
  if (!ev) return false
  switch (target) {
    case "quote_created": return reachedAfter(ev.quoteCreated, sentAt)
    case "quote_sent": return reachedAfter(ev.quoteSent, sentAt)
    case "invoice_created": return reachedAfter(ev.invoiceCreated, sentAt)
    case "subscribed": return reachedAfter(ev.subscribed, sentAt)
    case "company": return ev.hasSiren
  }
}

/** Regroupe les emails par modèle (les emails non partis ne comptent pas). */
export function computeEmailStats(emails: StatEmail[], events: Map<string, AccountEvents>): TemplateStats[] {
  const by = new Map<string, TemplateStats>()
  for (const e of emails) {
    if (e.status === "failed" || e.status === "sending") continue
    let s = by.get(e.template)
    if (!s) {
      s = { template: e.template, category: e.category, sent: 0, bounced: 0, clicked: 0, reached: TEMPLATE_TARGETS[e.template] ? 0 : null }
      by.set(e.template, s)
    }
    s.sent++
    if (e.status === "bounced" || e.status === "complained") s.bounced++
    if (e.first_clicked_at) s.clicked++
    const target = TEMPLATE_TARGETS[e.template]
    if (target && s.reached !== null && stepReached(target, events.get(e.user_id), e.sent_at)) s.reached++
  }
  return Array.from(by.values()).sort((a, b) => b.sent - a.sent)
}

export type EmailStatsResult =
  | { kind: "ok"; stats: TemplateStats[]; total: number }
  | { kind: "unavailable" }
  | { kind: "error" }

/** Mesures des `days` derniers jours. */
export async function loadEmailStats(admin: SupabaseClient, days: number, now = new Date()): Promise<EmailStatsResult> {
  const since = new Date(now.getTime() - days * DAY).toISOString()
  const emails: StatEmail[] = []
  for (let from = 0; ; from += 1000) {
    const { data, error } = await admin
      .from("account_emails")
      .select("user_id,template,category,status,sent_at,first_clicked_at")
      .gte("sent_at", since)
      .order("sent_at")
      .range(from, from + 999)
    if (error) return isMissingSchemaError(error) ? { kind: "unavailable" } : { kind: "error" }
    emails.push(...((data ?? []) as StatEmail[]))
    if (!data || data.length < 1000) break
  }

  const ids = Array.from(new Set(emails.map((e) => e.user_id)))
  const events = new Map<string, AccountEvents>()
  for (const id of ids) events.set(id, { quoteCreated: [], quoteSent: [], invoiceCreated: [], subscribed: [], hasSiren: false })

  for (let i = 0; i < ids.length; i += 200) {
    const chunk = ids.slice(i, i + 200)
    const [quotes, invoices, subs, companies] = await Promise.all([
      admin.from("quotes").select("user_id,created_at,sent_at").in("user_id", chunk).gte("created_at", since).limit(5000),
      admin.from("invoices").select("user_id,created_at").in("user_id", chunk).gte("created_at", since).limit(5000),
      admin.from("subscriptions").select("user_id,created_at").in("user_id", chunk),
      admin.from("companies").select("user_id,siren").in("user_id", chunk),
    ])
    const error = quotes.error ?? invoices.error ?? subs.error ?? companies.error
    if (error) return { kind: "error" }
    for (const q of (quotes.data ?? []) as { user_id: string; created_at: string; sent_at: string | null }[]) {
      const ev = events.get(q.user_id)
      if (!ev) continue
      ev.quoteCreated.push(q.created_at)
      if (q.sent_at) ev.quoteSent.push(q.sent_at)
    }
    for (const inv of (invoices.data ?? []) as { user_id: string; created_at: string }[]) events.get(inv.user_id)?.invoiceCreated.push(inv.created_at)
    for (const s of (subs.data ?? []) as { user_id: string; created_at: string | null }[]) if (s.created_at) events.get(s.user_id)?.subscribed.push(s.created_at)
    for (const c of (companies.data ?? []) as { user_id: string; siren: string | null }[]) {
      const ev = events.get(c.user_id)
      if (ev) ev.hasSiren = hasSiren(c.siren)
    }
  }
  return { kind: "ok", stats: computeEmailStats(emails, events), total: emails.length }
}
