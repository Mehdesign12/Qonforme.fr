/**
 * Photos d'ambiance de l'accueil (public/landing/photos/).
 *
 * Ce sont des images d'illustration générées : elles montrent des artisans du
 * bâtiment au travail, jamais des clients de Qonforme. Donc ni nom, ni citation,
 * ni écran lisible (règle « aucune affirmation invérifiable » de CLAUDE.md).
 *
 * Une entrée à null n'est pas encore générée : la section qui l'utilise
 * s'affiche sans photo. Générateur : scripts/generate-landing-photos.mjs (clé
 * OpenAI ou Gemini lue dans l'environnement), qui remplit aussi ce fichier.
 */

export interface LandingPhoto {
  src: string
  /** Dimensions réelles du fichier, pour réserver la place avant chargement. */
  width: number
  height: number
  alt: string
}

export type LandingPhotoKey =
  | "chantier"
  | "nouvelInstalle"
  | "sansLogiciel"
  | "entrepriseGrandit"
  | "finDeJournee"

export const PHOTOS: Record<LandingPhotoKey, LandingPhoto | null> = {
  chantier: null,
  nouvelInstalle: null,
  sansLogiciel: null,
  entrepriseGrandit: null,
  finDeJournee: null,
}
