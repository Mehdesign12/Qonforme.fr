'use client'

import { useState } from 'react'
import { AlertCircle, CheckCircle2, Download, Loader2, Table2 } from 'lucide-react'

/** Raccourcis de période : année en cours, année précédente, mois précédent */
function presets(now = new Date()) {
  const y = now.getFullYear()
  const pm = new Date(y, now.getMonth() - 1, 1)
  const pmEnd = new Date(y, now.getMonth(), 0)
  const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  return [
    { label: `Année ${y}`, from: `${y}-01-01`, to: `${y}-12-31` },
    { label: `Année ${y - 1}`, from: `${y - 1}-01-01`, to: `${y - 1}-12-31` },
    { label: 'Mois dernier', from: iso(pm), to: iso(pmEnd) },
  ]
}

const dateInput =
  'w-full text-base md:text-[13px] font-medium text-[#0F172A] dark:text-[#E2E8F0] bg-[#F8FAFC] dark:bg-[#0A1628] border border-[#E2E8F0] dark:border-[#1E3A5F] rounded-xl px-3 py-2 focus:outline-none focus:border-[#2563EB] focus:ring-1 focus:ring-[#2563EB]/20 transition-colors'

export default function SalesJournalSection() {
  const P = presets()
  const [from, setFrom] = useState(P[0].from)
  const [to, setTo] = useState(P[0].to)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  const download = async () => {
    setLoading(true)
    setError(null)
    setDone(false)
    try {
      const res = await fetch(`/api/export/sales-journal?from=${from}&to=${to}`)
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error ?? 'Erreur lors de la génération du journal.')
      }
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `journal-des-ventes_${from}_${to}.csv`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      setDone(true)
      setTimeout(() => setDone(false), 4000)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <section className="bg-white dark:bg-[#0F1E35] rounded-2xl border border-[#E2E8F0] dark:border-[#1E3A5F] p-5 space-y-4">
      <div className="flex items-start gap-3">
        <div className="w-8 h-8 rounded-lg bg-[#EFF6FF] border border-[#BFDBFE] flex items-center justify-center shrink-0">
          <Table2 className="w-4 h-4 text-[#2563EB]" />
        </div>
        <div>
          <h2 className="text-[13px] font-semibold text-[#0F172A] dark:text-[#E2E8F0]">Journal des ventes (CSV)</h2>
          <p className="text-[12px] text-slate-500 leading-relaxed mt-0.5">
            Une ligne par facture et par avoir, TVA ventilée par taux. S’ouvre directement dans Excel ou LibreOffice, à transmettre à votre expert-comptable.
          </p>
        </div>
      </div>

      <div className="flex gap-2 flex-wrap">
        {P.map((p) => {
          const active = from === p.from && to === p.to
          return (
            <button
              key={p.label}
              type="button"
              onClick={() => { setFrom(p.from); setTo(p.to); setError(null) }}
              className={`text-[12px] font-medium px-3 py-1.5 rounded-lg border transition-colors ${
                active
                  ? 'bg-[#2563EB] border-[#2563EB] text-white'
                  : 'bg-white dark:bg-[#0F1E35] border-[#E2E8F0] dark:border-[#1E3A5F] text-slate-500 hover:border-[#2563EB] hover:text-[#2563EB]'
              }`}
            >
              {p.label}
            </button>
          )
        })}
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex-1 min-w-[140px]">
          <label htmlFor="sj-from" className="block text-[11px] font-medium text-slate-400 mb-1">Du</label>
          <input id="sj-from" type="date" value={from} max={to} onChange={(e) => { setFrom(e.target.value); setError(null) }} className={dateInput} />
        </div>
        <div className="flex-1 min-w-[140px]">
          <label htmlFor="sj-to" className="block text-[11px] font-medium text-slate-400 mb-1">Au</label>
          <input id="sj-to" type="date" value={to} min={from} onChange={(e) => { setTo(e.target.value); setError(null) }} className={dateInput} />
        </div>
      </div>

      <button
        type="button"
        onClick={download}
        disabled={loading || !from || !to}
        className="w-full flex items-center justify-center gap-2.5 rounded-xl px-5 py-3 text-[14px] font-semibold border border-[#2563EB] text-[#2563EB] hover:bg-[#EFF6FF] dark:hover:bg-[#1E3A5F] disabled:opacity-50 transition-colors"
      >
        {loading ? <><Loader2 className="w-4 h-4 animate-spin" />Génération en cours…</> : done ? <><CheckCircle2 className="w-4 h-4" />Fichier téléchargé</> : <><Download className="w-4 h-4" />Télécharger le journal des ventes</>}
      </button>

      {error && (
        <div className="flex items-start gap-3 rounded-xl border border-[#FECACA] bg-[#FEF2F2] dark:bg-[#2D0A0A] dark:border-[#991B1B] px-4 py-3">
          <AlertCircle className="w-4 h-4 text-[#EF4444] shrink-0 mt-0.5" />
          <p className="text-[12px] text-[#DC2626] dark:text-[#FCA5A5] leading-relaxed">{error}</p>
        </div>
      )}
    </section>
  )
}
