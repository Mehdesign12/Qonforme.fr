"use client"

import { PublicNav } from "@/components/layout/PublicNav"

interface OutilsHeaderProps {
  /** Nom de l'outil courant (fil d'Ariane). */
  breadcrumb: string
}

/**
 * En-tête des pages /outils : l'en-tête public commun (lien « Outils gratuits »
 * marqué comme page courante), avec le retour vers la liste des outils et le
 * nom de l'outil courant.
 */
export function OutilsHeader({ breadcrumb }: OutilsHeaderProps) {
  return <PublicNav backLink={{ href: "/outils", label: "Outils gratuits" }} crumb={breadcrumb || undefined} />
}
