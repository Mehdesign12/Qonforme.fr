import type { ExempleDevis } from "@/lib/pseo/guides"
import { calculerTotaux, type Totaux } from "@/lib/outils/document"
import { divArrondi } from "@/lib/outils/decimal"

export interface TotauxExemple extends Totaux {
  /** Acompte à la signature, en centimes TTC, si l'exemple en demande un. */
  acompteCentimes?: number
}

/** Totaux d'un devis d'exemple : même calcul en centimes que les générateurs gratuits. */
export function totauxExemple(e: ExempleDevis): TotauxExemple {
  const totaux = calculerTotaux(
    e.lignes.map((l) => ({ description: l.designation, quantite: l.quantite, prixHT: l.prixUnitaireHT, tauxTVA: e.tauxTva })),
  )
  const acompteCentimes = e.acomptePourcent ? divArrondi(totaux.ttcCentimes * e.acomptePourcent, 100) : undefined
  return { ...totaux, acompteCentimes }
}
