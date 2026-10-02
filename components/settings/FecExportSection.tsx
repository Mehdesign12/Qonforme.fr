'use client'

import { useState } from 'react'
import Link from 'next/link'
import {
  Download, AlertCircle, CheckCircle2, FileDown,
  Calendar, ChevronRight, Loader2,
} from 'lucide-react'

interface FecExportSectionProps {
  sirenMissing: boolean
  siren:        string
}

export default function FecExportSection({ sirenMissing, siren }: FecExportSectionProps) {
  const currentYear = new Date().getFullYear()
  const prevYear    = currentYear - 1

  const [from,    setFrom]    = useState(`${currentYear}-01-01`)
  const [to,      setTo]      = useState(`${currentYear}-12-31`)
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const setYear = (year: number) => {
    setFrom(`${year}-01-01`)
    setTo(`${year}-12-31`)
    setError(null)
    setSuccess(false)
  }

  const handleDownload = async () => {
    setLoading(true)
    setError(null)
    setSuccess(false)
    try {
      const res = await fetch(`/api/export/fec?from=${from}&to=${to}`)

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error ?? 'Erreur lors de la génération du FEC.')
      }

      const blob        = await res.blob()
      const url         = URL.createObjectURL(blob)
      const disposition = res.headers.get('Content-Disposition') ?? ''
      const match       = disposition.match(/filename="([^"]+)"/)
      const filename    = match?.[1] ?? `${siren}FEC${to.replace(/-/g, '')}.txt`

      const a    = document.createElement('a')
      a.href     = url
      a.download = filename
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)

      setSuccess(true)
      setTimeout(() => setSuccess(false), 4000)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setLoading(false)
    }
  }

  /* ── SIREN manquant — bloquer l'export ────────────────────────────────── */
  if (sirenMissing) {
    return (
      <div className="rounded-2xl border border-[#FED7AA] bg-[#FFF7ED] dark:bg-[#2D1B0E] dark:border-[#92400E] p-5 flex gap-4">
        <div className="w-9 h-9 rounded-xl bg-[#FEF3C7] border border-[#FDE68A] flex items-center justify-center shrink-0">
          <AlertCircle className="w-4 h-4 text-[#D97706]" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[13px] font-semibold text-[#92400E] dark:text-[#FDE68A] mb-1">
            SIREN requis pour exporter le FEC
          </p>
          <p className="text-[12px] text-[#B45309] dark:text-[#FCD34D] leading-relaxed mb-3">
            Le nom du fichier FEC inclut ton SIREN (ex&nbsp;: 123456789FEC20261231.txt).
            Renseigne-le dans les paramètres de ton entreprise avant de lancer l&apos;export.
          </p>
          <Link
            href="/settings/company"
            className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-[#D97706] hover:text-[#B45309] transition-colors"
          >
            Configurer mon entreprise
            <ChevronRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </div>
    )
  }

  /* ── Interface principale ─────────────────────────────────────────────── */
  return (
    <div className="space-y-4">

      {/* ── Sélecteur de période ── */}
      <div className="bg-white dark:bg-[#0F1E35] rounded-2xl border border-[#E2E8F0] dark:border-[#1E3A5F] p-5">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-8 h-8 rounded-lg bg-[#EFF6FF] border border-[#BFDBFE] flex items-center justify-center">
            <Calendar className="w-4 h-4 text-[#2563EB]" />
          </div>
          <p className="text-[13px] font-semibold text-[#0F172A] dark:text-[#E2E8F0]">
            Période comptable
          </p>
        </div>

        {/* Raccourcis rapides */}
        <div className="flex gap-2 mb-4 flex-wrap">
          {[
            { label: 'Année en cours',    year: currentYear },
            { label: 'Année précédente',  year: prevYear    },
          ].map(({ label, year }) => {
            const active = from === `${year}-01-01` && to === `${year}-12-31`
            return (
              <button
                key={year}
                onClick={() => setYear(year)}
                className={`text-[12px] font-medium px-3 py-1.5 rounded-lg border transition-colors ${
                  active
                    ? 'bg-[#2563EB] border-[#2563EB] text-white'
                    : 'bg-white dark:bg-[#0F1E35] border-[#E2E8F0] dark:border-[#1E3A5F] text-slate-500 hover:border-[#2563EB] hover:text-[#2563EB]'
                }`}
              >
                {label} ({year})
              </button>
            )
          })}
        </div>

        {/* Dates personnalisées */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex-1 min-w-[140px]">
            <label className="block text-[11px] font-medium text-slate-400 mb-1">
              Du
            </label>
            <input
              type="date"
              value={from}
              max={to}
              onChange={e => { setFrom(e.target.value); setError(null); setSuccess(false) }}
              className="w-full text-[13px] font-medium text-[#0F172A] dark:text-[#E2E8F0] bg-[#F8FAFC] dark:bg-[#0A1628] border border-[#E2E8F0] dark:border-[#1E3A5F] rounded-xl px-3 py-2 focus:outline-none focus:border-[#2563EB] focus:ring-1 focus:ring-[#2563EB]/20 transition-colors"
            />
          </div>
          <div className="flex-1 min-w-[140px]">
            <label className="block text-[11px] font-medium text-slate-400 mb-1">
              Au
            </label>
            <input
              type="date"
              value={to}
              min={from}
              onChange={e => { setTo(e.target.value); setError(null); setSuccess(false) }}
              className="w-full text-[13px] font-medium text-[#0F172A] dark:text-[#E2E8F0] bg-[#F8FAFC] dark:bg-[#0A1628] border border-[#E2E8F0] dark:border-[#1E3A5F] rounded-xl px-3 py-2 focus:outline-none focus:border-[#2563EB] focus:ring-1 focus:ring-[#2563EB]/20 transition-colors"
            />
          </div>
        </div>
      </div>

      {/* ── Bouton de téléchargement ── */}
      <button
        onClick={handleDownload}
        disabled={loading || !from || !to}
        className="w-full flex items-center justify-center gap-2.5 rounded-2xl px-5 py-3.5 text-[14px] font-semibold transition-all
          bg-[#2563EB] hover:bg-[#1D4ED8] active:bg-[#1E40AF] text-white shadow-sm
          disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none"
      >
        {loading ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            Génération en cours…
          </>
        ) : success ? (
          <>
            <CheckCircle2 className="w-4 h-4" />
            Fichier téléchargé
          </>
        ) : (
          <>
            <Download className="w-4 h-4" />
            Télécharger le FEC
          </>
        )}
      </button>

      {/* ── Message d'erreur ── */}
      {error && (
        <div className="flex items-start gap-3 rounded-xl border border-[#FECACA] bg-[#FEF2F2] dark:bg-[#2D0A0A] dark:border-[#991B1B] px-4 py-3">
          <AlertCircle className="w-4 h-4 text-[#EF4444] shrink-0 mt-0.5" />
          <p className="text-[12px] text-[#DC2626] dark:text-[#FCA5A5] leading-relaxed">{error}</p>
        </div>
      )}

      {/* ── Contenu inclus dans le FEC ── */}
      <div className="rounded-2xl border border-[#E2E8F0] dark:border-[#1E3A5F] bg-[#F8FAFC] dark:bg-[#0A1628] px-5 py-4">
        <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-slate-400 mb-3">
          Contenu du fichier
        </p>
        <ul className="space-y-2">
          {[
            'Toutes les factures émises (hors brouillons et annulées)',
            'Tous les avoirs de la période',
            'Écritures par taux de TVA (0 %, 5,5 %, 10 %, 20 %)',
            'Comptes PCG : 411 (clients), 706 (ventes), 4457x (TVA)',
            '18 colonnes au format DGFiP, encodage UTF-8 avec BOM',
          ].map(item => (
            <li key={item} className="flex items-start gap-2.5">
              <FileDown className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
              <span className="text-[12px] text-slate-500 dark:text-slate-400 leading-relaxed">{item}</span>
            </li>
          ))}
        </ul>
      </div>

    </div>
  )
}
