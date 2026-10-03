/**
 * Demande de libération de la retenue de garantie (formule Artisan).
 *
 * Ce n'est pas une facture : les sommes retenues ont déjà été facturées (le
 * total TTC des situations les comprend) ; la demande les réclame au client
 * à l'expiration du délai d'un an après la réception des travaux, sauf
 * opposition motivée notifiée par lettre recommandée (loi n° 71-584 du
 * 16 juillet 1971, art. 2 ;
 * https://www.legifrance.gouv.fr/loda/article_lc/LEGIARTI000006474230).
 *
 * PDF simple (pas de Factur-X : aucune facture n'est émise ici).
 */
import { PDFDocument, PageSizes, rgb } from "pdf-lib"
import fontkit from "@pdf-lib/fontkit"
import path from "path"
import fs from "fs"
import { pdfSafeText } from "@/lib/facturx/pdfa"
import { wrapText } from "@/lib/pdf/legal-lines"
import { longDateFr } from "@/lib/artisan/billing"
import { formatEurosFr, toCents } from "@/lib/artisan/money"
import { RETENTION_LAW, releaseDate } from "@/lib/artisan/retention"

export interface RetentionRequestInput {
  today: string
  company: { name?: string | null; address?: string | null; zip_code?: string | null; city?: string | null; siren?: string | null; email?: string | null; iban?: string | null }
  client: { name?: string | null; address?: string | null; zip_code?: string | null; city?: string | null } | null
  chantier: { name: string; address?: string | null; zip_code?: string | null; city?: string | null; reception_date: string | null }
  invoices: { number: string; issue_date: string; total_ttc: number; retention_amount: number }[]
}

