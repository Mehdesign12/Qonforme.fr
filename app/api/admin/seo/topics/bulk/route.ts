/**
 * POST /api/admin/seo/topics/bulk  { ids, action: "schedule" | "draft" }
 *
 * Actions groupées de l'écran Sujets :
 * - schedule (« Planifier ») : chaque sujet à planifier prend le créneau libre
 *   suivant du rythme des Préférences (heure de Paris) ;
 * - draft (« Rédiger un brouillon ») : une rédaction par sujet.
 * Réponse : { updated, skipped: [{ id, reason }], jobs: [jobId] }.
 */
import { NextRequest, NextResponse } from "next/server"
import { isAdminAuthenticated } from "@/lib/admin-require"
import { errorPayload, seoDb } from "@/lib/seo/db"
import { topicBulkSchema, zodError } from "@/lib/seo/articles/input"
import { bulkTopics } from "@/lib/seo/articles/topics"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function POST(request: NextRequest) {
  if (!(await isAdminAuthenticated())) return NextResponse.json({ error: "Non autorisé" }, { status: 401 })
  const parsed = topicBulkSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json(zodError(parsed.error), { status: 400 })
  try {
    return NextResponse.json(await bulkTopics(seoDb(), parsed.data.ids, parsed.data.action))
  } catch (error) {
    const { status, body } = errorPayload(error)
    return NextResponse.json(body, { status })
  }
}
