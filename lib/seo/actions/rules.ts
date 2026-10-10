/**
 * Règles des Actions SEO : constats tirés de Search Console (28 derniers
 * jours disponibles, comparés aux 28 précédents) et de la dernière
 * exploration du site. Module pur, testé dans __tests__/seo-actions-rules.test.ts.
 *
 * Search Console (une seule règle par page : la plus grave) :
 * - « Page bien classée sans clic » : position ≤ 10, au moins 3 impressions,
 *   aucun clic → haute dès 50 impressions, moyenne dès 10, faible sinon ;
 * - « Page en deuxième page » : position de 11 à 20, au moins 5 impressions → moyenne ;
 * - « Page sous la deuxième page » : position > 20, au moins 5 impressions →
 *   faible (« Accueil sous la première page », moyenne, pour l'accueil) ;
 * - « Page en baisse » : 3 places perdues ou plus (au moins 3 impressions),
 *   ou impressions en baisse de 30 % ou plus (au moins 10 la période précédente) → moyenne.
 * Exploration : title, description, H1, balise canonique, noindex dans le plan
 * du site, page en erreur, lien interne cassé (haute), plan du site pas à jour (moyenne).
 *
 * Les règles Search Console écartent les pages que la dernière exploration
 * connaît redirigées, en erreur ou absentes du plan du site ; une page disparue
 * de la période courante n'est « en baisse » que si l'exploration l'a lue en 200.
 *
 * Les pages métier × ville (noindex par décision) ne donnent aucun constat.
 * Une requête qui cite une marque (la nôtre ou un concurrent) n'est jamais
 * reprise dans une consigne.
 */
import type { FindingSeverity, FindingSource, PageType } from "@/lib/seo/types"
import type { DateRange } from "@/lib/seo/period"
import { pageTypeOf, toSitePath } from "@/lib/seo/site"
import { fmtCount, fmtPosition, fmtRate, ctrOf, NBSP } from "@/lib/seo/format"
import { findCompetitorMentions } from "@/lib/seo/competitors"
import { GEO_PAGE_PATTERN, isPagePath, textLength } from "@/lib/seo/audit/html"
import { DESCRIPTION_MAX, DESCRIPTION_MIN, TITLE_MAX, type CrawlPageRow, type CrawlSummary } from "@/lib/seo/audit/checks"

/* ------------------------------------------------------------------ */
/* Règles                                                              */
/* ------------------------------------------------------------------ */

export type FindingRule =
  | "gsc-no-click"
  | "gsc-second-page"
  | "gsc-beyond-second-page"
  | "gsc-declining"
  | "crawl-title"
  | "crawl-description"
  | "crawl-h1"
  | "crawl-canonical"
  | "crawl-noindex"
  | "crawl-http"
  | "crawl-broken-link"
  | "crawl-sitemap"

export interface RuleDef {
  /** Nom générique de la règle (le titre d'un constat peut être plus précis). */
  label: string
  source: FindingSource
  /** Durée estimée de la correction (minutes). */
  effort: number
}

export const RULES: Record<FindingRule, RuleDef> = {
  "gsc-no-click": { label: "Page bien classée sans clic", source: "search_console", effort: 30 },
  "gsc-second-page": { label: "Page en deuxième page", source: "search_console", effort: 45 },
  "gsc-beyond-second-page": { label: "Page sous la deuxième page", source: "search_console", effort: 20 },
  "gsc-declining": { label: "Page en baisse", source: "search_console", effort: 45 },
  "crawl-title": { label: "Title à corriger", source: "crawl", effort: 15 },
  "crawl-description": { label: "Description à corriger", source: "crawl", effort: 15 },
  "crawl-h1": { label: "H1 à corriger", source: "crawl", effort: 20 },
  "crawl-canonical": { label: "Balise canonique à corriger", source: "crawl", effort: 20 },
  "crawl-noindex": { label: "Page du plan du site en noindex", source: "crawl", effort: 20 },
  "crawl-http": { label: "Page du plan du site en erreur", source: "crawl", effort: 20 },
  "crawl-broken-link": { label: "Lien interne cassé", source: "crawl", effort: 15 },
  "crawl-sitemap": { label: "Plan du site pas à jour", source: "crawl", effort: 30 },
}

export const GSC_RULES: FindingRule[] = ["gsc-no-click", "gsc-second-page", "gsc-beyond-second-page", "gsc-declining"]
export const CRAWL_PAGE_RULES: FindingRule[] = ["crawl-title", "crawl-description", "crawl-h1", "crawl-canonical", "crawl-noindex", "crawl-http"]
export const CRAWL_RULES: FindingRule[] = [...CRAWL_PAGE_RULES, "crawl-broken-link", "crawl-sitemap"]

