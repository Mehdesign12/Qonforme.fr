/**
 * Cycle de vie d'une facture reçue.
 *
 * Statuts et codes : DGFiP, spécifications externes de la facturation
 * électronique v3.2 (30/04/2026), dossier général § 3.6.4 « Les statuts
 * obligatoires d'une facture », tableau 8 « Les statuts d'une facture » (liste
 * non exhaustive, renvoyant à la norme AFNOR XP Z12-012) :
 *   200 Déposée (obligatoire), 201 Émise par la plateforme, 202 Reçue par la
 *   plateforme, 203 Mise à disposition, 204 Prise en charge, 205 Approuvée,
 *   206 Approuvée partiellement, 207 En litige, 208 Suspendue, 209 Complétée,
 *   210 Refusée (obligatoire), 211 Paiement transmis, 212 Encaissée
 *   (obligatoire), 213 Rejetée (obligatoire).
 * Seuls 200, 210, 212 et 213 sont transmis à l'administration (annexe 2
 * « Format sémantique FE CDV - Flux 6 » v2.3, onglet Statuts ; annexe 7 v1.9,
 * règle G7.44) ; les autres circulent entre plateformes, fournisseur et client.
 * Un statut « Refusée » porte un code motif (annexe 7, règle G7.08), pris dans
 * le « Tableau des motifs de refus » de l'annexe 7.
 * https://www.impots.gouv.fr/specifications-externes-b2b
 *
 * Dans Qonforme, tant qu'aucune plateforme agréée n'est raccordée, ces statuts
 * restent enregistrés localement : ils ne sont transmis à personne.
 *
 * Module pur, partagé par l'API (qui fait foi) et l'interface.
 */

export type ReceivedStatus =
  | "received"            // 202
  | "made_available"      // 203
  | "in_hand"             // 204
  | "approved"            // 205
  | "partially_approved"  // 206
  | "disputed"            // 207
  | "suspended"           // 208
  | "completed"           // 209
  | "refused"             // 210
  | "payment_sent"        // 211
  | "cashed"              // 212
  | "rejected"            // 213

export interface StatusDef {
  /** Code de la norme. */
  code: string
  /** Libellé court (pastille). */
  label: string
  /** Définition de la DGFiP (tableau 8), pour l'aide. */
  definition: string
  /** Statut obligatoire, transmis à l'administration fiscale par la plateforme. */
  mandatory: boolean
  /** Qui pose ce statut. */
  by: "platform" | "recipient" | "supplier"
}

export const STATUS_DEFS: Record<ReceivedStatus, StatusDef> = {
  received:           { code: "202", label: "Reçue",                   mandatory: false, by: "platform",  definition: "La plateforme de réception a reçu la facture." },
  made_available:     { code: "203", label: "Mise à disposition",      mandatory: false, by: "platform",  definition: "La plateforme de réception a mis la facture à votre disposition." },
  in_hand:            { code: "204", label: "Prise en charge",         mandatory: false, by: "recipient", definition: "Vous accusez réception de la facture." },
  approved:           { code: "205", label: "Approuvée",               mandatory: false, by: "recipient", definition: "Vous acceptez la facture dans son intégralité." },
  partially_approved: { code: "206", label: "Approuvée partiellement", mandatory: false, by: "recipient", definition: "Vous n'acceptez qu'une partie de la facture." },
  disputed:           { code: "207", label: "En litige",               mandatory: false, by: "recipient", definition: "Vous êtes en désaccord avec tout ou partie de la facture." },
  suspended:          { code: "208", label: "Suspendue",               mandatory: false, by: "recipient", definition: "Vous attendez des pièces justificatives du fournisseur avant de traiter la facture." },
  completed:          { code: "209", label: "Complétée",               mandatory: false, by: "supplier",  definition: "Le fournisseur a fourni les pièces justificatives demandées." },
  refused:            { code: "210", label: "Refusée",                 mandatory: true,  by: "recipient", definition: "Vous refusez la facture dans son intégralité." },
  payment_sent:       { code: "211", label: "Paiement transmis",       mandatory: false, by: "recipient", definition: "Vous avez réalisé le paiement de la facture." },
  cashed:             { code: "212", label: "Encaissée",               mandatory: true,  by: "supplier",  definition: "Le fournisseur a perçu le paiement." },
  rejected:           { code: "213", label: "Rejetée",                 mandatory: true,  by: "platform",  definition: "Un contrôle de la plateforme a détecté une anomalie sur la facture." },
}

export const RECEIVED_STATUSES = Object.keys(STATUS_DEFS) as ReceivedStatus[]

export const isReceivedStatus = (v: unknown): v is ReceivedStatus =>
  typeof v === "string" && Object.prototype.hasOwnProperty.call(STATUS_DEFS, v)

/** Statut depuis un code de la norme (« 205 » → « approved »). */
export function statusFromCode(code: string | null | undefined): ReceivedStatus | null {
  const entry = (Object.entries(STATUS_DEFS) as [ReceivedStatus, StatusDef][]).find(([, d]) => d.code === code)
  return entry ? entry[0] : null
}

/**
 * Statuts que l'artisan, destinataire de la facture, peut poser depuis chaque
 * statut. Liste blanche appliquée par l'API : le reste est refusé.
 * Refusée, Rejetée et Encaissée sont définitifs ; après un refus, le
 * fournisseur émet un avoir et, au besoin, une nouvelle facture (tableau 8 :
 * « le fournisseur doit procéder à une annulation comptable »).
 */
const OPEN_ACTIONS: ReceivedStatus[] = ["in_hand", "approved", "partially_approved", "disputed", "suspended", "refused", "payment_sent"]

