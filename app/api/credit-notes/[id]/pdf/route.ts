import { NextRequest, NextResponse } from "next/server"
import { PDFDocument, rgb, PageSizes } from "pdf-lib"
import fontkit from "@pdf-lib/fontkit"
import { createClient, createClientWithToken } from "@/lib/supabase/server"
import path from "path"
import fs from "fs"

interface Params {
  params: Promise<{ id: string }>
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function hexToRgb(hex: string) {
  const h = (hex ?? "#C2410C").replace("#", "").padEnd(6, "0")
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
  try {
    return new Intl.DateTimeFormat("fr-FR").format(new Date(d))
  } catch {
    return d
  }
}

// ── Route GET ────────────────────────────────────────────────────────────────

// Support Bearer token (appel interne depuis /send) ET cookies (navigation browser)
async function resolveClient(request: NextRequest) {
  const authHeader = request.headers.get("Authorization")
  if (authHeader?.startsWith("Bearer ")) {
    return createClientWithToken(authHeader.slice(7))
  }
  return createClient()
}

export async function GET(request: NextRequest, { params }: Params) {
  try {
    const supabase = await resolveClient(request)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 })

    const { id } = await params

    // 1. Avoir + client + facture originale
    const { data: creditNote, error: cnErr } = await supabase
      .from("credit_notes")
      .select(`
        *,
        client:clients(id,name,email,address,zip_code,city,siren,vat_number),
        original_invoice:invoices(id,invoice_number,issue_date,total_ttc)
      `)
      .eq("id", id)
      .eq("user_id", user.id)
      .single()

    if (cnErr || !creditNote) return NextResponse.json({ error: "Avoir introuvable" }, { status: 404 })

    // 2. Entreprise
    const { data: company } = await supabase
      .from("companies")
      .select("name,siren,siret,vat_number,address,zip_code,city,iban,legal_notice,accent_color,logo_url")
      .eq("user_id", user.id)
      .single()

    // 3. PDF setup
    const doc = await PDFDocument.create()
    doc.registerFontkit(fontkit)

    const fontsDir    = path.join(process.cwd(), "public", "fonts")
    const regularBytes = fs.readFileSync(path.join(fontsDir, "Roboto-Regular.ttf"))
    const boldBytes    = fs.readFileSync(path.join(fontsDir, "Roboto-Bold.ttf"))
    const fontRegular  = await doc.embedFont(regularBytes)
    const fontBold     = await doc.embedFont(boldBytes)

    const page = doc.addPage(PageSizes.A4)
    const { width, height } = page.getSize()

    // Couleur accent de l'entreprise (fallback orange avoir)
    const accentCompany = hexToRgb(company?.accent_color ?? "#C2410C")
    const creditOrange  = rgb(0.76, 0.25, 0.05)   // #C2410C — couleur avoir
    const black         = rgb(0.06, 0.09, 0.17)
    const grayDark      = rgb(0.28, 0.34, 0.41)
    const grayLight     = rgb(0.58, 0.64, 0.70)
    const rowAlt        = rgb(0.99, 0.97, 0.96)   // légèrement orangé pour l'avoir
    const separator     = rgb(0.89, 0.91, 0.94)

    const mL = 48
    const mR = width - 48
    const cW = mR - mL

    // Helper draw
    const draw = (
      text: string,
      x: number,
      y: number,
      opts: {
        size?: number
        bold?: boolean
        color?: ReturnType<typeof rgb>
        align?: "left" | "right" | "center"
        maxWidth?: number
      } = {}
    ) => {
      const { size = 9, bold: isBold = false, color = black, align = "left", maxWidth } = opts
      const font = isBold ? fontBold : fontRegular
      let str = text ?? ""
      if (maxWidth) {
        while (str.length > 0 && font.widthOfTextAtSize(str, size) > maxWidth) {
          str = str.slice(0, -1)
        }
        if (str.length < (text ?? "").length) str = str.slice(0, -1) + "..."
      }
      const tw = font.widthOfTextAtSize(str, size)
      const drawX = align === "right" ? x - tw : align === "center" ? x - tw / 2 : x
      page.drawText(str, { x: drawX, y, size, font, color })
    }

    const hLine = (y: number, x1 = mL, x2 = mR, thickness = 0.5, color = separator) =>
      page.drawLine({ start: { x: x1, y }, end: { x: x2, y }, thickness, color })

    const rect = (x: number, y: number, w: number, h: number, color: ReturnType<typeof rgb>) =>
      page.drawRectangle({ x, y, width: w, height: h, color })

    // ── 4. Logo ───────────────────────────────────────────────────────────────
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

