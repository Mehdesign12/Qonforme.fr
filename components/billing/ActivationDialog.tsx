'use client'

/**
 * « Abonnement activé » : fenêtre de remerciement après le paiement (canevas
 * « Abonnement activé : écrans de confirmation », écrans 5, 8, 9 et 10 ; choix
 * du fondateur : fenêtre sur ordinateur, feuille du bas sur téléphone, jamais
 * une page entière).
 *
 * Elle s'ouvre sur la page où l'artisan retombe (sa facture, ou le tableau de
 * bord) quand l'adresse porte `?abonnement=1` ou `?abonnement=envoi`
 * (lib/stripe/activation.ts), puis retire le paramètre : un rechargement ne la
 * rouvre pas. Elle relit l'abonnement côté serveur (/api/subscription/status) :
 *   - formule active → remerciement, récapitulatif, ce qui est débloqué ;
 *   - pas encore active (le webhook de Stripe est asynchrone) → « Nous activons
 *     votre abonnement », relecture toutes les 2,5 s, bascule seule vers le
 *     remerciement ; après deux minutes, « Nous écrire ».
 *
 * Jamais de montant, de TVA ni de promesse de contact humain inventés : les
 * prix viennent de lib/stripe/plans.ts, les fonctions listées sont celles de
 * la formule (`features`). Transformations et opacité seulement, ni
 * backdrop-filter ni will-change sur mobile (CLAUDE.md).
 */
import { useCallback, useEffect, useState } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { Check, Loader2, Send, ShieldCheck, HardHat } from 'lucide-react'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { Sheet, SheetContent, SheetDescription, SheetTitle } from '@/components/ui/sheet'
import { SheetGrip } from '@/components/ui/sheet-grip'
import { ContactModal } from '@/components/layout/SupportModals'
import { GUARANTEE_DAYS } from '@/lib/stripe/access'
import { PLANS, formatEuros, type BillingPeriod, type PlanId } from '@/lib/stripe/plans'
import { ACTIVATION_PARAM, parseActivationParam, type ActivationKind } from '@/lib/stripe/activation'

export interface ActivationState {
  /** `loading` : première lecture ; `pending` : formule pas encore active ; `slow` : plus de deux minutes ; `active`. */
  phase: 'loading' | 'pending' | 'slow' | 'active'
  plan: PlanId | null
  period: BillingPeriod | null
  periodEnd: string | null
}

const POLL_MS = 2500
const SLOW_AFTER_MS = 120_000

/** Relit l'abonnement tant que la fenêtre est ouverte et que la formule n'est pas active. */
export function useActivation(open: boolean): ActivationState {
  const [state, setState] = useState<ActivationState>({ phase: 'loading', plan: null, period: null, periodEnd: null })

  useEffect(() => {
    if (!open) return
    let stopped = false
    let timer: ReturnType<typeof setTimeout> | undefined
    const startedAt = Date.now()

    const read = async () => {
      let next: ActivationState | null = null
      try {
        const res = await fetch('/api/subscription/status', { cache: 'no-store' })
        if (res.ok) {
          const data = await res.json()
          if (data.status === 'active' && (data.plan === 'starter' || data.plan === 'pro')) {
            next = {
              phase: 'active',
              plan: data.plan,
              period: data.billingPeriod === 'yearly' ? 'yearly' : 'monthly',
              periodEnd: typeof data.currentPeriodEnd === 'string' ? data.currentPeriodEnd : null,
            }
          }
        }
      } catch {
        // réseau instable : on réessaie
      }
      if (stopped) return
      if (next) { setState(next); return }
      const slow = Date.now() - startedAt > SLOW_AFTER_MS
      setState((s) => (s.phase === 'active' ? s : { ...s, phase: slow ? 'slow' : 'pending' }))
      timer = setTimeout(read, POLL_MS)
    }

    read()
    return () => { stopped = true; if (timer) clearTimeout(timer) }
  }, [open])

  return state
}

/** « 20 novembre 2026 », à l'heure de Paris. */
function formatDate(iso: string | null): string | null {
  if (!iso) return null
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return null
  return new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Europe/Paris' }).format(d)
}

