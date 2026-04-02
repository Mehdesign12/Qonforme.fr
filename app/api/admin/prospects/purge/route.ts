/**
 * POST /api/admin/prospects/purge
 *
 * Supprime TOUS les prospects, campaign_sends, campaigns et scraping_runs.
 * Réservé à l'admin. Demande confirmation côté client.
 */

import { NextResponse } from "next/server"
import { isAdminAuthenticated } from "@/lib/admin-require"
import { createAdminClient } from "@/lib/supabase/server"

export const dynamic = "force-dynamic"

export async function POST() {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 })
  }

  const supabase = createAdminClient()

  // Compter avant suppression
  const { count } = await supabase
    .from("prospects")
    .select("*", { head: true, count: "exact" })

  // Supprimer dans l'ordre (FK constraints)
  await supabase.from("campaign_sends").delete().neq("id", "00000000-0000-0000-0000-000000000000")
  await supabase.from("campaigns").delete().neq("id", "00000000-0000-0000-0000-000000000000")
  await supabase.from("scraping_runs").delete().neq("id", "00000000-0000-0000-0000-000000000000")
  await supabase.from("prospects").delete().neq("id", "00000000-0000-0000-0000-000000000000")

  return NextResponse.json({ ok: true, deleted: count ?? 0 })
}
