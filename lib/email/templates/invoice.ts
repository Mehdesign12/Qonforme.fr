import { emailBase, fmtEur, fmtDate, amountBlock } from "./base"

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
}

export function buildInvoiceEmail(d: InvoiceEmailData): { subject: string; html: string } {
  const subject = `Facture ${d.invoiceNumber} — ${d.companyName}`

  const body = `
    <p style="margin:0 0 6px;font-size:15px;color:#475569;">Bonjour,</p>
    <p style="margin:0 0 24px;font-size:15px;color:#1E293B;line-height:1.6;">
      Veuillez trouver ci-joint votre facture <strong>${d.invoiceNumber}</strong>
      du <strong>${fmtDate(d.issueDate)}</strong>, échéance le
      <strong style="color:#DC2626;">${fmtDate(d.dueDate)}</strong>.
    </p>

    <!-- Bloc infos facture -->
    <table width="100%" cellpadding="0" cellspacing="0"
           style="border:1px solid #E2E8F0;border-radius:10px;overflow:hidden;margin-bottom:4px;">
      <tr style="background-color:#F8FAFC;">
        <td colspan="2" style="padding:14px 20px;font-size:12px;font-weight:600;color:#94A3B8;letter-spacing:0.8px;text-transform:uppercase;">
          Détail de la facture
        </td>
      </tr>
      <tr>
        <td style="padding:10px 20px;font-size:13px;color:#64748B;border-top:1px solid #F1F5F9;">Numéro</td>
        <td style="padding:10px 20px;font-size:13px;color:#1E293B;font-weight:600;text-align:right;border-top:1px solid #F1F5F9;">${d.invoiceNumber}</td>
      </tr>
      <tr style="background-color:#FAFAFA;">
        <td style="padding:10px 20px;font-size:13px;color:#64748B;">Date d'émission</td>
        <td style="padding:10px 20px;font-size:13px;color:#1E293B;text-align:right;">${fmtDate(d.issueDate)}</td>
      </tr>
      <tr>
        <td style="padding:10px 20px;font-size:13px;color:#64748B;">Date d'échéance</td>
        <td style="padding:10px 20px;font-size:13px;color:#DC2626;font-weight:600;text-align:right;">${fmtDate(d.dueDate)}</td>
      </tr>
    </table>

    ${amountBlock(d.subtotalHt, d.totalVat, d.totalTtc, d.accentColor)}

    ${d.companyIban ? `
    <table width="100%" cellpadding="0" cellspacing="0"
           style="margin-top:16px;background-color:#F0FDF4;border:1px solid #BBF7D0;border-radius:8px;padding:0;">
      <tr>
        <td style="padding:14px 20px;">
          <p style="margin:0;font-size:12px;font-weight:600;color:#15803D;text-transform:uppercase;letter-spacing:0.6px;">
            Coordonnées bancaires
          </p>
          <p style="margin:4px 0 0;font-size:13px;color:#166534;font-family:monospace;letter-spacing:0.5px;">
            ${d.companyIban}
          </p>
        </td>
      </tr>
    </table>` : ""}

    ${d.notes ? `
    <div style="margin-top:20px;padding:16px 20px;background-color:#FFFBEB;border:1px solid #FDE68A;border-radius:8px;">
      <p style="margin:0 0 4px;font-size:12px;font-weight:600;color:#92400E;text-transform:uppercase;letter-spacing:0.6px;">Notes</p>
      <p style="margin:0;font-size:13px;color:#78350F;line-height:1.5;">${d.notes}</p>
    </div>` : ""}

    <p style="margin:28px 0 0;font-size:13px;color:#64748B;line-height:1.6;">
      La facture est jointe à cet email en format PDF (Factur-X EN 16931).
    </p>

    <p style="margin:20px 0 0;font-size:14px;color:#475569;">
      Cordialement,<br/>
      <strong style="color:#1E293B;">${d.companyName}</strong>
    </p>
  `

  return {
    subject,
    html: emailBase({
      accentColor: d.accentColor,
      companyName: d.companyName,
      preheader:   `Facture ${d.invoiceNumber} — ${fmtEur(d.totalTtc)} TTC — échéance ${fmtDate(d.dueDate)}`,
      body,
    }),
  }
}
