"use client"

import { PublicNav } from "@/components/layout/PublicNav"

interface PublicHeaderProps {
  /** Accueil : ancres locales (#features) au lieu de chemins absolus (/#features). */
  isLandingPage?: boolean
}

/**
 * En-tête public partagé par TOUTES les pages publiques (accueil, tarifs,
 * guides, pages par métier, outils, blog, pages légales). Le rendu vit dans
 * PublicNav ; BlogHeader et OutilsHeader en sont des variantes.
 */
export function PublicHeader({ isLandingPage = false }: PublicHeaderProps) {
  return <PublicNav isLandingPage={isLandingPage} />
}
