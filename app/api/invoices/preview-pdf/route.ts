import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { generateInvoicePdf } from "@/lib/pdf/invoice"
import { getNextDocumentNumber } from "@/lib/utils/document-numbering"

// POST /api/invoices/preview-pdf — génère un aperçu PDF SANS créer de facture.
//
// Avant ce fix, le bouton "Aperçu PDF" du formulaire appelait POST /api/invoices
// (la route de création réelle) : chaque aperçu créait un vrai brouillon avec un
// numéro de facture définitif, consommait un slot du quota mensuel du plan
// Starter, et laissait un brouillon orphelin dès que l'utilisateur ajustait sa
// facture et cliquait "Envoyer" depuis un formulaire vierge. Cette route ne fait
// qu'un GET (numérotation) + une génération PDF en mémoire, sans aucune écriture.
export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 })

  const body = await request.json()

  const { data: company } = await supabase
    .from("companies")
    .select("name,siren,siret,vat_number,address,zip_code,city,iban,legal_notice,accent_color,logo_url,invoice_prefix")
    .eq("user_id", user.id)
    .single()

  let client = null
  if (body.client_id) {
    const { data } = await supabase
      .from("clients")
      .select("name,email,address,zip_code,city,siren,vat_number")
      .eq("id", body.client_id)
      .eq("user_id", user.id)
      .single()
    client = data
  }

  const prefix = company?.invoice_prefix || "F"
  const year   = new Date().getFullYear()
  // Lecture seule : reflète le prochain numéro réel sans rien réserver ni écrire.
  const invoice_number = await getNextDocumentNumber(supabase, "invoices", "invoice_number", user.id, `${prefix}-${year}-`)

  const lines       = body.lines || []
  const subtotal_ht = lines.reduce((s: number, l: { total_ht: number }) => s + (l.total_ht || 0), 0)
  const total_vat    = lines.reduce((s: number, l: { total_vat: number }) => s + (l.total_vat || 0), 0)
  const total_ttc    = subtotal_ht + total_vat

  try {
    const buffer = await generateInvoicePdf({
      invoice: {
        invoice_number,
        issue_date: body.issue_date,
        due_date: body.due_date,
        subtotal_ht,
        total_vat,
        total_ttc,
        notes: body.notes ?? null,
        lines,
        client,
      },
      company,
    })

    return new Response(buffer.buffer as ArrayBuffer, {
      status: 200,
      headers: {
        "Content-Type":        "application/pdf",
        "Content-Disposition": `inline; filename="apercu-${invoice_number}.pdf"`,
        "Cache-Control":       "no-store",
      },
    })
  } catch (err) {
    console.error("Preview PDF generation error:", err)
    return NextResponse.json({ error: "Erreur génération de l'aperçu" }, { status: 500 })
  }
}
