/**
 * Analyse « sur la page » d'un article en cours d'écriture : score et liste de
 * contrôle du panneau Référencement de l'éditeur (admin › Blog), et résumé
 * « Qualité » de la fenêtre d'un article du calendrier.
 *
 * Les contrôles portent sur ce que Google lit vraiment : titre Google (balise
 * title, « | Qonforme » ajouté quand il tient, voir lib/seo/meta.ts),
 * description, adresse, premier paragraphe, sous-titres, liens, images.
 * Le mot-clé se cherche sans accents ni casse et au pluriel près : Google
 * rapproche « maçon » et « macon » (CLAUDE.md, règle des accents), mais le
 * site s'écrit toujours avec les accents, d'où le contrôle « Accents ».
 *
 * Les valeurs périmées et affirmations interdites (lib/blog-audit.ts) et les
 * concurrents nommés sont repris du contrôle de publication
 * (lib/seo/articles/check.ts) : ce qui bloque la publication est signalé ici
 * aussi, avant d'enregistrer.
 *
 * Module pur : navigateur (score en direct), serveur et tests.
 */
import { auditArticle } from "@/lib/blog-audit"
import { findCompetitorMentions } from "@/lib/seo/competitors"
import { DUPLICATE_THRESHOLD, isAllowedLink, titleSimilarity, wordCount } from "@/lib/seo/articles/check"
import { shortenTitle, SUFFIX, TITLE_MAX } from "@/lib/seo/meta"
import { isSafeHref } from "@/lib/markdown"
import { keywordArticleMismatch } from "@/lib/seo/articles/search-language"
import type { ArticleType } from "@/lib/seo/types"

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

export type OnPageStatus = "ok" | "warn" | "error"

/** Champ de l'éditeur auquel renvoie un contrôle (clic sur la ligne : le champ reçoit le focus). */
export type OnPageTarget = "keyword" | "title" | "seoTitle" | "seoDescription" | "slug" | "excerpt" | "content" | "cover"

export interface OnPageCheck {
  id: string
  label: string
  status: OnPageStatus
  /** Précision : valeur mesurée, valeur conseillée, passages concernés. */
  detail?: string
  target: OnPageTarget
  /** Poids dans le score (0 : signalé sans compter). */
  weight: number
  /** Bloque la publication (valeur périmée, affirmation interdite, concurrent nommé). */
  blocking?: boolean
}

export interface OnPageInput {
  title: string
  /** Titre pour Google ; vide : le titre de l'article. */
  seoTitle: string
  /** Description pour Google ; vide : l'extrait. */
  seoDescription: string
  slug: string
  excerpt: string
  /** Texte en Markdown (format enregistré). */
  content: string
  keyword: string | null
  /** Type de l'article (enregistré ou déduit) : un mot-clé d'achat sur un « comment faire » est signalé. */
  articleType?: ArticleType | null
  /** Mots-clés secondaires retenus (comptés dans le texte, sans effet sur le score). */
  secondary?: string[]
  coverUrl: string | null
  coverAlt: string | null
  /** Autres articles du blog (titre unique). */
  otherTitles?: { id: string; title: string; slug: string }[]
  selfId?: string | null
  /** Longueur attendue (Préférences d'écriture) ; absente : 800 à 2 000 mots. */
  lengthMin?: number
  lengthMax?: number
  /** Domaines concurrents (Paramètres › Ciblage), usage interne. */
  competitors?: string[]
}

export interface MarkdownStats {
  words: number
  readingMinutes: number
  headings: { level: number; text: string }[]
  h1: number
  h2: number
  h3: number
  internalLinks: number
  externalLinks: number
  /** Liens externes que le contrôle signale (site non officiel). */
  nonOfficialLinks: string[]
  images: number
  imagesWithoutAlt: number
  /** Premier paragraphe en texte brut (hors titres, listes, images, tableaux). */
  firstParagraph: string
  /** Texte brut (sans la syntaxe Markdown ni les adresses). */
  plainText: string
}

export interface KeywordUse {
  keyword: string
  /** Occurrences dans le texte (titre, sous-titres et corps). */
  count: number
}

