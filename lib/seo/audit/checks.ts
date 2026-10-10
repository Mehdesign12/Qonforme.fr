/**
 * Contrôles de l'audit du site : défauts d'une page et synthèse d'une
 * exploration (carte « Contrôles » de Performance › Audit du site, règles
 * d'exploration de lib/seo/actions/rules.ts).
 *
 * Bornes déjà appliquées au site (lib/seo/meta.ts) : title de 70 caractères
 * au plus, description de 120 à 155 caractères. Module pur.
 */
import { DESCRIPTION_MAX, TITLE_MAX } from "@/lib/seo/meta"
import { toSitePath } from "@/lib/seo/site"
import { GEO_PAGE_PATTERN, textLength, type ParsedPage } from "@/lib/seo/audit/html"

export { TITLE_MAX, DESCRIPTION_MAX }
export const DESCRIPTION_MIN = 120

/** Défauts relevés sur une page (colonne `issues` de seo_crawl_pages). */
export type PageIssue =
  | "fetch_failed"
  | "http_error"
  | "redirect"
  | "not_html"
  | "noindex"
  | "title_missing"
  | "title_too_long"
  | "description_missing"
  | "description_short"
  | "description_long"
  | "h1_missing"
  | "h1_multiple"
  | "canonical_missing"
  | "canonical_other"

/** Ligne de seo_crawl_pages. */
export interface CrawlPageRow {
  run_id: string
  path: string
  status_code: number | null
  redirect_to: string | null
  title: string | null
  description: string | null
  h1_count: number | null
  h1: string | null
  canonical: string | null
  robots: string | null
  noindex: boolean
  internal_links: string[]
  word_count: number | null
  issues: string[]
  fetched_at?: string
  error: string | null
}

/** Défauts d'une page du plan du site d'après sa réponse et son HTML. */
export function pageIssues(input: {
  path: string
  status: number | null
  error?: string | null
  html?: boolean
  parsed: ParsedPage | null
}): PageIssue[] {
  if (input.error || input.status === null) return ["fetch_failed"]
  if (input.status >= 400) return ["http_error"]
  if (input.status >= 300) return ["redirect"]
  if (input.html === false || !input.parsed) return ["not_html"]
  const p = input.parsed
  // Une page exclue de l'index n'a pas à être optimisée : son seul défaut est d'être dans le plan du site.
  if (p.noindex) return ["noindex"]

  const issues: PageIssue[] = []
  if (!p.title) issues.push("title_missing")
  else if (textLength(p.title) > TITLE_MAX) issues.push("title_too_long")

  if (!p.description) issues.push("description_missing")
  else if (textLength(p.description) < DESCRIPTION_MIN) issues.push("description_short")
  else if (textLength(p.description) > DESCRIPTION_MAX) issues.push("description_long")

  if (p.h1Count === 0) issues.push("h1_missing")
  else if (p.h1Count > 1) issues.push("h1_multiple")

  if (!p.canonical) issues.push("canonical_missing")
  else if (toSitePath(p.canonical) !== (toSitePath(input.path) ?? input.path)) issues.push("canonical_other")
  return issues
}

/* ------------------------------------------------------------------ */
/* Synthèse                                                            */
/* ------------------------------------------------------------------ */

/** Résultat de la vérification d'un lien interne hors du plan du site. */
export interface LinkResult {
  status: number | null
  redirectTo?: string | null
  noindex?: boolean
  error?: string | null
}

export interface BrokenLink {
  path: string
  status: number
  /** Pages qui contiennent le lien (5 au plus). */
  from: string[]
  /** Nombre total de pages qui le contiennent. */
  fromCount: number
}

export interface SitemapFreshness {
  /** Articles publiés vérifiés (les 5 derniers). */
  checked: number
  /** Articles publiés depuis plus de 2 h et absents du plan du site. */
  missing: { path: string; title: string | null; publishedAt: string | null }[]
  /** Lecture des articles impossible : contrôle non fait. */
  error: string | null
}

const LIST_MAX = 100

