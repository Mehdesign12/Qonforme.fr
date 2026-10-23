/**
 * Christophe, responsable service client : la personne qui répond aux messages.
 * Une seule fiche pour la bulle, le panneau, la page Contact et les emails.
 * Pour changer la photo : remplacer public/support/christophe.webp (carré, 320 px).
 */
export const PERSONA = {
  name: "Christophe",
  role: "Responsable service client",
  photo: "/support/christophe.webp",
  initial: "C",
} as const

/** Articles proposés dans l'accueil et l'onglet Aide du panneau : de vrais guides du site. */
export const HELP_LINKS = [
  { label: "Les mentions obligatoires d'une facture", href: "/guide/mentions-obligatoires-facture" },
  { label: "Comment faire un devis d'artisan", href: "/guide/comment-faire-un-devis" },
  { label: "TVA des travaux : 20 %, 10 % ou 5,5 %", href: "/guide/tva-travaux" },
  { label: "Les tarifs et la garantie de 30 jours", href: "/pricing" },
] as const
