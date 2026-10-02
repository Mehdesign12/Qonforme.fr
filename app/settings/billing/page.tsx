import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import BillingPageClient, {
  type BillingIdentity,
  type BillingInvoice,
  type GuaranteeInfo,
  type PaymentMethodInfo,
} from '@/components/billing/BillingPageClient'
import { stripe } from '@/lib/stripe/client'
import { getPlanByPriceId, PLANS } from '@/lib/stripe/plans'
import { createAdminClient } from '@/lib/supabase/server'
import type { Subscription } from '@/lib/stripe/subscription'
import { canIssueInvoices, mapStripeStatus } from '@/lib/stripe/access'
import { getGuaranteeState } from '@/lib/stripe/guarantee'
import type Stripe from 'stripe'

export const metadata: Metadata = { title: 'Abonnement — Qonforme' }
export const dynamic = 'force-dynamic'

async function applyStripeData(
  sub: Subscription,
  stripeSub: Stripe.Subscription,
  userId: string
): Promise<Subscription> {
  const priceId = stripeSub.items.data[0]?.price?.id
  const planInfo = priceId ? getPlanByPriceId(priceId) : null
  const item = stripeSub.items?.data?.[0] as unknown as { current_period_end?: number }
  const periodEnd = item?.current_period_end
    ? new Date(item.current_period_end * 1000).toISOString()
    : null
  const realStatus = mapStripeStatus(stripeSub.status)

  const payload: Record<string, unknown> = {
    stripe_subscription_id: stripeSub.id,
    stripe_customer_id: stripeSub.customer as string,
    status: realStatus,
    current_period_end: periodEnd,
    updated_at: new Date().toISOString(),
  }
  if (planInfo) {
    payload.plan = planInfo.plan
    payload.billing_period = planInfo.period
    payload.stripe_price_id = priceId
  }

  const admin = createAdminClient()
  await admin.from('subscriptions').update(payload).eq('user_id', userId)

  console.log(`[BillingPage] Synchro OK → plan:${planInfo?.plan ?? '?'} status:${realStatus}`)

  return {
    ...sub,
    stripe_subscription_id: stripeSub.id,
    stripe_customer_id: stripeSub.customer as string,
    status: realStatus,
    current_period_end: periodEnd,
    ...(planInfo
      ? { plan: planInfo.plan, billing_period: planInfo.period, stripe_price_id: priceId ?? sub.stripe_price_id }
      : {}),
  }
}

async function syncFromStripe(
  sub: Subscription,
  userId: string,
  userEmail: string | undefined
): Promise<Subscription> {
  let stripeSub: Stripe.Subscription | null = null

  // Priorité 1 : stripe_subscription_id direct
  if (sub.stripe_subscription_id) {
    try {
      stripeSub = await stripe.subscriptions.retrieve(sub.stripe_subscription_id)
    } catch { /* ignore */ }
  }

  // Priorité 2 : liste via stripe_customer_id
  if (!stripeSub && sub.stripe_customer_id) {
    try {
      const list = await stripe.subscriptions.list({
        customer: sub.stripe_customer_id,
        status: 'all',
        limit: 1,
      })
      stripeSub = list.data[0] ?? null
    } catch { /* ignore */ }
  }

  // Priorité 3 : recherche customer par email → liste ses subscriptions
  if (!stripeSub && userEmail) {
    try {
      const customers = await stripe.customers.list({ email: userEmail, limit: 5 })
      for (const customer of customers.data) {
        const list = await stripe.subscriptions.list({
          customer: customer.id,
          status: 'all',
          limit: 1,
        })
        if (list.data.length > 0) {
          stripeSub = list.data[0]
          // Mettre à jour user_id dans les métadonnées du customer pour les prochains webhooks
          await stripe.customers.update(customer.id, {
            metadata: { user_id: userId, supabase_user_id: userId },
          })
          console.log(`[BillingPage] Customer trouvé par email: ${customer.id}`)
          break
        }
      }
    } catch (err) {
      console.error('[BillingPage] Erreur recherche par email:', err)
    }
  }

  if (!stripeSub) {
    console.warn(`[BillingPage] Aucune subscription Stripe trouvée pour user ${userId}`)
    return sub
  }

  return applyStripeData(sub, stripeSub, userId)
}