export function isFindingRule(value: unknown): value is FindingRule {
  return typeof value === "string" && Object.prototype.hasOwnProperty.call(RULES, value)
}

export const THRESHOLDS = {
  noClick: { maxPosition: 10, minImpressions: 3, high: 50, medium: 10 },
  secondPage: { minImpressions: 5 },
  beyond: { minImpressions: 5 },
  decline: { positionLoss: 3, minCurrentImpressions: 3, impressionsDrop: 0.3, minPreviousImpressions: 10 },
} as const

/** Chemin du plan du site (constat « Plan du site pas à jour »). */
export const SITEMAP_FINDING_PATH = "/sitemap.xml"

/* ------------------------------------------------------------------ */
/* Entrées et sorties                                                  */
/* ------------------------------------------------------------------ */

export interface PageStat {
  clicks: number
  impressions: number
  /** Position moyenne pondérée ; null sans impression. */
  position: number | null
}

export interface QueryStat extends PageStat {
  query: string
}

export interface GscInput {
  current: Record<string, PageStat>
  previous: Record<string, PageStat>
  period: { current: DateRange; previous: DateRange }
  /** Requêtes de chaque page sur la période courante, les plus vues d'abord. */
  queries?: Record<string, QueryStat[]>
}

export type CrawlPageInput = Pick<
  CrawlPageRow,
  "path" | "status_code" | "redirect_to" | "title" | "description" | "h1_count" | "canonical" | "robots" | "noindex" | "issues" | "error"
>

export interface CrawlInput {
  runId: string
  finishedAt: string | null
  pages: CrawlPageInput[]
  summary: CrawlSummary | null
}

export interface FindingCandidate {
  rule: FindingRule
  path: string
  page_type: PageType
  title: string
  explanation: string
  recommendation: string
  severity: FindingSeverity
  source: FindingSource
  effort_minutes: number
  metrics: Record<string, unknown>
}

/* ------------------------------------------------------------------ */
/* Textes                                                              */
/* ------------------------------------------------------------------ */

const nb = (n: number, one: string, many = `${one}s`) => `${fmtCount(n)}${NBSP}${n > 1 ? many : one}`
const quoted = (s: string) => `«${NBSP}${s}${NBSP}»`

/** « 122 impressions, 0 clic, position 6,2 ». */
export function statLine(s: PageStat): string {
  return `${nb(s.impressions, "impression")}, ${nb(s.clicks, "clic")}, position ${fmtPosition(s.position)}`
}

const SEVERITY_RANK: Record<FindingSeverity, number> = { high: 3, medium: 2, low: 1 }

function normalize(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase()
}

/**
 * Requête principale d'une page, citable dans une consigne : la plus vue qui
 * ne contient ni un terme de marque ni un concurrent.
 */
export function mainQuery(queries: QueryStat[] | undefined, opts: { brandTerms?: string[]; competitors?: string[] } = {}): QueryStat | null {
  if (!queries || queries.length === 0) return null
  const brands = (opts.brandTerms ?? []).map(normalize).filter((t) => t.length >= 3)
  const competitors = opts.competitors ?? []
  return (
    queries.find((q) => {
      const n = normalize(q.query)
      if (brands.some((b) => n.includes(b.replace(/\.[a-z]+$/, "")))) return false
      return findCompetitorMentions(q.query, competitors).length === 0
    }) ?? null
  )
}

/* ------------------------------------------------------------------ */
/* Search Console                                                      */
/* ------------------------------------------------------------------ */

const EMPTY: PageStat = { clicks: 0, impressions: 0, position: null }

/** Vrai si une page entre dans les règles (pages du site, hors noindex par décision). */
export function isRulePath(path: string): boolean {
  return isPagePath(path) && !GEO_PAGE_PATTERN.test(path)
}

