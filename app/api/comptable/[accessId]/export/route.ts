/**
 * GET /api/comptable/[accès]/export?format=fec|csv|zip&du=AAAA-MM-JJ&au=AAAA-MM-JJ
 *
 * Téléchargement d'un export par le comptable, en lecture seule :
 * 1. compte connecté (401 sinon) ;
 * 2. accès accepté, non révoqué, appartenant à ce compte (404 sinon, sans dire
 *    si le dossier existe) — l'entreprise lue vient de cet accès ;
 * 3. l'export est journalisé AVANT d'être servi : s'il ne peut pas l'être,
 *    rien n'est téléchargé (503).
 */
import { NextRequest, NextResponse } from "next/server"
import { createClient, createAdminClient } from "@/lib/supabase/server"
import { todayInParis } from "@/lib/utils/paris-date"
import { parsePeriod } from "@/lib/accountant/rules"
import { authorizeDossier, recordExport } from "@/lib/accountant/server"
import { buildCsvExport, buildFecExport, buildPdfZipExport } from "@/lib/accountant/exports"
import type { ExportFormat } from "@/lib/accountant/types"

export const dynamic = "force-dynamic"
// Archive des PDF : jusqu'à ZIP_MAX_DOCUMENTS documents générés dans la requête
export const maxDuration = 60

interface Params { params: Promise<{ accessId: string }> }

const ACTIONS = { fec: "export_fec", csv: "export_csv", zip: "export_pdf_zip" } as const

const DETAILS: Record<ExportFormat, (n: number) => string> = {
  fec: (n) => `${n} document${n > 1 ? "s" : ""}`,
  csv: (n) => `${n} document${n > 1 ? "s" : ""}`,
  zip: (n) => `${n} PDF`,
}

export async function GET(request: NextRequest, { params }: Params) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 })

    const { accessId } = await params
    const db = createAdminClient()
    const access = await authorizeDossier(accessId, user.id, db)
    if (!access) return NextResponse.json({ error: "Dossier introuvable ou accès retiré." }, { status: 404 })

    const url = new URL(request.url)
    const format = url.searchParams.get("format") as ExportFormat | null
    if (format !== "fec" && format !== "csv" && format !== "zip") {
      return NextResponse.json({ error: "Format inconnu." }, { status: 400 })
    }
    const period = parsePeriod(url.searchParams.get("du"), url.searchParams.get("au"))
    if (!period) return NextResponse.json({ error: "Période invalide (dates AAAA-MM-JJ, trois ans au plus)." }, { status: 400 })

    const file =
      format === "fec" ? await buildFecExport(db, access.owner_id, period)
      : format === "csv" ? await buildCsvExport(db, access.owner_id, period, todayInParis())
      : await buildPdfZipExport(db, access.owner_id, period)
    if (!file.ok) return NextResponse.json({ error: file.error, code: file.code }, { status: file.status })

    try {
      await recordExport(db, access, ACTIONS[format], period, DETAILS[format](file.count))
    } catch {
      return NextResponse.json({ error: "Le téléchargement n'a pas pu être enregistré. Réessayez dans un instant." }, { status: 503 })
    }

    const body = typeof file.body === "string" ? file.body : (file.body.buffer.slice(file.body.byteOffset, file.body.byteOffset + file.body.byteLength) as ArrayBuffer)
    return new NextResponse(body, {
      status: 200,
      headers: {
        "Content-Type": file.contentType,
        "Content-Disposition": `attachment; filename="${file.filename}"`,
        "Cache-Control": "no-store, private",
        "X-Content-Type-Options": "nosniff",
      },
    })
  } catch (err) {
    console.error("[comptable] export", err)
    return NextResponse.json({ error: "L'export a échoué. Réessayez dans un instant." }, { status: 500 })
  }
}
