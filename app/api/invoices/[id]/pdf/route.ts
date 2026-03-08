import { NextRequest, NextResponse } from "next/server"
import { PDFDocument, rgb, PageSizes } from "pdf-lib"
import fontkit from "@pdf-lib/fontkit"
import { createClient } from "@/lib/supabase/server"
import { generateFacturXml } from "@/lib/facturx/xml"
import type { FxInvoice } from "@/lib/facturx/xml"
import path from "path"
import fs from "fs"

interface Params {
  params: Promise<{ id: string }>
}

// ── Helpers visuels ──────────────────────────────────────────────────────────

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
  try { return new Intl.DateTimeFormat("fr-FR").format(new Date(d)) }
  catch { return d }
}

// ── XMP metadata PDF/A-3 + Factur-X ─────────────────────────────────────────

function buildXmpMetadata(invoiceNumber: string, invoiceDate: string): string {
  const now = new Date().toISOString()
  return `<?xpacket begin="\uFEFF" id="W5M0MpCehiHzreSzNTczkc9d"?>
<x:xmpmeta xmlns:x="adobe:ns:meta/">
  <rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">

    <!-- PDF/A-3 conformance -->
    <rdf:Description rdf:about=""
      xmlns:pdfaid="http://www.aiim.org/pdfa/ns/id/">
      <pdfaid:part>3</pdfaid:part>
      <pdfaid:conformance>B</pdfaid:conformance>
    </rdf:Description>

    <!-- Factur-X -->
    <rdf:Description rdf:about=""
      xmlns:fx="urn:factur-x:pdfa:CrossIndustryDocument:invoice:1p0#">
      <fx:DocumentFileName>factur-x.xml</fx:DocumentFileName>
      <fx:DocumentType>INVOICE</fx:DocumentType>
      <fx:Version>1.0</fx:Version>
      <fx:ConformanceLevel>EN 16931</fx:ConformanceLevel>
    </rdf:Description>

    <!-- Dublin Core -->
    <rdf:Description rdf:about=""
      xmlns:dc="http://purl.org/dc/elements/1.1/">
      <dc:format>application/pdf</dc:format>
      <dc:title>
        <rdf:Alt><rdf:li xml:lang="x-default">Facture ${invoiceNumber}</rdf:li></rdf:Alt>
      </dc:title>
      <dc:description>
        <rdf:Alt><rdf:li xml:lang="x-default">Facture électronique Factur-X ${invoiceNumber} du ${invoiceDate}</rdf:li></rdf:Alt>
      </dc:description>
      <dc:creator><rdf:Seq><rdf:li>Qonforme</rdf:li></rdf:Seq></dc:creator>
    </rdf:Description>

    <!-- XMP Basic -->
    <rdf:Description rdf:about=""
      xmlns:xmp="http://ns.adobe.com/xap/1.0/">
      <xmp:CreatorTool>Qonforme Factur-X Generator</xmp:CreatorTool>
      <xmp:CreateDate>${now}</xmp:CreateDate>
      <xmp:ModifyDate>${now}</xmp:ModifyDate>
    </rdf:Description>

    <!-- PDF metadata -->
    <rdf:Description rdf:about=""
      xmlns:pdf="http://ns.adobe.com/pdf/1.3/">
      <pdf:Producer>Qonforme — pdf-lib</pdf:Producer>
    </rdf:Description>

  </rdf:RDF>
</x:xmpmeta>
<?xpacket end="w"?>`
}

