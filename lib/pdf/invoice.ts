/**
 * lib/pdf/invoice.ts
 * Génération PDF Factur-X pour les factures.
 * Réutilisé par la route GET /api/invoices/[id]/pdf ET par la route POST /send.
 *
 * Facture émise : PDF/A-3 avec le XML Factur-X (profil EN 16931) embarqué
 * (lib/facturx). Montants et mentions imprimés sont ceux que déclare le XML.
 * Brouillon ou aperçu : PDF simple filigrané, sans XML.
 */
import { PDFDocument, rgb, PageSizes, degrees } from "pdf-lib"
import fontkit from "@pdf-lib/fontkit"
import { buildFacturX, documentMentions } from "@/lib/facturx/xml"
import { invoiceToFacturX, type LineRecord } from "@/lib/facturx/records"
import { pdfSafeText, saveAsFacturX } from "@/lib/facturx/pdfa"
import { isAllowedLogoUrl } from "@/lib/utils/logo-url"
import path from "path"
import fs from "fs"

// ── Helpers ──────────────────────────────────────────────────────────────────

function hexToRgb(hex: string) {
  let h = (hex ?? "#2563EB").replace("#", "")
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
  return `${intPart},${parts[1]}\u00A0€`
}

/** Taux de TVA à la française : « 5,5 », « 20 ». */
function fmtRate(r: number): string {
  return String(Math.round(Number(r) * 100) / 100).replace(".", ",")
}

function fmtDate(d: string): string {
  try { return new Intl.DateTimeFormat("fr-FR").format(new Date(d)) }
  catch { return d }
}

// ── Types ─────────────────────────────────────────────────────────────────────

