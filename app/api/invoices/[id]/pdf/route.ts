import { NextRequest, NextResponse } from "next/server"
import { PDFDocument, rgb, StandardFonts, PageSizes } from "pdf-lib"
import { createClient } from "@/lib/supabase/server"

interface Params {
  params: Promise<{ id: string }>
}

// ── helpers globaux ──────────────────────────────────────────────────────────

// Nettoie les caractères Unicode non supportés par WinAnsi (pdf-lib polices standard)
// U+202F = espace fine insécable (utilisée par Intl fr-FR dans les nombres)
// U+00A0 = espace insécable
function sanitize(text: string): string {
  return text
    .replace(/\u202F/g, " ")   // espace fine insécable → espace normale
    .replace(/\u00A0/g, " ")   // espace insécable → espace normale
    .replace(/\u20AC/g, "EUR") // € → EUR (WinAnsi ne supporte pas U+20AC)
    .replace(/\u2019/g, "'")   // apostrophe typographique → apostrophe simple
    .replace(/\u2026/g, "...") // ellipse → trois points
    .replace(/\u00E9/g, "e")   // é → e  (sécurité extra)
    .replace(/[^\x20-\x7E\xA1-\xFF]/g, "?") // autres non-Latin1 → ?
}

function fmt(n: number) {
  // Formater manuellement pour éviter les caractères Unicode problématiques
  // ex: 1250.50 → "1 250,50 EUR"
  const parts = n.toFixed(2).split(".")
  const intPart = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, " ")
  return `${intPart},${parts[1]} EUR`
}

function fmtDate(d: string) {
  return new Intl.DateTimeFormat("fr-FR").format(new Date(d))
}

function hexToRgb(hex: string) {
  const h = hex.replace("#", "")
  return rgb(
    parseInt(h.slice(0, 2), 16) / 255,
    parseInt(h.slice(2, 4), 16) / 255,
    parseInt(h.slice(4, 6), 16) / 255,
  )
}

// ── route GET ──────────────────────────────────────────────────────────────

