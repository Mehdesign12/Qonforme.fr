'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeftRight, Check, Loader2, TriangleAlert } from 'lucide-react'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { StatusPill } from '@/components/app/kit'
import { planLabel, periodLabel } from '@/components/admin/ui'

interface Props {
  userId: string
  currentPlan: 'starter' | 'pro'
  billingPeriod: string | null
  /** Nom de l'entreprise, rappelé dans la fenêtre de confirmation. */
  accountName?: string
}

/** Formule dans la liste des utilisateurs, avec le bouton de bascule Essentiel ↔ Artisan. */
export default function AdminQuickPlanToggle({ userId, currentPlan, billingPeriod, accountName }: Props) {
  const router = useRouter()
  const [open,    setOpen]    = useState(false)
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState<string | null>(null)
  const [confirmedNewPlan, setConfirmedNewPlan] = useState<'starter' | 'pro' | null>(null)

  const newPlan = currentPlan === 'starter' ? 'pro' : 'starter'
  const isDowngrade = currentPlan === 'pro'

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
      setOpen(false)
      router.refresh()
      // Réinitialiser le message de succès après 3 s
      setTimeout(() => setConfirmedNewPlan(null), 3000)
    } catch {
      setError('Erreur réseau. Réessayez.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <span className="inline-flex items-center gap-1">
        {confirmedNewPlan ? (
          <StatusPill tone="ok" icon={<Check strokeWidth={2.75} aria-hidden />}>{planLabel(confirmedNewPlan)}</StatusPill>
        ) : (
          <StatusPill tone="info">
            {planLabel(currentPlan)}
            {billingPeriod && <span className="font-medium opacity-75">· {periodLabel(billingPeriod)}</span>}
          </StatusPill>
        )}
        <button
          type="button"
          onClick={() => { setError(null); setOpen(true) }}
          aria-label={`Passer en ${planLabel(newPlan)}`}
          title={`Passer en ${planLabel(newPlan)}`}
          className="q-btn q-btn-ghost q-btn-sm q-btn-icon !size-7 !rounded-[8px]"
        >
          <ArrowLeftRight className="!size-3.5" aria-hidden />
        </button>
      </span>

      <Dialog open={open} onOpenChange={(o) => { if (!loading) setOpen(o) }}>
        <DialogContent className="gap-4 sm:max-w-sm">
          <DialogTitle className="q-display pr-8 text-[20px] font-semibold leading-tight">Changer la formule</DialogTitle>
          <DialogDescription className="text-[13px] leading-relaxed !text-[var(--q-text-3)]">
            {accountName && <><span className="font-semibold text-[var(--q-ink)]">{accountName}</span> : </>}
            passage de {planLabel(currentPlan)} à {planLabel(newPlan)}. L&apos;abonnement Stripe, s&apos;il est actif, est modifié sans facturation immédiate.
          </DialogDescription>

          <div className="flex items-center justify-center gap-2">
            <StatusPill tone="neutral">{planLabel(currentPlan)}</StatusPill>
            <ArrowLeftRight className="size-4 text-[var(--q-text-4)]" aria-hidden />
            <StatusPill tone="info">{planLabel(newPlan)}</StatusPill>
          </div>

          {isDowngrade && (
            <p className="q-banner q-banner-warn !gap-2 !px-3 !py-2.5 !text-[13px]">
              <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
              Les fonctions propres à Artisan sont retirées dès maintenant.
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
