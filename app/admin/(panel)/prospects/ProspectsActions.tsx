'use client'

import { useState } from 'react'
import { Play, Download, Loader2, Sparkles, Trash2, TriangleAlert } from 'lucide-react'
import { toast } from 'sonner'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'

type Pending = 'extract' | 'enrich' | 'purge' | null

const CONFIRM: Record<Exclude<Pending, null>, { title: string; text: string; cta: string; danger?: boolean }> = {
  extract: {
    title: 'Lancer une extraction Sirene ?',
    text: 'Le démarchage est désactivé par décision : cette base ne doit plus être alimentée. Ne continuez que si cette décision a changé.',
    cta: 'Extraire quand même',
  },
  enrich: {
    title: 'Enrichir les emails ?',
    text: 'Le démarchage est désactivé par décision : rechercher des emails de prospects n\'a plus d\'usage. Ne continuez que si cette décision a changé.',
    cta: 'Enrichir quand même',
  },
  purge: {
    title: 'Vider la base de prospection ?',
    text: 'Tous les prospects, les campagnes et l\'historique d\'extraction seront supprimés. Action irréversible.',
    cta: 'Tout supprimer',
    danger: true,
  },
}

export default function ProspectsActions() {
  const [extracting, setExtracting] = useState(false)
  const [enriching, setEnriching] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [purging, setPurging] = useState(false)
  const [pending, setPending] = useState<Pending>(null)
  // Contenu de la fenêtre : garde la dernière action pendant l'animation de fermeture
  const [shown, setShown] = useState<Exclude<Pending, null>>('extract')

  const ask = (p: Exclude<Pending, null>) => { setShown(p); setPending(p) }

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
        `Enrichissement terminé : ${r.scraping?.found ?? 0} emails trouvés, ${r.enrichment?.enriched ?? 0} enrichis, ${r.verification?.valid ?? 0} vérifiés`
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
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || 'Erreur lors de l\'export')
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

  const busy = extracting || enriching || purging
  const confirm = async () => {
    const p = pending
    setPending(null)
    if (p === 'extract') await handleExtract()
    if (p === 'enrich') await handleEnrich()
    if (p === 'purge') await handlePurge()
  }
  const c = CONFIRM[shown]

  return (
    <>
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={handleExport} disabled={exporting} className="q-btn q-btn-secondary q-btn-sm">
          {exporting ? <Loader2 className="animate-spin" aria-hidden /> : <Download aria-hidden />}
          Exporter (CSV)
        </button>
        <button type="button" onClick={() => ask('extract')} disabled={busy} className="q-btn q-btn-ghost q-btn-sm">
          {extracting ? <Loader2 className="animate-spin" aria-hidden /> : <Play aria-hidden />}
          {extracting ? 'Extraction…' : 'Extraire Sirene'}
        </button>
        <button type="button" onClick={() => ask('enrich')} disabled={busy} className="q-btn q-btn-ghost q-btn-sm">
          {enriching ? <Loader2 className="animate-spin" aria-hidden /> : <Sparkles aria-hidden />}
          {enriching ? 'Enrichissement…' : 'Enrichir les emails'}
        </button>
        <button type="button" onClick={() => ask('purge')} disabled={busy} className="q-btn q-btn-danger q-btn-sm">
          {purging ? <Loader2 className="animate-spin" aria-hidden /> : <Trash2 aria-hidden />}
          Vider la base
        </button>
      </div>

      <Dialog open={pending !== null} onOpenChange={(o) => { if (!o) setPending(null) }}>
        <DialogContent showCloseButton={false} className="gap-3 sm:max-w-md">
          <DialogTitle className="q-display text-[22px] font-semibold leading-tight">{c.title}</DialogTitle>
          <DialogDescription className="q-banner q-banner-warn !gap-2 !px-3.5 !py-3 !text-[13px] !leading-relaxed">
            <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
            <span>{c.text}</span>
          </DialogDescription>
          <div className="mt-2 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button type="button" onClick={() => setPending(null)} className="q-btn q-btn-ghost">Annuler</button>
            <button type="button" onClick={confirm} className={c.danger ? 'q-btn q-btn-danger' : 'q-btn q-btn-secondary'}>
              {c.cta}
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
