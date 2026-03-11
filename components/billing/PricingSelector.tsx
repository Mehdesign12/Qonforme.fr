'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Check, Crown, Loader2, Zap, ShieldCheck, Clock, Award } from 'lucide-react'
import { PLANS, type PlanId, type BillingPeriod } from '@/lib/stripe/plans'

/* ─── Badges de réassurance ─────────────────────────────────────────────── */
const badges = [
  { icon: ShieldCheck, label: "Paiement sécurisé Stripe" },
  { icon: Clock,       label: "Résiliation à tout moment" },
  { icon: Award,       label: "Conforme PPF · DGFiP" },
]

export default function PricingSelector() {
  const router = useRouter()
  const [billingPeriod, setBillingPeriod] = useState<BillingPeriod>('monthly')
  const [loadingPlan, setLoadingPlan]     = useState<PlanId | null>(null)

  const plans = [PLANS.starter, PLANS.pro]

  function handleSelectPlan(planId: PlanId) {
    if (loadingPlan) return
    setLoadingPlan(planId)
    router.push(`/pricing/checkout?plan=${planId}&period=${billingPeriod}`)
  }

  return (
    <div className="w-full">

      {/* ── Toggle mensuel / annuel ────────────────────────────────────── */}
      <div className="flex items-center justify-center mb-7">
        <div className="flex items-center gap-1 bg-[#F1F5F9] rounded-full p-1">
          <button
            onClick={() => setBillingPeriod('monthly')}
            className={`px-5 py-2 rounded-full text-sm font-semibold transition-all ${
              billingPeriod === 'monthly'
                ? 'bg-white text-[#0F172A] shadow-sm'
                : 'text-slate-500 hover:text-[#0F172A]'
            }`}
          >
            Mensuel
          </button>
          <button
            onClick={() => setBillingPeriod('yearly')}
            className={`px-5 py-2 rounded-full text-sm font-semibold transition-all flex items-center gap-2 ${
              billingPeriod === 'yearly'
                ? 'bg-white text-[#0F172A] shadow-sm'
                : 'text-slate-500 hover:text-[#0F172A]'
            }`}
          >
            Annuel
            <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full transition-colors ${
              billingPeriod === 'yearly'
                ? 'bg-[#D1FAE5] text-[#065F46]'
                : 'bg-[#DCFCE7] text-[#16A34A]'
            }`}>
              −16 %
            </span>
          </button>
        </div>
      </div>

      {billingPeriod === 'yearly' && (
        <p className="text-center text-sm text-[#10B981] font-semibold mb-6">
          🎉 2 mois offerts — économise jusqu&apos;à 38 €/an
        </p>
      )}

      {/* ── Cartes ───────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-5">
        {plans.map((plan) => {
          const isPro     = plan.id === 'pro'
          const isLoading = loadingPlan === plan.id
          const price     = billingPeriod === 'monthly'
            ? plan.monthlyPrice
            : plan.yearlyMonthlyEquivalent

          return isPro
            ? /* ── Carte Pro — dark ──────────────────────────────────────── */
              <div
                key={plan.id}
                className="relative rounded-2xl p-6 flex flex-col bg-[#0F172A] text-white shadow-xl shadow-slate-900/20"
              >
                {/* Badge recommandé */}
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <span className="bg-gradient-to-r from-[#2563EB] to-[#7C3AED] text-white text-xs font-bold px-4 py-1 rounded-full shadow-lg">
                    ✦ Recommandé
                  </span>
                </div>

                {/* Header */}
                <div className="flex items-center gap-3 mb-5">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#2563EB] to-[#7C3AED] flex items-center justify-center shrink-0">
                    <Crown className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-white">{plan.name}</h3>
                    <p className="text-xs text-slate-400">{plan.description}</p>
                  </div>
                </div>

                {/* Prix */}
                <div className="mb-5">
                  <div className="flex items-baseline gap-1">
                    <span className="text-4xl font-bold text-white font-mono">
                      {price % 1 === 0 ? price : price.toFixed(2)}€
                    </span>
                    <span className="text-slate-400 text-sm">/mois HT</span>
                  </div>
                  {billingPeriod === 'yearly' && (
                    <p className="text-xs text-slate-500 mt-1">
                      Facturé {plan.yearlyPrice} €/an
                    </p>
                  )}
                </div>

                {/* Séparateur */}
                <div className="h-px bg-white/10 mb-5" />

                {/* Features */}
                <ul className="space-y-3 mb-6 flex-1">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-2.5 text-sm text-slate-300">
                      <div className="w-4 h-4 rounded-full bg-[#2563EB]/20 flex items-center justify-center shrink-0 mt-0.5">
                        <Check className="w-2.5 h-2.5 text-[#60A5FA]" />
                      </div>
                      {feature}
                    </li>
                  ))}
                </ul>

                {/* CTA */}
                <button
                  onClick={() => handleSelectPlan(plan.id)}
                  disabled={loadingPlan !== null}
                  className="w-full h-11 rounded-[10px] bg-[#2563EB] hover:bg-[#1D4ED8] active:scale-[0.98] text-white text-sm font-semibold transition-all flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {isLoading
                    ? <><Loader2 className="w-4 h-4 animate-spin" />Chargement…</>
                    : <><Crown className="w-4 h-4" />Choisir {plan.name}</>
                  }
                </button>
              </div>

            : /* ── Carte Starter — blanche ──────────────────────────────── */
              <div
                key={plan.id}
                className="relative rounded-2xl border-2 border-[#E2E8F0] p-6 flex flex-col bg-white hover:border-[#BFDBFE] hover:shadow-md transition-all"
              >
                {/* Header */}
                <div className="flex items-center gap-3 mb-5">
                  <div className="w-10 h-10 rounded-xl bg-[#EFF6FF] flex items-center justify-center shrink-0">
                    <Zap className="w-5 h-5 text-[#2563EB]" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-[#0F172A]">{plan.name}</h3>
                    <p className="text-xs text-slate-400">{plan.description}</p>
                  </div>
                </div>

                {/* Prix */}
                <div className="mb-5">
                  <div className="flex items-baseline gap-1">
                    <span className="text-4xl font-bold text-[#0F172A] font-mono">
                      {price % 1 === 0 ? price : price.toFixed(2)}€
                    </span>
                    <span className="text-slate-500 text-sm">/mois HT</span>
                  </div>
                  {billingPeriod === 'yearly' && (
                    <p className="text-xs text-slate-400 mt-1">
                      Facturé {plan.yearlyPrice} €/an
                    </p>
                  )}
                </div>

                {/* Séparateur */}
                <div className="h-px bg-[#F1F5F9] mb-5" />

                {/* Features */}
                <ul className="space-y-3 mb-6 flex-1">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-2.5 text-sm text-slate-700">
                      <div className="w-4 h-4 rounded-full bg-[#D1FAE5] flex items-center justify-center shrink-0 mt-0.5">
                        <Check className="w-2.5 h-2.5 text-[#10B981]" />
                      </div>
                      {feature}
                    </li>
                  ))}
                </ul>

                {/* CTA */}
                <button
                  onClick={() => handleSelectPlan(plan.id)}
                  disabled={loadingPlan !== null}
                  className="w-full h-11 rounded-[10px] bg-[#0F172A] hover:bg-[#1E293B] active:scale-[0.98] text-white text-sm font-semibold transition-all flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {isLoading
                    ? <><Loader2 className="w-4 h-4 animate-spin" />Chargement…</>
                    : <><Zap className="w-4 h-4" />Choisir {plan.name}</>
                  }
                </button>
              </div>
        })}
      </div>

      {/* ── Badges de réassurance ────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-center gap-4 mt-7">
        {badges.map(({ icon: Icon, label }) => (
          <div key={label} className="flex items-center gap-1.5 text-xs text-slate-500">
            <Icon className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            {label}
          </div>
        ))}
      </div>
    </div>
  )
}
