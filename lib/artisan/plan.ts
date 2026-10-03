/**
 * Accès à la formule Artisan — fonctions pures, utilisables côté client.
 *
 * Situations de travaux, factures d'acompte et de solde, retenue de garantie,
 * autoliquidation en sous-traitance et suivi par chantier sont réservés à la
 * formule Artisan (identifiant interne `pro`, lib/stripe/plans.ts ;
 * DECISIONS-STRATEGIQUES.md § 4 et § 12). La vérification qui fait foi est
 * côté serveur (lib/artisan/access.ts) ; ici, seulement de quoi afficher le bon
 * écran et la bonne fenêtre.
 */
import { canIssueInvoices } from "@/lib/stripe/access"

/** Code renvoyé (HTTP 402) par toute route Artisan appelée sans la formule. */
export const ARTISAN_REQUIRED = "ARTISAN_REQUIRED"

/** Formule Artisan active (impayé en cours de nouvelle tentative compris, comme pour l'émission). */
export function hasArtisanPlan(sub: { plan?: string | null; status?: string | null } | null | undefined): boolean {
  return sub?.plan === "pro" && canIssueInvoices(sub?.status)
}

/** La réponse d'une route demande-t-elle la formule Artisan ? */
export function isArtisanRequired(status: number, json: { code?: string } | null | undefined): boolean {
  return status === 402 && json?.code === ARTISAN_REQUIRED
}
