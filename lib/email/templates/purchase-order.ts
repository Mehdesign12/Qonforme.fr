import { emailBase, fmtEur, fmtDate, amountBlock, ctaButton, notesBlock } from "./base"

interface PurchaseOrderEmailData {
  poNumber:      string
  issueDate:     string
  deliveryDate?: string | null
  reference?:    string | null
  subtotalHt:    number
  totalVat:      number
  totalTtc:      number
  notes?:        string | null
  companyName:   string
  accentColor:   string
  clientName:    string
  appUrl:        string
  /** Lien en ligne (lib/signature/share.ts) : « sign » pour confirmer en ligne, « view » pour consulter. */
  link?:         { url: string; mode: "sign" | "view" } | null
}

export function buildPurchaseOrderEmail(d: PurchaseOrderEmailData): { subject: string; html: string } {
  const subject = `Bon de commande ${d.poNumber} — ${d.companyName}`

  const body = `
    <p style="margin:0 0 8px;font-size:15.5px;color:#2B2E35;line-height:1.7;">Bonjour,</p>
    <p style="margin:0;font-size:15.5px;color:#2B2E35;line-height:1.7;">
      Voici le bon de commande <strong>${d.poNumber}</strong>
      émis le <strong>${fmtDate(d.issueDate)}</strong>.
      ${d.deliveryDate ? `Livraison souhaitée le <strong>${fmtDate(d.deliveryDate)}</strong>.` : ""}
      ${d.reference ? `Votre référence : <strong>${d.reference}</strong>.` : ""}
    </p>

    

    ${amountBlock(d.subtotalHt, d.totalVat, d.totalTtc, d.accentColor)}

    ${d.notes ? notesBlock(d.notes) : ""}

    ${d.link ? ctaButton(d.link.mode === "sign" ? "Consulter et signer" : "Consulter en ligne", d.link.url.replace(/"/g, "&quot;"), d.accentColor) : ""}

    <p style="margin:30px 0 0;font-size:12.5px;color:#4F5257;line-height:1.55;">
      ${d.link?.mode === "sign"
        ? "Le bon de commande est joint à cet email en format PDF. Vous pouvez aussi le lire en entier et le signer en ligne pour confirmer la commande : ce lien vous est personnel."
        : "Le bon de commande est joint à cet email en format PDF. Pour confirmer la commande ou nous contacter, répondez simplement à cet email."}
    </p>

    <p style="margin:30px 0 0;font-size:14.5px;color:#2B2E35;line-height:1.65;">
      Cordialement,<br/>
      <strong style="color:#15171C;">${d.companyName}</strong>
    </p>
  `

  return {
    subject,
    html: emailBase({
      source: "email-commande",
      accentColor: d.accentColor,
      companyName: d.companyName,
      preheader:   `Bon de commande ${d.poNumber} — ${fmtEur(d.totalTtc)} TTC`,
      reference:   `N° ${d.poNumber}`,
      headline:    "Votre bon de commande,",
      headlineAccent: d.link?.mode === "sign" ? "à confirmer en ligne." : "joint à cet email.",
      body,
    }),
  }
}
