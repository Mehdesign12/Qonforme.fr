/**
 * /pricing/return — Page de retour après paiement Stripe (chemin de secours)
 *
 * Stripe redirige ici quand onComplete (côté client EmbeddedCheckout) ne se déclenche pas.
 * C'est typiquement le cas sur Safari mobile, en cas de problème réseau, ou si l'onglet
 * a été fermé pendant le paiement.
 *
 * Cette page :
 *   1. Vérifie le statut de la session Stripe
 *   2. Si le paiement est validé (session.status === 'complete'), active l'abonnement en DB
 *      — de façon idempotente, donc sans risque de doublon avec le webhook
 *   3. Redirige vers /dashboard ou /pricing selon le résultat
 */
import { redirect } from 'next/navigation'
import Stripe from 'stripe'
import { stripe } from '@/lib/stripe/client'
import { upsertSubscription } from '@/lib/stripe/subscription'
import { getPlanByPriceId, type PlanId, type BillingPeriod } from '@/lib/stripe/plans'

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
  searchParams: Promise<{ session_id?: string }>
}

export default async function PricingReturnPage({ searchParams }: ReturnPageProps) {
  const { session_id } = await searchParams

  if (!session_id) {
    redirect('/pricing')
  }

  try {
    const session = await stripe.checkout.sessions.retrieve(session_id)

    if (session.status !== 'complete') {
      // Session encore ouverte ou expirée → retour pricing
      redirect('/pricing')
    }

    // ── Paiement confirmé — activer l'abonnement en DB ──────────────────────
    // Sert de filet de sécurité si le webhook Stripe n'a pas encore tiré (ou a échoué).
    // upsertSubscription est idempotent : si le webhook a déjà activé l'abonnement, pas de doublon.
    const subscriptionId = session.subscription as string | null
    const customerId     = session.customer as string

    if (subscriptionId) {
      try {
        const stripeSub = await stripe.subscriptions.retrieve(subscriptionId)
        const priceId   = stripeSub.items.data[0]?.price.id

        if (priceId) {
          // Résoudre le plan : metadata.plan en source principale, getPlanByPriceId en fallback
          const metaPlan   = (session.metadata?.plan ?? stripeSub.metadata?.plan) as PlanId | undefined
          const metaPeriod = (session.metadata?.billing_period ?? stripeSub.metadata?.billing_period) as BillingPeriod | undefined
          const planInfo   = getPlanByPriceId(priceId)

          const resolvedPlan: PlanId | undefined = planInfo?.plan ?? metaPlan
          const resolvedPeriod: BillingPeriod    = planInfo?.period ?? metaPeriod ?? 'monthly'

          // Résoudre le user_id (même stratégie en 3 niveaux que le webhook)
          const userId =
            (session.client_reference_id ?? undefined) ||
            (session.metadata?.user_id as string | undefined) ||
            stripeSub.metadata?.user_id

          if (resolvedPlan && userId && (['starter', 'pro'] as const).includes(resolvedPlan)) {
            await upsertSubscription({
              userId,
              stripeCustomerId:      customerId,
              stripeSubscriptionId:  subscriptionId,
              stripePriceId:         priceId,
              plan:                  resolvedPlan,
              billingPeriod:         resolvedPeriod,
              status:                'active',
              currentPeriodEnd:      getPeriodEnd(stripeSub),
            })
            console.log(`[/pricing/return] Abonnement activé pour user ${userId} — plan ${resolvedPlan} (${resolvedPeriod})`)
          } else {
            // Plan ou user_id introuvable — le webhook devrait couvrir ce cas
            console.warn(`[/pricing/return] Plan ou user_id introuvable — session ${session_id} — activation via webhook attendue`)
          }
        }
      } catch (activationErr) {
        // L'activation a échoué, mais le paiement est confirmé.
        // Le webhook activera l'abonnement de son côté.
        // On redirige quand même vers /dashboard : l'utilisateur a payé.
        console.error('[/pricing/return] Erreur lors de l\'activation de l\'abonnement:', activationErr)
      }
    }

    // Paiement réussi → dashboard (le middleware laissera passer si upsert a réussi)
    redirect('/dashboard')
  } catch (err) {
    // Erreur Stripe (session_id invalide, réseau) → retour pricing
    console.error('[/pricing/return] Erreur récupération session Stripe:', err)
    redirect('/pricing')
  }
}
