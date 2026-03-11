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
    <AuthLayout maxWidth="lg">
      <StepIndicator steps={STEPS} current={2} />

      {/* Titre */}
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold text-[#0F172A] mb-2">Choisis ton plan</h1>
        <p className="text-slate-500 text-base">
          Accès immédiat dès le paiement confirmé · Résiliation à tout moment
        </p>
      </div>

      <PricingSelector />
    </AuthLayout>
  )
}
