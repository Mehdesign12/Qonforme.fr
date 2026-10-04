"use client"

import { useEffect } from "react"
import { usePathname } from "next/navigation"

/**
 * Pages publiques de contenu (référencement) : pas d'enregistrement de
 * session. Le replay y coûtait une longue tâche de ~300 ms sur mobile pour
 * des pages statiques, sans rien apprendre d'utile (PushRank : LCP mobile et
 * JavaScript inutilisé, 04/10/2026).
 */
const CONTENT_PREFIXES = ["/blog", "/guide", "/modele", "/facturation", "/glossaire", "/outils", "/plan-du-site", "/mentions-legales", "/cgu", "/confidentialite", "/demo"]
const isContentPage = (path: string) => path === "/" || CONTENT_PREFIXES.some((p) => path === p || path.startsWith(`${p}/`))

let requested = false

/**
 * Enregistrement de session Sentry sur erreur, ajouté quand le navigateur est
 * libre, à la première page qui n'est pas une page de contenu (navigation
 * comprise : un visiteur qui passe du blog à l'inscription est couvert).
 * L'import dynamique sort le replay du JavaScript initial (sentry.client.config.ts).
 */
export function SentryReplay() {
  const pathname = usePathname()

  useEffect(() => {
    if (requested || process.env.NODE_ENV !== "production" || !pathname || isContentPage(pathname)) return
    requested = true
    const load = () => {
      import("@sentry/nextjs")
        .then(({ addIntegration, replayIntegration }) => addIntegration(replayIntegration()))
        .catch(() => {})
    }
    if ("requestIdleCallback" in window) window.requestIdleCallback(load, { timeout: 5000 })
    else setTimeout(load, 2000)
  }, [pathname])

  return null
}
