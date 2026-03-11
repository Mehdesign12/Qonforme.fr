'use client'

import { useState } from 'react'
import Image from 'next/image'
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
  Calendar,
  RefreshCw,
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
    label: 'En attente',
    color: 'text-[#6B7280]',
    bg: 'bg-[#F1F5F9]',
    border: 'border-[#CBD5E1]',
  },
}

export default function BillingPageClient({
  subscription,
  invoicesThisMonth,
}: BillingPageClientProps) {
  const [loadingPortal, setLoadingPortal] = useState<'manage' | 'upgrade' | null>(null)
  const [portalError, setPortalError] = useState<string | null>(null)

  const plan = subscription?.plan ? PLANS[subscription.plan as keyof typeof PLANS] : null
  const statusKey =
    subscription?.status && STATUS_CONFIG[subscription.status as keyof typeof STATUS_CONFIG]
      ? (subscription.status as keyof typeof STATUS_CONFIG)
      : 'incomplete'
  const statusConfig = STATUS_CONFIG[statusKey]
  const StatusIcon = statusConfig.icon

  async function openPortal(action: 'manage' | 'upgrade') {
    setLoadingPortal(action)
    setPortalError(null)
    try {
      const res = await fetch('/api/stripe/portal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      })
      const data = await res.json()
      if (!res.ok) {
        setPortalError(data.error ?? "Erreur lors de l'ouverture du portail")
        setLoadingPortal(null)
        return
      }
      window.location.href = data.url
    } catch {
      setPortalError('Erreur réseau. Réessaie.')
      setLoadingPortal(null)
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

  // Features du plan courant ; features Pro exclusives
  const currentFeatures = plan?.features ?? []
  const proFeatures = PLANS.pro.features
  const proExclusiveFeatures = proFeatures.filter((f) => !currentFeatures.includes(f))

  // Prix affiché
  const displayPrice = plan
    ? subscription.billing_period === 'monthly'
      ? `${plan.monthlyPrice} €/mois HT`
      : `${plan.yearlyPrice} €/an HT`
    : null

  return (
    <div className="space-y-5 max-w-2xl">

      {/* ── Alerte si abonnement inactif ──────────────────────────────────── */}
      {statusKey === 'past_due' && (
        <div className="bg-[#FEF3C7] border border-[#FCD34D] rounded-xl px-4 py-3 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-[#D97706] shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-[#92400E]">
              Paiement en échec — Mets à jour ta carte bancaire pour rétablir l&apos;accès
            </p>
            <button
              onClick={() => openPortal('manage')}
              className="text-sm font-semibold text-[#92400E] underline mt-1"
            >
              Mettre à jour mes informations de paiement →
            </button>
          </div>
        </div>
      )}

      {statusKey === 'canceled' && (
        <div className="bg-[#FEE2E2] border border-[#FCA5A5] rounded-xl px-4 py-3 flex items-start gap-3">
          <XCircle className="w-5 h-5 text-[#EF4444] shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-[#991B1B]">
              Abonnement annulé — Renouvelle ton abonnement pour retrouver l&apos;accès
            </p>
            <button
              onClick={() => (window.location.href = '/pricing')}
              className="text-sm font-semibold text-[#991B1B] underline mt-1"
            >
              Voir les plans →
            </button>
          </div>
        </div>
      )}

      {/* ── Carte plan actuel ─────────────────────────────────────────────── */}
      <div className={`relative overflow-hidden bg-white rounded-xl border-2 p-6 ${isPro ? 'border-[#2563EB]' : 'border-[#E2E8F0]'}`}>
        {/* Q filigrane en fond de la card plan actif */}
        <div
          aria-hidden
          className="pointer-events-none absolute -right-8 -bottom-8 select-none"
          style={{ opacity: 0.06, zIndex: 0 }}
        >
          <Image src={PICTO_Q} alt="" width={180} height={180} className="w-[160px]" unoptimized />
        </div>

        {/* En-tête plan */}
        <div className="flex items-start justify-between gap-4 mb-5">
          <div className="flex items-center gap-3">
            <div className={`w-11 h-11 rounded-xl flex items-center justify-center ${
              isStarter ? 'bg-[#EFF6FF]' : 'bg-gradient-to-br from-[#1D4ED8] to-[#7C3AED]'
            }`}>
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
                {displayPrice && (
                  <>
                    {' · '}
                    <span className="font-semibold text-[#0F172A]">{displayPrice}</span>
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
        {subscription.current_period_end && statusKey !== 'canceled' && (
          <div className="flex items-center gap-2 text-sm text-slate-500 mb-5 pb-5 border-b border-[#F1F5F9]">
            <Calendar className="w-4 h-4 shrink-0 text-slate-400" />
            <span>
              {statusKey === 'active' ? 'Prochain renouvellement le' : 'Valable jusqu&apos;au'}{' '}
              <span className="font-semibold text-[#0F172A]">
                {formatDate(subscription.current_period_end)}
              </span>
            </span>
          </div>
        )}

        {subscription.canceled_at && (
          <div className="flex items-center gap-2 text-sm text-[#EF4444] mb-5 pb-5 border-b border-[#F1F5F9]">
            <XCircle className="w-4 h-4 shrink-0" />
            <span>
              Annulé le{' '}
              <span className="font-semibold">{formatDate(subscription.canceled_at)}</span>
            </span>
          </div>
        )}

        {/* Compteur factures Starter */}
        {isStarter && invoiceLimit !== null && (
          <div className="mb-5 p-4 bg-[#F8FAFC] rounded-xl border border-[#E2E8F0]">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-medium text-[#0F172A]">Factures ce mois-ci</p>
              <p className={`text-sm font-bold ${invoicePercent >= 80 ? 'text-[#D97706]' : 'text-[#0F172A]'}`}>
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
            {isNearLimit && invoicesThisMonth < invoiceLimit && (
              <p className="text-xs text-[#D97706] mt-2">
                Tu approches de ta limite mensuelle.{' '}
                <button onClick={() => openPortal('upgrade')} className="underline font-semibold">
                  Passer au Pro pour des factures illimitées
                </button>
              </p>
            )}
            {invoicesThisMonth >= invoiceLimit && (
              <p className="text-xs text-[#EF4444] mt-2">
                Limite atteinte — les nouvelles factures sont bloquées.{' '}
                <button onClick={() => openPortal('upgrade')} className="underline font-semibold">
                  Passer au Pro
                </button>
              </p>
            )}
          </div>
        )}

        {/* Features du plan actuel */}
        {currentFeatures.length > 0 && (
          <div className="mb-5">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3">
              Inclus dans ton plan
            </p>
            <ul className="grid grid-cols-1 sm:grid-cols-2 gap-y-2 gap-x-4">
              {currentFeatures.map((feature) => (
                <li key={feature} className="flex items-start gap-2 text-sm text-[#374151]">
                  <Check className="w-4 h-4 text-[#10B981] shrink-0 mt-0.5" />
                  {feature}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Bouton portail Stripe */}
        <button
          onClick={() => openPortal('manage')}
          disabled={loadingPortal !== null}
          className="w-full border border-[#E2E8F0] hover:border-[#2563EB] hover:bg-[#EFF6FF] text-[#0F172A] font-medium py-2.5 px-4 rounded-xl transition-colors flex items-center justify-center gap-2 text-sm disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {loadingPortal === 'manage' ? (
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
          Changement de CB, annulation, historique de facturation — via le portail sécurisé Stripe
        </p>
      </div>

      {/* ── Bloc upgrade Pro — visible pour tous les Starter ──────────────── */}
      {isStarter && statusKey !== 'canceled' && (
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

          {/* Ce que Pro ajoute par rapport à Starter */}
          {proExclusiveFeatures.length > 0 && (
            <div className="mb-5">
              <p className="text-xs font-semibold text-blue-300 uppercase tracking-wide mb-2">
                Uniquement en Pro
              </p>
              <ul className="grid grid-cols-1 sm:grid-cols-2 gap-y-1.5 gap-x-4">
                {proExclusiveFeatures.map((feature) => (
                  <li key={feature} className="flex items-start gap-2 text-sm text-white font-medium">
                    <Check className="w-4 h-4 shrink-0 mt-0.5 text-yellow-300" />
                    {feature}
                    <span className="ml-1 text-[10px] font-bold bg-yellow-300 text-yellow-900 px-1.5 py-0.5 rounded-full leading-none self-center whitespace-nowrap">
                      NEW
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Toutes les features Pro */}
          <div className="mb-5">
            <p className="text-xs font-semibold text-blue-300 uppercase tracking-wide mb-2">
              Tout ce qui est inclus
            </p>
            <ul className="grid grid-cols-1 sm:grid-cols-2 gap-y-1.5 gap-x-4">
              {proFeatures.map((feature) => {
                const isNew = !currentFeatures.includes(feature)
                return (
                  <li
                    key={feature}
                    className={`flex items-start gap-2 text-sm ${isNew ? 'text-white font-medium' : 'text-blue-200'}`}
                  >
                    <Check
                      className={`w-4 h-4 shrink-0 mt-0.5 ${isNew ? 'text-yellow-300' : 'text-blue-300'}`}
                    />
                    {feature}
                  </li>
                )
              })}
            </ul>
          </div>

          <button
            onClick={() => openPortal('upgrade')}
            disabled={loadingPortal !== null}
            className="w-full bg-white text-[#1D4ED8] hover:bg-blue-50 font-bold py-3 px-4 rounded-xl transition-colors flex items-center justify-center gap-2 text-sm disabled:opacity-60"
          >
            {loadingPortal === 'upgrade' ? (
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

          <p className="text-xs text-blue-300 text-center mt-3">
            Changement immédiat · Au prorata · Sans engagement
          </p>
        </div>
      )}

      {/* ── Message de rechargement si données manquantes ─────────────────── */}
      {!plan && subscription && (
        <div className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl p-4 flex items-center gap-3">
          <RefreshCw className="w-4 h-4 text-slate-400 shrink-0" />
          <p className="text-sm text-slate-500">
            Synchronisation en cours…{' '}
            <button
              onClick={() => window.location.reload()}
              className="underline text-[#2563EB] font-medium"
            >
              Recharger la page
            </button>
          </p>
        </div>
      )}
    </div>
  )
}
