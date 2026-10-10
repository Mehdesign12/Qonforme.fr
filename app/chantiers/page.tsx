'use client'

export const dynamic = "force-dynamic"

import { useCallback, useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { ChantierListView, type ChantierWithSummary } from "@/components/artisan/ChantierListView"
import { ChantierFormDialog, chantierFormBody, emptyChantierForm, type ChantierFormValues } from "@/components/artisan/ChantierFormDialog"
import { PaywallDialog, isArtisanPaywall } from "@/components/billing/PaywallDialog"

/** Chantiers (formule Artisan) : liste, création. Masqué tant que la migration n'est pas appliquée. */
export default function ChantiersPage() {
  const router = useRouter()
  const [chantiers, setChantiers] = useState<ChantierWithSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [unavailable, setUnavailable] = useState(false)
  const [artisan, setArtisan] = useState<boolean | null>(null)
  const [form, setForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [paywall, setPaywall] = useState(false)
  const [clients, setClients] = useState<{ id: string; name: string }[]>([])

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch("/api/chantiers")
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json.error ?? "Erreur réseau")
      setUnavailable(json.available === false)
      setArtisan(json.artisan ?? null)
      setChantiers(Array.isArray(json.chantiers) ? json.chantiers : [])
    } catch {
      setError("Vérifiez votre connexion, puis réessayez.")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void load() }, [load])

  const openForm = () => {
    if (artisan === false) { setPaywall(true); return }
    if (clients.length === 0) {
      fetch("/api/clients").then((r) => r.json()).then((json) => {
        if (Array.isArray(json.clients)) setClients(json.clients.map((c: { id: string; name: string }) => ({ id: c.id, name: c.name })))
      }).catch(() => {})
    }
    setForm(true)
  }

  const create = async (values: ChantierFormValues) => {
    setSaving(true)
    try {
      const res = await fetch("/api/chantiers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(chantierFormBody(values)),
      })
      const json = await res.json().catch(() => ({}))
      if (isArtisanPaywall(res.status, json)) { setForm(false); setPaywall(true); return }
      if (!res.ok || !json.chantier) { toast.error(json.error ?? "Le chantier n'a pas pu être créé."); return }
      toast.success("Chantier créé")
      router.push(`/chantiers/${json.chantier.id}`)
    } catch {
      toast.error("Erreur réseau")
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <PaywallDialog open={paywall} onOpenChange={setPaywall} reason="artisan" nextPath="/chantiers" />
      {form && (
        <ChantierFormDialog
          open
          onOpenChange={setForm}
          title="Nouveau chantier"
          initial={emptyChantierForm()}
          clients={clients}
          saving={saving}
          onSubmit={create}
        />
      )}
      <ChantierListView
        chantiers={chantiers}
        loading={loading}
        error={error}
        onRetry={load}
        unavailable={unavailable}
        artisan={artisan}
        hrefFor={(id) => `/chantiers/${id}`}
        onCreate={openForm}
      />
    </>
  )
}
