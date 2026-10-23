/**
 * La formule Artisan est-elle vendable à CE client ? Décidé côté serveur, parce
 * que les prix d'essai (`STRIPE_PRICE_ARTISAN_*_TEST`) ne sont pas lisibles dans
 * le navigateur : un compte d'essai voit exactement les mêmes écrans qu'en
 * production, avec la formule en vente dès que ses prix d'essai existent.
 */
import { PLANS, isPlanAvailable } from './plans'
import { getUserStripeMode } from './test-users'

/** Sans utilisateur, ou mode illisible : le réglage public (production). */
export async function artisanOnSaleFor(userId: string | null | undefined): Promise<boolean> {
  if (!userId) return PLANS.pro.available
  const mode = await getUserStripeMode(userId)
  return isPlanAvailable(PLANS.pro, mode ?? 'live')
}
