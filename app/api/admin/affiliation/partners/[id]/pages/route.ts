/**
 * POST   /api/admin/affiliation/partners/[id]/pages            { url, proposedTarget? }  ajoute une page (vérifiée tout de suite, sauf une page « à proposer »)
 * PATCH  /api/admin/affiliation/partners/[id]/pages?page=…     vérifie la page maintenant
 * DELETE /api/admin/affiliation/partners/[id]/pages?page=…     retire la page
 * Admin seulement.
 */
import { NextRequest, NextResponse } from "next/server"
import { isAdminAuthenticated } from "@/lib/admin-require"
import { createAdminClient } from "@/lib/supabase/server"
import { addPage, checkPage, removePage } from "@/lib/affiliation/admin"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 30

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
type Ctx = { params: Promise<{ id: string }> }

async function guard(ctx: Ctx): Promise<string | NextResponse> {
  if (!(await isAdminAuthenticated())) return NextResponse.json({ error: "Non autorisé" }, { status: 401 })
  const { id } = await ctx.params
  if (!UUID.test(id)) return NextResponse.json({ error: "Partenaire invalide." }, { status: 400 })
  return id
}

export async function POST(request: NextRequest, ctx: Ctx) {
  const id = await guard(ctx)
  if (typeof id !== "string") return id
  const body = (await request.json().catch(() => null)) as { url?: unknown; proposedTarget?: unknown } | null
  const res = await addPage(createAdminClient(), id, typeof body?.url === "string" ? body.url : "", {
    proposedTarget: typeof body?.proposedTarget === "string" ? body.proposedTarget : null,
  })
  if (!res.ok) return NextResponse.json({ error: res.error }, { status: res.status })
  return NextResponse.json({ page: res.page }, { status: 201 })
}

export async function PATCH(request: NextRequest, ctx: Ctx) {
  const id = await guard(ctx)
  if (typeof id !== "string") return id
  const pageId = request.nextUrl.searchParams.get("page") ?? ""
  if (!UUID.test(pageId)) return NextResponse.json({ error: "Page invalide." }, { status: 400 })
  const res = await checkPage(createAdminClient(), id, pageId)
  if (!res.ok) return NextResponse.json({ error: res.error }, { status: res.status })
  return NextResponse.json({ page: res.page })
}

export async function DELETE(request: NextRequest, ctx: Ctx) {
  const id = await guard(ctx)
  if (typeof id !== "string") return id
  const pageId = request.nextUrl.searchParams.get("page") ?? ""
  if (!UUID.test(pageId)) return NextResponse.json({ error: "Page invalide." }, { status: 400 })
  const ok = await removePage(createAdminClient(), id, pageId)
  if (!ok) return NextResponse.json({ error: "La page n'a pas pu être retirée." }, { status: 500 })
  return NextResponse.json({ ok: true })
}
