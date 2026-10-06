import type { ShellMode } from "@/components/layout/nav"

/** Identité affichée par la coque (barre latérale, barre supérieure, feuille « Plus »). */
export interface ShellIdentity {
  mode: ShellMode
  firstName: string
  lastName: string
  email: string
  /** Nom de la formule qui permet d'émettre (« Essentiel »), ou null pour la version gratuite. */
  planName: string | null
  companyName: string | null
  siren: string | null
}

/** Identité fictive de la démo (mêmes données que le canevas ; SIREN volontairement invalide). */
export const DEMO_IDENTITY: ShellIdentity = {
  mode: "demo",
  firstName: "Thomas",
  lastName: "Garnier",
  email: "demo@qonforme.fr",
  planName: "Essentiel",
  companyName: "Garnier Plâtrerie Isolation",
  siren: "948211375",
}

/**
 * Compte neuf de la démo (/demo/bienvenue) : ni entreprise, ni prénom, ni
 * formule, comme le voit un artisan qui vient de s'inscrire.
 */
export const DEMO_NEW_IDENTITY: ShellIdentity = {
  mode: "demo",
  firstName: "",
  lastName: "",
  email: "demo@qonforme.fr",
  planName: null,
  companyName: null,
  siren: null,
}

export function fullNameOf(id: ShellIdentity): string {
  return [id.firstName, id.lastName].filter(Boolean).join(" ") || "Mon compte"
}

/** « 948211375 » → « 948 211 375 ». */
export function formatSiren(siren: string | null): string | null {
  const digits = (siren ?? "").replace(/\D/g, "")
  if (digits.length !== 9) return null
  return `${digits.slice(0, 3)} ${digits.slice(3, 6)} ${digits.slice(6)}`
}
