'use client'

export const dynamic = "force-dynamic"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { toast } from "sonner"
import { Loader2 } from "lucide-react"
import { EmptyState, PURCHASE_ORDER_PILLS } from "@/components/app/kit"
import { createClient } from "@/lib/supabase/client"
import { PurchaseOrderDetailView, type PurchaseOrderDetailData } from "@/components/purchase-orders/PurchaseOrderDetailView"
import { poSubject, type POStatus } from "@/components/purchase-orders/PurchaseOrderListView"
import type { PaperParty } from "@/components/purchase-orders/detail-bits"
import { todayISO } from "@/components/quotes/QuoteListHelpers"
import { selectCompanyWithProfile } from "@/lib/legal/db"
import { snapshotOf } from "@/lib/legal/mentions"

/* ------------------------------------------------------------------ */
/* Types                                                                */
/* ------------------------------------------------------------------ */

interface ApiPurchaseOrder {
  id:            string
  po_number:     string
  status:        POStatus
  issue_date:    string
  delivery_date: string | null
  reference:     string | null
  lines:         PurchaseOrderDetailData["lines"] | null
  subtotal_ht:   number
  total_vat:     number
  total_ttc:     number
  notes:         string | null
  sent_at:       string | null
  confirmed_at:  string | null
  created_at:    string
  /** Mentions figées à l'envoi (lib/legal/mentions.ts) ; absent avant la migration. */
  legal_snapshot?: unknown
  client: {
    id:        string
    name:      string
    email:     string | null
    address?:  string | null
    zip_code?: string | null
    city?:     string | null
    siren?:    string | null
    vat_number?: string | null
  } | null
}

function toDetail(p: ApiPurchaseOrder): PurchaseOrderDetailData {
  const lines = (p.lines ?? []).map((l) => ({
    ...l, quantity: Number(l.quantity), unit_price_ht: Number(l.unit_price_ht), vat_rate: Number(l.vat_rate), total_ht: Number(l.total_ht),
  }))
  return {
    id: p.id,
    po_number: p.po_number,
    status: p.status,
    subject: poSubject(lines, false),
    issue_date: p.issue_date,
    delivery_date: p.delivery_date,
    reference: p.reference,
    lines,
    subtotal_ht: Number(p.subtotal_ht) || 0,
    total_vat: Number(p.total_vat) || 0,
    total_ttc: Number(p.total_ttc) || 0,
    notes: p.notes,
    sent_at: p.sent_at,
    confirmed_at: p.confirmed_at,
    created_at: p.created_at,
    client: p.client ? { ...p.client, href: `/clients/${p.client.id}`, editHref: `/clients/${p.client.id}/edit` } : null,
    legal_snapshot: p.legal_snapshot,
  }
}

/* ------------------------------------------------------------------ */
/* Page                                                                 */
/* ------------------------------------------------------------------ */

