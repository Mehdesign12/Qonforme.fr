import { NextRequest, NextResponse } from "next/server"
import { cookies } from "next/headers"
import { createAdminClient } from "@/lib/supabase/server"
import { isUuid, linkCookieName, loadLinkForToken } from "@/lib/signature/server"
import { pdfForLink, pdfResponse } from "@/lib/signature/signed-pdf"

/**
 * GET /api/signature/public/[id]/pdf — PDF du document du lien (signé s'il
 * l'est), pour le client. Accès par le jeton du cookie uniquement.
 */
export const dynamic = "force-dynamic"
export const maxDuration = 30

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const id = params.id
  if (!isUuid(id)) return NextResponse.json({ error: "Lien introuvable." }, { status: 404 })
  try {
    const admin = createAdminClient()
    const row = await loadLinkForToken(admin, id, cookies().get(linkCookieName(id))?.value)
    // Un lien désactivé ou remplacé ne donne plus le document
    if (!row || row.status === "disabled" || row.status === "superseded") {
      return NextResponse.json({ error: "Ce lien n'est plus valable." }, { status: 404 })
    }
    const file = await pdfForLink(admin, row)
    if (!file) return NextResponse.json({ error: "Document introuvable." }, { status: 404 })
    return pdfResponse(file)
  } catch (err) {
    console.error("[signature] PDF public :", err)
    return NextResponse.json({ error: "Le PDF n'a pas pu être généré." }, { status: 500 })
  }
}
