'use client'

import { useState } from 'react'
import { Check, Zap, Loader2 } from 'lucide-react'
import { PLANS, type PlanId, type BillingPeriod } from '@/lib/stripe/plans'

export default function PricingSelector() {
  const [billingPeriod, setBillingPeriod] = useState<BillingPeriod>('monthly')
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const plans = [PLANS.starter, PLANS.pro]

  async function handleSelectPlan(planId: PlanId) {
    setLoadingPlan(planId)
    setError(null)

    try {
      const res = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ planId, billingPeriod }),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error ?? 'Une erreur est survenue.')
        setLoadingPlan(null)
        return
      }

      // Redirection vers Stripe Checkout
      if (data.url) {
        window.location.href = data.url
      }
    } catch {
      setError('Impossible de contacter le serveur. Réessaie.')
      setLoadingPlan(null)
    }
  }

  const saving = billingPeriod === 'yearly' ? '2 mois offerts' : null

  return (
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

      {saving && billingPeriod === 'yearly' && (
        <p className="text-center text-sm text-[#10B981] font-medium mb-6">
          🎉 {saving} — soit 2 mois à 0 €
        </p>
      )}

      {/* Cartes plans */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
        {plans.map((plan) => {
          const isPro = plan.id === 'pro'
          const price = billingPeriod === 'monthly'
            ? plan.monthlyPrice
            : plan.yearlyMonthlyEquivalent
          const isLoading = loadingPlan === plan.id

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

              {/* En-tête */}
              <div className="mb-5">
                <h3 className="text-lg font-bold text-[#0F172A] mb-1">{plan.name}</h3>
                <p className="text-sm text-slate-500">{plan.description}</p>
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
                  <p className="text-sm text-slate-400 mt-1">
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
                disabled={isLoading || loadingPlan !== null}
                className={`w-full py-3 px-4 rounded-xl font-semibold text-sm transition-all flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed ${
                  isPro
                    ? 'bg-[#2563EB] hover:bg-[#1D4ED8] text-white'
                    : 'bg-[#0F172A] hover:bg-[#1E293B] text-white'
                }`}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Redirection…
                  </>
                ) : (
                  <>
                    <Zap className="w-4 h-4" />
                    Choisir {plan.name}
                  </>
                )}
              </button>
            </div>
          )
        })}
      </div>

      {/* Erreur globale */}
      {error && (
        <div className="mt-5 bg-[#FEE2E2] border border-[#FCA5A5] text-[#991B1B] rounded-xl px-4 py-3 text-sm text-center">
          {error}
        </div>
      )}

      {/* Mentions */}
      <p className="text-center text-xs text-slate-400 mt-6">
        Paiement sécurisé par Stripe · Résiliation à tout moment · Sans engagement
      </p>
    </div>
  )
}
