/**
 * File des relances de paiement, telle que le cron /api/cron/send-reminders
 * la traitera : relance 1 à J+30 après l'échéance, relance 2 à J+45 (une fois
 * la relance 1 partie). Seules les factures « sent » ou « overdue » sont
 * relancées — mêmes critères que le cron, pour que la page ne promette rien
 * qu'il ne fera pas.
 *
 * Logique pure, partagée par la page réelle et la démo, testée dans
 * __tests__/reminders-queue.test.ts. Dates locales « AAAA-MM-JJ ».
 */
import { addDays, amountDue, daysBetween } from "@/lib/treasury/forecast"

/** Statuts que le cron relance */
export const REMINDABLE_STATUSES = ["sent", "overdue"] as const
export const REMINDER_DELAYS = { 1: 30, 2: 45 } as const

export interface ReminderInvoice {
  id:                 string
  invoice_number:     string
  client_name:        string | null
  client_email:       string | null
  due_date:           string
  total_ttc:          number
  credited_ttc?:      number
  status:             string
  reminder_1_sent_at: string | null
  reminder_2_sent_at: string | null
}

export interface QueueItem {
  id:       string
  number:   string
  client:   string
  amount:   number
  due_date: string
  step:     1 | 2
  /** Date à laquelle le cron l'enverra (le jour même ou le prochain passage si elle est dépassée) */
  date:     string
  /** La date est atteinte : part au prochain passage du cron */
  ready:    boolean
  /** Pas d'adresse email : le cron l'ignorera */
  noEmail:  boolean
  daysLate: number
}

export type ExhaustedItem = Omit<QueueItem, "step" | "date" | "ready">

export interface SentItem {
  id:     string
  number: string
  client: string
  amount: number
  step:   1 | 2
  /** AAAA-MM-JJ */
  date:   string
  paid:   boolean
}

export interface ReminderQueue {
  upcoming:  QueueItem[]
  sent:      SentItem[]
  /** Deux relances envoyées, facture toujours impayée : à traiter à la main */
  exhausted: ExhaustedItem[]
  stats: {
    lateAmount:  number
    lateCount:   number
    next10Count: number
    sent30Count: number
  }
}

const day = (ts: string) => ts.slice(0, 10)

export function buildReminderQueue(invoices: ReminderInvoice[], today: string): ReminderQueue {
  const remindable = REMINDABLE_STATUSES as readonly string[]
  const upcoming: QueueItem[] = []
  const exhausted: ExhaustedItem[] = []
  const sent: SentItem[] = []
  let lateAmount = 0
  let lateCount = 0

  for (const inv of invoices) {
    const amount = amountDue(inv)
    const base = {
      id:       inv.id,
      number:   inv.invoice_number,
      client:   inv.client_name || "Client",
      amount,
    }
    const unpaid = remindable.includes(inv.status) && amount > 0

    // historique : toutes les relances déjà parties, même si la facture est réglée depuis
    if (inv.reminder_1_sent_at) sent.push({ ...base, step: 1, date: day(inv.reminder_1_sent_at), paid: !unpaid })
    if (inv.reminder_2_sent_at) sent.push({ ...base, step: 2, date: day(inv.reminder_2_sent_at), paid: !unpaid })

    if (!unpaid || !inv.due_date) continue
    const due = inv.due_date.slice(0, 10)
    const late = due < today
    const daysLate = late ? daysBetween(due, today) : 0
    if (late) {
      lateAmount += amount
      lateCount++
    }
    const common = { ...base, due_date: due, noEmail: !inv.client_email, daysLate }

    if (inv.reminder_2_sent_at) {
      exhausted.push(common)
      continue
    }
    const step: 1 | 2 = inv.reminder_1_sent_at ? 2 : 1
    const planned = addDays(due, REMINDER_DELAYS[step])
    const ready = planned <= today
    upcoming.push({ ...common, step, date: ready ? today : planned, ready })
  }

  upcoming.sort((a, b) => a.date.localeCompare(b.date) || b.amount - a.amount)
  sent.sort((a, b) => b.date.localeCompare(a.date) || a.number.localeCompare(b.number))
  exhausted.sort((a, b) => b.daysLate - a.daysLate)

  const in10 = addDays(today, 10)
  const from30 = addDays(today, -30)
  return {
    upcoming,
    sent,
    exhausted,
    stats: {
      lateAmount:  Math.round(lateAmount * 100) / 100,
      lateCount,
      next10Count: upcoming.filter((u) => u.date <= in10 && !u.noEmail).length,
      sent30Count: sent.filter((s) => s.date >= from30).length,
    },
  }
}
