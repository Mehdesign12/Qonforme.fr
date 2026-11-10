/**
 * Emails de reprise automatiques : un compte arrêté à une étape reçoit au plus
 * trois emails pour cette étape, et rien dès qu'il l'a franchie.
 *
 *   Bloqué : Entreprise   (pas de SIREN)   J+1, J+3, J+7 depuis l'inscription ;
 *   Devis jamais envoyé   (brouillon, aucun devis parti)  2 et 5 jours après le brouillon ;
 *   Inactif 14 jours      (a commencé, ne revient plus)   une fois.
 *
 * « Bloqué : Devis créé » et « devis envoyé, pas de facture » sont déjà couverts
 * par la séquence de démarrage (lib/onboarding/sequence.ts).
 *
 * Mêmes garde-fous que la séquence (le cron les applique aux deux) : comptes
 * inscrits dans la séquence seulement, 30 jours, au plus un email par 20 heures,
 * du lundi au samedi de 9 h à 19 h, rien après une désinscription. Un email
 * ne part qu'une fois (index unique du journal).
 *
 * Fonction pure.
 */
import { daysBetween, parisDayOf } from "@/lib/utils/paris-date"
import { parisParts } from "@/lib/onboarding/paris-time"
import { isSequenceSendingTime, sequenceDay, SEQUENCE_MIN_GAP_HOURS, SEQUENCE_WINDOW_DAYS } from "@/lib/onboarding/sequence"
import type { RepriseTemplate } from "@/lib/email/templates/reprise"

export const INACTIVE_DAYS = 14
export const COMPANY_DAYS = [1, 3, 7] as const
export const QUOTE_SEND_DAYS = [2, 5] as const

export interface RepriseInput {
  now: Date
  enrolledAt: string
  optedOut: boolean
  hasSiren: boolean
  /** Brouillon de devis le plus ancien (ISO), si aucun devis n'est parti. */
  oldestDraftQuoteAt: string | null
  quotesSent: number
  /** Le compte a au moins un document (devis ou facture). */
  hasDocuments: boolean
  /** Dernière connexion (ISO) ; null : inconnue (l'inactivité n'est alors pas décidée). */
  lastSignInAt: string | null
  /** Modèles de reprise déjà envoyés à ce compte. */
  sent: ReadonlySet<string>
  /** Dernier email reçu, tous types confondus (ISO). */
  lastEmailAt: string | null
}

const hoursSince = (iso: string, now: Date) => (now.getTime() - new Date(iso).getTime()) / 3_600_000

/** Prochain email de reprise à envoyer maintenant, ou null. */
export function planReprise(input: RepriseInput): RepriseTemplate | null {
  const { now, sent } = input
  if (input.optedOut || !isSequenceSendingTime(now)) return null
  const day = sequenceDay(input.enrolledAt, now)
  if (day < 1 || day > SEQUENCE_WINDOW_DAYS) return null
  const last = input.lastEmailAt && new Date(input.lastEmailAt) > new Date(input.enrolledAt) ? input.lastEmailAt : input.enrolledAt
  if (hoursSince(last, now) < SEQUENCE_MIN_GAP_HOURS) return null

  if (!input.hasSiren) {
    const steps: RepriseTemplate[] = ["reprise_company_1", "reprise_company_2", "reprise_company_3"]
    for (let i = 0; i < steps.length; i++) {
      if (sent.has(steps[i])) continue
      // Dans l'ordre : le suivant attend que le précédent soit parti
      if (i > 0 && !sent.has(steps[i - 1])) return null
      return day >= COMPANY_DAYS[i] ? steps[i] : null
    }
    return null
  }

  if (input.oldestDraftQuoteAt && input.quotesSent === 0) {
    const age = daysBetween(parisDayOf(input.oldestDraftQuoteAt), parisParts(now).day)
    if (!sent.has("reprise_quote_send_1")) {
      if (age >= QUOTE_SEND_DAYS[0]) return "reprise_quote_send_1"
    } else if (!sent.has("reprise_quote_send_2") && age >= QUOTE_SEND_DAYS[1]) {
      return "reprise_quote_send_2"
    }
  }

  if (
    !sent.has("reprise_inactive_14") &&
    input.hasDocuments &&
    input.lastSignInAt &&
    hoursSince(input.lastSignInAt, now) >= INACTIVE_DAYS * 24
  ) {
    return "reprise_inactive_14"
  }
  return null
}
