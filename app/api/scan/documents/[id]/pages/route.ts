/**
 * Ajoute une page à un document scanné (une page par requête : un document de
 * plusieurs pages dépasserait la limite de 4,5 Mo des fonctions serveur).
 *
 * Le fichier reçu est contrôlé à ses octets (JPEG, PNG ou WebP, jamais l'extension),
 * remis d'aplomb, débarrassé de ses métadonnées (position GPS comprise) et
 * recompressé en WebP par sharp : jamais l'original gardé tel quel. Refusé
 * (409 SCAN_QUOTA) s'il dépasse l'espace du compte.
 */
import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { isMissingSchemaError } from "@/lib/supabase/schema-guard"
import { BlogImageError, MAX_IMAGE_SIDE, MAX_INPUT_PIXELS, prepareImage } from "@/lib/blog-images/server"
import { sniffImage } from "@/lib/blog-images/sniff"
import { MAX_PAGES, MAX_PAGE_UPLOAD_BYTES, checkQuota } from "@/lib/scan/documents"
import { SCAN_BUCKET, ScanReadError, loadPlanKey, loadUsage, pagePath } from "@/lib/scan/server"

export const dynamic = "force-dynamic"
export const maxDuration = 30

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
type Ctx = { params: Promise<{ id: string }> }

export async function POST(request: NextRequest, { params }: Ctx) {
  const { id } = await params
  if (!UUID.test(id)) return NextResponse.json({ error: "Document introuvable" }, { status: 404 })
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 })

  const form = await request.formData().catch(() => null)
  const file = form?.get("file")
  const position = Number(form?.get("position"))
  if (!form || !(file instanceof File)) return NextResponse.json({ error: "Aucune image reçue." }, { status: 400 })
  if (!Number.isInteger(position) || position < 1 || position > MAX_PAGES) return NextResponse.json({ error: "Numéro de page invalide." }, { status: 400 })
  if (file.size > MAX_PAGE_UPLOAD_BYTES) return NextResponse.json({ error: "Image trop lourde : 4 Mo au plus." }, { status: 413 })

  const doc = await supabase.from("scanned_documents").select("id").eq("id", id).eq("user_id", user.id).maybeSingle()
  if (doc.error) {
    if (isMissingSchemaError(doc.error)) return NextResponse.json({ error: "Les documents scannés ne sont pas encore activés." }, { status: 503 })
    return NextResponse.json({ error: "Impossible d'enregistrer la page. Réessayez." }, { status: 500 })
  }
  if (!doc.data) return NextResponse.json({ error: "Document introuvable" }, { status: 404 })

  const raw = Buffer.from(await file.arrayBuffer())
  const sniffed = sniffImage(raw)
  if (!sniffed) return NextResponse.json({ error: "Format non reconnu : photographiez ou importez une image JPEG, PNG ou WebP." }, { status: 415 })
  if (sniffed.width > MAX_IMAGE_SIDE || sniffed.height > MAX_IMAGE_SIDE || sniffed.width * sniffed.height > MAX_INPUT_PIXELS) {
    return NextResponse.json({ error: "Image trop grande : réduisez-la puis réessayez." }, { status: 413 })
  }

  let prepared
  try {
    prepared = await prepareImage(raw)
  } catch (err) {
    if (err instanceof BlogImageError) return NextResponse.json({ error: err.message }, { status: err.code === "upload" ? 503 : 415 })
    throw err
  }

  try {
    const used = await loadUsage(supabase, user.id)
    if (!used) return NextResponse.json({ error: "Les documents scannés ne sont pas encore activés." }, { status: 503 })
    const check = checkQuota(await loadPlanKey(supabase, user.id), used, { bytes: prepared.data.length })
    if (!check.ok) return NextResponse.json({ error: check.message, code: check.code }, { status: 409 })
  } catch (err) {
    if (err instanceof ScanReadError) {
      console.error("[scan] quota :", err.message)
      return NextResponse.json({ error: "Impossible de vérifier votre espace de scan. Réessayez dans un instant." }, { status: 503 })
    }
    throw err
  }

  const path = pagePath(user.id, id, position)
  const uploaded = await supabase.storage.from(SCAN_BUCKET).upload(path, prepared.data, { contentType: "image/webp", upsert: false, cacheControl: "3600" })
  if (uploaded.error) {
    // « Already exists » : la page a déjà été envoyée (nouvel essai après une coupure)
    if (/already exists|duplicate/i.test(uploaded.error.message)) return NextResponse.json({ error: "Cette page est déjà enregistrée." }, { status: 409 })
    console.error("[scan] envoi :", uploaded.error.message)
    return NextResponse.json({ error: "La page n'a pas pu être enregistrée. Réessayez." }, { status: 500 })
  }
  const inserted = await supabase
    .from("scanned_document_pages")
    .insert({ document_id: id, user_id: user.id, position, storage_path: path, mime: "image/webp", bytes: prepared.data.length, width: prepared.width, height: prepared.height })
    .select("id, position, bytes, width, height")
    .single()
  if (inserted.error) {
    await supabase.storage.from(SCAN_BUCKET).remove([path])
    if (inserted.error.code === "23505") return NextResponse.json({ error: "Cette page est déjà enregistrée." }, { status: 409 })
    console.error("[scan] page :", inserted.error.message)
    return NextResponse.json({ error: "La page n'a pas pu être enregistrée. Réessayez." }, { status: 500 })
  }
  return NextResponse.json({ page: inserted.data }, { status: 201 })
}
