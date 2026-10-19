import { emailBase, fmtEur, fmtDate, amountBlock, ctaButton, retentionBlock, notesBlock, monoLabel, FONT_MONO } from "./base"

interface InvoiceEmailData {
  invoiceNumber:  string
  issueDate:      string
  dueDate:        string
  subtotalHt:     number
  totalVat:       number
  totalTtc:       number
  notes?:         string | null
  companyName:    string
  companyIban?:   string | null
  accentColor:    string
  clientName:     string
  clientEmail:    string
  appUrl:         string
  /** Page de règlement par virement (lib/payment-link) ; absente sans IBAN valide ou lien désactivé. */
  paymentUrl?:    string | null
  /** Nature du document (« facture d'acompte », « situation de travaux n° 2 ») ; « facture » par défaut. */
  docLabel?:      string | null
  /** Retenue de garantie (formule Artisan) : montant retenu TTC, à régler à sa libération. */
  retention?:     { rate: number; amount: number } | null
}

export function buildInvoiceEmail(d: InvoiceEmailData): { subject: string; html: string } {
  const subject = `Facture ${d.invoiceNumber} — ${d.companyName}`

  const label = d.docLabel ?? "facture"
  const body = `
    <p style="margin:0 0 8px;font-size:15.5px;color:#2B2E35;line-height:1.7;">Bonjour,</p>
    <p style="margin:0;font-size:15.5px;color:#2B2E35;line-height:1.7;">
      Voici votre ${label} <strong>${d.invoiceNumber}</strong> du <strong>${fmtDate(d.issueDate)}</strong>,
      à régler avant le <strong style="color:#B42318;">${fmtDate(d.dueDate)}</strong>.
      Elle est jointe à cet email au format PDF, avec ses données Factur-X.
    </p>

    ${amountBlock(d.subtotalHt, d.totalVat, d.totalTtc, d.accentColor)}
    ${retentionBlock(d.totalTtc, d.retention)}

    ${d.companyIban ? `
    <table width="100%" cellpadding="0" cellspacing="0" style="margin-top:20px;">
      <tr>
        <td class="q-stack" style="font-size:13px;line-height:1.5;">
          ${monoLabel("Virement sur")}<br/>
          <span style="font-family:${FONT_MONO};font-size:13px;letter-spacing:0.3px;color:#15171C;">${d.companyIban}</span>
        </td>
        <td class="q-stack" align="right" style="font-size:13px;line-height:1.5;">
          ${monoLabel("Référence")}<br/>
          <span style="font-family:${FONT_MONO};font-size:13px;color:#15171C;">${d.invoiceNumber}</span>
        </td>
      </tr>
    </table>` : ""}

    ${d.paymentUrl ? `
    ${ctaButton("Voir les coordonnées de virement", d.paymentUrl, d.accentColor)}
    <p style="margin:12px 0 0;font-size:12.5px;color:#4F5257;line-height:1.55;">
      Le virement se fait depuis votre banque. Cette page donne l'IBAN, le montant et la référence à copier, et un bouton pour nous signaler votre virement.
    </p>` : ""}

    ${d.notes ? notesBlock(d.notes) : ""}

    <p style="margin:30px 0 0;font-size:14.5px;color:#2B2E35;line-height:1.65;">
      Cordialement,<br/>
      <strong style="color:#15171C;">${d.companyName}</strong>
    </p>
  `

  return {
    subject,
    html: emailBase({
      source: "email-facture",
      accentColor: d.accentColor,
      companyName: d.companyName,
      preheader:   `Facture ${d.invoiceNumber} — ${fmtEur(d.totalTtc)} TTC — échéance ${fmtDate(d.dueDate)}`,
      reference:   `N° ${d.invoiceNumber}`,
      headline:    `Votre ${label},`,
      headlineAccent: d.paymentUrl || d.companyIban ? "à régler par virement." : "à régler avant l'échéance.",
      body,
    }),
  }
}
