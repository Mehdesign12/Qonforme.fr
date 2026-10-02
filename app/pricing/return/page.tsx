/**
 * /pricing/return — Page de retour après paiement Stripe (chemin de secours)
 *
 * Stripe redirige ici quand onComplete (côté client EmbeddedCheckout) ne se déclenche pas.
 * C'est typiquement le cas sur Safari mobile, en cas de problème réseau, ou si l'onglet
 * a été fermé pendant le paiement.
 *
 * Cette page :
 *   1. Vérifie le statut de la session Stripe
 *   2. Si le paiement est terminé (session.status === 'complete'), active la formule en base
 *      — de façon idempotente, donc sans risque de doublon avec le webhook
 *   3. Renvoie vers `next` (la facture à envoyer) ou le tableau de bord
 *
 * `redirect()` lève une exception interne de Next.js : il est appelé hors du
 * try/catch, sinon le catch l'intercepte et renvoie à tort vers le choix de formule.
 */
import { redirect } from 'next/navigation'
import Stripe from 'stripe'
import { stripe } from '@/lib/stripe/client'
import { upsertSubscription } from '@/lib/stripe/subscription'
import { getPlanByPriceId, isPlanId, type PlanId, type BillingPeriod } from '@/lib/stripe/plans'
import { mapStripeStatus, safeNextPath } from '@/lib/stripe/access'

export const dynamic = 'force-dynamic'

/** Extrait current_period_end depuis la subscription (API Stripe 2025) */
function getPeriodEnd(sub: Stripe.Subscription): Date | null {
  const item = sub.items?.data?.[0]
  if (!item) return null
  const ts = (item as unknown as { current_period_end?: number }).current_period_end
  if (!ts) return null
  return new Date(ts * 1000)
}

interface ReturnPageProps {
  searchParams: Promise<{ session_id?: string; next?: string }>
}

export default async function PricingReturnPage({ searchParams }: ReturnPageProps) {
  const { session_id, next } = await searchParams
  const target = safeNextPath(next) ?? '/dashboard'
  const backToPlans = `/signup/plan${safeNextPath(next) ? `?next=${encodeURIComponent(target)}` : ''}`

  if (!session_id) redirect(backToPlans)

  let destination = backToPlans

  try {
    const session = await stripe.checkout.sessions.retrieve(session_id)

    if (session.status === 'complete') {
      // Le paiement est terminé : l'artisan repart vers sa facture, même si
      // l'activation ci-dessous échoue (le webhook l'activera de son côté).
      destination = target

      const subscriptionId = typeof session.subscription === 'string' ? session.subscription : session.subscription?.id
      const customerId = typeof session.customer === 'string' ? session.customer : session.customer?.id

      if (subscriptionId && customerId) {
        try {
          const stripeSub = await stripe.subscriptions.retrieve(subscriptionId)
          const priceId = stripeSub.items.data[0]?.price.id

          if (priceId) {
            const metaPlan = session.metadata?.plan ?? stripeSub.metadata?.plan
            const metaPeriod = session.metadata?.billing_period ?? stripeSub.metadata?.billing_period
            const planInfo = getPlanByPriceId(priceId)

            const resolvedPlan: PlanId | undefined = planInfo?.plan ?? (isPlanId(metaPlan) ? metaPlan : undefined)
            const resolvedPeriod: BillingPeriod = planInfo?.period ?? (metaPeriod === 'yearly' ? 'yearly' : 'monthly')

            // user_id : même stratégie en 3 niveaux que le webhook
            const userId =
              session.client_reference_id ||
              session.metadata?.user_id ||
              stripeSub.metadata?.user_id

            if (resolvedPlan && userId) {
              await upsertSubscription({
                userId,
                stripeCustomerId: customerId,
                stripeSubscriptionId: subscriptionId,
                stripePriceId: priceId,
                plan: resolvedPlan,
                billingPeriod: resolvedPeriod,
                status: mapStripeStatus(stripeSub.status),
                currentPeriodEnd: getPeriodEnd(stripeSub),
              })
              console.log(`[/pricing/return] Formule ${resolvedPlan} (${resolvedPeriod}) activée pour user ${userId}`)
            } else {
              console.warn(`[/pricing/return] Formule ou user_id introuvable — session ${session_id} — activation via webhook attendue`)
            }
          }
        } catch (activationErr) {
          console.error('[/pricing/return] Erreur lors de l\'activation de la formule:', activationErr)
        }
      }
    }
  } catch (err) {
    // session_id invalide, réseau → retour au choix de formule
    console.error('[/pricing/return] Erreur récupération session Stripe:', err)
  }

  redirect(destination)
}
