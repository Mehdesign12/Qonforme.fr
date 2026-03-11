'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Check, Crown, Loader2, Zap,
  ShieldCheck, Clock, Award, ArrowRight,
} from 'lucide-react'
import { PLANS, type PlanId, type BillingPeriod } from '@/lib/stripe/plans'

/* ─── Features exclusives Pro (non présentes dans Starter) ──────────────── */
const STARTER_FEATURE_SET = new Set(PLANS.starter.features)
const PRO_EXCLUSIVE = PLANS.pro.features.filter(f => !STARTER_FEATURE_SET.has(f))

/* ─── Badges de réassurance ─────────────────────────────────────────────── */
const BADGES = [
  { icon: ShieldCheck, label: 'Paiement sécurisé Stripe' },
  { icon: Clock,       label: 'Résiliation à tout moment' },
  { icon: Award,       label: 'Conforme PPF · DGFiP' },
]

export default function PricingSelector() {
  const router = useRouter()
  const [billingPeriod, setBillingPeriod] = useState<BillingPeriod>('monthly')
  const [loadingPlan, setLoadingPlan]     = useState<PlanId | null>(null)

  function handleSelectPlan(planId: PlanId) {
    if (loadingPlan) return
    setLoadingPlan(planId)
    router.push(`/pricing/checkout?plan=${planId}&period=${billingPeriod}`)
  }

  const starterPrice = billingPeriod === 'monthly'
    ? PLANS.starter.monthlyPrice
    : PLANS.starter.yearlyMonthlyEquivalent

  const proPrice = billingPeriod === 'monthly'
    ? PLANS.pro.monthlyPrice
    : PLANS.pro.yearlyMonthlyEquivalent

  return (
    /* ── Layout : gauche (pitch) | droite (2 cards) ─────────────────────── */
    <div className="w-full grid grid-cols-1 lg:grid-cols-[360px_1fr] gap-8 lg:gap-10 items-start">

      {/* ══════════════════════════════════════════════════════════
          COLONNE GAUCHE — Pitch + Toggle + Réassurance
      ══════════════════════════════════════════════════════════ */}
      <div className="flex flex-col gap-6">

        {/* Titre & sous-titre */}
        <div>
          <h1 className="text-3xl font-bold text-[#0F172A] leading-tight mb-2">
            Choisis ton plan
          </h1>
          <p className="text-slate-500 text-[15px] leading-relaxed">
            Accès immédiat dès le paiement confirmé.<br />
            Résiliation à tout moment, sans engagement.
          </p>
        </div>

        {/* Toggle Mensuel / Annuel */}
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-1 bg-white/60 backdrop-blur-sm border border-white/80 rounded-full p-1 w-fit shadow-sm">
            <button
              onClick={() => setBillingPeriod('monthly')}
              className={`px-5 py-2 rounded-full text-sm font-semibold transition-all ${
                billingPeriod === 'monthly'
                  ? 'bg-[#0F172A] text-white shadow-sm'
                  : 'text-slate-500 hover:text-[#0F172A]'
              }`}
            >
              Mensuel
            </button>
            <button
              onClick={() => setBillingPeriod('yearly')}
              className={`px-5 py-2 rounded-full text-sm font-semibold transition-all flex items-center gap-2 ${
                billingPeriod === 'yearly'
                  ? 'bg-[#0F172A] text-white shadow-sm'
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

          {billingPeriod === 'yearly' && (
            <p className="text-sm text-[#10B981] font-semibold flex items-center gap-1.5">
              <span className="inline-flex w-5 h-5 rounded-full bg-[#D1FAE5] items-center justify-center text-xs">🎉</span>
              2 mois offerts — économise jusqu&apos;à 38 €/an
            </p>
          )}
        </div>

        {/* Badges de réassurance */}
        <div className="flex flex-col gap-2.5 pt-2">
          {BADGES.map(({ icon: Icon, label }) => (
            <div key={label} className="flex items-center gap-2.5 text-sm text-slate-600">
              <div className="w-7 h-7 rounded-lg bg-white/70 border border-white/80 flex items-center justify-center shrink-0 shadow-sm">
                <Icon className="w-3.5 h-3.5 text-[#2563EB]" />
              </div>
              {label}
            </div>
          ))}
        </div>

        {/* Encart question */}
        <div className="mt-auto pt-2 hidden lg:block">
          <p className="text-xs text-slate-400 leading-relaxed">
            Une question ?{' '}
            <a
              href="mailto:support@qonforme.fr"
              className="text-[#2563EB] hover:underline font-medium"
            >
              Contacte notre support
            </a>
            {' '}— réponse sous 24h.
          </p>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════
          COLONNE DROITE — 2 cards côte à côte
      ══════════════════════════════════════════════════════════ */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

        {/* ── Card Starter ─────────────────────────────────────── */}
        <div className="relative flex flex-col bg-white/80 backdrop-blur-md rounded-2xl border border-white/70 shadow-[0_8px_32px_rgba(37,99,235,0.08)] p-6 hover:shadow-[0_12px_40px_rgba(37,99,235,0.13)] transition-all duration-200">

          {/* Header */}
          <div className="flex items-center gap-3 mb-5">
            <div className="w-10 h-10 rounded-xl bg-[#EFF6FF] flex items-center justify-center shrink-0">
              <Zap className="w-5 h-5 text-[#2563EB]" />
            </div>
            <div>
              <h3 className="text-base font-bold text-[#0F172A]">{PLANS.starter.name}</h3>
              <p className="text-xs text-slate-400">{PLANS.starter.description}</p>
            </div>
          </div>

          {/* Prix */}
          <div className="mb-5">
            <div className="flex items-baseline gap-1">
              <span className="text-4xl font-bold text-[#0F172A] font-mono">
                {starterPrice % 1 === 0 ? starterPrice : starterPrice.toFixed(2)}€
              </span>
              <span className="text-slate-400 text-sm">/mois HT</span>
            </div>
            {billingPeriod === 'yearly' && (
              <p className="text-xs text-slate-400 mt-1">
                Facturé {PLANS.starter.yearlyPrice} €/an
              </p>
            )}
          </div>

          {/* Séparateur */}
          <div className="h-px bg-[#F1F5F9] mb-5" />

          {/* Features */}
          <ul className="space-y-2.5 mb-6 flex-1">
            {PLANS.starter.features.map((feature) => (
              <li key={feature} className="flex items-start gap-2.5 text-sm text-slate-600">
                <div className="w-4 h-4 rounded-full bg-[#D1FAE5] flex items-center justify-center shrink-0 mt-0.5">
                  <Check className="w-2.5 h-2.5 text-[#10B981]" />
                </div>
                {feature}
              </li>
            ))}
          </ul>

          {/* CTA */}
          <button
            onClick={() => handleSelectPlan('starter')}
            disabled={loadingPlan !== null}
            className="w-full h-11 rounded-[10px] bg-[#0F172A] hover:bg-[#1E293B] active:scale-[0.98] text-white text-sm font-semibold transition-all flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {loadingPlan === 'starter'
              ? <><Loader2 className="w-4 h-4 animate-spin" />Chargement…</>
              : <><ArrowRight className="w-4 h-4" />Choisir Starter</>
            }
          </button>
        </div>

        {/* ── Card Pro — dark avec glow bleu ────────────────────── */}
        <div className="relative flex flex-col bg-[#0F172A] rounded-2xl shadow-[0_8px_40px_rgba(37,99,235,0.25)] p-6 overflow-hidden">

          {/* Badge recommandé */}
          <div className="absolute -top-px left-1/2 -translate-x-1/2">
            <span className="bg-gradient-to-r from-[#2563EB] to-[#7C3AED] text-white text-[11px] font-bold px-4 py-1 rounded-b-xl shadow-lg block">
              ✦ Recommandé
            </span>
          </div>

          {/* Trait lumineux haut */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-0 top-0 h-px"
            style={{ background: 'linear-gradient(90deg, transparent, rgba(37,99,235,0.6), rgba(124,58,237,0.6), transparent)' }}
          />

          {/* Header */}
          <div className="flex items-center gap-3 mt-5 mb-5">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#2563EB] to-[#7C3AED] flex items-center justify-center shrink-0">
              <Crown className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">{PLANS.pro.name}</h3>
              <p className="text-xs text-slate-400">{PLANS.pro.description}</p>
            </div>
          </div>

          {/* Prix */}
          <div className="mb-5">
            <div className="flex items-baseline gap-1">
              <span className="text-4xl font-bold text-white font-mono">
                {proPrice % 1 === 0 ? proPrice : proPrice.toFixed(2)}€
              </span>
              <span className="text-slate-400 text-sm">/mois HT</span>
            </div>
            {billingPeriod === 'yearly' && (
              <p className="text-xs text-slate-500 mt-1">
                Facturé {PLANS.pro.yearlyPrice} €/an
              </p>
            )}
          </div>

          {/* Séparateur */}
          <div className="h-px bg-white/10 mb-4" />

          {/* Tout ce qui est dans Starter */}
          <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-3">
            Tout le Starter, plus…
          </p>

          {/* Features Pro exclusives en avant */}
          <ul className="space-y-2.5 mb-3 flex-1">
            {PRO_EXCLUSIVE.map((feature) => (
              <li key={feature} className="flex items-start gap-2.5 text-sm text-white font-medium">
                <div className="w-4 h-4 rounded-full bg-[#2563EB]/30 flex items-center justify-center shrink-0 mt-0.5">
                  <Check className="w-2.5 h-2.5 text-[#60A5FA]" />
                </div>
                {feature}
              </li>
            ))}
          </ul>

          {/* Features communes (plus discrètes) */}
          <ul className="space-y-2 mb-6">
            {PLANS.pro.features
              .filter(f => STARTER_FEATURE_SET.has(f))
              .map((feature) => (
                <li key={feature} className="flex items-start gap-2.5 text-sm text-slate-400">
                  <div className="w-4 h-4 rounded-full bg-white/10 flex items-center justify-center shrink-0 mt-0.5">
                    <Check className="w-2.5 h-2.5 text-slate-500" />
                  </div>
                  {feature}
                </li>
              ))
            }
          </ul>

          {/* CTA */}
          <button
            onClick={() => handleSelectPlan('pro')}
            disabled={loadingPlan !== null}
            className="w-full h-11 rounded-[10px] bg-[#2563EB] hover:bg-[#1D4ED8] active:scale-[0.98] text-white text-sm font-semibold transition-all flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed shadow-[0_4px_14px_rgba(37,99,235,0.4)]"
          >
            {loadingPlan === 'pro'
              ? <><Loader2 className="w-4 h-4 animate-spin" />Chargement…</>
              : <><Crown className="w-4 h-4" />Choisir Pro</>
            }
          </button>
        </div>
      </div>

      {/* Encart question mobile uniquement */}
      <div className="lg:hidden text-center">
        <p className="text-xs text-slate-400">
          Une question ?{' '}
          <a href="mailto:support@qonforme.fr" className="text-[#2563EB] hover:underline font-medium">
            Contacte notre support
          </a>
          {' '}— réponse sous 24h.
        </p>
      </div>
    </div>
  )
}
