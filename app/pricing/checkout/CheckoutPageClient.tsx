'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  EmbeddedCheckout,
  EmbeddedCheckoutProvider,
} from '@stripe/react-stripe-js'
import { loadStripe } from '@stripe/stripe-js'
import { Check, Zap, Crown, ArrowLeft, Shield, RefreshCw } from 'lucide-react'
import { PLANS, type PlanId, type BillingPeriod } from '@/lib/stripe/plans'

// Singleton Stripe — initialisé une seule fois
const stripePromise = loadStripe(
  process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? ''
)

interface CheckoutPageClientProps {
  planId: PlanId
  billingPeriod: BillingPeriod
}

export default function CheckoutPageClient({
  planId,
  billingPeriod,
}: CheckoutPageClientProps) {
  const router = useRouter()
  const plan = PLANS[planId]
  const isPro = planId === 'pro'

  const price =
    billingPeriod === 'monthly' ? plan.monthlyPrice : plan.yearlyMonthlyEquivalent
  const billingLabel =
    billingPeriod === 'monthly'
      ? `${plan.monthlyPrice} €/mois HT`
      : `${plan.yearlyPrice} €/an HT · soit ${plan.yearlyMonthlyEquivalent} €/mois`

  const [fetchError, setFetchError] = useState<string | null>(null)
  const [isComplete, setIsComplete] = useState(false)
  // Ref pour éviter double-redirect en StrictMode
  const redirected = useRef(false)

  // Mémoïsé une seule fois — Stripe refuse les changements de onComplete après mount
  const handleComplete = useCallback(() => {
    setIsComplete(true)
  }, []) // dépendances vides = stable pour toute la durée de vie du composant

  // Redirige vers le dashboard dès que Stripe confirme le paiement
  useEffect(() => {
    if (isComplete && !redirected.current) {
      redirected.current = true
      // Petit délai pour que Stripe finisse d'afficher sa confirmation avant nav
      setTimeout(() => router.replace('/dashboard?welcome=1'), 800)
    }
  }, [isComplete, router])

  const fetchClientSecret = useCallback(async () => {
    setFetchError(null)
    try {
      const res = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ planId, billingPeriod }),
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

  return (
    /*
     * Plein écran fixe — hauteur = 100dvh (dynamic viewport height, gère
     * les barres mobiles). Pas de scroll global : les deux colonnes sont
     * autonomes.
     */
    <div className="h-[100dvh] flex flex-col lg:flex-row overflow-hidden bg-white">

      {/* ═══════════════════════════════════════════════════════════════
          COLONNE GAUCHE — Récapitulatif plan
          Desktop : 40 % de largeur, fixe, fond bleu foncé
          Mobile  : bande compacte en haut (hauteur auto)
      ══════════════════════════════════════════════════════════════════ */}
      <div className={`
        lg:w-[42%] lg:h-full lg:overflow-y-auto
        flex flex-col
        ${isPro
          ? 'bg-gradient-to-br from-[#1E3A8A] via-[#1D4ED8] to-[#2563EB]'
          : 'bg-gradient-to-br from-[#0F172A] via-[#1E293B] to-[#334155]'
        }
        text-white
        px-6 pt-5 pb-4
        lg:px-10 lg:pt-10 lg:pb-8
      `}>

        {/* Bouton retour */}
        <button
          onClick={() => router.push('/pricing')}
          className="flex items-center gap-1.5 text-sm text-white/60 hover:text-white transition-colors mb-6 lg:mb-8 self-start"
        >
          <ArrowLeft className="w-4 h-4" />
          Changer de plan
        </button>

        {/* Logo + plan */}
        <div className="flex items-center gap-3 mb-4 lg:mb-6">
          <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${
            isPro
              ? 'bg-white/15 ring-1 ring-white/20'
              : 'bg-white/10 ring-1 ring-white/15'
          }`}>
            {isPro
              ? <Crown className="w-5 h-5 text-yellow-300" />
              : <Zap className="w-5 h-5 text-blue-300" />
            }
          </div>
          <div>
            <p className="text-xs text-white/50 uppercase tracking-widest font-semibold">
              Qonforme
            </p>
            <h1 className="text-xl lg:text-2xl font-bold leading-tight">
              Plan {plan.name}
            </h1>
          </div>
        </div>

        {/* Prix */}
        <div className="mb-4 lg:mb-6">
          <div className="flex items-baseline gap-1.5">
            <span className="text-4xl lg:text-5xl font-extrabold">
              {price % 1 === 0 ? price : price.toFixed(2)}€
            </span>
            <span className="text-white/50 text-sm">/mois HT</span>
          </div>
          {billingPeriod === 'yearly' && (
            <p className="text-sm text-white/60 mt-1">
              Facturé {plan.yearlyPrice} €/an · 2 mois offerts
            </p>
          )}
          <p className="text-xs text-white/40 mt-1">{billingLabel}</p>
        </div>

        {/* Features — masquées sur mobile pour gagner de la place */}
        <ul className="hidden lg:flex flex-col gap-2.5 flex-1">
          {plan.features.map((f) => (
            <li key={f} className="flex items-start gap-2.5 text-sm text-white/85">
              <span className="mt-0.5 w-4 h-4 rounded-full bg-white/15 flex items-center justify-center shrink-0">
                <Check className="w-2.5 h-2.5 text-white" />
              </span>
              {f}
            </li>
          ))}
        </ul>

        {/* Features compactes sur mobile (3 premières seulement) */}
        <ul className="lg:hidden flex flex-col gap-1.5 mb-1">
          {plan.features.slice(0, 3).map((f) => (
            <li key={f} className="flex items-center gap-2 text-xs text-white/75">
              <Check className="w-3 h-3 text-white/60 shrink-0" />
              {f}
            </li>
          ))}
          {plan.features.length > 3 && (
            <li className="text-xs text-white/45 pl-5">
              + {plan.features.length - 3} autres avantages
            </li>
          )}
        </ul>

        {/* Badge sécurité — toujours visible */}
        <div className="flex items-center gap-2 mt-4 lg:mt-6 pt-4 lg:pt-6 border-t border-white/10">
          <Shield className="w-4 h-4 text-white/40 shrink-0" />
          <p className="text-xs text-white/40">
            Paiement sécurisé par Stripe · Résiliation à tout moment
          </p>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════
          COLONNE DROITE — Formulaire Stripe
          Desktop : 58 % de largeur, fixe, fond blanc
          Mobile  : prend tout le reste de la hauteur
      ══════════════════════════════════════════════════════════════════ */}
      <div className="flex-1 lg:h-full overflow-y-auto bg-[#F8FAFC] lg:bg-white">

        {/* Centrage vertical sur desktop */}
        <div className="min-h-full flex flex-col justify-start lg:justify-center px-4 py-4 lg:px-10 lg:py-8">

          {/* Erreur de chargement */}
          {fetchError ? (
            <div className="max-w-md mx-auto w-full text-center py-10">
              <div className="w-12 h-12 rounded-full bg-[#FEE2E2] flex items-center justify-center mx-auto mb-4">
                <RefreshCw className="w-5 h-5 text-[#EF4444]" />
              </div>
              <p className="text-sm text-[#EF4444] mb-4 font-medium">{fetchError}</p>
              <button
                onClick={() => {
                  setFetchError(null)
                  // Force re-mount du provider en changeant la key n'est pas nécessaire
                  // — fetchClientSecret sera rappelé automatiquement
                }}
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
            /* Écran de confirmation pendant la redirection */
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
            /* Formulaire Stripe Embedded */
            <div className="w-full max-w-md mx-auto lg:max-w-none">
              <EmbeddedCheckoutProvider
                stripe={stripePromise}
                options={{
                  fetchClientSecret,
                  onComplete: handleComplete, // stable grâce à useCallback([], [])
                }}
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