function gscCandidates(
  path: string,
  cur: PageStat,
  prev: PageStat | null,
  ctx: { query: QueryStat | null; period: GscInput["period"]; crawlPage: CrawlPageInput | undefined },
): FindingCandidate[] {
  const out: FindingCandidate[] = []
  const pageType = pageTypeOf(path)
  const isHome = path === "/"
  const q = ctx.query ? quoted(ctx.query.query) : null
  const metrics: Record<string, unknown> = {
    impressions: cur.impressions,
    clicks: cur.clicks,
    ctr: ctrOf(cur.clicks, cur.impressions),
    position: cur.position,
    period: ctx.period.current,
    previous: prev ? { ...prev, ctr: ctrOf(prev.clicks, prev.impressions), period: ctx.period.previous } : null,
    topQuery: ctx.query?.query ?? null,
    title: ctx.crawlPage?.title ?? null,
    description: ctx.crawlPage?.description ?? null,
  }
  const base = (rule: FindingRule) => ({ rule, path, page_type: pageType, source: RULES[rule].source, metrics })

  const pos = cur.position
  const t = THRESHOLDS
  if (pos !== null && pos <= t.noClick.maxPosition && cur.impressions >= t.noClick.minImpressions && cur.clicks === 0) {
    out.push({
      ...base("gsc-no-click"),
      title: RULES["gsc-no-click"].label,
      explanation: statLine(cur),
      recommendation: q
        ? `Réécrire le title pour qu'il commence par ${q}, la requête la plus vue de la page, et préciser le bénéfice dans la description.`
        : "Réécrire le title et la description pour donner envie de cliquer : annoncer dès les premiers mots ce que la page apporte.",
      severity: cur.impressions >= t.noClick.high ? "high" : cur.impressions >= t.noClick.medium ? "medium" : "low",
      effort_minutes: RULES["gsc-no-click"].effort,
    })
  }
  if (pos !== null && pos > 10 && pos <= 20 && cur.impressions >= t.secondPage.minImpressions) {
    out.push({
      ...base("gsc-second-page"),
      title: RULES["gsc-second-page"].label,
      explanation: statLine(cur),
      recommendation: q
        ? `Renforcer la page sur ${q} : y répondre directement dès le premier écran, compléter le contenu et ajouter des liens depuis les guides proches.`
        : "Renforcer la page sur sa requête principale : y répondre directement dès le premier écran, compléter le contenu et ajouter des liens depuis les guides proches.",
      severity: "medium",
      effort_minutes: RULES["gsc-second-page"].effort,
    })
  }
  if (pos !== null && pos > 20 && cur.impressions >= t.beyond.minImpressions) {
    out.push({
      ...base("gsc-beyond-second-page"),
      title: isHome ? "Accueil sous la première page" : RULES["gsc-beyond-second-page"].label,
      explanation: statLine(cur),
      recommendation: isHome
        ? q
          ? `Renforcer le title et le premier écran autour de ${q}.`
          : "Renforcer le title et le premier écran autour de la requête visée par l'accueil."
        : q
          ? `Ajouter une réponse directe à ${q} et des liens internes vers cette page depuis les pages proches.`
          : "Ajouter une réponse directe à la requête de la page et des liens internes vers elle depuis les pages proches.",
      severity: isHome ? "medium" : "low",
      effort_minutes: isHome ? 30 : RULES["gsc-beyond-second-page"].effort,
    })
  }
  if (prev) {
    const lost = pos !== null && prev.position !== null && cur.impressions >= t.decline.minCurrentImpressions ? pos - prev.position : null
    const dropped = prev.impressions >= t.decline.minPreviousImpressions && cur.impressions <= prev.impressions * (1 - t.decline.impressionsDrop)
    if ((lost !== null && lost >= t.decline.positionLoss) || dropped) {
      const parts = [
        `position ${fmtPosition(pos)}${prev.position !== null ? ` (${fmtPosition(prev.position)} avant)` : ""}`,
        `${nb(cur.impressions, "impression")} (${fmtCount(prev.impressions)} avant)`,
        nb(cur.clicks, "clic"),
      ]
      out.push({
        ...base("gsc-declining"),
        title: RULES["gsc-declining"].label,
        explanation: parts.join(", "),
        recommendation: q
          ? `Vérifier que la page répond toujours à ${q} : mettre à jour le contenu et sa date de vérification, renforcer les liens internes vers elle.`
          : "Vérifier que la page répond toujours à sa requête principale : mettre à jour le contenu et sa date de vérification, renforcer les liens internes vers elle.",
        severity: "medium",
        effort_minutes: RULES["gsc-declining"].effort,
      })
    }
  }
  return out
}

/** À gravité égale : la baisse d'abord, puis l'absence de clic, la deuxième page, au-delà. */
const GSC_PRECEDENCE: FindingRule[] = ["gsc-declining", "gsc-no-click", "gsc-second-page", "gsc-beyond-second-page"]

function pickOne(candidates: FindingCandidate[]): FindingCandidate | null {
  if (candidates.length === 0) return null
  return candidates
    .slice()
    .sort((a, b) => SEVERITY_RANK[b.severity] - SEVERITY_RANK[a.severity] || GSC_PRECEDENCE.indexOf(a.rule) - GSC_PRECEDENCE.indexOf(b.rule))[0]
}

/* ------------------------------------------------------------------ */
/* Exploration                                                         */
/* ------------------------------------------------------------------ */

