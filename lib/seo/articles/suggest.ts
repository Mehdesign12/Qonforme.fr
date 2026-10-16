/**
 * Propositions de l'éditeur d'articles (admin › Blog, bouton « Proposer ») :
 * titre Google, description Google, adresse, chapeau, titre de l'article.
 *
 * Le modèle (celui du plan dans les Préférences : rapide) reçoit l'article et
 * le mot-clé, et rend cinq propositions en JSON. Rien de ce qu'il rend n'est
 * montré sans passer le contrôle `filterSuggestions` :
 * - nettoyage (guillemets, puces, espaces, « | Qonforme » que le site ajoute
 *   lui-même, point final selon le champ) ;
 * - longueur dans les bornes du champ (SUGGEST_FIELDS) ;
 * - aucune valeur périmée ni affirmation interdite (lib/blog-audit.ts, « PDP »
 *   compris : une proposition se refuse, elle ne se signale pas) ;
 * - aucun concurrent (usage interne : jamais affiché), aucun chevron ;
 * - titres : ni point d'exclamation, ni majuscule à chaque mot ;
 * - adresse : `slugify`, jamais celle d'un autre article ;
 * - sans doublon ni retour de la valeur actuelle.
 * Tri : avec le mot-clé exact d'abord, puis la longueur la plus proche de
 * l'idéal ; trois au plus.
 *
 * Module pur : serveur (route /api/admin/blog/suggest), navigateur (bornes
 * affichées) et tests.
 */
import { auditArticle } from "@/lib/blog-audit"
import { findCompetitorMentions } from "@/lib/seo/competitors"
import { slugify } from "@/lib/seo/articles/check"
import { matchKeyword, normalizeForMatch } from "@/lib/seo/articles/onpage"
import type { SuggestField, SuggestRequest, SuggestResponse, Suggestion } from "@/lib/seo/articles/editor-types"

export interface SuggestFieldDef {
  /** « le titre Google » : complément des messages. */
  label: string
  /** Bornes acceptées (au-delà, la proposition est écartée). */
  min: number
  max: number
  /**
   * Zone conseillée affichée (couleur du compteur et des propositions) :
   * la même que celle du score de référencement (lib/seo/articles/onpage.ts,
   * « 30 à 60 conseillés » pour le titre Google, « 120 à 155 » pour la
   * description), pour que le compteur et la liste de contrôle ne se
   * contredisent jamais.
   */
  idealMin: number
  idealMax: number
  /** Longueur demandée au modèle (consigne du champ) : tri des propositions. */
  targetMin: number
  targetMax: number
}

export const SUGGEST_FIELDS: Record<SuggestField, SuggestFieldDef> = {
  seoTitle: { label: "le titre Google", min: 25, max: 70, idealMin: 30, idealMax: 60, targetMin: 45, targetMax: 60 },
  seoDescription: { label: "la description Google", min: 100, max: 170, idealMin: 120, idealMax: 155, targetMin: 125, targetMax: 150 },
  slug: { label: "l'adresse", min: 3, max: 75, idealMin: 15, idealMax: 50, targetMin: 15, targetMax: 50 },
  excerpt: { label: "le chapeau", min: 80, max: 260, idealMin: 150, idealMax: 220, targetMin: 150, targetMax: 220 },
  title: { label: "le titre de l'article", min: 20, max: 110, idealMin: 40, idealMax: 80, targetMin: 40, targetMax: 80 },
}

/** Propositions demandées au modèle ; trois au plus sont montrées. */
export const SUGGEST_REQUESTED = 5
export const SUGGEST_SHOWN = 3
/** Texte de l'article envoyé au modèle (caractères). */
export const SUGGEST_CONTENT_MAX = 12_000

export const SUGGEST_JSON_SCHEMA: Record<string, unknown> = {
  type: "object",
  properties: {
    suggestions: { type: "array", items: { type: "string" }, description: `${SUGGEST_REQUESTED} propositions différentes` },
  },
  required: ["suggestions"],
  additionalProperties: false,
}

