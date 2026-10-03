/**
 * Formules tarifaires Qonforme — grille validée le 02/10/2026
 * (DECISIONS-STRATEGIQUES.md § 12).
 *
 * Les identifiants internes restent 'starter' et 'pro' : la table
 * `subscriptions` les impose par une contrainte CHECK.
 *   'starter' = Essentiel
 *   'pro'     = Artisan
 * Ne jamais les afficher tels quels : passer par PLANS[id].name.
 *
 * Les prix sont hors taxes. La TVA à 20 % est ajoutée au paiement par le taux
 * Stripe STRIPE_TAX_RATE_ID (app/api/stripe/checkout/route.ts).
 *
 * `features` ne liste que ce qui existe aujourd'hui dans l'application ;
 * `upcoming` ce qui est annoncé mais pas encore livré, toujours affiché comme
 * « à venir ». Aucune promesse invérifiable (CLAUDE.md).
 *
 * Formule Artisan : ses fonctions sont livrées (situations, acomptes, retenue
 * de garantie, autoliquidation, chantiers — lib/artisan). Elle se vend dès que
 * ses deux prix Stripe sont configurés (STRIPE_PRICE_ARTISAN_MONTHLY et
 * STRIPE_PRICE_ARTISAN_YEARLY). Ces variables ne sont lues que côté serveur :
 * next.config.mjs en déduit au build NEXT_PUBLIC_ARTISAN_ON_SALE, la même
 * valeur pour le serveur et le navigateur (pas d'écart d'hydratation). Changer
 * les prix dans Vercel demande donc un redéploiement, comme toute variable.
 */

/** Vrai si les deux prix de la formule Artisan sont renseignés (même règle que next.config.mjs). */
export function isArtisanOnSale(monthly: string | undefined | null, yearly: string | undefined | null): boolean {
  return Boolean(monthly?.trim()) && Boolean(yearly?.trim())
}

/** Valeur inlinée au build par next.config.mjs (« true » / « false »). */
const ARTISAN_ON_SALE = process.env.NEXT_PUBLIC_ARTISAN_ON_SALE === 'true'

export type PlanId = 'starter' | 'pro'
export type BillingPeriod = 'monthly' | 'yearly'

/** TVA appliquée par Qonforme sur ses abonnements. */
export const VAT_RATE = 0.2

export interface Plan {
  id: PlanId
  name: string
  tagline: string
  monthlyPrice: number            // € HT par mois
  yearlyPrice: number             // € HT par an
  yearlyMonthlyEquivalent: number // € HT par mois, payé à l'année
  /** false tant que les fonctions propres à la formule ne sont pas livrées : elle ne se vend pas. */
  available: boolean
  features: string[]
  upcoming: string[]
  stripePriceIds: {
    monthly: string
    yearly: string
  }
}

/** Ce que fait un compte sans formule. */
export const FREE_FEATURES = [
  'Devis illimités',
  'Clients et catalogue de prestations',
  'Factures préparées en brouillon',
  'Documents émis toujours consultables',
]

export const PLANS: Record<PlanId, Plan> = {
  starter: {
    id: 'starter',
    name: 'Essentiel',
    tagline: 'Pour facturer sans limite.',
    monthlyPrice: 12,
    yearlyPrice: 120,
    yearlyMonthlyEquivalent: 10,
    available: true,
    features: [
      'Factures et avoirs illimités',
      'Envoi par email avec le PDF',
      'Relances automatiques des impayés',
      'Devis transformé en facture en un clic',
      'Export comptable FEC',
      'Tableau de bord : chiffre du mois, encours, retards',
    ],
    upcoming: [
      'Émission via plateforme agréée',
      'Réception des factures fournisseurs',
      'Signature en ligne des devis et bons de commande',
    ],
    stripePriceIds: {
      monthly: process.env.STRIPE_PRICE_ESSENTIEL_MONTHLY ?? '',
      yearly: process.env.STRIPE_PRICE_ESSENTIEL_YEARLY ?? '',
    },
  },
  pro: {
    id: 'pro',
    name: 'Artisan',
    tagline: 'Pour les pros du bâtiment.',
    monthlyPrice: 24,
    yearlyPrice: 240,
    yearlyMonthlyEquivalent: 20,
    available: ARTISAN_ON_SALE,
    features: [
      'Situations de travaux et factures d’acompte',
      'Retenue de garantie suivie',
      'Autoliquidation en sous-traitance',
      'Suivi par chantier',
    ],
    upcoming: [],
    stripePriceIds: {
      monthly: process.env.STRIPE_PRICE_ARTISAN_MONTHLY ?? '',
      yearly: process.env.STRIPE_PRICE_ARTISAN_YEARLY ?? '',
    },
  },
}

/** Retourne le plan correspondant à un price_id Stripe. */
export function getPlanByPriceId(priceId: string): { plan: PlanId; period: BillingPeriod } | null {
  for (const plan of Object.values(PLANS)) {
    if (plan.stripePriceIds.monthly && plan.stripePriceIds.monthly === priceId) {
      return { plan: plan.id, period: 'monthly' }
    }
    if (plan.stripePriceIds.yearly && plan.stripePriceIds.yearly === priceId) {
      return { plan: plan.id, period: 'yearly' }
    }
  }
  return null
}

export function isPlanId(value: unknown): value is PlanId {
  return value === 'starter' || value === 'pro'
}

/** Montant TTC arrondi au centime. */
export function withVat(amountHt: number): number {
  return Math.round(amountHt * (1 + VAT_RATE) * 100) / 100
}

/** « 12 € », « 14,40 € » — pas de décimales inutiles. */
export function formatEuros(amount: number): string {
  const hasCents = Math.round(amount * 100) % 100 !== 0
  return `${amount.toLocaleString('fr-FR', {
    minimumFractionDigits: hasCents ? 2 : 0,
    maximumFractionDigits: 2,
  })} €`
}

/** Montant réellement prélevé à chaque échéance, en € HT. */
export function periodPrice(plan: Plan, period: BillingPeriod): number {
  return period === 'monthly' ? plan.monthlyPrice : plan.yearlyPrice
}
