/**
 * Deux modes Stripe cohabitent : la production (clés `sk_live_`, tous les vrais
 * clients) et le bac à sable (clés `sk_test_`, comptes d'essai de l'admin).
 *
 * Qui paie en bac à sable ? Seulement les comptes cochés dans Admin › Paiements
 * (table `stripe_test_users`, lib/stripe/test-users.ts). Tous les autres restent
 * en production en permanence : aucun interrupteur général, donc aucun risque de
 * couper la vente à de vrais clients par un clic.
 *
 * Variables d'environnement (jamais enregistrées en base, jamais affichées) :
 *   production : STRIPE_SECRET_KEY, NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY, STRIPE_WEBHOOK_SECRET,
 *                STRIPE_PRICE_{ESSENTIEL,ARTISAN}_{MONTHLY,YEARLY}
 *   bac à sable : les mêmes noms suffixés par _TEST
 */
import Stripe from 'stripe'

export type StripeMode = 'live' | 'test'

/** Version d'API de la bibliothèque (le webhook du bac à sable peut en annoncer une autre). */
const API_VERSION = '2026-02-25.clover'

const SECRET_KEY: Record<StripeMode, string> = {
  live: 'STRIPE_SECRET_KEY',
  test: 'STRIPE_SECRET_KEY_TEST',
}
const PUBLISHABLE_KEY: Record<StripeMode, string> = {
  live: 'NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY',
  test: 'NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY_TEST',
}
const WEBHOOK_SECRET: Record<StripeMode, string> = {
  live: 'STRIPE_WEBHOOK_SECRET',
  test: 'STRIPE_WEBHOOK_SECRET_TEST',
}

const clients: Partial<Record<StripeMode, { key: string; client: Stripe }>> = {}

function readEnv(name: string): string {
  return (process.env[name] ?? '').trim()
}

/** Client Stripe du mode demandé. Lève une erreur claire si sa clé manque. */
export function getStripe(mode: StripeMode = 'live'): Stripe {
  const key = readEnv(SECRET_KEY[mode])
  if (!key) {
    throw new Error(`${SECRET_KEY[mode]} est manquant dans les variables d'environnement`)
  }
  const cached = clients[mode]
  if (cached && cached.key === key) return cached.client
  const client = new Stripe(key, { apiVersion: API_VERSION, typescript: true })
  clients[mode] = { key, client }
  return client
}

/** Clé publique du mode (lue côté serveur, transmise au navigateur par la page de paiement). */
export function publishableKeyFor(mode: StripeMode): string {
  return readEnv(PUBLISHABLE_KEY[mode])
}

/** Clé de signature du webhook du mode (« » si absente). */
export function webhookSecretFor(mode: StripeMode): string {
  return readEnv(WEBHOOK_SECRET[mode])
}

/** Le mode a-t-il sa clé secrète ? */
export function isStripeConfigured(mode: StripeMode): boolean {
  return readEnv(SECRET_KEY[mode]) !== ''
}

/**
 * Mode d'un objet Stripe d'après son identifiant, quand il en porte la trace :
 * une session de paiement s'appelle `cs_test_…` ou `cs_live_…`. Sans indice
 * (`cus_…`, `sub_…`), production.
 */
export function modeFromStripeId(id: string | null | undefined): StripeMode {
  return typeof id === 'string' && id.includes('_test_') ? 'test' : 'live'
}

/** Mode d'un abonnement enregistré. Colonne absente ou vide : production. */
export function modeOfSubscription(sub: { livemode?: boolean | null } | null | undefined): StripeMode {
  return sub?.livemode === false ? 'test' : 'live'
}

/** Noms des variables du mode, pour l'écran Admin › Paiements (jamais leurs valeurs). */
export function stripeEnvStatus(mode: StripeMode): { name: string; present: boolean }[] {
  const suffix = mode === 'test' ? '_TEST' : ''
  const names = [
    SECRET_KEY[mode],
    PUBLISHABLE_KEY[mode],
    WEBHOOK_SECRET[mode],
    `STRIPE_PRICE_ESSENTIEL_MONTHLY${suffix}`,
    `STRIPE_PRICE_ESSENTIEL_YEARLY${suffix}`,
    `STRIPE_PRICE_ARTISAN_MONTHLY${suffix}`,
    `STRIPE_PRICE_ARTISAN_YEARLY${suffix}`,
  ]
  return names.map((name) => ({ name, present: readEnv(name) !== '' }))
}
