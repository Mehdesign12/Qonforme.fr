/**
 * GET /api/admin/prospects/export
 *
 * Exporte tous les prospects en CSV.
 * Réservé à l'admin (cookie admin_session).
 */

import { NextResponse } from "next/server"
import { isAdminAuthenticated } from "@/lib/admin-require"
import { createAdminClient } from "@/lib/supabase/server"

export const dynamic = "force-dynamic"

const CSV_HEADERS = [
  "siret",
  "siren",
  "nom_entreprise",
  "nom_dirigeant",
  "activite",
  "code_naf",
  "metier_qonforme",
  "adresse",
  "code_postal",
  "ville",
  "departement",
  "region",
  "email",
  "email_verified",
  "email_source",
  "telephone",
  "site_web",
  "statut",
  "date_creation",
  "date_scrape",
]

function escapeCsv(value: unknown): string {
  if (value == null) return ""
  const str = String(value)
  if (str.includes(",") || str.includes('"') || str.includes("\n")) {
    return `"${str.replace(/"/g, '""')}"`
  }
  return str
}

export async function GET() {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 })
  }

  const supabase = createAdminClient()

  // Récupérer tous les prospects (max 100k pour éviter un timeout)
  const { data: prospects, error } = await supabase
    .from("prospects")
    .select(CSV_HEADERS.join(","))
    .order("created_at", { ascending: false })
    .limit(100_000)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Construire le CSV
  const rows = [CSV_HEADERS.join(",")]
  for (const p of prospects ?? []) {
    const record = p as unknown as Record<string, unknown>
    rows.push(CSV_HEADERS.map((h) => escapeCsv(record[h])).join(","))
  }

  const csv = "\uFEFF" + rows.join("\n") // BOM UTF-8 pour Excel

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="prospects-${new Date().toISOString().split("T")[0]}.csv"`,
    },
  })
}
