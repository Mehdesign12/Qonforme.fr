import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { sendEmail } from "@/lib/email/resend"
import { buildQuoteEmail } from "@/lib/email/templates/quote"
import { PDFDocument, rgb, PageSizes } from "pdf-lib"
import fontkit from "@pdf-lib/fontkit"
import path from "path"
import fs from "fs"

interface Params { params: Promise<{ id: string }> }

// Génère le PDF du devis en réutilisant la même logique que la route GET
async function generateQuotePdf(quote: Record<string, unknown>, company: Record<string, unknown> | null): Promise<Buffer> {
  const doc = await PDFDocument.create()
  doc.registerFontkit(fontkit)

  const fontsDir    = path.join(process.cwd(), "public", "fonts")
  const fontRegular = await doc.embedFont(fs.readFileSync(path.join(fontsDir, "Roboto-Regular.ttf")))
  const fontBold    = await doc.embedFont(fs.readFileSync(path.join(fontsDir, "Roboto-Bold.ttf")))

  const page = doc.addPage(PageSizes.A4)
  const { width, height } = page.getSize()

  const hexToRgb = (hex: string) => {
    const h = (hex ?? "#15803D").replace("#", "").padEnd(6, "0")
    return rgb(parseInt(h.slice(0,2),16)/255, parseInt(h.slice(2,4),16)/255, parseInt(h.slice(4,6),16)/255)
  }
  const fmt = (n: number) => {
    const parts = (Math.round(n*100)/100).toFixed(2).split(".")
    return `${parts[0].replace(/\B(?=(\d{3})+(?!\d))/g,"\u00A0")},${parts[1]}\u00A0€`
  }
  const fmtD = (d: string) => { try { return new Intl.DateTimeFormat("fr-FR").format(new Date(d)) } catch { return d } }

  const quoteGreen = hexToRgb((company as { accent_color?: string } | null)?.accent_color ?? "#15803D")
  const black      = rgb(0.06, 0.09, 0.17)
  const grayDark   = rgb(0.28, 0.34, 0.41)
  const grayLight  = rgb(0.58, 0.64, 0.70)
  const separator  = rgb(0.89, 0.91, 0.94)
  const rowAlt     = rgb(0.97, 0.98, 0.99)

  const mL = 48, mR = width - 48, cW = mR - mL

  const draw = (text: string, x: number, y: number,
    opts: { size?: number; bold?: boolean; color?: ReturnType<typeof rgb>; align?: "left"|"right"|"center"; maxWidth?: number } = {}) => {
    const { size = 9, bold: isBold = false, color = black, align = "left", maxWidth } = opts
    const font = isBold ? fontBold : fontRegular
    let str = text ?? ""
    if (maxWidth) { while (str.length > 0 && font.widthOfTextAtSize(str, size) > maxWidth) str = str.slice(0,-1); if (str.length < (text??"").length) str = str.slice(0,-1)+"…" }
    const tw = font.widthOfTextAtSize(str, size)
    const drawX = align === "right" ? x - tw : align === "center" ? x - tw/2 : x
    page.drawText(str, { x: drawX, y, size, font, color })
  }
  const hLine = (y: number, x1=mL, x2=mR, t=0.5, c=separator) => page.drawLine({ start:{x:x1,y}, end:{x:x2,y}, thickness:t, color:c })
  const rect  = (x:number,y:number,w:number,h:number,c:ReturnType<typeof rgb>) => page.drawRectangle({x,y,width:w,height:h,color:c})

  const client = quote.client as Record<string,string> | null
  const co = company as Record<string,string> | null

  let curY = height - 44
  draw(co?.name ?? "Votre entreprise", mL, curY, { size:16, bold:true, color:quoteGreen })
  draw("DEVIS", mR, curY, { size:22, bold:true, color:black, align:"right" })
  draw(quote.quote_number as string, mR, curY-20, { size:11, bold:true, color:quoteGreen, align:"right" })
  draw(`Émission : ${fmtD(quote.issue_date as string)}`, mR, curY-36, { size:8.5, color:grayDark, align:"right" })
  draw(`Valable jusqu'au : ${fmtD(quote.valid_until as string)}`, mR, curY-50, { size:8.5, color:grayDark, align:"right" })

  let infoY = curY - 60
  if (co?.address) { draw(co.address, mL, infoY, {size:8,color:grayDark}); infoY-=12 }
  const cityLine = [co?.zip_code, co?.city].filter(Boolean).join(" ")
  if (cityLine) { draw(cityLine, mL, infoY, {size:8,color:grayDark}); infoY-=12 }
  if (co?.siren) { draw(`SIREN : ${co.siren}`, mL, infoY, {size:7.5,color:grayLight}); infoY-=11 }

  const barY = height - 130
  rect(mL, barY, cW, 3, quoteGreen)

  curY = barY - 20
  const col2 = mL + cW/2 + 8, colW2 = cW/2 - 8
  draw("ÉMETTEUR",  mL,   curY, {size:7,bold:true,color:quoteGreen})
  draw("DESTINATAIRE", col2, curY, {size:7,bold:true,color:quoteGreen})
  curY -= 4
  hLine(curY, mL, mL+80, 0.8, quoteGreen)
  hLine(curY, col2, col2+80, 0.8, quoteGreen)
  curY -= 13
  draw(co?.name ?? "—", mL, curY, {size:10,bold:true,color:black,maxWidth:colW2})
  draw(client?.name ?? "—", col2, curY, {size:10,bold:true,color:black,maxWidth:colW2})
  curY -= 14
  if (co?.address||client?.address) { draw(co?.address??"",mL,curY,{size:8.5,color:grayDark,maxWidth:colW2}); draw(client?.address??"",col2,curY,{size:8.5,color:grayDark,maxWidth:colW2}); curY-=13 }
  const cc2=[co?.zip_code,co?.city].filter(Boolean).join(" "), cl2=[client?.zip_code,client?.city].filter(Boolean).join(" ")
  if (cc2||cl2) { draw(cc2,mL,curY,{size:8.5,color:grayDark}); draw(cl2,col2,curY,{size:8.5,color:grayDark}); curY-=13 }
  if (client?.email) draw(client.email,col2,curY,{size:8,color:grayDark})
  if (co?.siren) draw(`SIREN ${co.siren}`,mL,curY,{size:7.5,color:grayLight})
  curY -= 25

  const colDesc=mL, colQty=mL+250, colPU=mL+300, colTVA=mL+378, colTotal=mR, tHH=20
  rect(mL, curY-4, cW, tHH, rgb(0.94,0.99,0.96))
  draw("Désignation",colDesc,curY+4,{size:7.5,bold:true,color:grayDark})
  draw("Qté",colQty,curY+4,{size:7.5,bold:true,color:grayDark,align:"right"})
  draw("P.U. HT",colPU,curY+4,{size:7.5,bold:true,color:grayDark,align:"right"})
  draw("TVA",colTVA,curY+4,{size:7.5,bold:true,color:grayDark,align:"right"})
  draw("Total HT",colTotal,curY+4,{size:7.5,bold:true,color:grayDark,align:"right"})
  curY -= tHH+2

  const lines = (quote.lines as { description:string;quantity:number;unit_price_ht:number;vat_rate:number;total_ht:number }[]) ?? []
  lines.forEach((l,i) => {
    if (i%2===1) rect(mL,curY-4,cW,18,rowAlt)
    draw(l.description,colDesc,curY+2,{size:8.5,color:black,maxWidth:240})
    draw(String(l.quantity),colQty,curY+2,{size:8.5,color:grayDark,align:"right"})
    draw(fmt(l.unit_price_ht),colPU,curY+2,{size:8.5,color:grayDark,align:"right"})
    draw(`${l.vat_rate} %`,colTVA,curY+2,{size:8.5,color:grayDark,align:"right"})
    draw(fmt(l.total_ht),colTotal,curY+2,{size:8.5,bold:true,color:black,align:"right"})
    curY -= 18; hLine(curY+2,mL,mR,0.3,rgb(0.92,0.93,0.95))
  })
  curY -= 16

  const totX=mR-210, totValX=mR
  draw("Sous-total HT",totX,curY,{size:8.5,color:grayDark}); draw(fmt(quote.subtotal_ht as number),totValX,curY,{size:8.5,color:black,align:"right"}); curY-=14
  draw("TVA",totX,curY,{size:8.5,color:grayDark}); draw(fmt(quote.total_vat as number),totValX,curY,{size:8.5,color:black,align:"right"}); curY-=8
  hLine(curY,totX,mR,0.8,grayLight); curY-=16
  hLine(curY,totX,mR,1.5,quoteGreen); curY-=14
  draw("TOTAL TTC",totX,curY,{size:10,bold:true,color:quoteGreen})
  draw(fmt(quote.total_ttc as number),totValX,curY,{size:14,bold:true,color:quoteGreen,align:"right"})
  curY -= 30

  if ((quote.notes as string)?.trim()) {
    rect(mL,curY-2,3,28,quoteGreen)
    draw("NOTES",mL+10,curY+14,{size:7.5,bold:true,color:grayDark})
    ;(quote.notes as string).trim().split("\n").slice(0,3).forEach((l:string) => { draw(l,mL+10,curY,{size:8,color:grayDark,maxWidth:cW-20}); curY-=13 })
    curY-=10
  }

  if (co?.legal_notice?.trim()) {
    hLine(curY,mL,mR,0.5,separator); curY-=12
    co.legal_notice.trim().split("\n").slice(0,4).forEach((l:string) => { const tw=fontRegular.widthOfTextAtSize(l,7); draw(l,Math.max(mL,(width-tw)/2),curY,{size:7,color:grayLight}); curY-=10 })
  }

  hLine(32,mL,mR,0.5,separator)
  draw(`${co?.name??"Qonforme"} — ${quote.quote_number as string}`,mL,20,{size:7,color:grayLight})
  draw("Généré par Qonforme",mR,20,{size:7,color:quoteGreen,align:"right"})

  doc.setTitle(`Devis ${quote.quote_number as string}`)
  doc.setAuthor(co?.name ?? "Qonforme")

  const pdfBytes = await doc.save()
  return Buffer.from(pdfBytes)
}

