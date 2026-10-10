"use client"

import { useEffect, useRef } from "react"

/**
 * Compte l'ouverture de la page de règlement, une fois par affichage, depuis
 * le navigateur (les robots des messageries qui vérifient les liens ne
 * l'exécutent pas). Aucun cookie, aucune donnée sur la personne.
 */
export function ViewBeacon({ url }: { url: string }) {
  const sent = useRef(false)
  useEffect(() => {
    if (sent.current) return
    sent.current = true
    void fetch(url, { method: "POST", credentials: "omit", keepalive: true }).catch(() => {})
  }, [url])
  return null
}
