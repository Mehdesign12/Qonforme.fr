/**
 * Documents scannés.
 *
 * GET  : liste (`tab` : to_classify ou un type, `q` : recherche), nombre à
 *        classer et espace utilisé ; `available: false` tant que la migration
 *        20261021_scanned_documents.sql n'est pas appliquée.
 * POST : crée un document vide (champs facultatifs) ; ses pages arrivent une à
 *        une (POST …/[id]/pages). Refusé (409 SCAN_QUOTA) si l'espace du compte
 *        est plein.
 *
 * Ouvert à tous les comptes : le quota dépend de la formule, rien n'est bloqué
 * par un mur de paiement.
 */
import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { isMissingSchemaError } from "@/lib/supabase/schema-guard"
import { ownsClient } from "@/lib/artisan/server"
import {
  DOCUMENT_COLUMNS, SCAN_KINDS, checkQuota, documentFromRow, parseScanFields, searchTerm, type ScanDocument,
} from "@/lib/scan/documents"
import { ScanReadError, loadPlanKey, loadUsage, signedUrls, usageOf } from "@/lib/scan/server"

export const dynamic = "force-dynamic"

const LIST_LIMIT = 100

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 })

  const params = request.nextUrl.searchParams
  const tab = params.get("tab")
  const term = searchTerm(params.get("q"))

  let query = supabase.from("scanned_documents").select(DOCUMENT_COLUMNS).eq("user_id", user.id)
  if (tab === "to_classify") query = query.eq("status", "to_classify")
  else if (tab && (SCAN_KINDS as readonly string[]).includes(tab)) query = query.eq("kind", tab)
  if (term) query = query.or(`supplier.ilike.%${term}%,doc_number.ilike.%${term}%,title.ilike.%${term}%`)
  const { data, error } = await query.order("created_at", { ascending: false }).limit(LIST_LIMIT)
  if (error) {
    if (isMissingSchemaError(error)) return NextResponse.json({ available: false, documents: [], toClassify: 0, usage: null })
    console.error("[scan] liste :", error.message)
    return NextResponse.json({ error: "Impossible de charger vos documents." }, { status: 500 })
  }

  const rows = (data ?? []) as unknown as Record<string, unknown>[]
  const firstPaths = rows
    .map((r) => ((r.pages as { position: number; storage_path: string }[] | null) ?? []).slice().sort((a, b) => a.position - b.position)[0]?.storage_path)
    .filter((p): p is string => Boolean(p))
  const urls = await signedUrls(supabase, firstPaths)
  const documents: ScanDocument[] = rows.map((r) => {
    const { pages: _pages, ...doc } = documentFromRow(r, urls)
    void _pages
    return doc
  })

  const todo = await supabase.from("scanned_documents").select("id", { count: "exact", head: true }).eq("user_id", user.id).eq("status", "to_classify")
  let usage = null
  try {
    const used = await loadUsage(supabase, user.id)
    if (used) usage = usageOf(await loadPlanKey(supabase, user.id), used)
  } catch (err) {
    // L'espace utilisé est un plus : une lecture en échec n'empêche pas de voir ses documents
    console.error("[scan] espace :", err instanceof Error ? err.message : err)
  }
  return NextResponse.json({ available: true, documents, toClassify: todo.count ?? 0, usage }, { headers: { "Cache-Control": "no-store" } })
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 })

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>
  const parsed = parseScanFields(body)
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 })
  if (parsed.value.client_id && !(await ownsClient(supabase, user.id, parsed.value.client_id))) {
    return NextResponse.json({ error: "Client introuvable" }, { status: 404 })
  }

  try {
    const used = await loadUsage(supabase, user.id)
    if (!used) return NextResponse.json({ error: "Les documents scannés ne sont pas encore activés." }, { status: 503 })
    const plan = await loadPlanKey(supabase, user.id)
    const check = checkQuota(plan, used, { documents: 1 })
    if (!check.ok) return NextResponse.json({ error: check.message, code: check.code }, { status: 409 })
  } catch (err) {
    if (err instanceof ScanReadError) {
      console.error("[scan] quota :", err.message)
      return NextResponse.json({ error: "Impossible de vérifier votre espace de scan. Réessayez dans un instant." }, { status: 503 })
    }
    throw err
  }

  const { data, error } = await supabase
    .from("scanned_documents")
    .insert({ ...parsed.value, user_id: user.id })
    .select(DOCUMENT_COLUMNS)
    .single()
  if (error) {
    if (isMissingSchemaError(error)) return NextResponse.json({ error: "Les documents scannés ne sont pas encore activés." }, { status: 503 })
    if (error.code === "23503") return NextResponse.json({ error: "Client ou chantier introuvable." }, { status: 404 })
    console.error("[scan] création :", error.message)
    return NextResponse.json({ error: "Le document n'a pas pu être créé. Réessayez." }, { status: 500 })
  }
  const { pages: _pages, ...document } = documentFromRow(data as unknown as Record<string, unknown>)
  void _pages
  return NextResponse.json({ document }, { status: 201 })
}
