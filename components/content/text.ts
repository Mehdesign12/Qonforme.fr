import { GUIDES } from "@/lib/pseo/guides"
import { MODELES } from "@/lib/pseo/modeles"
import { METIERS } from "@/lib/pseo/metiers"
import { GLOSSAIRE } from "@/lib/pseo/glossaire"

/**
 * Outils de texte des pages de contenu (blog, guides, modèles, métiers, glossaire).
 *
 * Les données pSEO (lib/pseo) sont tenues honnêtes à la source : aucune
 * affirmation invérifiable ni fonction non livrée (règles de CLAUDE.md et de
 * DECISIONS-STRATEGIQUES.md § 2 et § 10). Les pages les affichent telles quelles.
 */

/**
 * Typographie française : espace insécable avant « ? », « : », « ; » et « ! »,
 * dans les milliers (« 7 500 ») et avant « € » et « % », pour qu'un montant ne
 * soit jamais coupé en fin de ligne.
 */
export function fr(s: string): string {
  return s
    .replace(/ ([?:;!»])/g, " $1")
    .replace(/« /g, "« ")
    .replace(/(\d) (?=\d{3}(?!\d))/g, "$1 ")
    .replace(/(\d) ([€%])/g, "$1 $2")
}

/** Première lettre en minuscule (« Plombier » → « plombier », « Chauffeur VTC » → « chauffeur VTC »). */
export function lcFirst(s: string): string {
  return s.charAt(0).toLowerCase() + s.slice(1)
}

/**
 * Libellé lisible d'un lien interne de contenu (« /guide/facture-impayee » →
 * titre du guide). Renvoie null si la page n'existe pas : le lien n'est pas affiché.
 */
export function resolveContentLink(href: string): { href: string; label: string } | null {
  const [, section, slug] = href.split("/")
  const find = <T extends { slug: string }>(list: T[]) => list.find((x) => x.slug === slug)
  switch (section) {
    case "guide": {
      const g = find(GUIDES)
      return g ? { href, label: g.titre } : null
    }
    case "modele": {
      const m = find(MODELES)
      return m ? { href, label: m.titre } : null
    }
    case "facturation": {
      const m = find(METIERS)
      return m ? { href, label: m.titre } : null
    }
    case "glossaire": {
      const t = find(GLOSSAIRE)
      return t ? { href, label: t.terme } : null
    }
    default:
      return null
  }
}

/** « 2026-10-04 » → « 4 octobre 2026 » (date de vérification d'un contenu). */
export function dateFr(iso: string): string {
  return new Date(`${iso}T12:00:00Z`).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric", timeZone: "Europe/Paris" })
}
