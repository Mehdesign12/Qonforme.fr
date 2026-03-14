/**
 * Définition des plans tarifaires Qonforme
 * Les IDs de prix Stripe sont injectés via variables d'environnement
 */

export type PlanId = 'starter' | 'pro'
export type BillingPeriod = 'monthly' | 'yearly'

export interface Plan {
  id: PlanId
  name: string
  description: string
  monthlyPrice: number   // en euros HT
  yearlyPrice: number    // en euros HT / an
  yearlyMonthlyEquivalent: number // équivalent mensuel si annuel
  invoiceLimit: number | null // null = illimité
  features: string[]
  stripePriceIds: {
    monthly: string
    yearly: string
  }
}

export const PLANS: Record<PlanId, Plan> = {
  starter: {
    id: 'starter',
    name: 'Starter',
    description: 'Pour démarrer et tester',
    monthlyPrice: 9,
    yearlyPrice: 90,
    yearlyMonthlyEquivalent: 7.5,
    invoiceLimit: 10,
    features: [
      '10 factures par mois',
      'Devis illimités',
      'Bons de commande',
      'Avoirs',
      'Factur-X EN 16931 généré automatiquement',
      'Guide de transmission PPF inclus',
      'Archivage légal 10 ans',
      'Support email 48h',
    ],
    stripePriceIds: {
      monthly: process.env.STRIPE_PRICE_STARTER_MONTHLY ?? '',
      yearly: process.env.STRIPE_PRICE_STARTER_YEARLY ?? '',
    },
  },
  pro: {
    id: 'pro',
    name: 'Pro',
    description: 'Pour les pros sans limites',
    monthlyPrice: 19,
    yearlyPrice: 190,
    yearlyMonthlyEquivalent: 15.83,
    invoiceLimit: null,
    features: [
      'Factures illimitées',
      'Devis illimités',
      'Bons de commande',
      'Avoirs',
      'Factur-X EN 16931 généré automatiquement',
      'Guide de transmission + suivi simplifié',
      'Relances automatiques J+30/J+45',
      'Tableau de bord CA complet',
      'Archivage légal 10 ans',
      'Support email 24h',
    ],
    stripePriceIds: {
      monthly: process.env.STRIPE_PRICE_PRO_MONTHLY ?? '',
      yearly: process.env.STRIPE_PRICE_PRO_YEARLY ?? '',
    },
  },
}

/**
 * Retourne le plan correspondant à un price_id Stripe
 */
export function getPlanByPriceId(priceId: string): { plan: PlanId; period: BillingPeriod } | null {
  for (const plan of Object.values(PLANS)) {
    if (plan.stripePriceIds.monthly === priceId) {
      return { plan: plan.id, period: 'monthly' }
    }
    if (plan.stripePriceIds.yearly === priceId) {
      return { plan: plan.id, period: 'yearly' }
    }
  }
  return null
}

/**
 * Retourne la limite de factures pour un plan donné
 * null = illimité
 */
export function getInvoiceLimit(plan: PlanId): number | null {
  return PLANS[plan]?.invoiceLimit ?? null
}
