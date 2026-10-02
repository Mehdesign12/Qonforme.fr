import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { stripe } from '@/lib/stripe/client'
import { getPlanByPriceId, isPlanId, type PlanId, type BillingPeriod } from '@/lib/stripe/plans'
import {
  upsertSubscription,
  updateSubscriptionStatus,
  getSubscriptionByCustomerId,
} from '@/lib/stripe/subscription'
import { mapStripeStatus } from '@/lib/stripe/access'
import { logError } from '@/lib/logError'

// IMPORTANT : lire le corps brut pour pouvoir valider la signature Stripe
export const runtime = 'nodejs'

/**
 * Depuis l'API 2025, current_period_end est sur chaque subscription item
 * plutôt que sur la subscription elle-même.
 */
function getPeriodEnd(sub: Stripe.Subscription): Date | null {
  const item = sub.items?.data?.[0]
  if (!item) return null
  const ts = (item as unknown as { current_period_end?: number }).current_period_end
  if (!ts) return null
  return new Date(ts * 1000)
}

/**
 * Abonnement d'une facture Stripe. Depuis l'API 2025-03-31, le champ
 * `invoice.subscription` a disparu au profit de
 * `invoice.parent.subscription_details.subscription` : le lire à l'ancienne
 * renvoyait `undefined`, et un abonnement repassé en règle restait bloqué.
 */
function getInvoiceSubscriptionId(invoice: Stripe.Invoice): string | null {
  const fromParent = invoice.parent?.subscription_details?.subscription
  if (fromParent) return typeof fromParent === 'string' ? fromParent : fromParent.id
  const legacy = (invoice as unknown as { subscription?: string | { id: string } | null }).subscription
  if (!legacy) return null
  return typeof legacy === 'string' ? legacy : legacy.id
}

/**
 * Active (ou réactive) la formule à partir d'une session Checkout terminée.
 * Appelé pour checkout.session.completed et checkout.session.async_payment_succeeded
 * (prélèvement SEPA confirmé) : idempotent.
 */
