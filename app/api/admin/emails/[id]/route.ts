/**
 * GET /api/admin/emails/[id] : copie exacte d'un email du journal (admin seulement).
 * Le HTML est affiché dans un cadre isolé (sans script) par l'écran.
 */
import { NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/server"
import { isAdminAuthenticated } from "@/lib/admin-require"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAdminAuthenticated())) return NextResponse.json({ error: "Accès refusé" }, { status: 403 })
  const { id } = await params
  if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ error: "Introuvable" }, { status: 404 })
  const { data, error } = await createAdminClient()
    .from("account_emails")
    .select("id,subject,sent_to,html")
    .eq("id", id)
    .maybeSingle()
  if (error) return NextResponse.json({ error: "Lecture impossible, réessayez." }, { status: 503 })
  if (!data) return NextResponse.json({ error: "Introuvable" }, { status: 404 })
  return NextResponse.json(data, { headers: { "Cache-Control": "no-store" } })
}
