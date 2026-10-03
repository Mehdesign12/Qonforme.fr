import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { buildFacturX } from "@/lib/facturx/xml"
import { invoiceToFacturX } from "@/lib/facturx/records"

interface Params { params: Promise<{ id: string }> }

export async function GET(request: NextRequest, { params }: Params) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 })

    const { id } = await params

    const { data: invoice, error: invErr } = await supabase
      .from("invoices")
      .select("*, client:clients(id,name,email,address,zip_code,city,country,siren,vat_number)")
      .eq("id", id)
      .eq("user_id", user.id)
      .single()
    if (invErr || !invoice) return NextResponse.json({ error: "Facture introuvable" }, { status: 404 })

    // Le XML Factur-X est la facture électronique elle-même : rien pour un brouillon
    if (invoice.status === "draft") {
      return NextResponse.json({ error: "Émettez d'abord la facture : un brouillon n'a pas de fichier Factur-X." }, { status: 422 })
    }

    const { data: company } = await supabase
      .from("companies")
      .select("name,siren,siret,vat_number,address,zip_code,city,country,iban,legal_notice,email")
      .eq("user_id", user.id)
      .single()

    // Même modèle que le PDF (lib/pdf/invoice.ts) : le XML seul et le XML
    // embarqué dans le PDF sont identiques
    const { xml, warnings } = buildFacturX(invoiceToFacturX(invoice, company))
    if (warnings.length) console.warn(`[facturx] ${invoice.invoice_number} : ${warnings.join(" | ")}`)

    const filename = `${invoice.invoice_number}-facturx.xml`

    return new Response(xml, {
      status: 200,
      headers: {
        "Content-Type":        "application/xml; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control":       "no-store",
        "X-Facturx-Profile":   "EN 16931",
      },
    })
  } catch (err) {
    console.error("Factur-X generation error:", err)
    return NextResponse.json({ error: "Erreur génération Factur-X" }, { status: 500 })
  }
}
