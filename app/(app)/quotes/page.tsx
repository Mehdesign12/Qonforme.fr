'use client'

export const dynamic = "force-dynamic"

import { useCallback, useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { QuoteListView, type QuoteListItem } from "@/components/quotes/QuoteListView"
import { quoteSubject, todayISO, type QuoteStatus, type QuoteViews } from "@/components/quotes/QuoteListHelpers"

interface ApiQuote {
  id: string
  quote_number: string
  status: QuoteStatus
  issue_date: string
  valid_until: string
  total_ttc: number
  lines: { description?: string | null }[] | null
  converted_invoice_id: string | null
  client: { name: string } | null
}

export default function QuotesPage() {
  const [today] = useState(todayISO)
  const [items, setItems] = useState<QuoteListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [poCount, setPoCount] = useState<number | null>(null)

  // Tous les devis d'un coup : les onglets (avec leurs compteurs) et la recherche filtrent côté navigateur.
  const fetchQuotes = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch("/api/quotes")
      const json = await res.json()
      if (!res.ok || !json.quotes) throw new Error(json.error ?? "Erreur de chargement")
      const quotes = json.quotes as ApiQuote[]

      // Numéros des factures issues d'une conversion (colonne « Suite » : « Facturé F-… »)
      const invoiceIds = quotes.map((q) => q.converted_invoice_id).filter((x): x is string => !!x)
      const numbers = new Map<string, string>()
      if (invoiceIds.length) {
        const { data } = await createClient().from("invoices").select("id, invoice_number").in("id", invoiceIds)
        for (const inv of data ?? []) numbers.set(inv.id, inv.invoice_number)
      }

      // Suivi d'ouverture : consultations du dernier lien en ligne de chaque devis envoyé
      // (table document_signatures ; absente avant sa migration : pas de suivi affiché)
      const sentIds = quotes.filter((q) => q.status === "sent").map((q) => q.id)
      const views = new Map<string, QuoteViews>()
      if (sentIds.length) {
        const { data: links, error: linksErr } = await createClient()
          .from("document_signatures")
          .select("document_id, view_count, last_viewed_at, sent_at, created_at")
          .eq("document_type", "quote").in("document_id", sentIds)
          .order("created_at", { ascending: false })
        if (!linksErr) {
          for (const l of links ?? []) {
            if (views.has(l.document_id) || !l.sent_at) continue
            views.set(l.document_id, { count: Number(l.view_count) || 0, last: l.last_viewed_at ?? null })
          }
        }
      }

      setItems(quotes.map((q) => ({
        id: q.id,
        quote_number: q.quote_number,
        status: q.status,
        issue_date: q.issue_date,
        valid_until: q.valid_until,
        total_ttc: Number(q.total_ttc) || 0,
        client_name: q.client?.name ?? null,
        subject: quoteSubject(q),
        search_text: (q.lines ?? []).map((l) => l.description ?? "").join(" "),
        converted: !!q.converted_invoice_id,
        converted_invoice_number: q.converted_invoice_id ? numbers.get(q.converted_invoice_id) ?? null : null,
        views: views.get(q.id) ?? null,
        href: `/quotes/${q.id}`,
      })))
    } catch {
      setError("Vérifiez votre connexion, puis réessayez.")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchQuotes() }, [fetchQuotes])

  // Compteur de l'onglet « Bons de commande » (facultatif : la liste s'affiche sans lui)
  useEffect(() => {
    fetch("/api/purchase-orders")
      .then((r) => (r.ok ? r.json() : null))
      .then((json) => { if (Array.isArray(json?.purchase_orders)) setPoCount(json.purchase_orders.length) })
      .catch(() => {})
  }, [])

  return (
    <QuoteListView
      items={items}
      loading={loading}
      error={error}
      onRetry={fetchQuotes}
      today={today}
      newHref="/quotes/new"
      catalogueHref="/products"
      purchaseOrdersHref="/purchase-orders"
      purchaseOrdersCount={poCount}
    />
  )
}
