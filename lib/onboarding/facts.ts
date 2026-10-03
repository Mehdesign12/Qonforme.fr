/**
 * Faits par compte pour la séquence de démarrage (lib/onboarding/sequence.ts),
 * lus par lots par le cron app/api/cron/onboarding.
 *
 * Une lecture en échec n'est jamais prise pour « aucun document » : le lot est
 * signalé en erreur et ses comptes sont sautés à ce passage (sinon un compte
 * qui a des devis recevrait « faites votre premier devis » après une coupure
 * réseau).
 */
import type { SupabaseClient } from "@supabase/supabase-js"
import { canIssueInvoices } from "@/lib/stripe/access"
import type { AccountFacts, SentStep, SequenceStep } from "@/lib/onboarding/types"
import { SEQUENCE_STEPS } from "@/lib/onboarding/types"

type DbError = { message: string }

export interface AccountState {
  facts: AccountFacts
  sent: SentStep[]
  optedOut: boolean
  reminderPending: boolean
  lastReminderSentAt: string | null
}

const emptyFacts = (): AccountFacts => ({
  quotes: 0, firstQuoteSentAt: null, acceptedQuotes: 0,
  invoices: 0, issuedInvoices: 0, draftInvoices: 0, hasPlan: false,
})

/** PostgREST plafonne une réponse à 1 000 lignes : on lit toutes les pages. */
async function selectAll<T>(
  page: (from: number, to: number) => PromiseLike<{ data: unknown[] | null; error: DbError | null }>,
): Promise<{ rows: T[]; error: DbError | null }> {
  const size = 1000
  const rows: T[] = []
  for (let from = 0; ; from += size) {
    const { data, error } = await page(from, from + size - 1)
    if (error) return { rows, error }
    rows.push(...((data ?? []) as T[]))
    if (!data || data.length < size) return { rows, error: null }
  }
}

/** État de chaque compte du lot (150 au plus), ou l'erreur qui empêche de conclure. */
export async function loadAccountStates(
  admin: SupabaseClient,
  userIds: string[],
): Promise<{ states: Map<string, AccountState>; error: DbError | null }> {
  const states = new Map<string, AccountState>()
  for (const id of userIds) {
    states.set(id, { facts: emptyFacts(), sent: [], optedOut: false, reminderPending: false, lastReminderSentAt: null })
  }
  if (userIds.length === 0) return { states, error: null }

  const [quotes, invoices, subs, prefs, log, reminders] = await Promise.all([
    selectAll<{ user_id: string; status: string; sent_at: string | null }>((f, t) =>
      admin.from("quotes").select("user_id,status,sent_at").in("user_id", userIds).order("id").range(f, t)),
    selectAll<{ user_id: string; status: string }>((f, t) =>
      admin.from("invoices").select("user_id,status").in("user_id", userIds).order("id").range(f, t)),
    selectAll<{ user_id: string; status: string }>((f, t) =>
      admin.from("subscriptions").select("user_id,status").in("user_id", userIds).range(f, t)),
    selectAll<{ user_id: string; onboarding_emails: boolean }>((f, t) =>
      admin.from("email_preferences").select("user_id,onboarding_emails").in("user_id", userIds).range(f, t)),
    selectAll<{ user_id: string; step: string; sent_at: string }>((f, t) =>
      admin.from("onboarding_emails").select("user_id,step,sent_at").in("user_id", userIds).range(f, t)),
    selectAll<{ user_id: string; status: string; sent_at: string | null }>((f, t) =>
      admin.from("onboarding_reminders").select("user_id,status,sent_at").in("user_id", userIds).in("status", ["pending", "sending", "sent"]).range(f, t)),
  ])

  const error = quotes.error ?? invoices.error ?? subs.error ?? prefs.error ?? log.error ?? reminders.error
  if (error) return { states, error }

  for (const q of quotes.rows) {
    const s = states.get(q.user_id)
    if (!s) continue
    s.facts.quotes++
    if (q.status === "accepted") s.facts.acceptedQuotes++
    if (q.sent_at && (!s.facts.firstQuoteSentAt || q.sent_at < s.facts.firstQuoteSentAt)) s.facts.firstQuoteSentAt = q.sent_at
  }
  for (const i of invoices.rows) {
    const s = states.get(i.user_id)
    if (!s) continue
    s.facts.invoices++
    if (i.status === "draft") s.facts.draftInvoices++
    else s.facts.issuedInvoices++
  }
  for (const sub of subs.rows) {
    const s = states.get(sub.user_id)
    if (s) s.facts.hasPlan = s.facts.hasPlan || canIssueInvoices(sub.status)
  }
  for (const pref of prefs.rows) {
    const s = states.get(pref.user_id)
    if (s) s.optedOut = pref.onboarding_emails === false
  }
  for (const entry of log.rows) {
    const s = states.get(entry.user_id)
    if (s && (SEQUENCE_STEPS as readonly string[]).includes(entry.step)) {
      s.sent.push({ step: entry.step as SequenceStep, sent_at: entry.sent_at })
    }
  }
  for (const r of reminders.rows) {
    const s = states.get(r.user_id)
    if (!s) continue
    if (r.status === "pending" || r.status === "sending") s.reminderPending = true
    if (r.status === "sent" && r.sent_at && (!s.lastReminderSentAt || r.sent_at > s.lastReminderSentAt)) s.lastReminderSentAt = r.sent_at
  }
  return { states, error: null }
}