export async function generateRetentionRequestPdf(input: RetentionRequestInput): Promise<Uint8Array> {
  const doc = await PDFDocument.create()
  doc.registerFontkit(fontkit)
  const fontsDir = path.join(process.cwd(), "public", "fonts")
  const regular = await doc.embedFont(fs.readFileSync(path.join(fontsDir, "Roboto-Regular.ttf")), { subset: true })
  const bold = await doc.embedFont(fs.readFileSync(path.join(fontsDir, "Roboto-Bold.ttf")), { subset: true })
  const page = doc.addPage(PageSizes.A4)
  const { width, height } = page.getSize()
  const mL = 56
  const mR = width - 56
  const cW = mR - mL
  const ink = rgb(0.06, 0.09, 0.17)
  const gray = rgb(0.33, 0.39, 0.46)
  const line = rgb(0.89, 0.91, 0.94)

  const draw = (text: string, x: number, y: number, o: { size?: number; bold?: boolean; color?: ReturnType<typeof rgb>; align?: "left" | "right" } = {}) => {
    const font = o.bold ? bold : regular
    const size = o.size ?? 10
    const t = pdfSafeText(font, text)
    const w = font.widthOfTextAtSize(t, size)
    page.drawText(t, { x: o.align === "right" ? x - w : x, y, size, font, color: o.color ?? ink })
  }
  const paragraph = (text: string, y: number, size = 10): number => {
    const lines = wrapText(text, (s) => regular.widthOfTextAtSize(pdfSafeText(regular, s), size), cW)
    for (const l of lines) { draw(l, mL, y, { size }); y -= size + 5 }
    return y - 6
  }

  let y = height - 64
  const c = input.company
  draw(c.name?.trim() || "Votre entreprise", mL, y, { size: 13, bold: true })
  y -= 16
  for (const l of [c.address, [c.zip_code, c.city].filter(Boolean).join(" "), c.siren ? `SIREN ${c.siren}` : null, c.email].filter(Boolean) as string[]) {
    draw(l, mL, y, { size: 9, color: gray }); y -= 12
  }

  let ry = height - 150
  const cl = input.client
  draw(cl?.name?.trim() || "Client", mR, ry, { size: 11, bold: true, align: "right" }); ry -= 14
  for (const l of [cl?.address, [cl?.zip_code, cl?.city].filter(Boolean).join(" ")].filter(Boolean) as string[]) {
    draw(l, mR, ry, { size: 9.5, color: gray, align: "right" }); ry -= 12
  }

  y = Math.min(y, ry) - 28
  draw(`Le ${longDateFr(input.today)}`, mR, y, { size: 9.5, color: gray, align: "right" })
  y -= 30
  draw("Objet : demande de libération de la retenue de garantie", mL, y, { size: 11, bold: true })
  y -= 15
  const site = [input.chantier.name, input.chantier.address, [input.chantier.zip_code, input.chantier.city].filter(Boolean).join(" ")].filter(Boolean).join(", ")
  draw(`Chantier : ${site}`, mL, y, { size: 9.5, color: gray })
  y -= 28

  const held = input.invoices.reduce((s, i) => s + toCents(i.retention_amount), 0)
  const release = releaseDate(input.chantier.reception_date)
  y = paragraph("Madame, Monsieur,", y)
  y = paragraph(
    `Une retenue de garantie a été pratiquée sur les factures de ce chantier, conformément à la ${RETENTION_LAW}. `
    + (input.chantier.reception_date
      ? `Les travaux ont été réceptionnés le ${longDateFr(input.chantier.reception_date)}. `
        + (release && release <= input.today
          ? `Le délai d'un an prévu par l'article 2 de la loi est expiré depuis le ${longDateFr(release)}.`
          : `Le délai d'un an prévu par l'article 2 de la loi expire le ${longDateFr(release ?? "")}.`)
      : "La date de réception des travaux reste à préciser."),
    y,
  )
  y = paragraph(
    release && release <= input.today
      ? `Sauf opposition motivée notifiée par lettre recommandée avant cette date, nous vous remercions de bien vouloir nous verser les sommes retenues, soit ${formatEurosFr(held)} TTC, détaillées ci-dessous.`
      : `Sauf opposition motivée notifiée par lettre recommandée d'ici là, nous vous remercions de bien vouloir nous verser à cette date les sommes retenues, soit ${formatEurosFr(held)} TTC, détaillées ci-dessous.`,
    y,
  )

  // Tableau
  y -= 4
  page.drawRectangle({ x: mL, y: y - 4, width: cW, height: 18, color: rgb(0.95, 0.97, 1) })
  draw("Facture", mL + 6, y + 2, { size: 8.5, bold: true, color: gray })
  draw("Date", mL + 170, y + 2, { size: 8.5, bold: true, color: gray })
  draw("Montant TTC", mR - 130, y + 2, { size: 8.5, bold: true, color: gray, align: "right" })
  draw("Retenue", mR - 6, y + 2, { size: 8.5, bold: true, color: gray, align: "right" })
  y -= 20
  for (const inv of input.invoices) {
    draw(inv.number, mL + 6, y, { size: 9.5 })
    draw(longDateFr(inv.issue_date), mL + 170, y, { size: 9.5, color: gray })
    draw(formatEurosFr(toCents(inv.total_ttc)), mR - 130, y, { size: 9.5, align: "right" })
    draw(formatEurosFr(toCents(inv.retention_amount)), mR - 6, y, { size: 9.5, align: "right" })
    y -= 6
    page.drawLine({ start: { x: mL, y }, end: { x: mR, y }, thickness: 0.5, color: line })
    y -= 12
  }
  draw("Total à libérer", mR - 130, y, { size: 10, bold: true, align: "right" })
  draw(formatEurosFr(held), mR - 6, y, { size: 10, bold: true, align: "right" })
  y -= 28

  if (c.iban) {
    y = paragraph(`Règlement par virement : IBAN ${c.iban.replace(/\s+/g, "").replace(/(.{4})/g, "$1 ").trim()}.`, y)
  }
  y = paragraph("Ce document n'est pas une facture : les sommes retenues figurent déjà dans le total des factures citées.", y, 9)
  y = paragraph("Nous vous prions d'agréer, Madame, Monsieur, nos salutations distinguées.", y)
  draw(c.name?.trim() || "", mL, y - 6, { size: 10, bold: true })

  page.drawLine({ start: { x: mL, y: 40 }, end: { x: mR, y: 40 }, thickness: 0.5, color: line })
  draw(`${c.name?.trim() || "Qonforme"} — demande de libération de la retenue de garantie`, mL, 28, { size: 7.5, color: gray })
  draw("Généré par Qonforme", mR, 28, { size: 7.5, color: gray, align: "right" })

  doc.setTitle(`Demande de libération de la retenue de garantie — ${input.chantier.name}`)
  doc.setAuthor(c.name?.trim() || "Qonforme")
  doc.setProducer("Qonforme (pdf-lib)")
  doc.setCreator("Qonforme")
  return doc.save()
}
