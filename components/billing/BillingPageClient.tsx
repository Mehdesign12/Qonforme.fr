'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  AlertCircle,
  CalendarClock,
  Check,
  CheckCircle2,
  Clock,
  ExternalLink,
  Loader2,
  ShieldCheck,
} from 'lucide-react'
import { PLANS, FREE_FEATURES, formatEuros, withVat } from '@/lib/stripe/plans'
import { canIssueInvoices, GUARANTEE_DAYS } from '@/lib/stripe/access'
import type { Subscription } from '@/lib/stripe/subscription'

export type GuaranteeInfo =
  | { eligible: true; endsAt: string; amountPaid: number }
  | { eligible: false; reason: 'used' | 'expired' | 'no_payment' | 'processing'; endsAt: string | null }

interface BillingPageClientProps {
  subscription: Subscription | null
  guarantee: GuaranteeInfo | null
  cancelAtPeriodEnd: boolean
}

function formatDate(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
}

const card = 'bg-white dark:bg-[#0F1E35] rounded-xl border border-[#E2E8F0] dark:border-[#1E3A5F] p-6'
const btnPrimary = 'inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-[#2563EB] px-5 text-sm font-semibold text-white hover:bg-[#1D4ED8] transition-colors disabled:opacity-60'
const btnSecondary = 'inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-[#E2E8F0] dark:border-[#1E3A5F] px-5 text-sm font-medium text-[#0F172A] dark:text-[#E2E8F0] hover:border-[#94A3B8] transition-colors disabled:opacity-60'

/**
 * Paramètres › Abonnement.
 *
 * Trois cas : version gratuite (jamais abonné, résilié, paiement abandonné),
 * formule active, formule en impayé (délai de grâce : l'émission continue).
 * Le remboursement « satisfait ou remboursé » se fait ici, sans contact humain.
 */
