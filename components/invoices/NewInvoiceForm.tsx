'use client'

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { PaywallDialog, isSubscriptionRequired } from "@/components/billing/PaywallDialog"
import { DocumentEditor } from "@/components/documents/DocumentEditor"
import { PersonalizeTip } from "@/components/documents/PersonalizeTip"
import { useDocumentForm, usePreselectedClient } from "@/components/documents/useDocumentForm"
import { isoDateIn, newLine, toPayloadLines, type DocClient, type DocCompany } from "@/components/documents/model"

export default function NewInvoiceForm() {
  const router = useRouter()
  // Facture créée en brouillon mais pas envoyée faute de formule : mur de paiement
  const [paywallInvoice, setPaywallInvoice] = useState<{ id: string; number: string } | null>(null)
  const [loading,        setLoading]        = useState(false)
  const [saving,         setSaving]         = useState(false)
  const [previewing,     setPreviewing]     = useState(false)
  const [clients,        setClients]        = useState<DocClient[]>([])
  const [clientsLoading, setClientsLoading] = useState(true)
  const [company,        setCompany]        = useState<DocCompany | null>(null)
  const [hasLogo,        setHasLogo]        = useState(true) // true par défaut = masqué pendant le chargement
  const [tipDismissed,   setTipDismissed]   = useState(false)

  // Dates calculées au montage du composant (pas au chargement du module) pour
  // ne pas rester figées sur la veille dans un onglet resté ouvert (ou
  // préchargé par Next.js) à cheval sur minuit.
  const doc = useDocumentForm("invoice", () => ({
    client_id: "", issue_date: isoDateIn(0), due_date: isoDateIn(30), valid_until: "",
    delivery_date: "", reference: "", notes: "", lines: [newLine()],
  }))
  const { form, computed } = doc
  usePreselectedClient(doc, clients)

  useEffect(() => {
    fetch("/api/clients")
      .then(r => r.json())
      .then(json => { if (json.clients) setClients(json.clients) })
      .finally(() => setClientsLoading(false))
    fetch("/api/company")
      .then(r => r.json())
      .then(json => {
        setCompany(json?.company ?? null)
        setHasLogo(!!json?.company?.logo_url)
      })
      .catch(() => {})
  }, [])

  const previewPDF = async () => {
    if (!doc.validate()) { toast.error("Corrigez les erreurs avant de continuer"); return }
    setPreviewing(true)
    try {
      // Aperçu pur : ne crée aucune facture (pas d'écriture en base, pas de
      // numéro consommé) — contrairement à l'ancien comportement qui appelait
      // POST /api/invoices comme "Envoyer". Le PDF est filigrané « APERÇU ».
      const res = await fetch("/api/invoices/preview-pdf", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          client_id: form.client_id, issue_date: form.issue_date,
          due_date: form.due_date, notes: form.notes || null,
          lines: toPayloadLines(form.lines, computed),
        }),
      })
      if (!res.ok) {
        const json = await res.json().catch(() => ({}))
        toast.error(json.error || "Erreur lors de la génération de l'aperçu")
        return
      }
      const blob = await res.blob()
      const url  = URL.createObjectURL(blob)
      window.open(url, "_blank")
      toast.success("Aperçu PDF ouvert dans un nouvel onglet")
    } catch {
      toast.error("Erreur réseau")
    } finally {
      setPreviewing(false)
    }
  }

  const submit = async (action: "draft" | "send") => {
    if (!doc.validate()) { toast.error("Corrigez les erreurs avant de continuer"); return }
    if (action === "send") setLoading(true); else setSaving(true)
    try {
      const payload = {
        client_id:  form.client_id,
        issue_date: form.issue_date,
        due_date:   form.due_date,
        notes:      form.notes || null,
        lines:      toPayloadLines(form.lines, computed),
        status:     "draft",
      }
      const res  = await fetch("/api/invoices", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload),
      })
      const json = await res.json()
      if (!res.ok) {
        toast.error(json.error || "Erreur lors de la sauvegarde")
        return
      }

      // Si action "send" → envoyer réellement l'email via /api/invoices/{id}/send
      if (action === "send" && json.invoice?.id) {
        const sendRes = await fetch(`/api/invoices/${json.invoice.id}/send`, { method: "POST" })
        const sendJson = await sendRes.json()
        // Pas de formule : la facture reste un brouillon, le mur de paiement s'ouvre
        if (isSubscriptionRequired(sendRes.status, sendJson)) {
          setPaywallInvoice({ id: json.invoice.id, number: json.invoice.invoice_number })
          return
        }
        if (!sendRes.ok) {
          toast.error(sendJson.error ?? "Facture créée mais l'envoi par email a échoué")
          router.push(`/invoices/${json.invoice.id}`)
          router.refresh()
          return
        }
        toast.success(`Facture envoyée à ${sendJson.sentTo}`)
      } else {
        toast.success("Brouillon sauvegardé !")
      }
      router.push("/invoices")
      router.refresh()
    } catch {
      toast.error("Erreur réseau")
    } finally {
      setLoading(false); setSaving(false)
    }
  }

  const showTip = !hasLogo && !tipDismissed

  return (
    <>
      {paywallInvoice && (
        <PaywallDialog
          open
          onOpenChange={(open) => {
            if (open) return
            // « Pas maintenant » : le brouillon est enregistré, on y emmène l'artisan
            // (renvoyer le formulaire créerait un second brouillon)
            toast.success("Brouillon enregistré")
            router.push(`/invoices/${paywallInvoice.id}`)
          }}
          invoiceId={paywallInvoice.id}
          invoiceNumber={paywallInvoice.number}
        />
      )}

      <DocumentEditor
        kind="invoice"
        doc={doc}
        title="Nouvelle facture"
        status="nouveau brouillon · non enregistré"
        backHref="/invoices"
        backLabel="Factures"
        clients={clients}
        clientsLoading={clientsLoading}
        newClientHref="/clients/new"
        clientHref={(id) => `/clients/${id}/edit`}
        company={company}
        catalog={{ manageHref: "/products" }}
        banners={showTip && <PersonalizeTip href="/settings/invoices" cta="Configurer" onDismiss={() => setTipDismissed(true)} />}
        actions={{
          onSaveDraft: () => submit("draft"),
          onSend:      () => submit("send"),
          onPreviewPdf: previewPDF,
          saving,
          sending: loading,
          previewing,
        }}
      />
    </>
  )
}
