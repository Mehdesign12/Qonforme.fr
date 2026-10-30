/**
 * États du raccordement à la plateforme agréée (canevas « Facturation
 * électronique », planches 5 à 9) et calcul de l'état depuis ce que Super PDP
 * répond. Module pur, partagé par le serveur et l'interface.
 *
 * Ne dit que ce que la plateforme expose :
 * - `oauth2_sessions/me` : vérification de l'entreprise (KYB : verified,
 *   needs_review, failed) et de l'identité (verified, needs_review, failed,
 *   not_verified) ;
 * - `directory_entries` : la ligne d'annuaire de réception (pending, created,
 *   error ; « en erreur pendant la portabilité, il ne faut pas la supprimer »,
 *   documentation « Annuaire ») ;
 * - `french_directory/entries` : l'annuaire de la facturation électronique,
 *   tel que les fournisseurs le consultent.
 */

export type PaStatus =
  | "verifying"          // vérification en cours chez Super PDP
  | "manual_review"      // contrôle manuel en cours chez Super PDP
  | "refused"            // vérification refusée
  | "transfer"           // adresse en cours de transfert depuis une autre plateforme (5 jours au plus)
  | "directory_missing"  // raccordé, mais l'adresse n'est pas (encore) dans l'annuaire
  | "active"             // réception active
  | "expired"            // autorisation expirée ou retirée chez Super PDP

export const PA_STATUSES: readonly PaStatus[] = ["verifying", "manual_review", "refused", "transfer", "directory_missing", "active", "expired"]

export const isPaStatus = (v: unknown): v is PaStatus => typeof v === "string" && (PA_STATUSES as readonly string[]).includes(v)

/** États où la relève des factures peut tourner (l'entreprise est vérifiée). */
export const SYNCABLE: readonly PaStatus[] = ["active", "directory_missing", "transfer"]

export interface PlatformFacts {
  company: "verified" | "needs_review" | "failed"
  identity?: "verified" | "needs_review" | "failed" | "not_verified" | null
  /** Lignes d'annuaire de réception du compte (hors adresses techniques « reply-to »). */
  entries?: { identifier: string; status: "pending" | "created" | "error" }[] | null
  /** Adresses actives de l'entreprise dans l'annuaire de la facturation électronique. */
  activeInFrenchDirectory?: string[] | null
}

export function derivePaStatus(f: PlatformFacts): { status: PaStatus; address: string | null } {
  if (f.company === "failed" || f.identity === "failed") return { status: "refused", address: null }
  if (f.company === "needs_review" || f.identity === "needs_review") return { status: "manual_review", address: null }
  const entries = f.entries ?? []
  const created = entries.find((e) => e.status === "created")
  if (created) {
    // Annuaire illisible (null) : on ne conclut pas à une absence
    const missing = Array.isArray(f.activeInFrenchDirectory) && !f.activeInFrenchDirectory.some((a) => sameAddress(a, created.identifier))
    return { status: missing ? "directory_missing" : "active", address: created.identifier }
  }
  const failing = entries.find((e) => e.status === "error")
  if (failing) return { status: "transfer", address: failing.identifier }
  const pending = entries.find((e) => e.status === "pending")
  return { status: "verifying", address: pending?.identifier ?? null }
}

/** Les adresses Peppol sont insensibles à la casse (documentation « Annuaire »). */
export function sameAddress(a: string, b: string): boolean {
  return a.trim().toLowerCase() === b.trim().toLowerCase()
}

/** Libellé court (pastille du menu, tableau de bord). */
export const PA_STATUS_LABEL: Record<PaStatus, string> = {
  verifying: "Vérification en cours",
  manual_review: "Contrôle manuel",
  refused: "Vérification refusée",
  transfer: "Transfert en cours",
  directory_missing: "Annuaire à vérifier",
  active: "Réception active",
  expired: "Autorisation expirée",
}

export const PA_STATUS_TONE: Record<PaStatus, "ok" | "info" | "warn" | "danger"> = {
  verifying: "info",
  manual_review: "info",
  refused: "danger",
  transfer: "info",
  directory_missing: "warn",
  active: "ok",
  expired: "warn",
}
