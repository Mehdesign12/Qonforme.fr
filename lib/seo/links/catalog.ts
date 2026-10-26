/**
 * Catalogue des pages que le blog peut lier : guides, modèles, pages métier,
 * « Devenir … à son compte », glossaire, outils, pages principales et articles
 * publiés. Pour chacune : les expressions qui la désignent (ancres), les mots de
 * son sujet (proximité avec un article) et un poids.
 *
 * Les ancres viennent de trois endroits :
 * - les mots-clés de la page (`motsCles` des guides et des modèles : « que doit
 *   contenir un devis »), seulement ceux de deux mots ou plus ;
 * - des formes calculées (« logiciel de devis pour plombier ») ;
 * - les expressions écrites à la main (lib/blog-autolink.ts, et les listes
 *   ci-dessous), qui l'emportent par leur précision.
 *
 * Serveur seulement (les données des pages pèsent). Le moteur
 * (lib/seo/links/engine.ts) ne connaît que `LinkCandidate`.
 */
import type { SeoDb } from "@/lib/seo/db"
import { isMissingSchemaError } from "@/lib/supabase/schema-guard"
import { GUIDES } from "@/lib/pseo/guides"
import { MODELES } from "@/lib/pseo/modeles"
import { METIERS } from "@/lib/pseo/metiers"
import { INSTALLATIONS } from "@/lib/pseo/installation"
import { GLOSSAIRE } from "@/lib/pseo/glossaire"
import { OUTILS_CATEGORIES } from "@/components/layout/public-links"
import { KEYWORD_LINKS } from "@/lib/blog-autolink"
import { topicTokens } from "@/lib/seo/links/text"
import type { LinkCandidate, LinkKind, Phrase } from "@/lib/seo/links/engine"
import type { LinkTarget } from "@/lib/seo/articles/editor-types"

/** Pages principales, dans l'ordre où on les cherche le plus (fenêtre « Lien » de l'éditeur comprise). */
export const MAIN_PAGES: LinkTarget[] = [
  { title: "Accueil", path: "/", kind: "page" },
  { title: "Tarifs", path: "/pricing", kind: "page" },
  { title: "Modèle de devis gratuit", path: "/modele", kind: "page" },
  { title: "Outils gratuits", path: "/outils", kind: "page" },
  { title: "Guides de facturation", path: "/guide", kind: "page" },
  { title: "Logiciel de devis par métier", path: "/facturation", kind: "page" },
  { title: "Logiciel de gestion bâtiment et devis", path: "/logiciel-gestion-batiment", kind: "page" },
  { title: "S'installer à son compte dans le bâtiment", path: "/devenir-a-son-compte", kind: "page" },
  { title: "Glossaire", path: "/glossaire", kind: "page" },
  { title: "Blog", path: "/blog", kind: "page" },
  { title: "Démo du tableau de bord", path: "/demo", kind: "page" },
  { title: "Créer un compte", path: "/signup", kind: "page" },
]

/** Outils absents du menu public (hub /outils seulement). */
const EXTRA_TOOLS: LinkTarget[] = [
  { title: "Calculateur de béton", path: "/outils/calculateur-beton", kind: "outil" },
  { title: "Calculateur de pente", path: "/outils/calculateur-pente", kind: "outil" },
]

