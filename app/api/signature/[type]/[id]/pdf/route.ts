import { NextRequest, NextResponse } from "next/server"
import { createAdminClient, createClient } from "@/lib/supabase/server"
import { latestLink, loadDocument } from "@/lib/signature/server"
import { pdfForLink, pdfResponse } from "@/lib/signature/signed-pdf"

/**
 * GET /api/signature/[type]/[id]/pdf — PDF signé et son dossier de preuve,
 * pour l'artisan propriétaire du document.
 */
export const dynamic = "force-dynamic"
export const maxDuration = 30

export async function GET(_req: NextRequest, { params }: { params: { type: string; id: string } }) {
  const type = params.type === "quote" ? "quote" : params.type === "purchase_order" ? "purchase_order" : null
  if (!type) return NextResponse.json({ error: "Type de document inconnu" }, { status: 404 })

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 })

  try {
    const admin = createAdminClient()
    const doc = await loadDocument(admin, type, params.id, user.id)
    if (!doc) return NextResponse.json({ error: "Document introuvable" }, { status: 404 })
    const { row } = await latestLink(admin, user.id, type, doc.id)
    if (!row || (row.status !== "signed" && row.status !== "withdrawn")) return NextResponse.json({ error: "Ce document n'a pas été signé en ligne." }, { status: 404 })
    const file = await pdfForLink(admin, row)
    if (!file) return NextResponse.json({ error: "Document introuvable" }, { status: 404 })
    return pdfResponse(file)
  } catch (err) {
    console.error("[signature] PDF signé (artisan) :", err)
    return NextResponse.json({ error: "Le PDF signé n'a pas pu être généré." }, { status: 500 })
  }
}