export interface CrawlSummary {
  version: 1
  /** Pages du plan du site lu au début de l'exploration. */
  sitemapPaths: number
  /** Pages appelées. */
  pagesExplored: number
  /** Pages qui répondent 200 en HTML. */
  pagesOk: number
  checks: {
    title: { failing: number; missing: number; tooLong: number; paths: string[] }
    description: { failing: number; missing: number; short: number; long: number; paths: string[] }
    h1: { failing: number; missing: number; multiple: number; paths: string[] }
    canonical: { failing: number; missing: number; other: number; paths: string[] }
    noindexInSitemap: { count: number; paths: string[] }
    errors: { count: number; pages: { path: string; status: number | null; error: string | null }[] }
    redirects: { count: number; pages: { path: string; status: number; redirectTo: string | null }[] }
    links: {
      /** Liens internes distincts dont le statut est connu. */
      tested: number
      broken: BrokenLink[]
      /** Liens internes distincts hors du plan du site. */
      outsideSitemap: number
      /** Liens hors du plan du site vérifiés (150 au plus). */
      checkedOutside: number
      capped: boolean
      /**
       * Liens internes cités par une page mais dont le statut n'a pas été vérifié
       * (au-delà du plafond, ou sans réponse). Un constat « Lien interne cassé » sur
       * l'un d'eux ne se résout pas. Absent des synthèses plus anciennes.
       */
      unverified?: string[]
    }
    sitemapFresh: SitemapFreshness
    /**
     * Pages métier × ville rencontrées par des liens : vérifiées en noindex,
     * indexables (réponse 200 sans noindex : à corriger), redirigées ou en erreur,
     * non vérifiées. Les trois derniers champs manquent aux synthèses plus anciennes.
     */
    noindexByDecision: { encountered: number; verifiedNoindex: number; indexable?: string[]; otherStatus?: number; unverified?: number }
  }
}

function cap<T>(list: T[]): T[] {
  return list.slice(0, LIST_MAX)
}

/** Construit la synthèse d'une exploration terminée. */
export function buildCrawlSummary(input: {
  pages: Pick<CrawlPageRow, "path" | "status_code" | "redirect_to" | "noindex" | "internal_links" | "issues" | "error">[]
  sitemapPaths: string[]
  outsideResults: Record<string, LinkResult>
  outsideTotal: number
  freshness: SitemapFreshness
}): CrawlSummary {
  const { pages } = input
  const has = (row: { issues: string[] }, issue: PageIssue) => row.issues.includes(issue)
  const pathsWith = (...issues: PageIssue[]) => pages.filter((r) => issues.some((i) => has(r, i))).map((r) => r.path)

  const title = { missing: pathsWith("title_missing").length, tooLong: pathsWith("title_too_long").length }
  const description = {
    missing: pathsWith("description_missing").length,
    short: pathsWith("description_short").length,
    long: pathsWith("description_long").length,
  }
  const h1 = { missing: pathsWith("h1_missing").length, multiple: pathsWith("h1_multiple").length }
  const canonical = { missing: pathsWith("canonical_missing").length, other: pathsWith("canonical_other").length }

  // Statut connu de chaque chemin : pages explorées, puis liens vérifiés hors du plan du site.
  const statusOf = new Map<string, LinkResult>()
  pages.forEach((r) => statusOf.set(r.path, { status: r.status_code, redirectTo: r.redirect_to, noindex: r.noindex, error: r.error }))
  Object.keys(input.outsideResults).forEach((p) => {
    if (!statusOf.has(p)) statusOf.set(p, input.outsideResults[p])
  })

  const referrers = new Map<string, string[]>()
  pages.forEach((r) => {
    ;(r.internal_links ?? []).forEach((target) => {
      const list = referrers.get(target)
      if (list) list.push(r.path)
      else referrers.set(target, [r.path])
    })
  })

  let tested = 0
  const broken: BrokenLink[] = []
  const unverified: string[] = []
  let geoEncountered = 0
  let geoNoindex = 0
  let geoOther = 0
  let geoUnverified = 0
  const geoIndexable: string[] = []
  Array.from(referrers.keys()).forEach((target) => {
    const from = (referrers.get(target) ?? []).slice().sort()
    const known = statusOf.get(target)
    if (GEO_PAGE_PATTERN.test(target)) {
      geoEncountered++
      if (!known || known.status === null) geoUnverified++
      else if (known.noindex) geoNoindex++
      else if (known.status === 200) geoIndexable.push(target)
      else geoOther++
    }
    if (!known || known.status === null) {
      unverified.push(target)
      return
    }
    tested++
    if (known.status >= 400) broken.push({ path: target, status: known.status, from: from.slice(0, 5), fromCount: from.length })
  })
  broken.sort((a, b) => b.fromCount - a.fromCount || a.path.localeCompare(b.path))

  const errors = pages
    .filter((r) => has(r, "fetch_failed") || has(r, "http_error"))
    .map((r) => ({ path: r.path, status: r.status_code, error: r.error }))
  const redirects = pages
    .filter((r) => has(r, "redirect"))
    .map((r) => ({ path: r.path, status: r.status_code ?? 0, redirectTo: r.redirect_to }))

  return {
    version: 1,
    sitemapPaths: input.sitemapPaths.length,
    pagesExplored: pages.length,
    pagesOk: pages.filter((r) => r.status_code === 200 && !has(r, "not_html")).length,
    checks: {
      title: { failing: title.missing + title.tooLong, ...title, paths: cap(pathsWith("title_missing", "title_too_long")) },
      description: {
        failing: description.missing + description.short + description.long,
        ...description,
        paths: cap(pathsWith("description_missing", "description_short", "description_long")),
      },
      h1: { failing: h1.missing + h1.multiple, ...h1, paths: cap(pathsWith("h1_missing", "h1_multiple")) },
      canonical: { failing: canonical.missing + canonical.other, ...canonical, paths: cap(pathsWith("canonical_missing", "canonical_other")) },
      noindexInSitemap: { count: pathsWith("noindex").length, paths: cap(pathsWith("noindex")) },
      errors: { count: errors.length, pages: cap(errors) },
      redirects: { count: redirects.length, pages: cap(redirects) },
      links: {
        tested,
        broken: cap(broken),
        outsideSitemap: input.outsideTotal,
        checkedOutside: Object.keys(input.outsideResults).length,
        capped: input.outsideTotal > Object.keys(input.outsideResults).length,
        unverified: unverified.sort(),
      },
      sitemapFresh: input.freshness,
      noindexByDecision: {
        encountered: geoEncountered,
        verifiedNoindex: geoNoindex,
        indexable: geoIndexable.sort(),
        otherStatus: geoOther,
        unverified: geoUnverified,
      },
    },
  }
}

