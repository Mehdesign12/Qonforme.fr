/**
 * Actions SEO : règles (seuils, gravité, une règle par page), constats de
 * l'exploration, mise à jour des constats (un seul ouvert par règle et par
 * page, résolution, délai de 30 jours), échéance de la tâche.
 */
import { describe, expect, it } from "vitest"
import {
  crawlStateOf,
  evaluateRules,
  evaluatedRules,
  mainQuery,
  whyOf,
  consigneOf,
  type CrawlInput,
  type FindingCandidate,
  type GscInput,
  type PageStat,
} from "@/lib/seo/actions/rules"
import { planFindingSync, type ExistingFinding } from "@/lib/seo/actions/sync"
import { isFindingsDue } from "@/lib/seo/actions/refresh"
import { transitionFinding } from "@/lib/seo/actions/transitions"
import { buildCrawlSummary } from "@/lib/seo/audit/checks"
import { NBSP } from "@/lib/seo/format"

const period = { current: { from: "2026-09-07", to: "2026-10-04" }, previous: { from: "2026-08-10", to: "2026-09-06" } }
const gsc = (current: Record<string, PageStat>, previous: Record<string, PageStat> = {}, queries: GscInput["queries"] = {}): GscInput => ({
  current,
  previous,
  period,
  queries,
})
const only = (list: FindingCandidate[], path: string) => list.filter((c) => c.path === path)

