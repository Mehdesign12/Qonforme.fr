import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { selectCompanyWithProfile } from "@/lib/legal/db"
import { generateInvoicePdf } from "@/lib/pdf/invoice"
import { generateQuotePdf } from "@/lib/pdf/quote"
import { isDocTemplate } from "@/lib/pdf/theme"
import { todayInParis, addDays } from "@/lib/utils/paris-date"

/**
 * GET /api/document-templates/sample?doc=quote|invoice&template=… — PDF
 * d'exemple d'un modèle, aux couleurs, au logo et aux mentions de l'entreprise,
 * avec des prestations fictives. Filigrané (« EXEMPLE » pour un devis,
 * « APERÇU » pour une facture), sans numéro ni XML Factur-X, jamais
 * enregistré : il ne peut pas passer pour un vrai document.
 */
export const dynamic = "force-dynamic"
export const maxDuration = 30

const line = (description: string, quantity: number, unit: string, unit_price_ht: number, vat_rate: number) => {
  const total_ht = Math.round(quantity * unit_price_ht * 100) / 100
  const total_vat = Math.round(total_ht * vat_rate) / 100
  return { description, quantity, unit, unit_price_ht, vat_rate, total_ht, total_vat }
}

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 })

  const docParam = req.nextUrl.searchParams.get("doc")
  const doc = docParam === "quote" ? "quote" : "invoice"
  const template = req.nextUrl.searchParams.get("template")
  if (!isDocTemplate(template)) return NextResponse.json({ error: "Modèle inconnu." }, { status: 400 })

  const { data: company } = await selectCompanyWithProfile(
    supabase, "name,siren,siret,vat_number,address,zip_code,city,country,iban,legal_notice,accent_color,logo_url,email", user.id,
  )
  const sampleCompany = { ...(company ?? { name: "Votre entreprise" }), document_templates: { [doc]: template } }

  const lines = [
    line("Cloison sur ossature métallique 72/48", 12, "m²", 48, 10),
    line("Doublage isolant collé 10+80", 18, "m²", 36, 10),
    line("Déplacement et protection du chantier", 1, "forfait", 60, 10),
  ]
  const subtotal_ht = lines.reduce((s, l) => s + l.total_ht, 0)
  const total_vat = Math.round(lines.reduce((s, l) => s + l.total_vat, 0) * 100) / 100
  const today = todayInParis()
  const client = { name: "Client exemple", address: "1 rue de l'Exemple", zip_code: "49000", city: "Angers" }
  const common = { issue_date: today, lines, client, subtotal_ht, total_vat, total_ttc: Math.round((subtotal_ht + total_vat) * 100) / 100 }

  try {
    const bytes = doc === "quote"
      ? await generateQuotePdf({
          quote: { ...common, quote_number: "EXEMPLE", valid_until: addDays(today, 30), notes: "Exemple de mise en page : prestations et montants fictifs." } as never,
          company: sampleCompany as never,
          watermark: "EXEMPLE",
        })
      : await generateInvoicePdf({
          invoice: { ...common, invoice_number: "EXEMPLE", due_date: addDays(today, 30), notes: "Exemple de mise en page : prestations et montants fictifs." } as never,
          company: sampleCompany as never,
          watermark: "APERÇU",
        })
    return new Response((bytes as Uint8Array).buffer as ArrayBuffer, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="exemple-${doc === "quote" ? "devis" : "facture"}-${template}.pdf"`,
        "Cache-Control": "no-store",
      },
    })
  } catch (err) {
    console.error("[document-templates/sample]", err)
    return NextResponse.json({ error: "L'exemple n'a pas pu être généré." }, { status: 500 })
  }
}