// ── Embed XML Factur-X via pdf-lib (attachments natifs) ─────────────────────
// Pas de manipulation manuelle des bytes — pdf-lib gère l'EmbeddedFile proprement.

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

    // ── 3. Générer le XML Factur-X ──────────────────────────────────────────
    const fxData: FxInvoice = {
      invoice_number: invoice.invoice_number,
      issue_date:     invoice.issue_date,
      due_date:       invoice.due_date,
      currency:       "EUR",
      seller: {
        name:          company?.name        ?? "",
        address:       company?.address     ?? "",
        zip_code:      company?.zip_code    ?? "",
        city:          company?.city        ?? "",
        country:       "FR",
        siren:         company?.siren       ?? undefined,
        siret:         company?.siret       ?? undefined,
        vat_number:    company?.vat_number  ?? undefined,
        iban:          company?.iban        ?? undefined,
        legal_notice:  company?.legal_notice ?? undefined,
      },
      buyer: {
        name:       invoice.client?.name      ?? "Client inconnu",
        address:    invoice.client?.address   ?? undefined,
        zip_code:   invoice.client?.zip_code  ?? undefined,
        city:       invoice.client?.city      ?? undefined,
        country:    "FR",
        siren:      invoice.client?.siren     ?? undefined,
        vat_number: invoice.client?.vat_number ?? undefined,
        email:      invoice.client?.email     ?? undefined,
      },
      lines: (invoice.lines ?? []).map((l: {
        description: string; quantity: number; unit_price_ht: number
        vat_rate: number; total_ht: number; total_vat: number; total_ttc: number
      }, i: number) => ({
        id:            i + 1,
        description:   l.description,
        quantity:      l.quantity,
        unit_price_ht: l.unit_price_ht,
        vat_rate:      l.vat_rate,
        total_ht:      l.total_ht,
        total_vat:     l.total_vat,
        total_ttc:     l.total_ttc,
      })),
      subtotal_ht: invoice.subtotal_ht,
      total_vat:   invoice.total_vat,
      total_ttc:   invoice.total_ttc,
      notes:       invoice.notes ?? null,
    }

    const xmlContent = generateFacturXml(fxData)

    // ── 4. Générer le PDF visuel ────────────────────────────────────────────
    const doc = await PDFDocument.create()
    doc.registerFontkit(fontkit)

    const fontsDir    = path.join(process.cwd(), "public", "fonts")
    const fontRegular = await doc.embedFont(fs.readFileSync(path.join(fontsDir, "Roboto-Regular.ttf")))
    const fontBold    = await doc.embedFont(fs.readFileSync(path.join(fontsDir, "Roboto-Bold.ttf")))

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
      let str = text ?? ""
      if (maxWidth) {
        while (str.length > 0 && font.widthOfTextAtSize(str, size) > maxWidth) str = str.slice(0, -1)
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

    // ═══ HEADER ═══════════════════════════════════════════════════════════════
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

    // Badge Factur-X en haut à droite (sous l'échéance)
    const badgeY  = curY - 66
    const badgeX  = mR - 64
    rect(badgeX, badgeY - 4, 64, 14, rgb(0.94, 0.97, 1.0))
    draw("✓ Factur-X", mR - 4, badgeY + 2, { size: 7, bold: true, color: accent, align: "right" })

    let infoY = curY - logoMaxH - 4
    if (company?.address)      { draw(company.address, mL, infoY, { size: 8, color: grayDark }); infoY -= 12 }
    const cityLine = [company?.zip_code, company?.city].filter(Boolean).join(" ")
    if (cityLine)              { draw(cityLine, mL, infoY, { size: 8, color: grayDark }); infoY -= 12 }
    if (company?.siren)        { draw(`SIREN : ${company.siren}`, mL, infoY, { size: 7.5, color: grayLight }); infoY -= 11 }
    if (company?.vat_number)   { draw(`TVA : ${company.vat_number}`, mL, infoY, { size: 7.5, color: grayLight }) }

    const barY = height - 130
    rect(mL, barY, cW, 3, accent)

    // ═══ ÉMETTEUR / FACTURÉ À ═════════════════════════════════════════════════
    curY = barY - 20
    const col2 = mL + cW / 2 + 8
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

    if (invoice.client?.email)  draw(invoice.client.email, col2, curY, { size: 8, color: grayDark })
    if (company?.siren)         draw(`SIREN ${company.siren}`, mL, curY, { size: 7.5, color: grayLight })
    curY -= 13

    if (company?.vat_number || invoice.client?.siren) {
      if (company?.vat_number)    draw(`TVA ${company.vat_number}`, mL, curY, { size: 7.5, color: grayLight })
      if (invoice.client?.siren)  draw(`SIREN ${invoice.client.siren}`, col2, curY, { size: 7.5, color: grayLight })
      curY -= 13
    }
    curY -= 12

    // ═══ TABLEAU DES PRESTATIONS ══════════════════════════════════════════════
    const colDesc = mL, colQty = mL + 250, colPU = mL + 300, colTVA = mL + 378, colTotal = mR
    const tableHeaderH = 20

    rect(mL, curY - 4, cW, tableHeaderH, rgb(0.95, 0.97, 1.00))
    draw("Désignation", colDesc,  curY + 4, { size: 7.5, bold: true, color: grayDark })
    draw("Qté",         colQty,   curY + 4, { size: 7.5, bold: true, color: grayDark, align: "right" })
    draw("P.U. HT",     colPU,    curY + 4, { size: 7.5, bold: true, color: grayDark, align: "right" })
    draw("TVA",         colTVA,   curY + 4, { size: 7.5, bold: true, color: grayDark, align: "right" })
    draw("Total HT",    colTotal, curY + 4, { size: 7.5, bold: true, color: grayDark, align: "right" })
    curY -= tableHeaderH + 2

    const lines: { description: string; quantity: number; unit_price_ht: number; vat_rate: number; total_ht: number }[] = invoice.lines ?? []
    const rowH = 18
    lines.forEach((line, i) => {
      if (i % 2 === 1) rect(mL, curY - 4, cW, rowH, rowAlt)
      draw(line.description,          colDesc,  curY + 2, { size: 8.5, color: black, maxWidth: 240 })
      draw(String(line.quantity),     colQty,   curY + 2, { size: 8.5, color: grayDark, align: "right" })
      draw(fmt(line.unit_price_ht),   colPU,    curY + 2, { size: 8.5, color: grayDark, align: "right" })
      draw(`${line.vat_rate} %`,      colTVA,   curY + 2, { size: 8.5, color: grayDark, align: "right" })
      draw(fmt(line.total_ht),        colTotal, curY + 2, { size: 8.5, bold: true, color: black, align: "right" })
      curY -= rowH
      hLine(curY + 2, mL, mR, 0.3, rgb(0.92, 0.93, 0.95))
    })
    curY -= 16

    // ═══ TOTAUX ═══════════════════════════════════════════════════════════════
    const totBlockW = 210, totX = mR - totBlockW, totValX = mR

    draw("Sous-total HT", totX, curY, { size: 8.5, color: grayDark })
    draw(fmt(invoice.subtotal_ht), totValX, curY, { size: 8.5, color: black, align: "right" })
    curY -= 14

    draw("TVA", totX, curY, { size: 8.5, color: grayDark })
    draw(fmt(invoice.total_vat), totValX, curY, { size: 8.5, color: black, align: "right" })
    curY -= 8
    hLine(curY, totX, mR, 0.8, grayLight)
    curY -= 16

    hLine(curY, totX, mR, 1.5, accent)
    curY -= 14
    draw("TOTAL TTC",            totX,    curY, { size: 10, bold: true, color: accent })
    draw(fmt(invoice.total_ttc), totValX, curY, { size: 14, bold: true, color: accent, align: "right" })
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

    // ═══ NOTES ════════════════════════════════════════════════════════════════
    if (invoice.notes?.trim()) {
      rect(mL, curY - 2, 3, 28, accent)
      draw("CONDITIONS DE PAIEMENT / NOTES", mL + 10, curY + 14, { size: 7.5, bold: true, color: grayDark })
      invoice.notes.trim().split("\n").slice(0, 3).forEach((l: string) => {
        draw(l, mL + 10, curY, { size: 8, color: grayDark, maxWidth: cW - 20 })
        curY -= 13
      })
      curY -= 10
    }

    // ═══ MENTIONS LÉGALES ═════════════════════════════════════════════════════
    if (company?.legal_notice?.trim()) {
      hLine(curY, mL, mR, 0.5, separator)
      curY -= 12
      company.legal_notice.trim().split("\n").slice(0, 4).forEach((l: string) => {
        const tw = fontRegular.widthOfTextAtSize(l, 7)
        draw(l, Math.max(mL, (width - tw) / 2), curY, { size: 7, color: grayLight })
        curY -= 10
      })
    }

    // ═══ FOOTER ═══════════════════════════════════════════════════════════════
    hLine(32, mL, mR, 0.5, separator)
    draw(`${company?.name ?? "Qonforme"} — ${invoice.invoice_number}`, mL, 20, { size: 7, color: grayLight })
    draw("Factur-X EN 16931 — Généré par Qonforme", mR, 20, { size: 7, color: accent, align: "right" })

    // ── 5. Injecter les métadonnées XMP ────────────────────────────────────
    const xmpXml = buildXmpMetadata(invoice.invoice_number, fmtDate(invoice.issue_date))
    doc.setTitle(`Facture ${invoice.invoice_number}`)
    doc.setAuthor(company?.name ?? "Qonforme")
    doc.setSubject(`Facture électronique Factur-X — ${invoice.invoice_number}`)
    doc.setProducer("Qonforme — pdf-lib + Factur-X")
    doc.setCreator("Qonforme Factur-X Generator")

    // Injecter le XMP comme metadata raw
    // pdf-lib expose setMetadata via l'objet interne
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(doc as any).catalog.set(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (doc as any).context.obj("Metadata"),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (doc as any).context.stream(xmpXml, {
        Type:    "Metadata",
        Subtype: "XML",
      })
    )

    // ── 6. Attacher le XML Factur-X via l'API native pdf-lib ──────────────
    // doc.attach() ajoute un EmbeddedFile conforme PDF/A-3 sans manipulation
    // manuelle des bytes (évite la corruption du PDF).
    const xmlBytes = new TextEncoder().encode(xmlContent)
    await doc.attach(xmlBytes, "factur-x.xml", {
      mimeType:    "application/xml",
      description: "Factur-X EN 16931",
      creationDate: new Date(),
      modificationDate: new Date(),
    })

    // ── 7. Sauvegarder le PDF final ────────────────────────────────────────
    const pdfBytes = await doc.save()
    const buffer = Buffer.from(pdfBytes)

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type":        "application/pdf",
        "Content-Disposition": `attachment; filename="${invoice.invoice_number}.pdf"`,
        "Content-Length":      buffer.length.toString(),
        "Cache-Control":       "no-store",
        "X-Facturx-Profile":   "EN 16931",
      },
    })
  } catch (err) {
    console.error("PDF/Factur-X generation error:", err)
    return NextResponse.json({ error: "Erreur génération PDF Factur-X" }, { status: 500 })
  }
}
