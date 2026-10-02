import { stripe } from './client'
import { upsertSubscription } from './subscription'
import { getPlanByPriceId, isPlanId, type BillingPeriod, type PlanId } from './plans'
import { mapStripeStatus } from './access'

/**
 * Rattrapage d'une formule payée mais pas enregistrée (webhook perdu, onglet
 * fermé pendant le paiement) : interroge Stripe et met la base à jour.
 * Renvoie true si une formule active a été retrouvée.
 *
 * Ne jamais appeler `redirect()` dans un try/catch autour de cette fonction :
 * Next.js lève une exception pour rediriger, que le catch intercepterait.
 */
export async function recoverActiveSubscription(userId: string, stripeCustomerId: string): Promise<boolean> {
  try {
    const list = await stripe.subscriptions.list({ customer: stripeCustomerId, status: 'active', limit: 1 })
    const stripeSub = list.data[0]
    if (!stripeSub) return false

    const priceId = stripeSub.items.data[0]?.price.id
    if (!priceId) return false

    const planInfo = getPlanByPriceId(priceId)
    const metaPlan = stripeSub.metadata?.plan
    const plan: PlanId | undefined = planInfo?.plan ?? (isPlanId(metaPlan) ? metaPlan : undefined)
    if (!plan) return false
    const period: BillingPeriod = planInfo?.period ?? (stripeSub.metadata?.billing_period === 'yearly' ? 'yearly' : 'monthly')

    const ts = (stripeSub.items.data[0] as unknown as { current_period_end?: number }).current_period_end

    await upsertSubscription({
      userId,
      stripeCustomerId,
      stripeSubscriptionId: stripeSub.id,
      stripePriceId: priceId,
      plan,
      billingPeriod: period,
      status: mapStripeStatus(stripeSub.status),
      currentPeriodEnd: ts ? new Date(ts * 1000) : null,
    })

    console.log(`[recoverActiveSubscription] Formule ${plan} retrouvée pour user ${userId}`)
    return true
  } catch (err) {
    console.error('[recoverActiveSubscription] Échec:', err)
    return false
  }
}
