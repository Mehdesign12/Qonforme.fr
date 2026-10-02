'use client'

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { DocumentEditor } from "@/components/documents/DocumentEditor"
import { useDocumentForm } from "@/components/documents/useDocumentForm"
import { isoDateIn, newLine, toPayloadLines, type DocClient, type DocCompany } from "@/components/documents/model"

export default function NewQuoteForm() {
  const router = useRouter()
  const [loading, setLoading]               = useState(false)
  const [saving, setSaving]                 = useState(false)
  const [clients, setClients]               = useState<DocClient[]>([])
  const [clientsLoading, setClientsLoading] = useState(true)
  const [company, setCompany]               = useState<DocCompany | null>(null)

  // Dates calculées au montage du composant (pas au chargement du module) — voir
  // components/invoices/NewInvoiceForm.tsx pour le même fix et son pourquoi.
  const doc = useDocumentForm("quote", () => ({
    client_id: "", issue_date: isoDateIn(0), due_date: "", valid_until: isoDateIn(30),
    delivery_date: "", reference: "", notes: "", lines: [newLine()],
  }))
  const { form, computed } = doc

  useEffect(() => {
    fetch("/api/clients")
      .then(r => r.json())
      .then(json => { if (json.clients) setClients(json.clients) })
      .finally(() => setClientsLoading(false))
    // Lecture seule : émetteur de l'aperçu et contrôle des coordonnées
    fetch("/api/company")
      .then(r => r.json())
      .then(json => setCompany(json?.company ?? null))
      .catch(() => {})
  }, [])

  const submit = async (action: "draft" | "send") => {
    if (!doc.validate()) { toast.error("Corrigez les erreurs avant de continuer"); return }
    if (action === "send") setLoading(true); else setSaving(true)

    try {
      const payload = {
        client_id:   form.client_id,
        issue_date:  form.issue_date,
        valid_until: form.valid_until,
        notes:       form.notes || null,
        lines:       toPayloadLines(form.lines, computed),
        status:      "draft",
      }

      const res  = await fetch("/api/quotes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      const json = await res.json()
      if (!res.ok) { toast.error(json.error || "Erreur lors de la sauvegarde"); return }

      // Si action "send" → envoyer réellement l'email via /api/quotes/{id}/send
      if (action === "send" && json.quote?.id) {
        const sendRes = await fetch(`/api/quotes/${json.quote.id}/send`, { method: "POST" })
        const sendJson = await sendRes.json()
        if (!sendRes.ok) {
          toast.error(sendJson.error ?? "Devis créé mais l'envoi par email a échoué")
          router.push(`/quotes/${json.quote.id}`)
          router.refresh()
          return
        }
        toast.success(`Devis envoyé à ${sendJson.sentTo}`)
      } else {
        toast.success("Brouillon sauvegardé !")
      }
      router.push(`/quotes/${json.quote.id}`)
      router.refresh()
    } catch {
      toast.error("Erreur réseau")
    } finally {
      setLoading(false); setSaving(false)
    }
  }

  return (
    <DocumentEditor
      kind="quote"
      doc={doc}
      title="Nouveau devis"
      status="nouveau brouillon · non enregistré"
      backHref="/quotes"
      backLabel="Devis"
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
        sending: loading,
      }}
    />
  )
}
