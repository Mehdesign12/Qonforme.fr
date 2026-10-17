import { PHOTOS, type LandingPhoto } from "@/lib/landing/photos"
import type { AuthPhotoContent } from "@/components/auth/AuthPhotoPanel"

/**
 * Contenu du panneau photo des pages d'accès (components/auth/AuthPhotoPanel.tsx).
 * Uniquement des engagements vrais : devis gratuits, aucune carte bancaire à
 * l'inscription, documents toujours consultables (même sans formule).
 */

const portrait = (photo: LandingPhoto | null, fallback: string, alt: string): LandingPhoto =>
  photo ?? { src: `/landing/photos/${fallback}`, width: 1000, height: 1250, alt }

/** Inscription (maquette « Main » validée le 06/10/2026). */
export const SIGNUP_PHOTO: AuthPhotoContent = {
  photo: portrait(PHOTOS.sansLogiciel, "electricien.webp", "Un électricien intervient sur un tableau électrique"),
  position: { panel: "50% 30%", band: "50% 28%" },
  title: "Vos devis entre deux chantiers,",
  accent: "pas le dimanche soir.",
  items: ["Sans carte bancaire", "Sans engagement", "Sur ordinateur et téléphone"],
}

/** Connexion et mot de passe. */
export const LOGIN_PHOTO: AuthPhotoContent = {
  photo: portrait(PHOTOS.menuisier, "menuisier.webp", "Un menuisier rabote une planche sur son établi"),
  position: { panel: "38% 50%", band: "30% 40%" },
  title: "Vos devis vous attendent,",
  accent: "là où vous les avez laissés.",
  items: ["Vos documents toujours accessibles", "Sur ordinateur et téléphone", "Devis gratuits et illimités"],
}
