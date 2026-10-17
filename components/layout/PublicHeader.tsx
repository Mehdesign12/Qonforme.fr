"use client"

import { PublicNav, type PublicNavProps } from "@/components/layout/PublicNav"

interface PublicHeaderProps {
  /** Accueil : ancres locales (#features) au lieu de chemins absolus (/#features). */
  isLandingPage?: boolean
  /** Destinations propres à une variante de l'accueil (/design). */
  links?: PublicNavProps["links"]
}

/**
 * En-tête public partagé par TOUTES les pages publiques (accueil, tarifs,
 * guides, pages par métier, outils, blog, pages légales). Le rendu vit dans
 * PublicNav ; BlogHeader en est une variante (les outils utilisent cet en-tête via ToolShell).
 */
export function PublicHeader({ isLandingPage = false, links }: PublicHeaderProps) {
  return <PublicNav isLandingPage={isLandingPage} links={links} />
}
