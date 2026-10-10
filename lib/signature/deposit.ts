/**
 * Acompte après signature (DECISIONS-STRATEGIQUES.md § 11 « L'acompte ») :
 * coordonnées du virement et QR code SEPA montrés au client qui vient de
 * signer, et repris dans ses emails. Pas de page de paiement : le client vire
 * l'acompte à l'artisan, qui l'encaisse et émet sa facture d'acompte.
 *
 * Fonctions pures (aucun réseau ni base) : page publique, emails, démo.
 * Le montant, le taux et la référence sont figés sur le lien à la signature
 * (colonnes deposit_* de document_signatures) : un changement de réglage
 * ultérieur ne modifie jamais ce qui a été annoncé au client.
 */
import { buildEpcPayload } from "@/lib/payment-link/epc"
import { isValidBic, isValidIban, normalizeBic, normalizeIban } from "@/lib/payment-link/iban"
import { encodeQr, qrSvgPath } from "@/lib/payment-link/qr"
import type { PanelDeposit, SignatureRow } from "@/lib/signature/types"
import type { PublicDeposit } from "@/lib/signature/view"

/** Coordonnées bancaires de l'entreprise (colonnes de `companies`). */
export interface BankDetails {
  name: string | null
  iban: string | null
  bic?: string | null
  bank_account_holder?: string | null
}

/** Compte du virement, ou null sans IBAN valide. */
export function transferAccount(bank: BankDetails | null | undefined): PublicDeposit["account"] {
  if (!bank) return null
  const iban = normalizeIban(bank.iban)
  if (!isValidIban(iban)) return null
  const bic = normalizeBic(bank.bic)
  const holder = bank.bank_account_holder?.trim() || bank.name?.trim() || "L'entreprise"
  return { holder, iban, bic: isValidBic(bic) ? bic : null }
}

/** QR code de virement SEPA (EPC069-12, version 13 au plus), ou null. */
export function transferQr(account: PublicDeposit["account"], amount: number, reference: string): PublicDeposit["qr"] {
  if (!account) return null
  const payload = buildEpcPayload({ name: account.holder, iban: account.iban, bic: account.bic, amount, remittance: reference })
  const matrix = payload ? encodeQr(payload, { maxVersion: 13 }) : null
  return matrix ? { path: qrSvgPath(matrix), size: matrix.size + 8 } : null
}

/** Acompte figé sur un lien signé (null : aucun acompte demandé, ou migration absente). */
export function depositOfRow(row: Pick<SignatureRow, "deposit_amount" | "deposit_percent" | "deposit_reference" | "deposit_request_on" | "deposit_requested_at">): PanelDeposit | null {
  const amount = Number(row.deposit_amount)
  if (!row.deposit_reference || !(amount > 0)) return null
  return {
    amount,
    percent: Number(row.deposit_percent) || 0,
    reference: row.deposit_reference,
    timing: row.deposit_request_on ? "later" : "now",
    request_on: row.deposit_request_on ?? null,
    requested_at: row.deposit_requested_at ?? null,
  }
}

/**
 * Ce que voit le client : à régler maintenant (signature à distance), ou
 * annoncé pour plus tard (signé sur place chez un particulier) — dans ce cas,
 * ni IBAN ni QR code avant le jour de la demande, pour qu'aucun paiement ne
 * soit sollicité pendant les 7 jours (C. consom. art. L221-10).
 */
export function publicDeposit(deposit: PanelDeposit | null, bank: BankDetails | null | undefined, today: string): PublicDeposit | null {
  if (!deposit) return null
  const payableNow = deposit.timing === "now" || (!!deposit.request_on && today >= deposit.request_on)
  const account = payableNow ? transferAccount(bank) : null
  return {
    amount: deposit.amount,
    percent: deposit.percent,
    timing: payableNow ? "now" : "later",
    requestOn: deposit.request_on,
    reference: deposit.reference,
    account,
    qr: transferQr(account, deposit.amount, deposit.reference),
  }
}