export interface OnPageResult {
  /** 0 à 100. */
  score: number
  checks: OnPageCheck[]
  /** Titre réellement affiché par Google (« | Qonforme » ajouté s'il tient dans 70 caractères). */
  googleTitle: string
  /** Titre Google sans le suffixe (ce qui est contrôlé). */
  effectiveTitle: string
  effectiveDescription: string
  /** Vrai si la description vient de l'extrait (description Google vide). */
  descriptionFromExcerpt: boolean
  stats: MarkdownStats
  keywordCount: number
  secondary: KeywordUse[]
}

/* ------------------------------------------------------------------ */
/* Comparaison du texte                                                */
/* ------------------------------------------------------------------ */

const STOPWORDS = new Set(
  "a au aux avec ce ces cette d de des du en et l la le les ou par pour sans sur un une vos votre nos notre son sa ses mon ma mes est sont qui que quoi comment quel quelle quels quelles dans".split(" "),
)

/** Minuscules, sans accents, apostrophes et ponctuation remplacées par des espaces. */
export function normalizeForMatch(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[’'`]/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
}

/** Singulier approché (« devis » reste « devis », « maçons » → « macon », « travaux » → « travau »). */
function stem(word: string): string {
  if (word.length > 3 && /[sx]$/.test(word) && !/(ss|is|us)$/.test(word)) return word.slice(0, -1)
  return word
}

function stemmedTokens(text: string): string[] {
  const norm = normalizeForMatch(text)
  return norm ? norm.split(" ").map(stem) : []
}

function significant(tokens: string[]): string[] {
  return tokens.filter((t) => t.length >= 2 && !STOPWORDS.has(t))
}

/**
 * Mots du mot-clé à retrouver : ses mots significatifs (« exemple devis
 * maçonnerie »), ou tous ses mots s'il n'a que des mots vides.
 */
function needleOf(keyword: string): string[] {
  const all = stemmedTokens(keyword)
  const sig = significant(all)
  return sig.length > 0 ? sig : all
}

/** Écart toléré entre deux mots du mot-clé : « exemple de devis de maçonnerie » répond à « exemple devis maçonnerie ». */
const MAX_GAP = 2

/**
 * Première occurrence, à partir de `from`, des mots `needle` dans cet ordre,
 * séparés chacun par au plus MAX_GAP mots : [début, fin exclue], ou null.
 */
function findOrdered(hay: string[], needle: string[], from = 0): [number, number] | null {
  if (needle.length === 0) return null
  for (let i = from; i < hay.length; i++) {
    if (hay[i] !== needle[0]) continue
    let pos = i
    let ok = true
    for (let j = 1; j < needle.length; j++) {
      let found = -1
      for (let k = pos + 1; k <= Math.min(hay.length - 1, pos + 1 + MAX_GAP); k++) {
        if (hay[k] === needle[j]) {
          found = k
          break
        }
      }
      if (found < 0) {
        ok = false
        break
      }
      pos = found
    }
    if (ok) return [i, pos + 1]
  }
  return null
}

export type KeywordMatch = "exact" | "partial" | "none"

/**
 * Présence d'un mot-clé dans un texte (accents, casse et pluriel ignorés) :
 * « exact » si ses mots s'y suivent dans l'ordre de la recherche (deux mots
 * vides au plus entre eux : « devis de maçonnerie »), « partial » s'ils y
 * sont tous mais dans un autre ordre ou éloignés, « none » sinon.
 */
export function matchKeyword(text: string, keyword: string): KeywordMatch {
  const needle = needleOf(keyword)
  if (needle.length === 0) return "none"
  const hay = stemmedTokens(text)
  if (findOrdered(hay, needle)) return "exact"
  const set = new Set(hay)
  return needle.every((t) => set.has(t)) ? "partial" : "none"
}

/** Occurrences (sans chevauchement) du mot-clé, au sens de matchKeyword « exact ». */
export function countKeyword(text: string, keyword: string): number {
  const needle = needleOf(keyword)
  if (needle.length === 0) return 0
  const hay = stemmedTokens(text)
  let count = 0
  let hit = findOrdered(hay, needle)
  while (hit) {
    count++
    hit = findOrdered(hay, needle, hit[1])
  }
  return count
}

/** Position (0 à 1) du début de la première occurrence dans le texte, ou null. */
function keywordPosition(text: string, keyword: string): number | null {
  const hay = stemmedTokens(text)
  const hit = findOrdered(hay, needleOf(keyword))
  if (!hit || hay.length === 0) return null
  return hit[0] / hay.length
}

/* ------------------------------------------------------------------ */
/* Accents                                                             */
/* ------------------------------------------------------------------ */

/**
 * Mots écrits sans leurs accents, sans ambiguïté possible en français (aucune
 * autre forme correcte ne s'écrit ainsi). Recopier l'orthographe des outils de
 * mots-clés (« batiment », « macon ») est interdit sur le site (CLAUDE.md).
 */
export const ACCENT_FIXES: Record<string, string> = {
  activite: "activité",
  activites: "activités",
  apres: "après",
  batiment: "bâtiment",
  batiments: "bâtiments",
  benefice: "bénéfice",
  benefices: "bénéfices",
  beneficiaire: "bénéficiaire",
  beneficier: "bénéficier",
  categorie: "catégorie",
  categories: "catégories",
  chaudiere: "chaudière",
  chaudieres: "chaudières",
  creation: "création",
  creer: "créer",
  credit: "crédit",
  credits: "crédits",
  debut: "début",
  decennale: "décennale",
  declaration: "déclaration",
  declarations: "déclarations",
  declarer: "déclarer",
  deduction: "déduction",
  deductible: "déductible",
  deja: "déjà",
  delai: "délai",
  delais: "délais",
  deplacement: "déplacement",
  deplacements: "déplacements",
  depot: "dépôt",
  detail: "détail",
  details: "détails",
  echeance: "échéance",
  echeances: "échéances",
  electricien: "électricien",
  electricienne: "électricienne",
  electriciens: "électriciens",
  electricite: "électricité",
  electrique: "électrique",
  electriques: "électriques",
  electronique: "électronique",
  electroniques: "électroniques",
  energetique: "énergétique",
  energetiques: "énergétiques",
  etape: "étape",
  etapes: "étapes",
  etre: "être",
  eviter: "éviter",
  facon: "façon",
  francais: "français",
  francaise: "française",
  general: "général",
  generale: "générale",
  gerer: "gérer",
  impot: "impôt",
  impots: "impôts",
  independant: "indépendant",
  independants: "indépendants",
  macon: "maçon",
  maconnerie: "maçonnerie",
  macons: "maçons",
  materiaux: "matériaux",
  materiel: "matériel",
  modele: "modèle",
  modeles: "modèles",
  necessaire: "nécessaire",
  numero: "numéro",
  numeros: "numéros",
  operation: "opération",
  operations: "opérations",
  penalite: "pénalité",
  penalites: "pénalités",
  prelevement: "prélèvement",
  proprietaire: "propriétaire",
  qualite: "qualité",
  reception: "réception",
  recu: "reçu",
  recus: "reçus",
  reduit: "réduit",
  reduite: "réduite",
  reforme: "réforme",
  regime: "régime",
  reglementaire: "réglementaire",
  reglementation: "réglementation",
  renovation: "rénovation",
  renovations: "rénovations",
  securite: "sécurité",
  societe: "société",
  societes: "sociétés",
  systeme: "système",
  telephone: "téléphone",
  tres: "très",
}

const LETTERS = new RegExp("[\\p{L}]+", "gu")

/** Mots sans leurs accents dans un texte (adresses et liens exclus). */
export function findMissingAccents(text: string): { word: string; suggestion: string; count: number }[] {
  const cleaned = text
    .replace(/\]\([^)]*\)/g, "]")
    .replace(/https?:\/\/\S+/g, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/`[^`]*`/g, " ")
  const found = new Map<string, { word: string; suggestion: string; count: number }>()
  for (const m of Array.from(cleaned.matchAll(LETTERS))) {
    const word = m[0]
    const fix = ACCENT_FIXES[word.toLowerCase()]
    if (!fix) continue
    const suggestion = word[0] === word[0].toUpperCase() && word[0] !== word[0].toLowerCase() ? fix[0].toUpperCase() + fix.slice(1) : fix
    const key = word.toLowerCase()
    const cur = found.get(key)
    if (cur) cur.count++
    else found.set(key, { word, suggestion, count: 1 })
  }
  return Array.from(found.values()).sort((a, b) => b.count - a.count)
}

/* ------------------------------------------------------------------ */
/* Lecture du Markdown                                                 */
/* ------------------------------------------------------------------ */

const MD_IMAGE = /!\[([^\]]*)\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g
// Constructeur plutôt que littéral : sans « target » dans le tsconfig, TypeScript refuse les regards arrière littéraux
const MD_LINK = new RegExp('(?<!!)\\[([^\\]]+)\\]\\(([^)\\s]+)(?:\\s+"[^"]*")?\\)', "g")
const HTML_LINK = /<a\s[^>]*href="([^"]+)"[^>]*>/gi
const HTML_IMG = /<img\s[^>]*>/gi

/** Lien vers une page du site : « /chemin » sûr (ni « // », ni « /\hôte » : un autre site déguisé) ou qonforme.fr. */
function isInternal(url: string): boolean {
  if (url.startsWith("#")) return false
  if (url.startsWith("/")) return isSafeHref(url)
  return /^https?:\/\/(www\.)?qonforme\.fr(\/|$|[?#])/i.test(url)
}

/** Texte lisible d'un Markdown : syntaxe, adresses, images et balises retirées. */
export function markdownPlainText(md: string): string {
  return md
    .replace(/```[\s\S]*?```/g, " ")
    .replace(MD_IMAGE, " ")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/<[^>]+>/g, " ")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/^>\s?/gm, "")
    .replace(/^\s*(?:[-*+]|\d+\.)\s+/gm, "")
    .replace(/^\|?\s*:?-{3,}.*$/gm, " ")
    .replace(/[|*_`~]/g, " ")
    .replace(/https?:\/\/\S+/g, " ")
    .replace(/[ \t]+/g, " ")
    .trim()
}

