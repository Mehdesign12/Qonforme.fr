/**
 * Pages à rafraîchir après la publication, la modification ou le retrait d'un
 * article du blog : la liste, l'article, le plan du site XML et le plan du
 * site HTML. Sans cela, un nouvel article restait absent de /sitemap.xml
 * jusqu'à environ 28 h (constaté le 07/10/2026 sur l'article de PushRank).
 */
import { revalidatePath } from "next/cache"

export function revalidateBlog(slug?: string | null): void {
  try {
    revalidatePath("/blog")
    if (slug) revalidatePath(`/blog/${slug}`)
    revalidatePath("/sitemap.xml")
    revalidatePath("/plan-du-site")
  } catch {
    // Hors requête (tests, script) : sans effet
  }
}
