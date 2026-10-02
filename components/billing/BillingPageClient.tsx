'use client'

/**
 * Paramètres › Abonnement (planches « Paramètres — Abonnement » et « … — neuf »).
 *
 * Trois cas : version gratuite (jamais abonné, résilié, paiement abandonné),
 * formule active, formule en impayé (délai de grâce : l'émission continue).
 * Le remboursement « satisfait ou remboursé » se fait ici, sans contact humain.
 * Moyen de paiement, factures d'abonnement, changement de période et
 * résiliation passent par l'espace de paiement Stripe (portail client).
 *
 * Prix lus dans lib/stripe/plans.ts : Essentiel seul est vendu, Artisan
 * reste « bientôt » (DECISIONS § 12). Même composant pour la démo (`mode="demo"`).
 */
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { toast } from 'sonner'
import {
  AlertCircle,
  CalendarClock,
  Check,
  CheckCircle2,
  Clock,
  Download,
  ExternalLink,
  Loader2,
  ShieldCheck,
  Sparkles,
} from 'lucide-react'
import { PLANS, FREE_FEATURES, formatEuros, withVat } from '@/lib/stripe/plans'
import { canIssueInvoices, GUARANTEE_DAYS } from '@/lib/stripe/access'
import type { Subscription } from '@/lib/stripe/subscription'
import { formatCurrency } from '@/lib/utils/invoice'
import { PageHeader, StatusPill } from '@/components/app/kit'
import type { ShellMode } from '@/components/layout/nav'
import { formatSiren } from '@/components/layout/shell'
import { settingsHref } from '@/components/settings/sections'
import { SettingsCard } from '@/components/settings/ui'

export type GuaranteeInfo =
  | { eligible: true; endsAt: string; amountPaid: number }
  | { eligible: false; reason: 'used' | 'expired' | 'no_payment' | 'processing'; endsAt: string | null }

/** Moyen de paiement par défaut, lu chez Stripe (jamais le numéro complet). */
export type PaymentMethodInfo =
  | { kind: 'card'; brand: string; last4: string; expMonth: number; expYear: number }
  | { kind: 'sepa_debit'; last4: string }
  | { kind: 'other'; label: string }

/** Facture d'abonnement émise par Stripe. */
export interface BillingInvoice {
  id: string
  number: string | null
  /** Date ISO de la facture. */
  date: string
  /** Montant TTC en euros. */
  amount: number
  status: string
  pdfUrl: string | null
}

/** Coordonnées de l'entreprise reprises sur les factures d'abonnement. */
export interface BillingIdentity {
  name: string
  address: string
  siren: string
  email: string
}

interface BillingPageClientProps {
  subscription: Subscription | null
  guarantee: GuaranteeInfo | null
  cancelAtPeriodEnd: boolean
  paymentMethod?: PaymentMethodInfo | null
  invoices?: BillingInvoice[]
  identity?: BillingIdentity | null
  mode?: ShellMode
}

function formatDate(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
}

function shortDate(iso: string): string {
  return new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })
}

const demoToast = (what: string) =>
  toast(`Créez un compte pour ${what}`, {
    action: { label: "S'inscrire", onClick: () => { window.location.href = '/signup' } },
  })

/** Liste à coches (fonctions d'une formule). */
function FeatureList({ items }: { items: string[] }) {
  return (
    <ul className="grid grid-cols-1 gap-x-5 gap-y-2 sm:grid-cols-2 xl:grid-cols-3">
      {items.map((f) => (
        <li key={f} className="flex items-start gap-2 text-sm text-[var(--q-text-2)]">
          <Check className="mt-0.5 size-4 shrink-0 text-[var(--q-accent)]" strokeWidth={2.25} aria-hidden />
          {f}
        </li>
      ))}
    </ul>
  )
}

