'use client'

/**
 * Formule Artisan du compte connecté, pour l'affichage (bouton actif ou
 * « Avec la formule Artisan »). La vérification qui fait foi est côté serveur
 * (lib/artisan/access.ts) : une route refuse toujours avec 402 ARTISAN_REQUIRED.
 *
 * null : pas encore connu (chargement, ou lecture impossible).
 */
import { useEffect, useState } from "react"
import { hasArtisanPlan } from "@/lib/artisan/plan"

export function useArtisanPlan(enabled = true): boolean | null {
  const [artisan, setArtisan] = useState<boolean | null>(null)
  useEffect(() => {
    if (!enabled) return
    let alive = true
    fetch("/api/subscription/status")
      .then((r) => (r.ok ? r.json() : null))
      .then((json) => { if (alive && json) setArtisan(hasArtisanPlan(json)) })
      .catch(() => {})
    return () => { alive = false }
  }, [enabled])
  return artisan
}
