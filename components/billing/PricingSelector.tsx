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
  type Plan,
} from '@/lib/stripe/plans'
import { GUARANTEE_DAYS } from '@/lib/stripe/access'
import { trackEvent } from '@/lib/meta-pixel'
import { cn } from '@/lib/utils'

/**
 * Grille des formules — page Tarifs (visiteur), aperçu de l'accueil et choix
 * de formule (connecté), d'après la planche « Tarifs » du canevas.
 *
 * Trois cartes : Devis (gratuit), Essentiel, Artisan. Les fonctions d'Artisan
 * sont livrées ; la formule reste « bientôt » tant que ses prix Stripe ne sont
 * pas configurés (PLANS.pro.available) : aucun bouton de paiement, un lien
 * vers la démo pour essayer ses fonctions.
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

  const checkoutHref = (plan: Plan) => {
    const params = new URLSearchParams({ plan: plan.id, period })
    if (next) params.set('next', next)
    return `/pricing/checkout?${params.toString()}`
  }

  const onChoose = (plan: Plan) => {
    trackEvent('InitiateCheckout', {
      currency: 'EUR',
      value: period === 'monthly' ? plan.monthlyPrice : plan.yearlyPrice,
      content_name: plan.name,
      content_ids: [plan.id],
      num_items: 1,
    })
  }

  return (
    <div className="flex w-full flex-col gap-8">
      {backHref && (
        <Link
          href={backHref}
          className="inline-flex min-h-[44px] w-fit items-center gap-2 text-sm font-medium text-q-text-3 transition-colors hover:text-q-ink"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden />
          Retour
        </Link>
      )}

      {/* Mensuel / annuel */}
      <div className="flex justify-center">
        <div
          role="group"
          aria-label="Période de facturation"
          className="inline-flex items-center gap-0.5 rounded-xl bg-[var(--q-seg-bg)] p-1"
        >
          {(['monthly', 'yearly'] as BillingPeriod[]).map((p) => (
            <button
              key={p}
              type="button"
              aria-pressed={period === p}
              onClick={() => setPeriod(p)}
              className={cn(
                'inline-flex h-10 items-center gap-2 rounded-[9px] px-4 text-sm font-semibold transition-colors',
                period === p
                  ? 'bg-q-surface text-q-ink shadow-[0_1px_3px_rgba(10,17,34,.12)]'
                  : 'text-q-text-3 hover:text-q-ink',
              )}
            >
              {p === 'monthly' ? 'Mensuel' : 'Annuel'}
              {p === 'yearly' && (
                <span className="rounded-full bg-q-ok-bg px-2 py-0.5 text-xs font-semibold text-q-ok">
                  2 mois offerts
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      <div
        className={cn(
          'grid grid-cols-1 items-stretch gap-4',
          showFree ? 'lg:grid-cols-3' : 'mx-auto w-full max-w-[820px] md:grid-cols-2',
        )}
      >
        {/* ── Devis : gratuit ─────────────────────────────────────────── */}
        {showFree && (
          <PlanCard id="plan-devis" name="Devis" tagline="Pour démarrer et décrocher vos chantiers.">
            <div className="flex items-baseline gap-1.5">
              <Amount>{eur(0)}</Amount>
              <span className="text-sm text-q-text-3">pour toujours</span>
            </div>
            <Link
              href={isAuthenticated ? '/quotes/new' : '/signup'}
              className="q-btn q-btn-secondary h-11 w-full text-[15px]"
            >
              {isAuthenticated ? 'Faire un devis' : 'Créer mon premier devis'}
            </Link>
            <FeatureList items={[...FREE_FEATURES, 'Envoi des devis par email, avec le PDF']} />
          </PlanCard>
        )}

        {/* ── Essentiel : seule formule vendue ───────────────────────── */}
        <PlanCard id="plan-essentiel" name={essentiel.name} tagline={essentiel.tagline}>
          <PriceBlock plan={essentiel} period={period} />
          <div className="flex flex-col gap-2">
            {essentiel.available ? (
              isAuthenticated ? (
                <Link
                  href={checkoutHref(essentiel)}
                  onClick={() => onChoose(essentiel)}
                  className="q-btn q-btn-primary h-11 w-full text-[15px]"
                >
                  Choisir {essentiel.name}
                </Link>
              ) : (
                <Link href="/signup" className="q-btn q-btn-primary h-11 w-full text-[15px]">
                  Commencer gratuitement
                </Link>
              )
            ) : (
              <SoonButton />
            )}
            <p className="text-center text-xs text-q-text-4">
              {isAuthenticated ? 'Carte bancaire ou prélèvement SEPA' : 'La formule se choisit à votre première facture'}
            </p>
          </div>
          <FeatureList items={essentiel.features} />
          <UpcomingList items={essentiel.upcoming} />
        </PlanCard>

        {/* ── Artisan : carte encre, bientôt ─────────────────────────── */}
        <PlanCard
          id="plan-artisan"
          name={artisan.name}
          tagline={artisan.tagline}
          ink
          badge={artisan.available ? undefined : 'Bientôt'}
        >
          <PriceBlock plan={artisan} period={period} ink />
          {artisan.available ? (
            <Link
              href={isAuthenticated ? checkoutHref(artisan) : '/signup'}
              onClick={isAuthenticated ? () => onChoose(artisan) : undefined}
              className="q-btn q-btn-primary h-11 w-full text-[15px]"
            >
              {isAuthenticated ? `Choisir ${artisan.name}` : 'Commencer gratuitement'}
            </Link>
          ) : (
            <SoonButton ink />
          )}
          <div className="flex flex-col gap-[11px]">
            <p className="flex gap-2.5 text-sm font-semibold text-white">
              <Check className="mt-px h-[18px] w-[18px] shrink-0 text-[#7FA6FF]" strokeWidth={2.25} aria-hidden />
              Tout {essentiel.name}, plus :
            </p>
            <FeatureList items={artisan.features} ink />
            <UpcomingList items={artisan.upcoming} ink bare />
          </div>
          {!artisan.available && (
            <p className="text-[13px] leading-relaxed text-[#94A3B8]">
              Ces fonctions sont prêtes : essayez-les dans la{' '}
              <Link href="/demo/chantiers" className="font-semibold text-white underline underline-offset-2">démo</Link>.
              La formule n&apos;est pas encore en vente.
            </p>
          )}
        </PlanCard>
      </div>

      <ul className="flex flex-col flex-wrap items-center justify-center gap-x-6 gap-y-2 text-[13px] text-q-text-3 sm:flex-row">
        <li className="inline-flex items-center gap-1.5">
          <ShieldCheck className="h-4 w-4 text-q-ok" aria-hidden />
          Satisfait ou remboursé {GUARANTEE_DAYS}&nbsp;jours
        </li>
        <li>Sans engagement</li>
        <li>Prix hors taxes, TVA 20&nbsp;% en sus</li>
        <li>Vos factures restent consultables après résiliation</li>
      </ul>
    </div>
  )
}

/** « 10 € » avec une espace insécable avant le symbole. */
function eur(amount: number): string {
  return formatEuros(amount).replace(/ €$/, ' €')
}

function PlanCard({
  id,
  name,
  tagline,
  ink = false,
  badge,
  children,
}: {
  id: string
  name: string
  tagline: string
  /** Carte encre (#0A1122), identique dans les deux thèmes. */
  ink?: boolean
  badge?: string
  children: React.ReactNode
}) {
  return (
    <section
      aria-labelledby={id}
      className={cn(
        'relative flex flex-col gap-5 overflow-hidden rounded-[20px] p-6 sm:p-7',
        ink
          ? 'q-on-ink border border-[#0A1122] bg-[#0A1122] text-[#E2E8F0] shadow-[0_30px_60px_-30px_rgba(10,17,34,.6)] dark:border-[rgba(127,166,255,.16)]'
          : 'border border-q-line bg-q-surface text-q-ink',
      )}
    >
      {ink && (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{ background: 'radial-gradient(320px 220px at 85% 0%, rgba(37,99,235,.45), transparent 70%)' }}
        />
      )}
      <div className="relative flex items-start justify-between gap-3">
        <div className="flex flex-col gap-1.5">
          <h2 id={id} className={cn('text-lg font-semibold', ink ? 'text-white' : 'text-q-ink')}>
            {name}
          </h2>
          <p className={cn('text-sm', ink ? 'text-[#AFBDD3]' : 'text-q-text-3')}>{tagline}</p>
        </div>
        {badge && (
          <span className="shrink-0 rounded-full border border-white/15 bg-white/10 px-2.5 py-[5px] text-xs font-semibold text-white">
            {badge}
          </span>
        )}
      </div>
      <div className="relative flex flex-col gap-5">{children}</div>
    </section>
  )
}

function Amount({ children, ink = false }: { children: React.ReactNode; ink?: boolean }) {
  return (
    <span
      className={cn(
        'font-display text-[44px] font-semibold leading-none tracking-[-0.04em] tabular-nums sm:text-[52px]',
        ink ? 'text-white' : 'text-q-ink-strong',
      )}
    >
      {children}
    </span>
  )
}

function PriceBlock({ plan, period, ink = false }: { plan: Plan; period: BillingPeriod; ink?: boolean }) {
  const perMonth = period === 'monthly' ? plan.monthlyPrice : plan.yearlyMonthlyEquivalent
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-baseline gap-1.5">
        <Amount ink={ink}>{eur(perMonth)}</Amount>
        <span className={cn('text-sm', ink ? 'text-[#AFBDD3]' : 'text-q-text-3')}>HT / mois</span>
      </div>
      <span className={cn('text-[13px] tabular-nums', ink ? 'text-[#94A3B8]' : 'text-q-text-4')}>
        {period === 'monthly'
          ? `Soit ${eur(withVat(plan.monthlyPrice))} TTC par mois`
          : `Facturé ${eur(plan.yearlyPrice)} HT par an · ${eur(withVat(plan.yearlyPrice))} TTC`}
      </span>
    </div>
  )
}

function SoonButton({ ink = false }: { ink?: boolean }) {
  return (
    <button
      type="button"
      disabled
      className={cn(
        'inline-flex h-11 w-full cursor-not-allowed items-center justify-center rounded-[10px] text-[15px] font-semibold',
        ink
          ? 'border border-white/15 bg-white/[.06] text-[#AFBDD3]'
          : 'border border-q-line bg-q-surface-2 text-q-text-4',
      )}
    >
      Bientôt disponible
    </button>
  )
}

function FeatureList({ items, ink = false }: { items: string[]; ink?: boolean }) {
  if (items.length === 0) return null
  return (
    <ul className={cn('flex flex-col gap-[11px] text-sm leading-snug', ink ? 'text-[#CBD5E1]' : 'text-q-text-2')}>
      {items.map((item) => (
        <li key={item} className="flex gap-2.5">
          <Check
            className={cn('mt-px h-[18px] w-[18px] shrink-0', ink ? 'text-[#7FA6FF]' : 'text-q-accent')}
            strokeWidth={2.25}
            aria-hidden
          />
          {item}
        </li>
      ))}
    </ul>
  )
}

/** Fonctions annoncées, pas encore livrées : toujours dites « à venir ». */
function UpcomingList({
  items,
  title = 'À venir',
  ink = false,
  bare = false,
}: {
  items: string[]
  title?: string
  ink?: boolean
  /** Sans filet ni intitulé : la carte le dit déjà autrement. */
  bare?: boolean
}) {
  if (items.length === 0) return null
  return (
    <div className={cn(!bare && 'border-t pt-4', ink ? 'border-white/10' : 'border-q-line-soft')}>
      {!bare && (
        <p
          className={cn(
            'mb-2.5 text-[11px] font-semibold uppercase tracking-[0.08em]',
            ink ? 'text-[#94A3B8]' : 'text-q-text-4',
          )}
        >
          {title}
        </p>
      )}
      <ul className={cn('flex flex-col gap-[11px] text-sm leading-snug', ink ? 'text-[#AFBDD3]' : 'text-q-text-3')}>
        {items.map((item) => (
          <li key={item} className="flex gap-2.5">
            <Clock
              className={cn('mt-px h-[18px] w-[18px] shrink-0', ink ? 'text-[#64748B]' : 'text-q-text-4')}
              strokeWidth={2}
              aria-hidden
            />
            {item}
          </li>
        ))}
      </ul>
    </div>
  )
}
