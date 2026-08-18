/**
 * Utilitaires PWA côté navigateur.
 *
 * Toutes les fonctions sont sûres à appeler côté serveur : elles retournent une
 * valeur neutre si `window` n'existe pas. Les composants qui s'en servent pour
 * décider d'un rendu doivent malgré tout attendre le montage (voir `hooks.ts`) —
 * sans quoi le HTML serveur et le premier rendu client divergent, ce qui
 * déclenche une boucle de recovery React sur mobile (règle next-themes, CLAUDE.md).
 */

/** Clé localStorage mémorisant le refus de la bannière d'installation. */
export const INSTALL_DISMISSED_KEY = 'qonforme:pwa-install-dismissed-at'

/** Délai avant de reproposer l'installation après un refus — 30 jours. */
export const INSTALL_COOLDOWN_MS = 30 * 24 * 60 * 60 * 1000

/** L'app tourne-t-elle en plein écran (écran d'accueil iOS ou PWA installée) ? */
export function isStandalone(): boolean {
  if (typeof window === 'undefined') return false

  // `navigator.standalone` est le seul signal fiable sur iOS Safari :
  // le média `display-mode: standalone` n'y est supporté que depuis iOS 16.4.
  const iosStandalone = (window.navigator as Navigator & { standalone?: boolean }).standalone

  return (
    iosStandalone === true ||
    window.matchMedia('(display-mode: standalone)').matches ||
    window.matchMedia('(display-mode: fullscreen)').matches
  )
}

/** iPhone / iPad, y compris les iPad récents qui s'annoncent comme macOS tactile. */
export function isIOS(): boolean {
  if (typeof window === 'undefined') return false

  const ua = window.navigator.userAgent
  const isIPadOS = /Macintosh/.test(ua) && window.navigator.maxTouchPoints > 1

  return /iPad|iPhone|iPod/.test(ua) || isIPadOS
}

/** Safari — seul navigateur iOS capable d'ajouter à l'écran d'accueil. */
export function isSafari(): boolean {
  if (typeof window === 'undefined') return false

  const ua = window.navigator.userAgent
  // Chrome, Firefox et Edge sur iOS embarquent WebKit mais se signalent
  // par CriOS / FxiOS / EdgiOS, et n'exposent pas « Sur l'écran d'accueil ».
  return /Safari/.test(ua) && !/CriOS|FxiOS|EdgiOS|OPiOS/.test(ua)
}

/** L'utilisateur a-t-il refusé la bannière récemment ? */
export function isInstallPromptSnoozed(): boolean {
  if (typeof window === 'undefined') return true

  try {
    const raw = window.localStorage.getItem(INSTALL_DISMISSED_KEY)
    if (!raw) return false

    const dismissedAt = Number(raw)
    if (!Number.isFinite(dismissedAt)) return false

    return Date.now() - dismissedAt < INSTALL_COOLDOWN_MS
  } catch {
    // Safari en navigation privée peut refuser l'accès au localStorage.
    return false
  }
}

/** Mémorise le refus de la bannière d'installation. */
export function snoozeInstallPrompt(): void {
  try {
    window.localStorage.setItem(INSTALL_DISMISSED_KEY, String(Date.now()))
  } catch {
    // Stockage indisponible : la bannière réapparaîtra, sans conséquence.
  }
}

/**
 * Purge le HTML mis en cache par le service worker.
 *
 * À appeler à la déconnexion : même si le service worker ne met en cache que des
 * pages publiques, cela garantit qu'aucune page rendue pour l'utilisateur
 * précédent ne puisse être resservie.
 */
export function purgePwaPageCache(): void {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return

  navigator.serviceWorker.controller?.postMessage({ type: 'PURGE_PAGES' })
}
