/**
 * Formules tarifaires Qonforme — grille du 19/10/2026 (DECISIONS-STRATEGIQUES.md
 * § 14) : Essentiel 24 €/mois ou 240 €/an, Artisan 34 €/mois ou 340 €/an.
 * Remplace la grille du 02/10/2026 (12 € et 24 € HT, § 12).
 *
 * Les identifiants internes restent 'starter' et 'pro' : la table
 * `subscriptions` les impose par une contrainte CHECK.
 *   'starter' = Essentiel
 *   'pro'     = Artisan
 * Ne jamais les afficher tels quels : passer par PLANS[id].name.
 *
 * Les prix sont ceux que le client paie. Tant que `VAT_COLLECTED` vaut false,
 * aucune TVA n'est ajoutée au paiement et rien ne parle de « HT » ou de « TTC »
 * (décision du fondateur le 19/10/2026 : Diez Agency LLC, société américaine,
 * n'est pas encore inscrite à la TVA ; son expert-comptable cherche la solution).
 * Une fois la LLC inscrite : activer Stripe Tax, passer `VAT_COLLECTED` à true
 * (prix hors taxes, TVA calculée par Stripe, numéro de TVA demandé au paiement),
 * relire les CGU et le § 14 de DECISIONS-STRATEGIQUES.md.
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

/**
 * La TVA est-elle collectée sur l'abonnement ? false : le prix affiché est le prix
 * payé, aucune mention HT/TTC, aucun taux ajouté (app/api/stripe/checkout/route.ts).
 * true : prix hors taxes, TVA ajoutée par Stripe Tax au paiement.
 */
export const VAT_COLLECTED = false

/** Suffixe des prix : « 24 € HT » seulement quand la TVA est ajoutée par-dessus. */
export const TAX_SUFFIX = VAT_COLLECTED ? ' HT' : ''

/**
 * Le prélèvement SEPA est-il proposé pour l'abonnement ? false depuis le 20/10/2026
 * (décision du fondateur) : Stripe demande des vérifications d'identité supplémentaires
 * pour l'activer sur le compte de la LLC, l'abonnement se paie donc par carte bancaire.
 * À true, après avoir activé « SEPA Direct Debit » dans Stripe (Settings › Payment
 * methods, en production et dans le bac à sable) : le paiement propose aussi le
 * prélèvement et les textes l'annoncent. Ne jamais écrire « SEPA » en dur dans un texte
 * d'abonnement : passer par `PAYMENT_METHODS_TEXT`.
 */
export const SEPA_DEBIT_ENABLED = false

/** Moyens de paiement du Checkout de l'abonnement (app/api/stripe/checkout/route.ts). */
export const SUBSCRIPTION_PAYMENT_METHODS: Array<'card' | 'sepa_debit'> = SEPA_DEBIT_ENABLED
  ? ['card', 'sepa_debit']
  : ['card']

/** Pour les textes : « carte bancaire », ou « carte bancaire ou prélèvement SEPA ». */
export const PAYMENT_METHODS_TEXT = SEPA_DEBIT_ENABLED ? 'carte bancaire ou prélèvement SEPA' : 'carte bancaire'

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
  monthlyPrice: number            // € par mois (hors taxes si VAT_COLLECTED)
  yearlyPrice: number             // € par an
  yearlyMonthlyEquivalent: number // € par mois, payé à l’année
  /** false tant que les fonctions propres à la formule ne sont pas livrées : elle ne se vend pas. */
  available: boolean
  features: string[]
  upcoming: string[]
  stripePriceIds: {
    monthly: string
    yearly: string
  }
  /** Mêmes prix dans le bac à sable Stripe, pour les comptes d'essai (lib/stripe/mode.ts). */
  stripePriceIdsTest: {
    monthly: string
    yearly: string
  }
}

/**
 * Limites de stockage du scan de documents (lib/scan). Une seule source : jamais de
 * quota écrit en dur dans un composant. Un dépassement bloque seulement l'ajout d'un
 * nouveau scan, jamais la consultation ni la suppression.
 */
export const SCAN_QUOTAS: Record<'free' | PlanId, { documents: number; megabytes: number }> = {
  free: { documents: 50, megabytes: 200 },
  starter: { documents: 2000, megabytes: 5120 },
  pro: { documents: 2000, megabytes: 5120 },
}

/** « 200 Mo », « 5 Go » : pour les textes de quota. */
function quotaSize(mb: number): string {
  return mb >= 1024 ? `${(mb / 1024).toLocaleString('fr-FR', { maximumFractionDigits: 1 })} Go` : `${mb.toLocaleString('fr-FR')} Mo`
}