export interface InvoicePdfInput {
  invoice: {
    invoice_number: string
    issue_date: string
    due_date: string
    subtotal_ht: number
    total_vat: number
    total_ttc: number
    notes?: string | null
    /** Traitement de TVA du document, s'il est enregistré (voir lib/facturx/vat.ts). */
    vat_treatment?: string | null
    lines?: (LineRecord & {
      description: string
      quantity: number
      unit_price_ht: number
      vat_rate: number
      total_ht: number
      total_vat: number
      total_ttc: number
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
    legal_notice?: string
    email?: string
    accent_color?: string
    logo_url?: string
  } | null
  /**
   * Filigrane d'un document qui n'est pas une facture émise : « BROUILLON »
   * (facture pas encore émise) ou « APERÇU ». Sans lui, le PDF d'un brouillon
   * pourrait circuler comme une vraie facture, numéro compris, et contourner le
   * mur de paiement. Un PDF filigrané n'embarque pas non plus de XML Factur-X.
   * Jamais passé par la route d'envoi : envoyer, c'est émettre.
   */
  watermark?: "BROUILLON" | "APERÇU"
}

// ── Générateur principal ─────────────────────────────────────────────────────

export async function generateInvoicePdf({ invoice, company, watermark }: InvoicePdfInput): Promise<Uint8Array> {
  // Facture au modèle Factur-X : XML, montants et mentions viennent du même calcul
  const fxDoc = invoiceToFacturX(invoice, company)
  const fx = buildFacturX(fxDoc)
  const totals = fx.totals
  const extraMentions = documentMentions(fxDoc, totals)
  if (!watermark && fx.warnings.length) {
    console.warn(`[facturx] ${invoice.invoice_number} : ${fx.warnings.join(" | ")}`)
  }

  // PDF visuel
  const doc = await PDFDocument.create()
  doc.registerFontkit(fontkit)

  const fontsDir    = path.join(process.cwd(), "public", "fonts")
  // subset: true — n'embarque que les glyphes réellement utilisés au lieu des
  // ~515 Ko complets de chaque police, sur chaque PDF généré (aperçu, téléchargement, email).
  const fontRegular = await doc.embedFont(fs.readFileSync(path.join(fontsDir, "Roboto-Regular.ttf")), { subset: true })
  const fontBold    = await doc.embedFont(fs.readFileSync(path.join(fontsDir, "Roboto-Bold.ttf")), { subset: true })

  const page = doc.addPage(PageSizes.A4)
  const { width, height } = page.getSize()

  const accent    = hexToRgb(company?.accent_color ?? "#2563EB")
  const black     = rgb(0.06, 0.09, 0.17)
  const grayDark  = rgb(0.28, 0.34, 0.41)
  const grayLight = rgb(0.58, 0.64, 0.70)
  const rowAlt    = rgb(0.97, 0.98, 0.99)
  const separator = rgb(0.89, 0.91, 0.94)

  const mL = 48
  const mR = width - 48
  const cW = mR - mL

  const draw = (
    text: string, x: number, y: number,
    opts: { size?: number; bold?: boolean; color?: ReturnType<typeof rgb>; align?: "left" | "right" | "center"; maxWidth?: number } = {}
  ) => {
    const { size = 9, bold: isBold = false, color = black, align = "left", maxWidth } = opts
    const font = isBold ? fontBold : fontRegular
    // Aucun glyphe absent de la police (exigence PDF/A, et pas de carré à l'impression)
    const full = pdfSafeText(font, text ?? "")
    let str = full
    if (maxWidth) {
      while (str.length > 0 && font.widthOfTextAtSize(str, size) > maxWidth) str = str.slice(0, -1)
      if (str.length < full.length) str = str.slice(0, -1) + "…"
    }
    const tw = font.widthOfTextAtSize(str, size)
    const drawX = align === "right" ? x - tw : align === "center" ? x - tw / 2 : x
    page.drawText(str, { x: drawX, y, size, font, color })
  }

  const hLine = (y: number, x1 = mL, x2 = mR, thickness = 0.5, color = separator) =>
    page.drawLine({ start: { x: x1, y }, end: { x: x2, y }, thickness, color })

  const rect = (x: number, y: number, w: number, h: number, color: ReturnType<typeof rgb>) =>
    page.drawRectangle({ x, y, width: w, height: h, color })

  // Logo
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

  // HEADER
  let curY = height - 44
  const logoMaxH = 52, logoMaxW = 130
  if (logoImg) {
    const scale = Math.min(logoMaxW / logoImg.width, logoMaxH / logoImg.height, 1)
    page.drawImage(logoImg, { x: mL, y: curY - logoImg.height * scale + 4, width: logoImg.width * scale, height: logoImg.height * scale })
  } else {
    draw(company?.name ?? "Votre entreprise", mL, curY, { size: 16, bold: true, color: accent })
  }

  draw("FACTURE", mR, curY, { size: 22, bold: true, color: black, align: "right" })
  draw(invoice.invoice_number, mR, curY - 20, { size: 11, bold: true, color: accent, align: "right" })
  draw(`Émission : ${fmtDate(invoice.issue_date)}`, mR, curY - 36, { size: 8.5, color: grayDark, align: "right" })
  draw(`Échéance : ${fmtDate(invoice.due_date)}`,   mR, curY - 50, { size: 8.5, color: grayDark, align: "right" })

  // Pastille seulement quand le XML est réellement embarqué (jamais sur un brouillon)
  if (!watermark) {
    const badgeY = curY - 66
    rect(mR - 52, badgeY - 4, 52, 14, rgb(0.94, 0.97, 1.0))
    draw("Factur-X", mR - 6, badgeY + 2, { size: 7, bold: true, color: accent, align: "right" })
  }

  let infoY = curY - logoMaxH - 12
  if (company?.address)    { draw(company.address, mL, infoY, { size: 8.5, color: grayDark }); infoY -= 14 }
  const cityLine = [company?.zip_code, company?.city].filter(Boolean).join(" ")
  if (cityLine)            { draw(cityLine, mL, infoY, { size: 8.5, color: grayDark }); infoY -= 14 }
  if (company?.siret)      { draw(`SIRET : ${company.siret}`, mL, infoY, { size: 8, color: grayLight }); infoY -= 13 }
  else if (company?.siren) { draw(`SIREN : ${company.siren}`, mL, infoY, { size: 8, color: grayLight }); infoY -= 13 }
  if (company?.vat_number) { draw(`TVA : ${company.vat_number}`, mL, infoY, { size: 8, color: grayLight }) }

  const barY = height - 155
  rect(mL, barY, cW, 3, accent)

  // ÉMETTEUR / FACTURÉ À
  curY = barY - 20
  const col2  = mL + cW / 2 + 8
  const colW2 = cW / 2 - 8

  draw("ÉMETTEUR",  mL,   curY, { size: 7, bold: true, color: accent })
  draw("FACTURÉ À", col2, curY, { size: 7, bold: true, color: accent })
  curY -= 4
  hLine(curY, mL, mL + 80, 0.8, accent)
  hLine(curY, col2, col2 + 80, 0.8, accent)
  curY -= 13

  draw(company?.name ?? "—", mL,   curY, { size: 10, bold: true, color: black, maxWidth: colW2 })
  draw(invoice.client?.name ?? "—", col2, curY, { size: 10, bold: true, color: black, maxWidth: colW2 })
  curY -= 14

  if (company?.address || invoice.client?.address) {
    draw(company?.address ?? "", mL,   curY, { size: 8.5, color: grayDark, maxWidth: colW2 })
    draw(invoice.client?.address ?? "", col2, curY, { size: 8.5, color: grayDark, maxWidth: colW2 })
    curY -= 13
  }

  const compCity   = [company?.zip_code, company?.city].filter(Boolean).join(" ")
  const clientCity = [invoice.client?.zip_code, invoice.client?.city].filter(Boolean).join(" ")
  if (compCity || clientCity) {
    draw(compCity,   mL,   curY, { size: 8.5, color: grayDark })
    draw(clientCity, col2, curY, { size: 8.5, color: grayDark })
    curY -= 13
  }
  if (invoice.client?.email) draw(invoice.client.email, col2, curY, { size: 8, color: grayDark })
  if (company?.siret)        draw(`SIRET ${company.siret}`, mL, curY, { size: 7.5, color: grayLight })
  else if (company?.siren)   draw(`SIREN ${company.siren}`, mL, curY, { size: 7.5, color: grayLight })
  curY -= 13
  if (company?.vat_number || invoice.client?.siren) {
    if (company?.vat_number)    draw(`TVA ${company.vat_number}`, mL, curY, { size: 7.5, color: grayLight })
    if (invoice.client?.siren)  draw(`SIREN ${invoice.client.siren}`, col2, curY, { size: 7.5, color: grayLight })
    curY -= 13
  }
  curY -= 12

  // TABLEAU
  const colDesc = mL, colQty = mL + 250, colPU = mL + 300, colTVA = mL + 378, colTotal = mR
  const tableHeaderH = 20
  rect(mL, curY - 4, cW, tableHeaderH, rgb(0.95, 0.97, 1.00))
  draw("Désignation", colDesc,  curY + 4, { size: 7.5, bold: true, color: grayDark })
  draw("Qté",         colQty,   curY + 4, { size: 7.5, bold: true, color: grayDark, align: "right" })
  draw("P.U. HT",     colPU,    curY + 4, { size: 7.5, bold: true, color: grayDark, align: "right" })
  draw("TVA",         colTVA,   curY + 4, { size: 7.5, bold: true, color: grayDark, align: "right" })
  draw("Total HT",    colTotal, curY + 4, { size: 7.5, bold: true, color: grayDark, align: "right" })
  curY -= tableHeaderH + 2

  const lines = invoice.lines ?? []
  const rowH  = 18
  lines.forEach((line, i) => {
    if (i % 2 === 1) rect(mL, curY - 4, cW, rowH, rowAlt)
    draw(line.description,        colDesc,  curY + 2, { size: 8.5, color: black, maxWidth: 240 })
    draw(String(line.quantity),   colQty,   curY + 2, { size: 8.5, color: grayDark, align: "right" })
    draw(fmt(line.unit_price_ht), colPU,    curY + 2, { size: 8.5, color: grayDark, align: "right" })
    draw(`${fmtRate(line.vat_rate)} %`, colTVA, curY + 2, { size: 8.5, color: grayDark, align: "right" })
    draw(fmt(line.total_ht),      colTotal, curY + 2, { size: 8.5, bold: true, color: black, align: "right" })
    curY -= rowH
    hLine(curY + 2, mL, mR, 0.3, rgb(0.92, 0.93, 0.95))
  })
  curY -= 16

  // TOTAUX — ceux du XML Factur-X, calculés au centime depuis les lignes
  const totBlockW = 210, totX = mR - totBlockW, totValX = mR
  draw("Sous-total HT", totX, curY, { size: 8.5, color: grayDark })
  draw(fmt(totals.taxBasis), totValX, curY, { size: 8.5, color: black, align: "right" })
  curY -= 14
  // Plusieurs taux : base et TVA par taux (CGI, art. 242 nonies A)
  const vatRows = totals.breakdown.filter((b) => b.category === "S")
  if (vatRows.length > 1) {
    for (const b of vatRows) {
      draw(`TVA ${fmtRate(b.rate)} % sur ${fmt(b.base)}`, totX, curY, { size: 8.5, color: grayDark })
      draw(fmt(b.tax), totValX, curY, { size: 8.5, color: black, align: "right" })
      curY -= 14
    }
    curY += 6
  } else {
    draw(vatRows.length === 1 ? `TVA ${fmtRate(vatRows[0].rate)} %` : "TVA", totX, curY, { size: 8.5, color: grayDark })
    draw(fmt(totals.taxTotal), totValX, curY, { size: 8.5, color: black, align: "right" })
    curY -= 8
  }
  hLine(curY, totX, mR, 0.8, grayLight)
  curY -= 16
  hLine(curY, totX, mR, 1.5, accent)
  curY -= 14
  draw("TOTAL TTC",            totX,    curY, { size: 10, bold: true, color: accent })
  draw(fmt(totals.grandTotal), totValX, curY, { size: 14, bold: true, color: accent, align: "right" })
  curY -= 18

  if (company?.iban) {
    curY -= 8
    hLine(curY, totX, mR, 0.4, separator)
    curY -= 10
    draw("IBAN",       totX,    curY, { size: 7.5, color: grayLight })
    draw(company.iban, totValX, curY, { size: 7.5, color: grayDark, align: "right" })
    curY -= 14
  }
  curY -= 16

  // NOTES
  if (invoice.notes?.trim()) {
    rect(mL, curY - 2, 3, 28, accent)
    draw("CONDITIONS DE PAIEMENT / NOTES", mL + 10, curY + 14, { size: 7.5, bold: true, color: grayDark })
    invoice.notes.trim().split("\n").slice(0, 3).forEach((l: string) => {
      draw(l, mL + 10, curY, { size: 8, color: grayDark, maxWidth: cW - 20 })
      curY -= 13
    })
    curY -= 10
  }

  // MENTIONS LÉGALES — celles de l'entreprise, puis celles que le XML déclare en
  // plus (motif d'absence de TVA, conditions de règlement entre professionnels)
  const legalLines = [
    ...(company?.legal_notice?.trim() ? company.legal_notice.trim().split("\n").slice(0, 8) : []),
    ...extraMentions,
  ]
  if (legalLines.length) {
    hLine(curY, mL, mR, 0.5, separator)
    curY -= 12
    legalLines.forEach((l: string) => {
      const tw = Math.min(cW, fontRegular.widthOfTextAtSize(pdfSafeText(fontRegular, l), 7))
      draw(l, Math.max(mL, (width - tw) / 2), curY, { size: 7, color: grayLight, maxWidth: cW })
      curY -= 10
    })
  }

  // FOOTER
  hLine(32, mL, mR, 0.5, separator)
  draw(`${company?.name ?? "Qonforme"} — ${invoice.invoice_number}`, mL, 20, { size: 7, color: grayLight })
  draw("Généré par Qonforme", mR, 20, { size: 7, color: accent, align: "right" })

  // Filigrane (brouillon, aperçu) — dessiné en dernier pour rester au-dessus du contenu
  if (watermark) {
    const size = 92
    const tw   = fontBold.widthOfTextAtSize(watermark, size)
    const angle = 35 * Math.PI / 180
    page.drawText(watermark, {
      x: width / 2 - (tw / 2) * Math.cos(angle) + (size / 3) * Math.sin(angle),
      y: height / 2 - (tw / 2) * Math.sin(angle) - (size / 3) * Math.cos(angle),
      size,
      font: fontBold,
      color: rgb(0.86, 0.15, 0.15),
      opacity: 0.14,
      rotate: degrees(35),
    })
    const notice = watermark === "BROUILLON"
      ? "Brouillon : ce document n'est pas une facture émise."
      : "Aperçu : ce document n'est pas une facture émise."
    const nw = fontBold.widthOfTextAtSize(notice, 9)
    page.drawText(notice, { x: (width - nw) / 2, y: height - 24, size: 9, font: fontBold, color: rgb(0.73, 0.11, 0.11) })
  }

  const author = company?.name?.trim() || "Qonforme"

  // Brouillon ou aperçu : PDF simple, jamais de XML Factur-X
  if (watermark) {
    doc.setTitle(`${watermark === "BROUILLON" ? "Brouillon" : "Aperçu"} — facture ${invoice.invoice_number}`)
    doc.setAuthor(author)
    doc.setProducer("Qonforme (pdf-lib)")
    doc.setCreator("Qonforme")
    return doc.save()
  }

  // Facture émise : PDF/A-3 avec le XML embarqué
  return saveAsFacturX(doc, {
    xml:      fx.xml,
    title:    `Facture ${invoice.invoice_number}`,
    author,
    subject:  `Facture ${invoice.invoice_number}${invoice.client?.name ? ` — ${invoice.client.name}` : ""}`,
    keywords: ["facture", "Factur-X", invoice.invoice_number],
  })
}
