'use client'

import { useState } from 'react'
import { Plus, Play, Pause, Loader2, TriangleAlert } from 'lucide-react'
import { toast } from 'sonner'
import { METIER_OPTIONS } from '@/lib/scraping/naf-mapping'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'

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
  const [confirmLaunch, setConfirmLaunch] = useState(false)

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

      toast.success(`Campagne ${newStatut === 'en_cours' ? 'lancée' : 'mise en pause'}`)
      window.location.reload()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erreur')
    } finally {
      setLoading(false)
    }
  }

  if (inline && campaignId) {
    if (campaignStatut === 'terminee') return null
    const running = campaignStatut === 'en_cours'

    return (
      <>
        <button
          type="button"
          // Mettre en pause reste immédiat ; lancer demande une confirmation (démarchage désactivé par décision)
          onClick={() => (running ? toggleStatut() : setConfirmLaunch(true))}
          disabled={loading}
          className={running ? 'q-btn q-btn-secondary q-btn-sm' : 'q-btn q-btn-ghost q-btn-sm'}
        >
          {loading ? <Loader2 className="animate-spin" aria-hidden /> : running ? <Pause aria-hidden /> : <Play aria-hidden />}
          {running ? 'Mettre en pause' : 'Lancer'}
        </button>

        <Dialog open={confirmLaunch} onOpenChange={setConfirmLaunch}>
          <DialogContent showCloseButton={false} className="gap-3 sm:max-w-md">
            <DialogTitle className="q-display text-[22px] font-semibold leading-tight">Lancer cette campagne ?</DialogTitle>
            <DialogDescription className="q-banner q-banner-warn !gap-2 !px-3.5 !py-3 !text-[13px] !leading-relaxed">
              <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
              <span>
                Le démarchage est désactivé par décision : aucun email à froid. Une campagne lancée part avec la prochaine
                exécution de la séquence automatique. Ne continuez que si cette décision a changé.
              </span>
            </DialogDescription>
            <div className="mt-2 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button type="button" onClick={() => setConfirmLaunch(false)} className="q-btn q-btn-ghost">Annuler</button>
              <button type="button" onClick={() => { setConfirmLaunch(false); toggleStatut() }} className="q-btn q-btn-secondary">
                Lancer quand même
              </button>
            </div>
          </DialogContent>
        </Dialog>
      </>
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

      toast.success('Campagne créée (brouillon)')
      setShowForm(false)
      window.location.reload()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erreur')
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <button type="button" onClick={() => setShowForm(true)} className="q-btn q-btn-secondary q-btn-sm">
        <Plus aria-hidden />
        Nouvelle campagne
      </button>

      <Dialog open={showForm} onOpenChange={(o) => { if (!loading) setShowForm(o) }}>
        <DialogContent className="gap-4 sm:max-w-md">
          <DialogTitle className="q-display pr-8 text-[22px] font-semibold leading-tight">Créer une campagne</DialogTitle>
          <DialogDescription className="text-[13px] leading-relaxed !text-[var(--q-text-3)]">
            La campagne est créée en brouillon : rien ne part tant qu&apos;elle n&apos;est pas lancée.
          </DialogDescription>
          <form onSubmit={handleCreate} className="flex flex-col gap-3">
            <div className="flex flex-col gap-[7px]">
              <label htmlFor="oc-nom" className="q-label">Nom</label>
              <input id="oc-nom" name="nom" required placeholder="Nom de la campagne" className="q-input" />
            </div>
            <div className="flex flex-col gap-[7px]">
              <label htmlFor="oc-template" className="q-label">Modèle d&apos;email</label>
              <select id="oc-template" name="template_id" required className="q-input pr-2">
                {TEMPLATES.map((t) => (
                  <option key={t.id} value={t.id}>{t.label}</option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-[7px]">
              <label htmlFor="oc-metier" className="q-label">Métier visé</label>
              <select id="oc-metier" name="metier_cible" className="q-input pr-2">
                <option value="">Tous les métiers</option>
                {METIER_OPTIONS.map((m) => (
                  <option key={m.value} value={m.value}>{m.label}</option>
                ))}
              </select>
            </div>
            <div className="mt-1 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button type="button" onClick={() => setShowForm(false)} disabled={loading} className="q-btn q-btn-ghost">Annuler</button>
              <button type="submit" disabled={loading} className="q-btn q-btn-primary">
                {loading && <Loader2 className="animate-spin" aria-hidden />}
                Créer le brouillon
              </button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  )
}
