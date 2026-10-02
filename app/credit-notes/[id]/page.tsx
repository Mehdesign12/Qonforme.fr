'use client'

export const dynamic = "force-dynamic"

import { useEffect, useState } from "react"
import Link from "next/link"
import { toast } from "sonner"
import { Loader2 } from "lucide-react"
import { EmptyState } from "@/components/app/kit"
import { createClient } from "@/lib/supabase/client"
import { CreditNoteDetailView, type CreditNoteDetailData } from "@/components/credit-notes/CreditNoteDetailView"
import type { PaperParty } from "@/components/purchase-orders/detail-bits"

interface ApiCreditNote {
  id: string
  credit_note_number: string
  issue_date: string
  sent_at?: string | null
  reason: string
  lines: CreditNoteDetailData["lines"] | null
  subtotal_ht: number
  total_vat: number
  total_ttc: number
  client: {
    id: string
    name: string
    email: string | null
    address: string | null
    zip_code: string | null
    city: string | null
    siren: string | null
    vat_number: string | null
  } | null
  original_invoice: {
    id: string
    invoice_number: string
    issue_date: string
    total_ttc: number
  } | null
}

function toDetail(c: ApiCreditNote): CreditNoteDetailData {
  return {
    id: c.id,
    credit_note_number: c.credit_note_number,
    issue_date: c.issue_date,
    sent_at: c.sent_at ?? null,
    reason: c.reason,
    lines: (c.lines ?? []).map((l) => ({ ...l, quantity: Number(l.quantity), unit_price_ht: Number(l.unit_price_ht), vat_rate: Number(l.vat_rate), total_ht: Number(l.total_ht) })),
    subtotal_ht: Number(c.subtotal_ht) || 0,
    total_vat: Number(c.total_vat) || 0,
    total_ttc: Number(c.total_ttc) || 0,
    client: c.client ? { ...c.client, href: `/clients/${c.client.id}`, editHref: `/clients/${c.client.id}/edit` } : null,
    original_invoice: c.original_invoice
      ? {
          invoice_number: c.original_invoice.invoice_number,
          href: `/invoices/${c.original_invoice.id}`,
          issue_date: c.original_invoice.issue_date,
          total_ttc: Number(c.original_invoice.total_ttc),
        }
      : null,
  }
}

export default function CreditNoteDetailPage({ params }: { params: { id: string } }) {
  const [note, setNote] = useState<CreditNoteDetailData | null>(null)
  const [company, setCompany] = useState<PaperParty | null>(null)
  const [loading, setLoading] = useState(true)
  const [pdfLoading, setPdfLoading] = useState(false)
  const [sendLoading, setSendLoading] = useState(false)

  useEffect(() => {
    const supabase = createClient()
    Promise.all([
      fetch(`/api/credit-notes/${params.id}`).then(r => r.json()),
      supabase.from("companies").select("name,address,zip_code,city,siret,siren,vat_number").single(),
    ]).then(([json, { data: comp }]) => {
      if (json.credit_note) setNote(toDetail(json.credit_note))
      if (comp) setCompany(comp)
    }).finally(() => setLoading(false))
  }, [params.id])

  const downloadPDF = async () => {
    if (!note) return
    setPdfLoading(true)
    try {
      const res = await fetch(`/api/credit-notes/${params.id}/pdf`)
      if (!res.ok) { toast.error("Erreur lors de la génération du PDF"); return }
      const blob = await res.blob()
      const url  = URL.createObjectURL(blob)
      const a    = document.createElement("a")
      a.href = url; a.download = `${note.credit_note_number}.pdf`
      document.body.appendChild(a); a.click()
      document.body.removeChild(a); URL.revokeObjectURL(url)
      toast.success("PDF téléchargé")
    } catch { toast.error("Erreur lors du téléchargement") }
    finally { setPdfLoading(false) }
  }

  const sendByEmail = async (): Promise<boolean> => {
    if (!note) return false
    setSendLoading(true)
    try {
      const res  = await fetch(`/api/credit-notes/${params.id}/send`, { method: "POST" })
      const json = await res.json()
      if (!res.ok) { toast.error(json.error ?? "Erreur lors de l'envoi"); return false }
      toast.success(`Avoir envoyé à ${json.sentTo}`)
      setNote(prev => prev ? { ...prev, sent_at: new Date().toISOString() } : prev)
      return true
    } catch { toast.error("Erreur réseau"); return false }
    finally { setSendLoading(false) }
  }

  if (loading) return (
    <div className="grid min-h-[320px] place-items-center">
      <Loader2 className="size-7 animate-spin text-[var(--q-accent)]" aria-label="Chargement de l'avoir" />
    </div>
  )

  if (!note) return (
    <div className="q-card">
      <EmptyState
        title="Avoir introuvable"
        text="Il a peut-être été retiré, ou le lien est incomplet."
        action={<Link href="/credit-notes" className="q-btn q-btn-secondary">Retour aux avoirs</Link>}
      />
    </div>
  )

  return (
    <CreditNoteDetailView
      note={note}
      company={company}
      listHref="/credit-notes"
      companySettingsHref="/settings/company"
      actions={{ onDownloadPdf: downloadPDF, onSend: sendByEmail, busy: { pdf: pdfLoading, send: sendLoading } }}
    />
  )
}
