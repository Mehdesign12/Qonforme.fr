import { NextRequest, NextResponse } from "next/server"
import { createClient, createClientWithToken } from "@/lib/supabase/server"
import { generateCreditNotePdf } from "@/lib/pdf/credit-note"

interface Params { params: Promise<{ id: string }> }

// Support Bearer token ET cookies (navigation browser)
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

    const { data: company } = await supabase
      .from("companies")
      .select("name,siren,siret,vat_number,address,zip_code,city,iban,legal_notice,accent_color,logo_url")
      .eq("user_id", user.id)
      .single()

    const buffer = await generateCreditNotePdf({ creditNote, company })

    return new Response(buffer.buffer as ArrayBuffer, {
      status: 200,
      headers: {
        "Content-Type":        "application/pdf",
        "Content-Disposition": `attachment; filename="${creditNote.credit_note_number}.pdf"`,
        "Cache-Control":       "no-store",
      },
    })
  } catch (err) {
    console.error("PDF avoir error:", err)
    return NextResponse.json({ error: "Erreur génération PDF" }, { status: 500 })
  }
}
