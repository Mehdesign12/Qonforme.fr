'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { BellRing, Check, Construction, Send, ShieldCheck, Signature } from 'lucide-react'
import { PictoCluster } from '@/components/brand/PictoCluster'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import { PLANS, VAT_COLLECTED, formatEuros, withVat, type BillingPeriod } from '@/lib/stripe/plans'
import { GUARANTEE_DAYS, SUBSCRIPTION_REQUIRED } from '@/lib/stripe/access'
import { ARTISAN_REQUIRED } from '@/lib/artisan/plan'
import { trackEvent } from '@/lib/meta-pixel'
import { captureEvent } from '@/components/shared/PostHogProvider'
import { useArtisanOnSale } from './useArtisanOnSale'
import { SolutionCompatible } from '@/components/brand/SolutionCompatible'
import { PLATFORM_SENDING_LIVE } from '@/lib/pa/sending'
import { emissionCountdownText } from '@/lib/billing/reform'

/**
 * Piste B (canevas https://claude.ai/artifact/5ZyR3KUG2RBz64VJieJvHE, 10/11/2026) :
 * pour l'envoi d'une facture, l'échéance de la facture électronique en tête, le
 * logotype Solution compatible et deux colonnes de bénéfices. Rien que de vrai :
 * fonctions d'Essentiel (lib/stripe/plans.ts), dates de la réforme (lib/billing/reform.ts).
 */
const REFORM_BENEFITS = [
  PLATFORM_SENDING_LIVE ? 'Envoi par une plateforme agréée' : 'Réception par une plateforme agréée',
  'Factures fournisseurs reçues',
  'Factur-X et mentions obligatoires',
]
const PAID_BENEFITS = ['Factures et avoirs illimités', 'Relances automatiques', 'Signature en ligne des devis']

