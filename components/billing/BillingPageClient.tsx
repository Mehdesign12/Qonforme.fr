'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  CheckCircle2,
  AlertCircle,
  XCircle,
  Clock,
  Loader2,
  ExternalLink,
  Zap,
  Crown,
  CreditCard,
} from 'lucide-react'
import { PLANS } from '@/lib/stripe/plans'
import type { Subscription } from '@/lib/stripe/subscription'

interface BillingPageClientProps {
  subscription: Subscription | null
  invoicesThisMonth: number
}

function formatDate(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

const STATUS_CONFIG = {
  active: {
    icon: CheckCircle2,
    label: 'Actif',
    color: 'text-[#10B981]',
    bg: 'bg-[#D1FAE5]',
    border: 'border-[#6EE7B7]',
  },
  past_due: {
    icon: AlertCircle,
    label: 'Paiement en échec',
    color: 'text-[#D97706]',
    bg: 'bg-[#FEF3C7]',
    border: 'border-[#FCD34D]',
  },
  canceled: {
    icon: XCircle,
    label: 'Annulé',
    color: 'text-[#EF4444]',
    bg: 'bg-[#FEE2E2]',
    border: 'border-[#FCA5A5]',
  },
  incomplete: {
    icon: Clock,
    label: 'En attente de paiement',
    color: 'text-[#6B7280]',
    bg: 'bg-[#F1F5F9]',
    border: 'border-[#CBD5E1]',
  },
}

export default function BillingPageClient({
  subscription,
  invoicesThisMonth,
}: BillingPageClientProps) {
  const router = useRouter()
  const [loadingPortal, setLoadingPortal] = useState(false)
  const [portalError, setPortalError] = useState<string | null>(null)

  const plan = subscription ? PLANS[subscription.plan] : null
  const statusConfig = subscription
    ? STATUS_CONFIG[subscription.status]
    : STATUS_CONFIG.incomplete
  const StatusIcon = statusConfig.icon

  async function handleManageSubscription() {
    setLoadingPortal(true)
    setPortalError(null)
    try {
      const res = await fetch('/api/stripe/portal')
      const data = await res.json()
      if (!res.ok) {
        setPortalError(data.error ?? 'Erreur lors de l\'ouverture du portail')
        setLoadingPortal(false)
        return
      }
      window.location.href = data.url
    } catch {
      setPortalError('Erreur réseau. Réessaie.')
      setLoadingPortal(false)
    }
  }

  // Pas d'abonnement du tout → invite à choisir un plan
  if (!subscription) {
    return (
      <div className="bg-white rounded-xl border border-[#E2E8F0] p-8 text-center max-w-md mx-auto">
        <div className="w-14 h-14 rounded-full bg-[#EFF6FF] flex items-center justify-center mx-auto mb-4">
          <CreditCard className="w-7 h-7 text-[#2563EB]" />
        </div>
        <h2 className="text-lg font-semibold text-[#0F172A] mb-2">
          Aucun abonnement actif
        </h2>
        <p className="text-sm text-slate-500 mb-6">
          Choisis un plan pour accéder à toutes les fonctionnalités de Qonforme.
        </p>
        <button
          onClick={() => router.push('/pricing')}
          className="w-full bg-[#2563EB] hover:bg-[#1D4ED8] text-white font-semibold py-2.5 px-4 rounded-xl transition-colors flex items-center justify-center gap-2"
        >
          <Zap className="w-4 h-4" />
          Choisir un plan
        </button>
      </div>
    )
  }

  const isStarter = subscription.plan === 'starter'
  const invoiceLimit = plan?.invoiceLimit ?? null
  const invoicePercent = invoiceLimit
    ? Math.min(100, Math.round((invoicesThisMonth / invoiceLimit) * 100))
    : 0
  const isNearLimit = invoiceLimit !== null && invoicesThisMonth >= invoiceLimit * 0.8

  return (
    <div className="space-y-5 max-w-2xl">

      {/* Alerte si abonnement inactif */}
      {(subscription.status === 'past_due' || subscription.status === 'canceled' || subscription.status === 'incomplete') && (
        <div className="bg-[#FEF3C7] border border-[#FCD34D] rounded-xl px-4 py-3 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-[#D97706] shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-[#92400E]">
              {subscription.status === 'past_due'
                ? 'Paiement en échec — Mets à jour ta carte bancaire pour rétablir l\'accès'
                : subscription.status === 'canceled'
                ? 'Abonnement annulé — Renouvelle ton abonnement pour retrouver l\'accès'
                : 'Paiement en attente — Finalise ton paiement pour accéder à l\'application'}
            </p>
          </div>
        </div>
      )}

      {/* Carte plan actuel */}
      <div className="bg-white rounded-xl border border-[#E2E8F0] p-6">
        <div className="flex items-start justify-between gap-4 mb-5">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${isStarter ? 'bg-[#EFF6FF]' : 'bg-[#FFF7ED]'}`}>
              {isStarter
                ? <Zap className="w-5 h-5 text-[#2563EB]" />
                : <Crown className="w-5 h-5 text-[#EA580C]" />
              }
            </div>
            <div>
              <h2 className="text-base font-semibold text-[#0F172A]">
                Plan {plan?.name}
              </h2>
              <p className="text-sm text-slate-500">
                {subscription.billing_period === 'monthly' ? 'Facturation mensuelle' : 'Facturation annuelle'}
                {' · '}
                {subscription.billing_period === 'monthly'
                  ? `${plan?.monthlyPrice}€/mois HT`
                  : `${plan?.yearlyPrice}€/an HT`
                }
              </p>
            </div>
          </div>

          {/* Badge statut */}
          <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full border ${statusConfig.bg} ${statusConfig.color} ${statusConfig.border}`}>
            <StatusIcon className="w-3.5 h-3.5" />
            {statusConfig.label}
          </span>
        </div>

        {/* Infos dates */}
        <div className="grid grid-cols-2 gap-4 text-sm mb-5">
          <div>
            <p className="text-slate-400 text-xs mb-0.5">Prochain débit</p>
            <p className="font-medium text-[#0F172A]">
              {subscription.status === 'canceled'
                ? '—'
                : formatDate(subscription.current_period_end)
              }
            </p>
          </div>
          {subscription.canceled_at && (
            <div>
              <p className="text-slate-400 text-xs mb-0.5">Annulé le</p>
              <p className="font-medium text-[#EF4444]">
                {formatDate(subscription.canceled_at)}
              </p>
            </div>
          )}
        </div>

        {/* Compteur factures (Starter uniquement) */}
        {isStarter && invoiceLimit !== null && (
          <div className="mb-5 p-4 bg-[#F8FAFC] rounded-xl border border-[#E2E8F0]">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-medium text-[#0F172A]">Factures ce mois-ci</p>
              <p className={`text-sm font-bold ${isNearLimit ? 'text-[#D97706]' : 'text-[#0F172A]'}`}>
                {invoicesThisMonth} / {invoiceLimit}
              </p>
            </div>
            <div className="w-full bg-[#E2E8F0] rounded-full h-2">
              <div
                className={`h-2 rounded-full transition-all ${
                  invoicePercent >= 100 ? 'bg-[#EF4444]'
                  : invoicePercent >= 80 ? 'bg-[#D97706]'
                  : 'bg-[#2563EB]'
                }`}
                style={{ width: `${invoicePercent}%` }}
              />
            </div>
            {invoicesThisMonth >= invoiceLimit && (
              <p className="text-xs text-[#EF4444] mt-2">
                Limite atteinte — les nouvelles factures sont bloquées.{' '}
                <button
                  onClick={handleManageSubscription}
                  className="underline font-medium"
                >
                  Passer au Pro
                </button>
              </p>
            )}
          </div>
        )}

        {/* CTA Portail Stripe */}
        <button
          onClick={handleManageSubscription}
          disabled={loadingPortal}
          className="w-full border border-[#E2E8F0] hover:border-[#2563EB] hover:bg-[#EFF6FF] text-[#0F172A] font-medium py-2.5 px-4 rounded-xl transition-colors flex items-center justify-center gap-2 text-sm disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {loadingPortal ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Ouverture…
            </>
          ) : (
            <>
              <ExternalLink className="w-4 h-4" />
              Gérer mon abonnement
            </>
          )}
        </button>

        {portalError && (
          <p className="text-xs text-[#EF4444] mt-2 text-center">{portalError}</p>
        )}

        <p className="text-xs text-slate-400 text-center mt-3">
          Changement de plan, mise à jour CB, annulation — via le portail sécurisé Stripe
        </p>
      </div>
    </div>
  )
}
