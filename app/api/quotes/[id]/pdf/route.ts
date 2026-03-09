import { NextRequest, NextResponse } from "next/server"
import { PDFDocument, rgb, PageSizes } from "pdf-lib"
import fontkit from "@pdf-lib/fontkit"
import { createClient, createClientWithToken } from "@/lib/supabase/server"
import path from "path"
import fs from "fs"

interface Params { params: Promise<{ id: string }> }

// Support Bearer token (appel interne depuis /send) ET cookies (navigation browser)
async function resolveClient(request: NextRequest) {
  const authHeader = request.headers.get("Authorization")
  if (authHeader?.startsWith("Bearer ")) {
    return createClientWithToken(authHeader.slice(7))
  }
  return createClient()
}

function hexToRgb(hex: string) {
  const h = (hex ?? "#2563EB").replace("#", "").padEnd(6, "0")
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

export async function GET(request: NextRequest, { params }: Params) {
  try {
    const supabase = await resolveClient(request)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 })

    const { id } = await params

    const { data: quote, error: qErr } = await supabase
      .from("quotes")
      .select(`*, client:clients(id,name,email,address,zip_code,city,siren,vat_number)`)
      .eq("id", id)
      .eq("user_id", user.id)
      .single()

    if (qErr || !quote) return NextResponse.json({ error: "Devis introuvable" }, { status: 404 })

    const { data: company } = await supabase
      .from("companies")
      .select("name,siren,siret,vat_number,address,zip_code,city,iban,legal_notice,accent_color,logo_url")
      .eq("user_id", user.id)
      .single()

    // PDF setup
    const doc = await PDFDocument.create()
    doc.registerFontkit(fontkit)

    const fontsDir    = path.join(process.cwd(), "public", "fonts")
    const fontRegular = await doc.embedFont(fs.readFileSync(path.join(fontsDir, "Roboto-Regular.ttf")))
    const fontBold    = await doc.embedFont(fs.readFileSync(path.join(fontsDir, "Roboto-Bold.ttf")))

    const page           = doc.addPage(PageSizes.A4)
    const { width, height } = page.getSize()

    const accent    = hexToRgb(company?.accent_color ?? "#2563EB")
    const quoteGreen = rgb(0.06, 0.58, 0.35)  // #0f9457 — vert devis
    const black     = rgb(0.06, 0.09, 0.17)
    const grayDark  = rgb(0.28, 0.34, 0.41)
    const grayLight = rgb(0.58, 0.64, 0.70)
    const rowAlt    = rgb(0.97, 0.99, 0.97)
    const separator = rgb(0.89, 0.91, 0.94)

    const mL = 48; const mR = width - 48; const cW = mR - mL

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

    // Logo
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

    // ── HEADER ───────────────────────────────────────────────────────────
    let curY = height - 44
    const logoMaxH = 52; const logoMaxW = 130

    if (logoImg) {
      const scale = Math.min(logoMaxW / logoImg.width, logoMaxH / logoImg.height, 1)
      page.drawImage(logoImg, { x: mL, y: curY - logoImg.height * scale + 4, width: logoImg.width * scale, height: logoImg.height * scale })
    } else {
      draw(company?.name ?? "Votre entreprise", mL, curY, { size: 16, bold: true, color: accent })
    }

    draw("DEVIS",            mR, curY,      { size: 22, bold: true, color: quoteGreen, align: "right" })
    draw(quote.quote_number, mR, curY - 20, { size: 11, bold: true, color: quoteGreen, align: "right" })
    draw(`Émis le : ${fmtDate(quote.issue_date)}`,   mR, curY - 36, { size: 8.5, color: grayDark, align: "right" })
    draw(`Valable jusqu'au : ${fmtDate(quote.valid_until)}`, mR, curY - 50, { size: 8.5, color: grayDark, align: "right" })

    let infoY = curY - logoMaxH - 4
    if (company?.address) { draw(company.address, mL, infoY, { size: 8, color: grayDark }); infoY -= 12 }
    const cityLine = [company?.zip_code, company?.city].filter(Boolean).join(" ")
    if (cityLine)            { draw(cityLine, mL, infoY, { size: 8, color: grayDark }); infoY -= 12 }
    if (company?.siret)      { draw(`SIRET : ${company.siret}`, mL, infoY, { size: 7.5, color: grayLight }); infoY -= 11 }
    else if (company?.siren) { draw(`SIREN : ${company.siren}`, mL, infoY, { size: 7.5, color: grayLight }); infoY -= 11 }
    if (company?.vat_number) { draw(`TVA : ${company.vat_number}`, mL, infoY, { size: 7.5, color: grayLight }) }

    // Barre accent verte pour le devis
    const barY = height - 130
    rect(mL, barY, cW, 3, quoteGreen)

    // ── ÉMETTEUR / CLIENT ────────────────────────────────────────────────
    curY = barY - 20
    const col2 = mL + cW / 2 + 8; const colW2 = cW / 2 - 8

    draw("ÉMETTEUR",  mL,   curY, { size: 7, bold: true, color: quoteGreen })
    draw("CLIENT",    col2, curY, { size: 7, bold: true, color: quoteGreen })
    curY -= 4
    hLine(curY, mL, mL + 80, 0.8, quoteGreen)
    hLine(curY, col2, col2 + 80, 0.8, quoteGreen)
    curY -= 13

    draw(company?.name ?? "—",           mL,   curY, { size: 10, bold: true, color: black, maxWidth: colW2 })
    draw(quote.client?.name ?? "—",      col2, curY, { size: 10, bold: true, color: black, maxWidth: colW2 })
    curY -= 14

    if (company?.address || quote.client?.address) {
      draw(company?.address ?? "",           mL,   curY, { size: 8.5, color: grayDark, maxWidth: colW2 })
      draw(quote.client?.address ?? "",      col2, curY, { size: 8.5, color: grayDark, maxWidth: colW2 })
      curY -= 13
    }

    const compCity   = [company?.zip_code, company?.city].filter(Boolean).join(" ")
    const clientCity = [quote.client?.zip_code, quote.client?.city].filter(Boolean).join(" ")
    if (compCity || clientCity) {
      draw(compCity,   mL,   curY, { size: 8.5, color: grayDark })
      draw(clientCity, col2, curY, { size: 8.5, color: grayDark })
      curY -= 13
    }

    if (quote.client?.email)  draw(quote.client.email, col2, curY, { size: 8, color: grayDark })
    if (company?.siret)       draw(`SIRET ${company.siret}`, mL, curY, { size: 7.5, color: grayLight })
    else if (company?.siren)  draw(`SIREN ${company.siren}`, mL, curY, { size: 7.5, color: grayLight })
    curY -= 13

    if (company?.vat_number || quote.client?.siren) {
      if (company?.vat_number)     draw(`TVA ${company.vat_number}`, mL, curY, { size: 7.5, color: grayLight })
      if (quote.client?.siren)     draw(`SIREN ${quote.client.siren}`, col2, curY, { size: 7.5, color: grayLight })
      curY -= 13
    }
    curY -= 12

    // ── TABLEAU LIGNES ───────────────────────────────────────────────────
    const colDesc = mL; const colQty = mL + 250; const colPU = mL + 300
    const colTVA  = mL + 378; const colTotal = mR; const tableHeaderH = 20

    rect(mL, curY - 4, cW, tableHeaderH, rgb(0.94, 0.99, 0.96))
    draw("Désignation", colDesc,  curY + 4, { size: 7.5, bold: true, color: grayDark })
    draw("Qté",         colQty,   curY + 4, { size: 7.5, bold: true, color: grayDark, align: "right" })
    draw("P.U. HT",     colPU,    curY + 4, { size: 7.5, bold: true, color: grayDark, align: "right" })
    draw("TVA",         colTVA,   curY + 4, { size: 7.5, bold: true, color: grayDark, align: "right" })
    draw("Total HT",    colTotal, curY + 4, { size: 7.5, bold: true, color: grayDark, align: "right" })
    curY -= tableHeaderH + 2

    const lines: { description: string; quantity: number; unit_price_ht: number; vat_rate: number; total_ht: number }[]
      = quote.lines ?? []

    const rowH = 18
    lines.forEach((line, i) => {
      if (i % 2 === 1) rect(mL, curY - 4, cW, rowH, rowAlt)
      draw(line.description,           colDesc,  curY + 2, { size: 8.5, color: black,    maxWidth: 240 })
      draw(String(line.quantity),      colQty,   curY + 2, { size: 8.5, color: grayDark, align: "right" })
      draw(fmt(line.unit_price_ht),    colPU,    curY + 2, { size: 8.5, color: grayDark, align: "right" })
      draw(`${line.vat_rate} %`,       colTVA,   curY + 2, { size: 8.5, color: grayDark, align: "right" })
      draw(fmt(line.total_ht),         colTotal, curY + 2, { size: 8.5, bold: true, color: black, align: "right" })
      curY -= rowH
      hLine(curY + 2, mL, mR, 0.3, rgb(0.92, 0.93, 0.95))
    })
    curY -= 16

    // ── TOTAUX ───────────────────────────────────────────────────────────
    const totBlockW = 210; const totX = mR - totBlockW; const totValX = mR

    draw("Sous-total HT",    totX, curY, { size: 8.5, color: grayDark })
    draw(fmt(quote.subtotal_ht), totValX, curY, { size: 8.5, color: black, align: "right" })
    curY -= 14

    draw("TVA",              totX, curY, { size: 8.5, color: grayDark })
    draw(fmt(quote.total_vat),   totValX, curY, { size: 8.5, color: black, align: "right" })
    curY -= 8
    hLine(curY, totX, mR, 0.8, grayLight)
    curY -= 16

    hLine(curY, totX, mR, 1.5, quoteGreen)
    curY -= 14
    draw("TOTAL TTC",        totX,    curY, { size: 10, bold: true, color: quoteGreen })
    draw(fmt(quote.total_ttc),   totValX, curY, { size: 14, bold: true, color: quoteGreen, align: "right" })
    curY -= 24

    // ── NOTES ────────────────────────────────────────────────────────────
    if (quote.notes?.trim()) {
      rect(mL, curY - 2, 3, 28, quoteGreen)
      draw("NOTES / CONDITIONS", mL + 10, curY + 14, { size: 7.5, bold: true, color: grayDark })
      quote.notes.trim().split("\n").slice(0, 3).forEach((l: string) => {
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

    // ── FOOTER ───────────────────────────────────────────────────────────
    hLine(32, mL, mR, 0.5, separator)
    draw(`${company?.name ?? "Qonforme"} — ${quote.quote_number}`, mL, 20, { size: 7, color: grayLight })
    draw("Généré par Qonforme", mR, 20, { size: 7, color: quoteGreen, align: "right" })

    const pdfBytes = await doc.save()
    const buffer = Buffer.from(pdfBytes)

    return new Response(buffer, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${quote.quote_number}.pdf"`,
        "Cache-Control": "no-store",
      },
    })
  } catch (err) {
    console.error("PDF devis error:", err)
    return NextResponse.json({ error: "Erreur génération PDF" }, { status: 500 })
  }
}
