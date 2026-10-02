import { DEMO_COMPANY, DEMO_PRODUCTS, demoInvoice, demoQuote } from "@/lib/demo/data"

/**
 * Documents d'exemple cités par l'accueil (notifications flottantes, petites
 * maquettes) : les mêmes que la démo (lib/demo/data.ts), pour que les numéros,
 * clients et montants concordent avec les captures et la démo interactive.
 */
export const EXAMPLES = {
  /** Groupe Arvel Construction : facture en retard, relancée. */
  relance: demoInvoice("F-2026-0139")!,
  /** Habitat Loire Construction : facture envoyée. */
  envoyee: demoInvoice("F-2026-0143")!,
  /** Claire Fontaine : facture marquée payée. */
  payee: demoInvoice("F-2026-0138")!,
  /** Bâti Ouest SAS : devis accepté. */
  accepte: demoQuote("D-2026-033")!,
  /** M. et Mme Lambert : devis envoyé. */
  devis: demoQuote("D-2026-035")!,
}

export const EXAMPLE_COMPANY = DEMO_COMPANY

/** Trois prestations du catalogue d'exemple (étape « Vos prestations »). */
export const EXAMPLE_PRODUCTS = ["cloison", "doublage", "combles"].map((id) => DEMO_PRODUCTS.find((p) => p.id === id)!)
