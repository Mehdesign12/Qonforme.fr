/**
 * Autoliquidation de la TVA en sous-traitance du bâtiment.
 *
 * CGI, art. 283, 2 nonies : pour les travaux de construction, y compris de
 * réparation, de nettoyage, d'entretien, de transformation et de démolition,
 * effectués en relation avec un bien immobilier par une entreprise
 * sous-traitante (au sens de la loi n° 75-1334 du 31 décembre 1975) pour le
 * compte d'un preneur assujetti, la taxe est acquittée par le preneur.
 * BOFiP, BOI-TVA-DECLA-10-10-20, §§ 531 à 538 : la facture du sous-traitant
 * ne mentionne pas la TVA, fait apparaître que la taxe est due par le preneur
 * et porte la mention « Autoliquidation » (CGI, ann. II, art. 242 nonies A,
 * I-13°).
 * https://bofip.impots.gouv.fr/bofip/3218-PGP.html/identifiant=BOI-TVA-DECLA-10-10-20-20210421
 *
 * Facture électronique : catégorie AE, motif VATEX-EU-AE (lib/facturx/vat.ts),
 * n° de TVA ou SIREN du client obligatoire (BR-AE-02).
 */

import { VAT_EXEMPTIONS } from "@/lib/facturx/vat"

export const AUTOLIQUIDATION = "autoliquidation_btp" as const

/** Conditions rappelées à l'artisan quand il coche la case. */
export const REVERSE_CHARGE_CONDITIONS: readonly string[] = [
  "Vous intervenez comme sous-traitant d'une autre entreprise (loi n° 75-1334 du 31 décembre 1975).",
  "Votre client est assujetti à la TVA : son SIREN ou son n° de TVA figure sur la facture.",
  "Il s'agit de travaux immobiliers : construction, réparation, nettoyage, entretien, transformation ou démolition.",
]

/** Mention imprimée sur le document (et motif du XML). */
export const REVERSE_CHARGE_MENTION = VAT_EXEMPTIONS.autoliquidation_btp.mention

interface LineLike {
  vat_rate?: number | string | null
  total_ht?: number | string | null
  total_vat?: number | string | null
  total_ttc?: number | string | null
  vat_treatment?: string | null
}

/** Vrai si une ligne au moins est en autoliquidation. */
export function hasReverseCharge(lines: LineLike[] | null | undefined): boolean {
  return (lines ?? []).some((l) => l?.vat_treatment === AUTOLIQUIDATION)
}

/** Vrai si toutes les lignes (au moins une) sont en autoliquidation. */
export function isReverseChargeDocument(lines: LineLike[] | null | undefined): boolean {
  const list = lines ?? []
  return list.length > 0 && list.every((l) => l?.vat_treatment === AUTOLIQUIDATION)
}

/**
 * Lignes d'un document en autoliquidation : taux 0, aucune TVA, TTC = HT,
 * traitement « autoliquidation_btp » (lu par le XML et le PDF). Sans
 * autoliquidation, le traitement est retiré et les lignes restent telles quelles.
 */
export function applyReverseCharge<T extends LineLike>(lines: T[], enabled: boolean): T[] {
  return lines.map((l) => {
    if (!enabled) {
      if (l.vat_treatment !== AUTOLIQUIDATION) return l
      const rest = { ...l }
      delete rest.vat_treatment
      return rest
    }
    const ht = Math.round((Number(l.total_ht) || 0) * 100) / 100
    return { ...l, vat_rate: 0, total_vat: 0, total_ttc: ht, vat_treatment: AUTOLIQUIDATION }
  })
}

/** Le client peut-il être en autoliquidation ? (identifié : SIREN ou n° de TVA) */
export function reverseChargeClientIssue(client: { siren?: string | null; vat_number?: string | null } | null | undefined): string | null {
  if (!client) return "Choisissez le client donneur d'ordre."
  if ((client.siren ?? "").replace(/\s/g, "") || (client.vat_number ?? "").trim()) return null
  return "Ajoutez le SIREN ou le n° de TVA du client : il est obligatoire en autoliquidation."
}
