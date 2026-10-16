/**
 * Images du blog (couvertures et images du texte) : où elles vivent, ce que
 * le blog public accepte d'afficher, et leurs dimensions.
 *
 * - Stockage : compartiment public « blog-covers » du projet Supabase (celui
 *   des couvertures existantes) ; images de l'éditeur sous « editor/ »,
 *   images générées par IA sous « editor/ia/ » : l'adresse garde la trace de
 *   leur origine (isGeneratedBlogImage), et le blog affiche « Illustration
 *   générée par IA » sous elles (AI Act, art. 50).
 * - Le moteur Markdown du blog (lib/markdown.ts) n'affiche une image du texte
 *   que si son adresse est dans ce compartiment (isBlogImageUrl) : pas
 *   d'image chargée depuis un site tiers (vie privée des lecteurs, images
 *   qui disparaissent).
 * - Les dimensions voyagent dans le fragment de l'adresse
 *   (« …/photo.jpg#w=1600&h=900 ») : le fragment n'est jamais envoyé au
 *   serveur, et la page réserve la place de l'image (pas de saut de mise en
 *   page).
 *
 * Module pur : navigateur, serveur et tests (NEXT_PUBLIC_SUPABASE_URL est
 * disponible des deux côtés).
 */

export const BLOG_IMAGE_BUCKET = "blog-covers"

/** Formats acceptés à l'import et produits par la génération. */
export const ACCEPTED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"] as const
export type AcceptedImageType = (typeof ACCEPTED_IMAGE_TYPES)[number]

export const IMAGE_EXTENSIONS: Record<AcceptedImageType, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
}

/** 5 Mo : une photo de téléphone tient, un fichier brut non. */
export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024

/** Formats proposés à la génération (couverture : 16:9 imposé). */
export const IMAGE_ASPECTS = ["16:9", "4:3", "1:1"] as const
export type ImageAspect = (typeof IMAGE_ASPECTS)[number]

export const IMAGE_ASPECT_LABELS: Record<ImageAspect, string> = {
  "16:9": "Paysage 16:9",
  "4:3": "Photo 4:3",
  "1:1": "Carré 1:1",
}

const PUBLIC_PATH = `/storage/v1/object/public/${BLOG_IMAGE_BUCKET}/`

function supabaseHost(supabaseUrl: string | undefined): string | null {
  if (!supabaseUrl) return null
  try {
    return new URL(supabaseUrl).hostname.toLowerCase()
  } catch {
    return null
  }
}

/**
 * Vrai si l'adresse est une image publique du compartiment du blog de ce
 * projet : https, même hôte que NEXT_PUBLIC_SUPABASE_URL, chemin
 * /storage/v1/object/public/blog-covers/…, sans espace, guillemet, chevron
 * ni « .. ». Le fragment des dimensions est admis.
 */
export function isBlogImageUrl(url: string, supabaseUrl: string | undefined = process.env.NEXT_PUBLIC_SUPABASE_URL): boolean {
  const host = supabaseHost(supabaseUrl)
  if (!host || typeof url !== "string") return false
  if (/[\s"'<>`\\]/.test(url)) return false
  let u: URL
  try {
    u = new URL(url)
  } catch {
    return false
  }
  if (u.protocol !== "https:" || u.hostname.toLowerCase() !== host || u.port) return false
  if (u.username || u.password) return false
  if (!u.pathname.startsWith(PUBLIC_PATH) || u.pathname.length <= PUBLIC_PATH.length) return false
  if (u.pathname.includes("..") || u.pathname.includes("//")) return false
  return true
}

/** Dossier des images générées par IA dans le compartiment du blog. */
const GENERATED_DIR = "editor/ia/"

/** Vrai pour une image du blog générée par IA (studio d'images de l'éditeur, enregistrée sous editor/ia/). */
export function isGeneratedBlogImage(url: string | null | undefined, supabaseUrl: string | undefined = process.env.NEXT_PUBLIC_SUPABASE_URL): boolean {
  if (!url || !isBlogImageUrl(url, supabaseUrl)) return false
  return new URL(url).pathname.startsWith(`${PUBLIC_PATH}${GENERATED_DIR}`)
}

/** Ajoute (ou remplace) les dimensions dans le fragment de l'adresse. */
export function withImageSize(url: string, width: number, height: number): string {
  const base = url.split("#")[0]
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) return base
  return `${base}#w=${Math.round(width)}&h=${Math.round(height)}`
}

/** Adresse sans fragment et dimensions lues dans le fragment (null si absentes ou invalides). */
export function readImageSize(url: string): { src: string; width: number | null; height: number | null } {
  const [src, fragment = ""] = url.split("#")
  const w = fragment.match(/(?:^|&)w=(\d{1,5})(?:&|$)/)
  const h = fragment.match(/(?:^|&)h=(\d{1,5})(?:&|$)/)
  const width = w ? Number(w[1]) : null
  const height = h ? Number(h[1]) : null
  const valid = width !== null && height !== null && width > 0 && height > 0 && width <= 10000 && height <= 10000
  return { src, width: valid ? width : null, height: valid ? height : null }
}

/**
 * Chemin de stockage d'une image de l'éditeur : editor/AAAA/MM/<indice>-<horodatage><aléa>.<ext>,
 * ou editor/ia/AAAA/MM/… pour une image générée par IA (`generated`).
 */
export function editorImagePath(input: { hint: string; ext: string; now: Date; random: string; generated?: boolean }): string {
  const slug =
    input.hint
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 48)
      .replace(/-+$/, "") || "image"
  const y = input.now.getUTCFullYear()
  const m = String(input.now.getUTCMonth() + 1).padStart(2, "0")
  const rand = input.random.replace(/[^a-z0-9]/gi, "").slice(0, 6).toLowerCase() || "0"
  return `${input.generated ? GENERATED_DIR : "editor/"}${y}/${m}/${slug}-${input.now.getTime().toString(36)}${rand}.${input.ext}`
}
