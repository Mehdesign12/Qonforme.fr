import type { ExempleDevis } from "@/lib/pseo/guides"
import { calculerTotaux, type Totaux } from "@/lib/outils/document"
import { divArrondi } from "@/lib/outils/decimal"

export interface TotauxExemple extends Totaux {
  /** Acompte (demandé ou déjà versé), en centimes TTC. */
  acompteCentimes?: number
  /** Facture : reste à payer après l'acompte déjà versé, en centimes TTC. */
  resteCentimes?: number
}

/** Totaux d'un devis d'exemple : même calcul en centimes que les générateurs gratuits. */
export function totauxExemple(e: ExempleDevis): TotauxExemple {
  const totaux = calculerTotaux(
    e.lignes.map((l) => ({ description: l.designation, quantite: l.quantite, prixHT: l.prixUnitaireHT, tauxTVA: l.tauxTva ?? e.tauxTva })),
  )
  const acompteCentimes = e.acomptePourcent ? divArrondi(totaux.ttcCentimes * e.acomptePourcent, 100) : undefined
  const resteCentimes = e.document === "facture" && acompteCentimes !== undefined ? totaux.ttcCentimes - acompteCentimes : undefined
  return { ...totaux, acompteCentimes, resteCentimes }
}
