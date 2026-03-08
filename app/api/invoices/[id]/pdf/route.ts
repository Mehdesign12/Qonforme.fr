import { NextRequest, NextResponse } from "next/server"
import { PDFDocument, rgb, PageSizes } from "pdf-lib"
import fontkit from "@pdf-lib/fontkit"
import { createClient } from "@/lib/supabase/server"
import path from "path"
import fs from "fs"

interface Params {
  params: Promise<{ id: string }>
}

// ── Helpers ──────────────────────────────────────────────────────────────────

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
  return `${intPart},${parts[1]}\u00A0€`
}

function fmtDate(d: string): string {
  try {
    return new Intl.DateTimeFormat("fr-FR").format(new Date(d))
  } catch {
    return d
  }
}

// ── Route GET ────────────────────────────────────────────────────────────────

export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 })

    const { id } = await params

    // 1. Facture + client
    const { data: invoice, error: invErr } = await supabase
      .from("invoices")
      .select("*, client:clients(id,name,email,address,zip_code,city,siren,vat_number)")
      .eq("id", id)
      .eq("user_id", user.id)
      .single()
    if (invErr || !invoice) return NextResponse.json({ error: "Facture introuvable" }, { status: 404 })

    // 2. Entreprise
    const { data: company } = await supabase
      .from("companies")
      .select("name,siren,siret,vat_number,address,zip_code,city,iban,legal_notice,accent_color,logo_url")
      .eq("user_id", user.id)
      .single()

    // 3. PDF setup
    const doc = await PDFDocument.create()
    doc.registerFontkit(fontkit)

    // Charger Roboto depuis le filesystem (dispo au build time dans /public/fonts)
    const fontsDir = path.join(process.cwd(), "public", "fonts")
    const regularBytes = fs.readFileSync(path.join(fontsDir, "Roboto-Regular.ttf"))
    const boldBytes    = fs.readFileSync(path.join(fontsDir, "Roboto-Bold.ttf"))
    const fontRegular  = await doc.embedFont(regularBytes)
    const fontBold     = await doc.embedFont(boldBytes)

    const page = doc.addPage(PageSizes.A4)
    const { width, height } = page.getSize() // 595 × 842

    // Couleurs
    const accent    = hexToRgb(company?.accent_color ?? "#2563EB")
    const black     = rgb(0.06, 0.09, 0.17)
    const grayDark  = rgb(0.28, 0.34, 0.41)
    const grayLight = rgb(0.58, 0.64, 0.70)
    const rowAlt    = rgb(0.97, 0.98, 0.99)
    const separator = rgb(0.89, 0.91, 0.94)

    const mL = 48   // margin left
    const mR = width - 48  // margin right
    const cW = mR - mL     // content width

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
      // Tronquer si maxWidth
      if (maxWidth) {
        while (str.length > 0 && font.widthOfTextAtSize(str, size) > maxWidth) {
          str = str.slice(0, -1)
        }
        if (str.length < (text ?? "").length) str = str.slice(0, -1) + "…"
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

    // --- Logo ou nom entreprise (gauche) ---
    const logoMaxH = 52
    const logoMaxW = 130
    if (logoImg) {
      const scale = Math.min(logoMaxW / logoImg.width, logoMaxH / logoImg.height, 1)
      const lw = logoImg.width * scale
      const lh = logoImg.height * scale
      page.drawImage(logoImg, { x: mL, y: curY - lh + 4, width: lw, height: lh })
    } else {
      draw(company?.name ?? "Votre entreprise", mL, curY, { size: 16, bold: true, color: accent })
    }

    // --- Bloc FACTURE (droite) ---
    draw("FACTURE", mR, curY, { size: 22, bold: true, color: black, align: "right" })
    draw(invoice.invoice_number, mR, curY - 20, { size: 11, bold: true, color: accent, align: "right" })
    draw(`Émission : ${fmtDate(invoice.issue_date)}`, mR, curY - 36, { size: 8.5, color: grayDark, align: "right" })
    draw(`Échéance : ${fmtDate(invoice.due_date)}`,   mR, curY - 50, { size: 8.5, color: grayDark, align: "right" })

    // --- Infos entreprise sous le logo ---
    let infoY = curY - logoMaxH - 4
    if (company?.address) {
      draw(company.address, mL, infoY, { size: 8, color: grayDark }); infoY -= 12
    }
    const cityLine = [company?.zip_code, company?.city].filter(Boolean).join(" ")
    if (cityLine) { draw(cityLine, mL, infoY, { size: 8, color: grayDark }); infoY -= 12 }
    if (company?.siren)      { draw(`SIREN : ${company.siren}`, mL, infoY, { size: 7.5, color: grayLight }); infoY -= 11 }
    if (company?.vat_number) { draw(`TVA : ${company.vat_number}`, mL, infoY, { size: 7.5, color: grayLight }) }

    // --- Barre accent ---
    const barY = height - 130
    rect(mL, barY, cW, 3, accent)

    // ═══════════════════════════════════════════════════════════════════════
    // SECTION ÉMETTEUR / FACTURÉ À
    // ═══════════════════════════════════════════════════════════════════════
    curY = barY - 20
    const col2 = mL + cW / 2 + 8
    const colW2 = cW / 2 - 8

    // Labels
    draw("ÉMETTEUR",  mL,   curY, { size: 7, bold: true, color: accent })
    draw("FACTURÉ À", col2, curY, { size: 7, bold: true, color: accent })
    curY -= 4
    // Soulignement
    hLine(curY, mL, mL + 80, 0.8, accent)
    hLine(curY, col2, col2 + 80, 0.8, accent)
    curY -= 13

    // Nom
    draw(company?.name ?? "—", mL,   curY, { size: 10, bold: true, color: black, maxWidth: colW2 })
    draw(invoice.client?.name ?? "—", col2, curY, { size: 10, bold: true, color: black, maxWidth: colW2 })
    curY -= 14

    // Adresse
    if (company?.address || invoice.client?.address) {
      draw(company?.address ?? "", mL,   curY, { size: 8.5, color: grayDark, maxWidth: colW2 })
      draw(invoice.client?.address ?? "", col2, curY, { size: 8.5, color: grayDark, maxWidth: colW2 })
      curY -= 13
    }

    // CP + Ville
    const compCity   = [company?.zip_code, company?.city].filter(Boolean).join(" ")
    const clientCity = [invoice.client?.zip_code, invoice.client?.city].filter(Boolean).join(" ")
    if (compCity || clientCity) {
      draw(compCity,   mL,   curY, { size: 8.5, color: grayDark })
      draw(clientCity, col2, curY, { size: 8.5, color: grayDark })
      curY -= 13
    }

    // Email client
    if (invoice.client?.email) {
      draw(invoice.client.email, col2, curY, { size: 8, color: grayDark })
    }
    // SIREN émetteur
    if (company?.siren) {
      draw(`SIREN ${company.siren}`, mL, curY, { size: 7.5, color: grayLight })
    }
    curY -= 13

    // SIREN/TVA client
    if (company?.vat_number || invoice.client?.siren) {
      if (company?.vat_number) draw(`TVA ${company.vat_number}`, mL, curY, { size: 7.5, color: grayLight })
      if (invoice.client?.siren) draw(`SIREN ${invoice.client.siren}`, col2, curY, { size: 7.5, color: grayLight })
      curY -= 13
    }

    curY -= 12

    // ═══════════════════════════════════════════════════════════════════════
    // TABLEAU DES PRESTATIONS
    // ═══════════════════════════════════════════════════════════════════════

    // Dimensions colonnes
    const colDesc  = mL
    const colQty   = mL + 250
    const colPU    = mL + 300
    const colTVA   = mL + 378
    const colTotal = mR

    const tableHeaderH = 20

    // Header fond
    rect(mL, curY - 4, cW, tableHeaderH, rgb(0.95, 0.97, 1.00))
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
    }[] = invoice.lines ?? []

    const rowH = 18
    lines.forEach((line, i) => {
      if (i % 2 === 1) rect(mL, curY - 4, cW, rowH, rowAlt)
      draw(line.description, colDesc, curY + 2, { size: 8.5, color: black, maxWidth: 240 })
      draw(String(line.quantity),       colQty,   curY + 2, { size: 8.5, color: grayDark, align: "right" })
      draw(fmt(line.unit_price_ht),     colPU,    curY + 2, { size: 8.5, color: grayDark, align: "right" })
      draw(`${line.vat_rate} %`,        colTVA,   curY + 2, { size: 8.5, color: grayDark, align: "right" })
      draw(fmt(line.total_ht),          colTotal, curY + 2, { size: 8.5, bold: true, color: black, align: "right" })
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

    // Sous-total HT
    draw("Sous-total HT", totX, curY, { size: 8.5, color: grayDark })
    draw(fmt(invoice.subtotal_ht), totValX, curY, { size: 8.5, color: black, align: "right" })
    curY -= 14

    // TVA
    draw("TVA", totX, curY, { size: 8.5, color: grayDark })
    draw(fmt(invoice.total_vat), totValX, curY, { size: 8.5, color: black, align: "right" })
    curY -= 8
    hLine(curY, totX, mR, 0.8, grayLight)
    curY -= 16

    // Total TTC — trait de séparation + texte couleur accent
    hLine(curY, totX, mR, 1.5, accent)
    curY -= 14
    draw("TOTAL TTC",            totX,    curY, { size: 10, bold: true, color: accent })
    draw(fmt(invoice.total_ttc), totValX, curY, { size: 14, bold: true, color: accent, align: "right" })
    curY -= 18

    // IBAN
    if (company?.iban) {
      curY -= 8
      hLine(curY, totX, mR, 0.4, separator)
      curY -= 10
      draw("IBAN",        totX,    curY, { size: 7.5, color: grayLight })
      draw(company.iban,  totValX, curY, { size: 7.5, color: grayDark, align: "right" })
      curY -= 14
    }

    curY -= 16

    // ═══════════════════════════════════════════════════════════════════════
    // NOTES / CONDITIONS DE PAIEMENT
    // ═══════════════════════════════════════════════════════════════════════
    if (invoice.notes?.trim()) {
      rect(mL, curY - 2, 3, 28, accent)
      draw("CONDITIONS DE PAIEMENT / NOTES", mL + 10, curY + 14, { size: 7.5, bold: true, color: grayDark })
      const noteLines = invoice.notes.trim().split("\n").slice(0, 3)
      noteLines.forEach((l: string) => {
        draw(l, mL + 10, curY, { size: 8, color: grayDark, maxWidth: cW - 20 })
        curY -= 13
      })
      curY -= 10
    }

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
    draw(`${company?.name ?? "Qonforme"} — ${invoice.invoice_number}`, mL, footerY, { size: 7, color: grayLight })
    draw("Généré par Qonforme", mR, footerY, { size: 7, color: accent, align: "right" })

    // ── Exporter ────────────────────────────────────────────────────────────
    const uint8  = await doc.save()
    const buffer = Buffer.from(uint8)

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${invoice.invoice_number}.pdf"`,
        "Content-Length": buffer.length.toString(),
        "Cache-Control": "no-store",
      },
    })
  } catch (err) {
    console.error("PDF generation error:", err)
    return NextResponse.json({ error: "Erreur génération PDF" }, { status: 500 })
  }
}
