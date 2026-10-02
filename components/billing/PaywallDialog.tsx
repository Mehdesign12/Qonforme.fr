'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Check, ShieldCheck } from 'lucide-react'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
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
      <DialogContent className="sm:max-w-md p-6 gap-5">
        <div className="flex flex-col gap-1.5 pr-6">
          <DialogTitle className="text-xl font-semibold tracking-tight text-[#0F172A] dark:text-[#E2E8F0]">
            {reason === 'remind'
              ? 'Les relances font partie de la formule.'
              : invoiceNumber ? `Votre facture ${invoiceNumber} est prête.` : 'Votre facture est prête.'}
          </DialogTitle>
          <DialogDescription className="text-[15px] leading-relaxed text-slate-500">
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
                className={`flex flex-col items-start gap-0.5 rounded-xl border p-3 text-left transition-colors ${
                  selected
                    ? 'border-[#2563EB] ring-4 ring-[#2563EB]/10 bg-white dark:bg-[#0F1E35]'
                    : 'border-[#E2E8F0] dark:border-[#1E3A5F] bg-white dark:bg-[#0F1E35] hover:border-[#94A3B8]'
                }`}
              >
                <span className="text-sm font-semibold text-[#0F172A] dark:text-[#E2E8F0]">
                  {p === 'yearly' ? 'Annuel' : 'Mensuel'}
                </span>
                <span className="text-lg font-semibold text-[#0F172A] dark:text-[#E2E8F0]">
                  {formatEuros(perMonth)} <span className="text-xs font-normal text-slate-500">HT / mois</span>
                </span>
                <span className={`text-[12px] font-semibold ${p === 'yearly' ? 'text-[#047857]' : 'text-slate-400'}`}>
                  {p === 'yearly' ? '2 mois offerts' : 'Sans engagement'}
                </span>
              </button>
            )
          })}
        </div>

        <div className="rounded-xl bg-[#F8FAFC] dark:bg-[#162032] p-4">
          <p className="text-sm font-semibold text-[#0F172A] dark:text-[#E2E8F0]">{plan.name}</p>
          <ul className="mt-2 flex flex-col gap-1.5">
            {plan.features.slice(0, 4).map((f) => (
              <li key={f} className="flex items-start gap-2 text-sm text-[#334155] dark:text-slate-300">
                <Check className="w-4 h-4 mt-0.5 shrink-0 text-[#059669]" aria-hidden />
                {f}
              </li>
            ))}
          </ul>
        </div>

        <div className="flex flex-col gap-2">
          <button
            type="button"
            onClick={choose}
            className="inline-flex h-12 w-full items-center justify-center rounded-xl bg-[#2563EB] text-[15px] font-semibold text-white hover:bg-[#1D4ED8] transition-colors"
          >
            {reason === 'remind' ? `Choisir ${plan.name}` : `Choisir ${plan.name} et envoyer ma facture`}
          </button>
          <p className="text-center text-[13px] text-slate-500">
            {formatEuros(chargeHt)} HT {period === 'monthly' ? 'par mois' : 'par an'}, soit {formatEuros(withVat(chargeHt))} TTC
          </p>
          <p className="flex items-center justify-center gap-1.5 text-center text-[13px] text-slate-500">
            <ShieldCheck className="w-4 h-4 text-[#059669]" aria-hidden />
            Satisfait ou remboursé {GUARANTEE_DAYS} jours · Sans engagement
          </p>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="mx-auto inline-flex min-h-[44px] items-center px-3 text-sm font-medium text-slate-500 hover:text-[#0F172A]"
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
