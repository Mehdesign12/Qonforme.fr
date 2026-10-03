/**
 * Démo du lien de paiement par virement : mêmes composants que l'application
 * (fiche facture, cloche, page publique de règlement), données fictives tirées
 * de lib/demo/data.ts. Rien n'est enregistré ni envoyé.
 *
 * L'IBAN de la démo (code banque 00000) passe la clé ISO 13616 mais ne
 * correspond à aucun établissement ; le BIC commence par « DEMO ».
 */
import { invoiceNumberLabel } from "@/lib/utils/document-numbering"
import { DEMO_COMPANY, DEMO_CREDIT_NOTES, DEMO_INVOICES, demoInvoice } from "@/lib/demo/data"
import { buildEpcPayload } from "@/lib/payment-link/epc"
import { normalizeIban } from "@/lib/payment-link/iban"
import { encodeQr, qrSvgPath } from "@/lib/payment-link/qr"
import { isPayableStatus, payState, remainingDue } from "@/lib/payment-link/rules"
import type { ArtisanDeclaration, PaymentLinkState, PaymentPageData, PublicCompany } from "@/lib/payment-link/types"

export const DEMO_BANK = {
  holder: DEMO_COMPANY.name,
  iban: normalizeIban(DEMO_COMPANY.iban),
  bic: "DEMOFRPPXXX",
}

/** Virement déclaré par Bâti Ouest sur la page de règlement de F-2026-0142. */
export const DEMO_DECLARATIONS: (ArtisanDeclaration & { invoiceId: string })[] = [
  {
    id: "demo-virement-0142",
    invoiceId: "f-2026-0142",
    transferDate: "2026-09-30",
    amount: demoInvoice("f-2026-0142")?.total_ttc ?? 0,
    note: "Virement fait depuis le compte de la société, référence F-2026-0142.",
    declaredAt: "2026-09-30T18:12:00+02:00",
    status: "open",
  },
]

/** Adresse de la page de règlement d'une facture de démo. */
export const demoPaymentPath = (invoiceId: string) => `/demo/regler/${invoiceId}`

const DEMO_PUBLIC_COMPANY: PublicCompany = {
  name: DEMO_COMPANY.name,
  logoUrl: null,
  siren: DEMO_COMPANY.siren,
  address: DEMO_COMPANY.address,
  zipCode: DEMO_COMPANY.zip_code,
  city: DEMO_COMPANY.city,
  email: DEMO_COMPANY.email,
}

/** État du lien sur la fiche facture de démo. */
export function demoPaymentLinkState(invoiceId: string): PaymentLinkState {
  const inv = demoInvoice(invoiceId)
  const emitted = !!inv && inv.status !== "draft"
  const declaration = DEMO_DECLARATIONS.find((d) => d.invoiceId === inv?.id) ?? null
  return {
    available: true,
    iban: "ok",
    link: emitted && inv ? { url: demoPaymentPath(inv.id), createdAt: inv.sent_at ?? inv.issue_date } : null,
    disabledAt: null,
    declaration,
  }
}

/** Virements déclarés sur des factures encore à encaisser (cloche « À surveiller »). */
export function demoOpenDeclarations() {
  return DEMO_DECLARATIONS.flatMap((d) => {
    const inv = demoInvoice(d.invoiceId)
    return inv && d.status === "open" && isPayableStatus(inv.status) ? [{ declaration: d, invoice: inv }] : []
  })
}

/** Page publique de règlement de la démo : /demo/regler/<facture>, ou « desactive » pour l'état « lien désactivé ». */
export function demoPaymentPage(id: string): PaymentPageData {
  if (id === "desactive") return { state: "disabled", company: DEMO_PUBLIC_COMPANY }
  const inv = DEMO_INVOICES.find((i) => i.id === id)
  if (!inv || inv.status === "draft") return { state: "not_found" }

  const credits = DEMO_CREDIT_NOTES.filter((c) => c.original_invoice_number === inv.invoice_number)
  const remaining = remainingDue(inv.total_ttc, credits)
  const invoice = {
    number: invoiceNumberLabel(inv.invoice_number),
    issueDate: inv.issue_date,
    dueDate: inv.due_date,
    totalTtc: inv.total_ttc,
    credited: Math.round((inv.total_ttc - remaining) * 100) / 100,
    remaining,
  }
  const state = payState(inv.status, remaining)
  if (state === "draft") return { state: "not_found" }
  if (state !== "payable") return { state, company: DEMO_PUBLIC_COMPANY, invoice }

  const payload = buildEpcPayload({ name: DEMO_BANK.holder, iban: DEMO_BANK.iban, bic: DEMO_BANK.bic, amount: remaining, remittance: `Facture ${inv.invoice_number}` })
  const matrix = payload ? encodeQr(payload, { maxVersion: 13 }) : null
  const declared = DEMO_DECLARATIONS.find((d) => d.invoiceId === inv.id && d.status === "open")
  return {
    state: "payable",
    company: DEMO_PUBLIC_COMPANY,
    invoice,
    account: { ...DEMO_BANK },
    qr: matrix ? { path: qrSvgPath(matrix), size: matrix.size + 8 } : null,
    declaration: declared ? { transferDate: declared.transferDate, amount: declared.amount, declaredAt: declared.declaredAt } : null,
  }
}
