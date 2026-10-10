/**
 * lib/pdf/credit-note.ts
 * Génération PDF pour les avoirs.
 * Réutilisé par la route GET /api/credit-notes/[id]/pdf ET par la route POST /send.
 *
 * Un avoir est émis dès sa création (il n'a pas de brouillon) : PDF/A-3 avec le
 * XML Factur-X embarqué, type de document 381 et référence à la facture
 * d'origine (lib/facturx). Montants et mentions imprimés sont ceux du XML.
 */
import { PDFDocument, rgb, PageSizes } from "pdf-lib"
import { addUriLink } from "@/lib/pdf/link"
import { drawDivider, drawHeaderBand, drawLogoBacking, drawPartiesFill, drawTableHead, drawTotalBox, pdfTheme, templateOf } from "@/lib/pdf/theme"
import { poweredByUrl } from "@/lib/utils/powered-by"
import fontkit from "@pdf-lib/fontkit"
import { buildFacturX, documentMentions } from "@/lib/facturx/xml"
import { creditNoteToFacturX, type LineRecord } from "@/lib/facturx/records"
import { pdfSafeText, saveAsFacturX } from "@/lib/facturx/pdfa"
import { withDocumentMentions } from "@/lib/legal/mentions"
import { legalPdfLines } from "@/lib/pdf/legal-lines"
import { isAllowedLogoUrl } from "@/lib/utils/logo-url"
import path from "path"
import fs from "fs"

// ── Types ─────────────────────────────────────────────────────────────────────

export interface CreditNotePdfInput {
  creditNote: {
    credit_note_number: string
    issue_date: string
    reason: string
    subtotal_ht: number
    total_vat: number
    total_ttc: number
    notes?: string | null
    /** Traitement de TVA du document, s'il est enregistré (voir lib/facturx/vat.ts). */
    vat_treatment?: string | null
    /** Mentions figées à la création de l'avoir (lib/legal/mentions.ts). */
    legal_snapshot?: unknown
    lines?: (LineRecord & {
      description: string
      quantity: number
      unit_price_ht: number
      vat_rate: number
      total_ht: number
    })[]
    client?: {
      name?: string
      email?: string
      address?: string
      zip_code?: string
      city?: string
      country?: string
      siren?: string
      vat_number?: string
    } | null
    original_invoice?: {
      id?: string
      invoice_number?: string
      issue_date?: string
      total_ttc?: number
    } | null
  }
  company?: {
    name?: string
    siren?: string
    siret?: string
    vat_number?: string
    address?: string
    zip_code?: string
    city?: string
    country?: string
    iban?: string
    legal_notice?: string | null
    legal_profile?: unknown
    email?: string
    accent_color?: string
    logo_url?: string
  } | null
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function hexToRgb(hex: string) {
  let h = (hex ?? "#C2410C").replace("#", "")
  if (h.length === 3) h = h.split("").map((c) => c + c).join("") // "fff" → "ffffff"
  h = h.padEnd(6, "0").slice(0, 6)
  return rgb(
    parseInt(h.slice(0, 2), 16) / 255,
    parseInt(h.slice(2, 4), 16) / 255,
    parseInt(h.slice(4, 6), 16) / 255,
  )
}

function fmt(n: number): string {
  const parts = (Math.round(n * 100) / 100).toFixed(2).split(".")
  const intPart = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, "\u00A0")
  return `${intPart},${parts[1]}\u00A0EUR`
}

/** Taux de TVA à la française : « 5,5 », « 20 ». */
function fmtRate(r: number): string {
  return String(Math.round(Number(r) * 100) / 100).replace(".", ",")
}

function fmtDate(d: string): string {
  try { return new Intl.DateTimeFormat("fr-FR").format(new Date(d)) }
  catch { return d }
}

// ── Générateur principal ─────────────────────────────────────────────────────

