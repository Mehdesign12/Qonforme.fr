/**
 * Contenu du modèle de devis téléchargeable (Word, Excel, PDF) : un seul texte,
 * trois mises en page. Les mentions reprennent celles du guide « Mentions
 * obligatoires d'un devis » et de la page /modele/devis-travaux (sources :
 * service-public.gouv.fr F31144, code de la consommation L111-1, code de
 * l'artisanat L132-1, code des assurances L243-2, code de l'environnement
 * L541-21-2-3, CGI 279-0 bis, 283-2 nonies et 293 B). Aucune valeur chiffrée
 * ici : les prix d'un exemple sont fournis par l'appelant et annoncés fictifs.
 *
 * Module serveur : les constructeurs utilisent node:zlib (ZIP) et le disque
 * (polices du PDF).
 */
import { MENTION_FRANCHISE } from "@/lib/outils/document"

export const FORMATS_MODELE = ["docx", "xlsx", "pdf"] as const
export type FormatModele = (typeof FORMATS_MODELE)[number]

export const TYPES_MIME: Record<FormatModele, string> = {
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  pdf: "application/pdf",
}

/** Lignes de prestations du modèle vierge. */
export const NB_LIGNES = 12

/** Une ligne du devis. Champ absent = case à remplir. TVA en pourcentage (20, 10, 5.5). */
export interface LigneModele {
  designation?: string
  quantite?: number
  unite?: string
  prixHT?: number
  tva?: number
}

export interface OptionsModele {
  /** Nom du fichier sans extension. */
  nom: string
  /** Titre de la feuille. */
  titre: string
  /** Lignes préremplies (exemple) ; vide = modèle vierge. */
  lignes?: LigneModele[]
  /** Objet des travaux, préremplie pour un exemple. */
  objet?: string
  /** Exemple fictif : un bandeau le dit, les coordonnées restent à remplir. */
  exempleFictif?: boolean
  /** Mentions propres au métier, ajoutées à celles de tout devis du bâtiment. */
  mentionsMetier?: string[]
  /** Conditions d'un exemple (validité, délai, acompte…), à la place du texte à compléter. */
  conditions?: string[]
}

export const MODELE_VIERGE: OptionsModele = {
  nom: "modele-devis-artisan",
  titre: "DEVIS",
}

export const BANDEAU_EXEMPLE =
  "Exemple fictif : les prix illustrent la méthode de chiffrage, ce ne sont pas des prix de marché. Remplacez-les par les vôtres."

export const ENTREPRISE = [
  "[Nom ou raison sociale · « EI » pour un entrepreneur individuel]",
  "[Adresse]",
  "[SIREN ou SIRET]",
  "[N° de TVA intracommunautaire, si vous facturez la TVA]",
  "[Téléphone · email]",
]

export const CLIENT = [
  "[Nom ou raison sociale du client]",
  "[Adresse de facturation]",
  "[Adresse du chantier, si différente]",
  "[Téléphone]",
  "[Email]",
]

/** Champs de l'en-tête, deux par ligne : [libellé gauche, libellé droit]. */
export const INFOS: [string, string][] = [
  ["N° du devis", "Date d'émission"],
  ["Valable jusqu'au (durée de validité)", "Date ou délai d'exécution des travaux"],
  ["Devis gratuit ou payant", "Mode de règlement"],
]

export const COLONNES = ["Désignation", "Qté", "Unité", "Prix unitaire HT", "TVA (%)", "Total HT"] as const

export const TAUX_FIXES = [20, 10, 5.5] as const

export const LIBELLE_TOTAL_HT = "Total HT"
export const LIBELLE_TTC = "Total TTC"
export const LIBELLE_ACOMPTE = "Acompte à la signature (en %)"
export const LIBELLE_RESTE = "Reste à payer après l'acompte"
export const LIBELLE_TVA_AUTRE = "TVA à un autre taux (indiquez-le)"

export const CONDITIONS_TITRE = "Conditions de paiement"
export const CONDITIONS_TEXTE =
  "[Acompte de … % à la signature, solde à la fin des travaux ou par échéances.] Écrivez « acompte » pour la somme demandée à la signature : " +
  "sans précision, celle d'un particulier est considérée comme des arrhes."

export const OBJET_LIBELLE = "Objet des travaux et adresse du chantier"

export const MENTIONS_TITRE = "Mentions à garder selon votre situation (supprimez les autres)"

/** Mentions communes à tous les devis de travaux. */
export const MENTIONS: string[] = [
  `Assurance professionnelle (décennale pour les travaux du bâtiment) : [assureur], contrat n° [numéro], couverture : [zone géographique].`,
  `Gestion des déchets du chantier (construction, rénovation, démolition) : quantité estimée [ ], tri et enlèvement [ ], point de collecte [nom et adresse], coût estimé [ ] €.`,
  `Chez un particulier, taux réduit de 10 % ou 5,5 % : le client certifie que le logement est achevé depuis plus de deux ans et que les travaux ne sont pas exclus du taux réduit.`,
  `Franchise en base de TVA : « ${MENTION_FRANCHISE} » (mettez 0 dans la colonne TVA).`,
  `Sous-traitance du bâtiment : facturez hors taxes avec la mention « Autoliquidation — art. 283-2 nonies du CGI ».`,
]

export const SIGNATURE = "Date et signature du client, précédées de la mention « Bon pour accord »"

export const PIED =
  "Modèle indicatif : adaptez les mentions à votre situation (régime de TVA, assurance, type de client). Modèle gratuit Qonforme · qonforme.fr/modele/devis-travaux"

/** Date fixe dans l'archive : le même fichier, octet pour octet, à chaque téléchargement. */
export const DATE_ARCHIVE = new Date(Date.UTC(2026, 9, 15, 12, 0, 0))

/** Nombre de lignes de la table : celles de l'exemple, complétées jusqu'à NB_LIGNES. */
export function lignesAffichees(options: OptionsModele): LigneModele[] {
  const donnees = options.lignes ?? []
  const n = Math.max(NB_LIGNES, donnees.length)
  return Array.from({ length: n }, (_, i) => donnees[i] ?? {})
}

/** Noms de fichier : « modele-devis-artisan.docx ». */
export function nomFichierModele(options: OptionsModele, format: FormatModele): string {
  return `${options.nom}.${format}`
}