export const RECIPIENT_TRANSITIONS: Record<ReceivedStatus, ReceivedStatus[]> = {
  received:           OPEN_ACTIONS,
  made_available:     OPEN_ACTIONS,
  in_hand:            OPEN_ACTIONS.filter((s) => s !== "in_hand"),
  disputed:           ["approved", "partially_approved", "suspended", "refused", "payment_sent"],
  suspended:          ["approved", "partially_approved", "disputed", "refused", "payment_sent"],
  completed:          ["approved", "partially_approved", "disputed", "refused", "payment_sent"],
  approved:           ["payment_sent", "disputed"],
  partially_approved: ["payment_sent", "disputed"],
  payment_sent:       [],
  refused:            [],
  cashed:             [],
  rejected:           [],
}

export function canTransition(from: ReceivedStatus, to: ReceivedStatus): boolean {
  return RECIPIENT_TRANSITIONS[from]?.includes(to) ?? false
}

/** Statuts qui laissent la facture « à traiter » par l'artisan. */
export const TO_PROCESS: readonly ReceivedStatus[] = ["received", "made_available", "in_hand", "completed"]
/** Statuts qui attendent un paiement de l'artisan. */
export const TO_PAY: readonly ReceivedStatus[] = ["approved", "partially_approved"]
/** Litiges et demandes de justificatifs en cours. */
export const IN_DISPUTE: readonly ReceivedStatus[] = ["disputed", "suspended"]
/** Statuts définitifs. */
export const CLOSED: readonly ReceivedStatus[] = ["payment_sent", "cashed", "refused", "rejected"]

/* ------------------------------------------------------------------ */
/* Motifs                                                               */
/* ------------------------------------------------------------------ */

/**
 * Motifs de refus et de litige utiles à un artisan qui reçoit une facture
 * fournisseur, repris du « Tableau des motifs de refus » (DGFiP, annexe 7
 * « Règles de gestion » v1.9, 30/04/2026). Les motifs propres au secteur public,
 * à la sous-traitance de marchés ou au routage entre plateformes ne sont pas
 * proposés à la main.
 */
export const REASONS: { code: string; label: string }[] = [
  { code: "DOUBLON", label: "Facture en doublon (déjà reçue)" },
  { code: "TRANSAC_INC", label: "Ne correspond à aucune livraison ni prestation" },
  { code: "LIVR_INCOMP", label: "Livraison incomplète ou non effectuée" },
  { code: "QTE_ERR", label: "Quantité facturée incorrecte" },
  { code: "PU_ERR", label: "Prix unitaire incorrect" },
  { code: "REM_ERR", label: "Remise absente ou erronée" },
  { code: "ART_ERR", label: "Article facturé incorrect" },
  { code: "QUALITE_ERR", label: "Article livré défectueux" },
  { code: "MONTANT_ERR", label: "Montant de la facture erroné" },
  { code: "CALCUL_ERR", label: "Erreur de calcul" },
  { code: "TX_TVA_ERR", label: "Taux de TVA erroné" },
  { code: "FACT_NON_CONFORME", label: "Facture non conforme à la commande" },
  { code: "CMD_EJ_ERR", label: "N° de commande incorrect ou manquant" },
  { code: "REF_CT_ABSENT", label: "Référence contractuelle manquante" },
  { code: "NON_CONFORME", label: "Mention légale manquante" },
  { code: "MODPAI_ERR", label: "Modalités de paiement incorrectes" },
  { code: "COORD_BANC_ERR", label: "Coordonnées bancaires erronées" },
  { code: "DEST_ERR", label: "Pas adressée à votre entreprise" },
  { code: "SIRET_ERR", label: "SIRET erroné ou absent" },
  { code: "JUSTIF_ABS", label: "Justificatif absent ou insuffisant" },
  { code: "AUTRE", label: "Autre motif" },
]

export const REASON_LABELS: Record<string, string> = Object.fromEntries(REASONS.map((r) => [r.code, r.label]))

export const isReasonCode = (v: unknown): v is string =>
  typeof v === "string" && Object.prototype.hasOwnProperty.call(REASON_LABELS, v)

/**
 * Ce que chaque action demande :
 * - refus : un motif de la liste (G7.08), et une précision si « Autre motif » ;
 * - litige : un motif ou une précision ;
 * - approbation partielle : une précision (ce qui est accepté) ;
 * - suspension : motif « Justificatif absent » par défaut, précision facultative.
 */
export function validateStatusChange(
  to: ReceivedStatus,
  reasonCode: string | null | undefined,
  reason: string | null | undefined,
): string | null {
  const text = (reason ?? "").trim()
  if (text.length > 1000) return "La précision est trop longue (1 000 caractères au maximum)."
  if (reasonCode && !isReasonCode(reasonCode)) return "Motif inconnu."
  switch (to) {
    case "refused":
      if (!reasonCode) return "Choisissez le motif du refus."
      if (reasonCode === "AUTRE" && text.length < 3) return "Précisez le motif du refus."
      return null
    case "disputed":
      if (!reasonCode && text.length < 3) return "Indiquez le motif du litige."
      if (reasonCode === "AUTRE" && text.length < 3) return "Précisez le motif du litige."
      return null
    case "partially_approved":
      if (text.length < 3) return "Précisez ce que vous acceptez."
      return null
    default:
      return null
  }
}

/** Motif retenu pour l'enregistrement (la suspension vaut demande de justificatifs). */
export function effectiveReasonCode(to: ReceivedStatus, reasonCode: string | null | undefined): string | null {
  if (to === "suspended") return reasonCode || "JUSTIF_ABS"
  if (to === "refused" || to === "disputed") return reasonCode || null
  return null
}
