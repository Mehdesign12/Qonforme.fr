/**
 * Profil légal de l'entreprise de démonstration (Garnier Plâtrerie Isolation,
 * lib/demo/data.ts) : plaquiste, TVA facturée, SARL. Assureur fictif,
 * clairement nommé comme tel : la démo ne cite aucun assureur réel.
 *
 * Les documents émis de la démo portent l'instantané de ce profil, comme le
 * ferait le déclencheur d'émission en production (lib/legal/mentions.ts).
 */
import { DEMO_COMPANY } from "@/lib/demo/data"
import type { LegalProfile } from "@/lib/legal/profile"
import type { LegalSnapshot } from "@/lib/legal/mentions"

export const DEMO_LEGAL_PROFILE: LegalProfile = {
  trade: "plaquiste",
  vat_regime: "assujetti",
  legal_form: "societe",
  company_type: "SARL",
  share_capital: 5000,
  rcs_city: "Angers",
  decennale: {
    insurer: "Assureur Exemple (démonstration)",
    address: "1 rue de l'Exemple, 49000 Angers",
    policy_number: "DEMO-2026-0001",
    coverage: "France métropolitaine",
  },
  rc_pro: null,
}

/** Mentions libres d'exemple (Paramètres › Modèles de la démo). */
export const DEMO_LEGAL_NOTICE =
  "En cas de retard de paiement, une pénalité égale à 3 fois le taux d'intérêt légal sera exigible (art. L. 441-10 C. com.).\nIndemnité forfaitaire pour frais de recouvrement : 40 € (art. D. 441-5 C. com.)."

export const DEMO_LEGAL_SNAPSHOT: LegalSnapshot = {
  name: DEMO_COMPANY.name,
  legal_notice: DEMO_LEGAL_NOTICE,
  profile: DEMO_LEGAL_PROFILE,
  frozen_at: "2026-09-01T08:00:00.000Z",
}

/** Instantané d'un document de démo : celui du profil s'il est émis, aucun pour un brouillon. */
export function demoLegalSnapshot(status: string | null | undefined): LegalSnapshot | null {
  return status === "draft" ? null : DEMO_LEGAL_SNAPSHOT
}