/** Lecture prudente d'une synthèse enregistrée (null si absente ou d'une autre forme). */
export function readSummary(value: unknown): CrawlSummary | null {
  if (!value || typeof value !== "object") return null
  const s = value as Partial<CrawlSummary>
  if (s.version !== 1 || !s.checks) return null
  return s as CrawlSummary
}

/* ------------------------------------------------------------------ */
/* Contrôles affichés                                                  */
/* ------------------------------------------------------------------ */

export type ControlState = "ok" | "alert" | "info" | "unknown"

export interface ControlResult {
  key: "sitemap" | "title" | "description" | "h1" | "canonical" | "links" | "errors" | "noindex" | "noindex_decision"
  name: string
  state: ControlState
  result: string
  details: string[]
  /** Règle de constat correspondante (lien « Voir l'action »). */
  rule: string | null
}

const plural = (n: number, one: string, many = `${one}s`) => `${n.toLocaleString("fr-FR")} ${n > 1 ? many : one}`

/** Lignes de la carte « Contrôles » : alertes d'abord, puis réussites, puis informations. */
export function controlsOf(summary: CrawlSummary): ControlResult[] {
  const c = summary.checks
  const out: ControlResult[] = []

  const fresh = c.sitemapFresh
  out.push(
    fresh.error
      ? { key: "sitemap", name: "Plan du site à jour", state: "unknown", result: "Contrôle non fait : lecture des articles impossible.", details: [], rule: "crawl-sitemap" }
      : fresh.missing.length > 0
        ? {
            key: "sitemap",
            name: "Plan du site à jour",
            state: "alert",
            result: `${plural(fresh.missing.length, "article publié absent", "articles publiés absents")} du plan du site.`,
            details: fresh.missing.map((m) => m.path),
            rule: "crawl-sitemap",
          }
        : {
            key: "sitemap",
            name: "Plan du site à jour",
            state: "ok",
            result: fresh.checked > 0 ? `${fresh.checked > 1 ? `Les ${fresh.checked} derniers articles publiés figurent` : "Le dernier article publié figure"} dans le plan du site.` : "Aucun article publié à vérifier.",
            details: [],
            rule: "crawl-sitemap",
          },
  )

  out.push(
    c.title.failing > 0
      ? {
          key: "title",
          name: `Title de ${TITLE_MAX} caractères au plus`,
          state: "alert",
          result: `${plural(c.title.failing, "page")} à corriger${c.title.missing > 0 ? `, dont ${plural(c.title.missing, "page")} sans title` : ""}.`,
          details: [],
          rule: "crawl-title",
        }
      : { key: "title", name: `Title de ${TITLE_MAX} caractères au plus`, state: "ok", result: "Aucune page au-dessus de la limite.", details: [], rule: "crawl-title" },
  )

  const d = c.description
  const dParts = [
    d.short > 0 ? plural(d.short, "trop courte", "trop courtes") : null,
    d.long > 0 ? plural(d.long, "trop longue", "trop longues") : null,
    d.missing > 0 ? plural(d.missing, "absente", "absentes") : null,
  ].filter(Boolean)
  out.push(
    d.failing > 0
      ? {
          key: "description",
          name: `Description de ${DESCRIPTION_MIN} à ${DESCRIPTION_MAX} caractères`,
          state: "alert",
          result: `${plural(d.failing, "page")} hors de cette fourchette (${dParts.join(", ")}).`,
          details: [],
          rule: "crawl-description",
        }
      : { key: "description", name: `Description de ${DESCRIPTION_MIN} à ${DESCRIPTION_MAX} caractères`, state: "ok", result: "Aucune page hors de cette fourchette.", details: [], rule: "crawl-description" },
  )

  const hParts = [
    c.h1.missing > 0 ? `${plural(c.h1.missing, "page")} sans H1` : null,
    c.h1.multiple > 0 ? `${plural(c.h1.multiple, "page")} avec plusieurs H1` : null,
  ].filter(Boolean)
  out.push(
    c.h1.failing > 0
      ? { key: "h1", name: "Un seul H1 par page", state: "alert", result: `${hParts.join(", ")}.`, details: [], rule: "crawl-h1" }
      : { key: "h1", name: "Un seul H1 par page", state: "ok", result: "Chaque page explorée n'a qu'une seule balise H1.", details: [], rule: "crawl-h1" },
  )

  const kParts = [
    c.canonical.missing > 0 ? `${plural(c.canonical.missing, "page")} sans balise canonique` : null,
    c.canonical.other > 0 ? `${plural(c.canonical.other, "page")} dont la balise pointe vers une autre adresse` : null,
  ].filter(Boolean)
  out.push(
    c.canonical.failing > 0
      ? { key: "canonical", name: "Balise canonique", state: "alert", result: `${kParts.join(", ")}.`, details: [], rule: "crawl-canonical" }
      : { key: "canonical", name: "Balise canonique", state: "ok", result: "Présente sur les pages explorées et pointant sur la page elle-même.", details: [], rule: "crawl-canonical" },
  )

  const l = c.links
  out.push(
    l.broken.length > 0
      ? {
          key: "links",
          name: "Liens internes",
          state: "alert",
          result: `${plural(l.broken.length, "lien cassé", "liens cassés")} sur ${plural(l.tested, "lien testé", "liens testés")}.`,
          details: l.broken.slice(0, 5).map((b) => `${b.path} : erreur ${b.status}, sur ${plural(b.fromCount, "page")}`),
          rule: "crawl-broken-link",
        }
      : {
          key: "links",
          name: "Liens internes",
          state: "ok",
          result: `${plural(l.tested, "lien testé", "liens testés")}, aucun cassé.`,
          details: l.capped ? [`Liens hors du plan du site : ${l.checkedOutside} vérifiés sur ${l.outsideSitemap} (plafond de l'exploration).`] : [],
          rule: "crawl-broken-link",
        },
  )

  const errorCount = c.errors.count + c.redirects.count
  out.push(
    errorCount > 0
      ? {
          key: "errors",
          name: "Pages du plan du site accessibles",
          state: "alert",
          result: [
            c.errors.count > 0 ? `${plural(c.errors.count, "page")} en erreur` : null,
            c.redirects.count > 0 ? `${plural(c.redirects.count, "page redirigée", "pages redirigées")}` : null,
          ]
            .filter(Boolean)
            .join(", ") + ".",
          details: c.errors.pages.slice(0, 5).map((e) => `${e.path} : ${e.status !== null ? `erreur ${e.status}` : e.error ?? "sans réponse"}`),
          rule: "crawl-http",
        }
      : { key: "errors", name: "Pages du plan du site accessibles", state: "ok", result: "Toutes les pages répondent sans erreur ni redirection.", details: [], rule: "crawl-http" },
  )

  out.push(
    c.noindexInSitemap.count > 0
      ? {
          key: "noindex",
          name: "Pages du plan du site indexables",
          state: "alert",
          result: `${plural(c.noindexInSitemap.count, "page")} du plan du site en noindex.`,
          details: c.noindexInSitemap.paths.slice(0, 5),
          rule: "crawl-noindex",
        }
      : { key: "noindex", name: "Pages du plan du site indexables", state: "ok", result: "Aucune page du plan du site n'est exclue de Google.", details: [], rule: "crawl-noindex" },
  )

  out.push(noindexDecisionControl(c.noindexByDecision))

  const rank: Record<ControlState, number> = { alert: 0, unknown: 1, ok: 2, info: 3 }
  return out.map((r, i) => ({ r, i })).sort((a, b) => rank[a.r.state] - rank[b.r.state] || a.i - b.i).map((x) => x.r)
}

