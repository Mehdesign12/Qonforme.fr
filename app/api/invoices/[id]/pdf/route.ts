import { NextRequest, NextResponse } from "next/server"
import { createClient, createClientWithToken } from "@/lib/supabase/server"
import { generateInvoicePdf } from "@/lib/pdf/invoice"
import { invoiceNumberLabel } from "@/lib/utils/document-numbering"

interface Params { params: Promise<{ id: string }> }

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

    // Une facture pas encore émise sort filigranée « BROUILLON », sans XML Factur-X.
    // Elle n'a pas encore de numéro (attribué à l'émission) : « Brouillon » à la place.
    const isDraft = invoice.status === "draft"
    const number  = invoiceNumberLabel(invoice.invoice_number)
    const buffer = await generateInvoicePdf({
      invoice: { ...invoice, invoice_number: number },
      company,
      watermark: isDraft ? "BROUILLON" : undefined,
    })
    const filename = isDraft
      ? (invoice.invoice_number ? `brouillon-${invoice.invoice_number}` : `brouillon-facture-${String(invoice.id).slice(0, 8)}`)
      : number

    return new Response(buffer.buffer as ArrayBuffer, {
      status: 200,
      headers: {
        "Content-Type":        "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}.pdf"`,
        "Cache-Control":       "no-store",
        "X-Facturx-Profile":   "EN 16931",
      },
    })
  } catch (err) {
    console.error("PDF generation error:", err)
    return NextResponse.json({ error: "Erreur génération PDF" }, { status: 500 })
  }
}
