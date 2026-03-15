'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Check, Loader2, ShieldCheck, Clock, Award } from 'lucide-react'
import { PLANS, type PlanId, type BillingPeriod } from '@/lib/stripe/plans'

/* ─── Data ───────────────────────────────────────────────────────────────── */
const STARTER_SET   = new Set(PLANS.starter.features)
const PRO_EXCLUSIVE = PLANS.pro.features.filter(f => !STARTER_SET.has(f))
const PRO_SHARED    = PLANS.pro.features.filter(f => STARTER_SET.has(f))

const BADGES = [
  { icon: ShieldCheck, label: 'Paiement sécurisé Stripe' },
  { icon: Clock,       label: 'Résiliation à tout moment' },
  { icon: Award,       label: 'Conforme PPF · DGFiP' },
]

/* ─── CheckItem ─────────────────────────────────────────────────────────── */
function CheckItem({
  label,
  dim  = false,
  dark = false,
}: {
  label: string
  dim?:  boolean
  dark?: boolean
}) {
  return (
    <li className={`flex items-start gap-3 text-sm leading-snug ${
      dark
        ? dim ? 'text-white/40' : 'text-white/85'
        : 'text-[#0F172A]'
    }`}>
      <span className="mt-[3px] shrink-0 w-[18px] h-[18px] rounded-full flex items-center justify-center bg-[#D1FAE5]">
        <Check className="w-2.5 h-2.5 text-[#059669]" />
      </span>
      {label}
    </li>
  )
}

