'use client'

export const dynamic = "force-dynamic"

import { useState, useEffect, useCallback } from "react"
import Link from "next/link"
import { toast } from "sonner"
import { Download } from "lucide-react"
import { InvoiceStatus } from "@/types"
import { InvoiceList } from "@/components/invoices/InvoiceList"
import { type InvoiceListItem, subjectFromLines, todayISO } from "@/components/invoices/invoice-view"

/** Facture telle que la renvoie GET /api/invoices. */
interface ApiInvoice {
  id: string; invoice_number: string | null; status: InvoiceStatus
  is_archived: boolean; issue_date: string; due_date: string
  total_ttc: number; client: { name: string } | null
  lines: { description?: string | null }[] | null
}

const toItem = (inv: ApiInvoice): InvoiceListItem => ({
  id: inv.id,
  invoice_number: inv.invoice_number,
  status: inv.status,
  is_archived: inv.is_archived,
  issue_date: inv.issue_date,
  due_date: inv.due_date,
  total_ttc: Number(inv.total_ttc) || 0,
  client_name: inv.client?.name ?? null,
  subject: subjectFromLines(inv.lines),
})

async function fetchList(url: string): Promise<InvoiceListItem[]> {
  const res = await fetch(url)
  const json = await res.json().catch(() => ({}))
  if (!res.ok || !Array.isArray(json.invoices)) throw new Error(json.error ?? "Erreur réseau")
  return (json.invoices as ApiInvoice[]).map(toItem)
}

export default function InvoicesPage() {
  const [invoices, setInvoices]   = useState<InvoiceListItem[]>([])
  const [archived, setArchived]   = useState<InvoiceListItem[] | null>(null)
  const [creditCount, setCreditCount] = useState<number | null>(null)
  const [loading, setLoading]     = useState(true)
  const [error, setError]         = useState<string | null>(null)
  // Date du jour lue côté navigateur (heure française), pas au rendu serveur
  const [today, setToday]         = useState<string | null>(null)

  // Toutes les factures non archivées d'un coup : filtres, compteurs et recherche
  // se font dans la liste. Les archivées viennent à part (?archived=true).
  const fetchInvoices = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [active, arch] = await Promise.all([
        fetchList("/api/invoices"),
        fetchList("/api/invoices?archived=true").catch(() => null),
      ])
      setInvoices(active)
      setArchived(arch)
    } catch {
      setError("Vérifiez votre connexion, puis réessayez.")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    setToday(todayISO())
    fetchInvoices()
    // Nombre d'avoirs pour l'onglet « Avoirs » (facultatif : rien n'est affiché en cas d'erreur)
    fetch("/api/credit-notes")
      .then((r) => (r.ok ? r.json() : null))
      .then((json) => { if (Array.isArray(json?.credit_notes)) setCreditCount(json.credit_notes.length) })
      .catch(() => {})
  }, [fetchInvoices])

  // Actions groupées : PDF en ZIP (POST /api/invoices/bulk-pdf), archivage facture par facture (PATCH)
  const bulk = {
    downloadPdfs: async (ids: string[]) => {
      try {
        const res = await fetch("/api/invoices/bulk-pdf", {
          method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ids }),
        })
        if (!res.ok) {
          const json = await res.json().catch(() => ({}))
          toast.error(json.error ?? "Les PDF n'ont pas pu être générés.")
          return
        }
        const blob = await res.blob()
        const url = URL.createObjectURL(blob)
        const a = document.createElement("a")
        a.href = url
        a.download = /filename="([^"]+)"/.exec(res.headers.get("Content-Disposition") ?? "")?.[1] ?? "factures.zip"
        document.body.appendChild(a)
        a.click()
        a.remove()
        setTimeout(() => URL.revokeObjectURL(url), 1000)
      } catch { toast.error("Erreur réseau") }
    },
    setArchived: async (ids: string[], value: boolean) => {
      let failed = 0
      for (const id of ids) {
        const res = await fetch(`/api/invoices/${id}`, {
          method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ is_archived: value }),
        }).catch(() => null)
        if (!res?.ok) failed++
      }
      if (failed) toast.error(`${failed} facture${failed > 1 ? "s n'ont" : " n'a"} pas pu être ${value ? "archivée" : "désarchivée"}${failed > 1 ? "s" : ""}.`)
      else toast.success(`${ids.length} facture${ids.length > 1 ? "s" : ""} ${value ? "archivée" : "désarchivée"}${ids.length > 1 ? "s" : ""}`)
      await fetchInvoices()
      return failed === 0
    },
  }

  return (
    <InvoiceList
      invoices={invoices}
      archived={archived}
      loading={loading || !today}
      error={error}
      onRetry={fetchInvoices}
      today={today ?? "1970-01-01"}
      hrefFor={(id) => `/invoices/${id}`}
      newHref="/invoices/new"
      quoteNewHref="/quotes/new"
      creditNotesHref="/credit-notes"
      creditNotesCount={creditCount}
      bulk={bulk}
      extraActions={
        <Link href="/settings/exports" className="q-btn q-btn-secondary">
          <Download aria-hidden />
          Export comptable
        </Link>
      }
    />
  )
}
