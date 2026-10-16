"use client"

/**
 * Envoi d'une image de l'éditeur du blog (couverture ou image du texte) vers
 * POST /api/admin/blog/images/upload, avec des messages en français.
 *
 * Les fonctions de Vercel refusent un corps de plus de 4,5 Mo avant même
 * d'atteindre la route : une photo plus lourde que 4 Mo (souvent le cas d'un
 * téléphone) est d'abord réduite dans le navigateur (2 400 px au plus, JPEG
 * de bonne qualité, ou WebP pour un WebP). Le serveur contrôle et met au
 * propre l'image de toute façon (lib/blog-images/server.ts).
 */
import { ACCEPTED_IMAGE_TYPES, MAX_UPLOAD_BYTES } from "@/lib/blog-images/policy"
import type { StoredImage } from "@/lib/seo/articles/editor-types"

/** Au-delà, l'image est réduite avant l'envoi (marge sous la limite de 4,5 Mo de Vercel). */
const TRANSPORT_LIMIT = 4 * 1024 * 1024
const REDUCED_MAX_SIDE = 2400

export const UPLOAD_HINT = "JPEG, PNG ou WebP · 5 Mo au plus · 1 600 px de large conseillés"
const TYPE_MESSAGE = "Format non pris en charge : importez une image JPEG, PNG ou WebP."
const SIZE_MESSAGE = "Image trop lourde : 5 Mo au plus. Réduisez-la (1 600 px de large suffisent) puis réessayez."

export type UploadResult = { ok: true; image: StoredImage } | { ok: false; error: string }

/** Premier fichier image d'un glisser-déposer ou d'un collage ; null s'il n'y en a pas. */
export function imageFileFrom(list: FileList | DataTransferItemList | null | undefined): File | null {
  if (!list) return null
  for (let i = 0; i < list.length; i++) {
    const entry = list[i]
    const file = entry instanceof File ? entry : entry.kind === "file" ? entry.getAsFile() : null
    if (file && (file.type.startsWith("image/") || file.type === "")) return file
  }
  return null
}

/** Vrai si le glisser-déposer en cours transporte au moins un fichier. */
export function dragHasFiles(e: React.DragEvent): boolean {
  return Array.from(e.dataTransfer?.types ?? []).includes("Files")
}

async function reduce(file: File): Promise<File | null> {
  try {
    const bitmap = await createImageBitmap(file)
    const scale = Math.min(1, REDUCED_MAX_SIDE / Math.max(bitmap.width, bitmap.height))
    const width = Math.max(1, Math.round(bitmap.width * scale))
    const height = Math.max(1, Math.round(bitmap.height * scale))
    const canvas = document.createElement("canvas")
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext("2d")
    if (!ctx) return null
    const type = file.type === "image/webp" ? "image/webp" : "image/jpeg"
    if (type === "image/jpeg") {
      // Fond blanc sous une éventuelle transparence (un JPEG n'en a pas)
      ctx.fillStyle = "#ffffff"
      ctx.fillRect(0, 0, width, height)
    }
    ctx.drawImage(bitmap, 0, 0, width, height)
    bitmap.close?.()
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, 0.88))
    if (!blob) return null
    const name = file.name.replace(/\.[a-z0-9]{1,5}$/i, "") + (type === "image/webp" ? ".webp" : ".jpg")
    return new File([blob], name, { type })
  } catch {
    return null
  }
}

/** Contrôle, réduit si besoin et envoie l'image ; ne lève jamais. */
export async function uploadBlogImage(file: File, signal?: AbortSignal): Promise<UploadResult> {
  if (file.type && !(ACCEPTED_IMAGE_TYPES as readonly string[]).includes(file.type)) return { ok: false, error: TYPE_MESSAGE }

  let body = file
  if (file.size > TRANSPORT_LIMIT) {
    const reduced = await reduce(file)
    if (reduced && reduced.size <= TRANSPORT_LIMIT) body = reduced
    else return { ok: false, error: file.size > MAX_UPLOAD_BYTES ? SIZE_MESSAGE : "Image trop lourde pour l'envoi : réduisez-la sous 4 Mo puis réessayez." }
  }

  const form = new FormData()
  form.append("file", body, body.name || "image")
  try {
    const res = await fetch("/api/admin/blog/images/upload", { method: "POST", body: form, cache: "no-store", signal })
    const json = (await res.json().catch(() => null)) as (StoredImage & { error?: string }) | null
    if (res.ok && json?.url) return { ok: true, image: { url: json.url, width: json.width, height: json.height } }
    if (res.status === 401) return { ok: false, error: "Session expirée : reconnectez-vous." }
    if (res.status === 413) return { ok: false, error: json?.error ?? SIZE_MESSAGE }
    if (res.status === 415) return { ok: false, error: json?.error ?? TYPE_MESSAGE }
    return { ok: false, error: json?.error ?? "L'image n'a pas pu être importée. Réessayez dans un instant." }
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") return { ok: false, error: "Envoi annulé." }
    return { ok: false, error: "Connexion impossible. Vérifiez votre réseau puis réessayez." }
  }
}

/** « ⌘ » sur Mac, « Ctrl » ailleurs (raccourcis affichés). */
export function modKey(): string {
  if (typeof navigator === "undefined") return "Ctrl"
  return /Mac|iPhone|iPad|iPod/i.test(navigator.platform || navigator.userAgent) ? "⌘" : "Ctrl"
}
