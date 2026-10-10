/**
 * POST /api/admin/seo/pagespeed — « Mesurer la page » (Performance ›
 * PageSpeed Insights) : corps { path, strategy: "mobile" | "desktop" }.
 *
 * Le chemin doit être un chemin de qonforme.fr (lib/seo/site.ts : toSitePath,
 * qui le normalise comme la lecture de l'historique) ; aucune autre adresse
 * n'est appelée. La mesure est enregistrée dans seo_pagespeed, même en échec.
 */
import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { isAdminAuthenticated } from "@/lib/admin-require"
import { errorPayload, seoDb } from "@/lib/seo/db"
import { getSettings } from "@/lib/seo/settings"
import { toSitePath } from "@/lib/seo/site"
import { measurePage } from "@/lib/seo/pagespeed/measure"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
// Une mesure Lighthouse prend souvent 20 à 40 s (jusqu'à 90 s)
export const maxDuration = 120

const bodySchema = z.object({
  path: z.string().trim().min(1, "Chemin manquant").max(500, "Chemin trop long"),
  strategy: z.enum(["mobile", "desktop"], { message: "Appareil attendu : mobile ou ordinateur" }),
})

export async function POST(request: NextRequest) {
  if (!(await isAdminAuthenticated())) return NextResponse.json({ error: "Non autorisé" }, { status: 401 })

  const json = await request.json().catch(() => null)
  const parsed = bodySchema.safeParse(json)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Requête invalide" }, { status: 400 })
  }
  const { strategy } = parsed.data

  try {
    const db = seoDb()
    // Réglages lus d'abord : migration absente → 503 avant tout appel à Google
    await getSettings(db, "pagespeed")
    const path = toSitePath(parsed.data.path)
    if (!path) {
      return NextResponse.json({ error: "Chemin invalide : seules les pages de qonforme.fr se mesurent." }, { status: 400 })
    }

    const outcome = await measurePage(db, path, strategy)
    if (!outcome.ok) {
      return NextResponse.json(
        { ok: false, error: outcome.error ?? "La mesure n'a pas pu aboutir.", measurement: outcome.row },
        { status: outcome.status === 429 ? 429 : 502 },
      )
    }
    return NextResponse.json({ ok: true, measurement: outcome.row })
  } catch (error) {
    const { status, body } = errorPayload(error)
    return NextResponse.json(body, { status })
  }
}
