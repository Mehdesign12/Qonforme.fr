/**
 * Contrat d'un connecteur de plateforme agréée (PA).
 *
 * Depuis le 1er septembre 2026, « l'émission, la transmission et la réception
 * des factures électroniques s'effectuent en recourant à une plateforme
 * agréée » (CGI, art. 289 bis ; DGFiP, guide pratique de démarrage, juillet
 * 2026). Qonforme n'est pas une plateforme agréée : il s'y raccorde. Le
 * partenaire n'est pas encore choisi (DECISIONS-STRATEGIQUES.md § 7.3), donc
 * tout le code de Qonforme parle à cette interface, jamais à un fournisseur
 * précis.
 *
 * ── Brancher la plateforme choisie : une seule implémentation ─────────────
 *
 * 1. Écrire `lib/pa/adapters/<id>.ts` qui exporte une fabrique
 *    `create<Nom>Adapter(): PlatformAdapter` (appels HTTP à l'API de la
 *    plateforme, authentification par variables d'environnement, jamais en dur).
 * 2. L'ajouter au registre `ADAPTERS` de `lib/pa/index.ts`.
 * 3. Définir `PA_PROVIDER=<id>` et les secrets de l'adaptateur sur Vercel.
 *
 * Tout le reste suit sans autre changement :
 * - la route `POST /api/pa/webhook` (404 tant que l'adaptateur est « none »)
 *   vérifie la signature par `verifyWebhook`, puis enregistre les factures
 *   reçues (`lib/reception/ingest.ts`) et les statuts venus de la plateforme ;
 * - chaque statut posé par l'artisan sur une facture arrivée par la plateforme
 *   lui est transmis par `sendStatus` (route PATCH des factures reçues) ; un
 *   échec laisse le statut enregistré, marqué « non transmis » ;
 * - `searchDirectory` sert à vérifier dans l'annuaire où un client reçoit ses
 *   factures, et `issueInvoice` à l'émission (obligatoire pour les TPE et PME
 *   au 1er septembre 2027).
 *
 * Les factures importées à la main n'ont pas d'identifiant de plateforme :
 * leurs statuts restent dans Qonforme, la plateforme ne les connaît pas.
 */
import type { ReceivedStatus } from "@/lib/reception/lifecycle"

/** Fichier tel que la plateforme le remet (Factur-X, CII ou UBL). */
export interface PaFile {
  bytes: Uint8Array
  filename: string
  /** Type annoncé par la plateforme (indicatif : le contenu fait foi). */
  mime: string | null
}

/** Facture reçue par la plateforme pour le compte d'une entreprise. */
export interface PaInboundInvoice {
  /** Identifiant de la facture chez la plateforme (clé de rapprochement). */
  platformId: string
  /** SIREN du destinataire, pour retrouver le compte Qonforme. */
  recipientSiren: string
  /** Horodatage de réception par la plateforme (statut 202). */
  receivedAt: string
  file: PaFile
  /** Dernier statut connu côté plateforme, s'il est déjà au-delà de « Reçue ». */
  status?: ReceivedStatus | null
}

/** Statut posé dans Qonforme, à transmettre à la plateforme. */
export interface PaStatusUpdate {
  platformId: string
  status: ReceivedStatus
  /** Code de la norme (« 205 »). */
  code: string
  /** Code motif du tableau des motifs de refus (annexe 7), le cas échéant. */
  reasonCode: string | null
  reason: string | null
  /** Horodatage du statut (ISO 8601). */
  at: string
}

export interface PaStatusResult {
  transmitted: boolean
  /** Identifiant du message de cycle de vie chez la plateforme. */
  platformMessageId?: string | null
}

/** Entrée de l'annuaire central (où et comment une entreprise reçoit ses factures). */
export interface PaDirectoryEntry {
  siren: string
  siret: string | null
  /** Code de routage (service destinataire), s'il y en a un. */
  routingCode: string | null
  /** Adresse électronique de facturation (BT-49), ex. « 0225:123456789 ». */
  electronicAddress: string
  /** Nom de la plateforme de réception, tel que l'annuaire le donne. */
  platformName: string | null
}

/** Événement reçu de la plateforme par webhook, après vérification de sa signature. */
export type PaWebhookEvent =
  | { type: "invoice.received"; invoice: PaInboundInvoice }
  | { type: "invoice.status"; platformId: string; status: ReceivedStatus; reasonCode: string | null; reason: string | null; at: string }

export interface PlatformAdapter {
  /** Identifiant technique (« none », ou celui du partenaire). */
  readonly id: string
  /** Nom affichable de la plateforme, null tant qu'aucune n'est raccordée. */
  readonly label: string | null
  /** Vrai seulement si une plateforme est réellement configurée. */
  readonly connected: boolean

  /** Factures reçues depuis un curseur (relève périodique, en complément du webhook). */
  listInboundInvoices(params: { recipientSiren: string; cursor?: string | null }): Promise<{ invoices: PaInboundInvoice[]; nextCursor: string | null }>

  /** Transmet un statut du cycle de vie posé par l'artisan. */
  sendStatus(update: PaStatusUpdate): Promise<PaStatusResult>

  /** Recherche dans l'annuaire. */
  searchDirectory(query: { siren: string; siret?: string | null }): Promise<PaDirectoryEntry[]>

  /** Émet une facture (Factur-X ou XML) par la plateforme. */
  issueInvoice(doc: { number: string; xml: string; pdf?: Uint8Array | null }): Promise<{ platformId: string }>

  /** Vérifie et décode un appel webhook ; null si la signature n'est pas valide. */
  verifyWebhook(request: { headers: Headers; rawBody: string }): Promise<PaWebhookEvent | null>
}

export class PaNotConnectedError extends Error {
  constructor() {
    super("Aucune plateforme agréée n'est raccordée à Qonforme.")
    this.name = "PaNotConnectedError"
  }
}
