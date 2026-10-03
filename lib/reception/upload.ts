/**
 * Lecture d'un dépôt de fichier (multipart/form-data) dans une route d'API :
 * taille bornée avant toute lecture, champ « file » obligatoire, champ
 * « manual » (JSON) facultatif pour la saisie d'un PDF simple.
 */
import { MAX_UPLOAD_BYTES } from "@/lib/reception/bytes"

export type UploadRead =
  | { ok: true; bytes: Uint8Array; name: string; manual: unknown }
  | { ok: false; status: number; error: string }

/** Marge pour l'enveloppe multipart et la saisie manuelle. */
const ENVELOPE = 64 * 1024

export async function readUpload(request: Request): Promise<UploadRead> {
  const length = Number(request.headers.get("content-length") ?? "0")
  if (length > MAX_UPLOAD_BYTES + ENVELOPE) {
    return { ok: false, status: 413, error: "Fichier trop lourd : 4 Mo au maximum." }
  }
  if (!(request.headers.get("content-type") ?? "").toLowerCase().startsWith("multipart/form-data")) {
    return { ok: false, status: 400, error: "Envoyez le fichier par un formulaire." }
  }

  let form: FormData
  try {
    form = await request.formData()
  } catch {
    return { ok: false, status: 400, error: "Envoi illisible. Réessayez." }
  }

  const file = form.get("file")
  if (!file || typeof file === "string") return { ok: false, status: 400, error: "Aucun fichier reçu." }
  if (file.size === 0) return { ok: false, status: 400, error: "Le fichier est vide." }
  if (file.size > MAX_UPLOAD_BYTES) return { ok: false, status: 413, error: "Fichier trop lourd : 4 Mo au maximum." }

  let manual: unknown = undefined
  const rawManual = form.get("manual")
  if (typeof rawManual === "string" && rawManual.trim()) {
    if (rawManual.length > 8 * 1024) return { ok: false, status: 400, error: "Saisie trop longue." }
    try {
      manual = JSON.parse(rawManual)
    } catch {
      return { ok: false, status: 400, error: "Saisie illisible." }
    }
  }

  const bytes = new Uint8Array(await file.arrayBuffer())
  return { ok: true, bytes, name: "name" in file ? String((file as File).name ?? "") : "", manual }
}