describe("règles Search Console", () => {
  it("page bien classée sans clic : gravité selon les impressions", () => {
    const out = evaluateRules({
      gsc: gsc({
        "/modele": { clicks: 0, impressions: 122, position: 6.2 },
        "/facturation/boulanger": { clicks: 0, impressions: 18, position: 9 },
        "/glossaire/arrhes": { clicks: 0, impressions: 4, position: 9.5 },
        "/demo": { clicks: 0, impressions: 2, position: 3 }, // sous 3 impressions : rien
        "/guide/x": { clicks: 1, impressions: 80, position: 4 }, // un clic : rien
      }),
      crawl: null,
    })
    expect(out.map((c) => [c.path, c.rule, c.severity])).toEqual([
      ["/facturation/boulanger", "gsc-no-click", "medium"],
      ["/glossaire/arrhes", "gsc-no-click", "low"],
      ["/modele", "gsc-no-click", "high"],
    ])
    const modele = only(out, "/modele")[0]
    expect(modele.title).toBe("Page bien classée sans clic")
    expect(modele.explanation).toBe(`122${NBSP}impressions, 0${NBSP}clic, position 6,2`)
    expect(modele.effort_minutes).toBe(30)
    expect(modele.source).toBe("search_console")
    expect(modele.page_type).toBe("modele")
  })

  it("deuxième page, au-delà, et l'accueil sous la première page", () => {
    const out = evaluateRules({
      gsc: gsc({
        "/facturation/fleuriste": { clicks: 0, impressions: 10, position: 19.9 },
        "/guide": { clicks: 0, impressions: 5, position: 29.7 },
        "/": { clicks: 0, impressions: 11, position: 32.4 },
        "/guide/peu-vue": { clicks: 0, impressions: 4, position: 14 }, // sous 5 impressions : rien
      }),
      crawl: null,
    })
    expect(only(out, "/facturation/fleuriste")[0]).toMatchObject({ rule: "gsc-second-page", severity: "medium", effort_minutes: 45 })
    expect(only(out, "/guide")[0]).toMatchObject({ rule: "gsc-beyond-second-page", severity: "low", title: "Page sous la deuxième page" })
    expect(only(out, "/")[0]).toMatchObject({ rule: "gsc-beyond-second-page", severity: "medium", title: "Accueil sous la première page" })
    expect(only(out, "/guide/peu-vue")).toEqual([])
  })

  it("page en baisse : 3 places perdues, ou 30 % d'impressions en moins sur au moins 10", () => {
    const out = evaluateRules({
      gsc: gsc(
        {
          "/a": { clicks: 1, impressions: 8, position: 12.5 }, // 9 → 12,5 : en baisse (plutôt que deuxième page)
          "/b": { clicks: 2, impressions: 7, position: 5 }, // 10 → 7 impressions : −30 %
          "/c": { clicks: 2, impressions: 8, position: 5 }, // 10 → 8 : −20 %, rien
          "/d": { clicks: 1, impressions: 2, position: 9 }, // 3 places, mais 2 impressions : trop peu
        },
        {
          "/a": { clicks: 1, impressions: 8, position: 9 },
          "/b": { clicks: 2, impressions: 10, position: 5 },
          "/c": { clicks: 2, impressions: 10, position: 5 },
          "/d": { clicks: 1, impressions: 2, position: 5 },
          "/e": { clicks: 0, impressions: 24, position: 15 }, // disparue de la période courante, sans exploration : rien
        },
      ),
      crawl: null,
    })
    expect(out.map((c) => [c.path, c.rule])).toEqual([
      ["/a", "gsc-declining"],
      ["/b", "gsc-declining"],
    ])
    expect(only(out, "/a")[0].explanation).toBe(`position 12,5 (9,0 avant), 8${NBSP}impressions (8 avant), 1${NBSP}clic`)
  })

  it("une seule règle par page, la plus grave", () => {
    // Bien classée sans clic, 60 impressions (haute) et en baisse (moyenne) : la haute l'emporte.
    const out = evaluateRules({
      gsc: gsc({ "/modele": { clicks: 0, impressions: 60, position: 7 } }, { "/modele": { clicks: 0, impressions: 100, position: 3 } }),
      crawl: null,
    })
    expect(out.map((c) => [c.rule, c.severity])).toEqual([["gsc-no-click", "high"]])
  })

  it("aucune règle pour les pages métier × ville (noindex par décision)", () => {
    const out = evaluateRules({ gsc: gsc({ "/facturation/avocat/strasbourg": { clicks: 0, impressions: 30, position: 8 } }), crawl: null })
    expect(out).toEqual([])
  })

  it("cite la requête principale, jamais une requête de marque ni un concurrent", () => {
    const queries = {
      "/modele": [
        { query: "qonforme modele", clicks: 0, impressions: 60, position: 1 },
        { query: "tolteck devis", clicks: 0, impressions: 50, position: 7 },
        { query: "devis modele", clicks: 0, impressions: 45, position: 2.7 },
      ],
    }
    expect(mainQuery(queries["/modele"], { brandTerms: ["Qonforme", "qonforme.fr"], competitors: ["tolteck.com"] })?.query).toBe("devis modele")
    const out = evaluateRules({
      gsc: gsc({ "/modele": { clicks: 0, impressions: 122, position: 6.2 } }, {}, queries),
      crawl: null,
      brandTerms: ["Qonforme"],
      competitors: ["tolteck.com"],
    })
    expect(out[0].recommendation).toContain(`«${NBSP}devis modele${NBSP}»`)
    expect(out[0].recommendation).not.toMatch(/tolteck|qonforme/i)
    expect(out[0].metrics.topQuery).toBe("devis modele")
  })

  it("explique le constat en deux phrases chiffrées", () => {
    const why = whyOf("gsc-no-click", { impressions: 122, clicks: 0, position: 6.2 })
    expect(why).toContain(`122${NBSP}impressions et une position de 6,2`)
    expect(why).toContain("aucun clic")
  })
})