/** Expressions écrites à la main, par page (en plus des mots-clés de la page). */
const CURATED: Record<string, string[]> = {
  "/modele": ["modèle de devis gratuit", "modèles de devis gratuits", "modèle de devis à télécharger"],
  "/guide/devis-obligatoire": ["devis obligatoire"],
  "/guide/facture-impayee": ["facture impayée", "factures impayées", "relancer un client", "relance de facture", "relancer une facture"],
  "/guide/facture-sans-tva": ["facture sans tva", "facturer sans tva"],
  "/guide/difference-devis-facture": ["différence entre un devis et une facture", "différence entre devis et facture"],
  "/guide/facturer-etranger": ["facturer à l'étranger", "facturer un client étranger"],
  "/guide/facture-acompte": ["facturer un acompte", "demander un acompte"],
  "/outils/generateur-devis-gratuit": ["générateur de devis", "faire un devis en ligne", "créer un devis en ligne"],
  "/outils/generateur-facture-gratuite": ["générateur de facture", "faire une facture en ligne", "créer une facture en ligne"],
  "/outils/calculateur-tva": ["calculateur de tva", "convertir un prix hors taxe en ttc", "passer du ht au ttc"],
  "/outils/calculateur-penalites-retard": ["calculateur de pénalités de retard", "calculer les pénalités de retard", "calculer les intérêts de retard"],
  "/outils/simulateur-seuil-tva": ["simulateur du seuil de tva", "seuil de la franchise de tva", "seuils de la franchise de tva"],
  "/outils/verification-siret": ["vérifier un siret", "vérifier un numéro de siret", "vérificateur de siret"],
  "/outils/verificateur-mentions-facture": ["vérifier les mentions d'une facture", "vérificateur de mentions"],
  "/outils/verificateur-conformite-facture": ["vérifier la conformité d'une facture", "conformité de vos factures"],
  "/outils/simulateur-charges-auto-entrepreneur": ["charges d'un auto-entrepreneur", "cotisations d'un auto-entrepreneur", "simuler ses charges"],
  "/outils/simulateur-revenu-net": ["revenu net d'un auto-entrepreneur", "calculer son revenu net"],
  "/outils/generateur-numero-facture": ["numéro de facture", "numérotation des factures"],
  "/outils/generateur-conditions-paiement": ["conditions de paiement"],
  "/outils/calculateur-beton": ["calculer le béton", "quantité de béton", "volume de béton"],
  "/outils/calculateur-pente": ["calcul de pente", "pourcentage de pente"],
  "/facturation": ["logiciel de devis par métier"],
  "/logiciel-gestion-batiment": ["logiciel de gestion bâtiment", "logiciel de gestion pour le bâtiment", "logiciel de gestion btp", "logiciel de gestion pour artisan"],
  "/devenir-a-son-compte": ["devenir artisan à son compte", "s'installer à son compte"],
}

const WEIGHT: Record<LinkKind, number> = { guide: 5, modele: 4, outil: 4, article: 4, metier: 3, installation: 3, glossaire: 2, page: 1 }

/** Mot-clé de page trop général pour servir d'ancre. */
const GENERIC_KEYWORDS = new Set(["facture", "devis", "facture gratuit", "devis gratuit", "faire un devis", "faire une facture", "créer une facture", "facture ht"].map((s) => s.toLowerCase()))

const multiWord = (s: string) => s.trim().split(/\s+/).length >= 2 && s.trim().length >= 9 && !GENERIC_KEYWORDS.has(s.trim().toLowerCase())

function uniqueStrings(list: string[]): string[] {
  const seen = new Set<string>()
  return list.filter((s) => {
    const key = s.trim().toLowerCase()
    if (!key || seen.has(key)) return false
    seen.add(key)
    return true
  })
}

/** Une expression d'un seul mot court (« devis ») ne décrit aucune page : elle ne sert pas d'ancre. */
const usablePhrase = (s: string) => s.trim().split(/\s+/).length >= 2 || s.trim().length >= 7

function candidate(path: string, title: string, kind: LinkKind, phrases: string[], topicText: string, extra: Partial<LinkCandidate> = {}): LinkCandidate {
  return {
    path,
    title,
    kind,
    phrases: uniqueStrings([...(CURATED[path] ?? []), ...phrases]).filter(usablePhrase),
    topics: topicTokens(topicText),
    weight: WEIGHT[kind],
    ...extra,
  }
}

/** « Avoir (note de crédit) » → « note de crédit » ; « Conditions générales de vente (CGV) » → « conditions générales de vente ». */
function glossaryPhrases(terme: string): string[] {
  const inside = terme.match(/\(([^)]+)\)/)?.[1]
  const outside = terme.replace(/\s*\([^)]*\)\s*/g, " ").trim()
  const out = [outside]
  if (inside && inside.trim().split(/\s+/).length >= 2) out.push(inside)
  return out
}

