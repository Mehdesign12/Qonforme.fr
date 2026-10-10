/**
 * GET  /api/admin/seo/audit → { run } : dernière exploration du site (avancement).
 * POST /api/admin/seo/audit → « Ré-analyser le site » : crée une exploration
 *      (ou poursuit celle en cours) et traite un premier paquet de pages dans la
 *      requête. L'écran poursuit par POST /api/admin/seo/audit/step tant qu'il
 *      est ouvert ; la tâche planifiée finit le reste.
 *
 * Admin seulement. L'exploration n'appelle que https://qonforme.fr (lib/seo/audit/fetcher.ts).
 */
import { NextResponse } from "next/server"
import { isAdminAuthenticated } from "@/lib/admin-require"
import { errorPayload, seoDb } from "@/lib/seo/db"
import { listRuns, progressOf } from "@/lib/seo/audit/crawler"
import { runManualCrawl } from "@/lib/seo/audit/manual"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 60

export async function GET() {
  if (!(await isAdminAuthenticated())) return NextResponse.json({ error: "Non autorisé" }, { status: 401 })
  try {
    const [last] = await listRuns(seoDb(), 1)
    return NextResponse.json({ run: last ? progressOf(last) : null })
  } catch (error) {
    const { status, body } = errorPayload(error)
    return NextResponse.json(body, { status })
  }
}

export async function POST() {
  if (!(await isAdminAuthenticated())) return NextResponse.json({ error: "Non autorisé" }, { status: 401 })
  const startedAt = Date.now()
  try {
    const outcome = await runManualCrawl(seoDb(), { start: true, startedAt })
    if (!outcome.ok) return NextResponse.json({ error: outcome.error, code: outcome.code }, { status: outcome.status })
    return NextResponse.json({ run: outcome.run, findings: outcome.findings })
  } catch (error) {
    const { status, body } = errorPayload(error)
    return NextResponse.json(body, { status })
  }
}
