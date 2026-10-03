/**
 * Séquence de 5 emails de démarrage, déclenchés par les actions
 * (DECISIONS-STRATEGIQUES.md § 10, « Séquence de 5 emails ») :
 *
 *   welcome           J0, à l'inscription (app/api/auth/signup) ;
 *   first_quote       de J+1 à J+6, si aucun devis n'a été créé ;
 *   nudge_7d          à partir de J+7, si toujours aucun devis (dernier email
 *                     de ce type, avec l'accès direct au tableau de bord, § 8) ;
 *   quote_to_invoice  le lendemain du premier devis envoyé, tant qu'aucune
 *                     facture n'existe : « transformez-le en facture » ;
 *   essentiel         quand une facture attend en brouillon ou qu'un devis est
 *                     accepté, sans formule ni facture émise : ce que change
 *                     Essentiel, sans urgence inventée.
 *
 * Chaque email s'arrête dès que l'action visée est faite : les conditions sont
 * relues à chaque passage du cron, juste avant l'envoi.
 *
 * Garde-fous :
 * - seuls les comptes inscrits dans la séquence (table onboarding_journeys,
 *   ligne créée à l'inscription) sont concernés : les comptes existants n'y sont
 *   jamais ;
 * - fenêtre de 30 jours après l'inscription, puis plus rien ;
 * - une étape ne part qu'une fois (journal à contrainte d'unicité) ;
 * - au plus un email toutes les 20 heures (bienvenue et rappel compris) ;
 * - du lundi au samedi, entre 9 h et 19 h, heure de Paris ;
 * - rien pour un compte désinscrit ;
 * - pas d'email « premier devis » pendant qu'un rappel « plus tard » attend :
 *   l'artisan a déjà choisi son moment.
 *
 * Fonction pure : le cron (app/api/cron/onboarding) fournit les faits.
 */
import { daysBetween, parisDayOf } from "@/lib/utils/paris-date"
import { parisParts } from "@/lib/onboarding/paris-time"
import type { AccountFacts, SentStep, SequenceStep } from "@/lib/onboarding/types"

export const SEQUENCE_WINDOW_DAYS = 30
export const SEQUENCE_MIN_GAP_HOURS = 20
export const SEQUENCE_SEND_HOURS = { from: 9, to: 19 } as const
/** Dernier jour de « faites votre premier devis » ; ensuite, la relance de J+7. */
export const FIRST_QUOTE_LAST_DAY = 6
export const NUDGE_DAY = 7

/** Vrai du lundi au samedi, de 9 h à 19 h (heure de Paris). */
export function isSequenceSendingTime(now: Date): boolean {
  const p = parisParts(now)
  return p.weekday !== 0 && p.hour >= SEQUENCE_SEND_HOURS.from && p.hour < SEQUENCE_SEND_HOURS.to
}

export interface SequenceInput {
  now: Date
  /** Inscription dans la séquence (ISO). */
  enrolledAt: string
  facts: AccountFacts
  sent: SentStep[]
  optedOut: boolean
  /** Un rappel « plus tard » attend son heure. */
  reminderPending: boolean
  /** Dernier rappel « plus tard » envoyé (ISO), pour l'écart entre deux emails. */
  lastReminderSentAt: string | null
}

const hoursSince = (iso: string, now: Date) => (now.getTime() - new Date(iso).getTime()) / 3_600_000

/** Jours calendaires (Paris) depuis l'inscription. */
export function sequenceDay(enrolledAt: string, now: Date): number {
  return daysBetween(parisDayOf(enrolledAt), parisParts(now).day)
}

/** Prochain email à envoyer maintenant, ou null. */
export function planSequenceEmail(input: SequenceInput): SequenceStep | null {
  const { now, facts, sent } = input
  if (input.optedOut) return null
  if (!isSequenceSendingTime(now)) return null

  const day = sequenceDay(input.enrolledAt, now)
  if (day < 1 || day > SEQUENCE_WINDOW_DAYS) return null

  // Écart minimal avec le dernier email (l'inscription compte pour la bienvenue)
  const last = [input.enrolledAt, input.lastReminderSentAt, ...sent.map((s) => s.sent_at)]
    .filter((v): v is string => Boolean(v))
    .reduce((a, b) => (new Date(a) > new Date(b) ? a : b))
  if (hoursSince(last, now) < SEQUENCE_MIN_GAP_HOURS) return null

  const done = new Set(sent.map((s) => s.step))

  // Avant la première facture : ce que change Essentiel
  if (
    !done.has("essentiel") &&
    !facts.hasPlan &&
    facts.issuedInvoices === 0 &&
    (facts.draftInvoices > 0 || facts.acceptedQuotes > 0)
  ) {
    return "essentiel"
  }

  // Premier devis parti : la suite, c'est la facture
  if (
    !done.has("quote_to_invoice") &&
    facts.firstQuoteSentAt &&
    facts.invoices === 0 &&
    daysBetween(parisDayOf(facts.firstQuoteSentAt), parisParts(now).day) >= 1
  ) {
    return "quote_to_invoice"
  }

  // Aucun devis : un rappel pendant la première semaine, une relance à J+7
  if (facts.quotes === 0 && !input.reminderPending) {
    if (day >= NUDGE_DAY) return done.has("nudge_7d") ? null : "nudge_7d"
    if (day <= FIRST_QUOTE_LAST_DAY && !done.has("first_quote")) return "first_quote"
  }

  return null
}
