'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeftRight, Check, Loader2, TriangleAlert } from 'lucide-react'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { StatusPill } from '@/components/app/kit'
import { planLabel } from '@/components/admin/ui'

interface Props {
  userId: string
  currentPlan: 'starter' | 'pro'
  hasStripeSubscription: boolean
  isDowngrade: boolean  // pro → starter
}

export default function AdminChangePlanButton({
  userId,
  currentPlan,
  hasStripeSubscription,
  isDowngrade,
}: Props) {
  const router = useRouter()
  const [open,    setOpen]    = useState(false)
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState<string | null>(null)
  const [done,    setDone]    = useState(false)
  const [confirmedNewPlan, setConfirmedNewPlan] = useState<'starter' | 'pro' | null>(null)

  const newPlan = currentPlan === 'starter' ? 'pro' : 'starter'
  const newPlanLabel     = planLabel(newPlan)
  const currentPlanLabel = planLabel(currentPlan)

  const handleConfirm = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/admin/users/${userId}/plan`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ newPlan }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? 'Erreur inconnue')
        return
      }
      setConfirmedNewPlan(newPlan)
      setDone(true)
      setOpen(false)
      router.refresh()
    } catch {
      setError('Erreur réseau. Réessayez.')
    } finally {
      setLoading(false)
    }
  }

  if (done) {
    return (
      <p role="status" className="flex items-center gap-2 text-[13px] font-semibold text-[var(--q-ok)]">
        <Check className="size-4" strokeWidth={2.5} aria-hidden />
        Formule changée : {planLabel(confirmedNewPlan)}
      </p>
    )
  }

  return (
    <>
      <div>
        <button type="button" onClick={() => { setError(null); setOpen(true) }} className="q-btn q-btn-secondary q-btn-sm">
          <ArrowLeftRight aria-hidden />
          Passer en {newPlanLabel}
        </button>
      </div>

      <Dialog open={open} onOpenChange={(o) => { if (!loading) setOpen(o) }}>
        <DialogContent className="gap-4 sm:max-w-md">
          <DialogTitle className="q-display pr-8 text-[22px] font-semibold leading-tight">Changer la formule</DialogTitle>
          <DialogDescription className="sr-only">
            Passage de {currentPlanLabel} à {newPlanLabel}.
          </DialogDescription>

          <div className="flex items-center justify-center gap-3">
            <StatusPill tone="neutral">{currentPlanLabel}</StatusPill>
            <ArrowLeftRight className="size-4 text-[var(--q-text-4)]" aria-hidden />
            <StatusPill tone="info">{newPlanLabel}</StatusPill>
          </div>

          <p className="rounded-xl bg-[var(--q-surface-2)] px-3.5 py-3 text-[13px] leading-relaxed text-[var(--q-text-3)]">
            {hasStripeSubscription
              ? `L'abonnement Stripe sera modifié sans facturation immédiate. Le prochain renouvellement se fera au tarif ${newPlanLabel}.`
              : 'Seule la base de données sera mise à jour (aucun abonnement Stripe actif).'}
          </p>

          {isDowngrade && (
            <p className="q-banner q-banner-warn !gap-2 !px-3.5 !py-3 !text-[13px]">
              <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
              Passage d&apos;Artisan à Essentiel : les fonctions propres à Artisan ne seront plus disponibles.
            </p>
          )}

          {error && <p role="alert" className="text-[13px] text-[var(--q-danger)]">{error}</p>}

          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button type="button" onClick={() => setOpen(false)} disabled={loading} className="q-btn q-btn-ghost">
              Annuler
            </button>
            <button type="button" onClick={handleConfirm} disabled={loading} className="q-btn q-btn-primary">
              {loading && <Loader2 className="animate-spin" aria-hidden />}
              {loading ? 'En cours…' : 'Confirmer'}
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
