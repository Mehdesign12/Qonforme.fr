/**
 * Types du lien de paiement, partagés par le serveur, la page publique, la
 * fiche facture et la démo. Aucune donnée interne (identifiants, jeton,
 * utilisateur) dans ce que voit le client de l'artisan.
 */

/* ------------------------------------------------------------------ */
/* Page publique de règlement                                          */
/* ------------------------------------------------------------------ */

/** L'entreprise de l'artisan, telle que son client la voit. */
export interface PublicCompany {
  name: string
  logoUrl: string | null
  siren: string | null
  address: string | null
  zipCode: string | null
  city: string | null
  email: string | null
}

export interface PublicInvoice {
  number: string
  issueDate: string
  dueDate: string
  totalTtc: number
  /** Avoirs déjà émis sur la facture (TTC). */
  credited: number
  /** Reste à régler : total moins avoirs et retenue de garantie. */
  remaining: number
  /** Retenue de garantie (formule Artisan), payable à sa libération. */
  retention?: number
}

/** Coordonnées du virement (IBAN valide uniquement). */
export interface PublicAccount {
  holder: string
  /** Sans espaces (copie). */
  iban: string
  bic: string | null
}

export interface PublicDeclaration {
  transferDate: string
  amount: number
  declaredAt: string
}

export type PaymentPageData =
  | { state: "not_found" }
  | { state: "unavailable" }
  | { state: "disabled"; company: PublicCompany }
  | { state: "paid" | "credited" | "closed"; company: PublicCompany; invoice: PublicInvoice }
  | {
      state: "payable"
      company: PublicCompany
      invoice: PublicInvoice
      /** null : IBAN absent ou invalide (l'artisan l'a retiré depuis l'envoi). */
      account: PublicAccount | null
      /** QR code de virement SEPA (format EPC), tracé SVG prêt à afficher. */
      qr: { path: string; size: number } | null
      /** Virement déjà déclaré et pas encore traité par l'artisan. */
      declaration: PublicDeclaration | null
    }

/* ------------------------------------------------------------------ */
/* Fiche facture (artisan)                                             */
/* ------------------------------------------------------------------ */

export interface ArtisanDeclaration {
  id: string
  transferDate: string
  amount: number
  note: string | null
  declaredAt: string
  status: "open" | "dismissed" | "confirmed"
}

/** État du lien de paiement d'une facture, renvoyé par GET/POST /api/invoices/[id]/payment-link. */
export interface PaymentLinkState {
  /** Faux tant que la migration n'est pas appliquée (ou sans secret serveur) : rien n'est affiché. */
  available: boolean
  iban: "ok" | "missing" | "invalid"
  /** Lien actif. */
  link: { url: string; createdAt: string } | null
  /** Date de désactivation du lien, s'il a été désactivé. */
  disabledAt: string | null
  /** Dernière déclaration de virement, sauf celles que l'artisan a écartées. */
  declaration: ArtisanDeclaration | null
  /** Ouvertures de la page de règlement par le client (null : suivi indisponible, migration 20261010). */
  views?: { count: number; first: string | null; last: string | null } | null
}

/** Tables de la migration 20261003_payment_links.sql. */
export const LINKS_TABLE = "invoice_payment_links"
export const DECLARATIONS_TABLE = "invoice_payment_declarations"

export const UNAVAILABLE_STATE: PaymentLinkState = {
  available: false, iban: "missing", link: null, disabledAt: null, declaration: null,
}