describe("règles Search Console et état de la page dans l'exploration", () => {
  const page = (path: string, status: number | null, issues: string[], redirectTo: string | null = null): CrawlInput["pages"][number] => ({
    path,
    status_code: status,
    redirect_to: redirectTo,
    title: "Titre",
    description: "d".repeat(130),
    h1_count: 1,
    canonical: `https://qonforme.fr${path}`,
    robots: null,
    noindex: false,
    issues,
    error: status === null ? "délai dépassé" : null,
  })
  const pages = [
    page("/pricing", 200, []),
    page("/guide/actif", 200, []),
    page("/ancien", 301, ["redirect"], "/pricing"),
    page("/disparu", 404, ["http_error"]),
    page("/injoignable", null, ["fetch_failed"]),
  ]
  const summary = buildCrawlSummary({
    pages: pages.map((p) => ({ ...p, internal_links: p.path === "/pricing" ? ["/lien-casse"] : [] })),
    sitemapPaths: pages.map((p) => p.path),
    outsideResults: { "/lien-casse": { status: 410 } },
    outsideTotal: 1,
    freshness: { checked: 5, missing: [], error: null },
  })
  const crawl: CrawlInput = { runId: "run-2", finishedAt: "2026-10-09T03:10:00Z", pages, summary }
  const noClick = { clicks: 0, impressions: 40, position: 6 }
  const before = { clicks: 3, impressions: 90, position: 4 }

  it("écarte les pages redirigées, en erreur, injoignables, aux liens cassés ou retirées du plan du site (ex. /comparatif → /pricing)", () => {
    const out = evaluateRules({
      gsc: gsc(
        {
          "/pricing": noClick,
          "/ancien": noClick,
          "/disparu": noClick,
          "/injoignable": noClick,
          "/lien-casse": noClick,
          "/comparatif/logiciel-x": { clicks: 0, impressions: 30, position: 7 },
        },
        { "/comparatif": before },
      ),
      crawl,
    })
    expect(out.filter((c) => c.source === "search_console").map((c) => c.path)).toEqual(["/pricing"])
  })

  it("une page disparue de la période courante n'est « en baisse » que si l'exploration l'a lue en 200", () => {
    const out = evaluateRules({ gsc: gsc({}, { "/guide/actif": before, "/ancien": before, "/comparatif": before }), crawl })
    expect(out.filter((c) => c.source === "search_console").map((c) => [c.path, c.rule])).toEqual([["/guide/actif", "gsc-declining"]])
  })

  it("sans exploration terminée, les pages encore vues gardent leurs règles", () => {
    const out = evaluateRules({ gsc: gsc({ "/comparatif": noClick }, { "/comparatif": before }), crawl: null })
    expect(out.map((c) => c.path)).toEqual(["/comparatif"])
    expect(crawlStateOf("/comparatif", null)).toBe("unknown")
    expect(crawlStateOf("/comparatif", { ...crawl, pages: [] })).toBe("unknown")
    expect(crawlStateOf("/comparatif", crawl)).toBe("unlisted")
    expect(crawlStateOf("/pricing", crawl)).toBe("ok")
    expect(crawlStateOf("/ancien", crawl)).toBe("gone")
    expect(crawlStateOf("/lien-casse", crawl)).toBe("gone")
  })
})

