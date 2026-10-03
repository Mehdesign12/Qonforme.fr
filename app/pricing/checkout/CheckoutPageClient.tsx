'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import {
  EmbeddedCheckout,
  EmbeddedCheckoutProvider,
} from '@stripe/react-stripe-js'
import { loadStripe } from '@stripe/stripe-js'
import { Check, ArrowLeft, ChevronDown, Clock, Lock, RefreshCw, ShieldCheck } from 'lucide-react'
import { PLANS, formatEuros, withVat, type PlanId, type BillingPeriod } from '@/lib/stripe/plans'
import { GUARANTEE_DAYS } from '@/lib/stripe/access'
import { trackEvent } from '@/lib/meta-pixel'
import { LOGO_LONG_BLUE, LOGO_LONG_LIGHT } from '@/lib/brand'
import { cn } from '@/lib/utils'

/** « 10 € » avec une espace insécable avant le symbole. */
const eur = (amount: number) => formatEuros(amount).replace(/ €$/, '\u00A0€')

/* ─── Stripe singleton ───────────────────────────────────────────────────── */
const stripeKey     = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? ''
// Stripe.js bloqué (réseau, bloqueur de publicités) : null au lieu d'une
// promesse rejetée, pour afficher un message plutôt qu'un panneau vide.
const stripePromise = stripeKey ? loadStripe(stripeKey).catch(() => null) : null

/* ─── Props ──────────────────────────────────────────────────────────────── */
interface CheckoutPageClientProps {
  planId:        PlanId
  billingPeriod: BillingPeriod
  /** Chemin interne où revenir une fois la formule active (ex. la facture à envoyer). */
  next:          string | null
}

