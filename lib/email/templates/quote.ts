import { emailBase, fmtEur, fmtDate, amountBlock, ctaButton, notesBlock } from "./base"

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
  /**
   * Lien en ligne (lib/signature/share.ts) : « sign » pour consulter et signer
   * (Essentiel, Artisan), « view » pour consulter seulement (compte gratuit).
   */
  link?:         { url: string; mode: "sign" | "view" } | null
}

export function buildQuoteEmail(d: QuoteEmailData): { subject: string; html: string } {
  const subject = `Devis ${d.quoteNumber} — ${d.companyName}`

  const isExpired = new Date(d.validUntil) < new Date()

  const body = `
    <p style="margin:0 0 8px;font-size:15.5px;color:#2B2E35;line-height:1.7;">Bonjour,</p>
    <p style="margin:0;font-size:15.5px;color:#2B2E35;line-height:1.7;">
      Voici votre devis <strong>${d.quoteNumber}</strong> du <strong>${fmtDate(d.issueDate)}</strong>,
      valable jusqu'au <strong${isExpired ? ' style="color:#B42318;"' : ''}>${fmtDate(d.validUntil)}</strong>.
    </p>

    ${amountBlock(d.subtotalHt, d.totalVat, d.totalTtc, d.accentColor)}

    ${d.link ? ctaButton(d.link.mode === "sign" ? "Consulter et signer" : "Consulter le devis en ligne", d.link.url.replace(/"/g, "&quot;"), d.accentColor) : ""}

    <p style="margin:12px 0 0;font-size:12.5px;color:#4F5257;line-height:1.55;">

      ${d.link?.mode === "sign"
        ? "Le devis est joint à cet email en format PDF. Vous pouvez aussi le lire en entier et le signer en ligne, depuis votre ordinateur ou votre téléphone : ce lien vous est personnel."
        : d.link?.mode === "view"
          ? "Le devis est joint à cet email en format PDF, et consultable en ligne. Pour l'accepter, retournez-le daté et signé avec la mention « Bon pour accord », par exemple en répondant à cet email."
          : "Le devis est joint à cet email en format PDF. Pour l'accepter ou nous contacter, répondez simplement à cet email."}
    
    </p>

    ${d.notes ? notesBlock(d.notes) : ""}

    <p style="margin:30px 0 0;font-size:14.5px;color:#2B2E35;line-height:1.65;">
      Cordialement,<br/>
      <strong style="color:#15171C;">${d.companyName}</strong>
    </p>
  `

  return {
    subject,
    html: emailBase({
      source: "email-devis",
      accentColor: d.accentColor,
      companyName: d.companyName,
      preheader:   `Devis ${d.quoteNumber} — ${fmtEur(d.totalTtc)} TTC — valable jusqu'au ${fmtDate(d.validUntil)}`,
      reference:   `N° ${d.quoteNumber}`,
      headline:    "Votre devis,",
      headlineAccent: d.link?.mode === "sign" ? "prêt à signer." : d.link ? "à consulter en ligne." : "joint à cet email.",
      body,
    }),
  }
}