function crawlPageCandidates(page: CrawlPageInput): FindingCandidate[] {
  const path = toSitePath(page.path) ?? page.path
  if (!isRulePath(path)) return []
  const issues = page.issues ?? []
  const pageType = pageTypeOf(path)
  const titleLen = textLength(page.title)
  const descLen = textLength(page.description)
  const metrics = {
    title: page.title,
    description: page.description,
    titleLength: page.title ? titleLen : null,
    descriptionLength: page.description ? descLen : null,
    h1Count: page.h1_count,
    canonical: page.canonical,
    robots: page.robots,
    status: page.status_code,
    redirectTo: page.redirect_to,
  }
  const make = (rule: FindingRule, title: string, explanation: string, recommendation: string, severity: FindingSeverity): FindingCandidate => ({
    rule,
    path,
    page_type: pageType,
    title,
    explanation,
    recommendation,
    severity,
    source: "crawl",
    effort_minutes: RULES[rule].effort,
    metrics,
  })
  const out: FindingCandidate[] = []

  if (issues.includes("http_error") || issues.includes("fetch_failed")) {
    const failed = issues.includes("fetch_failed")
    out.push(
      make(
        "crawl-http",
        "Page du plan du site en erreur",
        failed ? `Pas de réponse : ${page.error ?? "requête impossible"}` : `Réponse ${page.status_code}`,
        "Rétablir la page, ou la retirer du plan du site et rediriger son adresse vers la page qui la remplace.",
        failed ? "medium" : "high",
      ),
    )
  }
  if (issues.includes("redirect")) {
    out.push(
      make(
        "crawl-http",
        "Page du plan du site redirigée",
        `Redirection ${page.status_code ?? ""}${page.redirect_to ? ` vers ${page.redirect_to}` : ""}`.replace(/\s+$/, ""),
        "Remplacer dans le plan du site l'adresse redirigée par l'adresse finale.",
        "low",
      ),
    )
  }
  if (issues.includes("noindex")) {
    out.push(
      make(
        "crawl-noindex",
        "Page du plan du site en noindex",
        `Directive robots : ${page.robots ?? "noindex"}`,
        "Retirer la page du plan du site si son exclusion de Google est voulue ; sinon, retirer la directive noindex.",
        "high",
      ),
    )
  }
  if (issues.includes("title_missing")) {
    out.push(make("crawl-title", "Title absent", "Aucune balise title", `Ajouter un title de ${TITLE_MAX} caractères au plus, la requête principale au début.`, "medium"))
  } else if (issues.includes("title_too_long")) {
    out.push(
      make(
        "crawl-title",
        "Title trop long",
        `${nb(titleLen, "caractère")} (${TITLE_MAX} au plus)`,
        `Raccourcir le title à ${TITLE_MAX} caractères au plus, suffixe ${quoted("| Qonforme")} compris, en gardant la requête principale au début.`,
        "low",
      ),
    )
  }
  if (issues.includes("description_missing")) {
    out.push(
      make(
        "crawl-description",
        "Description absente",
        "Aucune meta description",
        `Écrire une description de ${DESCRIPTION_MIN} à ${DESCRIPTION_MAX} caractères : une ou deux phrases qui répondent à la recherche.`,
        "medium",
      ),
    )
  } else if (issues.includes("description_short") || issues.includes("description_long")) {
    const short = issues.includes("description_short")
    out.push(
      make(
        "crawl-description",
        short ? "Description trop courte" : "Description trop longue",
        `${nb(descLen, "caractère")} (${DESCRIPTION_MIN} à ${DESCRIPTION_MAX})`,
        short
          ? `Compléter la description jusqu'à ${DESCRIPTION_MIN} à ${DESCRIPTION_MAX} caractères : préciser ce que la page apporte.`
          : `Raccourcir la description à ${DESCRIPTION_MAX} caractères au plus, l'essentiel dans la première phrase.`,
        "low",
      ),
    )
  }
  if (issues.includes("h1_missing")) {
    out.push(make("crawl-h1", "H1 absent", "Aucune balise H1", "Ajouter un titre H1 unique qui annonce le sujet de la page.", "medium"))
  } else if (issues.includes("h1_multiple")) {
    out.push(
      make("crawl-h1", "Plusieurs H1 sur la page", `${fmtCount(page.h1_count ?? 0)}${NBSP}balises H1`, "Garder un seul H1 et passer les autres titres en H2.", "medium"),
    )
  }
  if (issues.includes("canonical_missing")) {
    out.push(
      make(
        "crawl-canonical",
        "Balise canonique absente",
        "Aucune balise canonique",
        "Déclarer l'adresse canonique de la page (alternates.canonical dans ses métadonnées).",
        "medium",
      ),
    )
  } else if (issues.includes("canonical_other")) {
    out.push(
      make(
        "crawl-canonical",
        "Balise canonique vers une autre page",
        `Pointe vers ${toSitePath(page.canonical ?? "") ?? page.canonical ?? "une autre adresse"}`,
        "Faire pointer la balise canonique sur la page elle-même, ou retirer la page du plan du site si elle double une autre page.",
        "high",
      ),
    )
  }
  return out
}

