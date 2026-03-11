'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Check, Loader2, ShieldCheck, Clock, Award } from 'lucide-react'
import { PLANS, type PlanId, type BillingPeriod } from '@/lib/stripe/plans'

/* ─── Features exclusives Pro ────────────────────────────────────────────── */
const STARTER_SET = new Set(PLANS.starter.features)
const PRO_EXCLUSIVE = PLANS.pro.features.filter(f => !STARTER_SET.has(f))
const PRO_SHARED    = PLANS.pro.features.filter(f => STARTER_SET.has(f))

/* ─── Badges réassurance ─────────────────────────────────────────────────── */
const BADGES = [
  { icon: ShieldCheck, label: 'Paiement sécurisé Stripe' },
  { icon: Clock,       label: 'Résiliation à tout moment' },
  { icon: Award,       label: 'Conforme PPF · DGFiP' },
]

/* ─── Check icon ─────────────────────────────────────────────────────────── */
// dark = carte Pro (fond navy) · dim = feature partagée (estompée sur Pro)
// Par défaut (Starter) : check vert · Pro exclusif : check bleu · Pro dim : check gris
function CheckItem({ label, dim = false, dark = false }: { label: string; dim?: boolean; dark?: boolean }) {
  return (
    <li className={`flex items-start gap-3 text-sm leading-snug ${
      dark
        ? dim ? 'text-slate-500' : 'text-slate-200'
        : dim ? 'text-slate-400' : 'text-[#0F172A]'
    }`}>
      <span className={`mt-[3px] shrink-0 w-[18px] h-[18px] rounded-full flex items-center justify-center ${
        dark
          ? dim ? 'bg-white/8' : 'bg-[#2563EB]/25'
          : 'bg-[#D1FAE5]'
      }`}>
        <Check className={`w-2.5 h-2.5 ${
          dark
            ? dim ? 'text-slate-600' : 'text-[#60A5FA]'
            : 'text-[#059669]'
        }`} />
      </span>
      {label}
    </li>
  )
}

