"use client"

import { useEffect } from "react"
import { usePathname } from "next/navigation"
import { currentConsent } from "@/lib/consent"
import { syncMetaPixel } from "@/lib/meta-pixel"
import { useConsent } from "@/components/consent/use-consent"

/**
 * Charge le pixel Meta quand, et seulement quand, le visiteur a accepté les
 * cookies. Ne rend rien. Remplace le script inline de `app/layout.tsx`, qui
 * partait avec chaque page sans demander l'accord.
 */
export function TrackingLoader() {
  // Le hook relance l'effet à chaque changement de choix ; la valeur utilisée
  // est relue dans l'effet : à l'hydratation, le hook vaut null (rendu serveur)
  // alors que le visiteur a peut-être déjà accepté, et ce null ne doit jamais
  // passer pour un refus (il effacerait les cookies d'un visiteur consentant).
  const consent = useConsent()
  const pathname = usePathname() ?? "/"

  useEffect(() => {
    syncMetaPixel(currentConsent(), pathname)
  }, [consent, pathname])

  return null
}
