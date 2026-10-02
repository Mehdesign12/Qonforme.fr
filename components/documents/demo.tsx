'use client'

/**
 * Données et actions des éditeurs en mode démo (/demo/*). Tout vient de
 * lib/demo/data.ts ; rien n'est enregistré ni envoyé.
 */
import Link from "next/link"
import { toast } from "sonner"
import { Info } from "lucide-react"
import { DEMO_CLIENTS, DEMO_COMPANY, DEMO_PRODUCTS } from "@/lib/demo/data"
import type { ProductSuggestion } from "@/components/products/ProductCombobox"
import { lineFromProduct, type DocClient, type DocCompany, type DocLine } from "./model"
import type { DocumentFormApi } from "./useDocumentForm"

export const DEMO_DOC_CLIENTS: DocClient[] = DEMO_CLIENTS.map((c) => ({
  id: c.id, name: c.name, siren: c.siren ?? null, email: c.email,
  address: c.address, zip_code: c.zip_code, city: c.city,
}))

export const DEMO_DOC_COMPANY: DocCompany = {
  name: DEMO_COMPANY.name,
  siren: DEMO_COMPANY.siren,
  vat_number: DEMO_COMPANY.vat_number,
  address: DEMO_COMPANY.address,
  zip_code: DEMO_COMPANY.zip_code,
  city: DEMO_COMPANY.city,
  iban: DEMO_COMPANY.iban,
}

/** Catalogue actif, au format du sélecteur de prestations. */
export const DEMO_DOC_PRODUCTS: ProductSuggestion[] = DEMO_PRODUCTS.filter((p) => p.is_active).map((p) => ({
  id: p.id, name: p.name, description: p.description, unit_price_ht: p.unit_price_ht,
  vat_rate: p.vat_rate, unit: p.unit, reference: p.reference,
}))

/** Lignes d'exemple : [identifiant produit, quantité]. */
export function demoLines(items: [string, number][]): DocLine[] {
  return items.map(([productId, qty]) => {
    const product = DEMO_DOC_PRODUCTS.find((p) => p.id === productId)
    if (!product) throw new Error(`Produit de démo inconnu : ${productId}`)
    // Libellé seul (sans la description) pour garder des lignes courtes
    return { ...lineFromProduct({ ...product, description: null }), quantity: String(qty) }
  })
}

/**
 * Action de démo : mêmes contrôles que le vrai formulaire si `validate`,
 * puis un message qui mène à l'inscription. Aucune requête.
 */
export function demoAction(doc: DocumentFormApi, validate: boolean, what: string) {
  if (validate && !doc.validate()) {
    toast.error("Corrigez les erreurs avant de continuer")
    return
  }
  toast.info("Disponible avec un compte", {
    description: `Créez votre compte pour ${what}. Rien n'est enregistré dans la démo.`,
    action: { label: "Créer mon compte", onClick: () => { window.location.href = "/signup" } },
  })
}

/** Rappel discret : la démo n'enregistre rien. */
export function DemoNotice() {
  return (
    <div className="q-banner items-center">
      <Info className="size-4 shrink-0" strokeWidth={2} aria-hidden />
      <span className="flex-1">
        <strong className="font-semibold">Démo</strong> : explorez le formulaire librement, rien n&apos;est enregistré ni envoyé.
        {/* Mobile : lien sous le texte, pour ne pas le serrer sur quatre lignes */}
        <Link href="/signup" className="q-link mt-0.5 block text-[13px] sm:hidden">Créer mon compte</Link>
      </span>
      <Link href="/signup" className="q-link hidden shrink-0 text-[13px] sm:inline">Créer mon compte</Link>
    </div>
  )
}
