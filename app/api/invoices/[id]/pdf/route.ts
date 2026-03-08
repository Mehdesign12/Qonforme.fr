import { NextRequest, NextResponse } from "next/server"
import { PDFDocument, rgb, StandardFonts, PageSizes } from "pdf-lib"
import { createClient } from "@/lib/supabase/server"

interface Params {
  params: Promise<{ id: string }>
}

// ── helpers globaux ──────────────────────────────────────────────────────────

function fmt(n: number) {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency", currency: "EUR", minimumFractionDigits: 2,
  }).format(n)
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

    // 2. Charger entreprise
    const { data: company } = await supabase
      .from("companies")
      .select("name,siren,siret,vat_number,address,zip_code,city,iban,legal_notice,accent_color")
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

    let y = height - 40

    // ── HEADER ───────────────────────────────────────────────────────────────
    draw(company?.name ?? "Votre entreprise", marginL, y, { size: 18, font: bold, color: accent })
    y -= 18
    if (company?.address)              { draw(company.address, marginL, y, { size: 8, color: gray }); y -= lineH }
    if (company?.zip_code || company?.city) {
      draw(`${company?.zip_code ?? ""} ${company?.city ?? ""}`.trim(), marginL, y, { size: 8, color: gray }); y -= lineH
    }
    if (company?.siren)                { draw(`SIREN : ${company.siren}`, marginL, y, { size: 8, color: gray }); y -= lineH }
    if (company?.vat_number)           { draw(`TVA : ${company.vat_number}`, marginL, y, { size: 8, color: gray }); y -= lineH }

    // Titre droite
    const titleY = height - 40
    draw("FACTURE",              marginR, titleY,      { size: 24, font: bold, color: black, align: "right" })
    draw(invoice.invoice_number, marginR, titleY - 22, { size: 12, font: bold, color: accent, align: "right" })
    draw(`Émission : ${fmtDate(invoice.issue_date)}`, marginR, titleY - 38, { size: 9, color: gray, align: "right" })
    draw(`Échéance : ${fmtDate(invoice.due_date)}`,   marginR, titleY - 52, { size: 9, color: gray, align: "right" })

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

    draw(company?.name ?? "—", marginL, y, { size: 10, font: bold })
    draw(invoice.client?.name ?? "—", col2, y, { size: 10, font: bold })
    y -= lineH

    if (company?.address)   draw(company.address, marginL, y, { size: 8, color: gray })
    if (invoice.client?.address) draw(invoice.client.address, col2, y, { size: 8, color: gray })
    y -= lineH

    draw(`${company?.zip_code ?? ""} ${company?.city ?? ""}`.trim(), marginL, y, { size: 8, color: gray })
    draw(`${invoice.client?.zip_code ?? ""} ${invoice.client?.city ?? ""}`.trim(), col2, y, { size: 8, color: gray })
    y -= lineH

    if (company?.siren)          draw(`SIREN ${company.siren}`, marginL, y, { size: 7.5, color: light })
    if (invoice.client?.email)   draw(invoice.client.email,     col2,    y, { size: 8,   color: gray })
    y -= lineH

    if (company?.vat_number)     draw(`TVA ${company.vat_number}`,    marginL, y, { size: 7.5, color: light })
    if (invoice.client?.siren)   draw(`SIREN ${invoice.client.siren}`, col2,    y, { size: 7.5, color: light })
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
      const desc = line.description.length > 45 ? line.description.slice(0, 42) + "…" : line.description
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
      draw("IBAN",       totX,    y, { size: 7.5, color: light })
      draw(company.iban, totValX, y, { size: 7.5, color: gray, align: "right" })
      y -= lineH
    }
    y -= 16

    // ── NOTES ────────────────────────────────────────────────────────────────
    if (invoice.notes) {
      page.drawRectangle({ x: marginL, y: y - 8, width: 4, height: 32, color: accent })
      draw("CONDITIONS DE PAIEMENT / NOTES", marginL + 10, y + 14, { size: 7.5, font: bold, color: gray })
      invoice.notes.split("\n").slice(0, 2).forEach((l: string) => {
        draw(l, marginL + 10, y, { size: 8, color: gray })
        y -= lineH
      })
      y -= 10
    }

    // ── MENTIONS LÉGALES ─────────────────────────────────────────────────────
    if (company?.legal_notice) {
      hLine(y, marginL, marginR)
      y -= 10
      company.legal_notice.split("\n").slice(0, 3).forEach((l: string) => {
        const lw = regular.widthOfTextAtSize(l, 7)
        draw(l, (width - lw) / 2, y, { size: 7, color: light })
        y -= 10
      })
    }

    // ── FOOTER ───────────────────────────────────────────────────────────────
    hLine(30, marginL, marginR, 0.5, rgb(0.886, 0.914, 0.937))
    draw(`${company?.name ?? "Qonforme"} — ${invoice.invoice_number}`, marginL, 20, { size: 7, color: light })
    draw("Généré par Qonforme", marginR, 20, { size: 7, color: accent, align: "right" })

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