function RingCheck({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none" aria-hidden="true" className="shrink-0">
      <circle cx="32" cy="32" r="29" stroke="var(--q-accent)" strokeWidth="2.4" />
      <path d="m20 33 8.5 8.5L44 24" stroke="var(--q-accent)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function Step({ state, children }: { state: 'done' | 'doing' | 'todo'; children: React.ReactNode }) {
  return (
    <div className={state === 'todo' ? 'flex items-center gap-3 text-[15px] text-[var(--q-text-4)]' : 'flex items-center gap-3 text-[15px] font-semibold text-[var(--q-ink)]'}>
      {state === 'done' && <Check className="size-5 text-[var(--q-ok)]" strokeWidth={2.4} aria-hidden />}
      {state === 'doing' && <Loader2 className="size-5 animate-spin text-[var(--q-accent)]" aria-hidden />}
      {state === 'todo' && <span className="size-5 rounded-full border-[1.8px] border-dashed border-[var(--q-placeholder)]" aria-hidden />}
      <span className={state === 'todo' ? 'font-normal' : undefined}>{children}</span>
    </div>
  )
}

function Body({
  kind,
  activation,
  onClose,
  onGo,
  onContact,
  sheet,
}: {
  kind: ActivationKind
  activation: ActivationState
  onClose: () => void
  onGo: (href: string) => void
  onContact: () => void
  sheet: boolean
}) {
  const plan = activation.plan ? PLANS[activation.plan] : null

  /* ── Pas encore active ── */
  if (activation.phase !== 'active' || !plan) {
    return (
      <div className="flex flex-col gap-5">
        <Loader2 className="size-12 animate-spin text-[var(--q-accent)]" strokeWidth={2} aria-hidden />
        <div className="flex flex-col gap-2.5">
          <DialogTitleSlot sheet={sheet}>
            Nous <span className="q-serif">activons</span> votre abonnement.
          </DialogTitleSlot>
          <DescriptionSlot sheet={sheet}>
            Votre paiement est bien passé. Il faut quelques secondes pour ouvrir votre formule : cette fenêtre se met à jour toute seule.
          </DescriptionSlot>
        </div>
        <div className="flex flex-col gap-3.5 rounded-[14px] border border-[var(--q-line)] bg-[var(--q-surface-2)] p-4">
          <Step state="done">Paiement confirmé</Step>
          <Step state="doing">Ouverture de votre formule</Step>
          <Step state="todo">Envoi du reçu par email</Step>
        </div>
        <div className="flex flex-col gap-2.5 text-[13px] text-[var(--q-text-3)]">
          <div className="flex items-center justify-between gap-3">
            <span>Vous pouvez fermer : l&apos;activation continue.</span>
            <button type="button" onClick={onClose} className="q-btn q-btn-secondary">Fermer</button>
          </div>
          {activation.phase === 'slow' && (
            <p className="border-t border-[var(--q-line-soft)] pt-3">
              Toujours rien après deux minutes ?{' '}
              <button type="button" onClick={onContact} className="font-semibold text-[var(--q-accent-strong)] underline-offset-2 hover:underline">Nous écrire</button>
            </p>
          )}
        </div>
      </div>
    )
  }

  /* ── Active ── */
  const price = activation.period === 'yearly' ? `${formatEuros(plan.yearlyPrice)} par an` : `${formatEuros(plan.monthlyPrice)} par mois`
  const next = formatDate(activation.periodEnd)
  const isArtisan = activation.plan === 'pro'
  const sendInvoice = kind === 'envoi'

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center gap-3.5">
        <RingCheck size={sheet ? 48 : 56} />
        <div className="flex min-w-0 flex-col gap-1">
          <span className="font-mono text-[11px] uppercase tracking-[.08em] text-[var(--q-ok)]">Paiement confirmé</span>
          <DialogTitleSlot sheet={sheet}>
            {sendInvoice
              ? <>Votre facture est <span className="q-serif">prête</span> à partir.</>
              : <>Merci, <span className="q-serif">{plan.name}</span> est activé.</>}
          </DialogTitleSlot>
        </div>
      </div>
      <DescriptionSlot sheet={sheet}>
        {sendInvoice
          ? `Merci. ${plan.name} est actif : il ne reste qu’à envoyer la facture. Un numéro lui est attribué à l’envoi.`
          : isArtisan
            ? 'Vos chantiers, situations de travaux et acomptes sont prêts, avec tout ce qu’inclut Essentiel. Un reçu vous est envoyé par email.'
            : 'Vos factures peuvent partir dès maintenant, avec leurs relances. Un reçu vous est envoyé par email.'}
      </DescriptionSlot>

      <div className="flex flex-col gap-2.5 rounded-[14px] border border-[var(--q-line)] bg-[var(--q-surface-2)] p-4 text-[14.5px]">
        <div className="flex justify-between gap-3"><span className="text-[var(--q-text-3)]">Formule</span><span className="font-semibold tabular-nums">{plan.name} · {price}</span></div>
        {next && (
          <div className="flex justify-between gap-3 border-t border-[var(--q-line-soft)] pt-2.5"><span className="text-[var(--q-text-3)]">Prochain paiement</span><span className="font-semibold">{next}</span></div>
        )}
      </div>

      {!sendInvoice && (
        <ul className="flex flex-col gap-2 text-sm text-[var(--q-text-2)]">
          {plan.features.slice(0, 4).map((f) => (
            <li key={f} className="flex gap-2.5"><Check className="mt-0.5 size-[17px] shrink-0 text-[var(--q-accent)]" strokeWidth={2.2} aria-hidden />{f}</li>
          ))}
        </ul>
      )}

      <p className="flex gap-2.5 text-[13px] leading-snug text-[var(--q-text-3)]">
        <ShieldCheck className="mt-0.5 size-[18px] shrink-0 text-[var(--q-accent-strong)]" strokeWidth={1.8} aria-hidden />
        <span><strong className="font-semibold text-[var(--q-ink)]">Remboursé pendant {GUARANTEE_DAYS} jours</strong>, à demander dans Paramètres › Abonnement.</span>
      </p>

      <div className="flex flex-col gap-1 sm:flex-row sm:gap-2.5">
        {sendInvoice ? (
          <button type="button" onClick={() => onGo('send')} className="q-btn q-btn-primary q-btn-lg w-full sm:flex-1">
            <Send aria-hidden strokeWidth={2} />Envoyer la facture
          </button>
        ) : isArtisan ? (
          <button type="button" onClick={() => onGo('/chantiers')} className="q-btn q-btn-primary q-btn-lg w-full sm:flex-1">
            <HardHat aria-hidden strokeWidth={2} />Créer mon premier chantier
          </button>
        ) : (
          <button type="button" onClick={() => onGo('/invoices/new')} className="q-btn q-btn-primary q-btn-lg w-full sm:flex-1">
            <Send aria-hidden strokeWidth={2} />Envoyer ma première facture
          </button>
        )}
        <button type="button" onClick={onClose} className="q-btn q-btn-ghost q-btn-lg w-full sm:w-auto">Plus tard</button>
      </div>
    </div>
  )
}

