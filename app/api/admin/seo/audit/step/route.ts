/**
 * POST /api/admin/seo/audit/step → poursuit l'exploration en cours d'un paquet
 * de pages (appels successifs de l'écran tant qu'il est ouvert). Ne crée jamais
 * d'exploration : sans exploration en cours, rend la dernière.
 */
import { NextResponse } from "next/server"
import { isAdminAuthenticated } from "@/lib/admin-require"
import { errorPayload, seoDb } from "@/lib/seo/db"
import { runManualCrawl } from "@/lib/seo/audit/manual"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 60

export async function POST() {
  if (!(await isAdminAuthenticated())) return NextResponse.json({ error: "Non autorisé" }, { status: 401 })
  const startedAt = Date.now()
  try {
    const outcome = await runManualCrawl(seoDb(), { start: false, startedAt })
    if (!outcome.ok) return NextResponse.json({ error: outcome.error, code: outcome.code }, { status: outcome.status })
    return NextResponse.json({ run: outcome.run, findings: outcome.findings })
  } catch (error) {
    const { status, body } = errorPayload(error)
    return NextResponse.json(body, { status })
  }
}
