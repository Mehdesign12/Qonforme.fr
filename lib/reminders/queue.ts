/**
 * File des relances (page /relances) : ce que le cron enverra dans les jours
 * qui viennent, ce qu'il a déjà envoyé, et ce qu'il ne peut pas faire.
 *
 * Aucune règle propre : la file rejoue jour par jour le planificateur du cron
 * (lib/reminders/schedule.ts, planInvoiceReminder et planQuoteFollowup) avec
 * les mêmes réglages et le même journal, en ajoutant au journal chaque relance
 * prévue. Ce qui s'affiche est donc ce qui partira, à la date près (le cron
 * passe une fois par jour), tant que rien ne change d'ici là (facture payée,
 * réglage modifié).
 *
 * Fonctions pures : page réelle et démo, testées dans __tests__/reminders-queue.test.ts.
 */
import { addDays, daysBetween, parisDayOf } from "@/lib/utils/paris-date"
import { canRemindInvoice } from "@/lib/utils/document-status"
import type { ReminderSettings } from "@/lib/reminders/settings"
import {
  invoiceStageOffset, invoiceStages, planInvoiceReminder, planQuoteFollowup, type ReminderLogEntry,
} from "@/lib/reminders/schedule"

/** Fenêtre de la file, en jours (aujourd'hui compris). */
export const QUEUE_DAYS = 14
/** Historique affiché, en jours. */
export const HISTORY_DAYS = 30

export interface QueueInvoice {
  id: string
  invoice_number: string | null
  status: string
  issue_date: string | null
  due_date: string | null
  sent_at?: string | null
  total_ttc: number
  client_name: string | null
  client_email: string | null
  reminders: ReminderLogEntry[]
}

export interface QueueQuote {
  id: string
  quote_number: string
  status: string
  issue_date: string | null
  valid_until: string | null
  sent_at?: string | null
  converted_invoice_id?: string | null
  total_ttc: number
  client_name: string | null
  client_email: string | null
  reminders: ReminderLogEntry[]
}

export type QueueDocType = "invoice" | "quote"

export interface QueueEntry {
  /** Jour d'envoi prévu (AAAA-MM-JJ, heure de Paris). */
  date: string
  type: QueueDocType
  id: string
  number: string
  client: string
  amount: number
  stage: string
  label: string
  /** Pas d'adresse email sur la fiche client : le cron ne pourra pas l'envoyer. */
  noEmail: boolean
  /** Dernière relance automatique prévue pour ce document. */
  isLast: boolean
}

export interface SentEntry {
  at: string
  type: QueueDocType
  id: string
  number: string
  client: string
  label: string
  origin: "auto" | "manual" | "legacy"
}

export interface ExhaustedEntry {
  id: string
  number: string
  client: string
  amount: number
  daysLate: number
  count: number
  lastAt: string | null
}

export interface ReminderQueue {
  upcoming: QueueEntry[]
  sent: SentEntry[]
  /** Factures en retard dont toutes les relances automatiques sont parties : à traiter à la main. */
  exhausted: ExhaustedEntry[]
  /** Factures et devis concernés mais sans adresse email (la relance ne partira pas). */
  noEmail: number
}

/** « Rappel J−3 », « Relance J+7 », « Relance du devis », « Relance manuelle ». */
export function stageLabel(stage: string, origin?: string): string {
  if (origin === "manual" || stage === "manual") return "Relance manuelle"
  const offset = invoiceStageOffset(stage)
  if (offset !== null) return offset < 0 ? `Rappel J−${-offset}` : `Relance J+${offset}`
  const q = /^quote_(\d+)$/.exec(stage)
  if (q) return q[1] === "1" ? "Relance du devis" : `Relance du devis n° ${q[1]}`
  return "Relance"
}

/** Moment fictif d'un envoi simulé (le cron passe le matin). */
const simulatedAt = (day: string) => `${day}T07:00:00.000Z`

function simulate<T>(
  days: number,
  today: string,
  log: ReminderLogEntry[],
  plan: (day: string, log: ReminderLogEntry[]) => (T & { stage: string }) | null,
): { day: string; plan: T & { stage: string } }[] {
  const out: { day: string; plan: T & { stage: string } }[] = []
  const simulated = [...log]
  for (let i = 0; i < days; i++) {
    const day = addDays(today, i)
    const p = plan(day, simulated)
    if (!p) continue
    out.push({ day, plan: p })
    simulated.push({ stage: p.stage, origin: "auto", sent_at: simulatedAt(day) })
  }
  return out
}