/* Titre et description : celui de la fenêtre ou de la feuille selon l'écran. */
function DialogTitleSlot({ sheet, children }: { sheet: boolean; children: React.ReactNode }) {
  const cls = 'q-display text-[26px] leading-[1.12] text-[var(--q-ink)] sm:text-[30px]'
  return sheet ? <SheetTitle className={cls}>{children}</SheetTitle> : <DialogTitle className={cls}>{children}</DialogTitle>
}
function DescriptionSlot({ sheet, children }: { sheet: boolean; children: React.ReactNode }) {
  const cls = 'text-[15px] leading-relaxed text-[var(--q-text-3)]'
  return sheet ? <SheetDescription className={cls}>{children}</SheetDescription> : <DialogDescription className={cls}>{children}</DialogDescription>
}

/** Ordinateur : fenêtre ; téléphone : feuille du bas. */
function useIsDesktop(): boolean {
  const [desktop, setDesktop] = useState(true)
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 768px)')
    const sync = () => setDesktop(mq.matches)
    sync()
    mq.addEventListener('change', sync)
    return () => mq.removeEventListener('change', sync)
  }, [])
  return desktop
}

export function ActivationDialog() {
  const router = useRouter()
  const pathname = usePathname()
  const search = useSearchParams()
  const param = parseActivationParam(search.get(ACTIVATION_PARAM))
  const desktop = useIsDesktop()

  const [kind, setKind] = useState<ActivationKind | null>(null)
  const [open, setOpen] = useState(false)
  const [contact, setContact] = useState(false)
  const activation = useActivation(open)

  // Le paramètre est lu une fois, puis retiré de l'adresse (un rechargement ne rouvre rien).
  // La page d'origine (la facture à envoyer) reste celle où l'on est.
  useEffect(() => {
    if (!param) return
    setKind(param)
    setOpen(true)
    const rest = new URLSearchParams(search.toString())
    rest.delete(ACTIVATION_PARAM)
    const qs = rest.toString()
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false })
  }, [param]) // eslint-disable-line react-hooks/exhaustive-deps

  const close = useCallback(() => setOpen(false), [])
  const go = useCallback((href: string) => {
    setOpen(false)
    router.push(href === 'send' ? `${pathname}?send=1` : href)
  }, [router, pathname])

  if (!kind) return null
  const body = <Body kind={kind} activation={activation} onClose={close} onGo={go} onContact={() => setContact(true)} sheet={!desktop} />

  return (
    <>
      {desktop ? (
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent className="max-h-[calc(100dvh-2rem)] gap-0 overflow-y-auto p-9 sm:max-w-[540px]">{body}</DialogContent>
        </Dialog>
      ) : (
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetContent side="bottom" showCloseButton={false} className="max-h-[92dvh] gap-0 overflow-y-auto px-5 pb-[max(28px,env(safe-area-inset-bottom))] pt-2">
            <SheetGrip />
            <div className="pt-3">{body}</div>
          </SheetContent>
        </Sheet>
      )}
      <ContactModal open={contact} onOpenChange={setContact} />
    </>
  )
}
