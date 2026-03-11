'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import {
  EmbeddedCheckout,
  EmbeddedCheckoutProvider,
} from '@stripe/react-stripe-js'
import { loadStripe } from '@stripe/stripe-js'
import { Check, ArrowLeft, Shield, RefreshCw, Loader2 } from 'lucide-react'
import { PLANS, type PlanId, type BillingPeriod } from '@/lib/stripe/plans'

const LOGO_LONG_BLANC = 'https://lxnowrmyyaylvnognifu.supabase.co/storage/v1/object/public/Logos/Logo%20long%20blanc.webp'
const LOGO_LONG_BLEU  = 'https://lxnowrmyyaylvnognifu.supabase.co/storage/v1/object/public/Logos/Logo%20long%20bleu.webp'
const PICTO_Q         = 'https://lxnowrmyyaylvnognifu.supabase.co/storage/v1/object/public/Logos/Logo%20bleu%20Qonforme%20PNG.webp'

// Singleton Stripe — initialisé une seule fois
// Si la clé est absente (dev sans .env.local), stripePromise vaudra null
// et l'EmbeddedCheckoutProvider affichera une erreur gérée ci-dessous.
const stripeKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? ''
const stripePromise = stripeKey ? loadStripe(stripeKey) : null

// ── Stripe Appearance — charte Qonforme ───────────────────────────────────
const stripeAppearance = {
  theme: 'stripe' as const,
  variables: {
    colorPrimary:        '#2563EB',
    colorBackground:     '#ffffff',
    colorText:           '#0F172A',
    colorTextSecondary:  '#475569',
    colorDanger:         '#EF4444',
    fontFamily:          '"DM Sans", system-ui, sans-serif',
    fontSizeBase:        '14px',
    borderRadius:        '10px',
    spacingUnit:         '4px',
  },
  rules: {
    '.Label': {
      fontWeight:    '600',
      color:         '#0F172A',
      fontSize:      '13px',
      marginBottom:  '6px',
    },
    '.Input': {
      border:        '1.5px solid #E2E8F0',
      boxShadow:     'none',
      paddingTop:    '10px',
      paddingBottom: '10px',
      color:         '#0F172A',
    },
    '.Input:focus': {
      border:     '1.5px solid #2563EB',
      boxShadow:  '0 0 0 3px rgba(37,99,235,0.10)',
      outline:    'none',
    },
    '.Input--invalid': {
      border:    '1.5px solid #EF4444',
      boxShadow: '0 0 0 3px rgba(239,68,68,0.10)',
    },
    '.Tab': {
      border:       '1.5px solid #E2E8F0',
      boxShadow:    'none',
      borderRadius: '10px',
    },
    '.Tab:hover': {
      border:      '1.5px solid #BFDBFE',
      color:       '#2563EB',
    },
    '.Tab--selected': {
      border:      '1.5px solid #2563EB',
      boxShadow:   '0 0 0 3px rgba(37,99,235,0.10)',
      color:       '#2563EB',
    },
    '.CheckboxInput': {
      border: '1.5px solid #E2E8F0',
    },
    '.CheckboxInput--checked': {
      backgroundColor: '#2563EB',
      border:          '1.5px solid #2563EB',
    },
  },
}

// ── Stripe fonts — charge DM Sans pour l'iframe Stripe ───────────────────
const stripeFonts = [
  { cssSrc: 'https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&display=swap' },
]

interface CheckoutPageClientProps {
  planId:        PlanId
  billingPeriod: BillingPeriod
}

