'use client'

export const dynamic = "force-dynamic"

import { useCallback, useEffect, useState } from "react"
import { PurchaseOrderListView, poSubject, type POStatus, type PurchaseOrderListItem } from "@/components/purchase-orders/PurchaseOrderListView"
import { todayISO } from "@/components/quotes/QuoteListHelpers"

interface ApiPurchaseOrder {
  id: string
  po_number: string
  status: POStatus
  issue_date: string
  delivery_date: string | null
  reference: string | null
  total_ttc: number
  lines: { description?: string | null }[] | null
  sent_at: string | null
  confirmed_at: string | null
  client: { name: string } | null
}

export default function PurchaseOrdersPage() {
  const [today] = useState(todayISO)
  const [items, setItems] = useState<PurchaseOrderListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [quotesCount, setQuotesCount] = useState<number | null>(null)

  // Tous les bons d'un coup : les onglets (avec leurs compteurs) et la recherche filtrent côté navigateur.
  const fetchPOs = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch("/api/purchase-orders")
      const json = await res.json()
      if (!res.ok || !Array.isArray(json.purchase_orders)) throw new Error(json.error ?? "Erreur de chargement")
      setItems((json.purchase_orders as ApiPurchaseOrder[]).map((p) => ({
        id: p.id,
        po_number: p.po_number,
        status: p.status,
        issue_date: p.issue_date,
        delivery_date: p.delivery_date,
        reference: p.reference,
        total_ttc: Number(p.total_ttc) || 0,
        client_name: p.client?.name ?? null,
        subject: poSubject(p.lines),
        search_text: (p.lines ?? []).map((l) => l.description ?? "").join(" "),
        sent_at: p.sent_at,
        confirmed_at: p.confirmed_at,
        href: `/purchase-orders/${p.id}`,
      })))
    } catch {
      setError("Vérifiez votre connexion, puis réessayez.")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchPOs() }, [fetchPOs])

  // Compteur de l'onglet « Devis » (facultatif : la liste s'affiche sans lui)
  useEffect(() => {
    fetch("/api/quotes")
      .then((r) => (r.ok ? r.json() : null))
      .then((json) => { if (Array.isArray(json?.quotes)) setQuotesCount(json.quotes.length) })
      .catch(() => {})
  }, [])

  return (
    <PurchaseOrderListView
      items={items}
      loading={loading}
      error={error}
      onRetry={fetchPOs}
      today={today}
      newHref="/purchase-orders/new"
      quotesHref="/quotes"
      quotesCount={quotesCount}
    />
  )
}
