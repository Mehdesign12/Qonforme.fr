/**
 * lib/pdf/purchase-order.ts
 * Génération PDF pour les bons de commande.
 * Couleur identitaire : bleu indigo (#4F46E5)
 * Réutilisé par GET /api/purchase-orders/[id]/pdf ET POST /send.
 */
import { PDFDocument, rgb, PageSizes } from "pdf-lib"
import fontkit from "@pdf-lib/fontkit"
import path from "path"
import fs from "fs"

// ── Types ─────────────────────────────────────────────────────────────────────

export interface PurchaseOrderPdfInput {
  po: {
    po_number:     string
    issue_date:    string
    delivery_date?: string | null
    reference?:    string | null
    subtotal_ht:   number
    total_vat:     number
    total_ttc:     number
    notes?:        string | null
    lines?: {
      description:   string
      quantity:      number
      unit_price_ht: number
      vat_rate:      number
      total_ht:      number
    }[]
    client?: {
      name?:     string
      email?:    string
      address?:  string
      zip_code?: string
      city?:     string
      siren?:    string
      vat_number?: string
    } | null
  }
  company?: {
    name?:         string
    siren?:        string
    siret?:        string
    vat_number?:   string
    address?:      string
    zip_code?:     string
    city?:         string
    iban?:         string
    legal_notice?: string
    accent_color?: string
    logo_url?:     string
  } | null
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function hexToRgb(hex: string) {
  const h = (hex ?? "#4F46E5").replace("#", "").padEnd(6, "0")
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

function fmtDate(d: string): string {
  try { return new Intl.DateTimeFormat("fr-FR").format(new Date(d)) }
  catch { return d }
}

// ── Générateur principal ─────────────────────────────────────────────────────

export async function generatePurchaseOrderPdf({ po, company }: PurchaseOrderPdfInput): Promise<Buffer> {
  const doc = await PDFDocument.create()
  doc.registerFontkit(fontkit)

  const fontsDir    = path.join(process.cwd(), "public", "fonts")
  const fontRegular = await doc.embedFont(fs.readFileSync(path.join(fontsDir, "Roboto-Regular.ttf")))
  const fontBold    = await doc.embedFont(fs.readFileSync(path.join(fontsDir, "Roboto-Bold.ttf")))

  const page              = doc.addPage(PageSizes.A4)
  const { width, height } = page.getSize()

  // Couleur accent de l'entreprise (fallback bleu indigo pour les BdC)
  const accent    = hexToRgb(company?.accent_color ?? "#4F46E5")
  const poBlue    = rgb(0.31, 0.27, 0.90)   // #4F46E5 — couleur identitaire BdC
  const black     = rgb(0.06, 0.09, 0.17)
  const grayDark  = rgb(0.28, 0.34, 0.41)
  const grayLight = rgb(0.58, 0.64, 0.70)
  const rowAlt    = rgb(0.97, 0.97, 1.00)   // légèrement bleuté
  const separator = rgb(0.89, 0.91, 0.94)

  const mL = 48; const mR = width - 48; const cW = mR - mL

  // ── Helpers de dessin ───────────────────────────────────────────────────
  const draw = (text: string, x: number, y: number, opts: {
    size?: number; bold?: boolean; color?: ReturnType<typeof rgb>
    align?: "left" | "right" | "center"; maxWidth?: number
  } = {}) => {
    const { size = 9, bold: isBold = false, color = black, align = "left", maxWidth } = opts
    const font = isBold ? fontBold : fontRegular
    let str = text ?? ""
    if (maxWidth) {
      while (str.length > 0 && font.widthOfTextAtSize(str, size) > maxWidth)
        str = str.slice(0, -1)
      if (str.length < (text ?? "").length) str = str.slice(0, -1) + "..."
    }
    const tw   = font.widthOfTextAtSize(str, size)
    const drawX = align === "right" ? x - tw : align === "center" ? x - tw / 2 : x
    page.drawText(str, { x: drawX, y, size, font, color })
  }

  const hLine = (y: number, x1 = mL, x2 = mR, t = 0.5, c = separator) =>
    page.drawLine({ start: { x: x1, y }, end: { x: x2, y }, thickness: t, color: c })

  const rect = (x: number, y: number, w: number, h: number, c: ReturnType<typeof rgb>) =>
    page.drawRectangle({ x, y, width: w, height: h, color: c })

  // ── Logo ──────────────────────────────────────────────────────────────
  let logoImg: Awaited<ReturnType<typeof doc.embedPng>> | null = null
  if (company?.logo_url) {
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

  // ── HEADER ────────────────────────────────────────────────────────────
  let curY = height - 44
  const logoMaxH = 52; const logoMaxW = 130

  if (logoImg) {
    const scale = Math.min(logoMaxW / logoImg.width, logoMaxH / logoImg.height, 1)
    page.drawImage(logoImg, {
      x: mL, y: curY - logoImg.height * scale + 4,
      width: logoImg.width * scale, height: logoImg.height * scale,
    })
  } else {
    draw(company?.name ?? "Votre entreprise", mL, curY, { size: 16, bold: true, color: accent })
  }

  // Titre + numéro à droite
  draw("BON DE COMMANDE", mR, curY,      { size: 18, bold: true, color: poBlue, align: "right" })
  draw(po.po_number,       mR, curY - 20, { size: 11, bold: true, color: poBlue, align: "right" })
  draw(`Émis le : ${fmtDate(po.issue_date)}`, mR, curY - 36, { size: 8.5, color: grayDark, align: "right" })
  if (po.delivery_date) {
    draw(`Livraison souhaitée : ${fmtDate(po.delivery_date)}`, mR, curY - 50, { size: 8.5, color: grayDark, align: "right" })
  }
  if (po.reference) {
    draw(`Réf. client : ${po.reference}`, mR, curY - (po.delivery_date ? 64 : 50), { size: 8, color: grayDark, align: "right" })
  }

  // Infos entreprise sous le logo
  let infoY = curY - logoMaxH - 12
  if (company?.address)    { draw(company.address, mL, infoY, { size: 8.5, color: grayDark }); infoY -= 14 }
  const cityLine = [company?.zip_code, company?.city].filter(Boolean).join(" ")
  if (cityLine)            { draw(cityLine, mL, infoY, { size: 8.5, color: grayDark }); infoY -= 14 }
  if (company?.siret)      { draw(`SIRET : ${company.siret}`, mL, infoY, { size: 8, color: grayLight }); infoY -= 13 }
  else if (company?.siren) { draw(`SIREN : ${company.siren}`, mL, infoY, { size: 8, color: grayLight }); infoY -= 13 }
  if (company?.vat_number) { draw(`TVA : ${company.vat_number}`, mL, infoY, { size: 8, color: grayLight }) }

  // Barre de couleur horizontale
  const barY = height - 155
  rect(mL, barY, cW, 3, poBlue)

  // ── ÉMETTEUR / DESTINATAIRE ───────────────────────────────────────────
  curY = barY - 20
  const col2 = mL + cW / 2 + 8; const colW2 = cW / 2 - 8

  draw("ÉMETTEUR",     mL,   curY, { size: 7, bold: true, color: poBlue })
  draw("DESTINATAIRE", col2, curY, { size: 7, bold: true, color: poBlue })
  curY -= 4
  hLine(curY, mL,   mL   + 80, 0.8, poBlue)
  hLine(curY, col2, col2 + 80, 0.8, poBlue)
  curY -= 13

  draw(company?.name ?? "—",      mL,   curY, { size: 10, bold: true, color: black, maxWidth: colW2 })
  draw(po.client?.name ?? "—",    col2, curY, { size: 10, bold: true, color: black, maxWidth: colW2 })
  curY -= 14

  if (company?.address || po.client?.address) {
    draw(company?.address ?? "",   mL,   curY, { size: 8.5, color: grayDark, maxWidth: colW2 })
    draw(po.client?.address ?? "", col2, curY, { size: 8.5, color: grayDark, maxWidth: colW2 })
    curY -= 13
  }

  const compCity   = [company?.zip_code, company?.city].filter(Boolean).join(" ")
  const clientCity = [po.client?.zip_code, po.client?.city].filter(Boolean).join(" ")
  if (compCity || clientCity) {
    draw(compCity,   mL,   curY, { size: 8.5, color: grayDark })
    draw(clientCity, col2, curY, { size: 8.5, color: grayDark })
    curY -= 13
  }

  if (po.client?.email)  draw(po.client.email,  col2, curY, { size: 8,   color: grayDark })
  if (company?.siret)    draw(`SIRET ${company.siret}`,  mL, curY, { size: 7.5, color: grayLight })
  else if (company?.siren) draw(`SIREN ${company.siren}`, mL, curY, { size: 7.5, color: grayLight })
  curY -= 13

  if (company?.vat_number || po.client?.siren) {
    if (company?.vat_number)  draw(`TVA ${company.vat_number}`, mL,   curY, { size: 7.5, color: grayLight })
    if (po.client?.siren)     draw(`SIREN ${po.client.siren}`,  col2, curY, { size: 7.5, color: grayLight })
    curY -= 13
  }
  curY -= 12

  // ── TABLEAU LIGNES ────────────────────────────────────────────────────
  const colDesc = mL; const colQty = mL + 250; const colPU = mL + 300
  const colTVA  = mL + 378; const colTotal = mR; const tableHeaderH = 20

  rect(mL, curY - 4, cW, tableHeaderH, rgb(0.94, 0.94, 0.99))
  draw("Désignation", colDesc,  curY + 4, { size: 7.5, bold: true, color: grayDark })
  draw("Qté",         colQty,   curY + 4, { size: 7.5, bold: true, color: grayDark, align: "right" })
  draw("P.U. HT",     colPU,    curY + 4, { size: 7.5, bold: true, color: grayDark, align: "right" })
  draw("TVA",         colTVA,   curY + 4, { size: 7.5, bold: true, color: grayDark, align: "right" })
  draw("Total HT",    colTotal, curY + 4, { size: 7.5, bold: true, color: grayDark, align: "right" })
  curY -= tableHeaderH + 2

  const lines = po.lines ?? []
  const rowH = 18
  lines.forEach((line, i) => {
    if (i % 2 === 1) rect(mL, curY - 4, cW, rowH, rowAlt)
    draw(line.description,        colDesc,  curY + 2, { size: 8.5, color: black,    maxWidth: 240 })
    draw(String(line.quantity),   colQty,   curY + 2, { size: 8.5, color: grayDark, align: "right" })
    draw(fmt(line.unit_price_ht), colPU,    curY + 2, { size: 8.5, color: grayDark, align: "right" })
    draw(`${line.vat_rate} %`,    colTVA,   curY + 2, { size: 8.5, color: grayDark, align: "right" })
    draw(fmt(line.total_ht),      colTotal, curY + 2, { size: 8.5, bold: true, color: black, align: "right" })
    curY -= rowH
    hLine(curY + 2, mL, mR, 0.3, rgb(0.92, 0.93, 0.95))
  })
  curY -= 16

  // ── TOTAUX ────────────────────────────────────────────────────────────
  const totBlockW = 210; const totX = mR - totBlockW; const totValX = mR

  draw("Sous-total HT",    totX, curY, { size: 8.5, color: grayDark })
  draw(fmt(po.subtotal_ht), totValX, curY, { size: 8.5, color: black, align: "right" })
  curY -= 14

  draw("TVA",               totX, curY, { size: 8.5, color: grayDark })
  draw(fmt(po.total_vat),   totValX, curY, { size: 8.5, color: black, align: "right" })
  curY -= 8
  hLine(curY, totX, mR, 0.8, grayLight)
  curY -= 16

  hLine(curY, totX, mR, 1.5, poBlue)
  curY -= 14
  draw("TOTAL TTC",       totX,    curY, { size: 10, bold: true, color: poBlue })
  draw(fmt(po.total_ttc), totValX, curY, { size: 14, bold: true, color: poBlue, align: "right" })
  curY -= 24

  // ── NOTES ─────────────────────────────────────────────────────────────
  if (po.notes?.trim()) {
    rect(mL, curY - 2, 3, 28, poBlue)
    draw("NOTES / CONDITIONS", mL + 10, curY + 14, { size: 7.5, bold: true, color: grayDark })
    po.notes.trim().split("\n").slice(0, 3).forEach((l: string) => {
      draw(l, mL + 10, curY, { size: 8, color: grayDark, maxWidth: cW - 20 }); curY -= 13
    })
    curY -= 10
  }

  // ── MENTIONS LÉGALES ─────────────────────────────────────────────────
  if (company?.legal_notice?.trim()) {
    hLine(curY, mL, mR, 0.5, separator); curY -= 12
    company.legal_notice.trim().split("\n").slice(0, 4).forEach((l: string) => {
      const tw = fontRegular.widthOfTextAtSize(l, 7)
      draw(l, Math.max(mL, (width - tw) / 2), curY, { size: 7, color: grayLight }); curY -= 10
    })
  }

  // ── FOOTER ────────────────────────────────────────────────────────────
  hLine(32, mL, mR, 0.5, separator)
  draw(`${company?.name ?? "Qonforme"} — ${po.po_number}`, mL, 20, { size: 7, color: grayLight })
  draw("Généré par Qonforme", mR, 20, { size: 7, color: poBlue, align: "right" })

  const pdfBytes = await doc.save()
  return Buffer.from(pdfBytes)
}
