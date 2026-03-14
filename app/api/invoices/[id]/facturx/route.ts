import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { generateFacturXml } from "@/lib/facturx/xml"

interface Params { params: Promise<{ id: string }> }

export async function GET(request: NextRequest, { params }: Params) {
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
      .select("name,siren,siret,vat_number,address,zip_code,city,iban,legal_notice")
      .eq("user_id", user.id)
      .single()

    const xml = generateFacturXml({
      invoice_number: invoice.invoice_number,
      issue_date:     invoice.issue_date,
      due_date:       invoice.due_date,
      seller: {
        name:         company?.name         ?? "Mon entreprise",
        address:      company?.address      ?? "",
        zip_code:     company?.zip_code     ?? "",
        city:         company?.city         ?? "",
        siren:        company?.siren        ?? undefined,
        siret:        company?.siret        ?? undefined,
        vat_number:   company?.vat_number   ?? undefined,
        iban:         company?.iban         ?? undefined,
        legal_notice: company?.legal_notice ?? undefined,
      },
      buyer: {
        name:       invoice.client?.name       ?? "Client",
        address:    invoice.client?.address    ?? undefined,
        zip_code:   invoice.client?.zip_code   ?? undefined,
        city:       invoice.client?.city       ?? undefined,
        siren:      invoice.client?.siren      ?? undefined,
        vat_number: invoice.client?.vat_number ?? undefined,
        email:      invoice.client?.email      ?? undefined,
      },
      lines: (invoice.lines ?? []).map((l: {
        description: string
        quantity: number
        unit_price_ht: number
        vat_rate: number
        total_ht: number
        total_vat: number
        total_ttc: number
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
    })

    const filename = `${invoice.invoice_number}-facturx.xml`

    return new Response(xml, {
      status: 200,
      headers: {
        "Content-Type":        "application/xml; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control":       "no-store",
        "X-Facturx-Profile":   "EN 16931 EXTENDED",
      },
    })
  } catch (err) {
    console.error("Factur-X generation error:", err)
    return NextResponse.json({ error: "Erreur génération Factur-X" }, { status: 500 })
  }
}
