import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import BillingPageClient from '@/components/billing/BillingPageClient'
import { stripe } from '@/lib/stripe/client'
import { getPlanByPriceId, PLANS } from '@/lib/stripe/plans'
import { createAdminClient } from '@/lib/supabase/server'
import type { Subscription } from '@/lib/stripe/subscription'
import type Stripe from 'stripe'

export const metadata: Metadata = { title: 'Abonnement — Qonforme' }
export const dynamic = 'force-dynamic'

function mapStripeStatus(s: string): Subscription['status'] {
  switch (s) {
    case 'active':
    case 'trialing':
      return 'active'
    case 'past_due':
    case 'unpaid':
      return 'past_due'
    case 'canceled':
    case 'incomplete_expired':
      return 'canceled'
    default:
      return 'incomplete'
  }
}

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

export default async function BillingPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  let subscription: Subscription | null = null
  let invoicesThisMonth = 0

  if (user) {
    const { data: sub } = await supabase
      .from('subscriptions')
      .select('*')
      .eq('user_id', user.id)
      .single()

    if (sub) {
      const enriched = sub as Subscription
      const planIsUnknown = !enriched.plan || !(enriched.plan in PLANS)
      const statusStale = enriched.status === 'incomplete' || !enriched.status
      // Sync aussi si current_period_end est absent ou si stripe_subscription_id manque
      const missingDetails = !enriched.current_period_end || !enriched.stripe_subscription_id

      if (planIsUnknown || statusStale || missingDetails) {
        subscription = await syncFromStripe(enriched, user.id, user.email)
      } else {
        subscription = enriched
      }
    }

    // Compter les factures du mois courant
    const startOfMonth = new Date()
    startOfMonth.setDate(1)
    startOfMonth.setHours(0, 0, 0, 0)

    const { count } = await supabase
      .from('invoices')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .gte('created_at', startOfMonth.toISOString())

    invoicesThisMonth = count ?? 0
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-xl font-bold text-[#0F172A]">Abonnement</h1>
        <p className="text-sm text-slate-500 mt-1">
          Gérez votre plan, vos informations de paiement et votre facturation.
        </p>
      </div>

      <BillingPageClient
        subscription={subscription}
        invoicesThisMonth={invoicesThisMonth}
      />
    </div>
  )
}