export async function POST(_req: NextRequest, { params }: Params) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 })

    const { id } = await params

    const { data: quote, error: qErr } = await supabase
      .from("quotes")
      .select("*, client:clients(id,name,email,address,zip_code,city,siren,vat_number)")
      .eq("id", id)
      .eq("user_id", user.id)
      .single()
    if (qErr || !quote) return NextResponse.json({ error: "Devis introuvable" }, { status: 404 })

    const clientEmail = quote.client?.email
    if (!clientEmail) return NextResponse.json({ error: "Le client n'a pas d'adresse email" }, { status: 422 })

    const { data: company } = await supabase
      .from("companies")
      .select("name,siren,siret,vat_number,address,zip_code,city,iban,legal_notice,accent_color,logo_url,email")
      .eq("user_id", user.id)
      .single()

    const accentColor = (company as { accent_color?: string } | null)?.accent_color ?? "#15803D"
    const companyName = (company as { name?: string } | null)?.name ?? "Votre prestataire"
    const senderEmail = (company as { email?: string } | null)?.email ?? user.email

    const pdfBuffer = await generateQuotePdf(quote as Record<string,unknown>, company as Record<string,unknown> | null)

    const { subject, html } = buildQuoteEmail({
      quoteNumber:  quote.quote_number,
      issueDate:    quote.issue_date,
      validUntil:   quote.valid_until,
      subtotalHt:   quote.subtotal_ht,
      totalVat:     quote.total_vat,
      totalTtc:     quote.total_ttc,
      notes:        quote.notes,
      companyName,
      accentColor,
      clientName:   quote.client?.name ?? "",
      appUrl:       process.env.NEXT_PUBLIC_APP_URL ?? "https://qonforme.fr",
    })

    const cc = senderEmail ? [senderEmail] : []
    await sendEmail({
      to:          clientEmail,
      subject,
      html,
      replyTo:     senderEmail,
      cc,
      attachments: [{ filename: `${quote.quote_number}.pdf`, content: pdfBuffer }],
    })

    await supabase
      .from("quotes")
      .update({ status: "sent", sent_at: new Date().toISOString() })
      .eq("id", id)
      .eq("user_id", user.id)

    return NextResponse.json({ success: true, sentTo: clientEmail })
  } catch (err) {
    console.error("Quote send error:", err)
    const message = err instanceof Error ? err.message : "Erreur inconnue"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
