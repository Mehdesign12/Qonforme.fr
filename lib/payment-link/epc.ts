/**
 * Contenu du QR code de virement SEPA, au format du Conseil européen des
 * paiements : « Quick Response Code: Guidelines to Enable Data Capture for the
 * Initiation of a SEPA Credit Transfer », EPC069-12 version 3.1 du 19 mars 2024
 * (https://www.europeanpaymentscouncil.eu/document-library/guidance-documents/quick-response-code-guidelines-enable-data-capture-initiation).
 *
 * Ce que le document impose (section 2) :
 * - QR code de niveau de correction M, version 13 au plus, 331 octets au plus ;
 * - éléments séparés par un saut de ligne (LF), le dernier élément renseigné
 *   n'étant suivi d'aucun caractère ni séparateur ;
 * - « BCD », version « 002 », jeu de caractères (« 1 » = UTF-8), « SCT » ;
 * - BIC facultatif en version 002 (obligatoire seulement hors EEE) ;
 * - nom du bénéficiaire (70 caractères), IBAN (34), montant « EUR » suivi du
 *   montant (0,01 à 999 999 999,99, point décimal) ;
 * - motif (4), puis référence structurée (35) OU texte libre (140), jamais les deux.
 *
 * Ici : version 002, UTF-8, sans motif, texte libre = « Facture <numéro> ».
 */
import { isSepaIban, isValidBic, normalizeBic, normalizeIban } from "@/lib/payment-link/iban"

export interface EpcTransfer {
  /** Titulaire du compte (bénéficiaire). */
  name: string
  iban: string
  bic?: string | null
  /** Montant en euros (arrondi au centime). */
  amount: number
  /** Texte libre transmis au bénéficiaire, ici la référence de la facture. */
  remittance: string
}

export const EPC_MAX_BYTES = 331

/** Tronque à `max` caractères, sans couper un caractère composé. */
function clip(value: string, max: number): string {
  const chars = Array.from(value.replace(/[\r\n]+/g, " ").trim())
  return chars.slice(0, max).join("")
}

/** « 1234.5 » → « EUR1234.50 » ; null hors des bornes du document. */
export function epcAmount(amount: number): string | null {
  if (!Number.isFinite(amount)) return null
  const cents = Math.round(amount * 100)
  if (cents < 1 || cents > 99_999_999_999) return null
  return `EUR${(cents / 100).toFixed(2)}`
}

/**
 * Chaîne à encoder dans le QR code, ou null si le virement ne peut pas être
 * décrit (IBAN hors zone SEPA ou invalide, montant hors bornes, nom vide, trop long).
 */
export function buildEpcPayload(t: EpcTransfer): string | null {
  const iban = normalizeIban(t.iban)
  if (!isSepaIban(iban)) return null
  const amount = epcAmount(t.amount)
  if (!amount) return null
  const name = clip(t.name, 70)
  if (!name) return null
  const bic = normalizeBic(t.bic)

  const elements = [
    "BCD",
    "002",
    "1",
    "SCT",
    isValidBic(bic) ? bic : "",
    name,
    iban,
    amount,
    "",                         // motif (purpose) : non renseigné
    "",                         // référence structurée (RF) : non utilisée
    clip(t.remittance, 140),    // texte libre
  ]
  // Le dernier élément renseigné n'est suivi d'aucun séparateur
  while (elements.length > 0 && elements[elements.length - 1] === "") elements.pop()
  const payload = elements.join("\n")
  return new TextEncoder().encode(payload).length <= EPC_MAX_BYTES ? payload : null
}
