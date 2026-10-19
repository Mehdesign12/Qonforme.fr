/**
 * Qui édite et vend Qonforme (décision du fondateur, 19/10/2026 ; DECISIONS § 14.1).
 *
 * « Qonforme » est une marque : il n'existe pas de « Qonforme SAS ». L'éditeur du site
 * et le vendeur des abonnements est Diez Agency LLC, société du Wyoming (États-Unis).
 * Les mentions légales, les CGU, la politique de confidentialité, le pied de page et les
 * données structurées lisent tous cette fiche : ne jamais réécrire le nom ailleurs.
 *
 * `address` et `manager` restent à `null` tant que le fondateur ne les a pas fournis : les
 * pages n'affichent alors aucune ligne (jamais de texte à compléter en production). Les
 * renseigner ici suffit à les faire apparaître dans les mentions légales (loi n° 2004-575
 * du 21 juin 2004, art. 6, III : siège social et directeur de la publication).
 */
export interface Publisher {
  /** Dénomination sociale. */
  name: string
  /** Forme juridique et lieu d'immatriculation, tels que le fondateur les a confirmés. */
  form: string
  /** Siège social (adresse complète), à renseigner. */
  address: string | null
  /** Nom du directeur de la publication, à renseigner. */
  manager: string | null
  contactEmail: string
  privacyEmail: string
}

export const PUBLISHER: Publisher = {
  name: "Diez Agency LLC",
  form: "société à responsabilité limitée (Limited Liability Company) de droit américain, constituée dans l'État du Wyoming (États-Unis)",
  address: null,
  manager: null,
  contactEmail: "contact@qonforme.fr",
  privacyEmail: "privacy@qonforme.fr",
}
