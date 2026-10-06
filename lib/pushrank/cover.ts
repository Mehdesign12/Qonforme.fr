/**
 * Image de couverture d'un article PushRank : téléchargée puis re-hébergée dans
 * le stockage public « blog-covers » (PushRank demande de ne pas lier ses URL).
 * Un échec ne bloque jamais la publication : l'article paraît sans couverture.
 */
import { createAdminClient } from "@/lib/supabase/server"

const MAX_BYTES = 8 * 1024 * 1024
const TYPES: Record<string, string> = { "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp", "image/gif": "gif", "image/avif": "avif" }

export async function rehostCover(sourceUrl: string | undefined, slug: string): Promise<string | null> {
  if (!sourceUrl || !/^https:\/\//i.test(sourceUrl)) return null
  try {
    const res = await fetch(sourceUrl, { signal: AbortSignal.timeout(10_000), cache: "no-store" })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const type = (res.headers.get("content-type") ?? "").split(";")[0].trim().toLowerCase()
    const ext = TYPES[type]
    if (!ext) throw new Error(`type ${type || "inconnu"}`)
    if (Number(res.headers.get("content-length") ?? 0) > MAX_BYTES) throw new Error("image trop lourde")
    const buffer = Buffer.from(await res.arrayBuffer())
    if (buffer.length === 0 || buffer.length > MAX_BYTES) throw new Error("taille invalide")

    const supabase = createAdminClient()
    const fileName = `pushrank/${slug}-${Date.now()}.${ext}`
    const { error } = await supabase.storage.from("blog-covers").upload(fileName, buffer, { contentType: type, upsert: false })
    if (error) throw error
    return supabase.storage.from("blog-covers").getPublicUrl(fileName).data.publicUrl
  } catch (err) {
    console.error("[pushrank] Couverture non re-hébergée :", sourceUrl, err instanceof Error ? err.message : err)
    return null
  }
}