describe("règles de l'exploration", () => {
  const pages: CrawlInput["pages"] = [
    { path: "/modele", status_code: 200, redirect_to: null, title: "x".repeat(84), description: "Courte.", h1_count: 2, canonical: "https://qonforme.fr/modele", robots: null, noindex: false, issues: ["title_too_long", "description_short", "h1_multiple"], error: null },
    { path: "/cachee", status_code: 200, redirect_to: null, title: "Cachée", description: null, h1_count: 1, canonical: null, robots: "noindex", noindex: true, issues: ["noindex"], error: null },
    { path: "/vieux", status_code: 404, redirect_to: null, title: null, description: null, h1_count: null, canonical: null, robots: null, noindex: false, issues: ["http_error"], error: null },
    { path: "/doublon", status_code: 200, redirect_to: null, title: "Doublon", description: "d".repeat(130), h1_count: 1, canonical: "https://qonforme.fr/original", robots: null, noindex: false, issues: ["canonical_other"], error: null },
  ]
  const summary = buildCrawlSummary({
    pages: pages.map((p) => ({ ...p, internal_links: p.path === "/modele" ? ["/casse", "/vieux"] : [] })),
    sitemapPaths: pages.map((p) => p.path),
    outsideResults: { "/casse": { status: 404 } },
    outsideTotal: 1,
    freshness: { checked: 5, missing: [{ path: "/blog/oublie", title: "Oublié", publishedAt: "2026-10-08T08:00:00Z" }], error: null },
  })
  const crawl: CrawlInput = { runId: "run-1", finishedAt: "2026-10-09T03:10:00Z", pages, summary }

  it("un constat par défaut de page, avec la gravité de la règle", () => {
    const out = evaluateRules({ gsc: null, crawl })
    const rows = out.map((c) => [c.rule, c.path, c.title, c.severity]).sort()
    expect(rows).toEqual(
      [
        ["crawl-broken-link", "/casse", "Lien interne cassé", "high"],
        ["crawl-broken-link", "/vieux", "Lien interne cassé", "high"],
        ["crawl-canonical", "/doublon", "Balise canonique vers une autre page", "high"],
        ["crawl-description", "/modele", "Description trop courte", "low"],
        ["crawl-h1", "/modele", "Plusieurs H1 sur la page", "medium"],
        ["crawl-http", "/vieux", "Page du plan du site en erreur", "high"],
        ["crawl-noindex", "/cachee", "Page du plan du site en noindex", "high"],
        ["crawl-sitemap", "/sitemap.xml", "Plan du site pas à jour", "medium"],
        ["crawl-title", "/modele", "Title trop long", "low"],
      ].sort(),
    )
    const title = out.find((c) => c.rule === "crawl-title")
    expect(title?.explanation).toBe(`84${NBSP}caractères (70 au plus)`)
    expect(title?.source).toBe("crawl")
    expect(title?.metrics.title).toBe("x".repeat(84))
  })

  it("la consigne copiée reprend la page, le constat, l'action et le title actuel", () => {
    const title = evaluateRules({ gsc: null, crawl }).find((c) => c.rule === "crawl-title")
    if (!title) throw new Error("constat attendu")
    const text = consigneOf(title)
    expect(text).toContain("Page : https://qonforme.fr/modele")
    expect(text).toContain("Action : Raccourcir le title")
    expect(text).toContain(`Title actuel : ${"x".repeat(84)}`)
  })

  it("règles évaluées : sans Search Console, seulement l'exploration ; plan du site non vérifié s'il n'a pas pu l'être", () => {
    expect(evaluatedRules({ gsc: false, crawl })).not.toContain("gsc-no-click")
    expect(evaluatedRules({ gsc: true, crawl: null })).toEqual(["gsc-no-click", "gsc-second-page", "gsc-beyond-second-page", "gsc-declining"])
    const unchecked = { ...crawl, summary: { ...summary, checks: { ...summary.checks, sitemapFresh: { checked: 0, missing: [], error: "Lecture impossible" } } } }
    expect(evaluatedRules({ gsc: false, crawl: unchecked })).not.toContain("crawl-sitemap")
  })
})

describe("mise à jour des constats", () => {
  const now = new Date("2026-10-09T10:00:00Z")
  const candidate = (rule: FindingCandidate["rule"], path: string): FindingCandidate => ({
    rule,
    path,
    page_type: "modele",
    title: "t",
    explanation: "e",
    recommendation: "r",
    severity: "medium",
    source: "search_console",
    effort_minutes: 30,
    metrics: {},
  })
  const existing = (id: string, rule: string, path: string, status: ExistingFinding["status"], at: string | null = null): ExistingFinding => ({
    id,
    rule,
    path,
    status,
    done_at: status === "done" ? at : null,
    ignored_at: status === "ignored" ? at : null,
    history: [],
  })

  it("met à jour le constat ouvert, crée les nouveaux, résout ceux qui ne correspondent plus", () => {
    const plan = planFindingSync(
      [existing("1", "gsc-no-click", "/modele", "open"), existing("2", "gsc-second-page", "/guide", "open"), existing("3", "manual", "/", "open")],
      [candidate("gsc-no-click", "/modele"), candidate("gsc-declining", "/guide"), candidate("gsc-declining", "/guide")],
      { now, evaluatedRules: ["gsc-no-click", "gsc-second-page", "gsc-beyond-second-page", "gsc-declining"] },
    )
    expect(plan.updates.map((u) => u.id)).toEqual(["1"])
    expect(plan.inserts.map((c) => [c.rule, c.path])).toEqual([["gsc-declining", "/guide"]])
    expect(plan.resolves.map((f) => f.id)).toEqual(["2"]) // jamais une règle non évaluée (« manual »)
  })

  it("sans Search Console, ses constats ouverts ne sont pas résolus", () => {
    const plan = planFindingSync([existing("1", "gsc-no-click", "/modele", "open")], [], { now, evaluatedRules: ["crawl-title"] })
    expect(plan.resolves).toEqual([])
  })

  it("un constat fait ou ignoré ne revient pas avant 30 jours", () => {
    const plan = planFindingSync(
      [
        existing("1", "gsc-no-click", "/modele", "done", "2026-09-29T10:00:00Z"), // il y a 10 jours
        existing("2", "crawl-title", "/guide", "ignored", "2026-09-20T10:00:00Z"), // il y a 19 jours
        existing("3", "crawl-h1", "/demo", "done", "2026-08-30T10:00:00Z"), // il y a 40 jours
      ],
      [candidate("gsc-no-click", "/modele"), candidate("crawl-title", "/guide"), candidate("crawl-h1", "/demo")],
      { now, evaluatedRules: ["gsc-no-click", "crawl-title", "crawl-h1"] },
    )
    expect(plan.snoozed.map((s) => [s.candidate.path, s.until.slice(0, 10)])).toEqual([
      ["/modele", "2026-10-29"],
      ["/guide", "2026-10-20"],
    ])
    expect(plan.inserts.map((c) => c.path)).toEqual(["/demo"])
  })
})

