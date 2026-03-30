import { redirect } from 'next/navigation'
import type { Metadata } from 'next'
import type { PlanId, BillingPeriod } from '@/lib/stripe/plans'
import { PLANS } from '@/lib/stripe/plans'
import CheckoutPageClient from './CheckoutPageClient'

export const dynamic = 'force-dynamic'

interface CheckoutPageProps {
  searchParams: Promise<{
    plan?: string
    period?: string
  }>
}

export async function generateMetadata({
  searchParams,
}: CheckoutPageProps): Promise<Metadata> {
  const { plan } = await searchParams
  const planData = plan && plan in PLANS ? PLANS[plan as PlanId] : null
  return {
    title: planData
      ? `Finaliser mon abonnement ${planData.name} — Qonforme`
      : 'Finaliser mon abonnement — Qonforme',
  }
}

export default async function CheckoutPage({ searchParams }: CheckoutPageProps) {
  const { plan, period } = await searchParams

  // Validation stricte des paramètres
  const validPlans: PlanId[] = ['starter', 'pro']
  const validPeriods: BillingPeriod[] = ['monthly', 'yearly']

  const planId = validPlans.includes(plan as PlanId) ? (plan as PlanId) : null
  const billingPeriod = validPeriods.includes(period as BillingPeriod)
    ? (period as BillingPeriod)
    : null

  // Paramètres invalides → retour au choix de plan
  if (!planId || !billingPeriod) {
    redirect('/signup/plan')
  }

  return (
    <CheckoutPageClient
      planId={planId}
      billingPeriod={billingPeriod}
    />
  )
}