/** « 50 documents scannés (200 Mo) » : le quota d'une formule, pour les tarifs et les CGU. */
export function scanQuotaText(plan: 'free' | PlanId): string {
  const q = SCAN_QUOTAS[plan]
  return `${q.documents.toLocaleString('fr-FR')} documents scannés (${quotaSize(q.megabytes)})`
}

/**
 * Ce que fait un compte sans formule. Planning, notes et scan sont ouverts à tous les
 * comptes, gratuits compris (livrés le 22/10/2026) ; seul l'espace de scan grandit
 * avec une formule payante (SCAN_QUOTAS).
 */
export const FREE_FEATURES = [
  'Devis illimités',
  'Clients et catalogue de prestations',
  'Factures préparées en brouillon',
  'Documents émis toujours consultables',
  'Planning de rendez-vous',
  'Notes et rappels, par client ou par chantier',
  'Scan des devis, bons de commande et bons de livraison',
]

export const PLANS: Record<PlanId, Plan> = {
  starter: {
    id: 'starter',
    name: 'Essentiel',
    tagline: 'Pour facturer sans limite.',
    monthlyPrice: 24,
    yearlyPrice: 240,
    yearlyMonthlyEquivalent: 20,
    available: true,
    features: [
      'Factures et avoirs illimités',
      'Envoi par email avec le PDF',
      'Relances automatiques des impayés',
      'Devis transformé en facture en un clic',
      'Export comptable FEC',
      'Tableau de bord : chiffre du mois, encours, retards',
      // Ouverte en production le 30/10/2026 (DECISIONS § 16)
      'Réception des factures fournisseurs par la plateforme agréée Super PDP',
      // Migrations 20261003 et 20261010 appliquées en production (confirmé par le fondateur le 30/10/2026)
      'Signature en ligne des devis et bons de commande',
    ],
    upcoming: [
      'Émission via plateforme agréée',
    ],
    stripePriceIds: {
      monthly: process.env.STRIPE_PRICE_ESSENTIEL_MONTHLY ?? '',
      yearly: process.env.STRIPE_PRICE_ESSENTIEL_YEARLY ?? '',
    },
    stripePriceIdsTest: {
      monthly: process.env.STRIPE_PRICE_ESSENTIEL_MONTHLY_TEST ?? '',
      yearly: process.env.STRIPE_PRICE_ESSENTIEL_YEARLY_TEST ?? '',
    },
  },
  pro: {
    id: 'pro',
    name: 'Artisan',
    tagline: 'Pour les pros du bâtiment.',
    monthlyPrice: 34,
    yearlyPrice: 340,
    yearlyMonthlyEquivalent: 28.33,
    available: ARTISAN_ON_SALE,
    features: [
      'Situations de travaux et factures d’acompte',
      'Retenue de garantie suivie',
      'Autoliquidation en sous-traitance',
      'Suivi par chantier',
      'Notes, rappels et documents scannés rattachés à chaque chantier',
    ],
    upcoming: [],
    stripePriceIds: {
      monthly: process.env.STRIPE_PRICE_ARTISAN_MONTHLY ?? '',
      yearly: process.env.STRIPE_PRICE_ARTISAN_YEARLY ?? '',
    },
    stripePriceIdsTest: {
      monthly: process.env.STRIPE_PRICE_ARTISAN_MONTHLY_TEST ?? '',
      yearly: process.env.STRIPE_PRICE_ARTISAN_YEARLY_TEST ?? '',
    },
  },
}

/**
 * Retourne le plan correspondant à un price_id Stripe, qu'il vienne de la
 * production ou du bac à sable (les identifiants des deux modes sont distincts).
 */
export function getPlanByPriceId(priceId: string): { plan: PlanId; period: BillingPeriod } | null {
  if (!priceId) return null
  for (const plan of Object.values(PLANS)) {
    for (const ids of [plan.stripePriceIds, plan.stripePriceIdsTest]) {
      if (ids.monthly && ids.monthly === priceId) return { plan: plan.id, period: 'monthly' }
      if (ids.yearly && ids.yearly === priceId) return { plan: plan.id, period: 'yearly' }
    }
  }
  return null
}

/**
 * La formule est-elle vendable à ce client ? En production : `available`. Pour un
 * compte d'essai (bac à sable) : dès que ses deux prix d'essai existent, même si
 * la formule n'est pas encore en vente au public.
 */
export function isPlanAvailable(plan: Plan, mode: 'live' | 'test' = 'live'): boolean {
  if (mode === 'test') return Boolean(plan.stripePriceIdsTest.monthly && plan.stripePriceIdsTest.yearly)
  return plan.available
}

export function isPlanId(value: unknown): value is PlanId {
  return value === 'starter' || value === 'pro'
}

/** Montant réellement payé par le client : le prix, plus la TVA seulement si elle est collectée. */
export function payableAmount(price: number): number {
  return VAT_COLLECTED ? withVat(price) : price
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
