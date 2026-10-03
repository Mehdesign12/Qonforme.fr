/**
 * Démarrage d'un compte neuf (DECISIONS-STRATEGIQUES.md § 8 et § 10) :
 * écran « Par quoi voulez-vous commencer ? », devis d'essai envoyé à soi-même,
 * rappel « Je le ferai plus tard » et séquence d'emails déclenchés par les actions.
 *
 * Tables : supabase/migrations/20261003_onboarding_emails.sql.
 */

/** Étapes de la séquence. `welcome` part à l'inscription, les autres par le cron. */
export const SEQUENCE_STEPS = ["welcome", "first_quote", "nudge_7d", "quote_to_invoice", "essentiel"] as const
export type SequenceStep = (typeof SEQUENCE_STEPS)[number]

/** Étape visée par le rappel « plus tard » (lien direct de l'email). */
export const REMINDER_TARGET_KEYS = ["quote", "trial", "invoice", "dashboard"] as const
export type ReminderTarget = (typeof REMINDER_TARGET_KEYS)[number]

export function isReminderTarget(value: unknown): value is ReminderTarget {
  return typeof value === "string" && (REMINDER_TARGET_KEYS as readonly string[]).includes(value)
}

/** Créneaux proposés : ce soir 19 h, demain 7 h 30, samedi 9 h, autre moment. */
export const REMINDER_SLOT_KEYS = ["tonight", "tomorrow", "saturday", "custom"] as const
export type ReminderSlotKey = (typeof REMINDER_SLOT_KEYS)[number]

export function isReminderSlotKey(value: unknown): value is ReminderSlotKey {
  return typeof value === "string" && (REMINDER_SLOT_KEYS as readonly string[]).includes(value)
}

/** Rappel en attente, tel que l'écran et les paramètres l'affichent. */
export interface PendingReminder {
  target: ReminderTarget
  /** Horodatage ISO (UTC). */
  remindAt: string
}

/**
 * Ce que le cron sait d'un compte pour choisir l'email suivant. Ne compte que de
 * vrais documents : le devis d'essai n'est jamais enregistré.
 */
export interface AccountFacts {
  /** Devis enregistrés, brouillons compris. */
  quotes: number
  /** Premier envoi d'un devis (ISO), null si aucun devis n'est parti. */
  firstQuoteSentAt: string | null
  acceptedQuotes: number
  /** Factures enregistrées, brouillons compris. */
  invoices: number
  /** Factures sorties du brouillon. */
  issuedInvoices: number
  draftInvoices: number
  /** Formule qui permet d'émettre (lib/stripe/access.ts, canIssueInvoices). */
  hasPlan: boolean
}

export interface SentStep {
  step: SequenceStep
  sent_at: string
}
