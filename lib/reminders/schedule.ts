/**
 * Planning des relances : quelle relance part aujourd'hui pour une facture ou
 * un devis, d'après les réglages du compte et le journal des envois.
 *
 * Fonctions pures (aucun accès réseau ni base) : le cron
 * (app/api/cron/send-reminders) les appelle pour chaque document, puis réserve
 * l'étape dans le journal (`document_reminders`, index unique) avant
 * d'envoyer l'email. Une étape réservée ne repart jamais.
 *
 * Règles, toutes en jours calendaires à l'heure de Paris :
 * - une seule relance par document et par jour, celle de l'étape la plus
 *   avancée déjà atteinte : si le cron n'est pas passé un jour, ou si une
 *   étape vient d'être ajoutée, on ne rattrape pas les étapes intermédiaires ;
 * - une étape n'est jamais envoyée si une étape plus avancée (ou la même) l'a
 *   déjà été (les relances reprises de l'ancien cron comptent pour J+30 et J+45) ;
 * - au moins MIN_GAP_DAYS jours entre deux relances d'un même document,
 *   relances manuelles comprises, et depuis son envoi ;
 * - le rappel avant échéance ne part que si la facture n'est pas encore échue ;
 * - le retard se calcule sur la date d'échéance, que la facture soit marquée
 *   « En retard » ou non.
 */
import { canRemindInvoice } from "@/lib/utils/document-status"
import { addDays, daysBetween, parisDayOf } from "@/lib/utils/paris-date"
import type { ReminderSettings } from "@/lib/reminders/settings"

/** Écart minimal, en jours, entre deux relances d'un même document (et après son envoi). */
export const MIN_GAP_DAYS = 3

/** Ligne du journal des relances (`document_reminders`). */
export interface ReminderLogEntry {
  stage: string
  origin: "auto" | "manual" | "legacy" | string
  sent_at: string
}

/** Étape d'une relance de facture, et son décalage en jours par rapport à l'échéance. */
export function invoiceStageOffset(stage: string): number | null {
  const m = /^(before|after)_(\d{1,3})$/.exec(stage)
  if (!m) return null
  const days = Number(m[2])
  return m[1] === "before" ? -days : days
}

export const invoiceStageName = (offset: number) => (offset < 0 ? `before_${-offset}` : `after_${offset}`)

/** Étapes actives d'après les réglages, de la plus tôt à la plus tardive. */
export function invoiceStages(settings: ReminderSettings): number[] {
  if (!settings.invoiceRemindersEnabled) return []
  const offsets = [
    ...(settings.beforeDueDays ? [-settings.beforeDueDays] : []),
    ...settings.afterDueDays.filter((d) => d > 0),
  ]
  return Array.from(new Set(offsets)).sort((a, b) => a - b)
}

export interface InvoiceForPlanning {
  status: string
  due_date: string | null
  issue_date: string | null
  /** Horodatage de l'envoi par email, s'il y en a eu un. */
  sent_at?: string | null
}

export interface PlannedInvoiceReminder {
  stage: string
  kind: "before_due" | "after_due"
  /** Décalage par rapport à l'échéance (−3, +7…). */
  offset: number
  /** Jours de retard aujourd'hui (0 avant l'échéance). */
  daysLate: number
  /** Jours restants avant l'échéance (rappel avant échéance), sinon 0. */
  daysUntilDue: number
  /** Rang de cette relance pour la facture (1 pour la première), toutes origines comprises. */
  reminderNumber: number
  /** Dernière étape programmée : plus aucune relance automatique après celle-ci. */
  isLast: boolean
}

/** Jour (heure de Paris) de la relance la plus récente du journal, ou null. */
function lastSentDay(log: ReminderLogEntry[]): string | null {
  let last: string | null = null
  for (const entry of log) {
    const day = parisDayOf(entry.sent_at)
    if (!last || day > last) last = day
  }
  return last
}