export default function CheckoutPageClient({ planId, billingPeriod }: CheckoutPageClientProps) {
  const router  = useRouter()
  const plan    = PLANS[planId]
  const isPro   = planId === 'pro'

  const price = billingPeriod === 'monthly'
    ? plan.monthlyPrice
    : plan.yearlyMonthlyEquivalent

  const fmt = (n: number) => n % 1 === 0 ? `${n}` : n.toFixed(2)

  const [fetchError, setFetchError]     = useState<string | null>(null)
  const [isComplete, setIsComplete]     = useState(false)
  // stripeReady : masque le spinner après un court délai pour laisser l'iframe monter
  const [stripeReady, setStripeReady]   = useState(false)
  const stripeReadyTimer                 = useRef<ReturnType<typeof setTimeout> | null>(null)
  const redirected                       = useRef(false)

  const handleComplete = useCallback(() => { setIsComplete(true) }, [])

  useEffect(() => {
    if (isComplete && !redirected.current) {
      redirected.current = true
      setTimeout(() => router.replace('/dashboard?welcome=1'), 800)
    }
  }, [isComplete, router])

  // Révèle l'iframe Stripe après 600 ms (laisse le temps au JS Stripe de monter)
  useEffect(() => {
    if (!fetchError && !isComplete && stripeKey) {
      stripeReadyTimer.current = setTimeout(() => setStripeReady(true), 600)
    }
    return () => {
      if (stripeReadyTimer.current) clearTimeout(stripeReadyTimer.current)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

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

  // ── Thème de la colonne gauche selon le plan ────────────────────────────
  // Pro   → fond navy #0F172A, textes blancs (comme la card Pro)
  // Starter → fond blanc/bleu très clair, textes sombres (comme la card Starter)
  const leftBg      = isPro ? 'bg-[#0F172A]'   : 'bg-white'
  const textMain    = isPro ? 'text-white'      : 'text-[#0F172A]'
  const textMuted   = isPro ? 'text-white/50'   : 'text-slate-400'
  const textSub     = isPro ? 'text-white/40'   : 'text-slate-400'
  const textFeature = isPro ? 'text-white/75'   : 'text-slate-600'
  const planLabel   = isPro ? 'text-[#60A5FA]'  : 'text-[#2563EB]'
  const checkBg     = isPro ? 'bg-[#2563EB]/30' : 'bg-[#EFF6FF]'
  const checkIcon   = isPro ? 'text-[#60A5FA]'  : 'text-[#2563EB]'
  const divider     = isPro ? 'bg-white/10'     : 'bg-[#E2E8F0]'
  const shieldText  = isPro ? 'text-white/30'   : 'text-slate-300'
  const backBtn     = isPro ? 'text-white/50 hover:text-white' : 'text-slate-400 hover:text-[#0F172A]'
  const borderLeft  = isPro ? '' : 'border-r border-[#E2E8F0]'

  return (
    <div className="h-[100dvh] flex flex-col lg:flex-row overflow-hidden">

      {/* ══════════════════════════════════════════════════════════════
          COLONNE GAUCHE — Récap plan
          Pro     → navy #0F172A avec watermark bleu
          Starter → blanc avec accent bleu léger
      ══════════════════════════════════════════════════════════════ */}
      <div className={`relative lg:w-[42%] lg:h-full lg:overflow-y-auto flex flex-col ${leftBg} ${textMain} px-6 pt-6 pb-4 lg:px-10 lg:pt-10 lg:pb-8 overflow-hidden ${borderLeft}`}>

        {/* ── Décos : uniquement pour Pro ── */}
        {isPro && (
          <>
            {/* Filigrane Q — bas-gauche */}
            <div
              aria-hidden
              className="pointer-events-none select-none absolute -bottom-10 -left-10 z-0"
              style={{ opacity: 0.06 }}
            >
              <Image src={PICTO_Q} alt="" width={280} height={280} className="w-[220px] lg:w-[280px]" unoptimized />
            </div>

            {/* Tache lumineuse bleue — haut-droite */}
            <div
              aria-hidden
              className="pointer-events-none select-none absolute -top-20 -right-20 z-0 w-[320px] h-[320px] rounded-full"
              style={{ background: 'radial-gradient(circle at center, rgba(37,99,235,0.18) 0%, transparent 70%)' }}
            />
          </>
        )}

        {/* ── Décos : uniquement pour Starter ── */}
        {!isPro && (
          <>
            {/* Filigrane Q bleu très léger — bas-gauche */}
            <div
              aria-hidden
              className="pointer-events-none select-none absolute -bottom-10 -left-10 z-0"
              style={{ opacity: 0.04 }}
            >
              <Image src={PICTO_Q} alt="" width={280} height={280} className="w-[220px] lg:w-[280px]" unoptimized />
            </div>

            {/* Fond dégradé léger bleu → blanc */}
            <div
              aria-hidden
              className="pointer-events-none select-none absolute inset-0 z-0"
              style={{ background: 'linear-gradient(135deg, #EFF6FF 0%, #DBEAFE 20%, #ffffff 60%)' }}
            />
          </>
        )}

        {/* Contenu au-dessus des décos */}
        <div className="relative z-10 flex flex-col h-full">

          {/* Bouton retour */}
          <button
            onClick={() => router.push('/pricing')}
            className={`flex items-center gap-1.5 text-sm ${backBtn} transition-colors mb-7 self-start`}
          >
            <ArrowLeft className="w-4 h-4" />
            Changer de plan
          </button>

          {/* Logo Qonforme */}
          <div className="mb-7">
            {isPro ? (
              /* Version blanche sur fond navy */
              <Image
                src={LOGO_LONG_BLANC}
                alt="Qonforme"
                width={140}
                height={34}
                className="h-8 w-auto"
                unoptimized
                onError={(e) => {
                  const img = e.currentTarget as HTMLImageElement
                  img.src = LOGO_LONG_BLEU
                  img.style.filter = 'brightness(0) invert(1)'
                }}
              />
            ) : (
              /* Version bleue sur fond blanc */
              <Image
                src={LOGO_LONG_BLEU}
                alt="Qonforme"
                width={140}
                height={34}
                className="h-8 w-auto"
                unoptimized
                priority
              />
            )}
          </div>

          {/* Nom du plan */}
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

          {/* Features desktop */}
          <ul className="hidden lg:flex flex-col gap-3 flex-1">
            {plan.features.map((f) => (
              <li key={f} className={`flex items-start gap-3 text-sm ${textFeature}`}>
                <span className={`mt-[2px] w-[18px] h-[18px] rounded-full ${checkBg} flex items-center justify-center shrink-0`}>
                  <Check className={`w-2.5 h-2.5 ${checkIcon}`} />
                </span>
                {f}
              </li>
            ))}
          </ul>

          {/* Features mobile (3 premières) */}
          <ul className="lg:hidden flex flex-col gap-2 mb-2">
            {plan.features.slice(0, 3).map((f) => (
              <li key={f} className={`flex items-center gap-2.5 text-sm ${textFeature}`}>
                <Check className={`w-3.5 h-3.5 ${checkIcon} shrink-0`} />
                {f}
              </li>
            ))}
            {plan.features.length > 3 && (
              <li className={`text-xs ${textMuted} pl-6`}>
                + {plan.features.length - 3} autres avantages
              </li>
            )}
          </ul>

          {/* Badge sécurité */}
          <div className={`flex items-center gap-2 mt-5 pt-5 border-t ${divider}`}>
            <Shield className={`w-3.5 h-3.5 ${shieldText} shrink-0`} />
            <p className={`text-xs ${shieldText}`}>
              Paiement sécurisé par Stripe · Résiliation à tout moment
            </p>
          </div>

        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════
          COLONNE DROITE — Formulaire Stripe brandé
      ══════════════════════════════════════════════════════════════ */}
      <div className="flex-1 lg:h-full overflow-y-auto bg-[#F8FAFC]">
        <div className="min-h-full flex flex-col justify-start lg:justify-center px-4 py-6 lg:px-10 lg:py-8">

          {/* Clé Stripe absente (dev sans .env.local) */}
          {!stripeKey ? (
            <div className="max-w-md mx-auto w-full text-center py-10">
              <div className="w-12 h-12 rounded-full bg-[#EFF6FF] flex items-center justify-center mx-auto mb-4">
                <Shield className="w-5 h-5 text-[#2563EB]" />
              </div>
              <h3 className="text-[#0F172A] font-semibold mb-2">Paiement Stripe</h3>
              <p className="text-sm text-slate-500 mb-1">
                Le formulaire de paiement s&apos;affiche ici en production.
              </p>
              <p className="text-xs text-slate-400">
                Ajoute <code className="bg-slate-100 px-1 rounded">NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY</code> dans ton <code className="bg-slate-100 px-1 rounded">.env.local</code> pour le tester en développement.
              </p>
            </div>

          ) : fetchError ? (
            /* Erreur API */
            <div className="max-w-md mx-auto w-full text-center py-10">
              <div className="w-12 h-12 rounded-full bg-[#FEE2E2] flex items-center justify-center mx-auto mb-4">
                <RefreshCw className="w-5 h-5 text-[#EF4444]" />
              </div>
              <p className="text-sm text-[#EF4444] mb-4 font-medium">{fetchError}</p>
              <button
                onClick={() => setFetchError(null)}
                className="text-sm text-[#2563EB] underline font-medium"
              >
                Réessayer
              </button>
              <button
                onClick={() => router.push('/pricing')}
                className="block mx-auto mt-2 text-sm text-slate-400 underline"
              >
                Retour au choix du plan
              </button>
            </div>

          ) : isComplete ? (
            /* Confirmation paiement */
            <div className="max-w-md mx-auto w-full text-center py-10">
              <div className="w-14 h-14 rounded-full bg-[#D1FAE5] flex items-center justify-center mx-auto mb-4">
                <Check className="w-7 h-7 text-[#10B981]" />
              </div>
              <h2 className="text-lg font-bold text-[#0F172A] mb-2">Paiement confirmé !</h2>
              <p className="text-sm text-slate-500">Redirection vers votre espace…</p>
              <div className="mt-4 flex justify-center">
                <div className="w-5 h-5 border-2 border-[#2563EB] border-t-transparent rounded-full animate-spin" />
              </div>
            </div>

          ) : (
            /* Formulaire Stripe Embedded — brandé via Appearance API */
            <div className="w-full max-w-lg mx-auto">

              {/* Spinner visible pendant le chargement initial de l'iframe Stripe */}
              {!stripeReady && (
                <div className="flex flex-col items-center justify-center py-16 gap-3">
                  <Loader2 className="w-7 h-7 text-[#2563EB] animate-spin" />
                  <p className="text-sm text-slate-400">Chargement du formulaire…</p>
                </div>
              )}

              {/* Le provider est toujours monté (pour que fetchClientSecret s'exécute),
                  on le masque juste visuellement tant que stripeReady est false */}
              <div className={stripeReady ? 'block' : 'invisible h-0 overflow-hidden'}>
                <EmbeddedCheckoutProvider
                  stripe={stripePromise}
                  options={{
                    fetchClientSecret,
                    onComplete: handleComplete,
                    appearance: stripeAppearance,
                    fonts:      stripeFonts,
                  } as Parameters<typeof EmbeddedCheckoutProvider>[0]['options']}
                >
                  <EmbeddedCheckout />
                </EmbeddedCheckoutProvider>
              </div>

            </div>
          )}

        </div>
      </div>
    </div>
  )
}