export function buildReminderQueue(params: {
  invoices: QueueInvoice[]
  quotes: QueueQuote[]
  settings: ReminderSettings
  today: string
  days?: number
}): ReminderQueue {
  const { invoices, quotes, settings, today } = params
  const days = params.days ?? QUEUE_DAYS
  const upcoming: QueueEntry[] = []
  const sent: SentEntry[] = []
  const exhausted: ExhaustedEntry[] = []
  const missingEmail = new Set<string>()
  const historyFrom = addDays(today, -HISTORY_DAYS)
  const stages = invoiceStages(settings)
  const lastStage = stages.length ? stages[stages.length - 1] : null

  for (const inv of invoices) {
    const number = inv.invoice_number ?? ""
    const client = inv.client_name || "Client"
    const noEmail = !inv.client_email?.trim()

    for (const e of inv.reminders) {
      if (parisDayOf(e.sent_at) < historyFrom) continue
      sent.push({ at: e.sent_at, type: "invoice", id: inv.id, number, client, label: stageLabel(e.stage, e.origin), origin: originOf(e.origin) })
    }
    if (!canRemindInvoice(inv.status) || !inv.invoice_number) continue

    const planned = simulate(days, today, inv.reminders, (day, log) => planInvoiceReminder({ invoice: inv, settings, today: day, log }))
    for (const { day, plan } of planned) {
      upcoming.push({
        date: day, type: "invoice", id: inv.id, number, client, amount: Number(inv.total_ttc) || 0,
        stage: plan.stage, label: stageLabel(plan.stage), noEmail, isLast: plan.isLast,
      })
      if (noEmail) missingEmail.add(`i:${inv.id}`)
    }

    // Toutes les relances automatiques sont parties (la dernière étape ou une plus tardive), et la facture reste due
    const late = inv.due_date ? daysBetween(inv.due_date.slice(0, 10), today) : 0
    const autoSent = inv.reminders.filter((e) => e.origin !== "manual")
    const doneLast = lastStage !== null && autoSent.some((e) => (invoiceStageOffset(e.stage) ?? -Infinity) >= lastStage)
    if (late > 0 && doneLast && planned.length === 0) {
      const lastAt = inv.reminders.reduce<string | null>((m, e) => (!m || e.sent_at > m ? e.sent_at : m), null)
      exhausted.push({ id: inv.id, number, client, amount: Number(inv.total_ttc) || 0, daysLate: late, count: inv.reminders.length, lastAt })
    }
  }

  for (const q of quotes) {
    const client = q.client_name || "Client"
    const noEmail = !q.client_email?.trim()
    for (const e of q.reminders) {
      if (parisDayOf(e.sent_at) < historyFrom) continue
      sent.push({ at: e.sent_at, type: "quote", id: q.id, number: q.quote_number, client, label: stageLabel(e.stage, e.origin), origin: originOf(e.origin) })
    }
    const planned = simulate(days, today, q.reminders, (day, log) => planQuoteFollowup({ quote: q, settings, today: day, log }))
    planned.forEach(({ day, plan }, i) => {
      upcoming.push({
        date: day, type: "quote", id: q.id, number: q.quote_number, client, amount: Number(q.total_ttc) || 0,
        stage: plan.stage, label: stageLabel(plan.stage), noEmail,
        isLast: plan.followupNumber >= settings.quoteFollowupMax || i === planned.length - 1,
      })
      if (noEmail) missingEmail.add(`q:${q.id}`)
    })
  }

  upcoming.sort((a, b) => a.date.localeCompare(b.date) || a.type.localeCompare(b.type) || a.number.localeCompare(b.number))
  sent.sort((a, b) => b.at.localeCompare(a.at))
  exhausted.sort((a, b) => b.daysLate - a.daysLate)
  return { upcoming, sent, exhausted, noEmail: missingEmail.size }
}

function originOf(origin: string): SentEntry["origin"] {
  return origin === "manual" ? "manual" : origin === "legacy" ? "legacy" : "auto"
}

/**
 * Journal reconstitué pour l'ancien fonctionnement (table `document_reminders`
 * absente) : les colonnes reminder_1_sent_at et reminder_2_sent_at valent
 * J+30 et J+45, comme pour le cron (lib/reminders/schedule.ts).
 */
export function legacyLog(inv: { reminder_1_sent_at?: string | null; reminder_2_sent_at?: string | null }): ReminderLogEntry[] {
  const out: ReminderLogEntry[] = []
  if (inv.reminder_1_sent_at) out.push({ stage: "after_30", origin: "legacy", sent_at: inv.reminder_1_sent_at })
  if (inv.reminder_2_sent_at) out.push({ stage: "after_45", origin: "legacy", sent_at: inv.reminder_2_sent_at })
  return out
}