    // ═══════════════════════════════════════════════════════════════════════
    // HEADER
    // ═══════════════════════════════════════════════════════════════════════
    let curY = height - 44

    // Logo ou nom entreprise
    const logoMaxH = 52
    const logoMaxW = 130
    if (logoImg) {
      const scale = Math.min(logoMaxW / logoImg.width, logoMaxH / logoImg.height, 1)
      const lw = logoImg.width * scale
      const lh = logoImg.height * scale
      page.drawImage(logoImg, { x: mL, y: curY - lh + 4, width: lw, height: lh })
    } else {
      draw(company?.name ?? "Votre entreprise", mL, curY, { size: 16, bold: true, color: accentCompany })
    }

    // Titre AVOIR (droite) — orange
    draw("AVOIR", mR, curY, { size: 22, bold: true, color: creditOrange, align: "right" })
    draw(creditNote.credit_note_number, mR, curY - 20, { size: 11, bold: true, color: creditOrange, align: "right" })
    draw(`Émis le : ${fmtDate(creditNote.issue_date)}`, mR, curY - 36, { size: 8.5, color: grayDark, align: "right" })

    // Mention facture originale
    if (creditNote.original_invoice) {
      draw(
        `Avoir sur la facture ${creditNote.original_invoice.invoice_number}`,
        mR, curY - 50, { size: 8, color: grayDark, align: "right" }
      )
    }

    // Infos entreprise sous le logo
    let infoY = curY - logoMaxH - 4
    if (company?.address) {
      draw(company.address, mL, infoY, { size: 8, color: grayDark }); infoY -= 12
    }
    const cityLine = [company?.zip_code, company?.city].filter(Boolean).join(" ")
    if (cityLine) { draw(cityLine, mL, infoY, { size: 8, color: grayDark }); infoY -= 12 }
    if (company?.siret)      { draw(`SIRET : ${company.siret}`, mL, infoY, { size: 7.5, color: grayLight }); infoY -= 11 }
    else if (company?.siren) { draw(`SIREN : ${company.siren}`, mL, infoY, { size: 7.5, color: grayLight }); infoY -= 11 }
    if (company?.vat_number) { draw(`TVA : ${company.vat_number}`, mL, infoY, { size: 7.5, color: grayLight }) }

    // Barre accent (orange avoir)
    const barY = height - 130
    rect(mL, barY, cW, 3, creditOrange)

    // ═══════════════════════════════════════════════════════════════════════
    // SECTION ÉMETTEUR / FACTURÉ À
    // ═══════════════════════════════════════════════════════════════════════
    curY = barY - 20
    const col2  = mL + cW / 2 + 8
    const colW2 = cW / 2 - 8

    draw("ÉMETTEUR",  mL,   curY, { size: 7, bold: true, color: creditOrange })
    draw("FACTURÉ À", col2, curY, { size: 7, bold: true, color: creditOrange })
    curY -= 4
    hLine(curY, mL, mL + 80, 0.8, creditOrange)
    hLine(curY, col2, col2 + 80, 0.8, creditOrange)
    curY -= 13

    draw(company?.name ?? "—",           mL,   curY, { size: 10, bold: true, color: black, maxWidth: colW2 })
    draw(creditNote.client?.name ?? "—", col2, curY, { size: 10, bold: true, color: black, maxWidth: colW2 })
    curY -= 14

    if (company?.address || creditNote.client?.address) {
      draw(company?.address ?? "",           mL,   curY, { size: 8.5, color: grayDark, maxWidth: colW2 })
      draw(creditNote.client?.address ?? "", col2, curY, { size: 8.5, color: grayDark, maxWidth: colW2 })
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
      if (company?.vat_number)           draw(`TVA ${company.vat_number}`, mL, curY, { size: 7.5, color: grayLight })
      if (creditNote.client?.siren) draw(`SIREN ${creditNote.client.siren}`, col2, curY, { size: 7.5, color: grayLight })
      curY -= 13
    }

    // Motif de l'avoir
    curY -= 4
    draw("MOTIF DE L'AVOIR", mL, curY, { size: 7, bold: true, color: creditOrange })
    curY -= 12
    draw(creditNote.reason, mL, curY, { size: 8.5, color: grayDark, maxWidth: cW })
    curY -= 20

    // ═══════════════════════════════════════════════════════════════════════
    // TABLEAU DES LIGNES
    // ═══════════════════════════════════════════════════════════════════════
    const colDesc  = mL
    const colQty   = mL + 250
    const colPU    = mL + 300
    const colTVA   = mL + 378
    const colTotal = mR
    const tableHeaderH = 20