export function markdownStats(md: string): MarkdownStats {
  const content = md.replace(/\r\n?/g, "\n")
  const noCode = content.replace(/```[\s\S]*?```/g, "")
  const headings: { level: number; text: string }[] = []
  for (const m of Array.from(noCode.matchAll(/^(#{1,6})\s+(.+?)\s*#*\s*$/gm))) {
    headings.push({ level: m[1].length, text: markdownPlainText(m[2]) })
  }

  const links: string[] = []
  for (const m of Array.from(noCode.matchAll(MD_LINK))) links.push(m[2])
  for (const m of Array.from(noCode.matchAll(HTML_LINK))) links.push(m[1])
  const internalLinks = links.filter(isInternal).length
  // Un chemin refusé (« //hôte », « /\hôte ») mène à un autre site : compté comme lien externe
  const external = links.filter((u) => (/^https?:\/\//i.test(u) || u.startsWith("/")) && !isInternal(u))
  const nonOfficialLinks = Array.from(new Set(external.filter((u) => !isAllowedLink(u))))

  let images = 0
  let imagesWithoutAlt = 0
  for (const m of Array.from(noCode.matchAll(MD_IMAGE))) {
    images++
    if (m[1].trim().length < 3) imagesWithoutAlt++
  }
  for (const m of Array.from(noCode.matchAll(HTML_IMG))) {
    images++
    const alt = m[0].match(/\balt="([^"]*)"/i)
    if (!alt || alt[1].trim().length < 3) imagesWithoutAlt++
  }

  // Premier paragraphe : premier bloc de texte qui n'est ni un titre, ni une liste, ni une image, ni un tableau
  let firstParagraph = ""
  for (const block of noCode.split(/\n{2,}/)) {
    const b = block.trim()
    if (!b || /^(#{1,6}\s|[-*+]\s|\d+\.\s|>|\||!\[|<(table|figure|img|div)|---)/i.test(b)) continue
    firstParagraph = markdownPlainText(b)
    if (firstParagraph) break
  }

  const words = wordCount(content)
  return {
    words,
    readingMinutes: Math.max(1, Math.round(words / 220)),
    headings,
    h1: headings.filter((h) => h.level === 1).length,
    h2: headings.filter((h) => h.level === 2).length,
    h3: headings.filter((h) => h.level === 3).length,
    internalLinks,
    externalLinks: external.length,
    nonOfficialLinks,
    images,
    imagesWithoutAlt,
    firstParagraph,
    plainText: markdownPlainText(content),
  }
}

/* ------------------------------------------------------------------ */
/* Titre affiché par Google                                            */
/* ------------------------------------------------------------------ */

/** Titre de la balise title, comme le produit la page article (fitTitle de lib/seo/meta.ts). */
export function googleTitleOf(raw: string): string {
  const title = raw.replace(/\s+/g, " ").trim()
  if (!title) return ""
  if (title.length + SUFFIX.length <= TITLE_MAX) return `${title}${SUFFIX}`
  return shortenTitle(title, TITLE_MAX)
}

/* ------------------------------------------------------------------ */
/* Analyse                                                             */
/* ------------------------------------------------------------------ */

const nf = (n: number) => n.toLocaleString("fr-FR")
const plural = (n: number, one: string, many: string) => `${nf(n)} ${n > 1 ? many : one}`

/** Les premiers mots du texte (le premier paragraphe peut être très court). */
function opening(stats: MarkdownStats): string {
  const first = stats.firstParagraph
  const words = stats.plainText.split(/\s+/).slice(0, 100).join(" ")
  return first.split(/\s+/).length >= 40 ? first : `${first} ${words}`
}

export function analyzeOnPage(input: OnPageInput): OnPageResult {
  const stats = markdownStats(input.content)
  const title = input.title.trim()
  const effectiveTitle = (input.seoTitle.trim() || title).replace(/\s+/g, " ")
  const descriptionFromExcerpt = !input.seoDescription.trim()
  const effectiveDescription = (input.seoDescription.trim() || input.excerpt.trim()).replace(/\s+/g, " ")
  const keyword = (input.keyword ?? "").trim()
  const hasKeyword = keyword.length > 0
  const checks: OnPageCheck[] = []
  const add = (c: OnPageCheck) => checks.push(c)
  const needKeyword = "Choisissez d'abord un mot-clé principal."

  // Mot-clé principal
  add({
    id: "keyword",
    label: "Mot-clé principal",
    status: hasKeyword ? "ok" : "error",
    detail: hasKeyword ? `« ${keyword} »` : "Choisissez la requête que cet article doit faire ressortir dans Google.",
    target: "keyword",
    weight: 10,
  })

  // Mot-clé qui ne ressemble pas à la recherche de ce type d'article
  const mismatch = hasKeyword ? keywordArticleMismatch(keyword, input.articleType) : null
  if (mismatch) {
    add({ id: "kw-fit", label: "Mot-clé adapté à l'article", status: "warn", detail: mismatch, target: "keyword", weight: 6 })
  }

  // Titre Google
  const titleMatch = hasKeyword ? matchKeyword(effectiveTitle, keyword) : "none"
  add({
    id: "kw-title",
    label: "Mot-clé dans le titre Google",
    status: !hasKeyword ? "warn" : titleMatch === "exact" ? "ok" : titleMatch === "partial" ? "warn" : "error",
    detail: !hasKeyword ? needKeyword : titleMatch === "exact" ? undefined : titleMatch === "partial" ? "Les mots y sont, mais pas dans l'ordre de la recherche." : "Le titre ne contient pas le mot-clé.",
    target: "seoTitle",
    weight: 10,
  })
  if (hasKeyword && titleMatch === "exact") {
    const pos = keywordPosition(effectiveTitle, keyword) ?? 1
    add({
      id: "kw-title-start",
      label: "Mot-clé au début du titre",
      status: pos <= 0.35 ? "ok" : "warn",
      detail: pos <= 0.35 ? undefined : "Placé en tête, il reste visible même si Google coupe le titre.",
      target: "seoTitle",
      weight: 3,
    })
  }
  const tl = effectiveTitle.length
  add({
    id: "title-length",
    label: "Longueur du titre Google",
    status: tl === 0 ? "error" : tl > TITLE_MAX ? "error" : tl > 60 || tl < 30 ? "warn" : "ok",
    detail:
      tl === 0
        ? "Aucun titre."
        : tl > TITLE_MAX
          ? `${plural(tl, "caractère", "caractères")} : Google le coupera (30 à 60 conseillés, ${TITLE_MAX} au plus).`
          : tl > 60
            ? `${plural(tl, "caractère", "caractères")} : risque d'être coupé dans Google (30 à 60 conseillés).`
            : tl < 30
              ? `${plural(tl, "caractère", "caractères")} : court, de la place pour préciser (30 à 60 conseillés).`
              : `${plural(tl, "caractère", "caractères")} (30 à 60 conseillés).`,
    target: "seoTitle",
    weight: 8,
  })

  // Description Google
  const dl = effectiveDescription.length
  add({
    id: "description-length",
    label: "Description Google",
    status: dl === 0 ? "error" : dl >= 120 && dl <= 155 ? "ok" : dl >= 100 && dl <= 170 ? "warn" : "error",
    detail:
      dl === 0
        ? "Aucune description : Google choisira lui-même un passage de l'article."
        : `${plural(dl, "caractère", "caractères")} (120 à 155 conseillés)${descriptionFromExcerpt ? ", reprise de l'extrait" : ""}.`,
    target: "seoDescription",
    weight: 8,
  })
  const descMatch = hasKeyword && dl > 0 ? matchKeyword(effectiveDescription, keyword) : "none"
  add({
    id: "kw-description",
    label: "Mot-clé dans la description",
    status: !hasKeyword ? "warn" : descMatch === "exact" ? "ok" : "warn",
    detail: !hasKeyword ? needKeyword : descMatch === "exact" ? "Google le met en gras dans le résultat." : descMatch === "partial" ? "Les mots y sont, mais pas dans l'ordre de la recherche." : "Google met en gras les mots recherchés : un résultat qui les contient attire l'œil.",
    target: "seoDescription",
    weight: 5,
  })

  // Adresse
  const slug = input.slug.trim()
  const slugText = slug.replace(/-/g, " ")
  if (hasKeyword) {
    const kwSig = needleOf(keyword)
    const slugSet = new Set(stemmedTokens(slugText))
    const present = kwSig.filter((t) => slugSet.has(t)).length
    add({
      id: "kw-slug",
      label: "Mot-clé dans l'adresse",
      status: kwSig.length > 0 && present === kwSig.length ? "ok" : present > 0 ? "warn" : "error",
      detail: present === kwSig.length ? undefined : `/blog/${slug || "…"} : ${present} mot${present > 1 ? "s" : ""} du mot-clé sur ${kwSig.length}.`,
      target: "slug",
      weight: 6,
    })
  } else {
    add({ id: "kw-slug", label: "Mot-clé dans l'adresse", status: "warn", detail: needKeyword, target: "slug", weight: 6 })
  }
  const slugValid = /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)
  add({
    id: "slug-format",
    label: "Adresse courte et lisible",
    status: !slug || !slugValid ? "error" : slug.length > 75 ? "warn" : "ok",
    detail: !slug
      ? "Aucune adresse."
      : !slugValid
        ? "Lettres minuscules sans accents, chiffres et tirets seulement."
        : slug.length > 75
          ? `${plural(slug.length, "caractère", "caractères")} : une adresse courte se lit et se partage mieux.`
          : undefined,
    target: "slug",
    weight: 3,
  })

  // Texte
  const intro = opening(stats)
  const introMatch = hasKeyword ? matchKeyword(intro, keyword) : "none"
  add({
    id: "kw-intro",
    label: "Mot-clé dans l'introduction",
    status: !hasKeyword ? "warn" : introMatch === "exact" ? "ok" : "warn",
    detail: !hasKeyword ? needKeyword : introMatch === "exact" ? undefined : "Dites dès les premières lignes de quoi parle l'article, avec les mots de la recherche.",
    target: "content",
    weight: 6,
  })
  const headingMatch = hasKeyword && stats.headings.some((h) => h.level >= 2 && h.level <= 3 && matchKeyword(h.text, keyword) !== "none")
  add({
    id: "kw-heading",
    label: "Mot-clé dans un sous-titre",
    status: !hasKeyword ? "warn" : headingMatch ? "ok" : "warn",
    detail: !hasKeyword ? needKeyword : headingMatch ? undefined : "Aucun sous-titre (titre 2 ou 3) ne reprend le mot-clé.",
    target: "content",
    weight: 4,
  })
  const keywordCount = hasKeyword ? countKeyword(stats.plainText, keyword) : 0
  if (hasKeyword) {
    const kwLen = Math.max(1, needleOf(keyword).length)
    const density = stats.words > 0 ? (keywordCount * kwLen * 100) / stats.words : 0
    const pct = density.toLocaleString("fr-FR", { maximumFractionDigits: 1 })
    add({
      id: "kw-density",
      label: "Mot-clé dans le texte",
      status: keywordCount === 0 ? "error" : density > 2.5 ? "warn" : keywordCount < 2 && stats.words > 600 ? "warn" : "ok",
      detail:
        keywordCount === 0
          ? "La suite de mots n'apparaît pas dans le texte."
          : density > 2.5
            ? `${plural(keywordCount, "fois", "fois")} (${pct} % du texte) : répété trop souvent, Google peut le prendre pour du bourrage.`
            : `${plural(keywordCount, "fois", "fois")} (${pct} % du texte).`,
      target: "content",
      weight: 4,
    })
  }

  const min = input.lengthMin ?? 800
  const max = input.lengthMax ?? 2000
  add({
    id: "length",
    label: "Longueur de l'article",
    status: stats.words >= Math.round(min * 0.9) && stats.words <= Math.round(max * 1.5) ? "ok" : stats.words >= Math.round(min * 0.6) || stats.words > max ? "warn" : "error",
    detail: `${plural(stats.words, "mot", "mots")} (${nf(min)} à ${nf(max)} attendus) · ${plural(stats.readingMinutes, "minute", "minutes")} de lecture.`,
    target: "content",
    weight: 8,
  })
  add({
    id: "headings",
    label: "Sous-titres",
    status: stats.h2 >= 3 ? "ok" : stats.h2 >= 1 ? "warn" : "error",
    detail: `${plural(stats.h2, "titre 2", "titres 2")}, ${plural(stats.h3, "titre 3", "titres 3")} : trois sections ou plus aident Google et le lecteur.`,
    target: "content",
    weight: 5,
  })
  if (stats.h1 > 0) {
    add({
      id: "h1",
      label: "Titre de niveau 1 dans le texte",
      status: "warn",
      detail: "Le titre de l'article est déjà le titre principal de la page : utilisez des titres 2 et 3.",
      target: "content",
      weight: 2,
    })
  }
  add({
    id: "internal-links",
    label: "Liens vers d'autres pages du site",
    status: stats.internalLinks >= 2 ? "ok" : stats.internalLinks === 1 ? "warn" : "error",
    detail: `${plural(stats.internalLinks, "lien interne", "liens internes")} (2 ou plus conseillés : guides, modèles, outils).`,
    target: "content",
    weight: 6,
  })
  if (stats.nonOfficialLinks.length > 0) {
    add({
      id: "external-links",
      label: "Liens vers des sites non officiels",
      status: "warn",
      detail: `Seuls les sites officiels (.gouv.fr, service-public.fr) sont admis : ${stats.nonOfficialLinks.slice(0, 3).join(", ")}${stats.nonOfficialLinks.length > 3 ? "…" : ""}`,
      target: "content",
      weight: 3,
    })
  }

  // Images
  const hasCover = !!input.coverUrl?.trim()
  add({
    id: "cover",
    label: "Image de couverture",
    status: hasCover ? "ok" : "warn",
    detail: hasCover ? undefined : "Affichée dans la liste du blog et lors d'un partage.",
    target: "cover",
    weight: 4,
  })
  if (hasCover) {
    const altOk = (input.coverAlt ?? "").trim().length >= 5
    add({
      id: "cover-alt",
      label: "Texte alternatif de la couverture",
      status: altOk ? "ok" : "warn",
      detail: altOk ? undefined : "Décrivez l'image en une phrase : Google Images et les lecteurs d'écran la lisent.",
      target: "cover",
      weight: 3,
    })
  }
  if (stats.images > 0) {
    add({
      id: "images-alt",
      label: "Texte alternatif des images",
      status: stats.imagesWithoutAlt === 0 ? "ok" : "warn",
      detail: stats.imagesWithoutAlt === 0 ? undefined : `${plural(stats.imagesWithoutAlt, "image", "images")} sans description sur ${nf(stats.images)}.`,
      target: "content",
      weight: 3,
    })
  }

  // Extrait
  const excerptLen = input.excerpt.trim().length
  add({
    id: "excerpt",
    label: "Extrait",
    status: excerptLen >= 50 ? "ok" : "warn",
    detail: excerptLen >= 50 ? undefined : "Une ou deux phrases affichées dans la liste du blog.",
    target: "excerpt",
    weight: 3,
  })

  // Titre unique
  const others = (input.otherTitles ?? []).filter((o) => !input.selfId || o.id !== input.selfId)
  const normTitle = normalizeForMatch(title)
  const same = normTitle ? others.find((o) => normalizeForMatch(o.title) === normTitle) : undefined
  const close = same ? undefined : title ? others.find((o) => titleSimilarity(title, o.title) >= DUPLICATE_THRESHOLD) : undefined
  add({
    id: "unique-title",
    label: "Titre unique sur le blog",
    status: same ? "error" : close ? "warn" : "ok",
    detail: same ? `Même titre que « ${same.title} ».` : close ? `Sujet proche de « ${close.title} » : deux articles sur la même recherche se font concurrence.` : undefined,
    target: "title",
    weight: 5,
  })

  // Accents (titres, description, extrait, texte)
  const fields: { target: OnPageTarget; text: string }[] = [
    { target: "title", text: title },
    { target: "seoTitle", text: input.seoTitle },
    { target: "seoDescription", text: input.seoDescription },
    { target: "excerpt", text: input.excerpt },
    { target: "content", text: input.content },
  ]
  const accentHits = fields.map((f) => ({ ...f, hits: findMissingAccents(f.text) })).filter((f) => f.hits.length > 0)
  const allHits = new Map<string, { word: string; suggestion: string; count: number }>()
  accentHits.forEach((f) =>
    f.hits.forEach((h) => {
      const k = h.word.toLowerCase()
      const cur = allHits.get(k)
      if (cur) cur.count += h.count
      else allHits.set(k, { ...h })
    }),
  )
  const hits = Array.from(allHits.values()).sort((a, b) => b.count - a.count)
  add({
    id: "accents",
    label: "Accents",
    status: hits.length === 0 ? "ok" : "warn",
    detail:
      hits.length === 0
        ? undefined
        : hits
            .slice(0, 4)
            .map((h) => `« ${h.word} » → « ${h.suggestion} »${h.count > 1 ? ` (${h.count} fois)` : ""}`)
            .join(", ") + (hits.length > 4 ? "…" : ""),
    target: accentHits[0]?.target ?? "content",
    weight: 4,
  })

  // Contrôle de publication : valeurs périmées, affirmations interdites, concurrents
  const fullText = [title, input.seoTitle, effectiveDescription, input.coverAlt ?? "", input.content].join("\n\n")
  const findings = auditArticle(fullText)
  const blockingFindings = findings.filter((f) => f.rule.id !== "pdp")
  const pdp = findings.filter((f) => f.rule.id === "pdp")
  if (blockingFindings.length > 0) {
    const labels = Array.from(new Set(blockingFindings.map((f) => f.rule.label)))
    add({
      id: "audit",
      label: "Valeur périmée ou affirmation interdite",
      status: "error",
      detail: labels.slice(0, 3).join(" ; "),
      target: "content",
      weight: 0,
      blocking: true,
    })
  }
  if (pdp.length > 0) {
    add({ id: "pdp", label: "« PDP » au lieu de « plateforme agréée »", status: "warn", detail: pdp[0].excerpt, target: "content", weight: 0 })
  }
  const competitors = input.competitors && input.competitors.length > 0 ? findCompetitorMentions(`${fullText}\n${slugText}`, input.competitors) : []
  if (competitors.length > 0) {
    add({ id: "competitor", label: "Concurrent nommé", status: "error", detail: `Usage interne : ${competitors.join(", ")}`, target: "content", weight: 0, blocking: true })
  }

  const total = checks.reduce((s, c) => s + c.weight, 0)
  const got = checks.reduce((s, c) => s + (c.status === "ok" ? c.weight : c.status === "warn" ? c.weight / 2 : 0), 0)
  let score = total > 0 ? Math.round((got * 100) / total) : 0
  // Un passage bloquant plafonne le score : l'article ne peut pas être publié en l'état
  if (checks.some((c) => c.blocking)) score = Math.min(score, 40)

  const secondary = (input.secondary ?? [])
    .map((k) => k.trim())
    .filter(Boolean)
    .map((k) => ({ keyword: k, count: countKeyword(`${title}\n${stats.plainText}`, k) }))

  return {
    score,
    checks,
    googleTitle: googleTitleOf(effectiveTitle),
    effectiveTitle,
    effectiveDescription,
    descriptionFromExcerpt,
    stats,
    keywordCount,
    secondary,
  }
}

/** Couleur du score : vert à partir de 80, ambre à partir de 50, rouge en dessous. */
export function scoreTone(score: number): "ok" | "warn" | "danger" {
  return score >= 80 ? "ok" : score >= 50 ? "warn" : "danger"
}

/** Ordre d'affichage : à corriger, à améliorer, puis validés. */
export function sortChecks(checks: OnPageCheck[]): OnPageCheck[] {
  const rank: Record<OnPageStatus, number> = { error: 0, warn: 1, ok: 2 }
  return checks.slice().sort((a, b) => rank[a.status] - rank[b.status] || Number(!!b.blocking) - Number(!!a.blocking) || b.weight - a.weight)
}