/**
 * Mur de paiement « Votre facture est prête » — s'ouvre quand une route
 * d'émission répond 402 SUBSCRIPTION_REQUIRED (envoi, passage hors brouillon,
 * relance). Le choix de la formule mène au paiement, puis revient sur la
 * facture avec ?send=1 pour l'envoyer d'un clic. Aussi ouvert par le panneau
 * « Signature en ligne » d'un devis (reason 'signature', retour sur `nextPath`).
 *
 * reason 'artisan' (route Artisan en 402 ARTISAN_REQUIRED : chantiers,
 * acomptes, situations, retenue de garantie, autoliquidation) : propose la
 * formule Artisan. Tant qu'elle n'est pas en vente (prix Stripe non
 * configurés, PLANS.pro.available), la fenêtre le dit honnêtement, sans
 * bouton de paiement, et renvoie vers la démo.
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
  nextPath,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  invoiceId?: string
  invoiceNumber?: string
  /** 'send' : première facture à envoyer ; 'remind' : relance d'un client ; 'signature' : signature en ligne d'un devis ; 'artisan' : fonction de la formule Artisan. */
  reason?: 'send' | 'remind' | 'signature' | 'artisan'
  /** Retour après le paiement quand ce n'est pas une facture (ex. la fiche du devis). */
  nextPath?: string
}) {
  const router = useRouter()
  const [period, setPeriod] = useState<BillingPeriod>('yearly')
  const artisan = reason === 'artisan'
  const plan = artisan ? PLANS.pro : PLANS.starter
  const artisanOnSale = useArtisanOnSale()
  const onSale = artisan ? artisanOnSale : plan.available

  const reform = reason === 'send' && !artisan
  const next = invoiceId ? `/invoices/${invoiceId}${reason === 'send' ? '?send=1' : ''}` : nextPath ?? null
  const chargeHt = period === 'monthly' ? plan.monthlyPrice : plan.yearlyPrice

  // Entonnoir PostHog : mur affiché, formule choisie, ou fermé sans choisir
  const chosen = useRef(false)
  useEffect(() => {
    if (open) {
      chosen.current = false
      captureEvent('paywall_shown', { reason, plan: plan.id, on_sale: onSale })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- une seule fois par ouverture
  }, [open])
  const handleOpenChange = (value: boolean) => {
    if (!value && !chosen.current) captureEvent('paywall_dismissed', { reason, plan: plan.id, period })
    onOpenChange(value)
  }

  const choose = () => {
    chosen.current = true
    captureEvent('paywall_plan_chosen', { reason, plan: plan.id, period })
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
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent data-replay-clear className={cn('max-h-[calc(100dvh-2rem)] gap-5 overflow-y-auto p-[22px]', reform ? 'sm:max-w-[600px]' : 'sm:max-w-[460px]')}>
        {reform && (
          <div className="-mx-[22px] -mt-[22px] flex flex-col gap-3 border-b border-[var(--q-line)] bg-[var(--q-accent-wash,var(--q-sunken))] px-[22px] pb-5 pt-[22px] sm:flex-row sm:items-center sm:gap-5">
            <div className="flex min-w-0 flex-1 flex-col gap-1.5 pr-8 sm:pr-0">
              <span className="text-xs font-semibold uppercase tracking-[0.06em] text-[var(--q-accent-strong)]">Facture électronique obligatoire</span>
              <span className="q-display text-[19px] leading-snug text-[var(--q-ink)] sm:text-[21px]">
                1<sup>er</sup> septembre 2027 : vos factures partent par une plateforme agréée.
              </span>
              <span className="text-[14px] leading-relaxed text-[var(--q-text-3)]">{emissionCountdownText()}</span>
            </div>
            <SolutionCompatible size="sm" priority className="self-start sm:self-center" />
          </div>
        )}
        <div className={cn('flex flex-col gap-1.5', !reform && 'pr-8')}>
          {/* Pictogrammes de marque : ce que débloque la formule */}
          {!reform && (
          <PictoCluster
            size="sm"
            className="mb-2"
            icon={artisan ? <Construction /> : reason === 'remind' ? <BellRing /> : reason === 'signature' ? <Signature /> : <Send />}
          />
          )}
          <DialogTitle className="q-display text-[22px] leading-tight text-[var(--q-ink)]">
            {artisan
              ? `Cette fonction fait partie de la formule ${plan.name}.`
              : reason === 'remind'
              ? 'Les relances font partie de la formule.'
              : reason === 'signature'
                ? 'La signature en ligne fait partie de la formule.'
                : <>
                    {invoiceNumber ? <>Votre facture <span data-replay-mask>{invoiceNumber}</span> est prête.</> : 'Votre facture est prête.'}{' '}
                    <span className="q-serif">Vous aussi.</span>
                  </>}
          </DialogTitle>
          <DialogDescription className="text-[15px] leading-relaxed text-[var(--q-text-3)]">
            {artisan
              ? onSale
                ? 'Chantiers, acomptes, situations de travaux, retenue de garantie et autoliquidation en sous-traitance. Vos devis restent gratuits.'
                : `La formule ${plan.name} n’est pas encore en vente. Ses fonctions sont prêtes : essayez-les dans la démo.`
              : reason === 'remind'
              ? 'Choisissez votre formule pour relancer vos clients. Vos devis restent gratuits.'
              : reason === 'signature'
                ? 'Votre client lit et signe vos devis en ligne. Vos devis restent gratuits : sans formule, envoyez-les par email avec leur PDF.'
                : `Avec ${plan.name}, envoyez-la maintenant et soyez en règle pour la réforme. Vos devis restent gratuits.`}
          </DialogDescription>
        </div>

        {/* Mensuel / annuel (formule en vente seulement) */}
        {onSale && (
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
                  {formatEuros(perMonth)} <span className="text-xs font-normal text-[var(--q-text-4)]">{VAT_COLLECTED ? 'HT / mois' : '/ mois'}</span>
                </span>
                <span className={cn('text-xs font-semibold', p === 'yearly' ? 'text-[var(--q-ok)]' : 'text-[var(--q-text-4)]')}>
                  {p === 'yearly' ? '2 mois offerts' : 'Sans engagement'}
                </span>
              </button>
            )
          })}
        </div>
        )}

        {reform ? (
          <div className="grid gap-3 sm:grid-cols-2">
            {([['Être en règle', REFORM_BENEFITS, 'text-[var(--q-accent)]'], ['Être payé', PAID_BENEFITS, 'text-[var(--q-ok)]']] as const).map(([title, items, tone]) => (
              <div key={title} className="rounded-xl border border-[var(--q-line)] p-4">
                <p className="text-sm font-semibold text-[var(--q-ink)]">{title}</p>
                <ul className="mt-2 flex flex-col gap-1.5">
                  {items.map((f) => (
                    <li key={f} className="flex items-start gap-2 text-sm text-[var(--q-text-2)]">
                      <Check className={cn('mt-0.5 size-4 shrink-0', tone)} strokeWidth={2.5} aria-hidden />
                      {f}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        ) : (
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
        )}

        {!onSale ? (
          <div className="flex flex-col gap-2">
            <Link href="/demo/chantiers" className="q-btn q-btn-primary q-btn-lg w-full">
              Essayer dans la démo
            </Link>
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="q-btn q-btn-ghost mx-auto min-h-[44px]"
            >
              Fermer
            </button>
          </div>
        ) : (
        <div className="flex flex-col gap-2">
          <button type="button" onClick={choose} className="q-btn q-btn-primary q-btn-lg w-full">
            {reason === 'send' ? `Passer à ${plan.name} et envoyer ma facture` : `Choisir ${plan.name}`}
          </button>
          <p className="text-center text-[13px] tabular-nums text-[var(--q-text-4)]">
            {formatEuros(chargeHt)}{VAT_COLLECTED ? ' HT' : ''} {period === 'monthly' ? 'par mois' : 'par an'}{VAT_COLLECTED && <>, soit {formatEuros(withVat(chargeHt))} TTC</>}
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
        )}
      </DialogContent>
    </Dialog>
  )
}

/** La réponse d'une route d'émission demande-t-elle le mur de paiement ? */
export function isSubscriptionRequired(status: number, json: { code?: string } | null | undefined): boolean {
  return status === 402 && json?.code === SUBSCRIPTION_REQUIRED
}

/** La réponse demande-t-elle la formule Artisan (402 ARTISAN_REQUIRED) ? */
export function isArtisanPaywall(status: number, json: { code?: string } | null | undefined): boolean {
  return status === 402 && json?.code === ARTISAN_REQUIRED
}
