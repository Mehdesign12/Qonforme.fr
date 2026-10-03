'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Ban, CalendarPlus, Check, Loader2, TriangleAlert } from 'lucide-react'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { fmtDate } from '@/components/admin/ui'

interface Props {
  userId: string
  currentStatus: string
  currentPeriodEnd: string | null
}

type ActionType = 'extend' | 'cancel' | null

export default function AdminSubscriptionActions({ userId, currentStatus, currentPeriodEnd }: Props) {
  const router  = useRouter()
  const [action,  setAction]  = useState<ActionType>(null)
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState<string | null>(null)
  const [done,    setDone]    = useState<ActionType>(null)
  // Contenu de la fenêtre : garde la dernière action pendant l'animation de fermeture
  const [shown,   setShown]   = useState<ActionType>(null)

  const openModal = (a: ActionType) => {
    setError(null)
    setShown(a)
    setAction(a)
  }

  const handleConfirm = async () => {
    if (!action) return
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/admin/users/${userId}/subscription`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? 'Erreur inconnue')
        return
      }
      setDone(action)
      setAction(null)
      router.refresh()
    } catch {
      setError('Erreur réseau. Réessayez.')
    } finally {
      setLoading(false)
    }
  }

  const canCancel = currentStatus === 'active' || currentStatus === 'past_due' || currentStatus === 'trialing'
  const canExtend = currentStatus !== 'canceled'

  const newEnd = (() => {
    if (!currentPeriodEnd) return null
    const d = new Date(currentPeriodEnd)
    d.setDate(d.getDate() + 30)
    return fmtDate(d, { day: 'numeric', month: 'long', year: 'numeric' })
  })()

  if (!canExtend && !canCancel) return null

  return (
    <>
      <div className="flex flex-wrap gap-2">
        {canExtend && (
          done === 'extend' ? (
            <p role="status" className="flex items-center gap-2 text-[13px] font-semibold text-[var(--q-ok)]">
              <Check className="size-4" strokeWidth={2.5} aria-hidden />
              Accès prolongé de 30 jours
            </p>
          ) : (
            <button type="button" onClick={() => openModal('extend')} className="q-btn q-btn-secondary q-btn-sm">
              <CalendarPlus aria-hidden />
              Prolonger de 30 jours
            </button>
          )
        )}

        {canCancel && (
          done === 'cancel' ? (
            <p role="status" className="flex items-center gap-2 text-[13px] font-semibold text-[var(--q-danger)]">
              <Check className="size-4" strokeWidth={2.5} aria-hidden />
              Abonnement résilié
            </p>
          ) : (
            <button type="button" onClick={() => openModal('cancel')} className="q-btn q-btn-danger q-btn-sm">
              <Ban aria-hidden />
              Résilier l&apos;abonnement
            </button>
          )
        )}
      </div>

      <Dialog open={action !== null} onOpenChange={(o) => { if (!o && !loading) setAction(null) }}>
        <DialogContent className="gap-4 sm:max-w-md">
          <DialogTitle className="q-display pr-8 text-[22px] font-semibold leading-tight">
            {shown === 'cancel' ? 'Résilier l\'abonnement ?' : 'Prolonger l\'accès'}
          </DialogTitle>

          {shown === 'cancel' ? (
            <DialogDescription className="q-banner q-banner-warn !gap-2 !px-3.5 !py-3 !text-[13px] !leading-relaxed">
              <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
              <span>
                L&apos;abonnement Stripe sera <strong>résilié immédiatement</strong> : le compte ne pourra plus émettre de factures.
                Ses devis, brouillons et documents déjà émis restent consultables. Action irréversible.
              </span>
            </DialogDescription>
          ) : (
            <DialogDescription className="rounded-xl bg-[var(--q-surface-2)] px-3.5 py-3 text-[13px] leading-relaxed !text-[var(--q-text-3)]">
              L&apos;accès sera prolongé de <strong>30 jours</strong> en base de données uniquement ; Stripe ne sera pas modifié.
              {newEnd && <> Nouvelle fin de période : <strong>{newEnd}</strong>.</>}
            </DialogDescription>
          )}

          {error && <p role="alert" className="text-[13px] text-[var(--q-danger)]">{error}</p>}

          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button type="button" onClick={() => setAction(null)} disabled={loading} className="q-btn q-btn-ghost">
              Annuler
            </button>
            <button
              type="button"
              onClick={handleConfirm}
              disabled={loading}
              className={shown === 'cancel' ? 'q-btn q-btn-danger' : 'q-btn q-btn-primary'}
            >
              {loading && <Loader2 className="animate-spin" aria-hidden />}
              {loading ? 'En cours…' : shown === 'cancel' ? 'Résilier' : 'Prolonger'}
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