    rect(mL, curY - 4, cW, tableHeaderH, rgb(0.99, 0.97, 0.95))
    draw("Désignation", colDesc,  curY + 4, { size: 7.5, bold: true, color: grayDark })
    draw("Qté",         colQty,   curY + 4, { size: 7.5, bold: true, color: grayDark, align: "right" })
    draw("P.U. HT",     colPU,    curY + 4, { size: 7.5, bold: true, color: grayDark, align: "right" })
    draw("TVA",         colTVA,   curY + 4, { size: 7.5, bold: true, color: grayDark, align: "right" })
    draw("Total HT",    colTotal, curY + 4, { size: 7.5, bold: true, color: grayDark, align: "right" })
    curY -= tableHeaderH + 2

    const lines: {
      description: string
      quantity: number
      unit_price_ht: number
      vat_rate: number
      total_ht: number
    }[] = creditNote.lines ?? []

    const rowH = 18
    lines.forEach((line, i) => {
      if (i % 2 === 1) rect(mL, curY - 4, cW, rowH, rowAlt)
      draw(line.description, colDesc, curY + 2, { size: 8.5, color: black, maxWidth: 240 })
      draw(String(line.quantity),       colQty,   curY + 2, { size: 8.5, color: grayDark, align: "right" })
      draw(fmt(line.unit_price_ht),     colPU,    curY + 2, { size: 8.5, color: grayDark, align: "right" })
      draw(`${line.vat_rate} %`,        colTVA,   curY + 2, { size: 8.5, color: grayDark, align: "right" })
      draw(`-${fmt(line.total_ht)}`,    colTotal, curY + 2, { size: 8.5, bold: true, color: creditOrange, align: "right" })
      curY -= rowH
      hLine(curY + 2, mL, mR, 0.3, rgb(0.92, 0.93, 0.95))
    })

    curY -= 16

    // ═══════════════════════════════════════════════════════════════════════
    // TOTAUX
    // ═══════════════════════════════════════════════════════════════════════
    const totBlockW = 210
    const totX      = mR - totBlockW
    const totValX   = mR

    draw("Sous-total HT", totX, curY, { size: 8.5, color: grayDark })
    draw(`-${fmt(creditNote.subtotal_ht)}`, totValX, curY, { size: 8.5, color: grayDark, align: "right" })
    curY -= 14

    draw("TVA", totX, curY, { size: 8.5, color: grayDark })
    draw(`-${fmt(creditNote.total_vat)}`, totValX, curY, { size: 8.5, color: grayDark, align: "right" })
    curY -= 8
    hLine(curY, totX, mR, 0.8, grayLight)
    curY -= 16

    // Total avoir — trait + texte orange
    hLine(curY, totX, mR, 1.5, creditOrange)
    curY -= 14
    draw("TOTAL AVOIR TTC",                    totX,    curY, { size: 10, bold: true, color: creditOrange })
    draw(`-${fmt(creditNote.total_ttc)}`, totValX, curY, { size: 14, bold: true, color: creditOrange, align: "right" })
    curY -= 24

    // ═══════════════════════════════════════════════════════════════════════
    // MENTIONS LÉGALES
    // ═══════════════════════════════════════════════════════════════════════
    if (company?.legal_notice?.trim()) {
      hLine(curY, mL, mR, 0.5, separator)
      curY -= 12
      const legalLines = company.legal_notice.trim().split("\n").slice(0, 4)
      legalLines.forEach((l: string) => {
        const tw = fontRegular.widthOfTextAtSize(l, 7)
        const lx = Math.max(mL, (width - tw) / 2)
        draw(l, lx, curY, { size: 7, color: grayLight })
        curY -= 10
      })
    }

    // ═══════════════════════════════════════════════════════════════════════
    // FOOTER
    // ═══════════════════════════════════════════════════════════════════════
    hLine(32, mL, mR, 0.5, separator)
    const footerY = 20
    draw(`${company?.name ?? "Qonforme"} — ${creditNote.credit_note_number}`, mL, footerY, { size: 7, color: grayLight })
    draw("Généré par Qonforme", mR, footerY, { size: 7, color: creditOrange, align: "right" })

    // ── Exporter ────────────────────────────────────────────────────────────
    const pdfBytes = await doc.save()
    const buffer = Buffer.from(pdfBytes)

    return new Response(buffer, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${creditNote.credit_note_number}.pdf"`,
        "Cache-Control": "no-store",
      },
    })
  } catch (err) {
    console.error("PDF avoir error:", err)
    return NextResponse.json({ error: "Erreur génération PDF" }, { status: 500 })
  }
}