function crawlSiteCandidates(summary: CrawlSummary): FindingCandidate[] {
  const out: FindingCandidate[] = []
  summary.checks.links.broken.forEach((b) => {
    const path = toSitePath(b.path) ?? b.path
    if (!isRulePath(path)) return
    out.push({
      rule: "crawl-broken-link",
      path,
      page_type: pageTypeOf(path),
      title: RULES["crawl-broken-link"].label,
      explanation: `Erreur ${b.status}, lien présent sur ${nb(b.fromCount, "page")}`,
      recommendation: "Corriger ou retirer le lien sur les pages qui le contiennent, ou rediriger l'adresse vers la bonne page.",
      severity: "high",
      source: "crawl",
      effort_minutes: RULES["crawl-broken-link"].effort,
      metrics: { status: b.status, from: b.from, fromCount: b.fromCount },
    })
  })
  const fresh = summary.checks.sitemapFresh
  if (!fresh.error && fresh.missing.length > 0) {
    out.push({
      rule: "crawl-sitemap",
      path: SITEMAP_FINDING_PATH,
      page_type: "autre",
      title: RULES["crawl-sitemap"].label,
      explanation: `${nb(fresh.missing.length, "article publié absent", "articles publiés absents")} du plan du site`,
      recommendation: "Vérifier que le plan du site se recalcule après une publication (revalidation de /sitemap.xml), puis relancer l'analyse du site.",
      severity: "medium",
      source: "crawl",
      effort_minutes: RULES["crawl-sitemap"].effort,
      metrics: { missing: fresh.missing, checked: fresh.checked },
    })
  }
  return out
}

/* ------------------------------------------------------------------ */
/* Évaluation                                                          */
/* ------------------------------------------------------------------ */

/**
 * État d'une page d'après la dernière exploration terminée :
 * - « ok » : page du plan du site lue en 200 ;
 * - « gone » : redirigée ou en erreur 4xx, ou lien interne cassé (4xx) ;
 * - « unreadable » : sans réponse (délai dépassé) ou en erreur 5xx : état
 *   passager, la page n'est pas jugée ;
 * - « unlisted » : absente du plan du site (le plan liste toutes les pages
 *   publiques : une page qui n'y est plus a été retirée ou redirigée) ;
 * - « unknown » : aucune exploration terminée, ou aucune page explorée.
 */
export type CrawlState = "ok" | "gone" | "unreadable" | "unlisted" | "unknown"

const isServerError = (status: number | null | undefined) => typeof status === "number" && status >= 500

export function crawlStateOf(path: string, crawl: CrawlInput | null, byPath?: Map<string, CrawlPageInput>): CrawlState {
  // Sans exploration terminée (ou exploration vide), l'état de la page n'est pas connu.
  if (!crawl || crawl.pages.length === 0) return "unknown"
  const page = byPath ? byPath.get(path) : crawl.pages.find((p) => (toSitePath(p.path) ?? p.path) === path)
  if (page) {
    const issues = page.issues ?? []
    if (issues.includes("fetch_failed") || page.status_code === null || isServerError(page.status_code)) return "unreadable"
    const failed = issues.includes("http_error") || issues.includes("redirect")
    return page.status_code === 200 && !failed ? "ok" : "gone"
  }
  const broken = crawl.summary?.checks.links.broken.find((b) => (toSitePath(b.path) ?? b.path) === path)
  if (broken) return isServerError(broken.status) ? "unreadable" : "gone"
  return "unlisted"
}

/** Réponse 200 en HTML : seule réponse sur laquelle les règles de contenu sont jugées. */
function isHtml200(page: CrawlPageInput): boolean {
  const issues = page.issues ?? []
  return page.status_code === 200 && !["fetch_failed", "http_error", "redirect", "not_html"].some((i) => issues.includes(i))
}

const CONTENT_RULES: FindingRule[] = ["crawl-title", "crawl-description", "crawl-h1", "crawl-canonical"]

