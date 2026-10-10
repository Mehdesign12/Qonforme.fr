/**
 * PATCH /api/admin/seo/findings/<id> { action: "done" | "ignore" | "reopen" }
 *
 * Changement d'état d'un constat, contrôlé côté serveur
 * (lib/seo/actions/transitions.ts) : fait et ignoré depuis « À faire »
 * seulement, rouvert depuis « Faite » ou « Ignorée », jamais un constat résolu
 * de lui-même ni une action reprise du journal. « Fait » pose la date de mesure
 * (+14 jours) et les mesures « avant » de la page quand Search Console les a.
 *
 * 401 non admin · 400 corps invalide · 404 constat introuvable · 409 changement refusé.
 */
import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { isAdminAuthenticated } from "@/lib/admin-require"
import { errorPayload, must, seoDb, type SeoDb } from "@/lib/seo/db"
import { getFinding, isFindingId } from "@/lib/seo/actions/data"
import { FINDING_ACTIONS, transitionFinding, type FindingAction } from "@/lib/seo/actions/transitions"
import { appendHistory, type FindingEvent } from "@/lib/seo/actions/history"
import { readGscBounds } from "@/lib/seo/actions/gsc"
import { beforeWindow, measurePage, verifyAfterOf, type Verification, type WindowMetrics } from "@/lib/seo/actions/verify"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

type Params = { params: Promise<{ id: string }> | { id: string } }

const bodySchema = z.object({ action: z.enum(FINDING_ACTIONS) })

const EVENT_OF: Record<FindingAction, FindingEvent> = { done: "done", ignore: "ignored", reopen: "reopened" }

/** Mesures des 14 jours connus avant l'action ; null si Search Console n'a rien (la tâche les reprendra). */
async function measureBefore(db: SeoDb, path: string, at: string): Promise<WindowMetrics | null> {
  try {
    const bounds = await readGscBounds(db)
    if (!bounds.last) return null
    return await measurePage(db, path, beforeWindow(at, bounds.last))
  } catch (error) {
    console.error("[seo-actions] mesures « avant » indisponibles", error)
    return null
  }
}

export async function PATCH(request: NextRequest, { params }: Params) {
  if (!(await isAdminAuthenticated())) return NextResponse.json({ error: "Non autorisé" }, { status: 401 })
  const { id } = await params

  const parsed = bodySchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: "Action attendue : « done », « ignore » ou « reopen »." }, { status: 400 })
  }
  if (!isFindingId(id)) return NextResponse.json({ error: "Constat introuvable" }, { status: 404 })
  const action = parsed.data.action

  try {
    const db = seoDb()
    const finding = await getFinding(db, id)
    if (!finding) return NextResponse.json({ error: "Constat introuvable" }, { status: 404 })

    const transition = transitionFinding(finding.status, action, finding.source)
    if (!transition.ok) return NextResponse.json({ error: transition.error, code: "transition_refused" }, { status: 409 })

    const now = new Date()
    const at = now.toISOString()
    const history = appendHistory(finding.history, { at, event: EVENT_OF[action] })
    let patch: Record<string, unknown>
    if (action === "done") {
      const verification: Verification = { before: await measureBefore(db, finding.path, at), after: null, verdict: null }
      patch = { status: "done", done_at: at, verify_after: verifyAfterOf(now), verification, history }
    } else if (action === "ignore") {
      patch = { status: "ignored", ignored_at: at, history }
    } else {
      patch = { status: "open", done_at: null, ignored_at: null, verify_after: null, verification: null, last_seen_at: at, history }
    }

    const res = await db.from("seo_findings").update(patch).eq("id", id).eq("status", finding.status).select("id, status")
    if (res.error?.code === "23505") {
      return NextResponse.json(
        { error: "Un constat à faire existe déjà pour cette page et cette règle : ouvrez-le dans l'onglet « À faire ».", code: "already_open" },
        { status: 409 },
      )
    }
    const rows = must(res, "le constat") as { id: string; status: string }[]
    if (rows.length === 0) {
      return NextResponse.json({ error: "Le constat a changé entre-temps. Rechargez la page.", code: "conflict" }, { status: 409 })
    }
    return NextResponse.json({ ok: true, id, status: transition.status })
  } catch (error) {
    const { status, body } = errorPayload(error)
    return NextResponse.json(body, { status })
  }
}
