/**
 * GET /api/admin/affiliation/news   nouveaux événements de l'affiliation depuis
 * la dernière visite de l'admin (cookie q_aff_seen) : compteurs de la barre latérale.
 * Admin seulement. Lecture impossible : null (aucun « 0 » affiché à tort).
 */
import { NextRequest, NextResponse } from "next/server"
import { isAdminAuthenticated } from "@/lib/admin-require"
import { createAdminClient } from "@/lib/supabase/server"
import { recentCommissionEvents, recentSignups } from "@/lib/affiliation/data"
import { SEEN_COOKIE, countNew, isNewSignup, parseSeen } from "@/lib/affiliation/news"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  if (!(await isAdminAuthenticated())) return NextResponse.json({ error: "Non autorisé" }, { status: 401 })
  const seen = parseSeen(request.cookies.get(SEEN_COOKIE)?.value)
  const db = createAdminClient()
  const [lines, signups] = await Promise.all([recentCommissionEvents(db), recentSignups(db)])
  const commissions = lines.ok ? countNew(lines.data, seen).total : null
  const newSignups = signups.ok ? signups.data.filter((s) => isNewSignup(s, seen)).length : null
  return NextResponse.json(
    { commissions, partners: newSignups },
    { headers: { "Cache-Control": "no-store" } },
  )
}
