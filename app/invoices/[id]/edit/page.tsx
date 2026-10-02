'use client'

export const dynamic = "force-dynamic"

import { useState, useEffect } from "react"
import { useRouter, useParams } from "next/navigation"
import { toast } from "sonner"
import { Loader2 } from "lucide-react"
import { PaywallDialog, isSubscriptionRequired } from "@/components/billing/PaywallDialog"
import { SetCrumb } from "@/components/layout/crumb"
import { DocumentEditor } from "@/components/documents/DocumentEditor"
import { useDocumentForm } from "@/components/documents/useDocumentForm"
import { lineFromSaved, newLine, toPayloadLines, withDocClient, type DocClient, type DocCompany } from "@/components/documents/model"

export default function EditInvoicePage() {
  const router = useRouter()
  const [showPaywall, setShowPaywall] = useState(false)
  const { id } = useParams<{ id: string }>()

  const [invoiceNumber, setInvoiceNumber] = useState("")
  const [clients, setClients]             = useState<DocClient[]>([])
  const [company, setCompany]             = useState<DocCompany | null>(null)
  const [loadingData, setLoadingData]     = useState(true)
  const [saving, setSaving]               = useState(false)
  const [sending, setSending]             = useState(false)

  const doc = useDocumentForm("invoice", () => ({
    client_id: "", issue_date: "", due_date: "", valid_until: "", delivery_date: "",
    reference: "", notes: "", lines: [newLine()],
  }))
  const { form, computed, load } = doc

  // Charger la facture + les clients (+ l'entreprise, pour l'aperçu)
  useEffect(() => {
    fetch("/api/company")
      .then(r => r.json())
      .then(json => setCompany(json?.company ?? null))
      .catch(() => {})
    Promise.all([
      fetch(`/api/invoices/${id}`).then(r => r.json()),
      fetch("/api/clients").then(r => r.json()),
    ]).then(([invJson, cliJson]) => {
      if (invJson.invoice) {
        const inv = invJson.invoice
        // Contenu modifiable seulement en brouillon (la route PATCH le refuse aussi)
        if (inv.status !== "draft") {
          toast.error("Seules les factures brouillons peuvent être modifiées")
          router.replace(`/invoices/${id}`)
          return
        }
        setInvoiceNumber(inv.invoice_number)
        load({
          client_id:     inv.client_id  || "",
          issue_date:    inv.issue_date || "",
          due_date:      inv.due_date   || "",
          valid_until:   "",
          delivery_date: "",
          reference:     "",
          notes:         inv.notes      || "",
          lines:         (inv.lines || []).map(lineFromSaved),
        })
        setClients(withDocClient(cliJson.clients ?? [], inv.client))
      } else if (cliJson.clients) {
        setClients(cliJson.clients)
      }
    }).finally(() => setLoadingData(false))
  }, [id, router, load])

  const submit = async (action: "draft" | "send") => {
    if (!doc.validate()) { toast.error("Corrigez les erreurs avant de continuer"); return }
    if (action === "send") setSending(true); else setSaving(true)

    try {
      const payload = {
        client_id:  form.client_id,
        issue_date: form.issue_date,
        due_date:   form.due_date,
        notes:      form.notes || null,
        lines:      toPayloadLines(form.lines, computed),
      }

      // 1. Enregistrer le brouillon
      const res  = await fetch(`/api/invoices/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      const json = await res.json()
      if (!res.ok) { toast.error(json.error || "Erreur lors de la sauvegarde"); return }

      // 2. « Envoyer » envoie vraiment l'email (et émet la facture) — avant, le
      //    statut passait à « envoyée » sans qu'aucun email ne parte.
      if (action === "send") {
        const sendRes  = await fetch(`/api/invoices/${id}/send`, { method: "POST" })
        const sendJson = await sendRes.json()
        if (isSubscriptionRequired(sendRes.status, sendJson)) { setShowPaywall(true); return }
        if (!sendRes.ok) {
          toast.error(sendJson.error ?? "Brouillon enregistré, mais l'envoi par email a échoué")
          router.push(`/invoices/${id}`)
          router.refresh()
          return
        }
        toast.success(`Facture envoyée à ${sendJson.sentTo}`)
      } else {
        toast.success("Brouillon sauvegardé !")
      }
      router.push(`/invoices/${id}`)
      router.refresh()
    } catch {
      toast.error("Erreur réseau")
    } finally {
      setSaving(false); setSending(false)
    }
  }

  if (loadingData) return (
    <div className="flex items-center justify-center py-24">
      <Loader2 className="size-8 animate-spin text-[var(--q-accent)]" aria-label="Chargement de la facture" />
    </div>
  )

  return (
    <>
      <SetCrumb label={invoiceNumber || null} />
      <PaywallDialog
        open={showPaywall}
        onOpenChange={(open) => {
          if (open) return
          setShowPaywall(false)
          toast.success("Brouillon enregistré")
          router.push(`/invoices/${id}`)
        }}
        invoiceId={id}
        invoiceNumber={invoiceNumber || undefined}
      />

      <DocumentEditor
        kind="invoice"
        doc={doc}
        title={invoiceNumber ? `Modifier ${invoiceNumber}` : "Modifier la facture"}
        status={`${invoiceNumber ? `${invoiceNumber} · ` : ""}brouillon · ${doc.dirty ? "modifications non enregistrées" : "enregistré"}`}
        number={invoiceNumber || null}
        backHref={`/invoices/${id}`}
        backLabel={invoiceNumber || "Facture"}
        clients={clients}
        clientsLoading={false}
        newClientHref="/clients/new"
        clientHref={(clientId) => `/clients/${clientId}/edit`}
        company={company}
        catalog={{ manageHref: "/products" }}
        actions={{
          onSaveDraft: () => submit("draft"),
          onSend:      () => submit("send"),
          saving,
          sending,
          cancelHref: `/invoices/${id}`,
        }}
      />
    </>
  )
}
