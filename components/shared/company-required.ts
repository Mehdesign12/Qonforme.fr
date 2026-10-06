/**
 * Envoi refusé faute d'identité de l'émetteur (409 `COMPANY_REQUIRED`,
 * lib/legal/issuer.ts) : le message de la route, avec une action « Compléter »
 * qui mène à Paramètres › Entreprise.
 */
import { toast } from "sonner"
import { isCompanyRequired } from "@/lib/onboarding/inscription"

const FALLBACK = "Ajoutez le SIREN et l'adresse de votre entreprise avant l'envoi (Paramètres › Entreprise)."

/** Affiche le message si la réponse est un 409 `COMPANY_REQUIRED` ; vrai si c'est le cas. */
export function toastCompanyRequired(status: number, json: { code?: string; error?: string } | null | undefined): boolean {
  if (!isCompanyRequired(status, json)) return false
  toast.error(json?.error || FALLBACK, {
    duration: 10_000,
    action: { label: "Compléter", onClick: () => { window.location.href = "/settings/company" } },
  })
  return true
}
