import { emailBase, fmtEur, fmtDate, amountBlock, ctaButton } from "./base"

/**
 * Relance d'un devis envoyé resté sans réponse (cron des relances, réglage
 * « Relancer les devis sans réponse »). Courte, vouvoiement, sans pression :
 * rappelle le devis et sa date de validité, propose de répondre à l'email.
 */
export interface QuoteFollowupEmailData {
  quoteNumber:    string
  issueDate:      string
  validUntil:     string
  /** Jour d'envoi du devis (AAAA-MM-JJ). */
  sentDate:       string
  subtotalHt:     number
  totalVat:       number
  totalTtc:       number
  companyName:    string
  accentColor:    string
  clientName:     string
  /** 1 pour la première relance de ce devis. */
  followupNumber: number
  /** Le PDF du devis est joint à l'email. */
  hasAttachment:  boolean
  /**
   * Lien vers la page de consultation du devis (signature en ligne, construite
   * à part) ; affiche un bouton « Consulter le devis ».
   */
  quoteUrl?:      string
}

function esc(value: string): string {
  return value.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] as string)
}

export function buildQuoteFollowupEmail(d: QuoteFollowupEmailData): { subject: string; html: string } {
  const number = esc(d.quoteNumber)
  const company = esc(d.companyName)
  const accent = d.accentColor || "#2563EB"

  const subject = `Devis ${d.quoteNumber} — avez-vous pu en prendre connaissance ? — ${d.companyName}`
  const preheader = `Devis ${d.quoteNumber} — ${fmtEur(d.totalTtc)} TTC — valable jusqu'au ${fmtDate(d.validUntil)}`

  const body = `
    <p style="margin:0 0 6px;font-size:15px;color:#475569;">Bonjour,</p>
    <p style="margin:0 0 16px;font-size:15px;color:#1E293B;line-height:1.6;">
      Nous revenons vers vous au sujet du devis <strong>${number}</strong>, que nous vous avons adressé
      le <strong>${fmtDate(d.sentDate)}</strong>. Il reste valable jusqu'au <strong>${fmtDate(d.validUntil)}</strong>.
    </p>
    <p style="margin:0 0 24px;font-size:15px;color:#1E293B;line-height:1.6;">
      Avez-vous pu en prendre connaissance ? Si vous avez une question, ou si vous souhaitez l'ajuster,
      répondez simplement à cet email.${d.hasAttachment ? " Vous le trouverez à nouveau en pièce jointe." : ""}
    </p>

    <table width="100%" cellpadding="0" cellspacing="0"
           style="border:1px solid #E2E8F0;border-radius:10px;overflow:hidden;margin-bottom:4px;">
      <tr style="background-color:#F8FAFC;">
        <td colspan="2" style="padding:14px 20px;font-size:12px;font-weight:600;color:#94A3B8;letter-spacing:0.8px;text-transform:uppercase;">
          Devis concerné
        </td>
      </tr>
      <tr>
        <td style="padding:10px 20px;font-size:13px;color:#64748B;border-top:1px solid #F1F5F9;">Numéro</td>
        <td style="padding:10px 20px;font-size:13px;color:#1E293B;font-weight:600;text-align:right;border-top:1px solid #F1F5F9;">${number}</td>
      </tr>
      <tr style="background-color:#FAFAFA;">
        <td style="padding:10px 20px;font-size:13px;color:#64748B;">Date du devis</td>
        <td style="padding:10px 20px;font-size:13px;color:#1E293B;text-align:right;">${fmtDate(d.issueDate)}</td>
      </tr>
      <tr>
        <td style="padding:10px 20px;font-size:13px;color:#64748B;">Valable jusqu'au</td>
        <td style="padding:10px 20px;font-size:13px;font-weight:600;color:#1E293B;text-align:right;">${fmtDate(d.validUntil)}</td>
      </tr>
    </table>

    ${amountBlock(d.subtotalHt, d.totalVat, d.totalTtc, accent)}

    ${d.quoteUrl ? ctaButton("Consulter le devis", esc(d.quoteUrl), accent) : ""}

    <p style="margin:24px 0 0;font-size:14px;color:#475569;">
      Cordialement,<br/>
      <strong style="color:#1E293B;">${company}</strong>
    </p>
  `

  return {
    subject,
    html: emailBase({ accentColor: accent, companyName: company, preheader: esc(preheader), body }),
  }
}
