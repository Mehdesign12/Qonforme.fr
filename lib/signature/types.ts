/**
 * Signature en ligne des devis et des bons de commande : types partagés
 * (serveur, page publique du client, panneau de l'artisan, démo).
 *
 * Signature électronique simple au sens du règlement (UE) n° 910/2014
 * (eIDAS, art. 3 et 25) et des articles 1366 et 1367 du Code civil.
 * Jamais « certifiée » ni « qualifiée » (DECISIONS-STRATEGIQUES.md § 11).
 */

export type SignatureDocType = "quote" | "purchase_order"

/** 'sign' : consulter et signer (Essentiel, Artisan) ; 'view' : consultation seule (compte gratuit). */
export type SignatureMode = "sign" | "view"

/**
 * Statut enregistré en base. « Expiré » se déduit de `expires_at`.
 * « withdrawn » : le particulier s'est rétracté après avoir signé
 * (migration 20261010_signature_withdrawal_deposit_reminder.sql).
 */
export type SignatureStatus = "pending" | "signed" | "refused" | "disabled" | "superseded" | "withdrawn"

/** État affiché du lien (panneau de l'artisan et page du client). */
export type LinkState = "ready" | "sent" | "viewed" | "signed" | "refused" | "expired" | "superseded" | "disabled" | "withdrawn"

/** Particulier (consommateur) ou professionnel : déduit de la fiche client (SIREN ou TVA renseignés). */
export type ClientKind = "consumer" | "business"

export type SignatureMethod = "drawn" | "typed"

/** Signature à distance (lien) ou sur place, sur l'appareil de l'artisan (contrat hors établissement). */
export type SignatureContext = "distance" | "in_person"

export type CodeMode = "threshold" | "always" | "never"

export interface SignatureSettings {
  enabled: boolean
  code_mode: CodeMode
  code_threshold_ttc: number
  /** Validité d'un lien de bon de commande (un devis expire avec sa date de validité). */
  link_validity_days: number
  /** Relance automatique du client avant l'expiration du lien. */
  expiry_reminder_enabled: boolean
  /** Jours avant l'expiration où part la relance. */
  expiry_reminder_days: number
  /** Acompte demandé à la signature, en % du TTC (0 : aucun). */
  deposit_percent: number
}

export const DEFAULT_SIGNATURE_SETTINGS: SignatureSettings = {
  enabled: true,
  code_mode: "threshold",
  code_threshold_ttc: 5000,
  link_validity_days: 30,
  expiry_reminder_enabled: true,
  expiry_reminder_days: 3,
  deposit_percent: 0,
}

export type RefusalReason = "price" | "delay" | "other_offer" | "abandoned" | "other"

export const REFUSAL_REASONS: { value: RefusalReason; label: string }[] = [
  { value: "price", label: "Le prix" },
  { value: "delay", label: "Le délai" },
  { value: "other_offer", label: "J'ai retenu une autre proposition" },
  { value: "abandoned", label: "Le projet est abandonné" },
  { value: "other", label: "Autre raison" },
]

export interface SignatureConsents {
  /** « Bon pour accord » : le client accepte le document. */
  accepted_document: boolean
  /** Certification pour le taux réduit de TVA (CGI art. 279-0 bis, 278-0 bis A). */
  reduced_vat_certified?: boolean
  /** Particulier : information sur le délai de rétractation affichée avant la signature. */
  withdrawal_information_shown?: boolean
  /** Particulier : demande expresse de démarrage avant la fin du délai (C. consom. art. L221-25). */
  early_start_requested?: boolean
  /** Signature sur place : accord pour recevoir son exemplaire par email (C. consom. art. L221-9). */
  durable_medium_by_email?: boolean
  /** Sur place : réparation urgente demandée par le client, l'acompte peut être demandé tout de suite (art. L221-10, 4°). */
  urgent_repair_requested?: boolean
}

