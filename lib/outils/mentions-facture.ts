/**
 * Mentions d'une facture selon le profil de l'émetteur (vérificateur des
 * mentions). Une mention conditionnelle n'est comptée que lorsqu'elle
 * s'applique au profil choisi.
 *
 * Sources (consultées le 3 octobre 2026) :
 * - CGI, annexe II, art. 242 nonies A (version en vigueur depuis le 1er janvier
 *   2025) : numéro unique (I-7°), ventilation de la TVA par taux (I-11°),
 *   « Autoliquidation » (I-13°) ; dispense du n° de TVA en franchise (II) ;
 * - Code de commerce, art. R123-237 : SIREN, mention RCS et ville du greffe ;
 *   art. L441-9 : date de paiement, escompte, pénalités, indemnité forfaitaire ;
 * - Code de l'artisanat, art. L132-1 (ex-loi n° 96-603, art. 22-2, depuis le
 *   1er juillet 2023) : assurance professionnelle des artisans ; Code des
 *   assurances, art. L243-2 : attestation de décennale jointe aux devis et factures ;
 * - entreprendre.service-public.gouv.fr, fiche F31808 « Mentions obligatoires
 *   sur une facture » (vérifiée le 11 août 2026) : « EI » des entrepreneurs
 *   individuels, forme et capital des sociétés, mentions de la réforme.
 */

export interface ProfilMentions {
  statut: "ei" | "societe"
  tva: "assujetti" | "franchise"
  client: "pro" | "particulier"
  /** Artisan du bâtiment (assurance décennale). */
  batiment: boolean
  /** Sous-traitance de travaux de bâtiment : TVA autoliquidée par le client. */
  autoliquidation: boolean
}

export const PROFIL_MENTIONS_DEFAUT: ProfilMentions = {
  statut: "ei",
  tva: "franchise",
  client: "pro",
  batiment: true,
  autoliquidation: false,
}

/** Obligatoire pour ce profil, à vérifier seulement si elle s'applique, ou exigée avec la facture électronique. */
export type StatutMention = "obligatoire" | "si-applicable" | "reforme"

export interface Mention {
  id: string
  label: string
  category: string
  help?: string
  statut: StatutMention
}

type Regle = Omit<Mention, "statut" | "label"> & {
  label: string | ((p: ProfilMentions) => string)
  /** null : la mention ne concerne pas ce profil et n'est pas affichée. */
  statut: (p: ProfilMentions) => StatutMention | null
}

const toujours = () => "obligatoire" as const

