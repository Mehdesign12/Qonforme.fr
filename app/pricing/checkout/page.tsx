import { redirect } from 'next/navigation'
import type { Metadata } from 'next'
import { PLANS, isPlanAvailable, isPlanId, type BillingPeriod } from '@/lib/stripe/plans'
import { safeNextPath } from '@/lib/stripe/access'
import { publishableKeyFor } from '@/lib/stripe/mode'
import { getUserStripeMode } from '@/lib/stripe/test-users'
import { createClient } from '@/lib/supabase/server'
import CheckoutPageClient from './CheckoutPageClient'

export const dynamic = 'force-dynamic'

interface CheckoutPageProps {
  searchParams: Promise<{
    plan?: string
    period?: string
    next?: string
  }>
}

export async function generateMetadata({
  searchParams,
}: CheckoutPageProps): Promise<Metadata> {
  const { plan } = await searchParams
  const planData = isPlanId(plan) ? PLANS[plan] : null
  return {
    title: planData
      ? `Choisir la formule ${planData.name} — Qonforme`
      : 'Choisir ma formule — Qonforme',
    robots: { index: false, follow: false },
  }
}

export default async function CheckoutPage({ searchParams }: CheckoutPageProps) {
  const { plan, period, next: rawNext } = await searchParams
  const next = safeNextPath(rawNext)

  const billingPeriod: BillingPeriod | null = period === 'monthly' || period === 'yearly' ? period : null

  // Mode Stripe du compte : bac à sable pour un compte d'essai, sinon production
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const mode = (user ? await getUserStripeMode(user.id) : null) ?? 'live'

  // Formule inconnue, pas encore disponible ou période invalide → retour au choix
  if (!isPlanId(plan) || !isPlanAvailable(PLANS[plan], mode) || !billingPeriod) {
    redirect(next ? `/signup/plan?next=${encodeURIComponent(next)}` : '/signup/plan')
  }

  return (
    <CheckoutPageClient
      planId={plan}
      billingPeriod={billingPeriod}
      next={next}
      publishableKey={publishableKeyFor(mode)}
    />
  )
}