export async function generateCreditNotePdf({ creditNote, company: companyInput }: CreditNotePdfInput): Promise<Buffer> {
  // Mentions de l'entreprise figées à la création de l'avoir (lib/legal/mentions.ts)
  const company = withDocumentMentions(companyInput, creditNote, "credit_note")
  // Avoir au modèle Factur-X : XML, montants et mentions viennent du même calcul
  const fxDoc = creditNoteToFacturX(creditNote, company)
  const fx = buildFacturX(fxDoc)
  const totals = fx.totals
  const extraMentions = documentMentions(fxDoc, totals)
  if (fx.warnings.length) console.warn(`[facturx] ${creditNote.credit_note_number} : ${fx.warnings.join(" | ")}`)

  const doc = await PDFDocument.create()
  doc.registerFontkit(fontkit)

  const fontsDir     = path.join(process.cwd(), "public", "fonts")
  const regularBytes = fs.readFileSync(path.join(fontsDir, "Roboto-Regular.ttf"))
  const boldBytes    = fs.readFileSync(path.join(fontsDir, "Roboto-Bold.ttf"))
  const fontRegular  = await doc.embedFont(regularBytes, { subset: true })
  const fontBold     = await doc.embedFont(boldBytes, { subset: true })

  const page = doc.addPage(PageSizes.A4)
  const { width, height } = page.getSize()

  const accentCompany = hexToRgb(company?.accent_color ?? "#C2410C")
  const creditOrange  = rgb(0.76, 0.25, 0.05)
  const black         = rgb(0.06, 0.09, 0.17)
  const grayDark      = rgb(0.28, 0.34, 0.41)
  const grayLight     = rgb(0.58, 0.64, 0.70)
  const rowAlt        = rgb(0.99, 0.97, 0.96)
  const separator     = rgb(0.89, 0.91, 0.94)

  const mL = 48; const mR = width - 48; const cW = mR - mL

  const draw = (text: string, x: number, y: number, opts: {
    size?: number; bold?: boolean; color?: ReturnType<typeof rgb>
    align?: "left" | "right" | "center"; maxWidth?: number
  } = {}) => {
    const { size = 9, bold: isBold = false, color = black, align = "left", maxWidth } = opts
    const font = isBold ? fontBold : fontRegular
    // Aucun glyphe absent de la police (exigence PDF/A, et pas de carré à l'impression)
    const full = pdfSafeText(font, text ?? "")
    let str = full
    if (maxWidth) {
      while (str.length > 0 && font.widthOfTextAtSize(str, size) > maxWidth)
        str = str.slice(0, -1)
      if (str.length < full.length) str = str.slice(0, -1) + "..."
    }
    const tw = font.widthOfTextAtSize(str, size)
    const drawX = align === "right" ? x - tw : align === "center" ? x - tw / 2 : x
    page.drawText(str, { x: drawX, y, size, font, color })
  }

  const hLine = (y: number, x1 = mL, x2 = mR, thickness = 0.5, color = separator) =>
    page.drawLine({ start: { x: x1, y }, end: { x: x2, y }, thickness, color })

  const rect = (x: number, y: number, w: number, h: number, color: ReturnType<typeof rgb>) =>
    page.drawRectangle({ x, y, width: w, height: h, color })

  // ── Logo ─────────────────────────────────────────────────────────────────
  let logoImg: Awaited<ReturnType<typeof doc.embedPng>> | null = null
  if (company?.logo_url && isAllowedLogoUrl(company.logo_url)) {
    try {
      const res = await fetch(company.logo_url)
      if (res.ok) {
        const bytes = await res.arrayBuffer()
        const ct = res.headers.get("content-type") ?? ""
        if (ct.includes("png") || company.logo_url.toLowerCase().includes(".png")) {
          logoImg = await doc.embedPng(bytes)
        } else {
          try { logoImg = await doc.embedJpg(bytes) } catch { logoImg = null }
        }
      }
    } catch { logoImg = null }
  }

  // ── HEADER ───────────────────────────────────────────────────────────────
  // Modèle de mise en page (Paramètres › Modèles de documents) ; Classique = rendu d'avant
  const theme = pdfTheme(templateOf(company, "credit_note"), {
    docColor: creditOrange, classicTitle: creditOrange, classicHeadFill: rgb(0.99, 0.97, 0.95), brand: accentCompany,
  })
  const barY = height - 155
  drawHeaderBand(page, theme, barY - 8)

  let curY = height - 44
  const logoMaxH = 52; const logoMaxW = 130

  if (logoImg) {
    const scale = Math.min(logoMaxW / logoImg.width, logoMaxH / logoImg.height, 1)
    const lw = logoImg.width * scale; const lh = logoImg.height * scale
    const logoBox = { x: mL, y: curY - lh + 4, width: lw, height: lh }
    drawLogoBacking(page, theme, logoBox)
    page.drawImage(logoImg, logoBox)
  } else {
    draw(company?.name ?? "Votre entreprise", mL, curY, { size: 16, bold: true, color: theme.band ? theme.head.text : theme.id === "classique" ? accentCompany : theme.primary })
  }

  draw("AVOIR", mR, curY, { size: 22, bold: true, color: theme.title, align: "right" })
  draw(creditNote.credit_note_number, mR, curY - 20, { size: 11, bold: true, color: theme.head.number, align: "right" })
  draw(`Émis le : ${fmtDate(creditNote.issue_date)}`, mR, curY - 36, { size: 8.5, color: theme.head.sub, align: "right" })

  if (creditNote.original_invoice) {
    const original = creditNote.original_invoice
    draw(
      `Avoir sur la facture ${original.invoice_number}${original.issue_date ? ` du ${fmtDate(original.issue_date)}` : ""}`,
      mR, curY - 50, { size: 8, color: theme.head.sub, align: "right" }
    )
  }

  let infoY = curY - logoMaxH - 12
  if (company?.address)    { draw(company.address, mL, infoY, { size: 8.5, color: theme.head.sub }); infoY -= 14 }
  const cityLine = [company?.zip_code, company?.city].filter(Boolean).join(" ")
  if (cityLine)            { draw(cityLine, mL, infoY, { size: 8.5, color: theme.head.sub }); infoY -= 14 }
  if (company?.siret)      { draw(`SIRET : ${company.siret}`, mL, infoY, { size: 8, color: theme.head.faint }); infoY -= 13 }
  else if (company?.siren) { draw(`SIREN : ${company.siren}`, mL, infoY, { size: 8, color: theme.head.faint }); infoY -= 13 }
  if (company?.vat_number) { draw(`TVA : ${company.vat_number}`, mL, infoY, { size: 8, color: theme.head.faint }) }

  drawDivider(page, theme, mL, cW, barY)

  // ── ÉMETTEUR / FACTURÉ À ─────────────────────────────────────────────────
  curY = barY - 20
  const col2 = mL + cW / 2 + 8; const colW2 = cW / 2 - 8

  // Fond des parties (modèle Moderne) : hauteur calculée comme les lignes ci-dessous
  {
    let y = curY - 4 - 13 - 14
    if (company?.address || creditNote.client?.address) y -= 13
    if ([company?.zip_code, company?.city, creditNote.client?.zip_code, creditNote.client?.city].some(Boolean)) y -= 13
    y -= 13
    if (company?.vat_number || creditNote.client?.siren) y -= 13
    drawPartiesFill(page, theme, mL, cW, barY - 8, y + 6)
  }
  draw("ÉMETTEUR",  mL,   curY, { size: 7, bold: true, color: theme.primary })
  draw("FACTURÉ À", col2, curY, { size: 7, bold: true, color: theme.primary })
  curY -= 4
  hLine(curY, mL, mL + 80, 0.8, theme.primary)
  hLine(curY, col2, col2 + 80, 0.8, theme.primary)
  curY -= 13

  draw(company?.name ?? "—",                mL,   curY, { size: 10, bold: true, color: black, maxWidth: colW2 })
  draw(creditNote.client?.name ?? "—",      col2, curY, { size: 10, bold: true, color: black, maxWidth: colW2 })
  curY -= 14

  if (company?.address || creditNote.client?.address) {
    draw(company?.address ?? "",                mL,   curY, { size: 8.5, color: grayDark, maxWidth: colW2 })
    draw(creditNote.client?.address ?? "",      col2, curY, { size: 8.5, color: grayDark, maxWidth: colW2 })
    curY -= 13
  }

  const compCity   = [company?.zip_code, company?.city].filter(Boolean).join(" ")
  const clientCity = [creditNote.client?.zip_code, creditNote.client?.city].filter(Boolean).join(" ")
  if (compCity || clientCity) {
    draw(compCity,   mL,   curY, { size: 8.5, color: grayDark })
    draw(clientCity, col2, curY, { size: 8.5, color: grayDark })
    curY -= 13
  }

  if (creditNote.client?.email) draw(creditNote.client.email, col2, curY, { size: 8, color: grayDark })
  if (company?.siret)           draw(`SIRET ${company.siret}`, mL, curY, { size: 7.5, color: grayLight })
  else if (company?.siren)      draw(`SIREN ${company.siren}`, mL, curY, { size: 7.5, color: grayLight })
  curY -= 13

  if (company?.vat_number || creditNote.client?.siren) {
    if (company?.vat_number)          draw(`TVA ${company.vat_number}`, mL, curY, { size: 7.5, color: grayLight })
    if (creditNote.client?.siren)     draw(`SIREN ${creditNote.client.siren}`, col2, curY, { size: 7.5, color: grayLight })
    curY -= 13
  }

  // Motif de l'avoir
  curY -= 4
  draw("MOTIF DE L'AVOIR", mL, curY, { size: 7, bold: true, color: theme.primary })
  curY -= 12
  draw(creditNote.reason ?? "", mL, curY, { size: 8.5, color: grayDark, maxWidth: cW })
  curY -= 20

  // ── TABLEAU DES LIGNES ───────────────────────────────────────────────────
  const colDesc = mL; const colQty = mL + 250; const colPU = mL + 300
  const colTVA  = mL + 378; const colTotal = mR; const tableHeaderH = 20

  drawTableHead(page, theme, mL, curY - 4, cW, tableHeaderH)
  draw("Désignation", colDesc,  curY + 4, { size: 7.5, bold: true, color: theme.tableHead.text })
  draw("Qté",         colQty,   curY + 4, { size: 7.5, bold: true, color: theme.tableHead.text, align: "right" })
  draw("P.U. HT",     colPU,    curY + 4, { size: 7.5, bold: true, color: theme.tableHead.text, align: "right" })
  draw("TVA",         colTVA,   curY + 4, { size: 7.5, bold: true, color: theme.tableHead.text, align: "right" })
  draw("Total HT",    colTotal, curY + 4, { size: 7.5, bold: true, color: theme.tableHead.text, align: "right" })
  curY -= tableHeaderH + 2

  const lines: { description: string; quantity: number; unit_price_ht: number; vat_rate: number; total_ht: number }[]
    = creditNote.lines ?? []

  const rowH = 18
  lines.forEach((line, i) => {
    if (i % 2 === 1) rect(mL, curY - 4, cW, rowH, rowAlt)
    draw(line.description,           colDesc,  curY + 2, { size: 8.5, color: black,       maxWidth: 240 })
    draw(String(line.quantity),      colQty,   curY + 2, { size: 8.5, color: grayDark,    align: "right" })
    draw(fmt(line.unit_price_ht),    colPU,    curY + 2, { size: 8.5, color: grayDark,    align: "right" })
    draw(`${fmtRate(line.vat_rate)} %`, colTVA, curY + 2, { size: 8.5, color: grayDark,   align: "right" })
    draw(`-${fmt(line.total_ht)}`,   colTotal, curY + 2, { size: 8.5, bold: true, color: theme.primary, align: "right" })
    curY -= rowH
    hLine(curY + 2, mL, mR, 0.3, rgb(0.92, 0.93, 0.95))
  })
  curY -= 16

  // ── TOTAUX — ceux du XML Factur-X, calculés au centime depuis les lignes ──
  const totBlockW = 210; const totX = mR - totBlockW; const totValX = mR

  draw("Sous-total HT", totX, curY, { size: 8.5, color: grayDark })
  draw(`-${fmt(totals.taxBasis)}`, totValX, curY, { size: 8.5, color: grayDark, align: "right" })
  curY -= 14

  // Plusieurs taux : base et TVA par taux (CGI, art. 242 nonies A)
  const vatRows = totals.breakdown.filter((b) => b.category === "S")
  if (vatRows.length > 1) {
    for (const b of vatRows) {
      draw(`TVA ${fmtRate(b.rate)} % sur ${fmt(b.base)}`, totX, curY, { size: 8.5, color: grayDark })
      draw(`-${fmt(b.tax)}`, totValX, curY, { size: 8.5, color: grayDark, align: "right" })
      curY -= 14
    }
    curY += 6
  } else {
    draw(vatRows.length === 1 ? `TVA ${fmtRate(vatRows[0].rate)} %` : "TVA", totX, curY, { size: 8.5, color: grayDark })
    draw(`-${fmt(totals.taxTotal)}`, totValX, curY, { size: 8.5, color: grayDark, align: "right" })
    curY -= 8
  }
  hLine(curY, totX, mR, 0.8, grayLight)
  curY -= 16

  curY -= 14
  drawTotalBox(page, theme, totX, mR - totX, curY)
  draw("TOTAL AVOIR TTC",              totX,    curY, { size: 10, bold: true, color: theme.total.text })
  draw(`-${fmt(totals.grandTotal)}`, totValX, curY, { size: 14, bold: true, color: theme.total.text, align: "right" })
  curY -= 24

  // ── MENTIONS LÉGALES — de l'entreprise, puis celles que déclare le XML ─────
  const measure7 = (l: string) => fontRegular.widthOfTextAtSize(pdfSafeText(fontRegular, l), 7)
  const legalLines = legalPdfLines([...(company?.legal_notice ?? "").split("\n"), ...extraMentions], measure7, cW)
  if (legalLines.length) {
    hLine(curY, mL, mR, 0.5, separator); curY -= 12
    legalLines.forEach((l: string) => {
      const tw = Math.min(cW, measure7(l))
      draw(l, Math.max(mL, (width - tw) / 2), curY, { size: 7, color: grayLight, maxWidth: cW }); curY -= 10
    })
  }

  // ── FOOTER ───────────────────────────────────────────────────────────────
  hLine(32, mL, mR, 0.5, separator)
  draw(`${company?.name ?? "Qonforme"} — ${creditNote.credit_note_number}`, mL, 20, { size: 7, color: grayLight })
  draw("Généré par Qonforme", mR, 20, { size: 7, color: theme.primary, align: "right" })
  {
    // « Propulsé par Qonforme » cliquable, avec sa provenance (lib/utils/powered-by.ts)
    const tw = fontRegular.widthOfTextAtSize("Généré par Qonforme", 7)
    addUriLink(doc, page, { x: mR - tw, y: 18, width: tw, height: 9 }, poweredByUrl("pdf-avoir"))
  }

  // PDF/A-3 avec le XML Factur-X de l'avoir embarqué
  const pdfBytes = await saveAsFacturX(doc, {
    xml:      fx.xml,
    title:    `Avoir ${creditNote.credit_note_number}`,
    author:   company?.name?.trim() || "Qonforme",
    subject:  `Avoir ${creditNote.credit_note_number}${creditNote.original_invoice?.invoice_number ? ` sur la facture ${creditNote.original_invoice.invoice_number}` : ""}`,
    keywords: ["avoir", "Factur-X", creditNote.credit_note_number],
  })
  return Buffer.from(pdfBytes)
}
