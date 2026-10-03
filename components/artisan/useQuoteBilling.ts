"use client"

/**
 * Facturation d'un devis (formule Artisan), côté page réelle : lecture de
 * l'état (GET /api/artisan/quotes/[id]/billing), création d'un brouillon
 * d'acompte, de situation ou de solde, rattachement d'un acompte libre.
 *
 * - `available: false` (migration pas encore appliquée) : le panneau se masque ;
 * - 402 ARTISAN_REQUIRED : ouverture du mur de paiement (formule Artisan).
 */
import { useCallback, useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { isArtisanPaywall } from "@/components/billing/PaywallDialog"
import type { QuoteBilling } from "@/lib/artisan/build"
import type { FreeDeposit } from "./QuoteBillingPanel"

interface BillingResponse {
  available: boolean
  artisan?: boolean | null
  billing?: QuoteBilling
  freeDeposits?: FreeDeposit[]
}

export function useQuoteBilling(quoteId: string, enabled: boolean) {
  const router = useRouter()
  const [data, setData] = useState<BillingResponse | null>(null)
  const [creating, setCreating] = useState(false)
  const [paywall, setPaywall] = useState(false)

  const reload = useCallback(async () => {
    try {
      const res = await fetch(`/api/artisan/quotes/${quoteId}/billing`)
      const json = await res.json().catch(() => null)
      if (res.ok && json) setData(json)
      else setData({ available: false })
    } catch {
      setData({ available: false })
    }
  }, [quoteId])

  useEffect(() => { if (enabled) void reload() }, [enabled, reload])

  const create = useCallback(async (body: Record<string, unknown>) => {
    setCreating(true)
    try {
      const res = await fetch(`/api/artisan/quotes/${quoteId}/billing`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
      const json = await res.json().catch(() => ({}))
      if (isArtisanPaywall(res.status, json)) { setPaywall(true); return }
      if (!res.ok || !json.invoice) { toast.error(json.error ?? "Le brouillon n'a pas pu être créé."); void reload(); return }
      toast.success("Brouillon créé : relisez-le, puis envoyez-le pour l'émettre")
      router.push(`/invoices/${json.invoice.id}`)
    } catch {
      toast.error("Erreur réseau")
    } finally {
      setCreating(false)
    }
  }, [quoteId, reload, router])

  const attachDeposit = useCallback(async (invoiceId: string) => {
    try {
      const res = await fetch(`/api/artisan/quotes/${quoteId}/attach-deposit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ invoice_id: invoiceId }),
      })
      const json = await res.json().catch(() => ({}))
      if (isArtisanPaywall(res.status, json)) { setPaywall(true); return }
      if (!res.ok) { toast.error(json.error ?? "Le rattachement a échoué."); return }
      toast.success("Acompte rattaché au devis")
      void reload()
    } catch {
      toast.error("Erreur réseau")
    }
  }, [quoteId, reload])

  return { data, reload, create, creating, attachDeposit, paywall, setPaywall }
}
