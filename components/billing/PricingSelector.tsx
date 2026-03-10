'use client'

import { useState } from 'react'
import { Check, Zap, Crown } from 'lucide-react'
import { PLANS, type PlanId, type BillingPeriod } from '@/lib/stripe/plans'
import dynamic from 'next/dynamic'

// Chargement lazy du modal Stripe (évite d'alourdir le bundle principal)
const EmbeddedCheckoutModal = dynamic(
  () => import('@/components/billing/EmbeddedCheckoutModal'),
  { ssr: false }
)

export default function PricingSelector() {
  const [billingPeriod, setBillingPeriod] = useState<BillingPeriod>('monthly')
  const [selectedPlan, setSelectedPlan] = useState<{
    planId: PlanId
    billingPeriod: BillingPeriod
  } | null>(null)

  const plans = [PLANS.starter, PLANS.pro]

  function handleSelectPlan(planId: PlanId) {
    setSelectedPlan({ planId, billingPeriod })
  }

  return (
    <>
      <div className="w-full max-w-3xl mx-auto">

        {/* Toggle mensuel / annuel */}
        <div className="flex items-center justify-center gap-3 mb-8">
          <button
            onClick={() => setBillingPeriod('monthly')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              billingPeriod === 'monthly'
                ? 'bg-[#2563EB] text-white'
                : 'bg-white border border-[#E2E8F0] text-slate-600 hover:border-[#2563EB]'
            }`}
          >
            Mensuel
          </button>
          <button
            onClick={() => setBillingPeriod('yearly')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${
              billingPeriod === 'yearly'
                ? 'bg-[#2563EB] text-white'
                : 'bg-white border border-[#E2E8F0] text-slate-600 hover:border-[#2563EB]'
            }`}
          >
            Annuel
            <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
              billingPeriod === 'yearly'
                ? 'bg-white/20 text-white'
                : 'bg-[#D1FAE5] text-[#065F46]'
            }`}>
              –16 %
            </span>
          </button>
        </div>

        {billingPeriod === 'yearly' && (
          <p className="text-center text-sm text-[#10B981] font-medium mb-6">
            🎉 2 mois offerts — soit 2 mois à 0 €
          </p>
        )}

        {/* Cartes plans */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          {plans.map((plan) => {
            const isPro = plan.id === 'pro'
            const price = billingPeriod === 'monthly'
              ? plan.monthlyPrice
              : plan.yearlyMonthlyEquivalent

            return (
              <div
                key={plan.id}
                className={`relative rounded-2xl border-2 p-6 flex flex-col transition-shadow ${
                  isPro
                    ? 'border-[#2563EB] shadow-lg shadow-blue-100'
                    : 'border-[#E2E8F0] hover:border-[#2563EB]/40'
                }`}
              >
                {/* Badge recommandé */}
                {isPro && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <span className="bg-[#2563EB] text-white text-xs font-bold px-3 py-1 rounded-full">
                      Recommandé
                    </span>
                  </div>
                )}

                {/* Icône + En-tête */}
                <div className="flex items-center gap-3 mb-4">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                    isPro
                      ? 'bg-gradient-to-br from-[#1D4ED8] to-[#7C3AED]'
                      : 'bg-[#EFF6FF]'
                  }`}>
                    {isPro
                      ? <Crown className="w-5 h-5 text-white" />
                      : <Zap className="w-5 h-5 text-[#2563EB]" />
                    }
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-[#0F172A]">{plan.name}</h3>
                    <p className="text-xs text-slate-400">{plan.description}</p>
                  </div>
                </div>

                {/* Prix */}
                <div className="mb-5">
                  <div className="flex items-baseline gap-1">
                    <span className="text-4xl font-bold text-[#0F172A]">
                      {price % 1 === 0 ? price : price.toFixed(2)}€
                    </span>
                    <span className="text-slate-500 text-sm">/mois HT</span>
                  </div>
                  {billingPeriod === 'yearly' && (
                    <p className="text-xs text-slate-400 mt-1">
                      Facturé {plan.yearlyPrice}€/an
                    </p>
                  )}
                </div>

                {/* Features */}
                <ul className="space-y-2.5 mb-6 flex-1">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-2.5 text-sm text-slate-700">
                      <Check className="w-4 h-4 text-[#10B981] shrink-0 mt-0.5" />
                      {feature}
                    </li>
                  ))}
                </ul>

                {/* CTA */}
                <button
                  onClick={() => handleSelectPlan(plan.id)}
                  className={`w-full py-3 px-4 rounded-xl font-semibold text-sm transition-all flex items-center justify-center gap-2 ${
                    isPro
                      ? 'bg-[#2563EB] hover:bg-[#1D4ED8] text-white'
                      : 'bg-[#0F172A] hover:bg-[#1E293B] text-white'
                  }`}
                >
                  {isPro
                    ? <Crown className="w-4 h-4" />
                    : <Zap className="w-4 h-4" />
                  }
                  Choisir {plan.name}
                </button>
              </div>
            )
          })}
        </div>

        {/* Mentions */}
        <p className="text-center text-xs text-slate-400 mt-6">
          Paiement sécurisé par Stripe · Résiliation à tout moment · Sans engagement
        </p>
      </div>

      {/* Modal Embedded Checkout — s'affiche par-dessus la page */}
      {selectedPlan && (
        <EmbeddedCheckoutModal
          planId={selectedPlan.planId}
          billingPeriod={selectedPlan.billingPeriod}
          onClose={() => setSelectedPlan(null)}
        />
      )}
    </>
  )
}