/** Moyen de paiement lisible, sans jamais le numéro complet. */
function toPaymentMethodInfo(pm: Stripe.PaymentMethod | string | null | undefined): PaymentMethodInfo | null {
  if (!pm || typeof pm === 'string') return null
  if (pm.type === 'card' && pm.card) {
    return { kind: 'card', brand: pm.card.brand, last4: pm.card.last4, expMonth: pm.card.exp_month, expYear: pm.card.exp_year }
  }
  if (pm.type === 'sepa_debit' && pm.sepa_debit?.last4) return { kind: 'sepa_debit', last4: pm.sepa_debit.last4 }
  return { kind: 'other', label: 'Moyen de paiement enregistré' }
}

export default async function BillingPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  let subscription: Subscription | null = null
  let guarantee: GuaranteeInfo | null = null
  let cancelAtPeriodEnd = false
  let paymentMethod: PaymentMethodInfo | null = null
  let invoices: BillingInvoice[] = []
  let identity: BillingIdentity | null = null

  if (user) {
    const [{ data: sub }, { data: company }] = await Promise.all([
      supabase.from('subscriptions').select('*').eq('user_id', user.id).maybeSingle(),
      supabase.from('companies').select('name, address, zip_code, city, siren').eq('user_id', user.id).maybeSingle(),
    ])

    // Coordonnées reprises sur les factures d'abonnement (app/api/stripe/checkout)
    if (company) {
      identity = {
        name: company.name ?? '',
        address: [company.address, [company.zip_code, company.city].filter(Boolean).join(' ')].filter(Boolean).join(', '),
        siren: company.siren ?? '',
        email: user.email ?? '',
      }
    }

    if (sub) {
      const enriched = sub as Subscription
      const planIsUnknown = !enriched.plan || !(enriched.plan in PLANS)
      const statusStale = enriched.status === 'incomplete' || !enriched.status
      // Synchro aussi si current_period_end ou stripe_subscription_id manquent
      const missingDetails = !enriched.current_period_end || !enriched.stripe_subscription_id

      if (enriched.stripe_customer_id && (planIsUnknown || statusStale || missingDetails)) {
        subscription = await syncFromStripe(enriched, user.id, user.email)
      } else {
        subscription = enriched
      }
    }

    // Formule en cours : garantie, résiliation programmée et moyen de paiement lus chez Stripe
    if (subscription?.stripe_customer_id && canIssueInvoices(subscription.status)) {
      try {
        const state = await getGuaranteeState(subscription.stripe_customer_id)
        guarantee = state.eligible
          ? { eligible: true, endsAt: state.endsAt.toISOString(), amountPaid: state.amountPaid }
          : { eligible: false, reason: state.reason, endsAt: state.endsAt?.toISOString() ?? null }
      } catch (err) {
        console.error('[BillingPage] Lecture de la garantie impossible:', err)
      }
      if (subscription.stripe_subscription_id) {
        try {
          const stripeSub = await stripe.subscriptions.retrieve(subscription.stripe_subscription_id, {
            expand: ['default_payment_method'],
          })
          cancelAtPeriodEnd = Boolean(stripeSub.cancel_at_period_end || stripeSub.cancel_at)
          paymentMethod = toPaymentMethodInfo(stripeSub.default_payment_method)
          if (!paymentMethod) {
            // Moyen de paiement par défaut du client, quand l'abonnement n'en a pas en propre
            const customer = await stripe.customers.retrieve(subscription.stripe_customer_id, {
              expand: ['invoice_settings.default_payment_method'],
            })
            if (!customer.deleted) paymentMethod = toPaymentMethodInfo(customer.invoice_settings?.default_payment_method)
          }
        } catch { /* sans incidence : la page s'affiche quand même */ }
      }
    }

    // Factures d'abonnement (aussi après résiliation : elles restent téléchargeables)
    if (subscription?.stripe_customer_id) {
      try {
        const list = await stripe.invoices.list({ customer: subscription.stripe_customer_id, limit: 12 })
        invoices = list.data
          .filter((inv) => inv.status && inv.status !== 'draft')
          .map((inv) => ({
            id: inv.id ?? inv.number ?? String(inv.created),
            number: inv.number ?? null,
            date: new Date(inv.created * 1000).toISOString(),
            amount: (inv.total ?? 0) / 100,
            status: inv.status ?? 'open',
            pdfUrl: inv.invoice_pdf ?? null,
          }))
      } catch (err) {
        console.error('[BillingPage] Lecture des factures d\'abonnement impossible:', err)
      }
    }
  }

  return (
    <BillingPageClient
      subscription={subscription}
      guarantee={guarantee}
      cancelAtPeriodEnd={cancelAtPeriodEnd}
      paymentMethod={paymentMethod}
      invoices={invoices}
      identity={identity}
    />
  )
}