/**
 * « Pages en noindex par décision » (pages métier × ville) : seulement ce que
 * l'exploration a vérifié sur les pages citées par des liens du site, jamais
 * une affirmation sur l'index de Google.
 */
export function noindexDecisionControl(geo: CrawlSummary["checks"]["noindexByDecision"]): ControlResult {
  const name = "Pages en noindex par décision"
  const decision = "Décision en vigueur : noindex et hors du plan du site, en attendant un contenu propre à chaque ville. Seules les pages citées par des liens du site sont vérifiées."
  const indexable = geo.indexable ?? []
  // Synthèse plus ancienne : seules les pages vérifiées en noindex sont connues.
  const detailed = Array.isArray(geo.indexable)
  const other = geo.otherStatus ?? 0
  const rest = detailed ? geo.unverified ?? 0 : Math.max(0, geo.encountered - geo.verifiedNoindex)
  const restLabel = detailed ? ["non vérifiée", "non vérifiées"] : ["non confirmée en noindex", "non confirmées en noindex"]

  if (indexable.length > 0) {
    return {
      key: "noindex_decision",
      name,
      state: "alert",
      result: `${plural(indexable.length, "page métier × ville indexable", "pages métier × ville indexables")} (réponse 200 sans noindex) : à corriger.`,
      details: [...indexable.slice(0, 5), "Ajouter la directive noindex à ces pages, comme le veut la décision en vigueur."],
      rule: null,
    }
  }
  if (geo.verifiedNoindex === 0) {
    return {
      key: "noindex_decision",
      name,
      state: "unknown",
      result:
        geo.encountered > 0
          ? `Non vérifié : ${plural(geo.encountered, "page métier × ville rencontrée", "pages métier × ville rencontrées")} par des liens, aucune vérifiée en noindex.`
          : "Non vérifié : aucune page métier × ville rencontrée par des liens.",
      details: [decision],
      rule: null,
    }
  }
  const parts = [
    `${plural(geo.verifiedNoindex, "page métier × ville vérifiée", "pages métier × ville vérifiées")} en noindex`,
    rest > 0 ? `${rest.toLocaleString("fr-FR")} ${rest > 1 ? restLabel[1] : restLabel[0]}` : null,
    other > 0 ? `${plural(other, "redirigée ou en erreur", "redirigées ou en erreur")}` : null,
  ].filter(Boolean)
  return { key: "noindex_decision", name, state: "info", result: `${parts.join(", ")}.`, details: [decision], rule: null }
}

/** « 1 alerte · 5 réussis · 1 information ». */
export function controlsTally(controls: ControlResult[]): string {
  const n = (s: ControlState) => controls.filter((c) => c.state === s).length
  return [
    n("alert") > 0 ? plural(n("alert"), "alerte") : null,
    n("ok") > 0 ? plural(n("ok"), "réussi") : null,
    n("unknown") > 0 ? plural(n("unknown"), "non vérifié", "non vérifiés") : null,
    n("info") > 0 ? plural(n("info"), "information") : null,
  ]
    .filter(Boolean)
    .join(" · ")
}

/** Vrai si le chemin est une page métier × ville (noindex par décision). */
export function isGeoPage(path: string): boolean {
  return GEO_PAGE_PATTERN.test(path)
}
