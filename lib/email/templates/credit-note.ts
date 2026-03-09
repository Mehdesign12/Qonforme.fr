import { emailBase, fmtEur, fmtDate, amountBlock } from "./base"

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
    <p style="margin:0 0 6px;font-size:15px;color:#475569;">Bonjour,</p>
    <p style="margin:0 0 24px;font-size:15px;color:#1E293B;line-height:1.6;">
      Veuillez trouver ci-joint votre avoir <strong>${d.creditNoteNumber}</strong>
      du <strong>${fmtDate(d.issueDate)}</strong>${d.invoiceNumber
        ? `, établi en référence à la facture <strong>${d.invoiceNumber}</strong>`
        : ""}.
    </p>

    <!-- Bloc infos avoir -->
    <table width="100%" cellpadding="0" cellspacing="0"
           style="border:1px solid #E2E8F0;border-radius:10px;overflow:hidden;margin-bottom:4px;">
      <tr style="background-color:#FFF7ED;">
        <td colspan="2" style="padding:14px 20px;font-size:12px;font-weight:600;color:#C2410C;letter-spacing:0.8px;text-transform:uppercase;">
          Détail de l'avoir
        </td>
      </tr>
      <tr>
        <td style="padding:10px 20px;font-size:13px;color:#64748B;border-top:1px solid #F1F5F9;">Numéro</td>
        <td style="padding:10px 20px;font-size:13px;color:#1E293B;font-weight:600;text-align:right;border-top:1px solid #F1F5F9;">${d.creditNoteNumber}</td>
      </tr>
      <tr style="background-color:#FAFAFA;">
        <td style="padding:10px 20px;font-size:13px;color:#64748B;">Date d'émission</td>
        <td style="padding:10px 20px;font-size:13px;color:#1E293B;text-align:right;">${fmtDate(d.issueDate)}</td>
      </tr>
      ${d.invoiceNumber ? `
      <tr>
        <td style="padding:10px 20px;font-size:13px;color:#64748B;">Facture d'origine</td>
        <td style="padding:10px 20px;font-size:13px;color:#1E293B;text-align:right;">${d.invoiceNumber}</td>
      </tr>` : ""}
    </table>

    ${amountBlock(d.subtotalHt, d.totalVat, d.totalTtc, "#EA580C")}

    ${d.notes ? `
    <div style="margin-top:20px;padding:16px 20px;background-color:#FFFBEB;border:1px solid #FDE68A;border-radius:8px;">
      <p style="margin:0 0 4px;font-size:12px;font-weight:600;color:#92400E;text-transform:uppercase;letter-spacing:0.6px;">Notes</p>
      <p style="margin:0;font-size:13px;color:#78350F;line-height:1.5;">${d.notes}</p>
    </div>` : ""}

    <p style="margin:28px 0 0;font-size:13px;color:#64748B;line-height:1.6;">
      L'avoir est joint à cet email en format PDF. Le montant sera déduit de votre prochaine facture ou remboursé selon notre accord.
    </p>

    <p style="margin:20px 0 0;font-size:14px;color:#475569;">
      Cordialement,<br/>
      <strong style="color:#1E293B;">${d.companyName}</strong>
    </p>
  `

  return {
    subject,
    html: emailBase({
      accentColor: "#EA580C",
      companyName: d.companyName,
      preheader:   `Avoir ${d.creditNoteNumber} — ${fmtEur(Math.abs(d.totalTtc))} — ${d.companyName}`,
      body,
    }),
  }
}
