import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { stripe } from '@/lib/stripe/client'
import { getPlanByPriceId } from '@/lib/stripe/plans'
import {
  upsertSubscription,
  updateSubscriptionStatus,
  getSubscriptionByCustomerId,
} from '@/lib/stripe/subscription'

// IMPORTANT : désactiver le bodyParser Next.js pour pouvoir valider la signature Stripe
export const runtime = 'nodejs'

/**
 * Dans Stripe API 2025, current_period_end est sur chaque subscription item
 * plutôt que sur la subscription elle-même.
 * Ce helper extrait la date de fin de période de l'item ou retourne null.
 */
function getPeriodEnd(sub: Stripe.Subscription): Date | null {
  const item = sub.items?.data?.[0]
  if (!item) return null
  // Stripe SDK v20 (API 2025) : current_period_end sur l'item
  const ts = (item as unknown as { current_period_end?: number }).current_period_end
  if (!ts) return null
  return new Date(ts * 1000)
}

export async function POST(request: NextRequest) {
  const body = await request.text()
  const signature = request.headers.get('stripe-signature')

  if (!signature) {
    return NextResponse.json({ error: 'Signature Stripe manquante' }, { status: 400 })
  }

  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET
  if (!webhookSecret) {
    console.error('[webhook] STRIPE_WEBHOOK_SECRET non défini')
    return NextResponse.json({ error: 'Configuration webhook manquante' }, { status: 500 })
  }

  let event: Stripe.Event

  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret)
  } catch (err) {
    console.error('[webhook] Signature invalide:', err)
    return NextResponse.json({ error: 'Signature invalide' }, { status: 400 })
  }

  console.log(`[webhook] Événement reçu: ${event.type}`)

  try {
    switch (event.type) {
      // ──────────────────────────────────────────────────────────
      // checkout.session.completed
      // Déclenché quand le paiement initial est validé
      // → on crée/active l'abonnement en BDD
      // ──────────────────────────────────────────────────────────
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session

        if (session.mode !== 'subscription') break

        const subscriptionId = session.subscription as string
        const customerId = session.customer as string

        // Récupérer les détails de l'abonnement Stripe
        const stripeSub = await stripe.subscriptions.retrieve(subscriptionId)
        const priceId = stripeSub.items.data[0]?.price.id

        if (!priceId) {
          console.error('[webhook] Pas de price_id sur la subscription:', subscriptionId)
          break
        }

        const planInfo = getPlanByPriceId(priceId)
        if (!planInfo) {
          console.error('[webhook] Plan inconnu pour price_id:', priceId)
          break
        }

        // Stratégie en 3 niveaux pour récupérer user_id :
        // 1. client_reference_id (le plus fiable — défini explicitement dans la Checkout Session)
        // 2. metadata.user_id sur la session
        // 3. metadata.user_id sur la subscription
        const userId =
          (session.client_reference_id ?? undefined) ||
          (session.metadata?.user_id as string | undefined) ||
          stripeSub.metadata?.user_id

        if (!userId) {
          console.error('[webhook] user_id manquant dans toutes les métadonnées — subscriptionId:', subscriptionId)
          // Tentative de récupération via customer metadata (dernier recours)
          const customer = await stripe.customers.retrieve(customerId)
          const customerUserId = !('deleted' in customer) ? customer.metadata?.user_id : undefined
          if (!customerUserId) {
            console.error('[webhook] Impossible de récupérer user_id — abandon')
            break
          }
          // Utilise le user_id du customer
          await upsertSubscription({
            userId: customerUserId,
            stripeCustomerId: customerId,
            stripeSubscriptionId: subscriptionId,
            stripePriceId: priceId,
            plan: planInfo.plan,
            billingPeriod: planInfo.period,
            status: 'active',
            currentPeriodEnd: getPeriodEnd(stripeSub),
          })
          console.log(`[webhook] Abonnement activé (via customer) pour user ${customerUserId} — plan ${planInfo.plan}`)
          break
        }

        await upsertSubscription({
          userId,
          stripeCustomerId: customerId,
          stripeSubscriptionId: subscriptionId,
          stripePriceId: priceId,
          plan: planInfo.plan,
          billingPeriod: planInfo.period,
          status: 'active',
          currentPeriodEnd: getPeriodEnd(stripeSub),
        })

        console.log(`[webhook] Abonnement activé pour user ${userId} — plan ${planInfo.plan}`)
        break
      }

      // ──────────────────────────────────────────────────────────
      // customer.subscription.updated
      // Déclenché lors d'un changement de plan, renouvellement, etc.
      // ──────────────────────────────────────────────────────────
      case 'customer.subscription.updated': {
        const stripeSub = event.data.object as Stripe.Subscription
        const priceId = stripeSub.items.data[0]?.price.id

        const planInfo = priceId ? getPlanByPriceId(priceId) : null

        // Mapper le statut Stripe → statut Qonforme
        let status: 'active' | 'past_due' | 'canceled' | 'incomplete'
        switch (stripeSub.status) {
          case 'active':
            status = 'active'
            break
          case 'past_due':
            status = 'past_due'
            break
          case 'canceled':
            status = 'canceled'
            break
          default:
            status = 'incomplete'
        }

        // Si le plan a changé, on fait un upsert complet
        if (planInfo) {
          const userId = stripeSub.metadata?.user_id
          if (userId) {
            await upsertSubscription({
              userId,
              stripeCustomerId: stripeSub.customer as string,
              stripeSubscriptionId: stripeSub.id,
              stripePriceId: priceId!,
              plan: planInfo.plan,
              billingPeriod: planInfo.period,
              status,
              currentPeriodEnd: getPeriodEnd(stripeSub),
              canceledAt: stripeSub.canceled_at
                ? new Date(stripeSub.canceled_at * 1000)
                : null,
            })
          }
        } else {
          // Sinon on met juste à jour le statut
          await updateSubscriptionStatus(stripeSub.id, status, {
            currentPeriodEnd: getPeriodEnd(stripeSub) ?? undefined,
            canceledAt: stripeSub.canceled_at
              ? new Date(stripeSub.canceled_at * 1000)
              : undefined,
          })
        }

        console.log(`[webhook] Subscription ${stripeSub.id} mise à jour — statut: ${status}`)
        break
      }

      // ──────────────────────────────────────────────────────────
      // customer.subscription.deleted
      // Déclenché quand l'abonnement est annulé définitivement
      // → on passe en canceled, accès bloqué
      // ──────────────────────────────────────────────────────────
      case 'customer.subscription.deleted': {
        const stripeSub = event.data.object as Stripe.Subscription

        await updateSubscriptionStatus(stripeSub.id, 'canceled', {
          canceledAt: stripeSub.canceled_at
            ? new Date(stripeSub.canceled_at * 1000)
            : new Date(),
        })

        console.log(`[webhook] Abonnement ${stripeSub.id} annulé`)
        break
      }

      // ──────────────────────────────────────────────────────────
      // invoice.payment_failed
      // Déclenché quand un paiement de renouvellement échoue
      // → on passe en past_due, accès bloqué
      // ──────────────────────────────────────────────────────────
      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const customerId = (invoice as any).customer as string

        // Trouver l'abonnement par customer_id
        const sub = await getSubscriptionByCustomerId(customerId)
        if (sub?.stripe_subscription_id) {
          await updateSubscriptionStatus(sub.stripe_subscription_id, 'past_due')
          console.log(`[webhook] Paiement échoué — customer ${customerId} → past_due`)
        }
        break
      }

      // ──────────────────────────────────────────────────────────
      // invoice.paid
      // Déclenché quand un paiement de renouvellement réussit
      // → on repasse en active si était past_due
      // ──────────────────────────────────────────────────────────
      case 'invoice.paid': {
        const invoice = event.data.object as Stripe.Invoice
        // Dans Stripe API 2025, le champ subscription peut varier selon la version SDK
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const subscriptionId = (invoice as any).subscription as string | null

        if (subscriptionId) {
          const stripeSub = await stripe.subscriptions.retrieve(subscriptionId)
          await updateSubscriptionStatus(subscriptionId, 'active', {
            currentPeriodEnd: getPeriodEnd(stripeSub) ?? undefined,
          })
          console.log(`[webhook] Paiement reçu — subscription ${subscriptionId} → active`)
        }
        break
      }

      default:
        // Événement non géré — on l'ignore silencieusement
        break
    }
  } catch (err) {
    console.error(`[webhook] Erreur traitement ${event.type}:`, err)
    // On retourne 200 pour éviter que Stripe réessaie indéfiniment sur une erreur applicative
    return NextResponse.json({ error: 'Erreur traitement', received: true }, { status: 200 })
  }

  return NextResponse.json({ received: true })
}
