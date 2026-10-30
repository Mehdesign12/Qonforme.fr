/**
 * Ce que l'interface reçoit du raccordement (jamais un jeton). Partagé par la
 * page réelle (API) et la démo (lib/demo/e-invoicing.ts).
 */
import { isPaStatus, type PaStatus } from "@/lib/pa/status"
import type { ConnectionRow } from "@/lib/pa/store"

export interface EInvoicingView {
  /** Raccordement proposé à ce compte (migration appliquée et application Super PDP configurée pour son mode). */
  available: boolean
  /** Le compte a une formule (Essentiel ou Artisan) : raccordement et relève inclus. */
  hasPlan: boolean
  /** Bac à sable (compte d'essai) ou production. */
  mode: "test" | "live" | null
  companyName: string | null
  siren: string | null
  connection: null | {
    status: PaStatus
    address: string | null
    companyVerification: string | null
    identityVerification: string | null
    lastCheckAt: string | null
    lastSyncAt: string | null
    lastSyncError: string | null
    activeSince: string | null
    createdAt: string
    notify: { digest: boolean; each: boolean; failure: boolean; email: string | null }
  }
  /** Factures reçues par la plateforme, et ce mois-ci. */
  received: { total: number; thisMonth: number }
}

export function connectionView(row: ConnectionRow | null): EInvoicingView["connection"] {
  if (!row) return null
  return {
    status: isPaStatus(row.status) ? row.status : "verifying",
    address: row.electronic_address,
    companyVerification: row.company_verification,
    identityVerification: row.identity_verification,
    lastCheckAt: row.last_check_at,
    lastSyncAt: row.last_sync_at,
    lastSyncError: row.last_sync_error,
    activeSince: row.active_since,
    createdAt: row.created_at,
    notify: { digest: row.notify_digest, each: row.notify_each, failure: row.notify_failure, email: row.notify_email },
  }
}

/** Adresse lisible : « 0225:123456782 » telle quelle (format de l'annuaire Peppol). */
export function formatAddress(address: string | null | undefined): string {
  return (address ?? "").trim()
}
