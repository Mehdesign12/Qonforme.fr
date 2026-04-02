'use client'

import { useState } from 'react'
import { Play, Download, Loader2, Sparkles, Trash2 } from 'lucide-react'
import { toast } from 'sonner'

export default function ProspectsActions() {
  const [extracting, setExtracting] = useState(false)
  const [enriching, setEnriching] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [purging, setPurging] = useState(false)

  async function handleExtract() {
    setExtracting(true)
    try {
      const res = await fetch('/api/admin/scraping/sirene', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Erreur inconnue')

      const totalInserted = (data.results as { totalInserted: number }[])?.reduce(
        (sum: number, r: { totalInserted: number }) => sum + r.totalInserted, 0
      ) ?? 0
      toast.success(`Extraction terminée : ${totalInserted} nouveaux prospects insérés`)
      window.location.reload()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erreur lors de l\'extraction')
    } finally {
      setExtracting(false)
    }
  }

  async function handleEnrich() {
    setEnriching(true)
    try {
      const res = await fetch('/api/admin/prospects/enrich', { method: 'POST' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Erreur inconnue')

      const r = data.results
      toast.success(
        `Enrichissement terminé : ${r.scraping?.found ?? 0} emails scrapés, ${r.enrichment?.enriched ?? 0} enrichis, ${r.verification?.valid ?? 0} vérifiés`
      )
      window.location.reload()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erreur lors de l\'enrichissement')
    } finally {
      setEnriching(false)
    }
  }

  async function handleExport() {
    setExporting(true)
    try {
      const res = await fetch('/api/admin/prospects/export')
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Erreur export')
      }

      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `prospects-${new Date().toISOString().split('T')[0]}.csv`
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
      toast.success('Export CSV téléchargé')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erreur lors de l\'export')
    } finally {
      setExporting(false)
    }
  }

  async function handlePurge() {
    if (!confirm('Supprimer TOUS les prospects, campagnes et historique de scraping ? Cette action est irréversible.')) return
    setPurging(true)
    try {
      const res = await fetch('/api/admin/prospects/purge', { method: 'POST' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Erreur')
      toast.success(`Base vidée : ${data.deleted ?? 0} prospects supprimés`)
      window.location.reload()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erreur lors de la purge')
    } finally {
      setPurging(false)
    }
  }

  return (
    <div className="flex gap-2">
      <button
        onClick={handleExtract}
        disabled={extracting}
        className="h-9 px-4 text-sm font-medium rounded-lg bg-[#2563EB] text-white hover:bg-[#1d4ed8] disabled:opacity-50 transition-colors flex items-center gap-2"
      >
        {extracting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
        {extracting ? 'Extraction…' : 'Extraire Sirene'}
      </button>
      <button
        onClick={handleEnrich}
        disabled={enriching}
        className="h-9 px-4 text-sm font-medium rounded-lg bg-[#059669] text-white hover:bg-[#047857] disabled:opacity-50 transition-colors flex items-center gap-2"
      >
        {enriching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
        {enriching ? 'Enrichissement…' : 'Enrichir emails'}
      </button>
      <button
        onClick={handleExport}
        disabled={exporting}
        className="h-9 px-4 text-sm font-medium rounded-lg border border-border text-foreground hover:bg-muted disabled:opacity-50 transition-colors flex items-center gap-2"
      >
        {exporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
        CSV
      </button>
      <button
        onClick={handlePurge}
        disabled={purging}
        className="h-9 px-4 text-sm font-medium rounded-lg border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 disabled:opacity-50 transition-colors flex items-center gap-2"
      >
        {purging ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
        Vider
      </button>
    </div>
  )
}
