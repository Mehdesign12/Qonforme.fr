import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { generateInvoicePdf } from "@/lib/pdf/invoice"

interface Params { params: Promise<{ id: string }> }

export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 })

    const { id } = await params

    const { data: invoice, error: invErr } = await supabase
      .from("invoices")
      .select("*, client:clients(id,name,email,address,zip_code,city,siren,vat_number)")
      .eq("id", id)
      .eq("user_id", user.id)
      .single()
    if (invErr || !invoice) return NextResponse.json({ error: "Facture introuvable" }, { status: 404 })

    const { data: company } = await supabase
      .from("companies")
      .select("name,siren,siret,vat_number,address,zip_code,city,iban,legal_notice,accent_color,logo_url")
      .eq("user_id", user.id)
      .single()

    const buffer = await generateInvoicePdf({ invoice, company })

    return new Response(buffer.buffer as ArrayBuffer, {
      status: 200,
      headers: {
        "Content-Type":        "application/pdf",
        "Content-Disposition": `attachment; filename="${invoice.invoice_number}.pdf"`,
        "Cache-Control":       "no-store",
        "X-Facturx-Profile":   "EN 16931",
      },
    })
  } catch (err) {
    console.error("PDF generation error:", err)
    return NextResponse.json({ error: "Erreur génération PDF" }, { status: 500 })
  }
}
