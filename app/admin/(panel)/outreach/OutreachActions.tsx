'use client'

import { useState } from 'react'
import { Plus, Play, Pause, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { METIER_OPTIONS } from '@/lib/scraping/naf-mapping'

const TEMPLATES = [
  { id: 'alerte-reglementaire', label: 'Alerte réglementaire', type: 'alerte_reglementaire' },
  { id: 'invitation-demo', label: 'Invitation démo', type: 'invitation_demo' },
  { id: 'offre-lancement', label: 'Offre lancement', type: 'offre_lancement' },
]

export default function OutreachActions({
  campaignId,
  campaignStatut,
  inline,
}: {
  campaignId?: string
  campaignStatut?: string
  inline?: boolean
}) {
  const [loading, setLoading] = useState(false)
  const [showForm, setShowForm] = useState(false)

  // ── Actions sur une campagne existante ──────────────────────────────────
  const toggleStatut = async () => {
    setLoading(true)
    try {
      const newStatut = campaignStatut === 'en_cours' ? 'pausee'
        : campaignStatut === 'pausee' ? 'en_cours'
        : campaignStatut === 'brouillon' || campaignStatut === 'planifiee' ? 'en_cours'
        : null

      if (!newStatut) return

      const res = await fetch('/api/admin/outreach', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: campaignId, statut: newStatut }),
      })
      if (!res.ok) throw new Error((await res.json()).error)

      toast.success(`Campagne ${newStatut === 'en_cours' ? 'lancée' : 'pausée'}`)
      window.location.reload()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erreur')
    } finally {
      setLoading(false)
    }
  }

  if (inline && campaignId) {
    if (campaignStatut === 'terminee') return null

    return (
      <button
        onClick={toggleStatut}
        disabled={loading}
        className="inline-flex items-center gap-1.5 text-[12px] font-medium text-[#2563EB] hover:underline disabled:opacity-50"
      >
        {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> :
          campaignStatut === 'en_cours' ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
        {campaignStatut === 'en_cours' ? 'Pause' : 'Lancer'}
      </button>
    )
  }

  // ── Bouton + formulaire création ────────────────────────────────────────
  async function handleCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)

    const formData = new FormData(e.currentTarget)
    const body = {
      nom: formData.get('nom') as string,
      type: TEMPLATES.find(t => t.id === formData.get('template_id'))?.type ?? 'alerte_reglementaire',
      template_id: formData.get('template_id') as string,
      metier_cible: (formData.get('metier_cible') as string) || undefined,
    }

    try {
      const res = await fetch('/api/admin/outreach', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) throw new Error((await res.json()).error)

      toast.success('Campagne créée')
      setShowForm(false)
      window.location.reload()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erreur')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="relative">
      <button
        onClick={() => setShowForm(!showForm)}
        className="h-9 px-4 text-sm font-medium rounded-lg bg-[#2563EB] text-white hover:bg-[#1d4ed8] transition-colors flex items-center gap-2"
      >
        <Plus className="w-4 h-4" />
        Nouvelle campagne
      </button>

      {showForm && (
        <div className="absolute right-0 top-12 z-50 w-80 rounded-2xl border border-slate-200 dark:border-[#1E3A5F] bg-white dark:bg-[#0F1E35] shadow-xl p-5">
          <h3 className="text-sm font-bold text-foreground mb-3">Créer une campagne</h3>
          <form onSubmit={handleCreate} className="space-y-3">
            <input
              name="nom"
              required
              placeholder="Nom de la campagne"
              className="w-full h-9 px-3 text-sm rounded-lg border border-border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            />
            <select
              name="template_id"
              required
              className="w-full h-9 px-3 text-sm rounded-lg border border-border bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            >
              {TEMPLATES.map((t) => (
                <option key={t.id} value={t.id}>{t.label}</option>
              ))}
            </select>
            <select
              name="metier_cible"
              className="w-full h-9 px-3 text-sm rounded-lg border border-border bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="">Tous les métiers</option>
              {METIER_OPTIONS.map((m) => (
                <option key={m.value} value={m.value}>{m.label}</option>
              ))}
            </select>
            <div className="flex gap-2">
              <button
                type="submit"
                disabled={loading}
                className="flex-1 h-9 text-sm font-medium rounded-lg bg-[#2563EB] text-white hover:bg-[#1d4ed8] disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
              >
                {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                Créer
              </button>
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="h-9 px-3 text-sm font-medium rounded-lg border border-border text-foreground hover:bg-muted transition-colors"
              >
                Annuler
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}
