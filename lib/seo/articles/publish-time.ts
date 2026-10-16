/**
 * Heure de publication des Préférences (onglet SEO › Articles › Préférences),
 * lue par les pages de l'éditeur d'articles (admin › Blog › Nouvel article et
 * Modifier) : c'est l'heure proposée quand on programme une publication.
 *
 * Lecture côté serveur (clé service_role) ; null si elle échoue (base
 * injoignable, migration absente) : l'éditeur prend alors l'heure du contexte
 * de référencement, puis 08:00.
 */
import { seoDb } from "@/lib/seo/db"
import { getSettings } from "@/lib/seo/settings"

export async function readPublishTime(): Promise<string | null> {
  try {
    const stored = await getSettings(seoDb(), "articles")
    return stored.value.time
  } catch {
    return null
  }
}
