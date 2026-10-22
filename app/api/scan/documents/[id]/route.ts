/** Un document scanné : lecture avec ses pages (adresses signées d'une heure), modification des champs, suppression. */
import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { isMissingSchemaError } from "@/lib/supabase/schema-guard"
import { ownsClient } from "@/lib/artisan/server"
import { DOCUMENT_COLUMNS, documentFromRow, parseScanFields, type PageRow } from "@/lib/scan/documents"
import { signedUrls } from "@/lib/scan/server"
import { deleteScanDocument } from "@/lib/scan/service"

export const dynamic = "force-dynamic"

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
type Ctx = { params: Promise<{ id: string }> }

export async function GET(_request: NextRequest, { params }: Ctx) {
  const { id } = await params
  if (!UUID.test(id)) return NextResponse.json({ error: "Document introuvable" }, { status: 404 })
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 })

  const { data, error } = await supabase.from("scanned_documents").select(DOCUMENT_COLUMNS).eq("id", id).eq("user_id", user.id).maybeSingle()
  if (error) {
    if (isMissingSchemaError(error)) return NextResponse.json({ error: "Les documents scannés ne sont pas encore activés." }, { status: 503 })
    console.error("[scan] lecture :", error.message)
    return NextResponse.json({ error: "Impossible de charger ce document." }, { status: 500 })
  }
  if (!data) return NextResponse.json({ error: "Document introuvable" }, { status: 404 })
  const row = data as unknown as Record<string, unknown>
  const urls = await signedUrls(supabase, ((row.pages as PageRow[] | null) ?? []).map((p) => p.storage_path))
  return NextResponse.json({ document: documentFromRow(row, urls) }, { headers: { "Cache-Control": "no-store" } })
}

export async function PATCH(request: NextRequest, { params }: Ctx) {
  const { id } = await params
  if (!UUID.test(id)) return NextResponse.json({ error: "Document introuvable" }, { status: 404 })
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 })

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>
  const parsed = parseScanFields(body)
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 })
  if (Object.keys(parsed.value).length === 0) return NextResponse.json({ error: "Rien à modifier." }, { status: 400 })
  if (parsed.value.client_id && !(await ownsClient(supabase, user.id, parsed.value.client_id))) {
    return NextResponse.json({ error: "Client introuvable" }, { status: 404 })
  }

  const { data, error } = await supabase
    .from("scanned_documents")
    .update(parsed.value)
    .eq("id", id)
    .eq("user_id", user.id)
    .select(DOCUMENT_COLUMNS)
    .maybeSingle()
  if (error) {
    if (isMissingSchemaError(error)) return NextResponse.json({ error: "Les documents scannés ne sont pas encore activés." }, { status: 503 })
    if (error.code === "23503") return NextResponse.json({ error: "Client ou chantier introuvable." }, { status: 404 })
    console.error("[scan] modification :", error.message)
    return NextResponse.json({ error: "Le document n'a pas pu être modifié. Réessayez." }, { status: 500 })
  }
  if (!data) return NextResponse.json({ error: "Document introuvable" }, { status: 404 })
  const { pages: _pages, ...document } = documentFromRow(data as unknown as Record<string, unknown>)
  void _pages
  return NextResponse.json({ document })
}

export async function DELETE(_request: NextRequest, { params }: Ctx) {
  const { id } = await params
  if (!UUID.test(id)) return NextResponse.json({ error: "Document introuvable" }, { status: 404 })
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 })

  const result = await deleteScanDocument(supabase, user.id, id)
  return NextResponse.json(result.body, { status: result.status })
}
