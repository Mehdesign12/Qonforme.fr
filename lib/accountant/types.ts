/**
 * Accès du comptable : types partagés par le serveur, les pages et la démo.
 *
 * Module sans dépendance serveur : importable côté navigateur.
 */

export const ACCESS_TABLE = "accountant_accesses"
export const EVENTS_TABLE = "accountant_access_events"

/** Cookie qui porte le jeton d'invitation, pour qu'il n'apparaisse jamais dans l'adresse d'une page. */
export const INVITE_COOKIE = "qonforme_invitation_comptable"

/** Statut d'un accès, vu par l'artisan. */
export type AccessStatus = "pending" | "expired" | "active" | "revoked"

/** Ligne de la table `accountant_accesses` (jamais envoyée telle quelle au navigateur). */
export interface AccessRow {
  id: string
  owner_id: string
  email: string
  label: string | null
  token_hash: string | null
  invited_at: string
  expires_at: string
  accountant_id: string | null
  accepted_at: string | null
  last_seen_at: string | null
  revoked_at: string | null
}

export const ACCESS_COLUMNS =
  "id, owner_id, email, label, token_hash, invited_at, expires_at, accountant_id, accepted_at, last_seen_at, revoked_at"

/** Accès tel que le voit l'artisan (Paramètres › Accès comptable) : ni jeton ni identifiant du comptable. */
export interface AccessView {
  id: string
  email: string
  label: string | null
  status: Exclude<AccessStatus, "revoked">
  invitedAt: string
  expiresAt: string
  acceptedAt: string | null
  lastSeenAt: string | null
}

export type EventAction =
  | "invited"
  | "reinvited"
  | "cancelled"
  | "accepted"
  | "revoked"
  | "viewed"
  | "export_fec"
  | "export_csv"
  | "export_pdf_zip"

/** Entrée du journal, vue par l'artisan. */
export interface EventView {
  id: string
  accessId: string
  /** Adresse et nom de la personne concernée par l'accès. */
  email: string
  label: string | null
  action: EventAction
  periodFrom: string | null
  periodTo: string | null
  detail: string | null
  at: string
}

/** Réponse de GET /api/accountant-access. `available: false` : migration pas encore appliquée. */
export interface AccessOverview {
  available: boolean
  accesses: AccessView[]
  events: EventView[]
}

/* ------------------------------------------------------------------ */
/* Côté comptable                                                      */
/* ------------------------------------------------------------------ */

/** État d'une invitation, pour la page /invitation-comptable. */
export type InvitationState =
  | { state: "not_found" }
  | { state: "unavailable" }
  | { state: "expired"; companyName: string }
  | {
      state: "valid"
      companyName: string
      maskedEmail: string
      expiresAt: string
      /** Visiteur connecté : son adresse est-elle celle de l'invitation ? (null : pas connecté) */
      emailMatches: boolean | null
      /** Le visiteur est l'entreprise elle-même. */
      isOwner: boolean
    }

/** Dossier (entreprise qui a donné accès) dans la liste de l'espace comptable. */
export interface DossierSummary {
  accessId: string
  companyName: string
  siren: string | null
  city: string | null
  acceptedAt: string | null
  lastSeenAt: string | null
}

export interface Period {
  from: string
  to: string
}

/** Statut de paiement d'une facture émise, pour le comptable. */
export type PaymentState = "paid" | "open" | "late" | "credited" | "other"

export interface DossierInvoice {
  id: string
  number: string
  clientName: string | null
  issueDate: string
  dueDate: string
  status: string
  payment: PaymentState
  totalHt: number
  totalVat: number
  totalTtc: number
}

export interface DossierCreditNote {
  id: string
  number: string
  clientName: string | null
  issueDate: string
  invoiceNumber: string | null
  reason: string | null
  totalHt: number
  totalVat: number
  totalTtc: number
}

export interface DossierSupplierInvoice {
  id: string
  supplierName: string | null
  number: string | null
  issueDate: string | null
  status: string | null
  totalHt: number | null
  totalVat: number | null
  totalTtc: number | null
}

/** Ventilation de la TVA facturée par taux (factures moins avoirs). */
export interface VatRow {
  /** Clé stable « 20 », « 0:franchise »… */
  key: string
  rate: number
  /** Motif d'une ligne sans TVA (franchise, autoliquidation…), sinon null. */
  treatment: string | null
  label: string
  base: number
  vat: number
}

export interface DossierTotals {
  invoiceCount: number
  invoicedHt: number
  invoicedVat: number
  invoicedTtc: number
  creditCount: number
  creditedHt: number
  creditedVat: number
  creditedTtc: number
  /** TTC des factures de la période réglées. */
  paidTtc: number
  /** TTC des factures de la période émises et non réglées (retards compris). */
  openTtc: number
  /** Dont échues. */
  lateTtc: number
}

/** Contenu d'un dossier pour une période (lecture seule). */
export interface DossierData {
  company: { name: string; siren: string | null; city: string | null }
  period: Period
  invoices: DossierInvoice[]
  creditNotes: DossierCreditNote[]
  /** null : la réception des factures fournisseurs n'existe pas (encore) sur ce compte. */
  supplierInvoices: DossierSupplierInvoice[] | null
  totals: DossierTotals
  vat: VatRow[]
  /** Liste tronquée à l'affichage (les exports, eux, contiennent tout). */
  truncated: boolean
}

/** Format d'export téléchargeable par le comptable. */
export type ExportFormat = "fec" | "csv" | "zip"