describe("échéance de la tâche des constats", () => {
  const at = (iso: string | null) => ({ last_ok_at: iso })

  it("après une exploration terminée ou une synchronisation de Search Console", () => {
    const now = new Date("2026-10-09T06:00:00Z") // 08:00 à Paris
    expect(isFindingsDue({ job: at("2026-10-09T05:00:00Z"), now, searchConsoleOkAt: null, crawlFinishedAt: "2026-10-09T05:30:00Z" })).toBe(true)
    expect(isFindingsDue({ job: at("2026-10-09T05:00:00Z"), now, searchConsoleOkAt: "2026-10-09T05:40:00Z", crawlFinishedAt: null })).toBe(true)
    expect(isFindingsDue({ job: at("2026-10-09T05:00:00Z"), now, searchConsoleOkAt: "2026-10-09T04:00:00Z", crawlFinishedAt: "2026-10-08T01:00:00Z" })).toBe(false)
  })

  it("sinon une fois par jour à partir de 09:00 (Paris)", () => {
    expect(isFindingsDue({ job: at("2026-10-08T08:00:00Z"), now: new Date("2026-10-09T06:30:00Z"), searchConsoleOkAt: null, crawlFinishedAt: null })).toBe(false)
    expect(isFindingsDue({ job: at("2026-10-08T08:00:00Z"), now: new Date("2026-10-09T07:30:00Z"), searchConsoleOkAt: null, crawlFinishedAt: null })).toBe(true)
    expect(isFindingsDue({ job: at("2026-10-09T07:30:00Z"), now: new Date("2026-10-09T15:00:00Z"), searchConsoleOkAt: null, crawlFinishedAt: null })).toBe(false)
    expect(isFindingsDue({ job: null, now: new Date("2026-10-09T07:30:00Z"), searchConsoleOkAt: null, crawlFinishedAt: null })).toBe(true)
  })
})

describe("changements d'état", () => {
  it("fait et ignoré depuis « À faire » ; rouvert depuis fait ou ignoré ; jamais un constat résolu", () => {
    expect(transitionFinding("open", "done")).toEqual({ ok: true, status: "done" })
    expect(transitionFinding("open", "ignore")).toEqual({ ok: true, status: "ignored" })
    expect(transitionFinding("done", "reopen")).toEqual({ ok: true, status: "open" })
    expect(transitionFinding("ignored", "reopen")).toEqual({ ok: true, status: "open" })
    expect(transitionFinding("done", "done").ok).toBe(false)
    expect(transitionFinding("ignored", "done").ok).toBe(false)
    expect(transitionFinding("open", "reopen").ok).toBe(false)
    expect(transitionFinding("resolved", "reopen").ok).toBe(false)
    expect(transitionFinding("resolved", "done").ok).toBe(false)
  })

  it("une action reprise du journal ne se rouvre pas (aucune règle ne la réévaluerait)", () => {
    const res = transitionFinding("done", "reopen", "import")
    expect(res.ok).toBe(false)
    expect(res.ok ? "" : res.error).toMatch(/journal des modifications/)
    expect(transitionFinding("done", "reopen", "crawl")).toEqual({ ok: true, status: "open" })
  })
})