/** Pages qui ne dépendent pas de la base. */
export function staticLinkCandidates(): LinkCandidate[] {
  const out: LinkCandidate[] = []
  for (const p of MAIN_PAGES) out.push(candidate(p.path, p.title, "page", [], p.title))
  for (const g of GUIDES) out.push(candidate(`/guide/${g.slug}`, g.titre, "guide", g.motsCles.filter(multiWord), `${g.titre} ${g.motsCles.join(" ")}`))
  for (const m of MODELES) out.push(candidate(`/modele/${m.slug}`, m.titre, "modele", m.motsCles.filter(multiWord), `${m.titre} ${m.motsCles.join(" ")} ${m.type}`))
  for (const m of METIERS) {
    const nom = m.nom.toLowerCase()
    out.push(
      candidate(
        `/facturation/${m.slug}`,
        `Logiciel de devis et facture pour ${nom}`,
        "metier",
        [`logiciel de devis pour ${nom}`, `logiciel de devis ${nom}`, `logiciel de facturation pour ${nom}`, `logiciel de facturation ${nom}`, ...m.motsCles.filter((k) => /^logiciel /i.test(k))],
        `${m.nom} ${m.motsCles.join(" ")}`,
      ),
    )
  }
  for (const i of INSTALLATIONS) {
    out.push(
      candidate(
        `/devenir-a-son-compte/${i.slug}`,
        `Devenir ${i.metier} à son compte`,
        "installation",
        [`devenir ${i.metier} à son compte`, `s'installer comme ${i.metier}`, `se mettre à son compte comme ${i.metier}`, ...i.motsCles.filter((k) => k.trim().split(/\s+/).length >= 3)],
        `${i.metier} ${i.motsCles.join(" ")} installer compte`,
      ),
    )
  }
  for (const c of OUTILS_CATEGORIES) {
    for (const o of c.items) out.push(candidate(o.href, o.label, "outil", [o.label.replace(/\s+(gratuit|gratuite)\b/i, "")], `${o.label} ${o.desc}`))
  }
  for (const o of EXTRA_TOOLS) out.push(candidate(o.path, o.title, "outil", [], o.title))
  for (const t of GLOSSAIRE) out.push(candidate(`/glossaire/${t.slug}`, t.terme, "glossaire", glossaryPhrases(t.terme), `${t.terme} ${t.definition}`))

  // Expressions écrites à la main dans lib/blog-autolink.ts : ajoutées à la page qu'elles visent
  const byPath = new Map(out.map((c) => [c.path, c]))
  for (const { pattern, href } of KEYWORD_LINKS) {
    const target = byPath.get(href)
    if (target) target.phrases = [...target.phrases, new RegExp(pattern.source, pattern.flags.replace(/g/g, ""))] as Phrase[]
  }
  return out
}

/** Pages principales et articles : tout ce qui peut être le but d'un lien. */
export function validLinkPaths(candidates: LinkCandidate[]): Set<string> {
  const out = new Set<string>(candidates.map((c) => c.path))
  MAIN_PAGES.forEach((p) => out.add(p.path))
  return out
}

export interface PublishedPostRow {
  slug: string | null
  title: string | null
  target_keyword?: string | null
  ai_keywords?: string[] | null
}

/** Candidats « article » d'après les articles publiés. */
export function articleCandidates(posts: PublishedPostRow[]): LinkCandidate[] {
  const out: LinkCandidate[] = []
  for (const p of posts) {
    if (!p.slug || !p.title) continue
    const keywords = [p.target_keyword, ...(p.ai_keywords ?? []).slice(0, 2)].filter((k): k is string => typeof k === "string" && multiWord(k))
    out.push(
      candidate(`/blog/${p.slug}`, p.title, "article", keywords, `${p.title} ${p.target_keyword ?? ""} ${(p.ai_keywords ?? []).join(" ")}`, {
        keyword: p.target_keyword ?? null,
      }),
    )
  }
  return out
}

/** Articles publiés (500 au plus) ; sans la colonne du mot-clé tant que la migration n'est pas appliquée ; vide si la lecture échoue. */
export async function publishedPosts(db: SeoDb): Promise<PublishedPostRow[]> {
  const columns = ["slug, title, target_keyword, ai_keywords", "slug, title, ai_keywords", "slug, title"]
  for (const select of columns) {
    const res = await db.from("blog_posts").select(select).eq("is_published", true).order("published_at", { ascending: false }).limit(500)
    if (!res.error) return (res.data ?? []) as unknown as PublishedPostRow[]
    if (!isMissingSchemaError(res.error)) {
      console.error("[liens] articles illisibles", res.error.message)
      return []
    }
  }
  return []
}

let staticCache: LinkCandidate[] | null = null

/** Pages statiques (calculées une fois) et articles publiés du moment. */
export async function loadLinkCandidates(db: SeoDb): Promise<LinkCandidate[]> {
  if (!staticCache) staticCache = staticLinkCandidates()
  try {
    return [...articleCandidates(await publishedPosts(db)), ...staticCache]
  } catch (error) {
    console.error("[liens] catalogue incomplet", error instanceof Error ? error.message.slice(0, 160) : "")
    return staticCache
  }
}

/** Entrées de la fenêtre « Lien » de l'éditeur : articles puis pages statiques, une par chemin. */
export function linkTargetsOf(candidates: LinkCandidate[]): LinkTarget[] {
  const seen = new Set<string>()
  const out: LinkTarget[] = []
  for (const c of candidates) {
    if (seen.has(c.path)) continue
    seen.add(c.path)
    out.push({ title: c.title, path: c.path, kind: c.kind })
  }
  return out
}
