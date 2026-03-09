import { emailBase, fmtEur, fmtDate, amountBlock } from "./base"

interface QuoteEmailData {
  quoteNumber:   string
  issueDate:     string
  validUntil:    string
  subtotalHt:    number
  totalVat:      number
  totalTtc:      number
  notes?:        string | null
  companyName:   string
  accentColor:   string
  clientName:    string
  appUrl:        string
}

export function buildQuoteEmail(d: QuoteEmailData): { subject: string; html: string } {
  const subject = `Devis ${d.quoteNumber} — ${d.companyName}`

  const isExpired = new Date(d.validUntil) < new Date()

  const body = `
    <p style="margin:0 0 6px;font-size:15px;color:#475569;">Bonjour,</p>
    <p style="margin:0 0 24px;font-size:15px;color:#1E293B;line-height:1.6;">
      Veuillez trouver ci-joint votre devis <strong>${d.quoteNumber}</strong>
      du <strong>${fmtDate(d.issueDate)}</strong>,
      valable jusqu'au <strong${isExpired ? ' style="color:#DC2626;"' : ''}>${fmtDate(d.validUntil)}</strong>.
    </p>

    <!-- Bloc infos devis -->
    <table width="100%" cellpadding="0" cellspacing="0"
           style="border:1px solid #E2E8F0;border-radius:10px;overflow:hidden;margin-bottom:4px;">
      <tr style="background-color:#F8FAFC;">
        <td colspan="2" style="padding:14px 20px;font-size:12px;font-weight:600;color:#94A3B8;letter-spacing:0.8px;text-transform:uppercase;">
          Détail du devis
        </td>
      </tr>
      <tr>
        <td style="padding:10px 20px;font-size:13px;color:#64748B;border-top:1px solid #F1F5F9;">Numéro</td>
        <td style="padding:10px 20px;font-size:13px;color:#1E293B;font-weight:600;text-align:right;border-top:1px solid #F1F5F9;">${d.quoteNumber}</td>
      </tr>
      <tr style="background-color:#FAFAFA;">
        <td style="padding:10px 20px;font-size:13px;color:#64748B;">Date d'émission</td>
        <td style="padding:10px 20px;font-size:13px;color:#1E293B;text-align:right;">${fmtDate(d.issueDate)}</td>
      </tr>
      <tr>
        <td style="padding:10px 20px;font-size:13px;color:#64748B;">Valable jusqu'au</td>
        <td style="padding:10px 20px;font-size:13px;font-weight:600;text-align:right;${isExpired ? "color:#DC2626;" : "color:#1E293B;"}">${fmtDate(d.validUntil)}</td>
      </tr>
    </table>

    ${amountBlock(d.subtotalHt, d.totalVat, d.totalTtc, d.accentColor)}

    ${d.notes ? `
    <div style="margin-top:20px;padding:16px 20px;background-color:#FFFBEB;border:1px solid #FDE68A;border-radius:8px;">
      <p style="margin:0 0 4px;font-size:12px;font-weight:600;color:#92400E;text-transform:uppercase;letter-spacing:0.6px;">Notes</p>
      <p style="margin:0;font-size:13px;color:#78350F;line-height:1.5;">${d.notes}</p>
    </div>` : ""}

    <p style="margin:28px 0 0;font-size:13px;color:#64748B;line-height:1.6;">
      Le devis est joint à cet email en format PDF. Pour l'accepter ou nous contacter, répondez simplement à cet email.
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
      preheader:   `Devis ${d.quoteNumber} — ${fmtEur(d.totalTtc)} TTC — valable jusqu'au ${fmtDate(d.validUntil)}`,
      body,
    }),
  }
}