export default function BillingPageClient({ subscription, guarantee, cancelAtPeriodEnd }: BillingPageClientProps) {
  const router = useRouter()
  const [loadingPortal, setLoadingPortal] = useState(false)
  const [portalError, setPortalError] = useState<string | null>(null)

  async function openPortal() {
    setLoadingPortal(true)
    setPortalError(null)
    try {
      const res = await fetch('/api/stripe/portal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'manage' }),
      })
      const data = await res.json()
      if (!res.ok) {
        setPortalError(data.error ?? "L'espace de paiement n'a pas pu s'ouvrir.")
        setLoadingPortal(false)
        return
      }
      window.location.href = data.url
    } catch {
      setPortalError('Erreur réseau. Réessayez.')
      setLoadingPortal(false)
    }
  }

  const essentiel = PLANS.starter
  const active = canIssueInvoices(subscription?.status)

  // ── Version gratuite ────────────────────────────────────────────────────
  if (!subscription || !active) {
    const ended = subscription?.status === 'canceled'
    return (
      <div className="space-y-5 max-w-2xl">
        {ended && (
          <div className="rounded-xl border border-[#E2E8F0] dark:border-[#1E3A5F] bg-[#F8FAFC] dark:bg-[#162032] px-4 py-3 text-sm text-slate-600 dark:text-slate-300">
            Votre formule {subscription?.plan ? PLANS[subscription.plan]?.name : ''} est terminée
            {subscription?.canceled_at ? <> depuis le {formatDate(subscription.canceled_at)}</> : null}.
            Vos factures restent consultables et téléchargeables.
          </div>
        )}

        <div className={card}>
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-base font-semibold text-[#0F172A] dark:text-[#E2E8F0]">Version gratuite</h2>
              <p className="text-sm text-slate-500 mt-1">Devis illimités, sans carte bancaire.</p>
            </div>
            <span className="rounded-full bg-[#F1F5F9] dark:bg-[#162032] px-2.5 py-1 text-xs font-semibold text-slate-600 dark:text-slate-300">0 €</span>
          </div>
          <ul className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-y-2 gap-x-4">
            {FREE_FEATURES.map((f) => (
              <li key={f} className="flex items-start gap-2 text-sm text-[#334155] dark:text-slate-300">
                <Check className="w-4 h-4 text-[#059669] shrink-0 mt-0.5" aria-hidden />
                {f}
              </li>
            ))}
          </ul>
        </div>

        <div className={`${card} border-[#2563EB] dark:border-[#2563EB]`}>
          <h2 className="text-base font-semibold text-[#0F172A] dark:text-[#E2E8F0]">Pour envoyer vos factures : {essentiel.name}</h2>
          <p className="text-sm text-slate-500 mt-1">
            {formatEuros(essentiel.monthlyPrice)} HT par mois, ou {formatEuros(essentiel.yearlyMonthlyEquivalent)} HT par mois à l&apos;année
            ({formatEuros(essentiel.yearlyPrice)} HT, soit {formatEuros(withVat(essentiel.yearlyPrice))} TTC).
          </p>
          <ul className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-y-2 gap-x-4">
            {essentiel.features.map((f) => (
              <li key={f} className="flex items-start gap-2 text-sm text-[#334155] dark:text-slate-300">
                <Check className="w-4 h-4 text-[#059669] shrink-0 mt-0.5" aria-hidden />
                {f}
              </li>
            ))}
          </ul>
          <div className="mt-5 flex flex-col sm:flex-row sm:items-center gap-3">
            <Link href="/signup/plan" className={btnPrimary}>Choisir {essentiel.name}</Link>
            <span className="text-xs text-slate-500">Satisfait ou remboursé {GUARANTEE_DAYS} jours · Sans engagement</span>
          </div>
        </div>
      </div>
    )
  }

  // ── Formule en cours ────────────────────────────────────────────────────
  const plan = PLANS[subscription.plan]
  const monthly = subscription.billing_period === 'monthly'
  const chargeHt = plan ? (monthly ? plan.monthlyPrice : plan.yearlyPrice) : null
  const pastDue = subscription.status === 'past_due'

  return (
    <div className="space-y-5 max-w-2xl">
      {pastDue && (
        <div role="alert" className="rounded-xl border border-[#FCD34D] bg-[#FEF3C7] px-4 py-3 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-[#D97706] shrink-0 mt-0.5" aria-hidden />
          <div className="text-sm text-[#92400E]">
            <p className="font-semibold">Le dernier paiement n&apos;est pas passé.</p>
            <p className="mt-0.5">
              Une nouvelle tentative aura lieu automatiquement. Mettez à jour votre moyen de paiement pour que
              votre formule continue. Vos factures restent accessibles.
            </p>
            <button type="button" onClick={openPortal} className="mt-2 font-semibold underline min-h-[44px]">
              Mettre à jour mon moyen de paiement
            </button>
          </div>
        </div>
      )}

      <div className={card}>
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-base font-semibold text-[#0F172A] dark:text-[#E2E8F0]">Formule {plan?.name ?? ''}</h2>
            <p className="text-sm text-slate-500 mt-1">
              {monthly ? 'Paiement mensuel' : 'Paiement annuel'}
              {chargeHt !== null && (
                <> · <span className="font-semibold text-[#0F172A] dark:text-[#E2E8F0]">{formatEuros(chargeHt)} HT</span> {monthly ? 'par mois' : 'par an'} ({formatEuros(withVat(chargeHt))} TTC)</>
              )}
            </p>
          </div>
          <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold ${
            pastDue ? 'border-[#FCD34D] bg-[#FEF3C7] text-[#92400E]' : 'border-[#6EE7B7] bg-[#D1FAE5] text-[#065F46]'
          }`}>
            {pastDue ? <AlertCircle className="w-3.5 h-3.5" aria-hidden /> : <CheckCircle2 className="w-3.5 h-3.5" aria-hidden />}
            {pastDue ? 'Paiement en attente' : 'Active'}
          </span>
        </div>

        {subscription.current_period_end && (
          <p className="mt-4 flex items-start gap-2 text-sm text-slate-600 dark:text-slate-300">
            <CalendarClock className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" aria-hidden />
            <span>
              {cancelAtPeriodEnd
                ? <>Résiliation programmée : la formule reste active jusqu&apos;au <strong className="font-semibold">{formatDate(subscription.current_period_end)}</strong>.</>
                : <>Prochain paiement le <strong className="font-semibold">{formatDate(subscription.current_period_end)}</strong>.</>}
            </span>
          </p>
        )}

        {plan && plan.features.length > 0 && (
          <ul className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-y-2 gap-x-4">
            {plan.features.map((f) => (
              <li key={f} className="flex items-start gap-2 text-sm text-[#334155] dark:text-slate-300">
                <Check className="w-4 h-4 text-[#059669] shrink-0 mt-0.5" aria-hidden />
                {f}
              </li>
            ))}
          </ul>
        )}

        <div className="mt-6 flex flex-col gap-2">
          <button type="button" onClick={openPortal} disabled={loadingPortal} className={btnSecondary}>
            {loadingPortal ? <Loader2 className="w-4 h-4 animate-spin" aria-hidden /> : <ExternalLink className="w-4 h-4" aria-hidden />}
            {loadingPortal ? 'Ouverture…' : 'Gérer mon abonnement'}
          </button>
          {portalError && <p className="text-xs text-[#DC2626] text-center">{portalError}</p>}
          <p className="text-xs text-slate-500 text-center">
            Moyen de paiement, factures d&apos;abonnement, passage à l&apos;année, résiliation.
          </p>
        </div>
      </div>

      {guarantee && <GuaranteeCard guarantee={guarantee} onDone={() => router.refresh()} />}
    </div>
  )
}

/** Garantie « satisfait ou remboursé » : remboursement en deux temps, sans contact humain. */
function GuaranteeCard({ guarantee, onDone }: { guarantee: GuaranteeInfo; onDone: () => void }) {
  const [confirming, setConfirming] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [refunded, setRefunded] = useState<number | null>(null)

  if (!guarantee.eligible) {
    if (guarantee.reason !== 'processing') return null
    return (
      <div className={`${card} flex items-start gap-3`}>
        <Clock className="w-5 h-5 text-slate-400 shrink-0 mt-0.5" aria-hidden />
        <p className="text-sm text-slate-600 dark:text-slate-300">
          Votre premier prélèvement est en cours de confirmation par votre banque (quelques jours ouvrés).
          La garantie « satisfait ou remboursé » de {GUARANTEE_DAYS} jours démarrera à sa confirmation.
        </p>
      </div>
    )
  }

  async function refund() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/stripe/guarantee', { method: 'POST' })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? 'Le remboursement n’a pas pu aboutir.')
        setLoading(false)
        return
      }
      setRefunded(data.refunded ?? 0)
      onDone()
    } catch {
      setError('Erreur réseau. Réessayez.')
      setLoading(false)
    }
  }

  if (refunded !== null) {
    return (
      <div className={`${card} flex items-start gap-3`} role="status">
        <CheckCircle2 className="w-5 h-5 text-[#059669] shrink-0 mt-0.5" aria-hidden />
        <p className="text-sm text-slate-600 dark:text-slate-300">
          Remboursement de {formatEuros(refunded / 100)} lancé. Il apparaît sur votre compte sous quelques jours ouvrés.
          Votre compte repasse en version gratuite ; vos factures restent consultables.
        </p>
      </div>
    )
  }

  return (
    <div className={card}>
      <div className="flex items-start gap-3">
        <ShieldCheck className="w-5 h-5 text-[#059669] shrink-0 mt-0.5" aria-hidden />
        <div>
          <h2 className="text-base font-semibold text-[#0F172A] dark:text-[#E2E8F0]">Satisfait ou remboursé</h2>
          <p className="text-sm text-slate-500 mt-1">
            Jusqu&apos;au {formatDate(guarantee.endsAt)}, vous pouvez être remboursé intégralement
            ({formatEuros(guarantee.amountPaid / 100)}), sans avoir à vous justifier.
          </p>
        </div>
      </div>

      {!confirming ? (
        <button type="button" onClick={() => setConfirming(true)} className={`${btnSecondary} mt-4 w-full`}>
          Être remboursé et arrêter ma formule
        </button>
      ) : (
        <div className="mt-4 rounded-xl border border-[#E2E8F0] dark:border-[#1E3A5F] bg-[#F8FAFC] dark:bg-[#162032] p-4">
          <p className="text-sm text-slate-600 dark:text-slate-300">
            Votre formule s&apos;arrête tout de suite et votre compte repasse en version gratuite. Les factures
            déjà envoyées restent émises et consultables ; vous ne pourrez plus en envoyer de nouvelles.
          </p>
          <div className="mt-3 flex flex-col sm:flex-row gap-2">
            <button type="button" onClick={refund} disabled={loading} className={`${btnPrimary} bg-[#DC2626] hover:bg-[#B91C1C]`}>
              {loading && <Loader2 className="w-4 h-4 animate-spin" aria-hidden />}
              Confirmer le remboursement
            </button>
            <button type="button" onClick={() => setConfirming(false)} disabled={loading} className={btnSecondary}>
              Garder ma formule
            </button>
          </div>
        </div>
      )}

      {error && <p className="mt-3 text-sm text-[#DC2626]" role="alert">{error}</p>}
    </div>
  )
}
