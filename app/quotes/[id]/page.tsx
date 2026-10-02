'use client'

export const dynamic = "force-dynamic"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { toast } from "sonner"
import { FileX2, Loader2 } from "lucide-react"
import { EmptyState } from "@/components/app/kit"
import { createClient } from "@/lib/supabase/client"
import {
  QuoteDetailView, type QuoteDetailBusy, type QuoteDetailCompany, type QuoteDetailData,
} from "@/components/quotes/QuoteDetailView"
import { addDays, daysBetween, todayISO, type QuoteStatus } from "@/components/quotes/QuoteListHelpers"

/* ------------------------------------------------------------------ */
/* Types                                                                */
/* ------------------------------------------------------------------ */

interface QuoteLine {
  description: string
  quantity: number
  unit_price_ht: number
  vat_rate: number
  total_ht: number
  total_vat?: number
  total_ttc: number
}

interface Quote {
  id: string
  quote_number: string
  status: QuoteStatus
  issue_date: string
  valid_until: string
  lines: QuoteLine[]
  subtotal_ht: number
  total_vat: number
  total_ttc: number
  notes: string | null
  client_id: string | null
  converted_invoice_id: string | null
  created_at: string
  sent_at?: string | null
  client: {
    id: string
    name: string
    email: string | null
    address: string | null
    zip_code: string | null
    city: string | null
    siren: string | null
  } | null
}

const STATUS_LABELS: Record<QuoteStatus, string> = {
  draft:    "Brouillon",
  sent:     "Envoyé",
  accepted: "Accepté",
  rejected: "Refusé",
}

/* ------------------------------------------------------------------ */
/* Composant                                                            */
/* ------------------------------------------------------------------ */

