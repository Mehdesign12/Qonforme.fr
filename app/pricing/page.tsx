import type { Metadata } from 'next'
import PricingSelector from '@/components/billing/PricingSelector'
import AuthLayout from '@/components/auth/AuthLayout'
import StepIndicator from '@/components/auth/StepIndicator'

export const metadata: Metadata = { title: 'Choisir un plan — Qonforme' }
export const dynamic = 'force-dynamic'

const STEPS = [
  { label: 'Ton compte' },
  { label: 'Ton entreprise' },
  { label: 'Ton plan' },
]

export default function PricingPage() {
  return (
    <AuthLayout maxWidth="2xl">
      {/* StepIndicator conservé en haut, centré */}
      <StepIndicator steps={STEPS} current={2} />

      {/* PricingSelector gère son propre layout 2 colonnes */}
      <PricingSelector />
    </AuthLayout>
  )
}
