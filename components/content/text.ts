import { GUIDES } from "@/lib/pseo/guides"
import { MODELES } from "@/lib/pseo/modeles"
import { METIERS } from "@/lib/pseo/metiers"
import { GLOSSAIRE } from "@/lib/pseo/glossaire"

/**
 * Outils de texte des pages de contenu (blog, guides, modèles, métiers, glossaire).
 *
 * Les données pSEO (lib/pseo) contiennent encore des affirmations que le
 * produit ne tient pas (Factur-X « natif » EN 16931, « logiciel certifié »,
 * autoliquidation automatique, factures récurrentes…). En attendant leur
 * correction à la source, ces pages les filtrent à l'affichage ET dans les
 * données structurées, pour que les deux restent identiques
 * (règle « aucune affirmation invérifiable » de CLAUDE.md).
 */

/** Typographie française : espace insécable avant « ? », « : », « ; » et « ! ». */
export function fr(s: string): string {
  return s.replace(/ ([?:;!»])/g, " $1").replace(/« /g, "« ")
}

/** Phrase qui attribue à Qonforme une conformité ou un format non livrés. */
const PRODUCT_CLAIM = /Qonforme[^.]*(format|Factur-X|certifi|EN 16931|archivage|nativement)|logiciel conforme comme Qonforme/i
/** Promesse de conformité Factur-X collée en fin de description. */
const FACTURX_TAGLINE = /^(Conforme|Factures? et devis conformes?) Factur-X 2026\.?$/i

function sentences(text: string): string[] {
  return text.split(/(?<=[.!?])\s+/).filter(Boolean)
}

/** Retire d'un texte les phrases d'autopromotion invérifiables (voir en tête du fichier). */
export function withoutClaims(text: string): string {
  return sentences(text)
    .filter((s) => !PRODUCT_CLAIM.test(s) && !FACTURX_TAGLINE.test(s.trim()))
    .join(" ")
    .replace(/,? ?Conforme Factur-X 2026,?/g, "")
    .trim()
}

/** Fonctions annoncées par lib/pseo/metiers.ts mais absentes du produit : jamais affichées. */
const UNDELIVERED_FEATURES = new Set([
  "Autoliquidation TVA",
  "Suivi de chantier",
  "Factures récurrentes",
  "Gestion des acomptes",
  "Factur-X conforme",
  "Notes d'honoraires",
])

/** Textes réécrits quand la fonction existe mais que la description promet plus. */
const FEATURE_REWRITES: Record<string, string> = {
  "Envoi par email": "Envoyez vos factures et devis par email depuis l'application, le PDF en pièce jointe.",
  "Franchise de TVA": "En franchise en base, ajoutez une fois pour toutes la mention de l'article 293 B du CGI dans vos modèles : elle figure ensuite sur chaque facture.",
  "Suivi des paiements": "Voyez d'un coup d'œil les factures payées, en attente et en retard.",
}

export function deliveredFeatures(features: { titre: string; texte: string }[]) {
  return features
    .filter((f) => !UNDELIVERED_FEATURES.has(f.titre))
    .map((f) => ({ titre: f.titre, texte: FEATURE_REWRITES[f.titre] ?? f.texte }))
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
