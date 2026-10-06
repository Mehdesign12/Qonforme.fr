'use client'

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { toastCompanyRequired } from "@/components/shared/company-required"
import { DocumentEditor } from "@/components/documents/DocumentEditor"
import { useDocumentForm, usePreselectedClient } from "@/components/documents/useDocumentForm"
import { isoDateIn, lineFromSaved, newLine, toPayloadLines, withDocClient, type DocClient, type DocCompany } from "@/components/documents/model"

// ── Props ─────────────────────────────────────────────────────────────────────

interface PurchaseOrderFormProps {
  /** Mode édition : données initiales */
  initial?: {
    client_id:     string
    issue_date:    string
    delivery_date: string | null
    reference:     string | null
    notes:         string | null
    lines:         { description: string; quantity: number; unit_price_ht: number; vat_rate: number; total_ht: number; total_vat: number; total_ttc: number }[]
    po_number:     string
    /** Client du bon (gardé même s'il a été archivé depuis). */
    client?:       DocClient | null
  }
  /** ID du BdC en édition (undefined = création) */
  editId?: string
}

// ── Composant ─────────────────────────────────────────────────────────────────

export default function PurchaseOrderForm({ initial, editId }: PurchaseOrderFormProps) {
  const router = useRouter()

  const [saving, setSaving]   = useState(false)
  const [sending, setSending] = useState(false)
  const [clients, setClients] = useState<DocClient[]>([])
  const [clientsLoading, setClientsLoading] = useState(true)
  const [company, setCompany] = useState<DocCompany | null>(null)

  // Dates calculées au montage (jamais au chargement du module)
  const doc = useDocumentForm("purchase_order", () => {
    if (initial) {
      return {
        client_id:     initial.client_id,
        issue_date:    initial.issue_date,
        due_date:      "",
        valid_until:   "",
        delivery_date: initial.delivery_date ?? "",
        reference:     initial.reference ?? "",
        notes:         initial.notes ?? "",
        lines:         initial.lines.map(lineFromSaved),
      }
    }
    return {
      client_id: "", issue_date: isoDateIn(0), due_date: "", valid_until: "", delivery_date: isoDateIn(30),
      reference: "", notes: "", lines: [newLine()],
    }
  })
  const { form, computed } = doc
  usePreselectedClient(doc, clients, !initial)

  useEffect(() => {
    fetch("/api/clients")
      .then(r => r.json())
      .then(json => { if (json.clients) setClients(withDocClient(json.clients, initial?.client)) })
      .finally(() => setClientsLoading(false))
    // Lecture seule : émetteur de l'aperçu et contrôle des coordonnées
    fetch("/api/company")
      .then(r => r.json())
      .then(json => setCompany(json?.company ?? null))
      .catch(() => {})
  }, [initial?.client])

  // ── Soumission ────────────────────────────────────────────────────────────

  const submit = async (action: "draft" | "send") => {
    if (!doc.validate()) { toast.error("Corrigez les erreurs avant de continuer"); return }
    if (action === "send") setSending(true); else setSaving(true)

    try {
      const payload = {
        client_id:     form.client_id,
        issue_date:    form.issue_date,
        delivery_date: form.delivery_date || null,
        reference:     form.reference.trim() || null,
        notes:         form.notes || null,
        lines:         toPayloadLines(form.lines, computed),
      }

      let po_id: string

      if (editId) {
        // Édition
        const res  = await fetch(`/api/purchase-orders/${editId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        })
        const json = await res.json()
        if (!res.ok) { toast.error(json.error || "Erreur lors de la sauvegarde"); return }
        po_id = editId
        toast.success("Bon de commande mis à jour !")
      } else {
        // Création
        const res  = await fetch("/api/purchase-orders", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        })
        const json = await res.json()
        if (!res.ok) { toast.error(json.error || "Erreur lors de la création"); return }
        po_id = json.purchase_order.id
        toast.success("Bon de commande créé !")
      }

      // Envoi email si demandé
      if (action === "send") {
        const sendRes  = await fetch(`/api/purchase-orders/${po_id}/send`, { method: "POST" })
        const sendJson = await sendRes.json()
        if (!sendRes.ok) {
          if (!toastCompanyRequired(sendRes.status, sendJson)) toast.warning(`Bon de commande sauvegardé mais envoi échoué : ${sendJson.error}`)
        } else {
          toast.success(`Envoyé à ${sendJson.sentTo}`)
        }
      }

      router.push(`/purchase-orders/${po_id}`)
      router.refresh()
    } catch {
      toast.error("Erreur réseau")
    } finally {
      setSaving(false); setSending(false)
    }
  }

  // ── Rendu ─────────────────────────────────────────────────────────────────

  return (
    <DocumentEditor
      kind="purchase_order"
      doc={doc}
      title={editId && initial ? `Modifier ${initial.po_number}` : "Nouveau bon de commande"}
      status={
        editId && initial
          ? `${initial.po_number} · brouillon · ${doc.dirty ? "modifications non enregistrées" : "enregistré"}`
          : "nouveau brouillon · non enregistré"
      }
      number={initial?.po_number}
      backHref={editId ? `/purchase-orders/${editId}` : "/purchase-orders"}
      backLabel={editId && initial ? initial.po_number : "Bons de commande"}
      clients={clients}
      clientsLoading={clientsLoading}
      newClientHref="/clients/new"
      clientHref={(id) => `/clients/${id}/edit`}
      company={company}
      catalog={{ manageHref: "/products" }}
      actions={{
        onSaveDraft: () => submit("draft"),
        onSend:      () => submit("send"),
        saving,
        sending,
        saveLabel:  editId ? "Enregistrer les modifications" : "Enregistrer le brouillon",
        sendLabel:  editId ? "Enregistrer et envoyer" : "Créer et envoyer",
        cancelHref: editId ? `/purchase-orders/${editId}` : undefined,
      }}
    />
  )
}