const REGLES: Regle[] = [
  {
    id: "emetteur_nom",
    category: "Émetteur",
    label: (p) => (p.statut === "ei" ? "Nom et prénom, avec la mention « EI » ou « entrepreneur individuel »" : "Dénomination sociale"),
    statut: toujours,
  },
  { id: "emetteur_forme", category: "Émetteur", label: "Forme juridique et capital social", statut: (p) => (p.statut === "societe" ? "obligatoire" : null) },
  { id: "emetteur_adresse", category: "Émetteur", label: (p) => (p.statut === "societe" ? "Adresse du siège social" : "Adresse de l'entreprise"), statut: toujours },
  { id: "emetteur_siren", category: "Émetteur", label: "Numéro SIREN (ou SIRET)", help: "Code de commerce, art. R123-237", statut: toujours },
  {
    id: "emetteur_rcs",
    category: "Émetteur",
    label: "Mention RCS et ville du greffe",
    help: "Pour une entreprise immatriculée au registre du commerce et des sociétés (Code de commerce, art. R123-237)",
    statut: (p) => (p.statut === "societe" ? "obligatoire" : "si-applicable"),
  },
  {
    id: "emetteur_tva",
    category: "Émetteur",
    label: "Numéro de TVA intracommunautaire",
    help: "Facultatif sur une facture de 150 € HT ou moins",
    statut: (p) => (p.tva === "assujetti" ? "obligatoire" : null),
  },
  {
    id: "assurance",
    category: "Émetteur",
    label: "Assurance professionnelle : assureur, coordonnées et couverture géographique",
    help: "Décennale : attestation jointe au devis et à la facture (Code des assurances, art. L243-2 ; Code de l'artisanat, art. L132-1)",
    statut: (p) => (p.batiment ? "obligatoire" : "si-applicable"),
  },
  { id: "client_nom", category: "Client", label: "Nom ou dénomination du client", statut: toujours },
  { id: "client_adresse", category: "Client", label: "Adresse du client", statut: toujours },
  { id: "bon_commande", category: "Client", label: "Numéro du bon de commande, s'il en existe un", statut: () => "si-applicable" },
  { id: "numero", category: "Facture", label: "Numéro unique, à la suite des précédents", help: "CGI, annexe II, art. 242 nonies A, I-7°", statut: toujours },
  { id: "date_emission", category: "Facture", label: "Date d'émission", statut: toujours },
  { id: "date_vente", category: "Facture", label: "Date de la vente ou de la prestation, si elle diffère de la date d'émission", statut: () => "si-applicable" },
  { id: "designation", category: "Lignes", label: "Désignation précise des produits ou des prestations", statut: toujours },
  { id: "quantite", category: "Lignes", label: "Quantité de chaque produit ou prestation", statut: toujours },
  { id: "prix_unitaire", category: "Lignes", label: "Prix unitaire hors taxe", statut: toujours },
  { id: "taux_tva", category: "Lignes", label: "Taux de TVA de chaque ligne", statut: (p) => (p.tva === "assujetti" && !p.autoliquidation ? "obligatoire" : null) },
  { id: "remises", category: "Lignes", label: "Rabais, remises ou ristournes accordés, s'il y en a", statut: () => "si-applicable" },
  { id: "total_ht", category: "Montants", label: "Montant total hors taxe", statut: toujours },
  {
    id: "ventilation_tva",
    category: "Montants",
    label: "TVA ventilée par taux : base hors taxe et TVA de chaque taux",
    help: "CGI, annexe II, art. 242 nonies A, I-11°",
    statut: (p) => (p.tva === "assujetti" && !p.autoliquidation ? "obligatoire" : null),
  },
  { id: "total_ttc", category: "Montants", label: (p) => (p.tva === "assujetti" && !p.autoliquidation ? "Montant total TTC" : "Montant total à payer"), statut: toujours },
  { id: "date_paiement", category: "Paiement", label: "Date ou délai de paiement", statut: toujours },
  { id: "penalites", category: "Paiement", label: "Taux des pénalités de retard", statut: toujours },
  { id: "escompte", category: "Paiement", label: "Conditions d'escompte, ou « Pas d'escompte pour paiement anticipé »", statut: toujours },
  {
    id: "indemnite",
    category: "Paiement",
    label: "Indemnité forfaitaire pour frais de recouvrement de 40 €",
    help: "Due par un client professionnel (Code de commerce, art. D441-5)",
    statut: (p) => (p.client === "pro" ? "obligatoire" : null),
  },
  {
    id: "mention_293b",
    category: "Mentions particulières",
    label: "« TVA non applicable, art. 293 B du CGI »",
    statut: (p) => (p.tva === "franchise" ? "obligatoire" : null),
  },
  {
    id: "autoliquidation",
    category: "Mentions particulières",
    label: "« Autoliquidation » (TVA due par le client)",
    help: "CGI, annexe II, art. 242 nonies A, I-13°",
    statut: (p) => (p.autoliquidation && p.tva === "assujetti" ? "obligatoire" : null),
  },
  {
    id: "client_siren",
    category: "Facture électronique",
    label: "SIREN du client",
    help: "Exigé avec la facture électronique : 1er septembre 2027 pour les TPE et PME",
    statut: (p) => (p.client === "pro" ? "reforme" : null),
  },
  { id: "adresse_livraison", category: "Facture électronique", label: "Adresse de livraison, si elle diffère de celle du client", statut: () => "reforme" },
  { id: "nature_operations", category: "Facture électronique", label: "Nature des opérations : biens, services, ou les deux", statut: () => "reforme" },
  {
    id: "option_debits",
    category: "Facture électronique",
    label: "« Option pour le paiement de la taxe d'après les débits », si vous l'avez choisie",
    statut: (p) => (p.tva === "assujetti" ? "reforme" : null),
  },
]

/** Mentions à afficher pour un profil, dans l'ordre des catégories. */
export function mentionsPourProfil(p: ProfilMentions): Mention[] {
  return REGLES.flatMap((r) => {
    const statut = r.statut(p)
    if (!statut) return []
    return [{ id: r.id, category: r.category, help: r.help, statut, label: typeof r.label === "function" ? r.label(p) : r.label }]
  })
}

export interface BilanMentions {
  obligatoires: Mention[]
  presentes: Mention[]
  manquantes: Mention[]
  /** Part des mentions obligatoires cochées, arrondie à l'entier inférieur (99 % tant qu'il en manque une). */
  pourcentage: number
  complet: boolean
}

export function bilanMentions(mentions: Mention[], coches: Record<string, boolean>): BilanMentions {
  const obligatoires = mentions.filter((m) => m.statut === "obligatoire")
  const presentes = obligatoires.filter((m) => coches[m.id])
  const manquantes = obligatoires.filter((m) => !coches[m.id])
  const pourcentage = obligatoires.length ? Math.floor((presentes.length / obligatoires.length) * 100) : 0
  return { obligatoires, presentes, manquantes, pourcentage, complet: obligatoires.length > 0 && manquantes.length === 0 }
}
