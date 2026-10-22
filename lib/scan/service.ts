/**
 * Cœur de l'enregistrement d'un document scanné : création, envoi d'une page,
 * suppression. Utilisé par les routes du compte connecté (client Supabase avec
 * ses droits) ET par les routes du scan depuis un téléphone appairé (client
 * administrateur, limité au compte de l'appairage) : une seule règle de quota,
 * de contrôle des images et de stockage pour les deux.
 *
 * `pairingId` : le document ou la page vient d'un téléphone appairé. Le
 * document porte alors l'appairage ; le téléphone ne touche jamais qu'aux
 * documents de son propre appairage.
 */
import type { SupabaseClient } from "@supabase/supabase-js"
import { isMissingSchemaError } from "@/lib/supabase/schema-guard"
import { ownsClient } from "@/lib/artisan/server"
import { BlogImageError, MAX_IMAGE_SIDE, MAX_INPUT_PIXELS, prepareImage } from "@/lib/blog-images/server"
import { sniffImage } from "@/lib/blog-images/sniff"
import { DOCUMENT_COLUMNS, MAX_PAGES, MAX_PAGE_UPLOAD_BYTES, checkQuota, documentFromRow, type ScanFields } from "@/lib/scan/documents"
import { SCAN_BUCKET, ScanReadError, loadPlanKey, loadUsage, pagePath } from "@/lib/scan/server"

export type ServiceResult = { status: number; body: Record<string, unknown> }
const fail = (status: number, error: string, extra: Record<string, unknown> = {}): ServiceResult => ({ status, body: { error, ...extra } })

const NOT_ACTIVE = "Les documents scannés ne sont pas encore activés."
const QUOTA_CHECK_FAILED = "Impossible de vérifier votre espace de scan. Réessayez dans un instant."

export async function createScanDocument(
  db: SupabaseClient, userId: string, fields: ScanFields, opts: { pairingId?: string } = {},
): Promise<ServiceResult> {
  if (fields.client_id && !(await ownsClient(db, userId, fields.client_id))) return fail(404, "Client introuvable")
  try {
    const used = await loadUsage(db, userId)
    if (!used) return fail(503, NOT_ACTIVE)
    const check = checkQuota(await loadPlanKey(db, userId), used, { documents: 1 })
    if (!check.ok) return fail(409, check.message, { code: check.code })
  } catch (err) {
    if (err instanceof ScanReadError) {
      console.error("[scan] quota :", err.message)
      return fail(503, QUOTA_CHECK_FAILED)
    }
    throw err
  }
  const { data, error } = await db
    .from("scanned_documents")
    .insert({ ...fields, user_id: userId, ...(opts.pairingId ? { pairing_id: opts.pairingId } : {}) })
    .select(DOCUMENT_COLUMNS)
    .single()
  if (error) {
    if (isMissingSchemaError(error)) return fail(503, NOT_ACTIVE)
    if (error.code === "23503") return fail(404, "Client ou chantier introuvable.")
    console.error("[scan] création :", error.message)
    return fail(500, "Le document n'a pas pu être créé. Réessayez.")
  }
  const { pages: _pages, ...document } = documentFromRow(data as unknown as Record<string, unknown>)
  void _pages
  return { status: 201, body: { document } }
}

