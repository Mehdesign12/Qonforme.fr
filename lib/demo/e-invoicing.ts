/**
 * Facturation électronique de la démo : raccordement actif à Super PDP, mêmes
 * composants que l'application (règle « Mode démo », CLAUDE.md). Données fictives.
 */
import { DEMO_COMPANY } from "@/lib/demo/data"
import { DEMO_RECEIVED_LIST } from "@/lib/demo/reception"
import type { EInvoicingView } from "@/lib/pa/view"

const platform = DEMO_RECEIVED_LIST.filter((i) => i.source === "platform")

export const DEMO_E_INVOICING: EInvoicingView = {
  available: true,
  hasPlan: true,
  mode: "live",
  companyName: DEMO_COMPANY.name,
  siren: DEMO_COMPANY.siren,
  connection: {
    status: "active",
    address: `0225:${DEMO_COMPANY.siren}`,
    companyVerification: "verified",
    identityVerification: "verified",
    lastCheckAt: "2026-10-01T09:45:00+02:00",
    lastSyncAt: "2026-10-01T09:45:00+02:00",
    lastSyncError: null,
    activeSince: "2026-09-02T10:12:00+02:00",
    createdAt: "2026-09-02T09:58:00+02:00",
    notify: { digest: true, each: false, failure: true, email: DEMO_COMPANY.email },
  },
  received: {
    total: platform.length,
    thisMonth: platform.filter((i) => i.created_at.startsWith("2026-10")).length,
  },
}

/**
 * États d'exemple, pour relire chaque planche dans la démo :
 * /demo/facturation-electronique?etat=<clé>.
 */
export const DEMO_E_INVOICING_STATES = [
  "a-activer", "gratuit", "avant", "en-cours", "controle", "transfert", "refuse", "expire", "annuaire", "arrete", "active",
] as const
export type DemoEInvoicingState = (typeof DEMO_E_INVOICING_STATES)[number]

export function demoEInvoicingState(key: string | null): { view: EInvoicingView; step: "avant" | null } {
  const base = DEMO_E_INVOICING
  const conn = base.connection!
  const pending = { ...conn, activeSince: null, lastSyncAt: null, identityVerification: "not_verified" as string | null }
  switch (key) {
    case "a-activer": return { view: { ...base, connection: null }, step: null }
    case "gratuit": return { view: { ...base, hasPlan: false, connection: null }, step: null }
    case "avant": return { view: { ...base, connection: null }, step: "avant" }
    case "en-cours": return { view: { ...base, connection: { ...pending, status: "verifying", companyVerification: "verified", address: null } }, step: null }
    case "controle": return { view: { ...base, connection: { ...pending, status: "manual_review", companyVerification: "needs_review", address: null } }, step: null }
    case "transfert": return { view: { ...base, connection: { ...pending, status: "transfer", companyVerification: "verified", identityVerification: "verified" } }, step: null }
    case "refuse": return { view: { ...base, connection: { ...pending, status: "refused", companyVerification: "verified", identityVerification: "failed", address: null } }, step: null }
    case "expire": return { view: { ...base, connection: { ...conn, status: "expired" } }, step: null }
    case "annuaire": return { view: { ...base, connection: { ...conn, status: "directory_missing", activeSince: null } }, step: null }
    case "arrete": return { view: { ...base, hasPlan: false }, step: null }
    default: return { view: base, step: null }
  }
}