/* ─── PricingSelector ───────────────────────────────────────────────────── */
export default function PricingSelector() {
  const router = useRouter()

  const [period,     setPeriod]     = useState<BillingPeriod>('monthly')
  const [activePlan, setActivePlan] = useState<PlanId>('pro')   // Pro mis en avant par défaut
  const [loading,    setLoading]    = useState<PlanId | null>(null)

  function select(planId: PlanId) {
    if (loading) return
    setLoading(planId)
    router.push(`/pricing/checkout?plan=${planId}&period=${period}`)
  }

  const sPrice = period === 'monthly' ? PLANS.starter.monthlyPrice            : PLANS.starter.yearlyMonthlyEquivalent
  const pPrice = period === 'monthly' ? PLANS.pro.monthlyPrice                : PLANS.pro.yearlyMonthlyEquivalent
  const fmt    = (n: number) => n % 1 === 0 ? `${n}` : n.toFixed(2)

  const isPro = activePlan === 'pro'

  /* ── Prix & features du plan actif ────────────────────────────────────── */
  const activePrice    = isPro ? pPrice : sPrice
  const activeFeatures = isPro
    ? { exclusive: PRO_EXCLUSIVE, shared: PRO_SHARED }
    : { exclusive: PLANS.starter.features, shared: [] }

  /* ══════════════════════════════════════════════════════════════════════════
     RENDER
  ══════════════════════════════════════════════════════════════════════════ */
  return (
    <>
      {/* ════════════════════════════════════════════════════════════════════
          LAYOUT DESKTOP (≥ 1024 px) — grille 2 colonnes, inchangée
      ════════════════════════════════════════════════════════════════════ */}
      <div className="hidden lg:grid lg:grid-cols-[300px_1fr] gap-12 items-start w-full">

        {/* Gauche */}
        <div className="flex flex-col gap-7">
          <div>
            <h1 className="text-[28px] font-bold text-[#0F172A] leading-tight tracking-tight mb-2">
              Choisis ton plan
            </h1>
            <p className="text-[15px] text-slate-500 leading-relaxed">
              Factur-X certifié EN 16931 inclus dans les deux plans.<br />
              Résiliation à tout moment, sans engagement.
            </p>
          </div>

          {/* Toggle mensuel / annuel */}
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

          {/* Badges réassurance */}
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

          <p className="text-[13px] text-slate-400">
            Une question ?{' '}
            <a href="mailto:support@qonforme.fr" className="text-[#2563EB] hover:underline font-medium">
              Contacte-nous
            </a>{' '}
            — réponse sous 24h.
          </p>
        </div>

        {/* Droite — 2 cards */}
        <div className="grid grid-cols-2 gap-5 items-start">

          {/* Card Starter */}
          <div className="flex flex-col rounded-2xl bg-white/80 backdrop-blur-md border border-[#E2E8F0] shadow-[0_4px_24px_rgba(0,0,0,0.06)] p-7 hover:shadow-[0_8px_32px_rgba(37,99,235,0.10)] transition-shadow duration-200">
            <span className="text-[11px] font-bold uppercase tracking-[0.1em] text-[#2563EB] mb-1">Starter</span>
            <p className="text-[13px] text-slate-400 mb-6">Pour démarrer et tester</p>
            <div className="flex items-baseline gap-1 mb-1">
              <span className="text-[42px] font-extrabold text-[#0F172A] leading-none font-mono tracking-tight">
                {fmt(sPrice)}€
              </span>
              <span className="text-slate-400 text-sm">/mois HT</span>
            </div>
            {period === 'yearly'
              ? <p className="text-xs text-slate-400 mb-6">Facturé {PLANS.starter.yearlyPrice} €/an</p>
              : <div className="mb-6" />
            }
            <button
              onClick={() => select('starter')}
              disabled={loading !== null}
              className="w-full h-11 rounded-xl border-2 border-[#0F172A] bg-[#0F172A] hover:bg-[#1E293B] active:scale-[0.98] text-white text-sm font-bold transition-all flex items-center justify-center gap-2 mb-7 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading === 'starter' ? <><Loader2 className="w-4 h-4 animate-spin" />Chargement…</> : 'Commencer avec Starter'}
            </button>
            <div className="h-px bg-[#F1F5F9] mb-6" />
            <ul className="flex flex-col gap-3">
              {PLANS.starter.features.map(f => <CheckItem key={f} label={f} />)}
            </ul>
          </div>

          {/* Card Pro */}
          <div className="relative flex flex-col rounded-2xl bg-[#0F172A] shadow-[0_8px_48px_rgba(37,99,235,0.22)] p-7 overflow-hidden">
            <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-[1.5px]"
              style={{ background: 'linear-gradient(90deg, transparent 5%, #2563EB 40%, #3B82F6 60%, transparent 95%)' }}
            />
            <div className="mb-4">
              <span className="inline-flex items-center gap-1.5 text-[11px] font-bold text-white bg-[#2563EB] px-3 py-1 rounded-full">
                <span className="w-1.5 h-1.5 rounded-full bg-white/80 inline-block" />
                Recommandé
              </span>
            </div>
            <span className="text-[11px] font-bold uppercase tracking-[0.1em] text-[#60A5FA] mb-1">Pro</span>
            <p className="text-[13px] text-slate-400 mb-6">Pour les pros sans limites</p>
            <div className="flex items-baseline gap-1 mb-1">
              <span className="text-[42px] font-extrabold text-white leading-none font-mono tracking-tight">
                {fmt(pPrice)}€
              </span>
              <span className="text-slate-400 text-sm">/mois HT</span>
            </div>
            {period === 'yearly'
              ? <p className="text-xs text-slate-500 mb-6">Facturé {PLANS.pro.yearlyPrice} €/an</p>
              : <div className="mb-6" />
            }
            <button
              onClick={() => select('pro')}
              disabled={loading !== null}
              className="w-full h-11 rounded-xl bg-[#2563EB] hover:bg-[#1D4ED8] active:scale-[0.98] text-white text-sm font-bold transition-all flex items-center justify-center gap-2 mb-7 disabled:opacity-50 disabled:cursor-not-allowed shadow-[0_4px_16px_rgba(37,99,235,0.45)]"
            >
              {loading === 'pro' ? <><Loader2 className="w-4 h-4 animate-spin" />Chargement…</> : 'Commencer avec Pro'}
            </button>
            <div className="h-px bg-white/10 mb-5" />
            <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-slate-500 mb-3">Tout Starter, plus…</p>
            <ul className="flex flex-col gap-3 mb-5">
              {PRO_EXCLUSIVE.map(f => <CheckItem key={f} label={f} dark />)}
            </ul>
            <ul className="flex flex-col gap-2.5">
              {PRO_SHARED.map(f => <CheckItem key={f} label={f} dark dim />)}
            </ul>
          </div>
        </div>
      </div>

      {/* ════════════════════════════════════════════════════════════════════
          LAYOUT MOBILE (< 1024 px) — tab switcher + CTA sticky
          Architecture :
          • Header sticky : toggle Mensuel/Annuel + tabs Starter/Pro
          • Contenu scrollable : prix + features du plan actif
          • Footer sticky : bouton CTA + badges réassurance compacts
      ════════════════════════════════════════════════════════════════════ */}
      <div className="lg:hidden flex flex-col min-h-[calc(100dvh-140px)]">

        {/* ── Titre + sous-titre ────────────────────────────────────────── */}
        <div className="text-center mb-5">
          <h1 className="text-[22px] font-bold text-[#0F172A] leading-tight tracking-tight mb-1">
            Choisis ton plan
          </h1>
          <p className="text-[14px] text-slate-500 leading-snug">
            Factur-X EN 16931 inclus · Résiliation à tout moment
          </p>
        </div>

        {/* ── Toggle Mensuel / Annuel ───────────────────────────────────── */}
        <div className="flex items-center justify-center gap-3 mb-4">
          <div className="inline-flex items-center gap-0.5 bg-white/70 backdrop-blur-sm border border-[#E2E8F0] rounded-full p-1">
            {(['monthly', 'yearly'] as BillingPeriod[]).map((p) => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={`px-4 py-1.5 rounded-full text-[13px] font-semibold transition-all flex items-center gap-1.5 ${
                  period === p
                    ? 'bg-[#0F172A] text-white shadow-sm'
                    : 'text-slate-500'
                }`}
              >
                {p === 'monthly' ? 'Mensuel' : 'Annuel'}
                {p === 'yearly' && (
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-[#D1FAE5] text-[#065F46]">
                    −16 %
                  </span>
                )}
              </button>
            ))}
          </div>
          {period === 'yearly' && (
            <span className="text-[12px] text-[#10B981] font-semibold">2 mois offerts</span>
          )}
        </div>

        {/* ── Tabs Starter / Pro ────────────────────────────────────────── */}
        <div className="flex rounded-2xl bg-white/60 backdrop-blur-sm border border-[#E2E8F0] p-1 mb-5">
          {(['starter', 'pro'] as PlanId[]).map((planId) => {
            const isActive = activePlan === planId
            const isPlanPro = planId === 'pro'
            return (
              <button
                key={planId}
                onClick={() => setActivePlan(planId)}
                className={`relative flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-bold transition-all duration-200 ${
                  isActive
                    ? isPlanPro
                      ? 'bg-[#0F172A] text-white shadow-sm'
                      : 'bg-white text-[#0F172A] shadow-sm border border-[#E2E8F0]'
                    : 'text-slate-400'
                }`}
              >
                {isPlanPro && isActive && (
                  <span className="w-1.5 h-1.5 rounded-full bg-[#2563EB] inline-block" />
                )}
                {planId === 'starter' ? 'Starter' : 'Pro'}
                {isPlanPro && !isActive && (
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-[#EFF6FF] text-[#2563EB]">
                    Recommandé
                  </span>
                )}
              </button>
            )
          })}
        </div>

        {/* ── Contenu du plan actif (scrollable) ───────────────────────── */}
        <div className={`flex-1 rounded-2xl p-6 mb-4 ${
          isPro
            ? 'bg-[#0F172A] relative overflow-hidden'
            : 'bg-white/80 backdrop-blur-md border border-[#E2E8F0] shadow-[0_4px_24px_rgba(0,0,0,0.06)]'
        }`}>

          {/* Trait lumineux Pro */}
          {isPro && (
            <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-[1.5px]"
              style={{ background: 'linear-gradient(90deg, transparent 5%, #2563EB 40%, #3B82F6 60%, transparent 95%)' }}
            />
          )}

          {/* Badge Recommandé (Pro seulement) */}
          {isPro && (
            <div className="mb-3">
              <span className="inline-flex items-center gap-1.5 text-[11px] font-bold text-white bg-[#2563EB] px-2.5 py-1 rounded-full">
                <span className="w-1.5 h-1.5 rounded-full bg-white/80 inline-block" />
                Recommandé
              </span>
            </div>
          )}

          {/* Plan name */}
          <span className={`text-[11px] font-bold uppercase tracking-[0.12em] block mb-0.5 ${
            isPro ? 'text-[#60A5FA]' : 'text-[#2563EB]'
          }`}>
            {isPro ? 'Pro' : 'Starter'}
          </span>
          <p className={`text-[13px] mb-5 ${isPro ? 'text-white/50' : 'text-slate-400'}`}>
            {isPro ? 'Pour les pros sans limites' : 'Pour démarrer et tester'}
          </p>

          {/* Prix */}
          <div className="flex items-baseline gap-1.5 mb-1">
            <span className={`text-[48px] font-extrabold font-mono leading-none tracking-tight ${
              isPro ? 'text-white' : 'text-[#0F172A]'
            }`}>
              {fmt(activePrice)}€
            </span>
            <span className={`text-sm ${isPro ? 'text-white/40' : 'text-slate-400'}`}>/mois HT</span>
          </div>
          {period === 'yearly' && (
            <p className={`text-xs mb-5 ${isPro ? 'text-white/40' : 'text-slate-400'}`}>
              Facturé {isPro ? PLANS.pro.yearlyPrice : PLANS.starter.yearlyPrice} €/an · 2 mois offerts
            </p>
          )}
          {period === 'monthly' && <div className="mb-5" />}

          {/* Séparateur */}
          <div className={`h-px mb-5 ${isPro ? 'bg-white/10' : 'bg-[#F1F5F9]'}`} />

          {/* Features */}
          {isPro ? (
            <>
              <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-white/30 mb-3">
                Tout Starter, plus…
              </p>
              <ul className="flex flex-col gap-3 mb-4">
                {activeFeatures.exclusive.map(f => <CheckItem key={f} label={f} dark />)}
              </ul>
              <ul className="flex flex-col gap-2.5">
                {activeFeatures.shared.map(f => <CheckItem key={f} label={f} dark dim />)}
              </ul>
            </>
          ) : (
            <ul className="flex flex-col gap-3">
              {activeFeatures.exclusive.map(f => <CheckItem key={f} label={f} />)}
            </ul>
          )}
        </div>

        {/* ── CTA sticky (bas de page) ──────────────────────────────────── */}
        <div className="sticky bottom-0 left-0 right-0 z-20 pb-[env(safe-area-inset-bottom,16px)] pt-3"
          style={{ background: 'linear-gradient(to top, rgba(239,246,255,0.98) 70%, transparent)' }}
        >
          {/* Bouton principal */}
          <button
            onClick={() => select(activePlan)}
            disabled={loading !== null}
            className={`w-full h-14 rounded-2xl text-[15px] font-bold transition-all active:scale-[0.98] flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed ${
              isPro
                ? 'bg-[#2563EB] hover:bg-[#1D4ED8] text-white shadow-[0_4px_20px_rgba(37,99,235,0.40)]'
                : 'bg-[#0F172A] hover:bg-[#1E293B] text-white'
            }`}
          >
            {loading === activePlan
              ? <><Loader2 className="w-5 h-5 animate-spin" />Chargement…</>
              : `Commencer avec ${isPro ? 'Pro' : 'Starter'}`
            }
          </button>

          {/* Badges réassurance condensés */}
          <div className="flex items-center justify-center gap-4 mt-3">
            {BADGES.map(({ icon: Icon, label }) => (
              <div key={label} className="flex items-center gap-1 text-[11px] text-slate-400">
                <Icon className="w-3 h-3 text-[#2563EB] shrink-0" />
                <span className="hidden xs:inline">{label}</span>
              </div>
            ))}
          </div>

          {/* Lien support */}
          <p className="text-center text-[12px] text-slate-400 mt-2">
            Une question ?{' '}
            <a href="mailto:support@qonforme.fr" className="text-[#2563EB] font-medium">
              Contacte-nous
            </a>
          </p>
        </div>
      </div>
    </>
  )
}
