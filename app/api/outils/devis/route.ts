import { NextRequest, NextResponse } from "next/server"
import { PDFDocument, rgb, PageSizes } from "pdf-lib"
import fontkit from "@pdf-lib/fontkit"
import path from "path"
import fs from "fs"

function fmt(n: number): string {
  const parts = (Math.round(n * 100) / 100).toFixed(2).split(".")
  const intPart = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, "\u00A0")
  return `${intPart},${parts[1]}\u00A0\u20AC`
}

function fmtDate(d: string): string {
  try { return new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "long", year: "numeric" }).format(new Date(d)) }
  catch { return d }
}

function truncate(t: string, max: number): string { return t.length > max ? t.slice(0, max - 1) + "…" : t }

interface DevisInput {
  emetteur: { nom: string; adresse?: string; siret?: string; email?: string }
  client: { nom: string; adresse?: string }
  numero: string; date: string; validite: string
  lignes: { description: string; quantite: number; prixHT: number; tauxTVA: number }[]
  notes?: string
}

export async function POST(request: NextRequest) {
  let input: DevisInput
  try { input = await request.json() } catch { return NextResponse.json({ error: "Données invalides" }, { status: 400 }) }
  if (!input.emetteur?.nom || !input.client?.nom || !input.lignes?.length) {
    return NextResponse.json({ error: "Émetteur, client et lignes requis" }, { status: 400 })
  }

  const lignes = input.lignes.slice(0, 20)
  const doc = await PDFDocument.create()
  doc.registerFontkit(fontkit)
  const fontsDir = path.join(process.cwd(), "public", "fonts")
  const fontRegular = await doc.embedFont(fs.readFileSync(path.join(fontsDir, "Roboto-Regular.ttf")))
  const fontBold = await doc.embedFont(fs.readFileSync(path.join(fontsDir, "Roboto-Bold.ttf")))

  const page = doc.addPage(PageSizes.A4)
  const { width, height } = page.getSize()
  const accent = rgb(0.15, 0.39, 0.92) // #2563EB
  const black = rgb(0.06, 0.09, 0.17)
  const gray = rgb(0.28, 0.34, 0.41)
  const lightGray = rgb(0.57, 0.63, 0.7)
  const bgLight = rgb(0.96, 0.97, 0.98)
  const margin = 50
  let y = height - margin

  // Header
  page.drawText(truncate(input.emetteur.nom, 40), { x: margin, y, size: 18, font: fontBold, color: accent })
  y -= 16
  if (input.emetteur.adresse) { page.drawText(truncate(input.emetteur.adresse, 60), { x: margin, y, size: 9, font: fontRegular, color: gray }); y -= 12 }
  if (input.emetteur.siret) { page.drawText(`SIRET : ${input.emetteur.siret}`, { x: margin, y, size: 9, font: fontRegular, color: gray }); y -= 12 }
  if (input.emetteur.email) { page.drawText(input.emetteur.email, { x: margin, y, size: 9, font: fontRegular, color: gray }); y -= 12 }

  y -= 10
  page.drawText("DEVIS", { x: margin, y, size: 24, font: fontBold, color: black })

  const rightCol = width - margin
  let ry = height - margin
  for (const item of [{ label: "N°", value: input.numero || "XXXX" }, { label: "Date", value: fmtDate(input.date) }, { label: "Validité", value: fmtDate(input.validite) }]) {
    const lw = fontRegular.widthOfTextAtSize(item.label + " : ", 9)
    const vw = fontBold.widthOfTextAtSize(item.value, 9)
    page.drawText(item.label + " : ", { x: rightCol - lw - vw, y: ry, size: 9, font: fontRegular, color: lightGray })
    page.drawText(item.value, { x: rightCol - vw, y: ry, size: 9, font: fontBold, color: black })
    ry -= 14
  }

  y -= 30
  page.drawRectangle({ x: width - margin - 200, y: y - 55, width: 200, height: 65, color: bgLight })
  page.drawText("DESTINATAIRE", { x: width - margin - 190, y, size: 8, font: fontBold, color: lightGray })
  y -= 14
  page.drawText(truncate(input.client.nom, 35), { x: width - margin - 190, y, size: 11, font: fontBold, color: black })
  y -= 13
  if (input.client.adresse) { page.drawText(truncate(input.client.adresse, 40), { x: width - margin - 190, y, size: 9, font: fontRegular, color: gray }); y -= 12 }

  y -= 25
  const colX = [margin, margin + 220, margin + 290, margin + 360, margin + 430]
  page.drawRectangle({ x: margin, y: y - 4, width: width - margin * 2, height: 20, color: accent })
  const colLabels = ["Description", "Qté", "Prix HT", "TVA", "Total HT"]
  colLabels.forEach((label, i) => {
    page.drawText(label, { x: i === 0 ? colX[i] + 8 : colX[i], y, size: 8, font: fontBold, color: rgb(1, 1, 1) })
  })
  y -= 22

  let subtotalHT = 0, totalTVA = 0
  for (let i = 0; i < lignes.length; i++) {
    const line = lignes[i]
    const lineHT = Math.round(line.quantite * line.prixHT * 100) / 100
    const lineTVA = Math.round(lineHT * (line.tauxTVA / 100) * 100) / 100
    subtotalHT += lineHT; totalTVA += lineTVA
    if (i % 2 === 0) page.drawRectangle({ x: margin, y: y - 4, width: width - margin * 2, height: 18, color: bgLight })
    page.drawText(truncate(line.description, 40), { x: colX[0] + 8, y, size: 9, font: fontRegular, color: black })
    page.drawText(String(line.quantite), { x: colX[1], y, size: 9, font: fontRegular, color: black })
    page.drawText(fmt(line.prixHT), { x: colX[2], y, size: 9, font: fontRegular, color: black })
    page.drawText(`${line.tauxTVA}%`, { x: colX[3], y, size: 9, font: fontRegular, color: black })
    page.drawText(fmt(lineHT), { x: colX[4], y, size: 9, font: fontBold, color: black })
    y -= 18
  }

  y -= 12
  page.drawLine({ start: { x: colX[3], y: y + 10 }, end: { x: width - margin, y: y + 10 }, thickness: 0.5, color: rgb(0.85, 0.87, 0.9) })
  const totalTTC = Math.round((subtotalHT + totalTVA) * 100) / 100
  for (const t of [{ label: "Sous-total HT", value: fmt(subtotalHT), bold: false }, { label: "TVA", value: fmt(totalTVA), bold: false }, { label: "Total TTC", value: fmt(totalTTC), bold: true }]) {
    const font = t.bold ? fontBold : fontRegular; const size = t.bold ? 12 : 10
    const lw = font.widthOfTextAtSize(t.label, size); const vw = font.widthOfTextAtSize(t.value, size)
    page.drawText(t.label, { x: rightCol - 120 - lw + 40, y, size, font, color: t.bold ? black : gray })
    page.drawText(t.value, { x: rightCol - vw, y, size, font, color: t.bold ? accent : black })
    y -= t.bold ? 20 : 16
  }

  if (input.notes) { y -= 10; page.drawText("Notes :", { x: margin, y, size: 9, font: fontBold, color: gray }); y -= 13; for (const line of input.notes.split("\n").slice(0, 3)) { page.drawText(truncate(line, 80), { x: margin, y, size: 8, font: fontRegular, color: gray }); y -= 11 } }

  const footerText = "Devis généré gratuitement sur qonforme.fr"
  const fw = fontRegular.widthOfTextAtSize(footerText, 8)
  page.drawText(footerText, { x: (width - fw) / 2, y: 30, size: 8, font: fontRegular, color: rgb(0.75, 0.78, 0.82) })
  doc.setTitle(`Devis ${input.numero}`); doc.setAuthor("Qonforme — Outil gratuit")
  const pdfBytes = await doc.save()

  return new NextResponse(Buffer.from(pdfBytes), {
    headers: { "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename="devis-${input.numero || "brouillon"}.pdf"` },
  })
}
