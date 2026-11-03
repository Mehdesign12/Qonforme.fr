/**
 * Logo envoyé avant que l'entreprise existe (décision du fondateur, 03/11/2026 :
 * aucun blocage, le logo s'ajoute dès l'arrivée). `POST /api/company/logo` range
 * le fichier sous `company-assets/logos/<compte>/logo.<ext>` même sans fiche
 * entreprise ; la création de l'entreprise le retrouve ici et le rattache.
 * Ne lève jamais : sans logo trouvé (ou stockage injoignable), null.
 */
import type { SupabaseClient } from "@supabase/supabase-js"

const BUCKET = "company-assets"
const LOGO_FILE = /^logo\.(png|jpe?g|webp|svg)$/i

export async function storedLogoUrl(admin: SupabaseClient, userId: string): Promise<string | null> {
  try {
    const { data, error } = await admin.storage.from(BUCKET).list(`logos/${userId}`, { limit: 20 })
    if (error || !Array.isArray(data)) return null
    const file = data
      .filter((f) => LOGO_FILE.test(f.name))
      .sort((a, b) => String(b.updated_at ?? b.created_at ?? "").localeCompare(String(a.updated_at ?? a.created_at ?? "")))[0]
    if (!file) return null
    return admin.storage.from(BUCKET).getPublicUrl(`logos/${userId}/${file.name}`).data.publicUrl
  } catch {
    return null
  }
}
