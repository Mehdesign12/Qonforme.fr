import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { generateInvoicePdf } from "@/lib/pdf/invoice"
import { invoiceNumberLabel } from "@/lib/utils/document-numbering"
import { selectCompanyWithProfile } from "@/lib/legal/db"
import { createZip, type ZipEntry } from "@/lib/accountant/zip"
import { BULK_PDF_LIMIT } from "@/lib/export/invoice-list"

/**
 * POST /api/invoices/bulk-pdf { ids } — PDF des factures sélectionnées dans la
 * liste, dans une archive ZIP. Chaque PDF est celui du téléchargement à
 * l'unité (GET /api/invoices/[id]/pdf) : Factur-X pour une facture émise,
 * filigrane « BROUILLON » sans XML pour un brouillon. Seules les factures du
 * compte sont lues (RLS et filtre user_id).
 */
export const dynamic = "force-dynamic"
export const maxDuration = 60

/** PDF générés l'un après l'autre : au-delà, découper la sélection (lib/export/invoice-list.ts). */
const BULK_PDF_MAX = BULK_PDF_LIMIT

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 })

  let body: { ids?: unknown }
  try { body = await request.json() } catch { return NextResponse.json({ error: "Requête invalide" }, { status: 400 }) }
  const ids = Array.isArray(body.ids) ? Array.from(new Set(body.ids.filter((x): x is string => typeof x === "string" && UUID_RE.test(x)))) : []
  if (ids.length === 0) return NextResponse.json({ error: "Sélectionnez au moins une facture." }, { status: 400 })
  if (ids.length > BULK_PDF_MAX) {
    return NextResponse.json({ error: `${BULK_PDF_MAX} factures au plus par archive : sélectionnez-en moins.` }, { status: 400 })
  }

  const { data: invoices, error } = await supabase
    .from("invoices")
    .select("*, client:clients(id,name,email,address,zip_code,city,country,siren,vat_number)")
    .eq("user_id", user.id)
    .in("id", ids)
  if (error) return NextResponse.json({ error: "Impossible de lire ces factures." }, { status: 500 })
  if (!invoices || invoices.length === 0) return NextResponse.json({ error: "Factures introuvables." }, { status: 404 })

  const { data: company } = await selectCompanyWithProfile(
    supabase, "name,siren,siret,vat_number,address,zip_code,city,country,iban,legal_notice,accent_color,logo_url,email", user.id,
  )

  try {
    const entries: ZipEntry[] = []
    for (const invoice of invoices) {
      const isDraft = invoice.status === "draft"
      const number = invoiceNumberLabel(invoice.invoice_number)
      const pdf = await generateInvoicePdf({
        invoice: { ...invoice, invoice_number: number },
        company,
        watermark: isDraft ? "BROUILLON" : undefined,
      })
      // Noms rendus sûrs et uniques par createZip (lib/accountant/zip.ts)
      const name = isDraft ? `Brouillon ${String(invoice.id).slice(0, 8)}.pdf` : `Facture ${number}.pdf`
      entries.push({ name, data: pdf, modified: new Date(`${String(invoice.issue_date ?? "").slice(0, 10) || new Date().toISOString().slice(0, 10)}T12:00:00Z`) })
    }
    const zip = createZip(entries)
    return new Response(zip.buffer as ArrayBuffer, {
      status: 200,
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="factures-${new Date().toISOString().slice(0, 10)}.zip"`,
        "Cache-Control": "no-store",
      },
    })
  } catch (err) {
    console.error("[invoices/bulk-pdf]", err)
    return NextResponse.json({ error: "Les PDF n'ont pas pu être générés. Réessayez avec moins de factures." }, { status: 500 })
  }
}