/* ------------------------------------------------------------------ */
/* Consigne                                                            */
/* ------------------------------------------------------------------ */

/** « 45 à 60 caractères » : longueur demandée au modèle. */
const range = (field: SuggestField) => `${SUGGEST_FIELDS[field].targetMin} à ${SUGGEST_FIELDS[field].targetMax} caractères`

const FIELD_RULES: Record<SuggestField, string[]> = {
  seoTitle: [
    `Titre affiché par Google (balise title) : ${range("seoTitle")}.`,
    "Le mot-clé principal au début, dans une tournure naturelle, écrit avec ses accents.",
    "Sans « | Qonforme » : le site l'ajoute lui-même.",
    "Pas de majuscule à chaque mot, pas de point d'exclamation, pas de point final.",
    "Une année seulement si l'article porte sur une règle datée.",
  ],
  seoDescription: [
    `Description affichée sous le titre dans Google : ${range("seoDescription")}.`,
    "Un bénéfice concret pour l'artisan qui lit, et le mot-clé principal.",
    "Vouvoiement. Une ou deux phrases, terminées par un point.",
  ],
  slug: [
    "Adresse de l'article, après « /blog/ » : 3 à 6 mots.",
    "Minuscules sans accents, mots séparés par des tirets, avec les mots du mot-clé principal.",
    "Sans mots vides (le, la, les, de, des, du, pour, et, un, une…).",
  ],
  excerpt: [
    `Chapeau affiché sous le titre et dans la liste du blog : ${range("excerpt")}.`,
    "Une ou deux phrases, au vouvoiement, qui disent ce que l'article apporte et donnent envie de le lire.",
  ],
  title: [
    `Titre principal de l'article (affiché en haut de la page) : ${range("title")}.`,
    "Clair et précis, avec le mot-clé principal dans une tournure naturelle.",
    "Pas de majuscule à chaque mot, pas de point d'exclamation.",
  ],
}

const FIELD_NAMES: Record<SuggestField, string> = {
  seoTitle: "TITRE GOOGLE",
  seoDescription: "DESCRIPTION GOOGLE",
  slug: "ADRESSE",
  excerpt: "CHAPEAU",
  title: "TITRE DE L'ARTICLE",
}

const COMMON_RULES = [
  "Français correct, avec tous les accents (« bâtiment », « maçon », « électricien »), même si le mot-clé est écrit sans accents.",
  "Aucun nom de concurrent, d'autre logiciel ni de marque.",
  "Jamais « PDP » : dites « plateforme agréée ». N'écrivez jamais que Qonforme est certifié, homologué ou agréé.",
  "N'inventez aucun chiffre, aucune date, aucun taux, aucun montant : seulement ce qui figure dans l'article.",
  "Aucune promesse de contact humain (appel, rendez-vous, réponse personnalisée).",
  "Seulement des faits présents dans l'article ci-dessous.",
]

/** Retire les chevrons (délimiteurs de la consigne) et réduit les espaces d'un texte venu de l'éditeur. */
function promptText(text: string, max: number): string {
  return text.replace(/[<>]/g, " ").replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim().slice(0, max)
}

