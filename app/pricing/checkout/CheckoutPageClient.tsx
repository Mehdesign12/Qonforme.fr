'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import {
  EmbeddedCheckout,
  EmbeddedCheckoutProvider,
} from '@stripe/react-stripe-js'
import { loadStripe } from '@stripe/stripe-js'
import { Check, ArrowLeft, Shield, RefreshCw, ChevronDown, ChevronUp, Lock, Zap } from 'lucide-react'
import { PLANS, type PlanId, type BillingPeriod } from '@/lib/stripe/plans'

/* ─── Assets ─────────────────────────────────────────────────────────────── */
const LOGO_LONG_BLANC = 'https://lxnowrmyyaylvnognifu.supabase.co/storage/v1/object/public/Logos/Logo%20long%20blanc.webp'
const LOGO_LONG_BLEU  = 'https://lxnowrmyyaylvnognifu.supabase.co/storage/v1/object/public/Logos/Logo%20long%20bleu.webp'
const PICTO_Q         = 'https://lxnowrmyyaylvnognifu.supabase.co/storage/v1/object/public/Logos/Logo%20bleu%20Qonforme%20PNG.webp'

/* ─── Stripe singleton ───────────────────────────────────────────────────── */
const stripeKey     = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? ''
const stripePromise = stripeKey ? loadStripe(stripeKey) : null

/* ─── Props ──────────────────────────────────────────────────────────────── */
interface CheckoutPageClientProps {
  planId:        PlanId
  billingPeriod: BillingPeriod
}

