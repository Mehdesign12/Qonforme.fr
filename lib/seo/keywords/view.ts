/**
 * Filtres, tri et pagination de la liste des mots-clés, pilotés par l'adresse :
 * `?statut=candidats|cibles|couverts|ignores`, `?intention=<intention>|aucune`,
 * `?q=<recherche>`, `?page=<n>`, `?mot-cle=<id>` (panneau de détail).
 *
 * `?page=<n>` : page n de 15 lignes sur ordinateur (Précédent / Suivant),
 * n × 8 premières lignes sur téléphone (« Afficher plus »), comme sur les
 * planches Mots-cles et Mobile-mots-cles.
 * Module pur (serveur, navigateur, tests).
 */
import type { KeywordIntent, KeywordStatus } from "@/lib/seo/types"
import { KEYWORD_STATUS } from "@/lib/seo/types"
import { foldAccents } from "@/lib/seo/keywords/normalize"
import { compareKeywords } from "@/lib/seo/keywords/rules"
import { isKeywordIntent, type KeywordRow } from "@/lib/seo/keywords/types"

export const KEYWORDS_PATH = "/admin/seo/mots-cles"
/** Lignes par page du tableau (ordinateur). */
export const PAGE_SIZE = 15
/** Lignes ajoutées par « Afficher plus » (téléphone). */
export const MOBILE_STEP = 8

export const STATUS_SLUGS: { slug: string; status: KeywordStatus; label: string }[] = [
  { slug: "candidats", status: "candidate", label: "Candidats" },
  { slug: "cibles", status: "targeted", label: "Ciblés" },
  { slug: "couverts", status: "covered", label: "Couverts" },
  { slug: "ignores", status: "ignored", label: "Ignorés" },
]

/** « aucune » : intention pas encore précisée. */
export type IntentFilter = KeywordIntent | "aucune" | null

export interface KeywordFilters {
  statut: KeywordStatus | null
  intention: IntentFilter
  q: string
  page: number
  selected: string | null
}

type Search = Record<string, string | string[] | undefined>

function first(value: string | string[] | undefined): string {
  return (Array.isArray(value) ? value[0] : value) ?? ""
}

export function parseKeywordFilters(sp: Search): KeywordFilters {
  const statutSlug = first(sp.statut)
  const intention = first(sp.intention)
  const page = Number.parseInt(first(sp.page), 10)
  const selected = first(sp["mot-cle"]).trim()
  return {
    statut: STATUS_SLUGS.find((s) => s.slug === statutSlug)?.status ?? null,
    intention: intention === "aucune" ? "aucune" : isKeywordIntent(intention) ? intention : null,
    q: first(sp.q).trim().slice(0, 120),
    page: Number.isFinite(page) && page > 0 ? page : 1,
    selected: selected || null,
  }
}

/** Adresse de la liste avec ces filtres (paramètres vides omis). */
export function keywordsHref(f: Partial<KeywordFilters>): string {
  const qs = new URLSearchParams()
  const slug = STATUS_SLUGS.find((s) => s.status === f.statut)?.slug
  if (slug) qs.set("statut", slug)
  if (f.intention) qs.set("intention", f.intention)
  if (f.q) qs.set("q", f.q)
  if (f.page && f.page > 1) qs.set("page", String(f.page))
  if (f.selected) qs.set("mot-cle", f.selected)
  const s = qs.toString()
  return s ? `${KEYWORDS_PATH}?${s}` : KEYWORDS_PATH
}

function matchesSearch(k: KeywordRow, q: string): boolean {
  if (!q) return true
  const needle = foldAccents(q)
  return foldAccents(k.keyword).includes(needle) || (k.target_path ? foldAccents(k.target_path).includes(needle) : false)
}

function matchesIntent(k: KeywordRow, intention: IntentFilter): boolean {
  if (!intention) return true
  return intention === "aucune" ? k.intent === null : k.intent === intention
}

/** Mots-clés qui passent la recherche et l'intention (base des compteurs d'onglets). */
export function applySearchAndIntent(rows: KeywordRow[], f: Pick<KeywordFilters, "q" | "intention">): KeywordRow[] {
  return rows.filter((k) => matchesSearch(k, f.q) && matchesIntent(k, f.intention))
}

/** Compteurs des onglets de statut (« Tous » compris les ignorés). */
export function statusCounts(rows: KeywordRow[]): { all: number } & Record<KeywordStatus, number> {
  const counts = { all: rows.length, candidate: 0, targeted: 0, covered: 0, ignored: 0 }
  rows.forEach((k) => {
    counts[k.status]++
  })
  return counts
}

export interface KeywordPageView {
  /** Liste filtrée et triée (toutes pages). */
  shown: KeywordRow[]
  /** Lignes de la page demandée (tableau, ordinateur). */
  pageRows: KeywordRow[]
  /** Page du tableau (ordinateur), ramenée à la dernière page. */
  page: number
  pageCount: number
  from: number
  to: number
  /** Lignes de la liste du téléphone : les `MOBILE_STEP × n` premières. */
  mobileRows: KeywordRow[]
  /** Page demandée, ramenée au nombre d'étapes du téléphone (le plus grand) : à garder dans les liens. */
  requestedPage: number
  /** Page suivante du téléphone (« Afficher plus »), null quand tout est affiché. */
  mobileNextPage: number | null
}

/** Filtre (statut, intention, recherche), trie (gains rapides, impressions, volume) et découpe en pages. */
export function keywordPage(rows: KeywordRow[], f: KeywordFilters): KeywordPageView {
  const shown = applySearchAndIntent(rows, f)
    .filter((k) => !f.statut || k.status === f.statut)
    .sort(compareKeywords)
  const pageCount = Math.max(1, Math.ceil(shown.length / PAGE_SIZE))
  const page = Math.min(f.page, pageCount)
  const start = (page - 1) * PAGE_SIZE
  const pageRows = shown.slice(start, start + PAGE_SIZE)
  const mobileSteps = Math.max(1, Math.ceil(shown.length / MOBILE_STEP))
  const requestedPage = Math.min(f.page, Math.max(mobileSteps, pageCount))
  const mobileRows = shown.slice(0, Math.min(requestedPage, mobileSteps) * MOBILE_STEP)
  return {
    shown,
    pageRows,
    page,
    pageCount,
    from: pageRows.length ? start + 1 : 0,
    to: start + pageRows.length,
    mobileRows,
    requestedPage,
    mobileNextPage: mobileRows.length < shown.length ? Math.min(requestedPage, mobileSteps) + 1 : null,
  }
}

export function statusLabel(status: KeywordStatus): string {
  return KEYWORD_STATUS[status].label
}
