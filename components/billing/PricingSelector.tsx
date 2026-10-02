'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, Check, Clock, ShieldCheck } from 'lucide-react'
import {
  PLANS,
  FREE_FEATURES,
  formatEuros,
  withVat,
  type BillingPeriod,
} from '@/lib/stripe/plans'
import { GUARANTEE_DAYS } from '@/lib/stripe/access'
import { trackEvent } from '@/lib/meta-pixel'

/**
 * Grille des formules — page Tarifs (visiteur) et choix de formule (connecté).
 *
 * Trois colonnes : Devis (gratuit), Essentiel, Artisan. Artisan reste affiché
 * « bientôt disponible » tant que ses fonctions ne sont pas livrées
 * (PLANS.pro.available) : on ne vend pas ce qui n'existe pas.
 */
export default function PricingSelector({
  isAuthenticated = false,
  backHref,
  next = null,
  showFree = true,
}: {
  isAuthenticated?: boolean
  /** Colonne « Devis » gratuite — masquée pour un compte qui l'a déjà et vient choisir sa formule. */
  showFree?: boolean
  /** Lien « retour » affiché au-dessus de la grille (absent sur la page Tarifs). */
  backHref?: string
  /** Chemin interne où revenir après le paiement (ex. la facture à envoyer). */
  next?: string | null
}) {
  const [period, setPeriod] = useState<BillingPeriod>('yearly')
  const essentiel = PLANS.starter
  const artisan = PLANS.pro

  const checkoutHref = (plan: 'starter' | 'pro') => {
    const params = new URLSearchParams({ plan, period })
    if (next) params.set('next', next)
    return `/pricing/checkout?${params.toString()}`
  }

  const onChoose = () => {
    trackEvent('InitiateCheckout', {
      currency: 'EUR',
      value: period === 'monthly' ? essentiel.monthlyPrice : essentiel.yearlyPrice,
      content_name: essentiel.name,
      content_ids: [essentiel.id],
      num_items: 1,
    })
  }

  return (
    <div className="w-full flex flex-col gap-8">
      {backHref && (
        <Link
          href={backHref}
          className="inline-flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-[#0F172A] transition-colors w-fit min-h-[44px]"
        >
          <ArrowLeft className="w-4 h-4" />
          Retour
        </Link>
      )}

      {/* Mensuel / annuel */}
      <div className="flex justify-center">
        <div role="radiogroup" aria-label="Période de facturation" className="inline-flex items-center gap-1 rounded-full border border-[#E2E8F0] bg-white p-1">
          {(['monthly', 'yearly'] as BillingPeriod[]).map((p) => (
            <button
              key={p}
              type="button"
              role="radio"
              aria-checked={period === p}
              onClick={() => setPeriod(p)}
              className={`inline-flex items-center gap-2 h-10 px-5 rounded-full text-sm font-semibold transition-colors ${
                period === p ? 'bg-[#0F172A] text-white' : 'text-slate-500 hover:text-[#0F172A]'
              }`}
            >
              {p === 'monthly' ? 'Mensuel' : 'Annuel'}
              {p === 'yearly' && (
                <span className={`text-[11px] font-bold px-1.5 py-0.5 rounded-full ${period === p ? 'bg-white/15 text-white' : 'bg-[#D1FAE5] text-[#065F46]'}`}>
                  2 mois offerts
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      <div className={`grid grid-cols-1 gap-4 lg:gap-5 items-stretch ${showFree ? 'lg:grid-cols-3' : 'lg:grid-cols-2 w-full max-w-3xl mx-auto'}`}>
        {/* ── Devis : gratuit ─────────────────────────────────────────── */}
        {showFree && (
        <section aria-labelledby="plan-devis" className="flex flex-col rounded-2xl border border-[#E2E8F0] bg-white p-6">
          <h2 id="plan-devis" className="text-lg font-semibold text-[#0F172A]">Devis</h2>
          <p className="text-sm text-slate-500 mt-1">Pour démarrer et décrocher vos chantiers.</p>
          <p className="mt-5 flex items-baseline gap-1.5">
            <span className="text-4xl font-bold tracking-tight text-[#0F172A]">0 €</span>
            <span className="text-sm text-slate-500">pour toujours</span>
          </p>
          <p className="text-[13px] text-slate-500 mt-1">Sans carte bancaire</p>
          <Link
            href={isAuthenticated ? '/quotes/new' : '/signup'}
            className="mt-5 inline-flex h-11 items-center justify-center rounded-xl border border-[#CBD5E1] bg-white text-sm font-semibold text-[#0F172A] hover:border-[#94A3B8] transition-colors"
          >
            {isAuthenticated ? 'Faire un devis' : 'Créer mon premier devis'}
          </Link>
          <FeatureList items={FREE_FEATURES} />
        </section>
        )}

        {/* ── Essentiel ──────────────────────────────────────────────── */}
        <section aria-labelledby="plan-essentiel" className="relative flex flex-col rounded-2xl border-2 border-[#2563EB] bg-white p-6 shadow-[0_12px_32px_-20px_rgba(37,99,235,0.45)]">
          <span className="absolute -top-3 left-6 rounded-full bg-[#2563EB] px-2.5 py-1 text-[11px] font-bold text-white">Conseillé</span>
          <h2 id="plan-essentiel" className="text-lg font-semibold text-[#0F172A]">{essentiel.name}</h2>
          <p className="text-sm text-slate-500 mt-1">{essentiel.tagline}</p>
          <PriceBlock monthly={essentiel.monthlyPrice} yearly={essentiel.yearlyPrice} perMonthYearly={essentiel.yearlyMonthlyEquivalent} period={period} />
          {isAuthenticated ? (
            <Link
              href={checkoutHref('starter')}
              onClick={onChoose}
              className="mt-5 inline-flex h-11 items-center justify-center rounded-xl bg-[#2563EB] text-sm font-semibold text-white hover:bg-[#1D4ED8] transition-colors"
            >
              Choisir {essentiel.name}
            </Link>
          ) : (
            <Link
              href="/signup"
              className="mt-5 inline-flex h-11 items-center justify-center rounded-xl bg-[#2563EB] text-sm font-semibold text-white hover:bg-[#1D4ED8] transition-colors"
            >
              Commencer gratuitement
            </Link>
          )}
          <p className="text-[12px] text-slate-500 mt-2 text-center">
            {isAuthenticated ? 'Carte bancaire ou prélèvement SEPA' : 'La formule se choisit à votre première facture'}
          </p>
          <FeatureList items={essentiel.features} />
          <UpcomingList items={essentiel.upcoming} />
        </section>

        {/* ── Artisan : bientôt ──────────────────────────────────────── */}
        <section aria-labelledby="plan-artisan" className="flex flex-col rounded-2xl border border-[#E2E8F0] bg-[#F8FAFC] p-6">
          <div className="flex items-center gap-2">
            <h2 id="plan-artisan" className="text-lg font-semibold text-[#0F172A]">{artisan.name}</h2>
            <span className="rounded-full bg-[#E2E8F0] px-2 py-0.5 text-[11px] font-semibold text-slate-600">Bientôt</span>
          </div>
          <p className="text-sm text-slate-500 mt-1">{artisan.tagline}</p>
          <PriceBlock monthly={artisan.monthlyPrice} yearly={artisan.yearlyPrice} perMonthYearly={artisan.yearlyMonthlyEquivalent} period={period} muted />
          <button
            type="button"
            disabled
            className="mt-5 inline-flex h-11 items-center justify-center rounded-xl border border-[#E2E8F0] bg-white text-sm font-semibold text-slate-400 cursor-not-allowed"
          >
            Bientôt disponible
          </button>
          <p className="text-[12px] text-slate-500 mt-2 text-center">Tout {essentiel.name}, plus :</p>
          <UpcomingList items={artisan.upcoming} title="En préparation" />
        </section>
      </div>

      <div className="flex flex-col sm:flex-row flex-wrap items-center justify-center gap-x-6 gap-y-2 text-[13px] text-slate-500">
        <span className="inline-flex items-center gap-1.5"><ShieldCheck className="w-4 h-4 text-[#059669]" />Satisfait ou remboursé {GUARANTEE_DAYS} jours</span>
        <span>Sans engagement</span>
        <span>Prix hors taxes, TVA 20 % en sus</span>
        <span>Vos factures restent consultables après résiliation</span>
      </div>
    </div>
  )
}

function PriceBlock({
  monthly,
  yearly,
  perMonthYearly,
  period,
  muted = false,
}: {
  monthly: number
  yearly: number
  perMonthYearly: number
  period: BillingPeriod
  muted?: boolean
}) {
  const perMonth = period === 'monthly' ? monthly : perMonthYearly
  return (
    <>
      <p className="mt-5 flex items-baseline gap-1.5">
        <span className={`text-4xl font-bold tracking-tight ${muted ? 'text-slate-500' : 'text-[#0F172A]'}`}>{formatEuros(perMonth)}</span>
        <span className="text-sm text-slate-500">HT / mois</span>
      </p>
      <p className="text-[13px] text-slate-500 mt-1">
        {period === 'monthly'
          ? `soit ${formatEuros(withVat(monthly))} TTC par mois`
          : `${formatEuros(yearly)} HT par an, soit ${formatEuros(withVat(yearly))} TTC`}
      </p>
    </>
  )
}

function FeatureList({ items }: { items: string[] }) {
  if (items.length === 0) return null
  return (
    <ul className="mt-6 flex flex-col gap-2.5">
      {items.map((item) => (
        <li key={item} className="flex items-start gap-2.5 text-sm text-[#0F172A] leading-snug">
          <Check className="w-4 h-4 mt-0.5 shrink-0 text-[#059669]" aria-hidden />
          {item}
        </li>
      ))}
    </ul>
  )
}

function UpcomingList({ items, title = 'À venir' }: { items: string[]; title?: string }) {
  if (items.length === 0) return null
  return (
    <div className="mt-5 border-t border-[#E2E8F0] pt-4">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400 mb-2.5">{title}</p>
      <ul className="flex flex-col gap-2.5">
        {items.map((item) => (
          <li key={item} className="flex items-start gap-2.5 text-sm text-slate-500 leading-snug">
            <Clock className="w-4 h-4 mt-0.5 shrink-0 text-slate-400" aria-hidden />
            {item}
          </li>
        ))}
      </ul>
    </div>
  )
}
