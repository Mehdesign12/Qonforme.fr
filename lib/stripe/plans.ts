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
    description: 'Pour les artisans et indépendants',
    monthlyPrice: 9,
    yearlyPrice: 90,
    yearlyMonthlyEquivalent: 7.5,
    invoiceLimit: 10,
    features: [
      '10 factures/mois · devis & bons de commande illimités',
      'Avoirs en 1 clic depuis une facture',
      'Factur-X EN 16931 certifié — généré automatiquement',
      'Guide de transmission Chorus Pro inclus',
      'Envoi par email avec PDF en pièce jointe',
      'Recherche client par SIREN (préremplissage auto)',
      'Catalogue produits réutilisables',
      'Conversion devis → facture en 1 clic',
      'Archivage légal 10 ans inclus',
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
    description: 'Pour ceux qui veulent aller plus loin',
    monthlyPrice: 19,
    yearlyPrice: 190,
    yearlyMonthlyEquivalent: 15.83,
    invoiceLimit: null,
    features: [
      'Factures illimitées · devis & bons de commande illimités',
      'Avoirs en 1 clic depuis une facture',
      'Factur-X EN 16931 certifié — généré automatiquement',
      'Guide de transmission multiplateforme (Chorus Pro, IOPOLE, 137 PA)',
      'Envoi par email avec PDF en pièce jointe',
      'Recherche client par SIREN (préremplissage auto)',
      'Catalogue produits réutilisables',
      'Conversion devis → facture en 1 clic',
      'Archivage légal 10 ans inclus',
      'Tableau de bord CA : chiffre du mois, encours, retards',
      'Relances automatiques J+30/J+45',
      'Support email 24h prioritaire',
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