async function activateFromCheckoutSession(session: Stripe.Checkout.Session, eventId: string): Promise<void> {
  if (session.mode !== 'subscription' || !session.subscription) return

  const subscriptionId = typeof session.subscription === 'string' ? session.subscription : session.subscription.id
  const customerId = typeof session.customer === 'string' ? session.customer : session.customer?.id ?? ''

  const stripeSub = await stripe.subscriptions.retrieve(subscriptionId)
  const priceId = stripeSub.items.data[0]?.price.id

  if (!priceId) {
    await logError({
      type: 'webhook_stripe',
      message: 'Pas de price_id sur la subscription après le paiement',
      context: { subscriptionId, customerId, eventId },
    })
    return
  }

  // Plan : le price_id fait foi ; metadata.plan (posé à la création du paiement) en secours
  const metaPlan = session.metadata?.plan ?? stripeSub.metadata?.plan
  const metaPeriod = session.metadata?.billing_period ?? stripeSub.metadata?.billing_period
  const planInfo = getPlanByPriceId(priceId)
  const resolvedPlan: PlanId | undefined = planInfo?.plan ?? (isPlanId(metaPlan) ? metaPlan : undefined)
  const resolvedPeriod: BillingPeriod = planInfo?.period ?? (metaPeriod === 'yearly' ? 'yearly' : 'monthly')

  if (!resolvedPlan) {
    await logError({
      type: 'webhook_stripe',
      message: 'Formule introuvable après le paiement',
      context: { priceId, metaPlan, subscriptionId, eventId },
    })
    return
  }

  // user_id : client_reference_id, puis métadonnées de la session, de l'abonnement, du customer
  let userId =
    session.client_reference_id ||
    session.metadata?.user_id ||
    stripeSub.metadata?.user_id ||
    undefined

  if (!userId && customerId) {
    const customer = await stripe.customers.retrieve(customerId)
    userId = !('deleted' in customer && customer.deleted) ? (customer as Stripe.Customer).metadata?.user_id : undefined
  }

  if (!userId) {
    await logError({
      type: 'webhook_stripe',
      message: 'user_id introuvable dans les métadonnées Stripe — formule non activée',
      context: { subscriptionId, customerId, eventId },
    })
    return
  }

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

  console.log(`[webhook] Formule ${resolvedPlan} activée pour user ${userId} (${stripeSub.status})`)
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
      // Paiement terminé (carte confirmée, ou mandat SEPA signé — prélèvement en cours)
      case 'checkout.session.completed':
      // Prélèvement SEPA finalement confirmé
      case 'checkout.session.async_payment_succeeded': {
        await activateFromCheckoutSession(event.data.object as Stripe.Checkout.Session, event.id)
        break
      }

      // Prélèvement SEPA finalement rejeté : la formule ne démarre pas
      case 'checkout.session.async_payment_failed': {
        const session = event.data.object as Stripe.Checkout.Session
        const subscriptionId = typeof session.subscription === 'string' ? session.subscription : session.subscription?.id
        if (subscriptionId) {
          const stripeSub = await stripe.subscriptions.retrieve(subscriptionId)
          await updateSubscriptionStatus(subscriptionId, mapStripeStatus(stripeSub.status) === 'active' ? 'past_due' : mapStripeStatus(stripeSub.status))
        }
        await logError({
          type: 'payment_failed',
          message: 'Premier prélèvement SEPA rejeté',
          userId: session.client_reference_id ?? undefined,
          context: { subscriptionId, eventId: event.id },
        })
        break
      }

      // Changement de formule, renouvellement, résiliation programmée, impayé…
      case 'customer.subscription.updated': {
        const stripeSub = event.data.object as Stripe.Subscription
        const priceId = stripeSub.items.data[0]?.price.id
        const planInfo = priceId ? getPlanByPriceId(priceId) : null
        const status = mapStripeStatus(stripeSub.status)
        const userId = stripeSub.metadata?.user_id
        const canceledAt = stripeSub.canceled_at ? new Date(stripeSub.canceled_at * 1000) : null

        if (planInfo && userId && priceId) {
          await upsertSubscription({
            userId,
            stripeCustomerId: stripeSub.customer as string,
            stripeSubscriptionId: stripeSub.id,
            stripePriceId: priceId,
            plan: planInfo.plan,
            billingPeriod: planInfo.period,
            status,
            currentPeriodEnd: getPeriodEnd(stripeSub),
            canceledAt,
          })
        } else {
          await updateSubscriptionStatus(stripeSub.id, status, {
            currentPeriodEnd: getPeriodEnd(stripeSub) ?? undefined,
            canceledAt: canceledAt ?? undefined,
          })
        }

        console.log(`[webhook] Subscription ${stripeSub.id} mise à jour — statut: ${status}`)
        break
      }

      // Fin de l'abonnement : retour à la version gratuite (documents toujours accessibles)
      case 'customer.subscription.deleted': {
        const stripeSub = event.data.object as Stripe.Subscription

        await updateSubscriptionStatus(stripeSub.id, 'canceled', {
          canceledAt: stripeSub.canceled_at ? new Date(stripeSub.canceled_at * 1000) : new Date(),
        })

        console.log(`[webhook] Abonnement ${stripeSub.id} terminé`)
        break
      }

      // Échéance impayée : délai de grâce pendant que Stripe retente (l'émission reste ouverte)
      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice
        const customerId = typeof invoice.customer === 'string' ? invoice.customer : invoice.customer?.id
        const subscriptionId = getInvoiceSubscriptionId(invoice)
          ?? (customerId ? (await getSubscriptionByCustomerId(customerId))?.stripe_subscription_id : null)

        if (subscriptionId) {
          await updateSubscriptionStatus(subscriptionId, 'past_due')
          const sub = customerId ? await getSubscriptionByCustomerId(customerId) : null
          await logError({
            type: 'payment_failed',
            message: 'Échéance impayée — abonnement passé en past_due',
            userId: sub?.user_id,
            context: { customerId, subscriptionId, eventId: event.id },
          })
        }
        break
      }

      // Échéance payée (y compris un prélèvement SEPA confirmé) → formule active
      case 'invoice.paid': {
        const invoice = event.data.object as Stripe.Invoice
        const subscriptionId = getInvoiceSubscriptionId(invoice)

        if (subscriptionId) {
          const stripeSub = await stripe.subscriptions.retrieve(subscriptionId)
          await updateSubscriptionStatus(subscriptionId, mapStripeStatus(stripeSub.status), {
            currentPeriodEnd: getPeriodEnd(stripeSub) ?? undefined,
          })
          console.log(`[webhook] Échéance payée — subscription ${subscriptionId} → ${stripeSub.status}`)
        }
        break
      }

      default:
        // Événement non géré — ignoré
        break
    }
  } catch (err) {
    console.error(`[webhook] Erreur traitement ${event.type}:`, err)
    await logError({
      type: 'webhook_stripe',
      message: `Exception non gérée lors du traitement de l'événement ${event.type}`,
      context: { eventType: event.type, eventId: event.id },
      error: err,
    })
    // 200 pour éviter que Stripe réessaie indéfiniment sur une erreur applicative
    return NextResponse.json({ error: 'Erreur traitement', received: true }, { status: 200 })
  }

  return NextResponse.json({ received: true })
}
