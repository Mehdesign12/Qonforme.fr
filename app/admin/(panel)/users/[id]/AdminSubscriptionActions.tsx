'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { CalendarPlus, Ban, Loader2, X, AlertTriangle } from 'lucide-react'

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

  const openModal = (a: ActionType) => {
    setError(null)
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
      setError('Erreur réseau. Réessaie.')
    } finally {
      setLoading(false)
    }
  }

  const canCancel = currentStatus === 'active' || currentStatus === 'past_due' || currentStatus === 'trialing'
  const canExtend = currentStatus !== 'canceled'

  return (
    <>
      {/* ── Boutons ──────────────────────────────────────────────────────── */}
      <div className="mt-3 pt-3 border-t border-slate-100 dark:border-[#1E3A5F] flex flex-wrap gap-2">
        {canExtend && (
          done === 'extend' ? (
            <p className="text-[12px] text-blue-600 dark:text-blue-400 font-medium">
              ✓ Accès prolongé de 30 jours
            </p>
          ) : (
            <button
              onClick={() => openModal('extend')}
              className="inline-flex items-center gap-1.5 text-[12px] font-medium text-[#2563EB] dark:text-[#3B82F6] hover:underline transition-colors"
            >
              <CalendarPlus className="w-3.5 h-3.5" />
              Prolonger 30 jours
            </button>
          )
        )}

        {canCancel && (
          done === 'cancel' ? (
            <p className="text-[12px] text-red-600 dark:text-red-400 font-medium">
              ✓ Abonnement annulé
            </p>
          ) : (
            <button
              onClick={() => openModal('cancel')}
              className="inline-flex items-center gap-1.5 text-[12px] font-medium text-red-500 dark:text-red-400 hover:underline transition-colors"
            >
              <Ban className="w-3.5 h-3.5" />
              Annuler l&apos;abonnement
            </button>
          )
        )}
      </div>

      {/* ── Modal ────────────────────────────────────────────────────────── */}
      {action && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm px-4"
          onClick={(e) => { if (e.target === e.currentTarget && !loading) setAction(null) }}
        >
          <div className="bg-white dark:bg-[#0F1E35] rounded-2xl border border-slate-200 dark:border-[#1E3A5F] shadow-2xl w-full max-w-sm p-6">

            {/* Entête */}
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-base font-bold text-[#0F172A] dark:text-[#E2E8F0]">
                {action === 'extend' ? 'Prolonger l\'accès' : 'Annuler l\'abonnement'}
              </h2>
              <button
                onClick={() => !loading && setAction(null)}
                className="w-7 h-7 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-[#162032] transition-colors"
                aria-label="Fermer"
                disabled={loading}
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Corps */}
            {action === 'extend' ? (
              <div className="mb-5">
                <p className="text-[12px] text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-[#162032]/60 rounded-lg px-3 py-2">
                  L&apos;accès sera prolongé de <strong>30 jours</strong> en base de données uniquement.
                  Stripe ne sera pas modifié.
                  {currentPeriodEnd && (
                    <> La nouvelle date de fin sera le{' '}
                      <strong>
                        {(() => {
                          const d = new Date(currentPeriodEnd)
                          d.setDate(d.getDate() + 30)
                          return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
                        })()}
                      </strong>.
                    </>
                  )}
                </p>
              </div>
            ) : (
              <div className="mb-5 flex flex-col gap-2">
                <div className="flex items-start gap-2 text-[12px] text-red-700 dark:text-red-400 bg-red-50 dark:bg-red-900/20 rounded-lg px-3 py-2">
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                  <span>
                    L&apos;abonnement Stripe sera <strong>annulé immédiatement</strong> et l&apos;accès coupé.
                    Cette action est irréversible.
                  </span>
                </div>
              </div>
            )}

            {/* Erreur */}
            {error && (
              <p className="text-[12px] text-red-600 dark:text-red-400 mb-4">{error}</p>
            )}

            {/* Actions */}
            <div className="flex gap-2">
              <button
                onClick={() => !loading && setAction(null)}
                disabled={loading}
                className="flex-1 h-9 rounded-xl border border-slate-200 dark:border-[#1E3A5F] text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-[#162032] transition-colors disabled:opacity-50"
              >
                Annuler
              </button>
              <button
                onClick={handleConfirm}
                disabled={loading}
                className={`flex-1 h-9 rounded-xl text-white text-sm font-semibold transition-colors flex items-center justify-center gap-2 disabled:opacity-60 ${
                  action === 'cancel'
                    ? 'bg-red-500 hover:bg-red-600'
                    : 'bg-[#2563EB] hover:bg-[#1D4ED8]'
                }`}
              >
                {loading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                {loading ? 'En cours…' : 'Confirmer'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
