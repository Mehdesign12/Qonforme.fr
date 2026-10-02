'use client'

/**
 * Carte « Nouvel export » de la page Exports comptables (planche « Exports ») :
 * période (année en cours, année précédente ou dates libres), format FEC,
 * téléchargement par GET /api/export/fec?from=…&to=….
 *
 * Seul le FEC existe : pas de journal des ventes, d'archive de justificatifs,
 * de grand livre ni d'envoi automatique au comptable (non livrés).
 * Démo (`mode="demo"`) : rien n'est téléchargé.
 */
import { useState } from 'react'
import Link from 'next/link'
import { toast } from 'sonner'
import { AlertCircle, CheckCircle2, ChevronRight, Download, FileText, Loader2 } from 'lucide-react'
import type { ShellMode } from '@/components/layout/nav'
import { settingsHref } from '@/components/settings/sections'
import { SettingsCard } from '@/components/settings/ui'

interface FecExportSectionProps {
  sirenMissing: boolean
  siren:        string
  mode?:        ShellMode
}

const MONTHS = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.']

/** « 2026-01-01 » → « 1 janv. 2026 », sans passer par Date (pas d'écart de fuseau entre serveur et navigateur). */
function shortDate(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number)
  if (!y || !m || !d) return iso
  return `${d} ${MONTHS[m - 1]} ${y}`
}

export default function FecExportSection({ sirenMissing, siren, mode = 'app' }: FecExportSectionProps) {
  const demo        = mode === 'demo'
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
    if (demo) {
      toast('Créez un compte pour télécharger le FEC de vos factures', {
        action: { label: "S'inscrire", onClick: () => { window.location.href = '/signup' } },
      })
      return
    }
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

  /* ── SIREN manquant : l'export est bloqué ─────────────────────────────── */
  if (sirenMissing) {
    return (
      <SettingsCard id="export" title="Nouvel export">
        <div className="q-banner q-banner-warn" role="status">
          <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
          <div className="flex flex-col gap-1">
            <p className="font-semibold">SIREN requis pour exporter le FEC</p>
            <p className="text-[13px] leading-relaxed text-[var(--q-text-2)]">
              Le nom du fichier FEC contient votre SIREN (ex.&nbsp;: 123456789FEC20261231.txt).
              Renseignez-le dans les informations de votre entreprise avant de lancer l&apos;export.
            </p>
            <Link href={settingsHref('/settings/company', mode)} className="q-link inline-flex items-center gap-1 text-[13px]">
              Compléter mon entreprise
              <ChevronRight className="size-3.5" aria-hidden />
            </Link>
          </div>
        </div>
      </SettingsCard>
    )
  }

  const isYear = (year: number) => from === `${year}-01-01` && to === `${year}-12-31`

  /* ── Interface principale ─────────────────────────────────────────────── */
  return (
    <SettingsCard id="export" title="Nouvel export">
      {/* Période */}
      <div className="flex flex-col gap-2">
        <span className="q-label" id="periode-label">Période</span>
        <div className="q-seg self-start" role="group" aria-labelledby="periode-label">
          {[
            { label: 'Année en cours',   year: currentYear },
            { label: 'Année précédente', year: prevYear    },
          ].map(({ label, year }) => (
            <button key={year} type="button" aria-pressed={isYear(year)} onClick={() => setYear(year)}>
              {label} ({year})
            </button>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="flex min-w-0 flex-col gap-1.5">
            <label htmlFor="fec-from" className="q-label">Du</label>
            <input
              id="fec-from"
              type="date"
              value={from}
              max={to}
              onChange={e => { setFrom(e.target.value); setError(null); setSuccess(false) }}
              className="q-input"
            />
          </div>
          <div className="flex min-w-0 flex-col gap-1.5">
            <label htmlFor="fec-to" className="q-label">Au</label>
            <input
              id="fec-to"
              type="date"
              value={to}
              min={from}
              onChange={e => { setTo(e.target.value); setError(null); setSuccess(false) }}
              className="q-input"
            />
          </div>
        </div>
        <p className="flex items-center gap-1.5 text-[13px] text-[var(--q-text-3)]">
          <FileText className="size-4 shrink-0 text-[var(--q-text-4)]" strokeWidth={1.75} aria-hidden />
          Factures émises et avoirs · du {shortDate(from)} au {shortDate(to)}
        </p>
      </div>

      {/* Format : le FEC est le seul export disponible */}
      <div className="flex flex-col gap-2 border-t border-[var(--q-line-soft)] pt-3.5">
        <span className="q-label">Format</span>
        <div className="flex items-start gap-3 rounded-xl border-[1.5px] border-[var(--q-accent)] bg-[var(--q-wash)] p-3.5">
          <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-[var(--q-accent)]" strokeWidth={2} aria-hidden />
          <span className="flex min-w-0 flex-col gap-0.5">
            <span className="text-[15px] font-semibold text-[var(--q-ink)]">FEC</span>
            <span className="text-[13px] leading-relaxed text-[var(--q-text-3)]">
              Fichier des écritures comptables, au format défini par l&apos;administration fiscale
            </span>
          </span>
        </div>
      </div>

      {/* Erreur */}
      {error && (
        <div className="q-banner border-[var(--q-danger-line)] bg-[var(--q-danger-bg)] text-[var(--q-danger)]" role="alert">
          <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
          <p className="text-[13px] leading-relaxed">{error}</p>
        </div>
      )}

      {/* Téléchargement */}
      <div className="flex justify-end border-t border-[var(--q-line-soft)] pt-3.5">
        <button
          type="button"
          onClick={handleDownload}
          disabled={loading || !from || !to}
          className="q-btn q-btn-primary q-btn-xl w-full md:h-10 md:w-auto md:rounded-[10px] md:px-4 md:text-sm"
        >
          {loading ? (
            <><Loader2 className="animate-spin" aria-hidden />Génération en cours…</>
          ) : success ? (
            <><CheckCircle2 aria-hidden />Fichier téléchargé</>
          ) : (
            <><Download aria-hidden />Télécharger le FEC</>
          )}
        </button>
      </div>
    </SettingsCard>
  )
}
