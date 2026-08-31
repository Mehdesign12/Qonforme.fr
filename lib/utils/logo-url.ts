/**
 * Valide qu'une URL de logo pointe bien vers le bucket Supabase Storage public
 * de ce projet (https + même hostname que NEXT_PUBLIC_SUPABASE_URL).
 *
 * Sans ce garde-fou, une valeur arbitraire posée via PATCH /api/company était
 * fetch()ée telle quelle côté serveur lors de chaque génération de PDF
 * (lib/pdf/{invoice,quote,credit-note,purchase-order}.ts) — un utilisateur
 * pouvait pointer logo_url vers une adresse interne (ex: métadonnées cloud,
 * service interne au réseau) et déclencher une requête sortante depuis le
 * serveur vers une cible de son choix (SSRF) à chaque aperçu/téléchargement/
 * envoi de facture.
 */
export function isAllowedLogoUrl(url: string): boolean {
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    return false
  }
  if (parsed.protocol !== "https:") return false

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  if (!supabaseUrl) return false

  let supabaseHost: string
  try {
    supabaseHost = new URL(supabaseUrl).hostname
  } catch {
    return false
  }

  return parsed.hostname === supabaseHost
}