/** Consigne d'un champ : contexte de l'article, règles du champ, règles communes, format JSON. */
export function buildSuggestPrompt(req: SuggestRequest): string {
  const lines: string[] = [
    `PROPOSITIONS : ${FIELD_NAMES[req.field]}. Proposez exactement ${SUGGEST_REQUESTED} versions différentes, dans des tournures variées.`,
    "",
    `Mot-clé principal : « ${promptText(req.keyword, 120)} »`,
  ]
  const secondary = (req.secondary ?? []).map((s) => promptText(s, 120)).filter(Boolean).slice(0, 10)
  if (secondary.length > 0) lines.push(`Mots-clés secondaires (facultatifs) : ${secondary.map((s) => `« ${s} »`).join(", ")}`)
  if (req.title.trim()) lines.push(`Titre de l'article : ${promptText(req.title, 200)}`)
  if (req.excerpt?.trim()) lines.push(`Chapeau : ${promptText(req.excerpt, 600)}`)
  if (req.current?.trim()) lines.push(`Valeur actuelle (ne la reprenez pas telle quelle) : ${promptText(req.current, 400)}`)
  lines.push("", "CONSIGNES POUR CE CHAMP :", ...FIELD_RULES[req.field].map((r) => `- ${r}`))
  lines.push("", "RÈGLES COMMUNES :", ...COMMON_RULES.map((r) => `- ${r}`))
  const content = promptText(req.content, SUGGEST_CONTENT_MAX)
  lines.push("", "ARTICLE (Markdown) :", "<<<", content || "(texte pas encore écrit : appuyez-vous sur le titre et le chapeau)", ">>>")
  lines.push("", `Répondez uniquement en JSON : {"suggestions": [${Array.from({ length: SUGGEST_REQUESTED }, () => '"…"').join(", ")}]}`)
  return lines.join("\n")
}

/**
 * Propositions d'une réponse du modèle : JSON `{ suggestions: [...] }` (bloc
 * de code toléré), sinon une proposition par ligne non vide.
 */
export function parseSuggestOutput(text: string): string[] {
  const raw = text.trim().replace(/^```(?:json)?\s*\n?([\s\S]*?)\n?```$/i, "$1").trim()
  const jsonStart = raw.indexOf("{")
  const jsonEnd = raw.lastIndexOf("}")
  if (jsonStart >= 0 && jsonEnd > jsonStart) {
    try {
      const parsed = JSON.parse(raw.slice(jsonStart, jsonEnd + 1)) as { suggestions?: unknown }
      if (Array.isArray(parsed.suggestions)) return parsed.suggestions.filter((s): s is string => typeof s === "string")
    } catch {
      // Réponse qui n'est pas du JSON : lue ligne par ligne
    }
  }
  if (raw.startsWith("[")) {
    try {
      const list = JSON.parse(raw) as unknown
      if (Array.isArray(list)) return list.filter((s): s is string => typeof s === "string")
    } catch {
      // idem
    }
  }
  return raw
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l && !/^[{}[\]]$/.test(l))
}

/* ------------------------------------------------------------------ */
/* Contrôle                                                            */
/* ------------------------------------------------------------------ */