export default function BillingPageClient({
  subscription,
  guarantee,
  cancelAtPeriodEnd,
  paymentMethod = null,
  invoices = [],
  identity = null,
  mode = 'app',
}: BillingPageClientProps) {
  const demo = mode === 'demo'
  const router = useRouter()
  const [loadingPortal, setLoadingPortal] = useState(false)
  const [portalError, setPortalError] = useState<string | null>(null)

  async function openPortal() {
    if (demo) { demoToast('gérer votre abonnement'); return }
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
  const artisan = PLANS.pro
  const active = canIssueInvoices(subscription?.status)
  const plansHref = demo ? '/signup' : '/signup/plan'

  const header = (
    <PageHeader
      title="Abonnement"
      subtitle="Formule, paiement et factures Qonforme"
      backHref={settingsHref('/settings', mode)}
      backLabel="Paramètres"
    />
  )

  // ── Version gratuite ────────────────────────────────────────────────────
  if (!subscription || !active) {
    const ended = subscription?.status === 'canceled'
    return (
      <>
        {header}

        {ended && (
          <div className="q-banner" role="status">
            <CalendarClock className="mt-0.5 size-4 shrink-0" aria-hidden />
            <p>
              Votre formule {subscription?.plan ? PLANS[subscription.plan]?.name : ''} est terminée
              {subscription?.canceled_at ? <> depuis le {formatDate(subscription.canceled_at)}</> : null}.
              Vos factures restent consultables et téléchargeables.
            </p>
          </div>
        )}

        <SettingsCard id="formule" title="Votre formule">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex min-w-0 flex-col gap-1">
              <span className="flex flex-wrap items-center gap-2.5">
                <span className="q-display text-[28px] leading-tight text-[var(--q-ink)] md:text-[30px]">Version gratuite</span>
                <StatusPill tone="ok" icon={<Check strokeWidth={2.75} aria-hidden />}>Active</StatusPill>
              </span>
              <span className="text-sm text-[var(--q-text-4)]">Devis gratuits et illimités · aucun paiement demandé</span>
            </div>
            <Link href={plansHref} className="q-btn q-btn-primary">
              <Sparkles aria-hidden />
              Choisir une formule
            </Link>
          </div>
          <FeatureList items={FREE_FEATURES} />
        </SettingsCard>

        <SettingsCard id="emettre" title="Pour émettre vos factures">
          <p className="text-sm leading-relaxed text-[var(--q-text-3)]">
            Vous ne payez qu&apos;à votre première facture. La formule {essentiel.name} :{' '}
            <strong className="font-semibold text-[var(--q-ink)]">{formatEuros(essentiel.monthlyPrice)} HT par mois</strong>, ou{' '}
            {formatEuros(essentiel.yearlyMonthlyEquivalent)} HT par mois à l&apos;année ({formatEuros(essentiel.yearlyPrice)} HT,
            soit {formatEuros(withVat(essentiel.yearlyPrice))} TTC). La formule {artisan.name} arrive bientôt.
          </p>
          <FeatureList items={essentiel.features} />
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="flex flex-col gap-2 sm:flex-row">
              <Link href={plansHref} className="q-btn q-btn-primary">Choisir {essentiel.name}</Link>
              <Link href="/pricing" className="q-btn q-btn-secondary">Comparer sur la page tarifs</Link>
            </div>
            <span className="text-xs text-[var(--q-text-4)]">
              Satisfait ou remboursé {GUARANTEE_DAYS} jours · Sans engagement
            </span>
          </div>
        </SettingsCard>

        {identity && <IdentityCard identity={identity} future />}
        {invoices.length > 0 && <HistoryCard invoices={invoices} demo={demo} />}
      </>
    )
  }

  // ── Formule en cours ────────────────────────────────────────────────────
  const plan = PLANS[subscription.plan]
  const monthly = subscription.billing_period === 'monthly'
  const chargeHt = plan ? (monthly ? plan.monthlyPrice : plan.yearlyPrice) : null
  const pastDue = subscription.status === 'past_due'

  return (
    <>
      {header}

      {pastDue && (
        <div role="alert" className="q-banner q-banner-warn">
          <AlertCircle className="mt-0.5 size-5 shrink-0" aria-hidden />
          <div className="text-sm">
            <p className="font-semibold">Le dernier paiement n&apos;est pas passé.</p>
            <p className="mt-0.5 text-[var(--q-text-2)]">
              Une nouvelle tentative aura lieu automatiquement. Mettez à jour votre moyen de paiement pour que
              votre formule continue. Vos factures restent accessibles.
            </p>
            <button type="button" onClick={openPortal} className="mt-1 min-h-[44px] font-semibold underline">
              Mettre à jour mon moyen de paiement
            </button>
          </div>
        </div>
      )}

      <SettingsCard id="formule" title="Votre formule">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex min-w-0 flex-col gap-1">
            <span className="flex flex-wrap items-center gap-2.5">
              <span className="q-display text-[28px] leading-tight text-[var(--q-ink)] md:text-[30px]">{plan?.name ?? 'Formule'}</span>
              {pastDue
                ? <StatusPill tone="warn" icon={<AlertCircle strokeWidth={2.25} aria-hidden />}>Paiement en attente</StatusPill>
                : <StatusPill tone="ok" icon={<Check strokeWidth={2.75} aria-hidden />}>Active</StatusPill>}
            </span>
            <span className="text-sm text-[var(--q-text-4)]">
              {chargeHt !== null && (
                <>
                  <span className="font-semibold tabular-nums text-[var(--q-ink)]">{formatEuros(chargeHt)} HT</span>{' '}
                  {monthly ? 'par mois' : 'par an'} ({formatEuros(withVat(chargeHt))} TTC)
                </>
              )}
              {subscription.current_period_end && (
                <>
                  {' · '}
                  {cancelAtPeriodEnd
                    ? <>résiliation programmée, active jusqu&apos;au {formatDate(subscription.current_period_end)}</>
                    : <>prochain paiement le {formatDate(subscription.current_period_end)}</>}
                </>
              )}
            </span>
          </div>
          <div className="flex flex-col items-stretch gap-1.5 sm:items-end">
            <button type="button" onClick={openPortal} disabled={loadingPortal} className="q-btn q-btn-secondary">
              {loadingPortal ? <Loader2 className="animate-spin" aria-hidden /> : <ExternalLink aria-hidden />}
              {loadingPortal ? 'Ouverture…' : 'Gérer mon abonnement'}
            </button>
            {portalError && <p className="q-field-error" role="alert">{portalError}</p>}
          </div>
        </div>
        {plan && plan.features.length > 0 && <FeatureList items={plan.features} />}
        <p className="text-xs text-[var(--q-text-4)]">
          Moyen de paiement, factures d&apos;abonnement, passage à l&apos;année et résiliation : dans l&apos;espace de paiement sécurisé.
        </p>
      </SettingsCard>

      <div className="grid items-stretch gap-4 lg:grid-cols-2">
        <SettingsCard id="paiement" title="Moyen de paiement">
          <div className="flex items-center gap-3">
            <PaymentMethodBadge pm={paymentMethod} />
            <span className="flex min-w-0 flex-1 flex-col gap-0.5">
              {paymentMethod?.kind === 'card' && (
                <>
                  <span className="font-mono text-[15px] text-[var(--q-ink)]">•••• {paymentMethod.last4}</span>
                  <span className="text-xs text-[var(--q-text-4)]">
                    Expire {String(paymentMethod.expMonth).padStart(2, '0')}/{paymentMethod.expYear}
                  </span>
                </>
              )}
              {paymentMethod?.kind === 'sepa_debit' && (
                <>
                  <span className="text-[15px] font-semibold text-[var(--q-ink)]">Prélèvement SEPA</span>
                  <span className="font-mono text-xs text-[var(--q-text-4)]">IBAN •••• {paymentMethod.last4}</span>
                </>
              )}
              {paymentMethod?.kind === 'other' && (
                <span className="text-[15px] text-[var(--q-ink)]">{paymentMethod.label}</span>
              )}
              {!paymentMethod && (
                <span className="text-sm text-[var(--q-text-3)]">Enregistré dans l&apos;espace de paiement sécurisé.</span>
              )}
            </span>
            <button type="button" onClick={openPortal} disabled={loadingPortal} className="q-btn q-btn-ghost shrink-0">
              Modifier
            </button>
          </div>
        </SettingsCard>

        {identity
          ? <IdentityCard identity={identity} />
          : (
            <SettingsCard id="facturation" title="Facturation">
              <p className="text-sm text-[var(--q-text-3)]">
                Vos factures d&apos;abonnement portent le nom, l&apos;adresse et le SIREN de votre entreprise.
              </p>
            </SettingsCard>
          )}
      </div>

      {invoices.length > 0
        ? <HistoryCard invoices={invoices} demo={demo} />
        : (
          <SettingsCard id="historique" title="Historique de facturation">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm text-[var(--q-text-3)]">Vos factures d&apos;abonnement sont disponibles dans l&apos;espace de paiement.</p>
              <button type="button" onClick={openPortal} disabled={loadingPortal} className="q-btn q-btn-secondary q-btn-sm">
                <ExternalLink aria-hidden />
                Voir les factures
              </button>
            </div>
          </SettingsCard>
        )}

      {guarantee && <GuaranteeCard guarantee={guarantee} demo={demo} onDone={() => router.refresh()} />}

      <div>
        <button
          type="button"
          onClick={openPortal}
          disabled={loadingPortal}
          className="q-btn q-btn-ghost !px-3 !text-[var(--q-danger)] hover:!bg-[var(--q-danger-bg)]"
        >
          {cancelAtPeriodEnd ? 'Reprendre ou modifier la résiliation' : 'Résilier l’abonnement'}
        </button>
        <p className="px-3 text-xs text-[var(--q-text-4)]">
          {cancelAtPeriodEnd
            ? 'Dans l’espace de paiement sécurisé.'
            : 'Fin à l’échéance, dans l’espace de paiement sécurisé. Vos documents restent consultables.'}
        </p>
      </div>
    </>
  )
}

/* ------------------------------------------------------------------ */
/* Cartes                                                              */
/* ------------------------------------------------------------------ */

function PaymentMethodBadge({ pm }: { pm: PaymentMethodInfo | null }) {
  const label =
    pm?.kind === 'card' ? (pm.brand === 'visa' ? 'VISA' : pm.brand === 'mastercard' ? 'MC' : pm.brand.slice(0, 4).toUpperCase())
      : pm?.kind === 'sepa_debit' ? 'SEPA'
        : '•••'
  return (
    <span className="grid h-[30px] w-[44px] shrink-0 place-items-center rounded-md bg-[#0A1122] text-[10px] font-bold tracking-wide text-white">
      {label}
    </span>
  )
}

function IdentityCard({ identity, future }: { identity: BillingIdentity; future?: boolean }) {
  return (
    <SettingsCard id="facturation" title="Facturation">
      <div className="flex flex-col gap-1 text-sm text-[var(--q-text-3)]">
        <span className="font-semibold text-[var(--q-ink)]">{identity.name || 'Votre entreprise'}</span>
        {identity.address && <span>{identity.address}</span>}
        {identity.siren && <span>SIREN <span className="font-mono">{formatSiren(identity.siren) ?? identity.siren}</span></span>}
        {identity.email && <span>E-mail du compte : {identity.email}</span>}
      </div>
      <p className="text-xs text-[var(--q-text-4)]">
        {future
          ? 'Ces informations figureront sur vos factures d’abonnement.'
          : 'Ces informations figurent sur vos factures d’abonnement.'}
      </p>
    </SettingsCard>
  )
}

const INVOICE_STATUS: Record<string, { label: string; tone: 'ok' | 'warn' | 'danger' | 'neutral' }> = {
  paid: { label: 'Payée', tone: 'ok' },
  open: { label: 'À régler', tone: 'warn' },
  uncollectible: { label: 'Impayée', tone: 'danger' },
  void: { label: 'Annulée', tone: 'neutral' },
}

function HistoryCard({ invoices, demo }: { invoices: BillingInvoice[]; demo: boolean }) {
  return (
    <section aria-labelledby="historique-titre" className="q-card overflow-hidden">
      <h2 id="historique-titre" className="q-h2 px-5 pb-3 pt-5">Historique de facturation</h2>
      <ul className="q-list border-t border-[var(--q-line-soft)]">
        {invoices.map((inv) => {
          const st = INVOICE_STATUS[inv.status] ?? { label: inv.status, tone: 'neutral' as const }
          return (
            <li key={inv.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-5 py-3">
              <span className="w-[104px] shrink-0 text-sm text-[var(--q-text-3)]">{shortDate(inv.date)}</span>
              <span className="min-w-0 flex-1 truncate font-mono text-[13px] text-[var(--q-ink)]">{inv.number ?? 'Facture d’abonnement'}</span>
              <span className="text-sm font-semibold tabular-nums text-[var(--q-ink)]">{formatCurrency(inv.amount)}</span>
              <StatusPill tone={st.tone} icon={st.tone === 'ok' ? <Check strokeWidth={2.75} aria-hidden /> : undefined}>{st.label}</StatusPill>
              {demo ? (
                <button type="button" onClick={() => demoToast('télécharger vos factures')} className="q-btn q-btn-secondary q-btn-sm">
                  <Download aria-hidden />PDF
                </button>
              ) : inv.pdfUrl ? (
                <a href={inv.pdfUrl} target="_blank" rel="noopener noreferrer" className="q-btn q-btn-secondary q-btn-sm">
                  <Download aria-hidden />PDF
                </a>
              ) : null}
            </li>
          )
        })}
      </ul>
    </section>
  )
}

/** Garantie « satisfait ou remboursé » : remboursement en deux temps, sans contact humain. */
function GuaranteeCard({ guarantee, demo, onDone }: { guarantee: GuaranteeInfo; demo: boolean; onDone: () => void }) {
  const [confirming, setConfirming] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [refunded, setRefunded] = useState<number | null>(null)

  if (!guarantee.eligible) {
    if (guarantee.reason !== 'processing') return null
    return (
      <div className="q-card flex items-start gap-3 p-5">
        <Clock className="mt-0.5 size-5 shrink-0 text-[var(--q-text-4)]" aria-hidden />
        <p className="text-sm text-[var(--q-text-3)]">
          Votre premier prélèvement est en cours de confirmation par votre banque (quelques jours ouvrés).
          La garantie « satisfait ou remboursé » de {GUARANTEE_DAYS} jours démarrera à sa confirmation.
        </p>
      </div>
    )
  }

  async function refund() {
    if (demo) { demoToast('utiliser la garantie'); return }
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
      <div className="q-card flex items-start gap-3 p-5" role="status">
        <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-[var(--q-ok)]" aria-hidden />
        <p className="text-sm text-[var(--q-text-3)]">
          Remboursement de {formatEuros(refunded / 100)} lancé. Il apparaît sur votre compte sous quelques jours ouvrés.
          Votre compte repasse en version gratuite ; vos factures restent consultables.
        </p>
      </div>
    )
  }

  return (
    <SettingsCard
      id="garantie"
      title={<span className="flex items-center gap-2"><ShieldCheck className="size-[18px] text-[var(--q-ok)]" aria-hidden />Satisfait ou remboursé</span>}
      description={
        <>
          Jusqu&apos;au {formatDate(guarantee.endsAt)}, vous pouvez être remboursé intégralement
          ({formatEuros(guarantee.amountPaid / 100)}), sans avoir à vous justifier.
        </>
      }
    >
      {!confirming ? (
        <button type="button" onClick={() => setConfirming(true)} className="q-btn q-btn-secondary self-start">
          Être remboursé et arrêter ma formule
        </button>
      ) : (
        <div className="q-inset flex flex-col gap-3 p-4">
          <p className="text-sm text-[var(--q-text-3)]">
            Votre formule s&apos;arrête tout de suite et votre compte repasse en version gratuite. Les factures
            déjà envoyées restent émises et consultables ; vous ne pourrez plus en envoyer de nouvelles.
          </p>
          <div className="flex flex-col gap-2 sm:flex-row">
            <button type="button" onClick={refund} disabled={loading} className="q-btn q-btn-danger">
              {loading && <Loader2 className="animate-spin" aria-hidden />}
              Confirmer le remboursement
            </button>
            <button type="button" onClick={() => setConfirming(false)} disabled={loading} className="q-btn q-btn-secondary">
              Garder ma formule
            </button>
          </div>
        </div>
      )}

      {error && <p className="q-field-error text-sm" role="alert">{error}</p>}
    </SettingsCard>
  )
}
