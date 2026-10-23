import { emailBase, fmtEur, fmtDate, amountBlock, notesBlock } from "./base"

interface CreditNoteEmailData {
  creditNoteNumber: string
  issueDate:        string
  subtotalHt:       number
  totalVat:         number
  totalTtc:         number
  invoiceNumber?:   string | null
  notes?:           string | null
  companyName:      string
  accentColor:      string
  clientName:       string
}

export function buildCreditNoteEmail(d: CreditNoteEmailData): { subject: string; html: string } {
  const subject = `Avoir ${d.creditNoteNumber} — ${d.companyName}`

  const body = `
    <p style="margin:0 0 8px;font-size:15.5px;color:#2B2E35;line-height:1.7;">Bonjour,</p>
    <p style="margin:0;font-size:15.5px;color:#2B2E35;line-height:1.7;">
      Voici votre avoir <strong>${d.creditNoteNumber}</strong>
      du <strong>${fmtDate(d.issueDate)}</strong>${d.invoiceNumber
        ? `, établi en référence à la facture <strong>${d.invoiceNumber}</strong>`
        : ""}.
    </p>

    

    ${amountBlock(d.subtotalHt, d.totalVat, d.totalTtc, "#EA580C")}

    ${d.notes ? notesBlock(d.notes) : ""}

    <p style="margin:30px 0 0;font-size:12.5px;color:#4F5257;line-height:1.55;">
      L'avoir est joint à cet email en format PDF. Le montant sera déduit de votre prochaine facture ou remboursé selon notre accord.
    </p>

    <p style="margin:30px 0 0;font-size:14.5px;color:#2B2E35;line-height:1.65;">
      Cordialement,<br/>
      <strong style="color:#15171C;">${d.companyName}</strong>
    </p>
  `

  return {
    subject,
    html: emailBase({
      source: "email-avoir",
      accentColor: "#EA580C",
      companyName: d.companyName,
      preheader:   `Avoir ${d.creditNoteNumber} — ${fmtEur(Math.abs(d.totalTtc))} — ${d.companyName}`,
      reference:   `N° ${d.creditNoteNumber}`,
      headline:    "Votre avoir,",
      headlineAccent: d.invoiceNumber ? `pour la facture ${d.invoiceNumber}.` : "joint à cet email.",
      body,
    }),
  }
}
