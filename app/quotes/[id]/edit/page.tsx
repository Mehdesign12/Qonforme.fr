'use client'

export const dynamic = "force-dynamic"

import { useState, useEffect } from "react"
import { useRouter, useParams } from "next/navigation"
import { toast } from "sonner"
import { Loader2 } from "lucide-react"
import { SetCrumb } from "@/components/layout/crumb"
import { DocumentEditor } from "@/components/documents/DocumentEditor"
import { useDocumentForm } from "@/components/documents/useDocumentForm"
import { lineFromSaved, newLine, toPayloadLines, withDocClient, type DocClient, type DocCompany } from "@/components/documents/model"

export default function EditQuotePage() {
  const router = useRouter()
  const { id } = useParams<{ id: string }>()

  const [quoteNumber, setQuoteNumber] = useState("")
  const [clients, setClients]         = useState<DocClient[]>([])
  const [company, setCompany]         = useState<DocCompany | null>(null)
  const [loadingData, setLoadingData] = useState(true)
  const [saving, setSaving]           = useState(false)
  const [sending, setSending]         = useState(false)

  const doc = useDocumentForm("quote", () => ({
    client_id: "", issue_date: "", due_date: "", valid_until: "", delivery_date: "",
    reference: "", notes: "", lines: [newLine()],
  }))
  const { form, computed, load } = doc

  useEffect(() => {
    fetch("/api/company")
      .then(r => r.json())
      .then(json => setCompany(json?.company ?? null))
      .catch(() => {})
    Promise.all([
      fetch(`/api/quotes/${id}`).then(r => r.json()),
      fetch("/api/clients").then(r => r.json()),
    ]).then(([qJson, cliJson]) => {
      if (qJson.quote) {
        const q = qJson.quote
        // Contenu modifiable seulement en brouillon (la route PATCH le refuse aussi)
        if (q.status !== "draft") {
          toast.error("Seuls les devis brouillons peuvent être modifiés")
          router.replace(`/quotes/${id}`)
          return
        }
        setQuoteNumber(q.quote_number)
        load({
          client_id:     q.client_id   || "",
          issue_date:    q.issue_date  || "",
          due_date:      "",
          valid_until:   q.valid_until || "",
          delivery_date: "",
          reference:     "",
          notes:         q.notes       || "",
          lines:         (q.lines || []).map(lineFromSaved),
        })
        setClients(withDocClient(cliJson.clients ?? [], q.client))
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
        client_id:   form.client_id,
        issue_date:  form.issue_date,
        valid_until: form.valid_until,
        notes:       form.notes || null,
        lines:       toPayloadLines(form.lines, computed),
      }

      // 1. Enregistrer le brouillon
      const res  = await fetch(`/api/quotes/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      const json = await res.json()
      if (!res.ok) { toast.error(json.error || "Erreur lors de la sauvegarde"); return }

      // 2. « Envoyer » envoie vraiment l'email, comme à la création — avant,
      //    le statut passait à « envoyé » sans qu'aucun email ne parte.
      if (action === "send") {
        const sendRes  = await fetch(`/api/quotes/${id}/send`, { method: "POST" })
        const sendJson = await sendRes.json()
        if (!sendRes.ok) {
          toast.error(sendJson.error ?? "Brouillon enregistré, mais l'envoi par email a échoué")
          router.push(`/quotes/${id}`)
          router.refresh()
          return
        }
        toast.success(`Devis envoyé à ${sendJson.sentTo}`)
      } else {
        toast.success("Brouillon sauvegardé !")
      }
      router.push(`/quotes/${id}`)
      router.refresh()
    } catch {
      toast.error("Erreur réseau")
    } finally {
      setSaving(false); setSending(false)
    }
  }

  if (loadingData) return (
    <div className="flex items-center justify-center py-24">
      <Loader2 className="size-8 animate-spin text-[var(--q-accent)]" aria-label="Chargement du devis" />
    </div>
  )

  return (
    <>
      <SetCrumb label={quoteNumber || null} />
      <DocumentEditor
        kind="quote"
        doc={doc}
        title={quoteNumber ? `Modifier ${quoteNumber}` : "Modifier le devis"}
        status={`${quoteNumber ? `${quoteNumber} · ` : ""}brouillon · ${doc.dirty ? "modifications non enregistrées" : "enregistré"}`}
        number={quoteNumber || null}
        backHref={`/quotes/${id}`}
        backLabel={quoteNumber || "Devis"}
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
          cancelHref: `/quotes/${id}`,
        }}
      />
    </>
  )
}