export default function QuoteDetailPage({ params }: { params: { id: string } }) {
  const router = useRouter()
  const [today] = useState(todayISO)
  const [quote, setQuote]     = useState<Quote | null>(null)
  const [company, setCompany] = useState<QuoteDetailCompany | null>(null)
  const [invoice, setInvoice] = useState<{ invoice_number: string; status: string } | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy]       = useState<QuoteDetailBusy>({})

  const setFlag = (k: keyof QuoteDetailBusy, v: boolean) => setBusy((b) => ({ ...b, [k]: v }))

  useEffect(() => {
    const supabase = createClient()
    Promise.all([
      fetch(`/api/quotes/${params.id}`).then(r => r.json()),
      supabase.from("companies").select("name,address,zip_code,city,siret,siren,vat_number").single(),
    ]).then(([json, { data: comp }]) => {
      if (json.quote) setQuote(json.quote)
      if (comp) setCompany(comp)
    }).finally(() => setLoading(false))
  }, [params.id])

  // Facture issue de la conversion : numéro et statut pour « Liés à ce devis »
  const convertedId = quote?.converted_invoice_id ?? null
  useEffect(() => {
    if (!convertedId) { setInvoice(null); return }
    createClient()
      .from("invoices")
      .select("invoice_number,status")
      .eq("id", convertedId)
      .maybeSingle()
      .then(({ data }) => { if (data) setInvoice(data) })
  }, [convertedId])

  /* ── Actions ── */

  // Les changements de statut sont vérifiés par la route (lib/utils/document-status.ts)
  const changeStatus = async (newStatus: "accepted" | "rejected"): Promise<boolean> => {
    if (!quote) return false
    setFlag("status", true)
    try {
      const res  = await fetch(`/api/quotes/${params.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      })
      const json = await res.json()
      if (!res.ok) { toast.error(json.error); return false }
      // La route renvoie un client réduit : on garde la fiche client complète déjà chargée
      setQuote((prev) => prev ? { ...prev, ...json.quote, client: prev.client } : json.quote)
      toast.success(`Statut mis à jour : ${STATUS_LABELS[newStatus]}`)
      return true
    } catch { toast.error("Erreur réseau"); return false }
    finally { setFlag("status", false) }
  }

  const downloadPDF = async () => {
    if (!quote) return
    setFlag("pdf", true)
    try {
      const res = await fetch(`/api/quotes/${params.id}/pdf`)
      if (!res.ok) { toast.error("Erreur lors de la génération du PDF"); return }
      const blob = await res.blob()
      const url  = URL.createObjectURL(blob)
      const a    = document.createElement("a")
      a.href = url; a.download = `${quote.quote_number}.pdf`
      document.body.appendChild(a); a.click()
      document.body.removeChild(a); URL.revokeObjectURL(url)
      toast.success("PDF téléchargé")
    } catch { toast.error("Erreur lors du téléchargement") }
    finally { setFlag("pdf", false) }
  }

  const deleteQuote = async () => {
    if (!quote) return
    setFlag("delete", true)
    try {
      const res = await fetch(`/api/quotes/${params.id}`, { method: "DELETE" })
      if (res.ok) { toast.success("Brouillon supprimé"); router.push("/quotes") }
      else { const json = await res.json(); toast.error(json.error) }
    } catch { toast.error("Erreur réseau") }
    finally { setFlag("delete", false) }
  }

  // Envoi (brouillon) ou renvoi (devis déjà envoyé) : la route ne change pas un statut accepté ou refusé
  const sendByEmail = async (): Promise<boolean> => {
    if (!quote) return false
    setFlag("send", true)
    try {
      const res  = await fetch(`/api/quotes/${params.id}/send`, { method: "POST" })
      const json = await res.json()
      if (!res.ok) { toast.error(json.error ?? "Erreur lors de l'envoi"); return false }
      setQuote({
        ...quote,
        status: quote.status === "draft" ? "sent" : quote.status,
        sent_at: new Date().toISOString(),
      })
      toast.success(`Devis envoyé à ${json.sentTo}`)
      return true
    } catch { toast.error("Erreur réseau"); return false }
    finally { setFlag("send", false) }
  }

  // Conversion sans mur de paiement : la facture naît en brouillon, l'émission reste contrôlée à l'envoi
  const convertToInvoice = async () => {
    if (!quote) return
    setFlag("convert", true)
    try {
      const res  = await fetch(`/api/quotes/${params.id}/convert`, { method: "POST" })
      const json = await res.json()
      if (!res.ok) { toast.error(json.error); return }
      toast.success("Devis converti en facture")
      router.push(`/invoices/${json.invoice.id}`)
    } catch { toast.error("Erreur réseau") }
    finally { setFlag("convert", false) }
  }

  // Duplication : un nouveau brouillon (création toujours en brouillon côté serveur), même client,
  // mêmes lignes, daté du jour avec la même durée de validité.
  const duplicate = async () => {
    if (!quote) return
    setFlag("duplicate", true)
    try {
      const validity = Math.max(1, daysBetween(quote.issue_date, quote.valid_until) || 30)
      const res = await fetch("/api/quotes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          client_id:   quote.client_id ?? quote.client?.id ?? null,
          issue_date:  today,
          valid_until: addDays(today, validity),
          notes:       quote.notes,
          lines:       quote.lines,
        }),
      })
      const json = await res.json()
      if (!res.ok || !json.quote) { toast.error(json.error ?? "La copie n'a pas pu être créée"); return }
      toast.success(`Copie créée : ${json.quote.quote_number}`)
      router.push(`/quotes/${json.quote.id}/edit`)
    } catch { toast.error("Erreur réseau") }
    finally { setFlag("duplicate", false) }
  }

  /* ── Render ── */
  if (loading) return (
    <div className="grid min-h-[50vh] place-items-center">
      <Loader2 className="size-7 animate-spin text-[var(--q-accent)]" aria-label="Chargement du devis" />
    </div>
  )

  if (!quote) return (
    <div className="q-card">
      <EmptyState
        icon={<FileX2 className="size-6" strokeWidth={1.75} aria-hidden />}
        title="Devis introuvable"
        text="Il a peut-être été supprimé, ou le lien est incomplet."
        action={<Link href="/quotes" className="q-btn q-btn-secondary">Retour aux devis</Link>}
      />
    </div>
  )

  const data: QuoteDetailData = {
    id: quote.id,
    quote_number: quote.quote_number,
    status: quote.status,
    issue_date: quote.issue_date,
    valid_until: quote.valid_until,
    created_at: quote.created_at,
    sent_at: quote.sent_at ?? null,
    lines: (quote.lines ?? []).map((l) => ({
      description: l.description,
      quantity: Number(l.quantity) || 0,
      unit_price_ht: Number(l.unit_price_ht) || 0,
      vat_rate: Number(l.vat_rate) || 0,
      total_ht: Number(l.total_ht) || 0,
      total_vat: l.total_vat ?? null,
    })),
    subtotal_ht: Number(quote.subtotal_ht) || 0,
    total_vat: Number(quote.total_vat) || 0,
    total_ttc: Number(quote.total_ttc) || 0,
    notes: quote.notes,
    client: quote.client ? { ...quote.client, href: `/clients/${quote.client.id}` } : null,
    converted: !!quote.converted_invoice_id,
    converted_invoice: quote.converted_invoice_id
      ? { number: invoice?.invoice_number ?? null, status: invoice?.status ?? null, href: `/invoices/${quote.converted_invoice_id}` }
      : null,
  }

  return (
    <QuoteDetailView
      quote={data}
      company={company}
      today={today}
      busy={busy}
      links={{ list: "/quotes", newQuote: "/quotes/new", companySettings: "/settings/company" }}
      actions={{
        onDownloadPdf: downloadPDF,
        onPrint: () => window.print(),
        onDuplicate: duplicate,
        editHref: quote.status === "draft" ? `/quotes/${params.id}/edit` : undefined,
        onDelete: deleteQuote,
        onSend: sendByEmail,
        onSetStatus: changeStatus,
        onConvert: convertToInvoice,
      }}
    />
  )
}