/* ══════════════════════════════════════════════════════════════════════════
   COMPONENT
══════════════════════════════════════════════════════════════════════════ */
export default function CheckoutPageClient({ planId, billingPeriod }: CheckoutPageClientProps) {
  const router = useRouter()
  const plan   = PLANS[planId]
  const isPro  = planId === 'pro'

  const price = billingPeriod === 'monthly'
    ? plan.monthlyPrice
    : plan.yearlyMonthlyEquivalent
  const fmt = (n: number) => n % 1 === 0 ? `${n}` : n.toFixed(2)

  /* ── State ────────────────────────────────────────────────────────────── */
  const [fetchError,      setFetchError]      = useState<string | null>(null)
  const [isComplete,      setIsComplete]      = useState(false)
  const [summaryOpen,     setSummaryOpen]     = useState(false)
  const [isSlowActivation, setIsSlowActivation] = useState(false)
  const redirected = useRef(false)

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

    const redirectToDashboard = () => router.replace('/dashboard')

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
  }, [isComplete, router])

  const fetchClientSecret = useCallback(async () => {
    setFetchError(null)
    try {
      const res  = await fetch('/api/stripe/checkout', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ planId, billingPeriod }),
      })
      const data = await res.json()
      if (!res.ok || !data.clientSecret) {
        setFetchError(data.error ?? 'Impossible de charger le formulaire.')
        return ''
      }
      return data.clientSecret as string
    } catch {
      setFetchError('Erreur réseau. Réessaie.')
      return ''
    }
  }, [planId, billingPeriod])

  /* ─────────────────────────────────────────────────────────────────────────
     THÈME PAR PLAN
     Pro   → navy #0F172A · Starter → blanc/bleu clair
  ───────────────────────────────────────────────────────────────────────── */
  const leftBg        = isPro ? 'bg-[#0F172A]'  : 'bg-white'
  const textMain      = isPro ? 'text-white'     : 'text-[#0F172A]'
  const textMuted     = isPro ? 'text-white/50'  : 'text-slate-500'
  const textSub       = isPro ? 'text-white/40'  : 'text-slate-500'
  const textFeature   = isPro ? 'text-white/80'  : 'text-[#1E293B]'
  const planLabel     = isPro ? 'text-[#60A5FA]' : 'text-[#2563EB]'
  const checkBg       = 'bg-[#D1FAE5]'
  const checkIcon     = 'text-[#059669]'
  const divider       = isPro ? 'bg-white/10'    : 'bg-[#E2E8F0]'
  const shieldColor   = isPro ? 'text-white/30'  : 'text-slate-400'
  const backBtn       = isPro
    ? 'text-white/60 hover:text-white'
    : 'text-slate-500 hover:text-[#2563EB]'
  const desktopBorderRight = isPro ? '' : 'lg:border-r lg:border-[#E2E8F0]'

  /* ─────────────────────────────────────────────────────────────────────────
     THÈME MOBILE HEADER
  ───────────────────────────────────────────────────────────────────────── */
  const mobileHeaderBg     = isPro ? '#0F172A' : '#ffffff'
  const mobileAccordionBg  = isPro ? 'rgba(255,255,255,0.04)' : '#F8FAFC'
  const mobileBadgeBg      = isPro ? '#2563EB'  : '#EFF6FF'
  const mobileBadgeText    = isPro ? '#ffffff'  : '#2563EB'

  /* ══════════════════════════════════════════════════════════════════════
     RENDER
     • Mobile  (<lg) : header compact sticky + accordéon + Stripe plein écran
     • Desktop (≥lg) : colonne gauche 42% + colonne droite Stripe 58%
  ══════════════════════════════════════════════════════════════════════ */
  return (
    /* 100dvh = dynamic viewport height — gère correctement la barre Safari */
    <div className="h-[100dvh] flex flex-col lg:flex-row overflow-hidden">

      {/* ╔══════════════════════════════════════════════════════════════════╗
          ║  MOBILE ONLY — Header sticky compact                           ║
          ╚══════════════════════════════════════════════════════════════════╝ */}
      <div
        className="lg:hidden flex-shrink-0"
        style={{ backgroundColor: mobileHeaderBg }}
      >
        {/* Déco Pro : tache lumineuse bleue */}
        {isPro && (
          <div
            aria-hidden
            className="pointer-events-none absolute top-0 right-0 w-[200px] h-[200px] rounded-full z-0"
            style={{ background: 'radial-gradient(circle, rgba(37,99,235,0.18) 0%, transparent 70%)' }}
          />
        )}
        {/* Déco Starter : dégradé bleu très léger */}
        {!isPro && (
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-0 top-0 h-[160px] z-0"
            style={{ background: 'linear-gradient(180deg, #EFF6FF 0%, #ffffff 100%)' }}
          />
        )}

        <div className="relative z-10">
          {/* ── Ligne 1 : retour + logo ─────────────────────────────────── */}
          <div
            className="flex items-center justify-between px-5 pb-3"
            style={{ paddingTop: 'max(14px, env(safe-area-inset-top, 14px))' }}
          >
            <button
              onClick={() => router.push('/pricing')}
              className={`flex items-center gap-1.5 text-sm font-medium ${backBtn} transition-colors`}
              aria-label="Retour au choix du plan"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Plans</span>
            </button>

            {/* Logo centré */}
            <div className="absolute left-1/2 -translate-x-1/2">
              {isPro ? (
                <Image
                  src={LOGO_LONG_BLANC}
                  alt="Qonforme"
                  width={110}
                  height={26}
                  className="h-[26px] w-auto"
                  onError={(e) => {
                    const img = e.currentTarget as HTMLImageElement
                    img.src = LOGO_LONG_BLEU
                    img.style.filter = 'brightness(0) invert(1)'
                  }}
                />
              ) : (
                <Image
                  src={LOGO_LONG_BLEU}
                  alt="Qonforme"
                  width={110}
                  height={26}
                  className="h-[26px] w-auto"
                  priority
                />
              )}
            </div>

            {/* Espace droit pour symétrie */}
            <div className="w-[60px]" aria-hidden />
          </div>

          {/* ── Ligne 2 : résumé compact + toggle accordéon ─────────────── */}
          <button
            onClick={() => setSummaryOpen(v => !v)}
            className="w-full flex items-center justify-between px-5 py-3.5 transition-colors active:opacity-80"
            style={{
              backgroundColor: summaryOpen ? mobileAccordionBg : 'transparent',
              borderTop: isPro ? '1px solid rgba(255,255,255,0.08)' : '1px solid #F1F5F9',
            }}
            aria-expanded={summaryOpen}
            aria-label="Voir le résumé du plan"
          >
            {/* Gauche : badge plan + prix + période */}
            <div className="flex items-center gap-2.5">
              <span
                className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-full"
                style={{ backgroundColor: mobileBadgeBg, color: mobileBadgeText }}
              >
                {isPro && <Zap className="w-2.5 h-2.5" fill="currentColor" />}
                {isPro ? 'Pro' : 'Starter'}
              </span>
              <div className="flex items-baseline gap-1">
                <span className={`font-extrabold text-[24px] leading-none tabular-nums ${textMain}`}>
                  {fmt(price)}€
                </span>
                <span className={`text-[11px] leading-none ${textSub}`}>/mois HT</span>
              </div>
              {billingPeriod === 'yearly' && (
                <span className="text-[10px] font-semibold text-[#059669] bg-[#D1FAE5] px-1.5 py-0.5 rounded-full leading-none">
                  −16%
                </span>
              )}
            </div>

            {/* Droite : chevron animé */}
            <span
              className={`w-7 h-7 rounded-full flex items-center justify-center transition-colors ${
                isPro ? 'bg-white/10' : 'bg-slate-100'
              }`}
            >
              {summaryOpen
                ? <ChevronUp  className={`w-3.5 h-3.5 ${isPro ? 'text-white/60' : 'text-slate-500'}`} />
                : <ChevronDown className={`w-3.5 h-3.5 ${isPro ? 'text-white/60' : 'text-slate-500'}`} />
              }
            </span>
          </button>

          {/* ── Accordéon : détail plan ──────────────────────────────────── */}
          <div
            className="overflow-hidden transition-all duration-200"
            style={{
              maxHeight: summaryOpen ? '600px' : '0px',
              borderBottom: summaryOpen
                ? isPro ? '1px solid rgba(255,255,255,0.08)' : '1px solid #F1F5F9'
                : 'none',
              backgroundColor: mobileAccordionBg,
            }}
          >
            <div className="px-5 pt-3 pb-5">
              {/* Description plan */}
              <p className={`text-[13px] font-semibold mb-1 ${planLabel}`}>
                {plan.name}
              </p>
              <p className={`text-[13px] ${textMuted} mb-3`}>
                {plan.description}
              </p>
              {billingPeriod === 'yearly' && (
                <p className={`text-[12px] ${textMuted} mb-3 flex items-center gap-1`}>
                  <span className="text-[#059669] font-medium">2 mois offerts</span>
                  <span>· Facturé {plan.yearlyPrice} €/an</span>
                </p>
              )}

              {/* Features (4 premières + compteur) */}
              <ul className="flex flex-col gap-2.5 mb-4">
                {plan.features.slice(0, 5).map(f => (
                  <li key={f} className={`flex items-center gap-2.5 text-[13px] ${textFeature}`}>
                    <span className={`shrink-0 w-[18px] h-[18px] rounded-full ${checkBg} flex items-center justify-center`}>
                      <Check className={`w-2.5 h-2.5 ${checkIcon}`} strokeWidth={2.5} />
                    </span>
                    <span>{f}</span>
                  </li>
                ))}
                {plan.features.length > 5 && (
                  <li className={`text-[12px] ${textMuted} pl-[30px]`}>
                    + {plan.features.length - 5} autres fonctionnalités incluses
                  </li>
                )}
              </ul>

              {/* Badge sécurité */}
              <div
                className="flex items-center gap-2 pt-3"
                style={{ borderTop: isPro ? '1px solid rgba(255,255,255,0.08)' : '1px solid #F1F5F9' }}
              >
                <Lock className={`w-3 h-3 shrink-0 ${shieldColor}`} />
                <p className={`text-[11px] ${shieldColor}`}>
                  Paiement sécurisé par Stripe · Résiliation à tout moment
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ╔══════════════════════════════════════════════════════════════════╗
          ║  DESKTOP ONLY — Colonne gauche 42%                             ║
          ╚══════════════════════════════════════════════════════════════════╝ */}
      <div className={`hidden lg:flex relative lg:w-[42%] lg:h-full lg:overflow-y-auto flex-col ${leftBg} ${textMain} lg:px-10 lg:pt-10 lg:pb-8 overflow-hidden ${desktopBorderRight}`}>

        {/* Décos Pro */}
        {isPro && (
          <>
            <div
              aria-hidden
              className="pointer-events-none select-none absolute -bottom-10 -left-10 z-0"
              style={{ opacity: 0.06 }}
            >
              <Image src={PICTO_Q} alt="" width={280} height={280} className="w-[280px]" loading="lazy" />
            </div>
            <div
              aria-hidden
              className="pointer-events-none select-none absolute -top-20 -right-20 z-0 w-[320px] h-[320px] rounded-full"
              style={{ background: 'radial-gradient(circle, rgba(37,99,235,0.18) 0%, transparent 70%)' }}
            />
          </>
        )}
        {/* Décos Starter */}
        {!isPro && (
          <>
            <div
              aria-hidden
              className="pointer-events-none select-none absolute -bottom-10 -left-10 z-0"
              style={{ opacity: 0.04 }}
            >
              <Image src={PICTO_Q} alt="" width={280} height={280} className="w-[280px]" loading="lazy" />
            </div>
            <div
              aria-hidden
              className="pointer-events-none select-none absolute inset-0 z-0"
              style={{ background: 'linear-gradient(135deg, #EFF6FF 0%, #DBEAFE 20%, #ffffff 60%)' }}
            />
          </>
        )}

        <div className="relative z-10 flex flex-col h-full">
          {/* Retour */}
          <button
            onClick={() => router.push('/pricing')}
            className={`flex items-center gap-1.5 text-sm ${backBtn} transition-colors mb-7 self-start`}
          >
            <ArrowLeft className="w-4 h-4" />
            Changer de plan
          </button>

          {/* Logo */}
          <div className="mb-7">
            {isPro ? (
              <Image
                src={LOGO_LONG_BLANC}
                alt="Qonforme"
                width={140}
                height={34}
                className="h-8 w-auto"
                onError={(e) => {
                  const img = e.currentTarget as HTMLImageElement
                  img.src = LOGO_LONG_BLEU
                  img.style.filter = 'brightness(0) invert(1)'
                }}
              />
            ) : (
              <Image
                src={LOGO_LONG_BLEU}
                alt="Qonforme"
                width={140}
                height={34}
                className="h-8 w-auto"
                priority
              />
            )}
          </div>

          {/* Plan name */}
          <div className="mb-5">
            <span className={`text-[11px] font-bold uppercase tracking-[0.12em] ${planLabel} block mb-1`}>
              {plan.name}
            </span>
            <h1 className={`text-2xl lg:text-3xl font-bold leading-tight ${textMain}`}>
              {plan.description}
            </h1>
          </div>

          {/* Prix */}
          <div className="mb-6">
            <div className="flex items-baseline gap-1.5">
              <span className={`text-5xl lg:text-6xl font-extrabold font-mono leading-none tracking-tight ${textMain}`}>
                {fmt(price)}€
              </span>
              <span className={`${textSub} text-sm`}>/mois HT</span>
            </div>
            {billingPeriod === 'yearly' && (
              <p className={`text-sm ${textMuted} mt-1.5`}>
                Facturé {plan.yearlyPrice} €/an · 2 mois offerts
              </p>
            )}
          </div>

          {/* Séparateur */}
          <div className={`h-px ${divider} mb-5`} />

          {/* Features */}
          <ul className="flex flex-col gap-3 flex-1">
            {plan.features.map(f => (
              <li key={f} className={`flex items-start gap-3 text-sm ${textFeature}`}>
                <span className={`mt-[2px] w-[18px] h-[18px] rounded-full ${checkBg} flex items-center justify-center shrink-0`}>
                  <Check className={`w-2.5 h-2.5 ${checkIcon}`} strokeWidth={2.5} />
                </span>
                {f}
              </li>
            ))}
          </ul>

          {/* Badge sécurité */}
          <div className={`flex items-center gap-2 mt-5 pt-5 border-t ${divider}`}>
            <Shield className={`w-3.5 h-3.5 ${shieldColor} shrink-0`} />
            <p className={`text-xs ${shieldColor}`}>
              Paiement sécurisé par Stripe · Résiliation à tout moment
            </p>
          </div>
        </div>
      </div>

      {/* ╔══════════════════════════════════════════════════════════════════╗
          ║  STRIPE — plein écran mobile / colonne droite desktop           ║
          ║  Note : safe-area-inset-bottom évite que le bouton Stripe       ║
          ║  se cache derrière la barre iPhone home.                        ║
          ╚══════════════════════════════════════════════════════════════════╝ */}
      <div
        className="flex-1 overflow-y-auto bg-white min-h-0"
        style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
      >
        <div className="min-h-full flex flex-col justify-start lg:justify-center px-4 py-6 lg:px-10 lg:py-8">

          {/* ── Pas de clé Stripe (dev local) ───────────────────────────── */}
          {!stripeKey ? (
            <div className="max-w-md mx-auto w-full text-center py-12">
              <div className="w-14 h-14 rounded-2xl bg-[#EFF6FF] flex items-center justify-center mx-auto mb-5">
                <Shield className="w-6 h-6 text-[#2563EB]" />
              </div>
              <h3 className="text-[#0F172A] font-semibold text-base mb-2">
                Formulaire de paiement
              </h3>
              <p className="text-sm text-slate-500 mb-2">
                Le formulaire Stripe s&apos;affiche ici en production.
              </p>
              <p className="text-xs text-slate-400 leading-relaxed">
                Ajoute{' '}
                <code className="bg-slate-100 px-1.5 py-0.5 rounded text-slate-600">
                  NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
                </code>{' '}
                dans{' '}
                <code className="bg-slate-100 px-1.5 py-0.5 rounded text-slate-600">
                  .env.local
                </code>{' '}
                pour tester en local.
              </p>
            </div>

          ) : fetchError ? (
            /* ── Erreur API ─────────────────────────────────────────────── */
            <div className="max-w-md mx-auto w-full text-center py-12">
              <div className="w-14 h-14 rounded-2xl bg-[#FEE2E2] flex items-center justify-center mx-auto mb-5">
                <RefreshCw className="w-6 h-6 text-[#EF4444]" />
              </div>
              <p className="text-base font-semibold text-[#EF4444] mb-2">
                Une erreur est survenue
              </p>
              <p className="text-sm text-slate-500 mb-6">{fetchError}</p>
              <button
                onClick={() => setFetchError(null)}
                className="inline-flex items-center justify-center gap-2 bg-[#2563EB] text-white text-sm font-medium px-5 py-2.5 rounded-xl hover:bg-[#1D4ED8] transition-colors mb-3 w-full max-w-[240px]"
              >
                <RefreshCw className="w-4 h-4" />
                Réessayer
              </button>
              <br />
              <button
                onClick={() => router.push('/pricing')}
                className="text-sm text-slate-400 hover:text-slate-600 underline transition-colors"
              >
                Retour au choix du plan
              </button>
            </div>

          ) : isComplete ? (
            /* ── Confirmation paiement ──────────────────────────────────── */
            <div className="max-w-md mx-auto w-full text-center py-12">
              <div className="w-16 h-16 rounded-2xl bg-[#D1FAE5] flex items-center justify-center mx-auto mb-5">
                <Check className="w-8 h-8 text-[#059669]" strokeWidth={2.5} />
              </div>
              <h2 className="text-xl font-bold text-[#0F172A] mb-2">
                Paiement confirmé !
              </h2>
              {isSlowActivation ? (
                <>
                  <p className="text-sm text-slate-500 mb-2">
                    Votre accès est en cours d&apos;activation…
                  </p>
                  <p className="text-xs text-slate-400 mb-6">
                    Cela prend plus de temps que prévu. Vous pouvez accéder à votre espace dès maintenant.
                  </p>
                  <button
                    onClick={() => router.replace('/dashboard')}
                    className="inline-flex items-center justify-center gap-2 bg-[#2563EB] text-white text-sm font-semibold px-6 py-2.5 rounded-xl hover:bg-[#1D4ED8] transition-colors"
                  >
                    Accéder à mon espace →
                  </button>
                </>
              ) : (
                <>
                  <p className="text-sm text-slate-500 mb-6">
                    Activation de votre accès en cours…
                  </p>
                  <div className="flex justify-center">
                    <div className="w-5 h-5 border-[2.5px] border-[#2563EB] border-t-transparent rounded-full animate-spin" />
                  </div>
                </>
              )}
            </div>

          ) : (
            /* ── Formulaire Stripe Embedded ─────────────────────────────── */
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
