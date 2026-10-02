/**
 * Photos d'ambiance de l'accueil (public/landing/photos/).
 *
 * Photos de la banque d'images Pexels : usage commercial gratuit, sans
 * attribution (DECISIONS-STRATEGIQUES.md § 6, mêmes photos que le canevas v20).
 * Elles illustrent des artisans du bâtiment au travail, jamais des clients de
 * Qonforme : ni nom, ni citation, ni écran lisible (règle « aucune affirmation
 * invérifiable » de CLAUDE.md). La licence Pexels interdit d'ailleurs de
 * laisser croire que les personnes photographiées recommandent le produit.
 *
 * Une entrée à null s'affiche sans photo dans la section qui l'utilise.
 * Le numéro Pexels de chaque photo est noté en commentaire (pexels.com/photo/<n>).
 */

export interface LandingPhoto {
  src: string
  /** Dimensions réelles du fichier, pour réserver la place avant chargement. */
  width: number
  height: number
  alt: string
}

export type LandingPhotoKey =
  // Sections de l'accueil
  | "chantier"
  | "nouvelInstalle"
  | "sansLogiciel"
  | "entrepriseGrandit"
  | "finDeJournee"
  | "appelFinal"
  | "atelierTelephone"
  | "chezLeClient"
  | "cheffeDeChantier"
  // Galerie des métiers
  | "plaquiste"
  | "plombier"
  | "carreleur"
  | "menuisier"
  | "couvreur"
  | "macon"
  | "chauffagiste"

const portrait = (file: string, alt: string): LandingPhoto => ({ src: `/landing/photos/${file}`, width: 1000, height: 1250, alt })

export const PHOTOS: Record<LandingPhotoKey, LandingPhoto | null> = {
  // 6474471 — bande photo « Pour ceux qui facturent le soir »
  chantier: { src: "/landing/photos/peintre-renovation.webp", width: 1800, height: 1013, alt: "Un artisan peint un mur dans une pièce en rénovation" },
  // 8447842 — profil « Vous démarrez »
  nouvelInstalle: portrait("artisane-atelier.webp", "Une artisane prépare ses outils dans son atelier"),
  // 17842832 — profil « Vous facturez chaque semaine »
  sansLogiciel: portrait("electricien.webp", "Un électricien intervient sur un tableau électrique"),
  // 8961032 — profil « Votre entreprise grandit »
  entrepriseGrandit: portrait("equipe-chantier.webp", "Deux personnes en tenue de chantier consultent un document"),
  // 6195897 — bande photo « Le camion se range »
  finDeJournee: { src: "/landing/photos/utilitaire.webp", width: 1600, height: 900, alt: "Un professionnel en combinaison de travail ouvre les portes arrière de sa camionnette blanche chargée de matériel, garée dans l'allée d'une maison en fin de journée" },
  // 5493653 — appel final
  appelFinal: portrait("peintre-enduit.webp", "Un peintre en bâtiment dans une pièce fraîchement enduite"),
  // 7480728 — section mobile
  atelierTelephone: { src: "/landing/photos/artisan-telephone.webp", width: 1600, height: 1000, alt: "Un menuisier en salopette et chemise à carreaux consulte son téléphone à l'établi de son atelier" },
  // 7190873 — parcours du devis au paiement
  chezLeClient: { src: "/landing/photos/artisan-client.webp", width: 1600, height: 1000, alt: "Un artisan en combinaison de travail montre un document sur un porte-bloc à une cliente, qui le signe chez elle" },
  // 8961008
  cheffeDeChantier: portrait("cheffe-chantier.webp", "Une cheffe de chantier en casque consulte une tablette"),

  // 6474343
  plaquiste: portrait("plaquiste.webp", "Un plaquiste ponce les joints d'un plafond en plaques de plâtre hydrofuges avec une ponceuse girafe, dans une pièce en rénovation"),
  // 6419128
  plombier: portrait("plombier.webp", "Les mains d'un plombier serrent un raccord en laiton sur une canalisation en inox, sous un plan de travail isolé"),
  // 29181494
  carreleur: portrait("carreleur.webp", "Un carreleur en casque de chantier étale la colle à la truelle avant de poser un grand carreau au sol, à côté d'un seau de mortier"),
  // 374049
  menuisier: portrait("menuisier.webp", "Un menuisier rabote une planche sur son établi, dans un atelier baigné de lumière chaude, entouré de copeaux de bois"),
  // 31771166
  couvreur: portrait("couvreur.webp", "Un couvreur à genoux sur les liteaux pose des tuiles plates en terre cuite sur un toit en pente, avec des piles de tuiles prêtes à poser"),
  // 32913797
  macon: portrait("macon.webp", "Gros plan sur la main gantée d'un maçon qui pose une brique rouge sur un lit de mortier, au pied d'un mur en cours de montage"),
  // 5691536
  chauffagiste: portrait("chauffagiste.webp", "Un artisan mesure un radiateur en fonte équipé d'une vanne, sous une fenêtre"),
}
