'use client'

export const dynamic = "force-dynamic"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { HardHat, Loader2 } from "lucide-react"
import { EmptyState } from "@/components/app/kit"
import { ChantierDetailView } from "@/components/artisan/ChantierDetailView"
import { ChantierFormDialog, chantierFormBody, chantierToForm, type ChantierFormValues } from "@/components/artisan/ChantierFormDialog"
import { AttachDocumentDialog, type AttachCandidateView } from "@/components/artisan/AttachDocumentDialog"
import { FreeDepositDialog } from "@/components/artisan/FreeDepositDialog"
import { ArtisanUnavailable } from "@/components/artisan/ArtisanNotice"
import { PaywallDialog, isArtisanPaywall } from "@/components/billing/PaywallDialog"
import type { Chantier, ChantierDoc, ChantierSummary } from "@/lib/artisan/chantier"

interface Loaded {
  available: boolean
  artisan: boolean | null
  today: string
  chantier: Chantier
  documents: ChantierDoc[]
  summary: ChantierSummary
}

const DOC_PATHS: Record<ChantierDoc["type"], string> = {
  quote: "/quotes", invoice: "/invoices", credit_note: "/credit-notes", purchase_order: "/purchase-orders",
}

/** Fiche d'un chantier (formule Artisan). */
export default function ChantierPage({ params }: { params: { id: string } }) {
  const router = useRouter()
  const [data, setData] = useState<Loaded | null>(null)
  const [state, setState] = useState<"loading" | "ready" | "missing" | "unavailable" | "error">("loading")
  const [paywall, setPaywall] = useState(false)
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [clients, setClients] = useState<{ id: string; name: string }[]>([])
  const [attachOpen, setAttachOpen] = useState(false)
  const [candidates, setCandidates] = useState<AttachCandidateView[]>([])
  const [candidatesLoading, setCandidatesLoading] = useState(false)
  const [attachBusy, setAttachBusy] = useState<string | null>(null)
  const [depositOpen, setDepositOpen] = useState(false)
  const [depositBusy, setDepositBusy] = useState(false)
  const [busy, setBusy] = useState<{ reception?: boolean; release?: boolean; pdf?: boolean; delete?: boolean }>({})

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/chantiers/${params.id}`)
      const json = await res.json().catch(() => ({}))
      if (res.status === 404) { setState("missing"); return }
      if (!res.ok) { setState("error"); return }
      if (json.available === false) { setState("unavailable"); return }
      setData(json as Loaded)
      setState("ready")
    } catch {
      setState("error")
    }
  }, [params.id])

  useEffect(() => { void load() }, [load])

  /** Écriture d'une route Artisan : 402 → mur de paiement. Renvoie le JSON si tout va bien. */
  const write = async (url: string, init: RequestInit): Promise<Record<string, unknown> | null> => {
    const res = await fetch(url, { headers: { "Content-Type": "application/json" }, ...init })
    const json = await res.json().catch(() => ({}))
    if (isArtisanPaywall(res.status, json)) { setPaywall(true); return null }
    if (!res.ok) { toast.error((json as { error?: string }).error ?? "L'opération a échoué."); return null }
    return json as Record<string, unknown>
  }

  const patch = async (body: Record<string, unknown>, flag: keyof typeof busy, success: string) => {
    setBusy((b) => ({ ...b, [flag]: true }))
    try {
      const json = await write(`/api/chantiers/${params.id}`, { method: "PATCH", body: JSON.stringify(body) })
      if (json) { toast.success(success); await load() }
    } catch { toast.error("Erreur réseau") }
    finally { setBusy((b) => ({ ...b, [flag]: false })) }
  }

  if (state === "loading") return (
    <div className="grid min-h-[50vh] place-items-center">
      <Loader2 className="size-7 animate-spin text-[var(--q-accent)]" aria-label="Chargement du chantier" />
    </div>
  )
  if (state === "unavailable") return <ArtisanUnavailable />
  if (state !== "ready" || !data) return (
    <div className="q-card">
      <EmptyState
        icon={<HardHat className="size-5" aria-hidden />}
        title={state === "missing" ? "Chantier introuvable" : "Chargement impossible"}
        text={state === "missing" ? "Il a peut-être été supprimé, ou le lien est incomplet." : "Vérifiez votre connexion, puis réessayez."}
        action={<Link href="/chantiers" className="q-btn q-btn-secondary">Retour aux chantiers</Link>}
      />
    </div>
  )

  const c = data.chantier
  const openEdit = () => {
    if (data.artisan === false) { setPaywall(true); return }
    fetch("/api/clients").then((r) => r.json()).then((json) => {
      if (Array.isArray(json.clients)) setClients(json.clients.map((x: { id: string; name: string }) => ({ id: x.id, name: x.name })))
    }).catch(() => {})
    setEditing(true)
  }

  const saveEdit = async (values: ChantierFormValues) => {
    setSaving(true)
    try {
      const json = await write(`/api/chantiers/${params.id}`, { method: "PATCH", body: JSON.stringify(chantierFormBody(values)) })
      if (json) { toast.success("Chantier enregistré"); setEditing(false); await load() }
    } catch { toast.error("Erreur réseau") }
    finally { setSaving(false) }
  }

  const openAttach = async () => {
    if (data.artisan === false) { setPaywall(true); return }
    setAttachOpen(true)
    setCandidatesLoading(true)
    try {
      const res = await fetch(`/api/chantiers/${params.id}/documents`)
      const json = await res.json().catch(() => ({}))
      setCandidates(Array.isArray(json.candidates) ? json.candidates : [])
    } catch { setCandidates([]) }
    finally { setCandidatesLoading(false) }
  }

  const attach = async (doc: { type: string; id: string }, attachIt: boolean) => {
    setAttachBusy(doc.id)
    try {
      const json = await write(`/api/chantiers/${params.id}/documents`, { method: "POST", body: JSON.stringify({ type: doc.type, id: doc.id, attach: attachIt }) })
      if (json) {
        toast.success(attachIt ? "Document rattaché" : "Document détaché")
        setCandidates((list) => list.filter((x) => x.id !== doc.id))
        await load()
      }
    } catch { toast.error("Erreur réseau") }
    finally { setAttachBusy(null) }
  }

  const downloadRequest = async () => {
    setBusy((b) => ({ ...b, pdf: true }))
    try {
      const res = await fetch(`/api/chantiers/${params.id}/retention-request`)
      if (!res.ok) { const json = await res.json().catch(() => ({})); toast.error(json.error ?? "Le document n'a pas pu être généré."); return }
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url; a.download = "liberation-retenue-garantie.pdf"
      document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url)
    } catch { toast.error("Erreur réseau") }
    finally { setBusy((b) => ({ ...b, pdf: false })) }
  }

  const remove = async () => {
    if (!confirm(`Supprimer le chantier « ${c.name} » ? Ses documents sont conservés, seulement détachés.`)) return
    setBusy((b) => ({ ...b, delete: true }))
    try {
      const res = await fetch(`/api/chantiers/${params.id}`, { method: "DELETE" })
      if (res.ok) { toast.success("Chantier supprimé"); router.push("/chantiers") }
      else { const json = await res.json().catch(() => ({})); toast.error(json.error ?? "Suppression impossible") }
    } catch { toast.error("Erreur réseau") }
    finally { setBusy((b) => ({ ...b, delete: false })) }
  }

  const createDeposit = async (body: Record<string, unknown>) => {
    setDepositBusy(true)
    try {
      const json = await write("/api/artisan/deposits", { method: "POST", body: JSON.stringify(body) })
      const inv = json?.invoice as { id?: string } | undefined
      if (inv?.id) { toast.success("Brouillon d'acompte créé"); router.push(`/invoices/${inv.id}`) }
    } catch { toast.error("Erreur réseau") }
    finally { setDepositBusy(false) }
  }

  return (
    <>
      <PaywallDialog open={paywall} onOpenChange={setPaywall} reason="artisan" nextPath={`/chantiers/${params.id}`} />
      {editing && (
        <ChantierFormDialog open onOpenChange={setEditing} title="Modifier le chantier" initial={chantierToForm(c)} clients={clients.length ? clients : c.client ? [c.client] : []} saving={saving} onSubmit={saveEdit} />
      )}
      <AttachDocumentDialog
        open={attachOpen}
        onOpenChange={setAttachOpen}
        candidates={candidates}
        loading={candidatesLoading}
        busyId={attachBusy}
        onAttach={(doc) => attach(doc, true)}
      />
      {depositOpen && c.client_id && (
        <FreeDepositDialog
          open
          onOpenChange={setDepositOpen}
          clientId={c.client_id}
          clientName={c.client?.name}
          chantier={{ id: c.id, name: c.name }}
          defaultReverseCharge={c.subcontracting}
          today={data.today}
          submitting={depositBusy}
          onSubmit={createDeposit}
        />
      )}
      <ChantierDetailView
        chantier={c}
        documents={data.documents}
        summary={data.summary}
        today={data.today}
        artisan={data.artisan}
        backHref="/chantiers"
        docHref={(d) => `${DOC_PATHS[d.type]}/${d.id}`}
        clientHref={c.client_id ? `/clients/${c.client_id}` : null}
        newQuoteHref={c.client_id ? `/quotes/new?client=${c.client_id}` : "/quotes/new"}
        busy={busy}
        actions={{
          onEdit: openEdit,
          onAttach: openAttach,
          onDetach: (d) => { if (data.artisan === false) setPaywall(true); else void attach(d, false) },
          onFreeDeposit: () => { if (data.artisan === false) setPaywall(true); else setDepositOpen(true) },
          onSaveReception: (date) => patch(
            date ? { reception_date: date, status: c.status === "closed" ? "closed" : "received" } : { reception_date: null },
            "reception",
            date ? "Réception enregistrée" : "Date de réception retirée",
          ),
          onMarkReleased: (date) => patch({ retention_released_at: date }, "release", date ? "Retenue notée comme encaissée" : "Libération annulée"),
          onRetentionRequest: downloadRequest,
          onDelete: remove,
        }}
      />
    </>
  )
}
