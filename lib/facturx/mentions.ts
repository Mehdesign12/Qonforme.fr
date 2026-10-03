/**
 * Mentions de règlement d'une facture entre professionnels.
 *
 * Code de commerce, art. L441-9 et L441-10 : une facture entre professionnels
 * indique les conditions d'escompte, le taux des pénalités de retard et
 * l'indemnité forfaitaire de 40 € pour frais de recouvrement (art. D441-5).
 * La norme AFNOR XP Z12-012 (règles BR-FR-05 et BR-FR-06) les veut une fois
 * chacune dans les notes du XML, sous les codes sujets PMT (indemnité), PMD
 * (pénalités) et AAB (escompte).
 *
 * Si les mentions de l'entreprise ou les notes de la facture les contiennent
 * déjà, ce texte-là est repris tel quel ; sinon la mention légale par défaut est
 * ajoutée au XML et imprimée sur le PDF, pour que les deux disent la même chose.
 * Rien pour un client particulier : ces mentions ne s'appliquent qu'entre
 * professionnels.
 *
 * Fonctions pures : utilisées par le XML (lib/facturx/xml.ts), le PDF
 * (lib/pdf/*) et l'aperçu à l'écran.
 */

export type PaymentMentionCode = "PMT" | "PMD" | "AAB"

export interface PaymentMention {
  code: PaymentMentionCode
  text: string
  /** Vrai si le texte vient des mentions ou des notes, déjà imprimées sur le document. */
  alreadyPrinted: boolean
}

/** Mentions légales par défaut (taux applicable à défaut de taux convenu : L441-10 II). */
export const DEFAULT_PAYMENT_MENTIONS: Record<PaymentMentionCode, string> = {
  AAB: "Escompte pour paiement anticipé : néant.",
  PMD: "Pénalités de retard : taux de la Banque centrale européenne majoré de 10 points (art. L. 441-10 du code de commerce).",
  PMT: "Indemnité forfaitaire pour frais de recouvrement en cas de retard de paiement : 40 € (art. D. 441-5 du code de commerce).",
}

const DETECT: Record<PaymentMentionCode, RegExp> = {
  AAB: /escompte/i,
  PMD: /p[ée]nalit[ée]s?\s+(de|pour)\s+retard|retard\s+de\s+paiement.*p[ée]nalit|p[ée]nalit[ée].*retard/i,
  PMT: /indemnit[ée]\s+forfaitaire|frais\s+de\s+recouvrement/i,
}

const ORDER: PaymentMentionCode[] = ["AAB", "PMD", "PMT"]

/** Vrai si le client est un professionnel identifié (SIREN ou n° de TVA). */
export function isBusinessBuyer(buyer: { siren?: string | null; vat_number?: string | null } | null | undefined): boolean {
  return !!(buyer?.siren?.trim() || buyer?.vat_number?.trim())
}

/**
 * Mentions de règlement d'un document adressé à un professionnel.
 * @param texts mentions de l'entreprise, notes de la facture… (déjà imprimées)
 */
export function paymentMentions(businessBuyer: boolean, ...texts: (string | null | undefined)[]): PaymentMention[] {
  if (!businessBuyer) return []
  const lines = texts
    .flatMap((t) => (t ?? "").split("\n"))
    .map((l) => l.trim())
    .filter(Boolean)
  return ORDER.map((code) => {
    const found = lines.find((l) => DETECT[code].test(l))
    return found
      ? { code, text: found, alreadyPrinted: true }
      : { code, text: DEFAULT_PAYMENT_MENTIONS[code], alreadyPrinted: false }
  })
}

/**
 * Mentions à ajouter au pied du document pour qu'il dise la même chose que le
 * XML : motif d'absence de TVA (franchise, autoliquidation…) et mentions de
 * règlement, sauf celles déjà présentes dans les mentions de l'entreprise ou
 * les notes.
 */
export function mentionsToPrint(
  breakdown: { exemption?: { mention: string; code: string } }[],
  businessBuyer: boolean,
  ...printedTexts: (string | null | undefined)[]
): string[] {
  const printed = printedTexts.filter(Boolean).join("\n")
  const lower = printed.toLowerCase()
  const out: string[] = []
  for (const b of breakdown) {
    const ex = b.exemption
    if (!ex || out.includes(ex.mention)) continue
    const already = ex.code === "VATEX-FR-FRANCHISE"
      ? /\b293\s*B\b/i.test(printed)
      : ex.code === "VATEX-EU-AE"
        ? /auto-?liquidation/i.test(printed)
        : lower.includes(ex.mention.toLowerCase())
    if (!already) out.push(ex.mention)
  }
  for (const m of paymentMentions(businessBuyer, ...printedTexts)) {
    if (!m.alreadyPrinted) out.push(m.text)
  }
  return out
}