/** Ligne de `document_signatures` (les colonnes utiles au code). */
export interface SignatureRow {
  id: string
  user_id: string
  document_type: SignatureDocType
  document_id: string
  document_number: string
  version: number
  mode: SignatureMode
  content_sha256: string
  token_hash: string
  token_ciphertext: string | null
  status: SignatureStatus
  client_kind: ClientKind
  expires_at: string
  sent_at: string | null
  sent_to: string | null
  first_viewed_at: string | null
  last_viewed_at: string | null
  view_count: number
  code_required: boolean
  code_hash: string | null
  code_expires_at: string | null
  code_attempts: number
  code_sent_count: number
  code_last_sent_at: string | null
  code_sent_to: string | null
  code_verified_at: string | null
  signer_name: string | null
  signer_email: string | null
  signer_role: string | null
  signer_company: string | null
  client_order_number: string | null
  signature_method: SignatureMethod | null
  signature_image: string | null
  signature_context: SignatureContext | null
  consents: Partial<SignatureConsents> | null
  signed_at: string | null
  signer_ip: string | null
  signer_user_agent: string | null
  document_sha256: string | null
  signed_pdf_path: string | null
  signed_pdf_sha256: string | null
  refused_at: string | null
  refusal_reason: RefusalReason | null
  refusal_message: string | null
  disabled_at: string | null
  superseded_at: string | null
  superseded_by: string | null
  created_at: string
  // Colonnes de 20261010_signature_withdrawal_deposit_reminder.sql : absentes
  // de la ligne tant que la migration n'est pas appliquée.
  withdrawn_at?: string | null
  withdrawal_name?: string | null
  withdrawal_message?: string | null
  withdrawal_ip?: string | null
  withdrawal_user_agent?: string | null
  expiry_reminder_sent_at?: string | null
  deposit_amount?: number | string | null
  deposit_percent?: number | string | null
  deposit_reference?: string | null
  deposit_request_on?: string | null
  deposit_requested_at?: string | null
}

export type SignatureEventType =
  | "created"
  | "sent"
  | "viewed"
  | "code_sent"
  | "code_failed"
  | "code_verified"
  | "signed"
  | "refused"
  | "disabled"
  | "superseded"
  | "email_failed"
  | "withdrawn"
  | "expiry_reminder_sent"
  | "deposit_requested"

export interface SignatureEvent {
  type: SignatureEventType
  created_at: string
  ip?: string | null
  details?: Record<string, unknown> | null
}

/** Ligne de document telle que la page publique et le PDF l'affichent. */
export interface SignDocLine {
  description: string
  quantity: number
  unit?: string | null
  unit_price_ht: number
  vat_rate: number
  total_ht: number
  total_vat?: number | null
}

/** Ce que le panneau « Signature en ligne » de l'artisan affiche. */
export interface SignaturePanelLink {
  id: string
  mode: SignatureMode
  state: LinkState
  version: number
  url: string | null
  expires_at: string
  created_at: string
  sent_at: string | null
  sent_to: string | null
  view_count: number
  first_viewed_at: string | null
  last_viewed_at: string | null
  code_required: boolean
  client_kind: ClientKind
  signer_name: string | null
  signer_email: string | null
  signer_role: string | null
  signer_company: string | null
  client_order_number: string | null
  signature_method: SignatureMethod | null
  signature_context: SignatureContext | null
  signed_at: string | null
  signer_ip: string | null
  document_sha256: string | null
  consents: Partial<SignatureConsents> | null
  refused_at: string | null
  refusal_reason: RefusalReason | null
  refusal_message: string | null
  withdrawn_at?: string | null
  withdrawal_name?: string | null
  withdrawal_message?: string | null
  /** Acompte figé à la signature (null : aucun). */
  deposit?: PanelDeposit | null
  /** Relance avant expiration : envoyée le…, ou prévue le… (AAAA-MM-JJ). */
  expiry_reminder_sent_at?: string | null
  expiry_reminder_on?: string | null
  events: SignatureEvent[]
}

/** Quand l'acompte est demandé au client. */
export type DepositTiming = "now" | "later"

export interface PanelDeposit {
  amount: number
  percent: number
  reference: string
  timing: DepositTiming
  /** Signé sur place chez un particulier : jour de la demande (J+8). */
  request_on: string | null
  /** Horodatage de la demande (tout de suite, ou par le cron à J+8). */
  requested_at: string | null
}

export interface SignaturePanelData {
  /** false : migration pas encore appliquée, le panneau ne s'affiche pas. */
  available: boolean
  /** Formule Essentiel ou Artisan active : signature en ligne possible. */
  access: boolean
  /** Réglage de l'artisan (Paramètres › Modèles de documents). */
  enabled: boolean
  client_kind: ClientKind
  client_email: string | null
  link: SignaturePanelLink | null
}