export async function addScanPage(
  db: SupabaseClient, userId: string, documentId: string, file: unknown, position: number, opts: { pairingId?: string } = {},
): Promise<ServiceResult> {
  if (!(file instanceof File)) return fail(400, "Aucune image reçue.")
  if (!Number.isInteger(position) || position < 1 || position > MAX_PAGES) return fail(400, "Numéro de page invalide.")
  if (file.size > MAX_PAGE_UPLOAD_BYTES) return fail(413, "Image trop lourde : 4 Mo au plus.")

  const doc = await db.from("scanned_documents").select(opts.pairingId ? "id, pairing_id" : "id").eq("id", documentId).eq("user_id", userId).maybeSingle()
  if (doc.error) {
    if (isMissingSchemaError(doc.error)) return fail(503, NOT_ACTIVE)
    return fail(500, "Impossible d'enregistrer la page. Réessayez.")
  }
  const found = doc.data as { id: string; pairing_id?: string | null } | null
  // Un téléphone appairé n'ajoute de pages qu'aux documents créés par son appairage
  if (!found || (opts.pairingId && found.pairing_id !== opts.pairingId)) return fail(404, "Document introuvable")

  const raw = Buffer.from(await file.arrayBuffer())
  const sniffed = sniffImage(raw)
  if (!sniffed) return fail(415, "Format non reconnu : photographiez ou importez une image JPEG, PNG ou WebP.")
  if (sniffed.width > MAX_IMAGE_SIDE || sniffed.height > MAX_IMAGE_SIDE || sniffed.width * sniffed.height > MAX_INPUT_PIXELS) {
    return fail(413, "Image trop grande : réduisez-la puis réessayez.")
  }

  let prepared
  try {
    prepared = await prepareImage(raw)
  } catch (err) {
    if (err instanceof BlogImageError) return fail(err.code === "upload" ? 503 : 415, err.message)
    throw err
  }

  try {
    const used = await loadUsage(db, userId)
    if (!used) return fail(503, NOT_ACTIVE)
    const check = checkQuota(await loadPlanKey(db, userId), used, { bytes: prepared.data.length })
    if (!check.ok) return fail(409, check.message, { code: check.code })
  } catch (err) {
    if (err instanceof ScanReadError) {
      console.error("[scan] quota :", err.message)
      return fail(503, QUOTA_CHECK_FAILED)
    }
    throw err
  }

  const path = pagePath(userId, documentId, position)
  const uploaded = await db.storage.from(SCAN_BUCKET).upload(path, prepared.data, { contentType: "image/webp", upsert: false, cacheControl: "3600" })
  if (uploaded.error) {
    // « Already exists » : la page a déjà été envoyée (nouvel essai après une coupure)
    if (/already exists|duplicate/i.test(uploaded.error.message)) return fail(409, "Cette page est déjà enregistrée.")
    console.error("[scan] envoi :", uploaded.error.message)
    return fail(500, "La page n'a pas pu être enregistrée. Réessayez.")
  }
  const inserted = await db
    .from("scanned_document_pages")
    .insert({ document_id: documentId, user_id: userId, position, storage_path: path, mime: "image/webp", bytes: prepared.data.length, width: prepared.width, height: prepared.height })
    .select("id, position, bytes, width, height")
    .single()
  if (inserted.error) {
    await db.storage.from(SCAN_BUCKET).remove([path])
    if (inserted.error.code === "23505") return fail(409, "Cette page est déjà enregistrée.")
    console.error("[scan] page :", inserted.error.message)
    return fail(500, "La page n'a pas pu être enregistrée. Réessayez.")
  }
  return { status: 201, body: { page: inserted.data } }
}

export async function deleteScanDocument(
  db: SupabaseClient, userId: string, documentId: string, opts: { pairingId?: string } = {},
): Promise<ServiceResult> {
  if (opts.pairingId) {
    const own = await db.from("scanned_documents").select("id, pairing_id").eq("id", documentId).eq("user_id", userId).maybeSingle()
    const row = own.data as { pairing_id?: string | null } | null
    if (own.error || !row || row.pairing_id !== opts.pairingId) return fail(404, "Document introuvable")
  }
  const pages = await db.from("scanned_document_pages").select("storage_path").eq("document_id", documentId).eq("user_id", userId)
  if (pages.error) {
    if (isMissingSchemaError(pages.error)) return fail(503, NOT_ACTIVE)
    console.error("[scan] suppression (pages) :", pages.error.message)
    return fail(500, "Le document n'a pas pu être supprimé. Réessayez.")
  }
  const { data, error } = await db.from("scanned_documents").delete().eq("id", documentId).eq("user_id", userId).select("id")
  if (error) {
    console.error("[scan] suppression :", error.message)
    return fail(500, "Le document n'a pas pu être supprimé. Réessayez.")
  }
  if (!data || data.length === 0) return fail(404, "Document introuvable")
  // Les lignes des pages sont parties avec le document (cascade) ; les fichiers sont retirés ensuite
  const paths = (pages.data ?? []).map((p) => (p as { storage_path: string }).storage_path)
  if (paths.length > 0) {
    const removed = await db.storage.from(SCAN_BUCKET).remove(paths)
    if (removed.error) console.error("[scan] suppression des fichiers :", removed.error.message)
  }
  return { status: 200, body: { ok: true } }
}