/** Relance de facture à envoyer aujourd'hui, ou null. */
export function planInvoiceReminder({
  invoice, settings, today, log,
}: {
  invoice: InvoiceForPlanning
  settings: ReminderSettings
  today: string
  log: ReminderLogEntry[]
}): PlannedInvoiceReminder | null {
  if (!canRemindInvoice(invoice.status) || !invoice.due_date) return null
  const stages = invoiceStages(settings)
  if (stages.length === 0) return null

  const due = invoice.due_date.slice(0, 10)
  const emitted = invoice.sent_at ? parisDayOf(invoice.sent_at) : invoice.issue_date?.slice(0, 10) ?? null

  // Étapes atteintes aujourd'hui (le rappel avant échéance seulement tant qu'elle n'est pas passée)
  const reached = stages.filter((offset) => {
    if (addDays(due, offset) > today) return false
    if (offset < 0 && today > due) return false
    return true
  })
  if (reached.length === 0) return null
  const offset = reached[reached.length - 1]

  // Déjà couverte par une étape envoyée (la même ou une plus avancée)
  const sentOffsets = log
    .filter((e) => e.origin !== "manual")
    .map((e) => invoiceStageOffset(e.stage))
    .filter((o): o is number => o !== null)
  if (sentOffsets.some((o) => o >= offset)) return null

  // Écart minimal depuis l'envoi de la facture et depuis la dernière relance
  if (emitted && daysBetween(emitted, today) < MIN_GAP_DAYS) return null
  const last = lastSentDay(log)
  if (last && daysBetween(last, today) < MIN_GAP_DAYS) return null

  const late = daysBetween(due, today)
  return {
    stage: invoiceStageName(offset),
    kind: offset < 0 ? "before_due" : "after_due",
    offset,
    daysLate: Math.max(0, late),
    daysUntilDue: Math.max(0, -late),
    reminderNumber: log.length + 1,
    isLast: offset === stages[stages.length - 1],
  }
}

/* ------------------------------------------------------------------ */
/* Devis envoyés sans réponse                                          */
/* ------------------------------------------------------------------ */

export interface QuoteForPlanning {
  status: string
  valid_until: string | null
  issue_date: string | null
  sent_at?: string | null
  converted_invoice_id?: string | null
}

export interface PlannedQuoteFollowup {
  stage: string
  /** 1 pour la première relance du devis. */
  followupNumber: number
  /** Jours depuis l'envoi du devis. */
  daysSinceSent: number
  /** Jour d'envoi du devis (heure de Paris). */
  sentDay: string
}

/**
 * Relance d'un devis à envoyer aujourd'hui, ou null. Seul un devis envoyé, ni
 * accepté, ni refusé, ni converti, encore valable aujourd'hui, est relancé ;
 * une fois par défaut (deux au plus), N jours après l'envoi puis N jours après
 * la relance précédente.
 */
export function planQuoteFollowup({
  quote, settings, today, log,
}: {
  quote: QuoteForPlanning
  settings: ReminderSettings
  today: string
  log: ReminderLogEntry[]
}): PlannedQuoteFollowup | null {
  if (!settings.quoteFollowupEnabled) return null
  if (quote.status !== "sent" || quote.converted_invoice_id) return null
  if (!quote.valid_until || today > quote.valid_until.slice(0, 10)) return null

  const sentDay = quote.sent_at ? parisDayOf(quote.sent_at) : quote.issue_date?.slice(0, 10)
  if (!sentDay) return null

  const done = log.filter((e) => e.origin !== "manual" && /^quote_\d+$/.test(e.stage))
  if (done.length >= settings.quoteFollowupMax) return null
  const next = done.length + 1

  const step = settings.quoteFollowupDays
  const last = lastSentDay(log)
  const firstDay = addDays(sentDay, step)
  const dueDay = last && addDays(last, step) > firstDay ? addDays(last, step) : firstDay
  if (today < dueDay) return null
  if (last && daysBetween(last, today) < MIN_GAP_DAYS) return null

  return { stage: `quote_${next}`, followupNumber: next, daysSinceSent: daysBetween(sentDay, today), sentDay }
}
