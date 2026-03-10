'use client'

import { useCallback, useState } from 'react'
import {
  EmbeddedCheckout,
  EmbeddedCheckoutProvider,
} from '@stripe/react-stripe-js'
import { loadStripe } from '@stripe/stripe-js'
import { X } from 'lucide-react'
import type { PlanId, BillingPeriod } from '@/lib/stripe/plans'

// Initialisation Stripe (singleton)
const stripePromise = loadStripe(
  process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? ''
)

interface EmbeddedCheckoutModalProps {
  planId: PlanId
  billingPeriod: BillingPeriod
  onClose: () => void
}

export default function EmbeddedCheckoutModal({
  planId,
  billingPeriod,
  onClose,
}: EmbeddedCheckoutModalProps) {
  const [fetchError, setFetchError] = useState<string | null>(null)

  // fetchClientSecret est appelé par Stripe dès que le composant monte
  const fetchClientSecret = useCallback(async () => {
    setFetchError(null)
    const res = await fetch('/api/stripe/checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ planId, billingPeriod }),
    })
    const data = await res.json()
    if (!res.ok || !data.clientSecret) {
      setFetchError(data.error ?? 'Impossible de charger le formulaire de paiement.')
      return ''
    }
    return data.clientSecret as string
  }, [planId, billingPeriod])

  return (
    // Overlay
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto py-6 px-4">
      {/* Fond assombri — clic ne ferme pas (cohérent avec WelcomeModal) */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

      {/* Conteneur modal */}
      <div className="relative z-10 w-full max-w-lg bg-white rounded-2xl shadow-2xl overflow-hidden my-auto">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#E2E8F0]">
          <div>
            <p className="text-xs text-slate-400 uppercase tracking-wide font-semibold mb-0.5">
              Abonnement sécurisé
            </p>
            <h2 className="text-base font-bold text-[#0F172A]">
              Finaliser votre abonnement
            </h2>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-[#F1F5F9] transition-colors"
            aria-label="Fermer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Formulaire Stripe Embedded */}
        <div className="p-2">
          {fetchError ? (
            <div className="p-6 text-center">
              <p className="text-sm text-[#EF4444] mb-3">{fetchError}</p>
              <button
                onClick={onClose}
                className="text-sm text-[#2563EB] underline"
              >
                Retour au choix du plan
              </button>
            </div>
          ) : (
            <EmbeddedCheckoutProvider
              stripe={stripePromise}
              options={{ fetchClientSecret }}
            >
              <EmbeddedCheckout />
            </EmbeddedCheckoutProvider>
          )}
        </div>
      </div>
    </div>
  )
}
