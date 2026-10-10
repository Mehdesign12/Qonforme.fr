/**
 * POST /api/admin/seo/reports/preview { sections? } → { ok, subject }
 *
 * Envoie un aperçu du résumé hebdomadaire SEO, construit avec les données
 * actuelles, à l'adresse de l'administrateur (ADMIN_EMAIL). Noté dans
 * seo_digests (kind « preview ») ; 3 envois par heure au plus (429).
 * Sans ADMIN_EMAIL ni RESEND_API_KEY : 409 avec la raison. Sans aucune
 * section cochée : 400 (un résumé vide ne part jamais). Admin seulement.
 */
import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { isAdminAuthenticated } from "@/lib/admin-require"
import { errorPayload, seoDb } from "@/lib/seo/db"
import { getSettings } from "@/lib/seo/settings"
import { DigestPreviewError, sendPreviewDigest } from "@/lib/seo/reports/send"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 60

const NO_SECTION = "Cochez au moins une section du résumé."

const bodySchema = z
  .object({
    sections: z
      .object({ kpis: z.boolean(), pages: z.boolean(), articles: z.boolean(), geo: z.boolean() })
      .refine((v) => Object.values(v).some(Boolean), { message: NO_SECTION })
      .optional(),
  })
  .strict()

export async function POST(request: NextRequest) {
  if (!(await isAdminAuthenticated())) return NextResponse.json({ error: "Non autorisé" }, { status: 401 })

  const raw = await request.json().catch(() => ({}))
  const parsed = bodySchema.safeParse(raw ?? {})
  if (!parsed.success) {
    const empty = parsed.error.issues.some((i) => i.message === NO_SECTION)
    return NextResponse.json({ error: empty ? NO_SECTION : "Contenu du résumé invalide" }, { status: 400 })
  }

  try {
    const db = seoDb()
    const sections = parsed.data.sections ?? (await getSettings(db, "reports")).value.sections
    // Sections des réglages : même règle (réglages enregistrés avant le contrôle du serveur)
    if (!Object.values(sections).some(Boolean)) return NextResponse.json({ error: NO_SECTION }, { status: 400 })
    const { subject } = await sendPreviewDigest(db, new Date(), sections)
    return NextResponse.json({ ok: true, subject })
  } catch (error) {
    if (error instanceof DigestPreviewError) return NextResponse.json({ error: error.message }, { status: error.status })
    const { status, body } = errorPayload(error)
    return NextResponse.json(body, { status })
  }
}