const EDGE_QUOTES = /^[\s"'«»“”‘’`]+|[\s"'«»“”‘’`]+$/g
const UPPER_WORD = new RegExp("^\\p{Lu}\\p{Ll}+$", "u")
const LETTERS_ONLY = new RegExp("^[\\p{L}'’-]+$", "u")
/** Fin de phrase sans ponctuation (lettre, chiffre, parenthèse, guillemet fermant). */
const ENDS_WITHOUT_STOP = new RegExp("[\\p{L}\\p{N})»]$", "u")

/** Nettoie une proposition brute (sans la juger). */
export function cleanSuggestion(field: SuggestField, raw: string): string {
  let text = String(raw ?? "")
    .replace(/\s+/g, " ")
    .trim()
    // Puce ou numéro en tête (« 1. », « - », « • »)
    .replace(/^(?:[-*•–]\s+|\d{1,2}[.)]\s+)/, "")
    // Mise en forme Markdown
    .replace(/\*\*|__|`/g, "")
    .replace(/^#+\s*/, "")
  text = text.replace(EDGE_QUOTES, "").trim()
  if (field === "seoTitle") text = text.replace(/\s*[|–—-]\s*Qonforme\s*$/i, "").trim()
  if (field === "seoTitle" || field === "title") text = text.replace(/[.;,:]+$/, "").trim()
  if ((field === "seoDescription" || field === "excerpt") && ENDS_WITHOUT_STOP.test(text)) text = `${text}.`
  if (field === "slug") {
    // Adresse rendue en entier (« https://qonforme.fr/blog/… », « /blog/… ») : seule la fin compte
    text = slugify(text.replace(/^(?:https?:\/\/)?(?:www\.)?(?:qonforme\.fr)?\/*(?:blog\/+)?/i, "").replace(/[?#].*$/, ""))
  }
  return text
}

/** « Majuscule À Chaque Mot » : plus de la moitié des mots de 4 lettres ou plus (hors premier) commencent par une majuscule. */
export function isTitleCase(text: string): boolean {
  const words = text.split(/\s+/).slice(1).filter((w) => w.length >= 4 && LETTERS_ONLY.test(w))
  if (words.length < 3) return false
  const capitalized = words.filter((w) => UPPER_WORD.test(w)).length
  return capitalized / words.length > 0.5
}

/** Écart entre une longueur et la longueur demandée au modèle (0 dedans). */
function idealGap(field: SuggestField, length: number): number {
  const def = SUGGEST_FIELDS[field]
  if (length < def.targetMin) return def.targetMin - length
  if (length > def.targetMax) return length - def.targetMax
  return 0
}

/** Raison du refus d'une proposition nettoyée ; null : elle passe. */
export function rejectReason(field: SuggestField, text: string, competitors: string[]): string | null {
  const def = SUGGEST_FIELDS[field]
  if (!text) return "vide"
  if (text.length < def.min || text.length > def.max) return "longueur"
  if (/[<>]/.test(text)) return "chevron"
  // Toute règle du contrôle des articles, « PDP » compris (une proposition se refuse, elle ne se signale pas)
  if (auditArticle(text).length > 0) return "affirmation"
  // « agréé » dit de Qonforme (« plateforme agréée » seule reste permise)
  if (/qonforme[^.\n]{0,40}agréé/i.test(text)) return "affirmation"
  if (competitors.length > 0 && findCompetitorMentions(field === "slug" ? text.replace(/-/g, " ") : text, competitors).length > 0) return "concurrent"
  if ((field === "seoTitle" || field === "title") && (text.includes("!") || isTitleCase(text))) return "forme"
  if (field === "slug") {
    const words = text.split("-").filter(Boolean).length
    if (words < 2 || words > 8) return "longueur"
  }
  return null
}

export interface SuggestFilterContext {
  keyword: string
  /** Valeur actuelle du champ : jamais reproposée. */
  current?: string | null
  /** Domaines concurrents (Paramètres › Ciblage), usage interne. */
  competitors: string[]
  /** Adresses déjà prises par d'autres articles (champ « slug »). */
  taken?: string[]
}

/**
 * Propositions retenues (trois au plus) et nombre de propositions écartées
 * par le contrôle (les doublons et la valeur actuelle ne comptent pas).
 */
export function filterSuggestions(field: SuggestField, raw: string[], ctx: SuggestFilterContext): SuggestResponse {
  const seen = new Set<string>()
  const currentKey = ctx.current ? normalizeForMatch(field === "slug" ? ctx.current.replace(/-/g, " ") : ctx.current) : ""
  const taken = new Set((ctx.taken ?? []).map((s) => s.trim().toLowerCase()).filter(Boolean))
  const kept: (Suggestion & { order: number })[] = []
  let rejected = 0

  raw.forEach((value, order) => {
    const text = cleanSuggestion(field, value)
    if (!text) return
    const key = normalizeForMatch(field === "slug" ? text.replace(/-/g, " ") : text)
    if (!key || seen.has(key) || key === currentKey) return
    seen.add(key)
    if (rejectReason(field, text, ctx.competitors) || (field === "slug" && taken.has(text))) {
      rejected++
      return
    }
    const haystack = field === "slug" ? text.replace(/-/g, " ") : text
    kept.push({ text, length: text.length, hasKeyword: ctx.keyword.trim() ? matchKeyword(haystack, ctx.keyword) === "exact" : false, order })
  })

  const suggestions = kept
    .sort((a, b) => Number(b.hasKeyword) - Number(a.hasKeyword) || idealGap(field, a.length) - idealGap(field, b.length) || a.order - b.order)
    .slice(0, SUGGEST_SHOWN)
    .map(({ text, length, hasKeyword }) => ({ text, length, hasKeyword }))
  return { suggestions, rejected }
}
