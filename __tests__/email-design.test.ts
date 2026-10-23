/**
 * Emails du devis et de la facture (piste « C · Éditorial », 19/10/2026) :
 * polices hébergées par le site, aucun appel à un tiers, et un bouton de
 * virement qui ne laisse pas croire qu'on vire depuis Qonforme.
 */
import { describe, expect, it } from "vitest"
import { buildInvoiceEmail } from "@/lib/email/templates/invoice"
import { buildQuoteEmail } from "@/lib/email/templates/quote"

const invoice = {
  invoiceNumber: "F-2026-018", issueDate: "2026-10-19", dueDate: "2026-11-18",
  subtotalHt: 3280, totalVat: 328, totalTtc: 3608,
  companyName: "Martin Électricité", companyIban: "FR76 1234 5678 9012 3456 7890 123",
  accentColor: "#0F766E", clientName: "Mme Dupont", clientEmail: "a@b.fr", appUrl: "https://qonforme.fr",
}
const quote = {
  quoteNumber: "D-2026-041", issueDate: "2026-10-19", validUntil: "2026-11-18",
  subtotalHt: 1627, totalVat: 162.7, totalTtc: 1789.7,
  companyName: "Martin Électricité", accentColor: "#2563EB", clientName: "Mme Dupont", appUrl: "https://qonforme.fr",
}

describe("emails devis et facture", () => {
  it("polices servies par le site, jamais par un tiers", () => {
    for (const html of [buildInvoiceEmail(invoice).html, buildQuoteEmail(quote).html]) {
      expect(html).toContain("/email-fonts/")
      expect(html).not.toMatch(/fonts\.googleapis|fonts\.gstatic/)
    }
  })

  it("garde la couleur de l'entreprise (filet, titre, total)", () => {
    const { html } = buildInvoiceEmail(invoice)
    expect(html.match(/#0F766E/g)!.length).toBeGreaterThanOrEqual(3)
  })

  it("le bouton de virement ne promet pas un paiement dans Qonforme", () => {
    const { html } = buildInvoiceEmail({ ...invoice, paymentUrl: "https://qonforme.fr/regler/abc" })
    expect(html).toContain("Voir les coordonnées de virement")
    expect(html).toContain("depuis votre banque")
    expect(html).not.toContain("Régler par virement")
  })

  it("sans lien de règlement ni IBAN : pas de bouton, titre honnête", () => {
    const { html } = buildInvoiceEmail({ ...invoice, companyIban: null })
    expect(html).not.toContain("coordonnées de virement")
    expect(html).toContain("à régler avant l'échéance.")
  })

  it("le devis annonce la signature seulement avec un lien de signature", () => {
    expect(buildQuoteEmail({ ...quote, link: { url: "https://qonforme.fr/s/x", mode: "sign" } }).html).toContain("prêt à signer.")
    expect(buildQuoteEmail(quote).html).toContain("joint à cet email.")
  })
})
