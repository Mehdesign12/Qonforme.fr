'use client'

export const dynamic = "force-dynamic"

import { useCallback, useEffect, useRef, useState } from "react"
import { toast } from "sonner"
import { CatalogueView, type CatalogueProduct, type ProductInput } from "@/components/products/CatalogueView"

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
    />
  )
}