/* ══════════════════════════════════════════════════════════════════════════
   COMPONENT
══════════════════════════════════════════════════════════════════════════ */
export default function CheckoutPageClient({ planId, billingPeriod, next }: CheckoutPageClientProps) {
  const router = useRouter()
  const plan   = PLANS[planId]
  
  const price = billingPeriod === 'monthly'
    ? plan.monthlyPrice
    : plan.yearlyMonthlyEquivalent
  const destination = next ?? '/dashboard'
  const plansHref   = next ? `/signup/plan?next=${encodeURIComponent(next)}` : '/signup/plan'
  const chargeHt    = billingPeriod === 'monthly' ? plan.monthlyPrice : plan.yearlyPrice
  const chargeLine  = billingPeriod === 'monthly'
    ? `Soit ${eur(withVat(chargeHt))} TTC par mois`
    : `Facturé ${eur(chargeHt)} HT par an · ${eur(withVat(chargeHt))} TTC`

  /* ── State ────────────────────────────────────────────────────────────── */
  const [fetchError,      setFetchError]      = useState<string | null>(null)
  const [isComplete,      setIsComplete]      = useState(false)
  const [summaryOpen,     setSummaryOpen]     = useState(false)
  const [isSlowActivation, setIsSlowActivation] = useState(false)
  const [stripeUnavailable, setStripeUnavailable] = useState(false)
  const redirected = useRef(false)

  useEffect(() => {
    let active = true
    stripePromise?.then((loaded) => { if (active && !loaded) setStripeUnavailable(true) })
    return () => { active = false }
  }, [])

  /* ── Handlers ─────────────────────────────────────────────────────────── */
  const handleComplete = useCallback(() => { setIsComplete(true) }, [])

  useEffect(() => {
    if (!isComplete || redirected.current) return
    redirected.current = true

    // Le webhook Stripe est asynchrone. On poll toutes les 2s (max 40 tentatives = 80s).
    // On ne redirige QUE quand status === 'active' est confirmé.
    // Si le polling rapide expire sans confirmation, on passe en mode lent (5s)
    // et on affiche un bouton manuel — on ne redirige JAMAIS aveuglément.
    let attempts = 0
    const FAST_MAX = 40
    const FAST_INTERVAL = 2000

    const redirectToDashboard = () => {
      trackEvent('Purchase', {
        currency: 'EUR',
        value: billingPeriod === 'monthly' ? plan.monthlyPrice : plan.yearlyPrice,
        content_name: plan.name,
        content_ids: [planId],
        num_items: 1,
      })
      router.replace(destination)
    }

    let slowTimer: ReturnType<typeof setInterval> | null = null

    const poll = async () => {
      try {
        const res = await fetch('/api/subscription/status')
        if (res.ok) {
          const { status } = await res.json()
          if (status === 'active') {
            redirectToDashboard()
            return
          }
        }
      } catch {
        // réseau instable — on continue de poller
      }
      attempts++
      if (attempts < FAST_MAX) {
        setTimeout(poll, FAST_INTERVAL)
      } else {
        // Polling rapide expiré (80s) : passer en mode lent, afficher bouton manuel
        setIsSlowActivation(true)
        slowTimer = setInterval(async () => {
          try {
            const res = await fetch('/api/subscription/status')
            if (res.ok) {
              const { status } = await res.json()
              if (status === 'active') {
                if (slowTimer) clearInterval(slowTimer)
                redirectToDashboard()
              }
            }
          } catch { /* réseau instable — on continue */ }
        }, 5000)
        // Arrêt automatique après 5 min pour ne pas polluer indéfiniment
        setTimeout(() => { if (slowTimer) clearInterval(slowTimer) }, 300_000)
      }
    }

    setTimeout(poll, FAST_INTERVAL)
  }, [isComplete, router]) // eslint-disable-line react-hooks/exhaustive-deps

  const fetchClientSecret = useCallback(async () => {
    setFetchError(null)
    try {
      const res  = await fetch('/api/stripe/checkout', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ planId, billingPeriod, next }),
      })
      const data = await res.json()
      // Essentiel active, Artisan demandée : changement de formule au prorata
      // dans l'espace de paiement Stripe (pas de second abonnement)
      if (res.ok && data.alreadySubscribed && data.upgrade) {
        const portal = await fetch('/api/stripe/portal', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'upgrade' }),
        })
        const portalData = await portal.json().catch(() => ({}))
        if (portal.ok && portalData.url) { window.location.href = portalData.url; return '' }
        setFetchError(portalData.error ?? "L'espace de paiement n'a pas pu s'ouvrir.")
        return ''
      }
      // Formule déjà active : rien à payer, on reprend là où l'artisan en était
      if (res.ok && data.alreadySubscribed) {
        router.replace(data.next ?? destination)
        return ''
      }
      if (!res.ok || !data.clientSecret) {
        setFetchError(data.error ?? 'Impossible de charger le formulaire.')
        return ''
      }
      return data.clientSecret as string
    } catch {
      setFetchError('Erreur réseau. Réessayez.')
      return ''
    }
  }, [planId, billingPeriod, next, destination, router])

  /* ══════════════════════════════════════════════════════════════════════
     RENDU
     • Mobile  (<lg) : en-tête compact + résumé repliable + Stripe plein écran
     • Desktop (≥lg) : résumé à gauche (42 %) + Stripe à droite
     Couleurs par jetons --q-* (thème sombre compris) ; aucun backdrop-filter.
  ══════════════════════════════════════════════════════════════════════ */
  return (
    /* 100dvh = hauteur dynamique — gère correctement la barre Safari */
    <div className="flex h-[100dvh] flex-col overflow-hidden bg-q-bg text-q-ink lg:flex-row">

      {/* ── Mobile : en-tête compact ─────────────────────────────────────── */}
      <div className="flex-shrink-0 border-b border-q-line bg-q-surface lg:hidden">
        <div
          className="relative flex items-center justify-between px-4 pb-2"
          style={{ paddingTop: 'max(10px, env(safe-area-inset-top, 10px))' }}
        >
          <button
            type="button"
            onClick={() => router.push(plansHref)}
            className="-ml-2 inline-flex min-h-[44px] items-center gap-1 rounded-lg px-2 text-[15px] font-medium text-q-accent-strong"
            aria-label="Retour au choix de la formule"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden />
            Formules
          </button>
          <div className="absolute left-1/2 -translate-x-1/2">
            <Logo className="h-5 w-auto" />
          </div>
          <span className="inline-flex items-center gap-1 text-xs text-q-text-4">
            <Lock className="h-3.5 w-3.5" aria-hidden />
            Sécurisé
          </span>
        </div>

        {/* Résumé repliable */}
        <button
          type="button"
          onClick={() => setSummaryOpen(v => !v)}
          className="flex w-full items-center justify-between gap-3 border-t border-q-line-soft px-4 py-3 text-left"
          aria-expanded={summaryOpen}
          aria-controls="checkout-summary"
        >
          <span className="flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-1">
            <span className="text-[15px] font-semibold text-q-ink">{plan.name}</span>
            <span className="font-display text-[22px] font-semibold leading-none tracking-[-0.03em] tabular-nums text-q-ink-strong">
              {eur(price)}
            </span>
            <span className="text-[13px] text-q-text-3">HT / mois</span>
            {billingPeriod === 'yearly' && (
              <span className="q-pill q-pill-ok">2 mois offerts</span>
            )}
          </span>
          <span className="inline-flex shrink-0 items-center gap-1 text-[13px] font-medium text-q-text-3">
            {summaryOpen ? 'Masquer' : 'Détails'}
            <ChevronDown className={cn('h-4 w-4 transition-transform', summaryOpen && 'rotate-180')} aria-hidden />
          </span>
        </button>

        <div
          id="checkout-summary"
          className="overflow-hidden transition-[max-height] duration-200"
          style={{ maxHeight: summaryOpen ? '640px' : '0px' }}
        >
          <div className="border-t border-q-line-soft bg-q-surface-2 px-4 pb-5 pt-4">
            <p className="text-sm text-q-text-3">{plan.tagline}</p>
            <p className="mt-1 text-[13px] tabular-nums text-q-text-4">{chargeLine}</p>
            <FeatureList items={plan.features} className="mt-4" />
            <UpcomingList items={plan.upcoming} />
            <Assurance className="mt-4 border-t border-q-line-soft pt-4" />
          </div>
        </div>
      </div>

      {/* ── Desktop : résumé de la formule ───────────────────────────────── */}
      <aside className="hidden flex-col overflow-y-auto border-r border-q-line px-10 pb-8 pt-10 lg:flex lg:h-full lg:w-[42%] xl:px-14">
        <button
          type="button"
          onClick={() => router.push(plansHref)}
          className="-ml-2 mb-8 inline-flex min-h-[40px] items-center gap-1.5 self-start rounded-lg px-2 text-sm font-medium text-q-text-3 transition-colors hover:text-q-ink"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden />
          Changer de formule
        </button>

        <Logo className="mb-10 h-6 w-auto self-start" priority />

        <p className="q-eyebrow">Votre formule</p>
        <h1 className="mt-2 font-display text-[36px] font-semibold leading-[1.06] tracking-[-0.03em] text-q-ink-strong xl:text-[40px]">
          {plan.name}, <span className="q-serif">{plan.tagline.replace(/^Pour /, 'pour ').replace(/\.$/, '')}.</span>
        </h1>

        <div className="mt-8 rounded-[20px] border border-q-line bg-q-surface p-7">
          <div className="flex items-baseline gap-1.5">
            <span className="font-display text-[52px] font-semibold leading-none tracking-[-0.04em] tabular-nums text-q-ink-strong">
              {eur(price)}
            </span>
            <span className="text-sm text-q-text-3">HT / mois</span>
            {billingPeriod === 'yearly' && (
              <span className="q-pill q-pill-ok ml-1 self-center">2 mois offerts</span>
            )}
          </div>
          <p className="mt-1.5 text-[13px] tabular-nums text-q-text-4">{chargeLine}</p>

          <div className="my-6 h-px bg-q-line-soft" />

          <FeatureList items={plan.features} />
          <UpcomingList items={plan.upcoming} />
        </div>

        <Assurance className="mt-6" />
      </aside>

      {/* ── Stripe : plein écran mobile / colonne droite desktop ─────────────
          safe-area-inset-bottom évite que le bouton Stripe se cache derrière
          la barre d'accueil de l'iPhone. */}
      <div
        className="min-h-0 flex-1 overflow-y-auto bg-q-surface"
        style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
      >
        <div className="flex min-h-full flex-col justify-start px-4 py-6 lg:justify-center lg:px-10 lg:py-8">

          {/* ── Pas de clé Stripe (dev local) ───────────────────────────── */}
          {!stripeKey ? (
            <StateBlock
              icon={<Lock className="h-6 w-6" aria-hidden />}
              title="Formulaire de paiement"
            >
              <p className="text-sm text-q-text-3">Le formulaire Stripe s&apos;affiche ici en production.</p>
              <p className="mt-2 text-xs leading-relaxed text-q-text-4">
                Ajoutez <code className="rounded bg-q-sunken px-1.5 py-0.5 font-mono text-q-text-2">NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY</code>{' '}
                dans <code className="rounded bg-q-sunken px-1.5 py-0.5 font-mono text-q-text-2">.env.local</code> pour tester en local.
              </p>
            </StateBlock>

          ) : stripeUnavailable ? (
            /* ── Stripe.js n'a pas pu se charger ─────────────────────────── */
            <StateBlock
              tone="danger"
              icon={<RefreshCw className="h-6 w-6" aria-hidden />}
              title="Le paiement n'a pas pu s'afficher"
            >
              <p className="text-sm text-q-text-3" role="alert">
                Le formulaire de paiement sécurisé ne s&apos;est pas chargé. Vérifiez votre connexion ou désactivez un éventuel bloqueur de publicités, puis réessayez.
              </p>
              <div className="mt-6 flex w-full flex-col items-center gap-2">
                <button
                  type="button"
                  onClick={() => window.location.reload()}
                  className="q-btn q-btn-primary q-btn-lg w-full max-w-[280px] lg:h-10 lg:rounded-[10px] lg:text-sm"
                >
                  <RefreshCw aria-hidden />
                  Réessayer
                </button>
                <button
                  type="button"
                  onClick={() => router.push(plansHref)}
                  className="q-btn q-btn-ghost w-full max-w-[280px]"
                >
                  Retour au choix de la formule
                </button>
              </div>
            </StateBlock>

          ) : fetchError ? (
            /* ── Erreur API ─────────────────────────────────────────────── */
            <StateBlock
              tone="danger"
              icon={<RefreshCw className="h-6 w-6" aria-hidden />}
              title="Le paiement n'a pas pu s'afficher"
            >
              <p className="text-sm text-q-text-3" role="alert">{fetchError}</p>
              <div className="mt-6 flex w-full flex-col items-center gap-2">
                <button
                  type="button"
                  onClick={() => setFetchError(null)}
                  className="q-btn q-btn-primary q-btn-lg w-full max-w-[280px] lg:h-10 lg:rounded-[10px] lg:text-sm"
                >
                  <RefreshCw aria-hidden />
                  Réessayer
                </button>
                <button
                  type="button"
                  onClick={() => router.push(plansHref)}
                  className="q-btn q-btn-ghost w-full max-w-[280px]"
                >
                  Retour au choix de la formule
                </button>
              </div>
            </StateBlock>

          ) : isComplete ? (
            /* ── Confirmation paiement ──────────────────────────────────── */
            <StateBlock
              tone="ok"
              icon={<Check className="h-7 w-7" strokeWidth={2.5} aria-hidden />}
              title="Paiement confirmé"
            >
              {isSlowActivation ? (
                <>
                  <p className="text-sm text-q-text-3">Votre accès est en cours d&apos;activation…</p>
                  <p className="mt-1 text-[13px] text-q-text-4">
                    Cela prend plus de temps que prévu. Vous pouvez accéder à votre espace dès maintenant.
                  </p>
                  <button
                    type="button"
                    onClick={() => router.replace(destination)}
                    className="q-btn q-btn-primary q-btn-lg mt-6 w-full max-w-[280px] lg:h-10 lg:rounded-[10px] lg:text-sm"
                  >
                    {next ? 'Reprendre ma facture' : 'Accéder à mon espace'}
                  </button>
                </>
              ) : (
                <p className="inline-flex items-center gap-2 text-sm text-q-text-3" role="status">
                  <Clock className="h-4 w-4 text-q-accent" aria-hidden />
                  Activation de votre accès en cours…
                </p>
              )}
            </StateBlock>

          ) : (
            /* ── Formulaire Stripe intégré ──────────────────────────────── */
            <div className="w-full">
              <EmbeddedCheckoutProvider
                stripe={stripePromise}
                options={{ fetchClientSecret, onComplete: handleComplete }}
              >
                <EmbeddedCheckout />
              </EmbeddedCheckoutProvider>
            </div>
          )}

        </div>
      </div>

    </div>
  )
}

