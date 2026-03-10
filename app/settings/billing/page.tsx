import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import BillingPageClient from '@/components/billing/BillingPageClient'
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
      subscription = sub as Subscription
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