export interface RuleEvaluation {
  /** Constats à créer ou mettre à jour : une seule règle Search Console par page (la plus grave). */
  chosen: FindingCandidate[]
  /** Toutes les règles vraies du passage, plusieurs règles Search Console par page comprises. */
  valid: FindingCandidate[]
  /**
   * Vrai si la règle a réellement été jugée sur cette page pendant le passage.
   * Un constat ouvert ne se résout que si sa règle a été jugée et n'est plus vraie.
   */
  isEvaluated: (rule: string, path: string) => boolean
  /**
   * Motif de résolution sans évaluation de la règle (affiché dans l'historique),
   * ou null : « Page retirée du plan du site » pour un constat de title,
   * description, H1 ou balise canonique quand le plan du site, lu avec succès
   * par cette exploration, ne liste plus la page.
   */
  outOfScope: (rule: string, path: string) => string | null
}

/** Motif de l'historique d'un constat de contenu dont la page a quitté le plan du site. */
export const RETIRED_FROM_SITEMAP_NOTE = "Page retirée du plan du site"

/** Groupe exclusif d'un constat : une seule règle Search Console par page. */
export function exclusiveGroupOf(c: { rule: string; path: string }): string | null {
  return (GSC_RULES as string[]).includes(c.rule) ? `gsc|${c.path}` : null
}

function oneByKey(list: FindingCandidate[]): FindingCandidate[] {
  // Un seul constat par règle et par page (le plus grave).
  const byKey = new Map<string, FindingCandidate>()
  list.forEach((c) => {
    const key = `${c.rule}|${c.path}`
    const prev = byKey.get(key)
    if (!prev || SEVERITY_RANK[c.severity] > SEVERITY_RANK[prev.severity]) byKey.set(key, c)
  })
  return Array.from(byKey.values())
}

/**
 * Évaluation complète d'un passage : constats retenus, toutes les règles
 * vraies, et règles réellement jugées par page (pour la résolution).
 */
export function evaluateRuleSet(input: {
  gsc: GscInput | null
  crawl: CrawlInput | null
  brandTerms?: string[]
  competitors?: string[]
}): RuleEvaluation {
  const chosen: FindingCandidate[] = []
  const valid: FindingCandidate[] = []
  const crawlByPath = new Map<string, CrawlPageInput>()
  input.crawl?.pages.forEach((p) => crawlByPath.set(toSitePath(p.path) ?? p.path, p))
  const currentPaths = new Set<string>()

  if (input.gsc) {
    const gsc = input.gsc
    Object.keys(gsc.current).forEach((p) => currentPaths.add(toSitePath(p) ?? p))
    const paths = new Set<string>()
    Object.keys(gsc.current).forEach((p) => paths.add(p))
    Object.keys(gsc.previous).forEach((p) => paths.add(p))
    Array.from(paths)
      .sort()
      .forEach((raw) => {
        const path = toSitePath(raw)
        if (!path || !isRulePath(path)) return
        const state = crawlStateOf(path, input.crawl, crawlByPath)
        // Page redirigée, en erreur, injoignable ou retirée du plan du site : rien à optimiser (ex. /comparatif → /pricing).
        if (state === "gone" || state === "unreadable" || state === "unlisted") return
        // Disparue de la période courante : en baisse seulement si l'exploration l'a lue en 200.
        if (!gsc.current[raw] && state !== "ok") return
        const cur = gsc.current[raw] ?? EMPTY
        const prev = gsc.previous[raw] ?? null
        const query = mainQuery(gsc.queries?.[raw] ?? gsc.queries?.[path], { brandTerms: input.brandTerms, competitors: input.competitors })
        const all = gscCandidates(path, cur, prev, { query, period: gsc.period, crawlPage: crawlByPath.get(path) })
        all.forEach((c) => valid.push(c))
        const one = pickOne(all)
        if (one) chosen.push(one)
      })
  }

  if (input.crawl) {
    const crawlList: FindingCandidate[] = []
    input.crawl.pages.forEach((p) => crawlPageCandidates(p).forEach((c) => crawlList.push(c)))
    if (input.crawl.summary) crawlSiteCandidates(input.crawl.summary).forEach((c) => crawlList.push(c))
    crawlList.forEach((c) => {
      chosen.push(c)
      valid.push(c)
    })
  }

  const rules = new Set<string>(evaluatedRules({ gsc: Boolean(input.gsc), crawl: input.crawl }))
  const unverifiedLinks = new Set<string>(
    (input.crawl?.summary?.checks.links.unverified ?? []).map((p) => toSitePath(p) ?? p),
  )
  const isEvaluated = (rule: string, rawPath: string): boolean => {
    if (!rules.has(rule)) return false
    const path = toSitePath(rawPath) ?? rawPath
    if ((GSC_RULES as string[]).includes(rule)) {
      const state = crawlStateOf(path, input.crawl, crawlByPath)
      // Page sans réponse ou en 5xx : la page n'est pas jugée, ses constats restent.
      if (state === "unreadable") return false
      // Disparue de la période courante sans exploration pour confirmer : la baisse n'est pas jugée.
      if (rule === "gsc-declining" && !currentPaths.has(path) && state === "unknown") return false
      return true
    }
    const page = crawlByPath.get(path)
    switch (rule) {
      case "crawl-http":
        // Jugé sur toute page du plan du site ; une page qui n'y est plus n'est plus « du plan du site ».
        return true
      case "crawl-noindex":
        return page ? isHtml200(page) : true
      case "crawl-broken-link":
        // Seulement si le lien a été revérifié (synthèse récente, statut connu ou lien disparu des pages).
        return Array.isArray(input.crawl?.summary?.checks.links.unverified) && !unverifiedLinks.has(path)
      case "crawl-sitemap":
        return true
      default:
        // Title, description, H1, balise canonique : jugés seulement sur une réponse 200 HTML
        // indexable de la page (délai dépassé, 5xx, redirection, noindex ou page absente : non jugés).
        if (!(CONTENT_RULES as string[]).includes(rule) || !page) return false
        return isHtml200(page) && !(page.issues ?? []).includes("noindex")
    }
  }

  // Une exploration terminée a lu le plan du site avec succès (sinon elle échoue) ;
  // une exploration vide n'est pas tenue pour une lecture du plan du site.
  const sitemapRead = Boolean(input.crawl && input.crawl.pages.length > 0)
  const outOfScope = (rule: string, rawPath: string): string | null => {
    if (!sitemapRead || !rules.has(rule) || !(CONTENT_RULES as string[]).includes(rule)) return null
    const path = toSitePath(rawPath) ?? rawPath
    return crawlByPath.has(path) ? null : RETIRED_FROM_SITEMAP_NOTE
  }

  return { chosen: oneByKey(chosen), valid: oneByKey(valid), isEvaluated, outOfScope }
}

