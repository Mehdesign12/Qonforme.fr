/**
 * Où la bulle de contact s'affiche. Pages publiques d'information et d'accès
 * seulement : jamais sur la page Contact elle-même, ni sur les pages destinées au
 * client de l'artisan (règlement, signature), au scan depuis un téléphone, à
 * l'admin et à l'invitation du comptable.
 */
const PUBLIC_PAGES = /^\/($|blog(\/|$)|pricing(\/|$)|guide(\/|$)|modele(\/|$)|outils(\/|$)|facturation(\/|$)|glossaire(\/|$)|devenir-a-son-compte(\/|$)|plan-du-site$|cgu$|mentions-legales$|confidentialite$|login$|signup$|forgot-password$|reset-password$)/

/**
 * Application et démo : le même bouton rond, sur ordinateur seulement (23/10/2026, choix du
 * fondateur). Jamais sur le scan, la page de règlement de la démo ni l'espace du comptable.
 */
const APP_PAGES = /^\/(dashboard|invoices|quotes|clients|products|purchase-orders|credit-notes|settings|planning|documents|chantiers|relances|tresorerie|received-invoices)(\/|$)/
const DEMO_PAGES = /^\/demo(\/(?!regler(\/|$)).*)?$/

export function chatSurface(pathname: string): "bubble" | "app" | null {
  if (PUBLIC_PAGES.test(pathname)) return "bubble"
  if (APP_PAGES.test(pathname) || DEMO_PAGES.test(pathname)) return "app"
  return null
}
