/**
 * Couverture d'un article, de bout en bout : dessin (render.tsx), WebP et
 * métadonnées, stockage du blog. Utilisée par l'éditeur (POST
 * /api/admin/blog/images/cover) et par la rédaction des articles générés
 * (lib/seo/articles/generate.ts).
 *
 * - Nom du fichier : le mot-clé, à défaut le titre (covers/AAAA/MM/<mot-clé>-….webp).
 * - Texte alternatif : le titre de l'article (le texte de l'image), 180
 *   caractères au plus (`coverAlt`, pur).
 * - Métadonnées : titre, description, mot-clé, auteur « Qonforme », origine
 *   « digitalArt » (lib/blog-images/metadata.ts).
 *
 * Aucun appel à un modèle : une couverture ne coûte rien et ne dépend d'aucune
 * clé. Serveur seulement.
 */
import { renderCoverPng } from "@/lib/blog-images/cover/render"
import { ALT_MAX } from "@/lib/blog-images/prompt"
import { storeBlogImage } from "@/lib/blog-images/server"
import type { StoredImage } from "@/lib/seo/articles/editor-types"

/** Texte alternatif de la couverture : le titre, espaces réduits, coupé à ALT_MAX sur une fin de mot. */
export function coverAlt(title: string): string {
  const text = title.replace(/\s+/g, " ").trim()
  if (text.length <= ALT_MAX) return text
  const cut = text.slice(0, ALT_MAX + 1)
  const space = cut.lastIndexOf(" ")
  return (space > 20 ? cut.slice(0, space) : cut.slice(0, ALT_MAX)).replace(/[\s,;:–-]+$/, "")
}

export interface MadeCover extends StoredImage {
  alt: string
  /** Icônes choisies : métier, papiers ou chantier. */
  family: "metier" | "papiers" | "chantier"
}

export async function makeCover(input: { title: string; keyword?: string | null; now?: Date }): Promise<MadeCover> {
  const title = input.title.replace(/\s+/g, " ").trim()
  const keyword = input.keyword?.trim() || null
  const { png, family } = await renderCoverPng({ title, keyword })
  const stored = await storeBlogImage({
    data: png,
    hint: keyword || title,
    cover: true,
    meta: {
      title,
      description: `Couverture de l'article « ${title} »`,
      keywords: [keyword],
      creator: "Qonforme",
      source: "graphic",
    },
    now: input.now,
  })
  return { ...stored, alt: coverAlt(title), family }
}
