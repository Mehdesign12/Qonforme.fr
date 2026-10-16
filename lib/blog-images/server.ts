/**
 * Enregistrement d'une image du blog (couverture ou image du texte) dans le
 * compartiment public « blog-covers » (lib/blog-images/policy.ts), côté
 * serveur seulement (clé service_role).
 *
 * 1. Contrôle du contenu (sniffImage) : JPEG, PNG ou WebP reconnus à leurs
 *    octets, jamais à l'extension ; 10 000 pixels au plus de chaque côté et
 *    60 mégapixels au plus.
 * 2. Mise au propre avec sharp (déjà présent pour l'optimisation d'images de
 *    Next.js) : orientation appliquée puis métadonnées retirées (une photo de
 *    téléphone porte souvent la position GPS de la prise de vue, et le
 *    compartiment est public), 1 600 px de large au plus (largeur conseillée ;
 *    la colonne de lecture en affiche 700), recompression. Les images du texte
 *    ne passent pas par l'optimiseur de Next : un PNG de 2K renvoyé par le
 *    modèle pèserait plusieurs mégaoctets sur la page. Jamais d'original
 *    gardé tel quel (il garderait ses métadonnées) : sharp indisponible, image
 *    refusée (« upload », 503) ; fichier que sharp ne sait pas lire (JPEG
 *    tronqué…), image refusée (« type », 415).
 * 3. Envoi sous editor/AAAA/MM/… (editor/ia/AAAA/MM/… pour une image générée
 *    par IA) sans écraser un fichier existant, mis en cache
 *    un an (le nom est unique), adresse publique avec les dimensions dans le
 *    fragment (#w=…&h=…).
 */
import { randomBytes } from "node:crypto"
import { createAdminClient } from "@/lib/supabase/server"
import {
  BLOG_IMAGE_BUCKET,
  IMAGE_EXTENSIONS,
  MAX_UPLOAD_BYTES,
  editorImagePath,
  withImageSize,
  type AcceptedImageType,
} from "@/lib/blog-images/policy"
import { sniffImage, type SniffedImage } from "@/lib/blog-images/sniff"
import type { StoredImage } from "@/lib/seo/articles/editor-types"

export type BlogImageErrorCode = "type" | "size" | "upload"

/** Image refusée (`type`, `size`) ou stockage en échec (`upload`), message en français à afficher. */
export class BlogImageError extends Error {
  readonly code: BlogImageErrorCode
  constructor(code: BlogImageErrorCode, message: string) {
    super(message)
    this.name = "BlogImageError"
    this.code = code
  }
}

/** Au-delà, les dimensions ne tiennent plus dans le fragment de l'adresse (readImageSize). */
export const MAX_IMAGE_SIDE = 10_000
/** Largeur maximale enregistrée (largeur conseillée à l'import). */
export const STORED_MAX_WIDTH = 1600
/** Hauteur maximale enregistrée (image en portrait). */
export const STORED_MAX_HEIGHT = 2000
/**
 * Garde-fou contre une image piégée (quelques kilo-octets qui se décompressent
 * en gigaoctets) : refusée avant toute lecture par sharp. Une photo de
 * téléphone de 48 mégapixels passe.
 */
export const MAX_INPUT_PIXELS = 60_000_000
/** Un PNG opaque plus lourd que cela est enregistré en JPEG (photo envoyée en PNG). */
const OPAQUE_PNG_MAX_BYTES = 1_200_000

export const TYPE_ERROR_MESSAGE = "Format non reconnu : importez une image JPEG, PNG ou WebP."
export const SIZE_ERROR_MESSAGE = "Image trop lourde : 5 Mo au plus."
export const UNREADABLE_ERROR_MESSAGE = "Image illisible ou abîmée : ouvrez-la puis réenregistrez-la avant de l'importer."
export const PROCESSING_ERROR_MESSAGE = "Le traitement des images est indisponible pour le moment : l'image n'a pas été enregistrée. Réessayez plus tard."

interface Prepared {
  data: Buffer
  mimeType: AcceptedImageType
  width: number
  height: number
}

type Sharp = typeof import("sharp").default

/** sharp chargé à la demande ; null (absence journalisée) s'il manque ou si son binaire ne se charge pas. */
async function loadSharp(): Promise<Sharp | null> {
  try {
    const mod = (await import("sharp")) as unknown as { default?: Sharp } & Sharp
    const sharp = typeof mod.default === "function" ? mod.default : typeof mod === "function" ? mod : null
    if (!sharp) console.error("[blog-images] sharp illisible : images refusées")
    return sharp
  } catch (error) {
    console.error("[blog-images] sharp indisponible : images refusées", error instanceof Error ? error.message.slice(0, 160) : "")
    return null
  }
}

/**
 * Orientation, métadonnées retirées, taille bornée et recompression.
 * `photo` : sortie JPEG quel que soit le format reçu (images générées,
 * toujours des photos). Jamais l'original : sharp manquant (« upload ») ou
 * en échec (« type ») lève BlogImageError, l'image n'est pas enregistrée
 * (elle garderait ses métadonnées, position GPS comprise).
 */
