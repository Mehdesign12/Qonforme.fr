/**
 * Changements d'état d'un constat demandés depuis l'admin (route PATCH
 * /api/admin/seo/findings/[id]), contrôlés côté serveur :
 * - « Marquer comme fait » et « Ignorer » : depuis « À faire » seulement ;
 * - « Rouvrir » : depuis « Faite » ou « Ignorée » ;
 * - un constat « résolu de lui-même » ne se rouvre pas (il reviendra de lui-même
 *   si la règle s'applique de nouveau) ;
 * - une action reprise du journal des modifications (source « import ») ne se
 *   rouvre pas : aucune règle ne la réévalue, elle resterait « À faire » sans fin.
 * Module pur.
 */
import type { FindingSource, FindingStatus } from "@/lib/seo/types"

export const FINDING_ACTIONS = ["done", "ignore", "reopen"] as const
export type FindingAction = (typeof FINDING_ACTIONS)[number]

export type TransitionResult = { ok: true; status: FindingStatus } | { ok: false; error: string }

export function transitionFinding(current: FindingStatus, action: FindingAction, source?: FindingSource): TransitionResult {
  if (source === "import" && action === "reopen") {
    return { ok: false, error: "Une action reprise du journal des modifications ne se rouvre pas : aucune règle ne la réévalue." }
  }
  if (current === "resolved") {
    return { ok: false, error: "Ce constat s'est résolu de lui-même : il ne se modifie plus. Il reviendra si le problème se présente de nouveau." }
  }
  switch (action) {
    case "done":
      return current === "open" ? { ok: true, status: "done" } : { ok: false, error: "Seul un constat à faire peut être marqué comme fait." }
    case "ignore":
      return current === "open" ? { ok: true, status: "ignored" } : { ok: false, error: "Seul un constat à faire peut être ignoré." }
    case "reopen":
      return current === "done" || current === "ignored"
        ? { ok: true, status: "open" }
        : { ok: false, error: "Ce constat est déjà à faire." }
  }
}
