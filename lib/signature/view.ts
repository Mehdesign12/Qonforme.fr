/**
 * Ce que la page publique du client reçoit (serveur → navigateur).
 * Uniquement les données du document du lien : ni identifiant d'utilisateur,
 * ni empreinte de jeton, ni donnée d'un autre document.
 */
import type { ClientKind, DepositTiming, SignatureDocType, SignatureMode, SignDocLine } from "@/lib/signature/types"

export type PublicPageState =
  | "sign"        // à signer
  | "view"        // consultation seule (compte gratuit)
  | "signed"
  | "refused"
  | "expired"
  | "superseded"  // une version plus récente a été envoyée
  | "disabled"
  | "closed"      // le document n'attend plus de réponse (accepté ou annulé par l'entreprise)
  | "withdrawn"   // le particulier s'est rétracté après avoir signé
  | "not_found"   // lien inconnu, ou ouvert sans le lien reçu par email

export interface PublicDocView {
  type: SignatureDocType
  number: string
  issue_date: string
  valid_until: string | null
  delivery_date: string | null
  reference: string | null
  lines: SignDocLine[]
  subtotal_ht: number
  total_vat: number
  total_ttc: number
  notes: string | null
  client: {
    name: string | null
    address: string | null
    zip_code: string | null
    city: string | null
    siren: string | null
  } | null
}

export interface PublicCompanyView {
  name: string
  address: string | null
  zip_code: string | null
  city: string | null
  siren: string | null
  siret: string | null
  vat_number: string | null
  email: string | null
  legal_notice: string | null
}

/** Acompte proposé après la signature : virement à l'artisan, sans page de paiement. */
export interface PublicDeposit {
  amount: number
  percent: number
  /** « now » : à régler maintenant ; « later » : demande envoyée par email à `requestOn`. */
  timing: DepositTiming
  requestOn: string | null
  reference: string
  /** Coordonnées du virement (IBAN valide uniquement). */
  account: { holder: string; iban: string; bic: string | null } | null
  /** QR code de virement SEPA (format EPC), tracé SVG prêt à afficher. */
  qr: { path: string; size: number } | null
}

export interface PublicSignViewData {
  id: string
  state: PublicPageState
  mode: SignatureMode
  clientKind: ClientKind
  /** Signature sur place, sur l'appareil de l'artisan (contrat hors établissement). */
  onSite: boolean
  doc: PublicDocView | null
  company: PublicCompanyView | null
  expires_at: string | null
  codeRequired: boolean
  codeVerified: boolean
  /** Adresse masquée où part le code, s'il est déjà connu (fiche client). */
  codeTarget: string | null
  /** Le code partira vers l'adresse saisie par le signataire (aucune sur la fiche client). */
  codeToSignerEmail: boolean
  prefill: { name: string; email: string; company: string }
  reducedVat: boolean
  reducedVatText: string | null
  /** Message pour l'état « closed ». */
  closedMessage: string | null
  signed: { name: string; role: string | null; company: string | null; at: string; method: "drawn" | "typed" | null; order_number: string | null } | null
  refused: { at: string; reason: string } | null
  withdrawalDeadline: string | null
  /**
   * Rétractation en ligne : `available` quand la fonction est active (migration
   * appliquée) et le signataire un particulier ; `open` tant que le délai court.
   */
  withdrawal: { available: boolean; open: boolean }
  withdrawn: { at: string; name: string | null } | null
  /** Réparation urgente demandée à la signature sur place (art. L221-10, 4°). */
  urgentRepair: boolean
  /** Avant la signature : acompte qui sera demandé (réglage de l'artisan, IBAN renseigné). */
  depositPlanned: { percent: number; amount: number } | null
  /** Après la signature : l'acompte à régler. */
  deposit: PublicDeposit | null
  /** Ouvrir directement le formulaire de rétractation (lien « Changer d'avis » de l'email). */
  openWithdrawal?: boolean
  /** Téléchargement du PDF (null en démo). */
  pdfUrl: string | null
  demo?: boolean
}

/** Page sans document : lien inconnu, cookie absent ou document supprimé. */
export function emptyPublicView(id: string, state: PublicPageState = "not_found"): PublicSignViewData {
  return {
    id, state, mode: "sign", clientKind: "consumer", onSite: false, doc: null, company: null, expires_at: null,
    codeRequired: false, codeVerified: false, codeTarget: null, codeToSignerEmail: false,
    prefill: { name: "", email: "", company: "" }, reducedVat: false, reducedVatText: null, closedMessage: null,
    signed: null, refused: null, withdrawalDeadline: null, withdrawal: { available: false, open: false }, withdrawn: null,
    urgentRepair: false, depositPlanned: null, deposit: null, pdfUrl: null,
  }
}
