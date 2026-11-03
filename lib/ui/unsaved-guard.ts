/**
 * Garde « modifications non enregistrées » : décide si un clic sur un lien
 * quitte la page en cours (et doit donc être retenu tant qu'un formulaire a
 * des modifications non enregistrées).
 *
 * Fonction pure, testée dans __tests__/unsaved-guard.test.ts. Le composant qui
 * l'utilise est components/shared/UnsavedChangesGuard.tsx.
 */

/** Évènement émis quand un lien est retenu (la barre de chargement s'arrête). */
export const NAVIGATION_HELD_EVENT = "qonforme:navigation-held"

export interface LinkClick {
  /** Attribut href du lien, tel qu'écrit. */
  href: string
  /** Attribut target du lien (« _blank » : nouvel onglet, la page reste). */
  target?: string | null
  /** Lien de téléchargement : la page reste. */
  download?: boolean
  /** Ctrl, Cmd, Maj, Alt ou bouton du milieu : nouvel onglet ou fenêtre, la page reste. */
  modified?: boolean
}

export interface CurrentLocation {
  origin: string
  pathname: string
  search: string
}

/**
 * Adresse interne vers laquelle le clic emmène (chemin, paramètres et ancre),
 * ou `null` si le clic ne quitte pas la page : nouvel onglet, téléchargement,
 * autre site, `mailto:`/`tel:`, ancre de la même page, ou même adresse.
 */
export function leavingTarget(link: LinkClick, here: CurrentLocation): string | null {
  if (link.modified || link.download) return null
  if (link.target && link.target !== "_self") return null
  const raw = link.href.trim()
  if (!raw || raw.startsWith("#")) return null

  let url: URL
  try {
    url = new URL(raw, here.origin + here.pathname + here.search)
  } catch {
    return null
  }
  if (url.origin !== here.origin) return null
  // Seule l'ancre change : la page reste
  if (url.pathname === here.pathname && url.search === here.search) return null
  return url.pathname + url.search + url.hash
}
