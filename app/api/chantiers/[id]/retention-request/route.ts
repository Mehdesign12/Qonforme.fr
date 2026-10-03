/**
 * GET : demande de libération de la retenue de garantie d'un chantier (PDF).
 * Lecture seule à partir des factures émises : toujours disponible, même sans
 * la formule (jamais de coupure d'accès aux documents).
 */
import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { getChantier } from "@/lib/artisan/server"
import { generateRetentionRequestPdf } from "@/lib/pdf/retention-request"
import { isMissingSchemaError } from "@/lib/supabase/schema-guard"
import { todayInParis } from "@/lib/utils/paris-date"

export const dynamic = "force-dynamic"

interface Params { params: Promise<{ id: string }> }

export async function GET(_req: NextRequest, { params }: Params) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 })
  const { id } = await params

  try {
    const chantier = await getChantier(supabase, user.id, id)
    if (!chantier) return NextResponse.json({ error: "Chantier introuvable" }, { status: 404 })
    if ("unavailable" in chantier) return NextResponse.json({ error: "Les chantiers ne sont pas encore activés." }, { status: 503 })
    // Loi n° 71-584, art. 2 : le délai d'un an court à compter de la réception
    if (!chantier.reception_date) return NextResponse.json({ error: "Renseignez d'abord la date de réception des travaux." }, { status: 409 })

    const { data: rows, error } = await supabase
      .from("invoices")
      .select("invoice_number, issue_date, total_ttc, retention_amount, status")
      .eq("user_id", user.id)
      .eq("chantier_id", id)
      .gt("retention_amount", 0)
      .not("status", "in", "(draft,credited,cancelled)")
      .order("issue_date", { ascending: true })
    if (error) {
      if (isMissingSchemaError(error)) return NextResponse.json({ error: "Les chantiers ne sont pas encore activés." }, { status: 503 })
      throw new Error(error.message)
    }
    const invoices = ((rows ?? []) as Record<string, unknown>[]).map((r) => ({
      number: String(r.invoice_number ?? ""),
      issue_date: String(r.issue_date ?? ""),
      total_ttc: Number(r.total_ttc ?? 0) || 0,
      retention_amount: Number(r.retention_amount ?? 0) || 0,
    }))
    if (invoices.length === 0) return NextResponse.json({ error: "Aucune retenue de garantie sur les factures émises de ce chantier." }, { status: 404 })

    const [{ data: company }, { data: client }] = await Promise.all([
      supabase.from("companies").select("name, address, zip_code, city, siren, email, iban").eq("user_id", user.id).maybeSingle(),
      chantier.client_id
        ? supabase.from("clients").select("name, address, zip_code, city").eq("id", chantier.client_id).eq("user_id", user.id).maybeSingle()
        : Promise.resolve({ data: null }),
    ])

    const pdf = await generateRetentionRequestPdf({
      today: todayInParis(),
      company: (company ?? {}) as Record<string, string | null>,
      client: (client ?? null) as Record<string, string | null> | null,
      chantier: { name: chantier.name, address: chantier.address, zip_code: chantier.zip_code, city: chantier.city, reception_date: chantier.reception_date },
      invoices,
    })
    return new NextResponse(Buffer.from(pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="liberation-retenue-garantie.pdf"`,
        "Cache-Control": "no-store",
      },
    })
  } catch (err) {
    console.error("[chantiers/retention-request]", err)
    return NextResponse.json({ error: "Le document n'a pas pu être généré." }, { status: 500 })
  }
}
