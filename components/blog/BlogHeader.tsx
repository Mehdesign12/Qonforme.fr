"use client"

import { PublicNav } from "@/components/layout/PublicNav"

interface BlogHeaderProps {
  /** Article : lien « Tous les articles » après le logo et en tête du menu mobile. */
  showBackLink?: boolean
}

/** En-tête du blog : l'en-tête public commun, avec le retour vers la liste des articles. */
export default function BlogHeader({ showBackLink }: BlogHeaderProps) {
  return <PublicNav backLink={showBackLink ? { href: "/blog", label: "Tous les articles" } : undefined} />
}
