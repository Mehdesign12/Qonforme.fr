/**
 * Règles d'accès liées à l'abonnement — fonctions pures, sans appel réseau.
 *
 * Modèle « devis gratuits, factures payantes » (DECISIONS-STRATEGIQUES.md § 8 et § 12) :
 *   - sans formule : devis, clients, catalogue, factures préparées en brouillon,
 *     consultation, téléchargement et export de tout ce qui a déjà été émis ;
 *   - avec une formule : émettre des factures (envoi, passage hors brouillon) et relancer.
 *
 * Une résiliation ou un impayé ne coupe jamais l'accès aux documents déjà émis.
 */

export type SubscriptionStatus = 'active' | 'past_due' | 'canceled' | 'incomplete'

/** Code renvoyé (HTTP 402) par toute route qui émet une facture sans formule active. */
export const SUBSCRIPTION_REQUIRED = 'SUBSCRIPTION_REQUIRED'

/**
 * Statut Stripe → statut Qonforme (contrainte CHECK de la table `subscriptions`).
 *
 * `unpaid` arrive quand Stripe a épuisé ses nouvelles tentatives : l'émission
 * s'arrête, comme pour une résiliation.
 */
export function mapStripeStatus(stripeStatus: string): SubscriptionStatus {
  switch (stripeStatus) {
    case 'active':
    case 'trialing':
      return 'active'
    case 'past_due':
      return 'past_due'
    case 'canceled':
    case 'unpaid':
    case 'incomplete_expired':
      return 'canceled'
    default:
      // incomplete, paused
      return 'incomplete'
  }
}

/**
 * Le compte peut-il émettre des factures ?
 *
 * `past_due` reste autorisé : c'est le délai pendant lequel Stripe retente le
 * prélèvement (carte expirée, provision insuffisante). Couper l'émission au
 * premier échec bloquerait un artisan qui ne sait même pas encore qu'il y a un
 * problème. Un bandeau l'invite à régulariser.
 */
export function canIssueInvoices(status: string | null | undefined): boolean {
  return status === 'active' || status === 'past_due'
}

/** Garantie « satisfait ou remboursé », comptée à partir du premier paiement. */
export const GUARANTEE_DAYS = 30

export function guaranteeEndsAt(firstPaidAt: Date): Date {
  return new Date(firstPaidAt.getTime() + GUARANTEE_DAYS * 24 * 60 * 60 * 1000)
}

export function isWithinGuarantee(firstPaidAt: Date | null, now: Date = new Date()): boolean {
  if (!firstPaidAt) return false
  return now.getTime() <= guaranteeEndsAt(firstPaidAt).getTime()
}

/**
 * Chemin de retour après le paiement (ex. la facture à envoyer).
 * Uniquement un chemin interne : une URL absolue ou `//hote` ferait de la page
 * de paiement une redirection ouverte vers n'importe quel site.
 */
export function safeNextPath(raw: unknown): string | null {
  if (typeof raw !== 'string') return null
  if (raw.length === 0 || raw.length > 300) return null
  if (!raw.startsWith('/')) return null
  if (raw.startsWith('//') || raw.startsWith('/\\')) return null
  // Caractères de contrôle (dont retours à la ligne) et antislashs : jamais dans un chemin légitime
  if (/[\u0000-\u001f\u007f\\]/.test(raw)) return null
  return raw
}