/* ─── Briques ────────────────────────────────────────────────────────────── */

/** Logo long : bleu en thème clair, clair en thème sombre (CSS seul, sans resolvedTheme). */
function Logo({ className, priority = false }: { className?: string; priority?: boolean }) {
  return (
    <>
      <Image src={LOGO_LONG_BLUE} alt="Qonforme" width={120} height={24} sizes="120px" priority={priority} className={cn(className, 'dark:hidden')} />
      <Image src={LOGO_LONG_LIGHT} alt="Qonforme" width={120} height={24} sizes="120px" className={cn(className, 'hidden dark:block')} />
    </>
  )
}

function FeatureList({ items, className }: { items: string[]; className?: string }) {
  if (items.length === 0) return null
  return (
    <ul className={cn('flex flex-col gap-[11px] text-sm leading-snug text-q-text-2', className)}>
      {items.map(f => (
        <li key={f} className="flex gap-2.5">
          <Check className="mt-px h-[18px] w-[18px] shrink-0 text-q-accent" strokeWidth={2.25} aria-hidden />
          {f}
        </li>
      ))}
    </ul>
  )
}

/** Fonctions annoncées, pas encore livrées : toujours dites « à venir ». */
function UpcomingList({ items }: { items: string[] }) {
  if (items.length === 0) return null
  return (
    <div className="mt-5 border-t border-q-line-soft pt-4">
      <p className="mb-2.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-q-text-4">À venir</p>
      <ul className="flex flex-col gap-[11px] text-sm leading-snug text-q-text-3">
        {items.map(f => (
          <li key={f} className="flex gap-2.5">
            <Clock className="mt-px h-[18px] w-[18px] shrink-0 text-q-text-4" strokeWidth={2} aria-hidden />
            {f}
          </li>
        ))}
      </ul>
    </div>
  )
}

