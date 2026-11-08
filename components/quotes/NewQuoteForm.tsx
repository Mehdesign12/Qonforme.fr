'use client'

import { needsClientEmail, sendWindowHref } from "@/lib/email/client-email"
import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { toastCompanyRequired } from "@/components/shared/company-required"
import { DocumentEditor } from "@/components/documents/DocumentEditor"
import { PaywallDialog, isArtisanPaywall } from "@/components/billing/PaywallDialog"
import { useArtisanPlan } from "@/components/artisan/useArtisanPlan"
import { useDocumentForm, usePreselectedClient } from "@/components/documents/useDocumentForm"
import { hasEnteredContent, isoDateIn, newLine, type DocClient, type DocCompany, type DocForm } from "@/components/documents/model"
import { autosaveStatusText, payloadLinesOf, useDocumentAutosave } from "@/components/documents/useDocumentAutosave"
import { RestoredDraftBanner } from "@/components/documents/RestoredDraftBanner"
import { trackJourney } from "@/lib/journey"

export default function NewQuoteForm() {
  const router = useRouter()
  const [loading, setLoading]               = useState(false)
  const [saving, setSaving]                 = useState(false)
  const [clients, setClients]               = useState<DocClient[]>([])
  const [clientsLoading, setClientsLoading] = useState(true)
  const [company, setCompany]               = useState<DocCompany | null>(null)
  // Autoliquidation (formule Artisan) : case visible, mur de paiement sans la formule
  const artisan = useArtisanPlan()
  const [artisanPaywall, setArtisanPaywall] = useState(false)

  // Dates calculées au montage du composant (pas au chargement du module) — voir
  // components/invoices/NewInvoiceForm.tsx pour le même fix et son pourquoi.
  const blank = (): DocForm => ({
    client_id: "", issue_date: isoDateIn(0), due_date: "", valid_until: isoDateIn(30),
    delivery_date: "", reference: "", notes: "", lines: [newLine()],
  })
  const doc = useDocumentForm("quote", blank)
  const { form } = doc
  usePreselectedClient(doc, clients)
  const [owner, setOwner] = useState<string | null>(null)

  // Enregistrement automatique : copie sur l'appareil, puis brouillon dans « Devis »
  const autosave = useDocumentAutosave({
    kind: "quote", doc, endpoint: "/api/quotes", entity: "quote", owner, blank,
    buildPayload: (f) => ({
      client_id:   f.client_id,
      issue_date:  f.issue_date,
      valid_until: f.valid_until,
      notes:       f.notes || null,
      lines:       payloadLinesOf(f),
      status:      "draft",
    }),
    onCreated: (_id, action) => trackJourney("quote_created", { action }),
  })

  useEffect(() => {
    fetch("/api/clients")
      .then(r => r.json())
      .then(json => { if (json.clients) setClients(json.clients) })
      .finally(() => setClientsLoading(false))
    // Lecture seule : émetteur de l'aperçu et contrôle des coordonnées
    fetch("/api/company")
      .then(r => r.json())
      .then(json => { setCompany(json?.company ?? null); if (typeof json?.owner === "string") setOwner(json.owner) })
      .catch(() => {})
  }, [])

  const submit = async (action: "draft" | "send", next?: string) => {
    if (!doc.validate()) { trackJourney("document_form_invalid", { document: "quote" }); toast.error("Corrigez les erreurs avant de continuer"); return }
    if (action === "send") setLoading(true); else setSaving(true)

    try {
      // Met à jour le brouillon déjà enregistré automatiquement, ou le crée
      const saved = await autosave.persist(form, action)
      const { json } = saved
      if (isArtisanPaywall(saved.status, json)) { setArtisanPaywall(true); return }
      if (!saved.ok || !saved.id) { toast.error(json.error || "Erreur lors de la sauvegarde"); return }
      const quoteId = saved.id

      // Si action "send" → envoyer réellement l'email via /api/quotes/{id}/send
      if (action === "send") {
        const sendRes = await fetch(`/api/quotes/${quoteId}/send`, { method: "POST" })
        const sendJson = await sendRes.json()
        // Client sans adresse : la fiche s'ouvre sur la fenêtre d'envoi, qui la demande
        if (needsClientEmail(sendRes.status, sendJson)) {
          router.push(sendWindowHref(`/quotes/${quoteId}`))
          return
        }
        if (!sendRes.ok) {
          if (!toastCompanyRequired(sendRes.status, sendJson)) toast.error(sendJson.error ?? "Devis créé mais l'envoi par email a échoué")
          router.push(`/quotes/${quoteId}`)
          router.refresh()
          return
        }
        trackJourney("quote_sent")
        toast.success(`Devis envoyé à ${sendJson.sentTo}`)
      } else {
        toast.success("Brouillon sauvegardé !")
      }
      router.push(next ?? `/quotes/${quoteId}`)
      router.refresh()
    } catch {
      toast.error("Erreur réseau")
    } finally {
      setLoading(false); setSaving(false)
    }
  }

  return (
    <>
    <PaywallDialog open={artisanPaywall} onOpenChange={setArtisanPaywall} reason="artisan" nextPath="/quotes/new" />
    <DocumentEditor
      kind="quote"
      reverseCharge={{ locked: artisan === false, onLocked: () => setArtisanPaywall(true) }}
      doc={doc}
      title="Nouveau devis"
      status={autosaveStatusText("quote", autosave, doc.dirty, hasEnteredContent(form))}
      banners={autosave.restoredAt && <RestoredDraftBanner kind="quote" savedAt={autosave.restoredAt} onDiscard={autosave.discardRestored} />}
      backHref="/quotes"
      backLabel="Devis"
      clients={clients}
      clientsLoading={clientsLoading}
      newClientHref="/clients/new"
        onClientCreated={(created) => setClients((prev) => (prev.some((x) => x.id === created.id) ? prev : [created, ...prev]))}
      clientHref={(id) => `/clients/${id}/edit`}
      company={company}
      catalog={{ manageHref: "/products" }}
      actions={{
        onSaveDraft: (next) => submit("draft", next),
        onSend:      () => submit("send"),
        saving,
        sending: loading,
      }}
    />
    </>
  )
}
