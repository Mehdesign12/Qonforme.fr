/**
 * Consentement aux traceurs publicitaires (18/10/2026).
 *
 * Le pixel Meta dépose le cookie `_fbp` : il demande l'accord préalable du
 * visiteur (CNIL, article 82 de la loi Informatique et Libertés). Rien n'est
 * chargé tant que le visiteur n'a pas accepté ; refuser est aussi simple
 * qu'accepter. Le choix est gardé six mois sur l'appareil (durée conseillée
 * par la CNIL), puis redemandé.
 *
 * Ce module ne dépend pas de React : la logique pure se teste sans navigateur.
 * Le hook est dans `components/consent/use-consent.ts`.
 */

export const CONSENT_KEY = "qonforme-cookie-consent"
/** Évènement interne : le choix vient de changer dans cet onglet. */
export const CONSENT_EVENT = "qonforme:consent"
/** Évènement interne : rouvrir le bandeau (pied de page, politique de confidentialité). */
export const SETTINGS_EVENT = "qonforme:cookie-settings"
/** Six mois : durée de validité du choix. */
export const CONSENT_MAX_AGE_MS = 182 * 24 * 60 * 60 * 1000

export type ConsentChoice = "accepted" | "refused"

/**
 * Pages où aucun traceur ne se charge et où le bandeau ne s'affiche pas :
 * pages destinées aux clients de l'artisan (règlement et signature : le jeton
 * figure dans l'adresse), admin, invitation du comptable.
 */
export const NO_TRACKING_PATHS = /^\/((demo\/)?regler\/|s\/|signer(\/|$)|admin(\/|$)|invitation-comptable)/

export function isTrackingPage(pathname: string): boolean {
  return !NO_TRACKING_PATHS.test(pathname)
}

/** Relit une valeur enregistrée sans lui faire confiance : tout ce qui est douteux vaut « pas de choix ». */
export function parseConsent(raw: string | null | undefined, now: number = Date.now()): ConsentChoice | null {
  if (!raw) return null
  try {
    const value = JSON.parse(raw) as { v?: unknown; choice?: unknown; at?: unknown }
    if (value?.v !== 1) return null
    if (value.choice !== "accepted" && value.choice !== "refused") return null
    if (typeof value.at !== "number" || !Number.isFinite(value.at)) return null
    // Date dans le futur (horloge déréglée) ou choix trop ancien : on redemande
    if (value.at > now + 60_000 || now - value.at > CONSENT_MAX_AGE_MS) return null
    return value.choice
  } catch {
    return null
  }
}

export function serializeConsent(choice: ConsentChoice, now: number = Date.now()): string {
  return JSON.stringify({ v: 1, choice, at: now })
}

/** Choix en cours, ou null s'il n'y en a pas (jamais demandé, expiré, stockage indisponible). */
export function readConsent(): ConsentChoice | null {
  if (typeof window === "undefined") return null
  try {
    return parseConsent(window.localStorage.getItem(CONSENT_KEY))
  } catch {
    return null
  }
}

/** Repli quand le stockage du navigateur est indisponible (navigation privée stricte). */
let memoryChoice: ConsentChoice | null = null

export function writeConsent(choice: ConsentChoice): void {
  if (typeof window === "undefined") return
  try {
    window.localStorage.setItem(CONSENT_KEY, serializeConsent(choice))
    memoryChoice = null
  } catch {
    // Stockage bloqué : le choix vaut pour cette visite seulement
    memoryChoice = choice
  }
  window.dispatchEvent(new Event(CONSENT_EVENT))
}

export function currentConsent(): ConsentChoice | null {
  return readConsent() ?? memoryChoice
}

export function subscribeConsent(onChange: () => void): () => void {
  if (typeof window === "undefined") return () => {}
  window.addEventListener(CONSENT_EVENT, onChange)
  // Autre onglet : le stockage change, pas notre évènement
  window.addEventListener("storage", onChange)
  return () => {
    window.removeEventListener(CONSENT_EVENT, onChange)
    window.removeEventListener("storage", onChange)
  }
}

export function openCookieSettings(): void {
  if (typeof window === "undefined") return
  window.dispatchEvent(new Event(SETTINGS_EVENT))
}
