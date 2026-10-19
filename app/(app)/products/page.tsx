'use client'

export const dynamic = "force-dynamic"

import { useCallback, useEffect, useRef, useState } from "react"
import { toast } from "sonner"
import { CatalogueView, type CatalogueProduct, type ProductInput } from "@/components/products/CatalogueView"
import type { TradeImportRequest } from "@/components/products/TradeImportDialog"
import { parseLegalProfile, type TradeId, type VatRegime } from "@/lib/legal/profile"

/**
 * Catalogue réel : la recherche passe par GET /api/products (filtre PostgREST
 * échappé côté serveur), toujours avec les inactifs pour remplir l'onglet
 * « Inactives » et son compteur. Miroir : app/demo/products/page.tsx.
 */
export default function ProductsPage() {
  const [products, setProducts] = useState<CatalogueProduct[] | null>(null)
  const [totals, setTotals] = useState<{ active: number; inactive: number } | null>(null)
  const [search, setSearch] = useState("")
  const [error, setError] = useState<string | null>(null)
  // Seule la dernière requête met à jour la liste (frappe rapide dans la recherche).
  const requestId = useRef(0)
  // Métier et régime de TVA du profil (Paramètres › Entreprise), pour l'import :
  // absents tant que la migration du profil n'est pas appliquée (choix dans la fenêtre)
  const [profile, setProfile] = useState<{ trade: TradeId | null; vatRegime: VatRegime | null }>({ trade: null, vatRegime: null })

  useEffect(() => {
    fetch("/api/company")
      .then((r) => (r.ok ? r.json() : null))
      .then((json) => {
        const p = parseLegalProfile(json?.company?.legal_profile)
        if (p) setProfile({ trade: p.trade, vatRegime: p.vat_regime })
      })
      .catch(() => {})
  }, [])

  const fetchProducts = useCallback(async () => {
    const id = ++requestId.current
    try {
      const params = new URLSearchParams({ search, include_inactive: "true" })
      const res = await fetch(`/api/products?${params}`)
      const json = await res.json().catch(() => ({}))
      if (id !== requestId.current) return
      if (!res.ok || !Array.isArray(json.products)) {
        setError(json.error || "Vérifiez votre connexion puis réessayez.")
        return
      }
      const list = json.products as CatalogueProduct[]
      setError(null)
      setProducts(list)
      if (!search.trim()) {
        const active = list.filter((p) => p.is_active).length
        setTotals({ active, inactive: list.length - active })
      }
    } catch {
      if (id === requestId.current) setError("Vérifiez votre connexion puis réessayez.")
    }
  }, [search])

  useEffect(() => {
    const timer = setTimeout(fetchProducts, 250)
    return () => clearTimeout(timer)
  }, [fetchProducts])

  const handleSave = async (input: ProductInput, product: CatalogueProduct | null) => {
    try {
      const res = await fetch(product ? `/api/products/${product.id}` : "/api/products", {
        method: product ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        toast.error(json.error || "Erreur lors de l'enregistrement")
        return false
      }
      toast.success(product ? "Prestation enregistrée" : "Prestation ajoutée au catalogue")
      void fetchProducts()
      return true
    } catch {
      toast.error("Erreur réseau")
      return false
    }
  }

  const handleToggleActive = async (product: CatalogueProduct) => {
    try {
      const res = await fetch(`/api/products/${product.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_active: !product.is_active }),
      })
      if (!res.ok) {
        toast.error("Erreur lors de la mise à jour")
        return false
      }
      toast.success(product.is_active ? "Prestation désactivée" : "Prestation réactivée")
      void fetchProducts()
      return true
    } catch {
      toast.error("Erreur réseau")
      return false
    }
  }

  const handleImport = async (request: TradeImportRequest) => {
    try {
      const res = await fetch("/api/products/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(request),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        toast.error(json.error || "Les prestations n'ont pas pu être importées")
        return false
      }
      const created = Number(json.created) || 0
      const skipped = Number(json.skipped) || 0
      toast.success(
        created > 0
          ? `${created} prestation${created > 1 ? "s" : ""} ajoutée${created > 1 ? "s" : ""} au catalogue${skipped ? ` (${skipped} déjà présente${skipped > 1 ? "s" : ""})` : ""}`
          : "Ces prestations sont déjà dans votre catalogue",
      )
      void fetchProducts()
      return true
    } catch {
      toast.error("Erreur réseau")
      return false
    }
  }

  return (
    <CatalogueView
      products={products}
      totals={totals}
      query={search}
      onQueryChange={setSearch}
      onSave={handleSave}
      onToggleActive={handleToggleActive}
      quoteHref="/quotes/new"
      error={error}
      onRetry={() => void fetchProducts()}
      importer={{ trade: profile.trade, vatRegime: profile.vatRegime, onImport: handleImport }}
    />
  )
}
