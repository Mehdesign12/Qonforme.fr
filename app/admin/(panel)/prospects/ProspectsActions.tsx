'use client'

import { useState } from 'react'
import { Play, Download, Loader2 } from 'lucide-react'
import { toast } from 'sonner'

export default function ProspectsActions() {
  const [extracting, setExtracting] = useState(false)
  const [exporting, setExporting] = useState(false)

  async function handleExtract() {
    setExtracting(true)
    try {
      const res = await fetch('/api/admin/scraping/sirene', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}), // batch auto
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Erreur inconnue')

      const totalInserted = (data.results as { totalInserted: number }[])?.reduce(
        (sum: number, r: { totalInserted: number }) => sum + r.totalInserted, 0
      ) ?? 0
      toast.success(`Extraction terminée : ${totalInserted} nouveaux prospects insérés`)
      // Refresh la page pour voir les résultats
      window.location.reload()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erreur lors de l\'extraction')
    } finally {
      setExtracting(false)
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
        onClick={handleExport}
        disabled={exporting}
        className="h-9 px-4 text-sm font-medium rounded-lg border border-border text-foreground hover:bg-muted disabled:opacity-50 transition-colors flex items-center gap-2"
      >
        {exporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
        CSV
      </button>
    </div>
  )
}
