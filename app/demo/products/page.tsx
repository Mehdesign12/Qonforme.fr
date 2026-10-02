"use client"

import { useMemo, useState } from "react"
import { toast } from "sonner"
import { CatalogueView, type CatalogueProduct } from "@/components/products/CatalogueView"
import { DEMO_PRODUCTS } from "@/lib/demo/data"

/** Démo : invitation à créer un compte à la place des actions qui enregistrent. */
const demoCta = (message: string) =>
  toast(message, { action: { label: "Créer mon compte", onClick: () => { window.location.href = "/signup" } } })

const normalize = (s: string | null | undefined) =>
  (s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase()

const PRODUCTS: CatalogueProduct[] = DEMO_PRODUCTS.map((p) => ({
  id: p.id,
  name: p.name,
  description: p.description,
  unit_price_ht: p.unit_price_ht,
  vat_rate: p.vat_rate,
  unit: p.unit,
  reference: p.reference,
  is_active: p.is_active,
}))

const TOTALS = {
  active: PRODUCTS.filter((p) => p.is_active).length,
  inactive: PRODUCTS.filter((p) => !p.is_active).length,
}

/** Miroir de /products alimenté par lib/demo/data.ts (même recherche : désignation, description, référence). */
export default function DemoProductsPage() {
  const [query, setQuery] = useState("")
  const products = useMemo(() => {
    const q = normalize(query.trim())
    if (!q) return PRODUCTS
    return PRODUCTS.filter((p) => normalize(`${p.name} ${p.description ?? ""} ${p.reference ?? ""}`).includes(q))
  }, [query])

  return (
    <CatalogueView
      products={products}
      totals={TOTALS}
      query={query}
      onQueryChange={setQuery}
      onSave={() => { demoCta("Créez un compte pour enregistrer vos prestations"); return true }}
      onToggleActive={() => { demoCta("Créez un compte pour gérer votre catalogue"); return false }}
      quoteHref="/demo/quotes/new"
    />
  )
}
