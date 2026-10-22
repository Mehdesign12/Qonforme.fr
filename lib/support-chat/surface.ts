/**
 * Où la bulle de contact s'affiche. Pages publiques d'information et d'accès
 * seulement : jamais sur la page Contact elle-même, ni sur les pages destinées au
 * client de l'artisan (règlement, signature), au scan depuis un téléphone, à
 * l'admin et à l'invitation du comptable.
 */
const PUBLIC_PAGES = /^\/($|blog(\/|$)|pricing(\/|$)|guide(\/|$)|modele(\/|$)|outils(\/|$)|facturation(\/|$)|glossaire(\/|$)|devenir-a-son-compte(\/|$)|plan-du-site$|cgu$|mentions-legales$|confidentialite$|login$|signup$|forgot-password$|reset-password$)/

export function chatSurface(pathname: string): "bubble" | null {
  return PUBLIC_PAGES.test(pathname) ? "bubble" : null
}