export default function PurchaseOrderDetailPage({ params }: { params: { id: string } }) {
  const router = useRouter()

  const [today]                           = useState(todayISO)
  const [po, setPo]                       = useState<PurchaseOrderDetailData | null>(null)
  const [company, setCompany]             = useState<PaperParty | null>(null)
  const [loading, setLoading]             = useState(true)
  const [statusLoading, setStatusLoading] = useState(false)
  const [deleteLoading, setDeleteLoading] = useState(false)
  const [pdfLoading, setPdfLoading]       = useState(false)
  const [sendLoading, setSendLoading]     = useState(false)

  /* ── Chargement ── */
  useEffect(() => {
    const supabase = createClient()
    Promise.all([
      fetch(`/api/purchase-orders/${params.id}`).then(r => r.json()),
      // Mentions libres et profil légal (s'il existe) : pied de l'aperçu, comme le PDF
      selectCompanyWithProfile(supabase, "name,address,zip_code,city,siret,siren,vat_number,legal_notice"),
    ]).then(([json, { data: comp }]) => {
      if (json.purchase_order) setPo(toDetail(json.purchase_order))
      if (comp) setCompany(comp as PaperParty)
    }).finally(() => setLoading(false))
  }, [params.id])

  /* ── Changement de statut (liste blanche côté serveur : lib/utils/document-status.ts) ── */
  const changeStatus = async (newStatus: POStatus): Promise<boolean> => {
    if (!po) return false
    setStatusLoading(true)
    try {
      const res  = await fetch(`/api/purchase-orders/${params.id}`, {
        method:  "PATCH",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ status: newStatus }),
      })
      const json = await res.json()
      if (!res.ok) { toast.error(json.error ?? "Le statut n'a pas pu être changé"); return false }
      // La route renvoie un client réduit (id, nom, email) : on garde la fiche déjà chargée
      setPo(prev => prev ? { ...toDetail({ ...json.purchase_order, client: null }), client: prev.client } : prev)
      toast.success(`Statut mis à jour : ${PURCHASE_ORDER_PILLS[newStatus]?.label ?? newStatus}`)
      return true
    } catch { toast.error("Erreur réseau"); return false }
    finally { setStatusLoading(false) }
  }

  /* ── Téléchargement PDF ── */
  const downloadPDF = async () => {
    if (!po) return
    setPdfLoading(true)
    try {
      const res = await fetch(`/api/purchase-orders/${params.id}/pdf`)
      if (!res.ok) { toast.error("Erreur lors de la génération du PDF"); return }
      const blob = await res.blob()
      const url  = URL.createObjectURL(blob)
      const a    = document.createElement("a")
      a.href = url
      a.download = `${po.po_number}.pdf`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      toast.success("PDF téléchargé")
    } catch { toast.error("Erreur lors du téléchargement") }
    finally { setPdfLoading(false) }
  }

  /* ── Suppression brouillon ── */
  const deletePO = async (): Promise<boolean> => {
    if (!po) return false
    setDeleteLoading(true)
    try {
      const res = await fetch(`/api/purchase-orders/${params.id}`, { method: "DELETE" })
      if (res.ok) {
        toast.success("Brouillon supprimé")
        router.push("/purchase-orders")
        return true
      }
      const json = await res.json()
      toast.error(json.error ?? "Le brouillon n'a pas pu être supprimé")
      return false
    } catch { toast.error("Erreur réseau"); return false }
    finally { setDeleteLoading(false) }
  }

  /* ── Envoi email ── */
  const sendByEmail = async (): Promise<boolean> => {
    if (!po) return false
    setSendLoading(true)
    try {
      const res  = await fetch(`/api/purchase-orders/${params.id}/send`, { method: "POST" })
      const json = await res.json()
      if (!res.ok) { toast.error(json.error ?? "Erreur lors de l'envoi"); return false }
      // Un brouillon passe à « Envoyé » ; un bon déjà envoyé garde son statut
      // Un brouillon envoyé a désormais ses mentions figées (relues au prochain chargement)
      setPo(prev => prev ? {
        ...prev,
        status: prev.status === "draft" ? "sent" : prev.status,
        sent_at: new Date().toISOString(),
        legal_snapshot: prev.legal_snapshot ?? (prev.status === "draft" ? snapshotOf(company) : undefined),
      } : prev)
      toast.success(`Bon de commande envoyé à ${json.sentTo}`)
      return true
    } catch { toast.error("Erreur réseau"); return false }
    finally { setSendLoading(false) }
  }

  /* ── États d'affichage ── */
  if (loading) return (
    <div className="grid min-h-[320px] place-items-center">
      <Loader2 className="size-7 animate-spin text-[var(--q-accent)]" aria-label="Chargement du bon de commande" />
    </div>
  )

  if (!po) return (
    <div className="q-card">
      <EmptyState
        title="Bon de commande introuvable"
        text="Il a peut-être été supprimé, ou le lien est incomplet."
        action={<Link href="/purchase-orders" className="q-btn q-btn-secondary">Retour aux bons de commande</Link>}
      />
    </div>
  )

  return (
    <PurchaseOrderDetailView
      po={po}
      company={company}
      today={today}
      listHref="/purchase-orders"
      companySettingsHref="/settings/company"
      actions={{
        onDownloadPdf: downloadPDF,
        onSend: sendByEmail,
        onChangeStatus: changeStatus,
        onDelete: deletePO,
        editHref: `/purchase-orders/${params.id}/edit`,
        busy: { pdf: pdfLoading, send: sendLoading, status: statusLoading, delete: deleteLoading },
      }}
    />
  )
}
