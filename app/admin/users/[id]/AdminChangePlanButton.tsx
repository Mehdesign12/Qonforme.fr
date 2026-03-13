'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeftRight, Loader2, X, AlertTriangle } from 'lucide-react'

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

  const newPlan = currentPlan === 'starter' ? 'pro' : 'starter'
  const newPlanLabel    = newPlan    === 'pro' ? 'Pro'     : 'Starter'
  const currentPlanLabel = currentPlan === 'pro' ? 'Pro'  : 'Starter'

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
      setDone(true)
      setOpen(false)
      router.refresh()
    } catch {
      setError('Erreur réseau. Réessaie.')
    } finally {
      setLoading(false)
    }
  }

  if (done) {
    return (
      <div className="mt-3 pt-3 border-t border-slate-100 dark:border-[#1E3A5F]">
        <p className="text-[12px] text-green-600 dark:text-green-400 font-medium">
          ✓ Plan changé vers {newPlanLabel}
        </p>
      </div>
    )
  }

  return (
    <>
      {/* ── Bouton déclencheur ─────────────────────────────────────────── */}
      <div className="mt-3 pt-3 border-t border-slate-100 dark:border-[#1E3A5F]">
        <button
          onClick={() => { setError(null); setOpen(true) }}
          className="inline-flex items-center gap-1.5 text-[12px] font-medium text-[#2563EB] dark:text-[#3B82F6] hover:underline transition-colors"
        >
          <ArrowLeftRight className="w-3.5 h-3.5" />
          Passer en {newPlanLabel}
        </button>
      </div>

      {/* ── Modal de confirmation ──────────────────────────────────────── */}
      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm px-4"
          onClick={(e) => { if (e.target === e.currentTarget && !loading) setOpen(false) }}
        >
          <div className="bg-white dark:bg-[#0F1E35] rounded-2xl border border-slate-200 dark:border-[#1E3A5F] shadow-2xl w-full max-w-sm p-6">

            {/* Entête */}
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-base font-bold text-[#0F172A] dark:text-[#E2E8F0]">
                Changer le plan
              </h2>
              <button
                onClick={() => !loading && setOpen(false)}
                className="w-7 h-7 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-[#162032] transition-colors"
                aria-label="Fermer"
                disabled={loading}
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Résumé plan actuel → nouveau */}
            <div className="flex items-center justify-center gap-3 mb-5">
              <span className="px-3 py-1.5 rounded-full text-xs font-bold bg-slate-100 dark:bg-[#162032] text-slate-600 dark:text-slate-300">
                {currentPlanLabel}
              </span>
              <ArrowLeftRight className="w-4 h-4 text-slate-400" />
              <span className={`px-3 py-1.5 rounded-full text-xs font-bold ${
                newPlan === 'pro'
                  ? 'bg-[#EFF6FF] dark:bg-[#1E3A5F] text-[#2563EB] dark:text-[#3B82F6]'
                  : 'bg-slate-100 dark:bg-[#162032] text-slate-600 dark:text-slate-300'
              }`}>
                {newPlanLabel}
              </span>
            </div>

            {/* Notes contextuelles */}
            <div className="flex flex-col gap-2 mb-5">
              {hasStripeSubscription ? (
                <p className="text-[12px] text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-[#162032]/60 rounded-lg px-3 py-2">
                  L&apos;abonnement Stripe sera modifié sans facturation immédiate.
                  Le prochain renouvellement sera au tarif {newPlanLabel}.
                </p>
              ) : (
                <p className="text-[12px] text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-[#162032]/60 rounded-lg px-3 py-2">
                  Seule la base de données sera mise à jour (pas d&apos;abonnement Stripe actif).
                </p>
              )}

              {isDowngrade && (
                <div className="flex items-start gap-2 text-[12px] text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 rounded-lg px-3 py-2">
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                  <span>
                    Downgrade Pro → Starter : l&apos;utilisateur sera limité à 10 factures/mois
                    dès maintenant.
                  </span>
                </div>
              )}
            </div>

            {/* Erreur */}
            {error && (
              <p className="text-[12px] text-red-600 dark:text-red-400 mb-4">{error}</p>
            )}

            {/* Actions */}
            <div className="flex gap-2">
              <button
                onClick={() => !loading && setOpen(false)}
                disabled={loading}
                className="flex-1 h-9 rounded-xl border border-slate-200 dark:border-[#1E3A5F] text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-[#162032] transition-colors disabled:opacity-50"
              >
                Annuler
              </button>
              <button
                onClick={handleConfirm}
                disabled={loading}
                className="flex-1 h-9 rounded-xl bg-[#2563EB] hover:bg-[#1D4ED8] text-white text-sm font-semibold transition-colors flex items-center justify-center gap-2 disabled:opacity-60"
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
