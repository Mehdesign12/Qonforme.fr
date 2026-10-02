/**
 * Données propres aux pages Paramètres de la démo, en complément de
 * lib/demo/data.ts (entreprise, documents) : formule, échéance et factures
 * d'abonnement fictives. Formule Essentiel au tarif réel (lib/stripe/plans.ts).
 */
import { PLANS, withVat } from "@/lib/stripe/plans"

/** Prochaine échéance fictive (après le « aujourd'hui » de la démo, 1er octobre 2026). */
export const DEMO_RENEWS_AT = "2026-10-24T00:00:00.000Z"

export const DEMO_PLAN = {
  name: PLANS.starter.name,
  period: "monthly" as const,
  amountTtc: withVat(PLANS.starter.monthlyPrice),
  renewsAt: DEMO_RENEWS_AT,
  pastDue: false,
}