/** Constats du moment (une seule règle Search Console par page). Sans Search Console, seules les règles d'exploration s'appliquent. */
export function evaluateRules(input: {
  gsc: GscInput | null
  crawl: CrawlInput | null
  brandTerms?: string[]
  competitors?: string[]
}): FindingCandidate[] {
  return evaluateRuleSet(input).chosen
}

/** Règles évaluées par un passage : seules leurs constats ouverts peuvent se résoudre. */
export function evaluatedRules(input: { gsc: boolean; crawl: CrawlInput | null }): FindingRule[] {
  const rules: FindingRule[] = []
  if (input.gsc) GSC_RULES.forEach((r) => rules.push(r))
  if (input.crawl) {
    CRAWL_PAGE_RULES.forEach((r) => rules.push(r))
    if (input.crawl.summary) {
      rules.push("crawl-broken-link")
      if (!input.crawl.summary.checks.sitemapFresh.error) rules.push("crawl-sitemap")
    }
  }
  return rules
}

/* ------------------------------------------------------------------ */
/* Textes du détail                                                    */
/* ------------------------------------------------------------------ */

type Metrics = Record<string, unknown>
const num = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null)

/** « Pourquoi » : deux phrases chiffrées qui expliquent le constat. */
export function whyOf(rule: string, metrics: Metrics, title?: string): string {
  const impressions = num(metrics.impressions)
  const clicks = num(metrics.clicks)
  const position = num(metrics.position)
  const prev = (metrics.previous ?? null) as Metrics | null
  switch (rule) {
    case "gsc-no-click":
      return `Avec ${nb(impressions ?? 0, "impression")} et une position de ${fmtPosition(position)}, la page est bien classée : elle s'affiche en première page de Google. Mais aucun clic n'a été enregistré, ce qui laisse penser que le titre et la description du résultat ne donnent pas envie d'ouvrir la page.`
    case "gsc-second-page":
      return `Avec une position moyenne de ${fmtPosition(position)}, la page s'affiche en deuxième page de Google, où peu de personnes vont chercher. Quelques places gagnées suffiraient à la faire passer en première page.`
    case "gsc-beyond-second-page":
      return `Avec une position moyenne de ${fmtPosition(position)}, la page s'affiche au-delà de la deuxième page de Google : elle est vue (${nb(impressions ?? 0, "impression")}) mais presque jamais atteinte.`
    case "gsc-declining": {
      const pp = prev ? num(prev.position) : null
      const pi = prev ? num(prev.impressions) : null
      const facts: string[] = []
      if (pp !== null && position !== null && position - pp >= THRESHOLDS.decline.positionLoss) {
        facts.push(`elle a perdu ${fmtPosition(position - pp)}${NBSP}places (de ${fmtPosition(pp)} à ${fmtPosition(position)})`)
      }
      if (pi !== null && impressions !== null && pi > 0 && impressions < pi) {
        facts.push(`ses impressions ont baissé de ${fmtRate((pi - impressions) / pi, 0)} (${fmtCount(pi)} → ${fmtCount(impressions)})`)
      }
      return `Par rapport aux 28 jours précédents, ${facts.length > 0 ? facts.join(" et ") : "la page recule"}. Une baisse qui dure signale souvent un contenu moins à jour ou moins complet que les autres résultats sur la même requête.`
    }
    case "crawl-title": {
      const len = num(metrics.titleLength)
      return len === null
        ? "La page n'a pas de balise title : Google en fabrique une à partir du contenu, souvent moins claire que le titre que vous choisiriez."
        : `Le title fait ${nb(len, "caractère")} : Google le coupe au-delà d'environ ${TITLE_MAX} caractères, et la fin du titre n'apparaît pas dans les résultats.`
    }
    case "crawl-description": {
      const len = num(metrics.descriptionLength)
      return len === null
        ? "La page n'a pas de meta description : Google choisit lui-même un extrait de la page, qui ne présente pas toujours ce qu'elle apporte."
        : `La description fait ${nb(len, "caractère")}. Trop courte, elle laisse Google choisir un extrait de la page ; au-delà de ${DESCRIPTION_MAX} caractères, elle est coupée dans les résultats.`
    }
    case "crawl-h1": {
      const n = num(metrics.h1Count) ?? 0
      return `La page a ${nb(n, "balise H1", "balises H1")}. Un seul H1 annonce clairement le sujet de la page aux moteurs de recherche et aux lecteurs d'écran.`
    }
    case "crawl-canonical":
      return metrics.canonical
        ? "La balise canonique désigne une autre adresse : Google risque de ne pas indexer cette page et de lui préférer l'adresse indiquée."
        : "Sans balise canonique, Google choisit lui-même l'adresse de référence quand une page est accessible par plusieurs adresses."
    case "crawl-noindex":
      return "La page figure dans le plan du site mais demande à ne pas être indexée (noindex) : les deux signaux se contredisent, et Google ne montrera pas la page."
    case "crawl-http":
      return title === "Page du plan du site redirigée"
        ? "Le plan du site doit lister les adresses finales : une adresse redirigée fait faire un détour à Google à chaque passage."
        : "Une page du plan du site qui ne répond pas, ou répond par une erreur, fait perdre à Google le temps qu'il consacre au site et finit par sortir de l'index."
    case "crawl-broken-link": {
      const fromCount = num(metrics.fromCount) ?? 0
      const status = num(metrics.status)
      return `Cette adresse répond par une erreur${status !== null ? ` ${status}` : ""} alors que ${nb(fromCount, "page du site la cite", "pages du site la citent")} : les visiteurs et Google tombent sur une impasse.`
    }
    case "crawl-sitemap":
      return "Des articles publiés manquent au plan du site lu au début de l'exploration : Google les découvrira plus tard, faute de les y trouver."
    default:
      return clicks !== null || impressions !== null ? `${statLine({ clicks: clicks ?? 0, impressions: impressions ?? 0, position })}.` : ""
  }
}

/** Texte de « Copier la consigne ». */
export function consigneOf(finding: {
  path: string
  title: string
  explanation: string | null
  recommendation: string | null
  metrics: Metrics
}): string {
  const lines = [
    `Page : https://qonforme.fr${finding.path === "/" ? "/" : finding.path}`,
    `Constat : ${finding.title}${finding.explanation ? ` (${finding.explanation})` : ""}`,
  ]
  if (finding.recommendation) lines.push(`Action : ${finding.recommendation}`)
  if (typeof finding.metrics.title === "string" && finding.metrics.title) lines.push(`Title actuel : ${finding.metrics.title}`)
  if (typeof finding.metrics.description === "string" && finding.metrics.description) lines.push(`Description actuelle : ${finding.metrics.description}`)
  const missing = finding.metrics.missing as { path: string }[] | undefined
  if (Array.isArray(missing) && missing.length > 0) lines.push(`Articles absents : ${missing.map((m) => m.path).join(", ")}`)
  const from = finding.metrics.from as string[] | undefined
  if (Array.isArray(from) && from.length > 0) lines.push(`Pages qui contiennent le lien : ${from.join(", ")}`)
  return lines.join("\n")
}