export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 })

    const { id } = await params

    // 1. Charger facture + client
    const { data: invoice, error: invErr } = await supabase
      .from("invoices")
      .select("*, client:clients(id,name,email,address,zip_code,city,siren,vat_number)")
      .eq("id", id)
      .eq("user_id", user.id)
      .single()
    if (invErr || !invoice) return NextResponse.json({ error: "Facture introuvable" }, { status: 404 })

    // 2. Charger entreprise (logo_url inclus)
    const { data: company } = await supabase
      .from("companies")
      .select("name,siren,siret,vat_number,address,zip_code,city,iban,legal_notice,accent_color,logo_url")
      .eq("user_id", user.id)
      .single()

    // 3. Construire le PDF ─────────────────────────────────────────────────
    const doc = await PDFDocument.create()
    doc.setTitle(`Facture ${invoice.invoice_number}`)
    doc.setAuthor(company?.name ?? "Qonforme")

    const page = doc.addPage(PageSizes.A4)
    const { width, height } = page.getSize()
    const bold    = await doc.embedFont(StandardFonts.HelveticaBold)
    const regular = await doc.embedFont(StandardFonts.Helvetica)

    const accent = hexToRgb(company?.accent_color ?? "#2563EB")
    const black  = rgb(0.059, 0.090, 0.169)
    const gray   = rgb(0.278, 0.337, 0.408)
    const light  = rgb(0.580, 0.635, 0.702)

    const marginL = 48
    const marginR = width - 48
    const lineH   = 14

    // drawText helper
    const draw = (
      text: string,
      x: number,
      yPos: number,
      opts: { size?: number; font?: typeof bold; color?: ReturnType<typeof rgb>; align?: "right" | "left" } = {}
    ) => {
      const { size = 9, font = regular, color = black, align = "left" } = opts
      const tw = font.widthOfTextAtSize(text, size)
      page.drawText(text, { x: align === "right" ? x - tw : x, y: yPos, size, font, color })
    }

    // hLine helper
    const hLine = (
      yPos: number,
      x1 = marginL,
      x2 = marginR,
      thickness = 0.5,
      color = rgb(0.886, 0.914, 0.937)
    ) => {
      page.drawLine({ start: { x: x1, y: yPos }, end: { x: x2, y: yPos }, thickness, color })
    }

    // 4. Logo (optionnel) ────────────────────────────────────────────────────
    let logoImg: Awaited<ReturnType<typeof doc.embedPng>> | null = null
    if (company?.logo_url) {
      try {
        const logoRes = await fetch(company.logo_url)
        if (logoRes.ok) {
          const logoBytes = await logoRes.arrayBuffer()
          const contentType = logoRes.headers.get("content-type") ?? ""
          if (contentType.includes("png") || company.logo_url.endsWith(".png")) {
            logoImg = await doc.embedPng(logoBytes)
          } else {
            // JPG/JPEG/WEBP — essai JPG
            try { logoImg = await doc.embedJpg(logoBytes) } catch { logoImg = null }
          }
        }
      } catch (e) {
        console.warn("Logo non chargé:", e)
        logoImg = null
      }
    }

    let y = height - 40

    // ── HEADER ───────────────────────────────────────────────────────────────
    // Logo ou nom de l'entreprise
    if (logoImg) {
      const logoMaxW = 120
      const logoMaxH = 50
      const scale = Math.min(logoMaxW / logoImg.width, logoMaxH / logoImg.height, 1)
      const lw = logoImg.width * scale
      const lh = logoImg.height * scale
      page.drawImage(logoImg, { x: marginL, y: y - lh + 12, width: lw, height: lh })
      y -= lh + 4
    } else {
      draw(sanitize(company?.name ?? "Votre entreprise"), marginL, y, { size: 18, font: bold, color: accent })
      y -= 18
    }
    if (company?.address)              { draw(sanitize(company.address), marginL, y, { size: 8, color: gray }); y -= lineH }
    if (company?.zip_code || company?.city) {
      draw(sanitize(`${company?.zip_code ?? ""} ${company?.city ?? ""}`).trim(), marginL, y, { size: 8, color: gray }); y -= lineH
    }
    if (company?.siren)                { draw(sanitize(`SIREN : ${company.siren}`), marginL, y, { size: 8, color: gray }); y -= lineH }
    if (company?.vat_number)           { draw(sanitize(`TVA : ${company.vat_number}`), marginL, y, { size: 8, color: gray }); y -= lineH }

    // Titre droite
    const titleY = height - 40
    draw("FACTURE",                         marginR, titleY,      { size: 24, font: bold, color: black, align: "right" })
    draw(sanitize(invoice.invoice_number),   marginR, titleY - 22, { size: 12, font: bold, color: accent, align: "right" })
    draw(sanitize(`Emission : ${fmtDate(invoice.issue_date)}`), marginR, titleY - 38, { size: 9, color: gray, align: "right" })
    draw(sanitize(`Echeance : ${fmtDate(invoice.due_date)}`),   marginR, titleY - 52, { size: 9, color: gray, align: "right" })

    // ── BARRE ACCENT ─────────────────────────────────────────────────────────
    y = height - 130
    page.drawRectangle({ x: marginL, y, width: marginR - marginL, height: 3, color: accent })
    y -= 20

    // ── PARTIES ──────────────────────────────────────────────────────────────
    const col2 = width / 2 + 10

    draw("ÉMETTEUR",   marginL, y, { size: 7.5, font: bold, color: accent })
    draw("FACTURÉ À",  col2,    y, { size: 7.5, font: bold, color: accent })
    y -= 4
    hLine(y, marginL, marginL + 120, 0.8, accent)
    hLine(y, col2,    col2 + 120,    0.8, accent)
    y -= 10

    draw(sanitize(company?.name ?? "—"), marginL, y, { size: 10, font: bold })
    draw(sanitize(invoice.client?.name ?? "—"), col2, y, { size: 10, font: bold })
    y -= lineH

    if (company?.address)        draw(sanitize(company.address),        marginL, y, { size: 8, color: gray })
    if (invoice.client?.address) draw(sanitize(invoice.client.address), col2,    y, { size: 8, color: gray })
    y -= lineH

    draw(sanitize(`${company?.zip_code ?? ""} ${company?.city ?? ""}`).trim(),             marginL, y, { size: 8, color: gray })
    draw(sanitize(`${invoice.client?.zip_code ?? ""} ${invoice.client?.city ?? ""}`).trim(), col2,    y, { size: 8, color: gray })
    y -= lineH

    if (company?.siren)          draw(sanitize(`SIREN ${company.siren}`),          marginL, y, { size: 7.5, color: light })
    if (invoice.client?.email)   draw(sanitize(invoice.client.email),               col2,    y, { size: 8,   color: gray })
    y -= lineH

    if (company?.vat_number)     draw(sanitize(`TVA ${company.vat_number}`),         marginL, y, { size: 7.5, color: light })
    if (invoice.client?.siren)   draw(sanitize(`SIREN ${invoice.client.siren}`),    col2,    y, { size: 7.5, color: light })
    y -= 20

    // ── TABLEAU ───────────────────────────────────────────────────────────────
    const colW = { desc: 240, qty: 40, pu: 70, tva: 40, total: 70 }
    const colX = {
      desc:  marginL,
      qty:   marginL + colW.desc + colW.qty,
      pu:    marginL + colW.desc + colW.qty + colW.pu,
      tva:   marginL + colW.desc + colW.qty + colW.pu + colW.tva,
      total: marginL + colW.desc + colW.qty + colW.pu + colW.tva + colW.total,
    }

    // Header
    page.drawRectangle({ x: marginL, y: y - 4, width: marginR - marginL, height: 18, color: rgb(0.973, 0.980, 0.988) })
    draw("Désignation", colX.desc,  y + 2, { size: 7.5, font: bold, color: gray })
    draw("Qté",         colX.qty,   y + 2, { size: 7.5, font: bold, color: gray, align: "right" })
    draw("P.U. HT",     colX.pu,    y + 2, { size: 7.5, font: bold, color: gray, align: "right" })
    draw("TVA",         colX.tva,   y + 2, { size: 7.5, font: bold, color: gray, align: "right" })
    draw("Total HT",    colX.total, y + 2, { size: 7.5, font: bold, color: gray, align: "right" })
    y -= 20

    const lines: { description: string; quantity: number; unit_price_ht: number; vat_rate: number; total_ht: number }[] = invoice.lines ?? []
    lines.forEach((line, i) => {
      if (i % 2 === 1) {
        page.drawRectangle({ x: marginL, y: y - 4, width: marginR - marginL, height: 16, color: rgb(0.992, 0.992, 0.996) })
      }
      const descRaw = line.description.length > 45 ? line.description.slice(0, 42) + "..." : line.description
      const desc = sanitize(descRaw)
      draw(desc,                     colX.desc,  y + 2, { size: 8.5 })
      draw(String(line.quantity),    colX.qty,   y + 2, { size: 8.5, color: gray, align: "right" })
      draw(fmt(line.unit_price_ht),  colX.pu,    y + 2, { size: 8.5, color: gray, align: "right" })
      draw(`${line.vat_rate}%`,      colX.tva,   y + 2, { size: 8.5, color: gray, align: "right" })
      draw(fmt(line.total_ht),       colX.total, y + 2, { size: 8.5, font: bold,  align: "right" })
      y -= lineH + 2
      hLine(y + 2, marginL, marginR, 0.3)
    })
    y -= 10

    // ── TOTAUX ────────────────────────────────────────────────────────────────
    const totX    = marginR - 180
    const totValX = marginR

    draw("Sous-total HT",  totX, y, { size: 8.5, color: gray })
    draw(fmt(invoice.subtotal_ht), totValX, y, { size: 8.5, align: "right" })
    y -= lineH
    draw("TVA",            totX, y, { size: 8.5, color: gray })
    draw(fmt(invoice.total_vat),   totValX, y, { size: 8.5, align: "right" })
    y -= 6
    hLine(y, totX, marginR, 0.8, gray)
    y -= 10
    draw("Total TTC",      totX, y, { size: 11, font: bold })
    draw(fmt(invoice.total_ttc),   totValX, y, { size: 12, font: bold, color: accent, align: "right" })
    y -= lineH + 4

    if (company?.iban) {
      hLine(y, totX, marginR, 0.3)
      y -= 8
      draw("IBAN",                  totX,    y, { size: 7.5, color: light })
      draw(sanitize(company.iban),  totValX, y, { size: 7.5, color: gray, align: "right" })
      y -= lineH
    }
    y -= 16

    // ── NOTES ────────────────────────────────────────────────────────────────
    if (invoice.notes) {
      page.drawRectangle({ x: marginL, y: y - 8, width: 4, height: 32, color: accent })
      draw("CONDITIONS DE PAIEMENT / NOTES", marginL + 10, y + 14, { size: 7.5, font: bold, color: gray })
      invoice.notes.split("\n").slice(0, 2).forEach((l: string) => {
        draw(sanitize(l), marginL + 10, y, { size: 8, color: gray })
        y -= lineH
      })
      y -= 10
    }

    // ── MENTIONS LÉGALES ─────────────────────────────────────────────────────
    if (company?.legal_notice) {
      hLine(y, marginL, marginR)
      y -= 10
      company.legal_notice.split("\n").slice(0, 3).forEach((l: string) => {
        const ls = sanitize(l)
        const lw = regular.widthOfTextAtSize(ls, 7)
        draw(ls, (width - lw) / 2, y, { size: 7, color: light })
        y -= 10
      })
    }

    // ── FOOTER ───────────────────────────────────────────────────────────────
    hLine(30, marginL, marginR, 0.5, rgb(0.886, 0.914, 0.937))
    draw(sanitize(`${company?.name ?? "Qonforme"} - ${invoice.invoice_number}`), marginL, 20, { size: 7, color: light })
    draw("Genere par Qonforme", marginR, 20, { size: 7, color: accent, align: "right" })

    // ── Sauvegarder ──────────────────────────────────────────────────────────
    const uint8 = await doc.save()
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