export async function prepareImage(data: Buffer, sniffed: SniffedImage, opts: { photo?: boolean } = {}): Promise<Prepared> {
  const sharp = await loadSharp()
  if (!sharp) throw new BlogImageError("upload", PROCESSING_ERROR_MESSAGE)
  try {
    const base = () =>
      sharp(data, { failOn: "error", limitInputPixels: MAX_INPUT_PIXELS, pages: 1 })
        .rotate()
        .resize({ width: STORED_MAX_WIDTH, height: STORED_MAX_HEIGHT, fit: "inside", withoutEnlargement: true })
    const asJpeg = () => base().flatten({ background: "#ffffff" }).jpeg({ quality: 82, mozjpeg: true, progressive: true })

    let out: { data: Buffer; info: { width: number; height: number } }
    let mimeType: AcceptedImageType
    if (opts.photo || sniffed.mimeType === "image/jpeg") {
      out = await asJpeg().toBuffer({ resolveWithObject: true })
      mimeType = "image/jpeg"
    } else if (sniffed.mimeType === "image/webp") {
      out = await base().webp({ quality: 82 }).toBuffer({ resolveWithObject: true })
      mimeType = "image/webp"
    } else {
      // PNG : gardé en PNG (transparence, capture d'écran nette), sauf une photo opaque trop lourde
      const meta = await sharp(data, { limitInputPixels: MAX_INPUT_PIXELS }).metadata()
      out = await base().png({ compressionLevel: 9, adaptiveFiltering: true }).toBuffer({ resolveWithObject: true })
      mimeType = "image/png"
      if (!meta.hasAlpha && out.data.length > OPAQUE_PNG_MAX_BYTES) {
        out = await asJpeg().toBuffer({ resolveWithObject: true })
        mimeType = "image/jpeg"
      }
    }
    // Le fichier produit est contrôlé comme un fichier reçu : seul ce qui est relu passe
    const check = sniffImage(out.data)
    if (!check || check.mimeType !== mimeType) throw new Error("fichier produit illisible")
    return { data: out.data, mimeType, width: check.width, height: check.height }
  } catch (error) {
    console.warn("[blog-images] image refusée :", error instanceof Error ? error.message.slice(0, 160) : "sharp en échec")
    throw new BlogImageError("type", UNREADABLE_ERROR_MESSAGE)
  }
}

/**
 * Contrôle, met au propre et enregistre une image du blog ; rend son adresse
 * publique avec les dimensions dans le fragment.
 *
 * @param input.hint   titre ou description : forme le nom du fichier (lisible dans l'adresse)
 * @param input.photo  image générée : toujours enregistrée en JPEG
 * @param input.generated image générée par IA : enregistrée sous editor/ia/ (mention « Illustration générée par IA » sur le blog)
 * @param input.maxBytes taille maximale du fichier enregistré (5 Mo par défaut)
 */
export async function storeBlogImage(input: {
  data: Buffer
  hint: string
  photo?: boolean
  generated?: boolean
  maxBytes?: number
  now?: Date
}): Promise<StoredImage> {
  const sniffed = sniffImage(input.data)
  if (!sniffed) throw new BlogImageError("type", TYPE_ERROR_MESSAGE)
  if (sniffed.width > MAX_IMAGE_SIDE || sniffed.height > MAX_IMAGE_SIDE) {
    throw new BlogImageError("size", "Image trop grande : 10 000 pixels au plus de chaque côté.")
  }
  if (sniffed.width * sniffed.height > MAX_INPUT_PIXELS) {
    throw new BlogImageError("size", "Image trop grande : 60 mégapixels au plus. Réduisez-la (1 600 px de large suffisent) puis réessayez.")
  }

  const prepared = await prepareImage(input.data, sniffed, { photo: input.photo })
  const maxBytes = input.maxBytes ?? MAX_UPLOAD_BYTES
  if (prepared.data.length > maxBytes) throw new BlogImageError("size", SIZE_ERROR_MESSAGE)

  const path = editorImagePath({
    hint: input.hint,
    ext: IMAGE_EXTENSIONS[prepared.mimeType],
    now: input.now ?? new Date(),
    random: randomBytes(4).toString("hex"),
    generated: input.generated,
  })
  const bucket = createAdminClient().storage.from(BLOG_IMAGE_BUCKET)
  let uploaded: { error: unknown }
  try {
    uploaded = await bucket.upload(path, prepared.data, { contentType: prepared.mimeType, upsert: false, cacheControl: "31536000" })
  } catch (error) {
    uploaded = { error }
  }
  if (uploaded.error) {
    console.error("[blog-images] envoi impossible", uploaded.error instanceof Error ? uploaded.error.message : uploaded.error)
    throw new BlogImageError("upload", "L'image n'a pas pu être enregistrée dans le stockage du blog. Réessayez dans un instant.")
  }
  const publicUrl = bucket.getPublicUrl(path).data.publicUrl
  return { url: withImageSize(publicUrl, prepared.width, prepared.height), width: prepared.width, height: prepared.height }
}