function Assurance({ className }: { className?: string }) {
  return (
    <ul className={cn('flex flex-col gap-2 text-[13px] text-q-text-3', className)}>
      <li className="flex items-center gap-2">
        <ShieldCheck className="h-4 w-4 shrink-0 text-q-ok" aria-hidden />
        Satisfait ou remboursé {GUARANTEE_DAYS}&nbsp;jours · Sans engagement
      </li>
      <li className="flex items-center gap-2">
        <Lock className="h-4 w-4 shrink-0 text-q-text-4" aria-hidden />
        Carte bancaire ou prélèvement SEPA, paiement traité par Stripe
      </li>
    </ul>
  )
}

function StateBlock({
  icon,
  title,
  tone = 'accent',
  children,
}: {
  icon: React.ReactNode
  title: string
  tone?: 'accent' | 'ok' | 'danger'
  children: React.ReactNode
}) {
  return (
    <div className="mx-auto flex w-full max-w-md flex-col items-center py-12 text-center">
      <div
        className={cn(
          'mb-5 grid h-14 w-14 place-items-center rounded-2xl',
          tone === 'ok' && 'bg-q-ok-bg text-q-ok',
          tone === 'danger' && 'bg-q-danger-bg text-q-danger',
          tone === 'accent' && 'bg-q-wash text-q-accent-strong',
        )}
      >
        {icon}
      </div>
      <h2 className="mb-2 font-display text-xl font-semibold tracking-[-0.02em] text-q-ink-strong">{title}</h2>
      {children}
    </div>
  )
}