export default function PricingSelector() {
  const router = useRouter()
  const [period, setPeriod]       = useState<BillingPeriod>('monthly')
  const [loading, setLoading]     = useState<PlanId | null>(null)

  function select(planId: PlanId) {
    if (loading) return
    setLoading(planId)
    router.push(`/pricing/checkout?plan=${planId}&period=${period}`)
  }

  const sPrice = period === 'monthly' ? PLANS.starter.monthlyPrice           : PLANS.starter.yearlyMonthlyEquivalent
  const pPrice = period === 'monthly' ? PLANS.pro.monthlyPrice               : PLANS.pro.yearlyMonthlyEquivalent
  const fmt    = (n: number) => n % 1 === 0 ? `${n}` : n.toFixed(2)

  return (
    <div className="w-full grid grid-cols-1 lg:grid-cols-[300px_1fr] gap-8 lg:gap-12 items-start">

      {/* ══════════════════════════════════════════════════════
          GAUCHE — Pitch + toggle + réassurance
      ══════════════════════════════════════════════════════ */}
      <div className="flex flex-col gap-7">

        {/* Titre */}
        <div>
          <h1 className="text-[28px] font-bold text-[#0F172A] leading-tight tracking-tight mb-2">
            Choisis ton plan
          </h1>
          <p className="text-[15px] text-slate-500 leading-relaxed">
            Accès immédiat dès le paiement confirmé.
            <br className="hidden sm:block" />
            Résiliation à tout moment, sans engagement.
          </p>
        </div>

        {/* Toggle */}
        <div className="flex flex-col gap-3">
          <div className="inline-flex items-center gap-1 bg-white/70 backdrop-blur-sm border border-[#E2E8F0] rounded-full p-1 w-fit">
            {(['monthly', 'yearly'] as BillingPeriod[]).map((p) => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={`px-5 py-2 rounded-full text-sm font-semibold transition-all flex items-center gap-2 ${
                  period === p
                    ? 'bg-[#0F172A] text-white shadow-sm'
                    : 'text-slate-500 hover:text-[#0F172A]'
                }`}
              >
                {p === 'monthly' ? 'Mensuel' : 'Annuel'}
                {p === 'yearly' && (
                  <span className="text-[11px] font-bold px-1.5 py-0.5 rounded-full bg-[#D1FAE5] text-[#065F46]">
                    −16 %
                  </span>
                )}
              </button>
            ))}
          </div>

          {period === 'yearly' && (
            <p className="text-[13px] text-[#10B981] font-semibold">
              2 mois offerts · économise jusqu&apos;à 38 €/an
            </p>
          )}
        </div>

        {/* Réassurance */}
        <div className="flex flex-col gap-3">
          {BADGES.map(({ icon: Icon, label }) => (
            <div key={label} className="flex items-center gap-3 text-[13px] text-slate-600">
              <span className="w-8 h-8 rounded-xl bg-white/80 border border-[#E2E8F0] flex items-center justify-center shrink-0 shadow-sm">
                <Icon className="w-4 h-4 text-[#2563EB]" />
              </span>
              {label}
            </div>
          ))}
        </div>

        {/* Support */}
        <p className="text-[13px] text-slate-400 hidden lg:block">
          Une question ?{' '}
          <a href="mailto:support@qonforme.fr" className="text-[#2563EB] hover:underline font-medium">
            Contacte-nous
          </a>{' '}
          — réponse sous 24h.
        </p>
      </div>

      {/* ══════════════════════════════════════════════════════
          DROITE — 2 cards côte à côte
      ══════════════════════════════════════════════════════ */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 items-start">

        {/* ─────────────────── CARD STARTER ─────────────────── */}
        <div className="flex flex-col rounded-2xl bg-white/80 backdrop-blur-md border border-[#E2E8F0] shadow-[0_4px_24px_rgba(0,0,0,0.06)] p-7 hover:shadow-[0_8px_32px_rgba(37,99,235,0.10)] transition-shadow duration-200">

          {/* Plan name + tagline */}
          <div className="mb-1">
            <span className="text-[11px] font-bold uppercase tracking-[0.1em] text-[#2563EB]">
              Starter
            </span>
          </div>
          <p className="text-[13px] text-slate-400 mb-6">
            Pour démarrer et tester
          </p>

          {/* Prix */}
          <div className="mb-1 flex items-baseline gap-1">
            <span className="text-[42px] font-extrabold text-[#0F172A] leading-none font-mono tracking-tight">
              {fmt(sPrice)}€
            </span>
            <span className="text-slate-400 text-sm mb-0.5">/mois HT</span>
          </div>
          {period === 'yearly' && (
            <p className="text-xs text-slate-400 mb-6">
              Facturé {PLANS.starter.yearlyPrice} €/an
            </p>
          )}
          {period === 'monthly' && <div className="mb-6" />}

          {/* CTA */}
          <button
            onClick={() => select('starter')}
            disabled={loading !== null}
            className="w-full h-11 rounded-xl border-2 border-[#0F172A] bg-[#0F172A] hover:bg-[#1E293B] active:scale-[0.98] text-white text-sm font-bold transition-all flex items-center justify-center gap-2 mb-7 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading === 'starter'
              ? <><Loader2 className="w-4 h-4 animate-spin" />Chargement…</>
              : 'Commencer avec Starter'
            }
          </button>

          {/* Séparateur */}
          <div className="h-px bg-[#F1F5F9] mb-6" />

          {/* Features */}
          <ul className="flex flex-col gap-3">
            {PLANS.starter.features.map(f => (
              <CheckItem key={f} label={f} />
            ))}
          </ul>
        </div>

        {/* ─────────────────── CARD PRO ──────────────────────── */}
        <div className="relative flex flex-col rounded-2xl bg-[#0F172A] shadow-[0_8px_48px_rgba(37,99,235,0.22)] p-7 overflow-hidden">

          {/* Trait lumineux en haut */}
          <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-[1.5px]"
            style={{ background: 'linear-gradient(90deg, transparent 5%, #2563EB 40%, #3B82F6 60%, transparent 95%)' }}
          />

          {/* Badge recommandé — intégré dans la card, pas absolu */}
          <div className="mb-4">
            <span className="inline-flex items-center gap-1.5 text-[11px] font-bold text-white bg-[#2563EB] px-3 py-1 rounded-full">
              <span className="w-1.5 h-1.5 rounded-full bg-white/80 inline-block" />
              Recommandé
            </span>
          </div>

          {/* Plan name + tagline */}
          <div className="mb-1">
            <span className="text-[11px] font-bold uppercase tracking-[0.1em] text-[#60A5FA]">
              Pro
            </span>
          </div>
          <p className="text-[13px] text-slate-400 mb-6">
            Pour les pros sans limites
          </p>

          {/* Prix */}
          <div className="mb-1 flex items-baseline gap-1">
            <span className="text-[42px] font-extrabold text-white leading-none font-mono tracking-tight">
              {fmt(pPrice)}€
            </span>
            <span className="text-slate-400 text-sm mb-0.5">/mois HT</span>
          </div>
          {period === 'yearly' && (
            <p className="text-xs text-slate-500 mb-6">
              Facturé {PLANS.pro.yearlyPrice} €/an
            </p>
          )}
          {period === 'monthly' && <div className="mb-6" />}

          {/* CTA */}
          <button
            onClick={() => select('pro')}
            disabled={loading !== null}
            className="w-full h-11 rounded-xl bg-[#2563EB] hover:bg-[#1D4ED8] active:scale-[0.98] text-white text-sm font-bold transition-all flex items-center justify-center gap-2 mb-7 disabled:opacity-50 disabled:cursor-not-allowed shadow-[0_4px_16px_rgba(37,99,235,0.45)]"
          >
            {loading === 'pro'
              ? <><Loader2 className="w-4 h-4 animate-spin" />Chargement…</>
              : 'Commencer avec Pro'
            }
          </button>

          {/* Séparateur */}
          <div className="h-px bg-white/10 mb-5" />

          {/* Features exclusives Pro */}
          <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-slate-500 mb-3">
            Tout Starter, plus…
          </p>
          <ul className="flex flex-col gap-3 mb-5">
            {PRO_EXCLUSIVE.map(f => (
              <CheckItem key={f} label={f} dark />
            ))}
          </ul>

          {/* Features communes */}
          <ul className="flex flex-col gap-2.5">
            {PRO_SHARED.map(f => (
              <CheckItem key={f} label={f} dark dim />
            ))}
          </ul>
        </div>
      </div>

      {/* Support mobile */}
      <p className="lg:hidden text-center text-[13px] text-slate-400">
        Une question ?{' '}
        <a href="mailto:support@qonforme.fr" className="text-[#2563EB] hover:underline font-medium">
          Contacte-nous
        </a>
      </p>
    </div>
  )
}
