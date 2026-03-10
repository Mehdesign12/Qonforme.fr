import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import BillingPageClient from '@/components/billing/BillingPageClient'
import { stripe } from '@/lib/stripe/client'
import { getPlanByPriceId } from '@/lib/stripe/plans'
import { createAdminClient } from '@/lib/supabase/server'
import type { Subscription } from '@/lib/stripe/subscription'

export const metadata: Metadata = { title: 'Abonnement — Qonforme' }
export const dynamic = 'force-dynamic'

export default async function BillingPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  let subscription: Subscription | null = null
  let invoicesThisMonth = 0

  if (user) {
    // Récupérer l'abonnement
    const { data: sub } = await supabase
      .from('subscriptions')
      .select('*')
      .eq('user_id', user.id)
      .single()

    if (sub) {
      let enriched = sub as Subscription

      // Si plan ou billing_period manquant → enrichir depuis Stripe
      if ((!enriched.plan || !enriched.billing_period) && enriched.stripe_subscription_id) {
        try {
          const stripeSub = await stripe.subscriptions.retrieve(enriched.stripe_subscription_id)
          const priceId = stripeSub.items.data[0]?.price?.id
          if (priceId) {
            const planInfo = getPlanByPriceId(priceId)
            if (planInfo) {
              // Mettre à jour la DB avec les vraies valeurs (auto-correction)
              const admin = createAdminClient()
              const item = stripeSub.items?.data?.[0] as unknown as { current_period_end?: number }
              const periodEnd = item?.current_period_end
                ? new Date(item.current_period_end * 1000).toISOString()
                : null

              await admin
                .from('subscriptions')
                .update({
                  plan: planInfo.plan,
                  billing_period: planInfo.period,
                  stripe_price_id: priceId,
                  status: 'active',
                  current_period_end: periodEnd,
                  updated_at: new Date().toISOString(),
                })
                .eq('user_id', user.id)

              enriched = {
                ...enriched,
                plan: planInfo.plan,
                billing_period: planInfo.period,
                stripe_price_id: priceId,
                status: 'active',
                current_period_end: periodEnd,
              }
            }
          }
        } catch (err) {
          console.error('[BillingPage] Erreur enrichissement Stripe:', err)
        }
      }

      subscription = enriched
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
