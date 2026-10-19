"use client"

import { useSyncExternalStore } from "react"
import { currentConsent, subscribeConsent, type ConsentChoice } from "@/lib/consent"

/**
 * Choix de cookies du visiteur : « accepted », « refused », ou null tant qu'il
 * n'a pas répondu. Côté serveur et à l'hydratation : null, pour que le rendu
 * soit identique des deux côtés (règle d'hydratation de CLAUDE.md).
 */
export function useConsent(): ConsentChoice | null {
  return useSyncExternalStore(subscribeConsent, currentConsent, () => null)
}
