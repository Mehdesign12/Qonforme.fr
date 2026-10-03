/**
 * Démarchage : désactivé par décision (DECISIONS-STRATEGIQUES.md § 2, « Aucun
 * démarchage : ni appels ni emails à froid »).
 *
 * Les tâches planifiées de prospection (extraction Sirene, enrichissement des
 * emails, séquences d'emails) répondent sans rien faire tant que la variable
 * PROSPECTION_ENABLED ne vaut pas exactement « true ». Elles restaient actives
 * dès qu'un service externe de planification les appelait.
 */
export function prospectionEnabled(): boolean {
  return process.env.PROSPECTION_ENABLED === "true"
}

export const PROSPECTION_DISABLED_REASON =
  "Démarchage désactivé par décision (DECISIONS-STRATEGIQUES.md § 2) : définir PROSPECTION_ENABLED=true pour le réactiver."
