'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Check, ShieldCheck } from 'lucide-react'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import { PLANS, formatEuros, withVat, type BillingPeriod } from '@/lib/stripe/plans'
import { GUARANTEE_DAYS, SUBSCRIPTION_REQUIRED } from '@/lib/stripe/access'
import { trackEvent } from '@/lib/meta-pixel'

/**
 * Mur de paiement « Votre facture est prête » — s'ouvre quand une route
 * d'émission répond 402 SUBSCRIPTION_REQUIRED (envoi, passage hors brouillon,
 * relance). Le choix de la formule mène au paiement, puis revient sur la
 * facture avec ?send=1 pour l'envoyer d'un clic.
 *
 * La vraie protection est côté serveur (requireIssuingAccess) : ce composant
 * n'est que l'explication et le chemin le plus court vers la formule.
 *
 * Présentation : fenêtre du kit (voile sombre, rayon 20), titre Bricolage,
 * jetons --q-* pour le thème sombre.
 */
export function PaywallDialog({
  open,
  onOpenChange,
  invoiceId,
  invoiceNumber,
  reason = 'send',
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  invoiceId?: string
  invoiceNumber?: string
  /** 'send' : première facture à envoyer ; 'remind' : relance d'un client. */
  reason?: 'send' | 'remind'
}) {
  const router = useRouter()
  const [period, setPeriod] = useState<BillingPeriod>('yearly')
  const plan = PLANS.starter

  const next = invoiceId ? `/invoices/${invoiceId}${reason === 'send' ? '?send=1' : ''}` : null
  const chargeHt = period === 'monthly' ? plan.monthlyPrice : plan.yearlyPrice

  const choose = () => {
    trackEvent('InitiateCheckout', {
      currency: 'EUR',
      value: chargeHt,
      content_name: plan.name,
      content_ids: [plan.id],
      num_items: 1,
    })
    const params = new URLSearchParams({ plan: plan.id, period })
    if (next) params.set('next', next)
    router.push(`/pricing/checkout?${params.toString()}`)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] gap-5 overflow-y-auto p-[22px] sm:max-w-[460px]">
        <div className="flex flex-col gap-1.5 pr-8">
          <DialogTitle className="q-display text-[22px] leading-tight text-[var(--q-ink)]">
            {reason === 'remind'
              ? 'Les relances font partie de la formule.'
              : invoiceNumber ? `Votre facture ${invoiceNumber} est prête.` : 'Votre facture est prête.'}
          </DialogTitle>
          <DialogDescription className="text-[15px] leading-relaxed text-[var(--q-text-3)]">
            {reason === 'remind'
              ? 'Choisissez votre formule pour relancer vos clients. Vos devis restent gratuits.'
              : 'Choisissez votre formule pour l’envoyer. Vos devis restent gratuits.'}
          </DialogDescription>
        </div>

        {/* Mensuel / annuel */}
        <div role="radiogroup" aria-label="Période de facturation" className="grid grid-cols-2 gap-2">
          {(['yearly', 'monthly'] as BillingPeriod[]).map((p) => {
            const selected = period === p
            const perMonth = p === 'monthly' ? plan.monthlyPrice : plan.yearlyMonthlyEquivalent
            return (
              <button
                key={p}
                type="button"
                role="radio"
                aria-checked={selected}
                onClick={() => setPeriod(p)}
                className={cn(
                  'flex flex-col items-start gap-0.5 rounded-xl border bg-[var(--q-surface)] p-3 text-left transition-colors outline-none focus-visible:shadow-[0_0_0_4px_var(--q-focus)]',
                  selected
                    ? 'border-[var(--q-accent)] shadow-[0_0_0_3px_var(--q-focus)]'
                    : 'border-[var(--q-field)] hover:bg-[var(--q-sunken)]',
                )}
              >
                <span className="text-sm font-semibold text-[var(--q-ink)]">
                  {p === 'yearly' ? 'Annuel' : 'Mensuel'}
                </span>
                <span className="text-lg font-semibold tabular-nums text-[var(--q-ink)]">
                  {formatEuros(perMonth)} <span className="text-xs font-normal text-[var(--q-text-4)]">HT / mois</span>
                </span>
                <span className={cn('text-xs font-semibold', p === 'yearly' ? 'text-[var(--q-ok)]' : 'text-[var(--q-text-4)]')}>
                  {p === 'yearly' ? '2 mois offerts' : 'Sans engagement'}
                </span>
              </button>
            )
          })}
        </div>

        <div className="q-inset p-4">
          <p className="text-sm font-semibold text-[var(--q-ink)]">{plan.name}</p>
          <ul className="mt-2 flex flex-col gap-1.5">
            {plan.features.slice(0, 4).map((f) => (
              <li key={f} className="flex items-start gap-2 text-sm text-[var(--q-text-2)]">
                <Check className="mt-0.5 size-4 shrink-0 text-[var(--q-ok)]" strokeWidth={2.5} aria-hidden />
                {f}
              </li>
            ))}
          </ul>
        </div>

        <div className="flex flex-col gap-2">
          <button type="button" onClick={choose} className="q-btn q-btn-primary q-btn-lg w-full">
            {reason === 'remind' ? `Choisir ${plan.name}` : `Choisir ${plan.name} et envoyer ma facture`}
          </button>
          <p className="text-center text-[13px] tabular-nums text-[var(--q-text-4)]">
            {formatEuros(chargeHt)} HT {period === 'monthly' ? 'par mois' : 'par an'}, soit {formatEuros(withVat(chargeHt))} TTC
          </p>
          <p className="flex items-center justify-center gap-1.5 text-center text-[13px] text-[var(--q-text-4)]">
            <ShieldCheck className="size-4 text-[var(--q-ok)]" aria-hidden />
            Satisfait ou remboursé {GUARANTEE_DAYS} jours · Sans engagement
          </p>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="q-btn q-btn-ghost mx-auto min-h-[44px]"
          >
            Pas maintenant
          </button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

/** La réponse d'une route d'émission demande-t-elle le mur de paiement ? */
export function isSubscriptionRequired(status: number, json: { code?: string } | null | undefined): boolean {
  return status === 402 && json?.code === SUBSCRIPTION_REQUIRED
}
