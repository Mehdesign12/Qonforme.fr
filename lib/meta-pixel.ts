/**
 * Pixel Meta : chargé seulement après l'accord du visiteur (18/10/2026).
 *
 * Avant cette date, le script partait avec chaque page, sans bandeau, alors que
 * la politique de confidentialité disait le contraire. Désormais :
 *   - `syncMetaPixel` (appelé par `components/consent/TrackingLoader.tsx`) charge
 *     le script quand le choix est « accepté » et le coupe quand il change ;
 *   - `trackEvent` ne fait rien sans accord, même si le script est en mémoire ;
 *   - aucune image `<noscript>` : sans JavaScript, aucun traceur ne part.
 */
import { currentConsent, isTrackingPage, type ConsentChoice } from "@/lib/consent"

export const META_PIXEL_ID = "1280812480690943"

type Fbq = ((...args: unknown[]) => void) & {
  callMethod?: (...args: unknown[]) => void
  queue: unknown[]
  loaded: boolean
  version: string
  push: unknown
}

declare global {
  interface Window {
    fbq?: Fbq
    _fbq?: Fbq
  }
}

let started = false
let revoked = false
let cookiesCleared = false
let lastPath: string | null = null

/* eslint-disable prefer-rest-params -- le code officiel de Meta lit `arguments` tel quel */
/** Installe `fbq` et charge `fbevents.js` : le code officiel de Meta, sans script inline. */
function inject(): void {
  if (window.fbq) return
  const fbq: Fbq = function () {
    if (fbq.callMethod) fbq.callMethod(...(Array.prototype.slice.call(arguments) as unknown[]))
    else fbq.queue.push(arguments)
  } as unknown as Fbq
  window.fbq = fbq
  if (!window._fbq) window._fbq = fbq
  fbq.push = fbq
  fbq.loaded = true
  fbq.version = "2.0"
  fbq.queue = []
  const script = document.createElement("script")
  script.async = true
  script.src = "https://connect.facebook.net/en_US/fbevents.js"
  document.head.appendChild(script)
  fbq("init", META_PIXEL_ID)
}
/* eslint-enable prefer-rest-params */

/** Supprime les cookies du pixel, sur le domaine et ses parents (le pixel les pose sur « .qonforme.fr »). */
export function clearMetaCookies(): void {
  const parts = location.hostname.split(".")
  const domains: Array<string | null> = [null]
  for (let i = 0; i < parts.length - 1; i++) domains.push(`.${parts.slice(i).join(".")}`)
  for (const name of ["_fbp", "_fbc"]) {
    for (const domain of domains) {
      document.cookie = `${name}=; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/; SameSite=Lax${domain ? `; domain=${domain}` : ""}`
    }
  }
}

/**
 * Aligne le pixel sur le choix du visiteur et sur la page affichée.
 * - « accepté » : charge le script au premier appel, puis envoie un PageView à
 *   chaque changement de page (navigation sans rechargement comprise) ;
 * - sinon : coupe le pixel s'il était chargé et efface ses cookies, y compris
 *   ceux déposés avant le bandeau par les visites précédentes.
 * Sur une page exclue (règlement, signature, admin…), rien ne part.
 */
export function syncMetaPixel(choice: ConsentChoice | null, path: string): void {
  if (typeof window === "undefined") return

  if (choice !== "accepted") {
    if (started && !revoked) {
      window.fbq?.("consent", "revoke")
      revoked = true
      lastPath = null
    }
    if (!cookiesCleared) {
      clearMetaCookies()
      cookiesCleared = true
    }
    return
  }

  cookiesCleared = false
  if (!isTrackingPage(path)) return

  if (!started) {
    inject()
    started = true
  } else if (revoked) {
    window.fbq?.("consent", "grant")
    revoked = false
  }
  if (lastPath !== path) {
    window.fbq?.("track", "PageView")
    lastPath = path
  }
}

export function trackEvent(event: string, data?: Record<string, unknown>) {
  if (typeof window === "undefined" || !window.fbq) return
  if (currentConsent() !== "accepted" || !isTrackingPage(window.location.pathname)) return
  window.fbq("track", event, data)
}
