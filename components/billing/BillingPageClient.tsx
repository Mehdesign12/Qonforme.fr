'use client'

import { useState } from 'react'
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
  Check,
  ArrowUpRight,
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
  const [loadingPortal, setLoadingPortal] = useState(false)
  const [portalError, setPortalError] = useState<string | null>(null)

  const plan = subscription?.plan ? PLANS[subscription.plan] : null
  const statusKey =
    subscription?.status && STATUS_CONFIG[subscription.status as keyof typeof STATUS_CONFIG]
      ? (subscription.status as keyof typeof STATUS_CONFIG)
      : 'incomplete'
  const statusConfig = STATUS_CONFIG[statusKey]
  const StatusIcon = statusConfig.icon

  async function handleManageSubscription() {
    setLoadingPortal(true)
    setPortalError(null)
    try {
      const res = await fetch('/api/stripe/portal')
      const data = await res.json()
      if (!res.ok) {
        setPortalError(data.error ?? "Erreur lors de l'ouverture du portail")
        setLoadingPortal(false)
        return
      }
      window.location.href = data.url
    } catch {
      setPortalError('Erreur réseau. Réessaie.')
      setLoadingPortal(false)
    }
  }

  // ── Pas d'abonnement du tout ─────────────────────────────────────────────
  if (!subscription) {
    return (
      <div className="bg-white rounded-xl border border-[#E2E8F0] p-8 text-center max-w-md mx-auto">
        <div className="w-14 h-14 rounded-full bg-[#EFF6FF] flex items-center justify-center mx-auto mb-4">
          <CreditCard className="w-7 h-7 text-[#2563EB]" />
        </div>
        <h2 className="text-lg font-semibold text-[#0F172A] mb-2">Aucun abonnement actif</h2>
        <p className="text-sm text-slate-500 mb-6">
          Choisis un plan pour accéder à toutes les fonctionnalités de Qonforme.
        </p>
        <button
          onClick={() => (window.location.href = '/pricing')}
          className="w-full bg-[#2563EB] hover:bg-[#1D4ED8] text-white font-semibold py-2.5 px-4 rounded-xl transition-colors flex items-center justify-center gap-2"
        >
          <Zap className="w-4 h-4" />
          Choisir un plan
        </button>
      </div>
    )
  }

  const isStarter = subscription.plan === 'starter'
  const isPro = subscription.plan === 'pro'
  const invoiceLimit = plan?.invoiceLimit ?? null
  const invoicePercent = invoiceLimit
    ? Math.min(100, Math.round((invoicesThisMonth / invoiceLimit) * 100))
    : 0
  const isNearLimit = invoiceLimit !== null && invoicesThisMonth >= invoiceLimit * 0.8
  const proFeatures = PLANS.pro.features
  const starterFeatures = plan?.features ?? []

  return (
    <div className="space-y-5 max-w-2xl">

      {/* ── Alerte abonnement inactif ─────────────────────────────────── */}
      {(statusKey === 'past_due' || statusKey === 'canceled' || statusKey === 'incomplete') && (
        <div className="bg-[#FEF3C7] border border-[#FCD34D] rounded-xl px-4 py-3 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-[#D97706] shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-[#92400E]">
              {statusKey === 'past_due'
                ? "Paiement en échec — Mets à jour ta carte bancaire pour rétablir l'accès"
                : statusKey === 'canceled'
                ? "Abonnement annulé — Renouvelle ton abonnement pour retrouver l'accès"
                : "Paiement en attente — Finalise ton paiement pour accéder à l'application"}
            </p>
            <button
              onClick={handleManageSubscription}
              className="text-sm font-semibold text-[#92400E] underline mt-1"
            >
              Gérer mon abonnement →
            </button>
          </div>
        </div>
      )}

      {/* ── Carte plan actuel ─────────────────────────────────────────── */}
      <div className={`bg-white rounded-xl border-2 p-6 ${isPro ? 'border-[#2563EB]' : 'border-[#E2E8F0]'}`}>

        {/* En-tête plan */}
        <div className="flex items-start justify-between gap-4 mb-5">
          <div className="flex items-center gap-3">
            <div className={`w-11 h-11 rounded-xl flex items-center justify-center ${isStarter ? 'bg-[#EFF6FF]' : 'bg-gradient-to-br from-[#1D4ED8] to-[#7C3AED]'}`}>
              {isStarter
                ? <Zap className="w-5 h-5 text-[#2563EB]" />
                : <Crown className="w-5 h-5 text-white" />
              }
            </div>
            <div>
              <h2 className="text-base font-bold text-[#0F172A]">
                Plan {plan?.name ?? subscription.plan}
              </h2>
              <p className="text-sm text-slate-500">
                {subscription.billing_period === 'monthly' ? 'Facturation mensuelle' : 'Facturation annuelle'}
                {plan && (
                  <>
                    {' · '}
                    <span className="font-semibold text-[#0F172A]">
                      {subscription.billing_period === 'monthly'
                        ? `${plan.monthlyPrice} €/mois HT`
                        : `${plan.yearlyPrice} €/an HT`}
                    </span>
                  </>
                )}
              </p>
            </div>
          </div>

          {/* Badge statut */}
          <span
            className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full border ${statusConfig.bg} ${statusConfig.color} ${statusConfig.border}`}
          >
            <StatusIcon className="w-3.5 h-3.5" />
            {statusConfig.label}
          </span>
        </div>

        {/* Dates */}
        <div className="grid grid-cols-2 gap-4 text-sm mb-5 pb-5 border-b border-[#F1F5F9]">
          <div>
            <p className="text-slate-400 text-xs mb-0.5 uppercase tracking-wide">Prochain débit</p>
            <p className="font-semibold text-[#0F172A]">
              {statusKey === 'canceled' ? '—' : formatDate(subscription.current_period_end)}
            </p>
          </div>
          {subscription.canceled_at && (
            <div>
              <p className="text-slate-400 text-xs mb-0.5 uppercase tracking-wide">Annulé le</p>
              <p className="font-semibold text-[#EF4444]">{formatDate(subscription.canceled_at)}</p>
            </div>
          )}
        </div>

        {/* Compteur factures Starter */}
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
                  invoicePercent >= 100
                    ? 'bg-[#EF4444]'
                    : invoicePercent >= 80
                    ? 'bg-[#D97706]'
                    : 'bg-[#2563EB]'
                }`}
                style={{ width: `${invoicePercent}%` }}
              />
            </div>
            {invoicesThisMonth >= invoiceLimit && (
              <p className="text-xs text-[#EF4444] mt-2">
                Limite atteinte — les nouvelles factures sont bloquées.{' '}
                <button onClick={handleManageSubscription} className="underline font-semibold">
                  Passer au Pro
                </button>
              </p>
            )}
          </div>
        )}

        {/* Features du plan actuel */}
        <div className="mb-5">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3">
            Inclus dans ton plan
          </p>
          <ul className="grid grid-cols-1 sm:grid-cols-2 gap-y-2 gap-x-4">
            {starterFeatures.map((feature) => (
              <li key={feature} className="flex items-start gap-2 text-sm text-[#374151]">
                <Check className="w-4 h-4 text-[#10B981] shrink-0 mt-0.5" />
                {feature}
              </li>
            ))}
          </ul>
        </div>

        {/* Bouton portail */}
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

      {/* ── Carte upgrade Pro (Starter uniquement + abonnement actif) ─── */}
      {isStarter && statusKey === 'active' && (
        <div className="bg-gradient-to-br from-[#1E3A8A] to-[#1D4ED8] rounded-xl p-6 text-white">
          <div className="flex items-start justify-between mb-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Crown className="w-5 h-5 text-yellow-300" />
                <span className="text-sm font-bold text-yellow-300 uppercase tracking-wide">
                  Passez au Plan Pro
                </span>
              </div>
              <h3 className="text-lg font-bold">Déverrouillez tout Qonforme</h3>
              <p className="text-sm text-blue-200 mt-1">
                Factures illimitées, relances automatiques, tableau de bord CA complet.
              </p>
            </div>
            <div className="text-right shrink-0 ml-4">
              <p className="text-2xl font-bold">19 €</p>
              <p className="text-xs text-blue-200">/mois HT</p>
            </div>
          </div>

          {/* Features Pro que Starter n'a pas */}
          <ul className="grid grid-cols-1 sm:grid-cols-2 gap-y-1.5 gap-x-4 mb-5">
            {proFeatures.map((feature) => {
              const isNew = !starterFeatures.includes(feature)
              return (
                <li key={feature} className={`flex items-start gap-2 text-sm ${isNew ? 'text-white font-medium' : 'text-blue-200'}`}>
                  <Check className={`w-4 h-4 shrink-0 mt-0.5 ${isNew ? 'text-yellow-300' : 'text-blue-300'}`} />
                  {feature}
                  {isNew && (
                    <span className="ml-1 text-[10px] font-bold bg-yellow-300 text-yellow-900 px-1.5 py-0.5 rounded-full leading-none self-center">
                      NEW
                    </span>
                  )}
                </li>
              )
            })}
          </ul>

          <button
            onClick={handleManageSubscription}
            disabled={loadingPortal}
            className="w-full bg-white text-[#1D4ED8] hover:bg-blue-50 font-bold py-3 px-4 rounded-xl transition-colors flex items-center justify-center gap-2 text-sm disabled:opacity-60"
          >
            {loadingPortal ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Ouverture…
              </>
            ) : (
              <>
                <ArrowUpRight className="w-4 h-4" />
                Passer au Pro maintenant
              </>
            )}
          </button>
        </div>
      )}
    </div>
  )
}
