'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeftRight, Loader2, X, AlertTriangle } from 'lucide-react'

interface Props {
  userId: string
  currentPlan: 'starter' | 'pro'
  billingPeriod: string | null
}

export default function AdminQuickPlanToggle({ userId, currentPlan, billingPeriod }: Props) {
  const router = useRouter()
  const [open,    setOpen]    = useState(false)
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState<string | null>(null)
  const [confirmedNewPlan, setConfirmedNewPlan] = useState<'starter' | 'pro' | null>(null)

  const newPlan = currentPlan === 'starter' ? 'pro' : 'starter'
  const isDowngrade = currentPlan === 'pro'
  const periodLabel = billingPeriod === 'yearly' ? 'annuel' : 'mensuel'

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
      // Réinitialiser le message de succès après 3s
      setTimeout(() => setConfirmedNewPlan(null), 3000)
    } catch {
      setError('Erreur réseau. Réessaie.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      {/* ── Badge plan + bouton toggle ──────────────────────────────────── */}
      <span className="group inline-flex items-center gap-1">
        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold capitalize ${
          confirmedNewPlan
            ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
            : 'bg-[#EFF6FF] dark:bg-[#1E3A5F] text-[#2563EB] dark:text-[#3B82F6]'
        }`}>
          {confirmedNewPlan
            ? `✓ ${confirmedNewPlan === 'pro' ? 'Pro' : 'Starter'}`
            : (
              <>
                {currentPlan}
                {billingPeriod && <span className="ml-1 opacity-60">· {periodLabel}</span>}
              </>
            )
          }
        </span>
        <button
          onClick={() => { setError(null); setOpen(true) }}
          title={`Passer en ${newPlan === 'pro' ? 'Pro' : 'Starter'}`}
          className="opacity-0 group-hover:opacity-100 w-5 h-5 rounded flex items-center justify-center text-slate-400 hover:text-[#2563EB] hover:bg-[#EFF6FF] dark:hover:bg-[#1E3A5F] dark:hover:text-[#3B82F6] transition-all"
        >
          <ArrowLeftRight className="w-3 h-3" />
        </button>
      </span>

      {/* ── Modal de confirmation ──────────────────────────────────────── */}
      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm px-4"
          onClick={(e) => { if (e.target === e.currentTarget && !loading) setOpen(false) }}
        >
          <div className="bg-white dark:bg-[#0F1E35] rounded-2xl border border-slate-200 dark:border-[#1E3A5F] shadow-2xl w-full max-w-xs p-5">

            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-bold text-[#0F172A] dark:text-[#E2E8F0]">
                Changer le plan
              </h2>
              <button
                onClick={() => !loading && setOpen(false)}
                disabled={loading}
                className="w-6 h-6 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-[#162032] transition-colors"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Plan actuel → nouveau */}
            <div className="flex items-center justify-center gap-2 mb-4">
              <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-slate-100 dark:bg-[#162032] text-slate-600 dark:text-slate-300 capitalize">
                {currentPlan}
              </span>
              <ArrowLeftRight className="w-3.5 h-3.5 text-slate-400" />
              <span className={`px-2.5 py-1 rounded-full text-[11px] font-bold capitalize ${
                newPlan === 'pro'
                  ? 'bg-[#EFF6FF] dark:bg-[#1E3A5F] text-[#2563EB] dark:text-[#3B82F6]'
                  : 'bg-slate-100 dark:bg-[#162032] text-slate-600 dark:text-slate-300'
              }`}>
                {newPlan}
              </span>
            </div>

            {/* Warning downgrade */}
            {isDowngrade && (
              <div className="flex items-start gap-2 text-[11px] text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 rounded-lg px-3 py-2 mb-4">
                <AlertTriangle className="w-3 h-3 shrink-0 mt-0.5" />
                <span>Limite 10 factures/mois dès maintenant</span>
              </div>
            )}

            {error && (
              <p className="text-[11px] text-red-600 dark:text-red-400 mb-3">{error}</p>
            )}

            <div className="flex gap-2">
              <button
                onClick={() => !loading && setOpen(false)}
                disabled={loading}
                className="flex-1 h-8 rounded-lg border border-slate-200 dark:border-[#1E3A5F] text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-[#162032] transition-colors disabled:opacity-50"
              >
                Annuler
              </button>
              <button
                onClick={handleConfirm}
                disabled={loading}
                className="flex-1 h-8 rounded-lg bg-[#2563EB] hover:bg-[#1D4ED8] text-white text-xs font-semibold transition-colors flex items-center justify-center gap-1.5 disabled:opacity-60"
              >
                {loading && <Loader2 className="w-3 h-3 animate-spin" />}
                {loading ? 'En cours…' : 'Confirmer'}
              </button>
            </div>

          </div>
        </div>
      )}
    </>
  )
}
