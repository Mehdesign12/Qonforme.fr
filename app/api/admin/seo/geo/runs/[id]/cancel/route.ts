/**
 * POST /api/admin/seo/geo/runs/<id>/cancel → { run, cancelled }
 *
 * « Arrêter le relevé » : les réponses non obtenues sont écartées et le relevé est clos avec
 * ce qui a déjà été obtenu (lib/seo/geo/runner.ts, cancelRun). `cancelled: false` si le
 * relevé était déjà clos. Libère la place d'un nouveau relevé.
 */
import { NextRequest, NextResponse } from "next/server"
import { isAdminAuthenticated } from "@/lib/admin-require"
import { errorPayload, seoDb } from "@/lib/seo/db"
import { isUuid } from "@/lib/seo/geo/questions"
import { cancelRun } from "@/lib/seo/geo/runner"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

type Params = { params: Promise<{ id: string }> | { id: string } }

export async function POST(_request: NextRequest, { params }: Params) {
  if (!(await isAdminAuthenticated())) return NextResponse.json({ error: "Non autorisé" }, { status: 401 })
  const { id } = await params
  if (!isUuid(id)) return NextResponse.json({ error: "Relevé introuvable" }, { status: 404 })
  try {
    const res = await cancelRun(seoDb(), id)
    if (!res) return NextResponse.json({ error: "Relevé introuvable" }, { status: 404 })
    return NextResponse.json(res)
  } catch (error) {
    const { status, body } = errorPayload(error)
    return NextResponse.json(body, { status })
  }
}
