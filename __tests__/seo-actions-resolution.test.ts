/**
 * « Résolu de lui-même » seulement à bon escient :
 * - Search Console : quand la règle la plus grave d'une page change, le constat
 *   déjà ouvert et toujours vrai est gardé (historique compris), sans en créer un autre ;
 * - exploration : une page sans réponse, en 5xx ou redirigée ne résout pas ses
 *   constats de contenu ; un lien cassé non revérifié non plus ;
 * - contrôle « Pages en noindex par décision » : seulement ce qui a été vérifié.
 */
import { describe, expect, it } from "vitest"
import { fakeOnboardingDb, type FakeOnboardingDb } from "./helpers/fake-onboarding-db"
import { refreshFindings } from "@/lib/seo/actions/refresh"
import { evaluateRuleSet, evaluatedRules, type CrawlInput } from "@/lib/seo/actions/rules"
import { planFindingSync, type ExistingFinding } from "@/lib/seo/actions/sync"
import { buildCrawlSummary, noindexDecisionControl, type CrawlPageRow } from "@/lib/seo/audit/checks"
import type { SeoDb } from "@/lib/seo/db"

type Row = Record<string, unknown>

/* ------------------------------------------------------------------ */
/* Search Console : pas d'alternance                                    */
/* ------------------------------------------------------------------ */

const RUN = "11111111-2222-4333-8444-555555555555"
const crawlPage = (path: string): CrawlPageRow => ({
  run_id: RUN,
  path,
  status_code: 200,
  redirect_to: null,
  title: "Modèle de devis et de facture gratuit, prêt à remplir",
  description: "d".repeat(130),
  h1_count: 1,
  h1: "Modèle",
  canonical: `https://qonforme.fr${path}`,
  robots: null,
  noindex: false,
  internal_links: [],
  word_count: 800,
  issues: [],
  error: null,
})

function gscDb(fake: FakeOnboardingDb, pages: { current: Row[]; previous: Row[] }): SeoDb {
  const rpc = (fn: string, args: Record<string, string>) => {
    let data: unknown[] = []
    if (fn === "seo_gsc_bounds") data = [{ first_date: "2026-01-01", last_date: "2026-10-06" }]
    if (fn === "seo_gsc_by_page") data = args.p_from === "2026-09-09" ? pages.current : pages.previous
    return Object.assign(Promise.resolve({ data, error: null }), {
      range: (a: number, b: number) => Promise.resolve({ data: data.slice(a, b + 1), error: null }),
    })
  }
  return { ...fake.client, rpc } as unknown as SeoDb
}

describe("Search Console : la règle retenue change d'un passage à l'autre", () => {
  it("garde le constat ouvert toujours vrai, avec son historique, sans en créer un autre", async () => {
    const page = crawlPage("/modele")
    const summary = buildCrawlSummary({ pages: [page], sitemapPaths: ["/modele"], outsideResults: {}, outsideTotal: 0, freshness: { checked: 0, missing: [], error: null } })
    const fake = fakeOnboardingDb({
      seo_crawl_runs: [{ id: RUN, status: "done", trigger: "cron", started_at: "2026-10-05T01:00:00Z", finished_at: "2026-10-05T01:20:00Z", pages_total: 1, pages_done: 1, summary, error: null }],
      seo_crawl_pages: [{ ...page }],
      seo_findings: [
        { id: "a0000000-0000-4000-8000-0000000000aa", rule: "crawl-title", path: "/retiree", status: "open", source: "crawl", done_at: null, ignored_at: null, history: [{ at: "2026-10-01T00:00:00Z", event: "detected" }] },
      ],
    })

    // 1er passage : bien classée sans clic (60 impressions, haute).
    await refreshFindings(gscDb(fake, { current: [{ page: "/modele", clicks: 0, impressions: 60, avg_position: 7 }], previous: [] }), {
      now: new Date("2026-10-08T08:00:00Z"),
    })
    // Page retirée du plan du site : constat de contenu résolu, motif dans l'historique.
    const retired = fake.tables.seo_findings.find((f) => f.path === "/retiree")
    expect(retired?.status).toBe("resolved")
    expect((retired?.history as { event: string; note?: string }[]).at(-1)).toMatchObject({ event: "resolved", note: "Page retirée du plan du site" })
    const gscRows = () => fake.tables.seo_findings.filter((f) => f.source === "search_console")
    expect(gscRows()).toHaveLength(1)
    const first = gscRows()[0]
    expect(first).toMatchObject({ rule: "gsc-no-click", status: "open", severity: "high" })
    first.suggestion = JSON.stringify({ title: "Proposition", description: "À relire" })

    // 2e passage : toujours sans clic (12 impressions, moyenne) et en baisse (100 → 12, moyenne) :
    // la baisse serait retenue à gravité égale, mais le constat ouvert reste vrai.
    const result = await refreshFindings(
      gscDb(fake, {
        current: [{ page: "/modele", clicks: 0, impressions: 12, avg_position: 7 }],
        previous: [{ page: "/modele", clicks: 4, impressions: 100, avg_position: 4 }],
      }),
      { now: new Date("2026-10-09T08:00:00Z") },
    )
    expect(result).toMatchObject({ inserted: 0, resolved: 0, updated: 1 })
    expect(gscRows()).toHaveLength(1)
    const kept = gscRows()[0]
    expect(kept).toMatchObject({ id: first.id, rule: "gsc-no-click", status: "open", severity: "medium", last_seen_at: "2026-10-09T08:00:00.000Z" })
    expect(kept.suggestion).toContain("Proposition")
    expect((kept.history as { event: string }[]).map((h) => h.event)).toEqual(["detected"])
  })

  it("résout le constat dont la règle n'est plus vraie, et crée alors celui de la nouvelle règle", () => {
    const now = new Date("2026-10-09T08:00:00Z")
    const period = { current: { from: "2026-09-09", to: "2026-10-06" }, previous: { from: "2026-08-12", to: "2026-09-08" } }
    const evaluation = evaluateRuleSet({
      // 5 clics : plus « sans clic » ; impressions 100 → 20 : en baisse.
      gsc: { current: { "/modele": { clicks: 5, impressions: 20, position: 7 } }, previous: { "/modele": { clicks: 9, impressions: 100, position: 5 } }, period },
      crawl: null,
    })
    const existing: ExistingFinding[] = [{ id: "f1", rule: "gsc-no-click", path: "/modele", status: "open", done_at: null, ignored_at: null, history: [] }]
    const plan = planFindingSync(existing, evaluation.chosen, {
      now,
      evaluatedRules: evaluatedRules({ gsc: true, crawl: null }),
      valid: evaluation.valid,
      isEvaluated: evaluation.isEvaluated,
    })
    expect(plan.resolves.map((f) => f.id)).toEqual(["f1"])
    expect(plan.inserts.map((c) => c.rule)).toEqual(["gsc-declining"])
  })
})

/* ------------------------------------------------------------------ */
/* Exploration : jugé seulement sur une réponse lisible                 */
/* ------------------------------------------------------------------ */

describe("exploration : pas de résolution sans réponse 200 HTML ni lien revérifié", () => {
  const now = new Date("2026-10-09T08:00:00Z")
  const page = (path: string, status: number | null, issues: string[], extra: Partial<CrawlPageRow> = {}): CrawlPageRow => ({
    ...crawlPage(path),
    status_code: status,
    issues,
    error: status === null ? "délai dépassé" : null,
    ...extra,
  })
  const open = (rule: string, path: string): ExistingFinding => ({ id: `${rule}|${path}`, rule, path, status: "open", done_at: null, ignored_at: null, history: [] })

  function plan(pages: CrawlPageRow[], existing: ExistingFinding[], outsideResults: Record<string, { status: number | null }>, outsideTotal = Object.keys(outsideResults).length) {
    const summary = buildCrawlSummary({ pages, sitemapPaths: pages.map((p) => p.path), outsideResults, outsideTotal, freshness: { checked: 0, missing: [], error: null } })
    const crawl: CrawlInput = { runId: RUN, finishedAt: "2026-10-09T03:00:00Z", pages, summary }
    const evaluation = evaluateRuleSet({ gsc: null, crawl })
    return planFindingSync(existing, evaluation.chosen, {
      now,
      evaluatedRules: evaluatedRules({ gsc: false, crawl }),
      valid: evaluation.valid,
      isEvaluated: evaluation.isEvaluated,
      outOfScope: evaluation.outOfScope,
    })
  }

  it("délai dépassé, 5xx, redirection, noindex : les constats de contenu restent ouverts ; une page lue en 200 corrigée les résout", () => {
    const pages = [
      page("/lent", null, ["fetch_failed"]),
      page("/panne", 503, ["http_error"]),
      page("/deplacee", 301, ["redirect"], { redirect_to: "/ailleurs" }),
      page("/cachee", 200, ["noindex"], { noindex: true, robots: "noindex" }),
      page("/corrigee", 200, []),
    ]
    const existing = ["/lent", "/panne", "/deplacee", "/cachee", "/corrigee"].flatMap((p) => [
      open("crawl-title", p),
      open("crawl-description", p),
      open("crawl-h1", p),
      open("crawl-canonical", p),
    ])
    const resolved = plan(pages, existing, {}).resolves.map((f) => f.id).sort()
    expect(resolved).toEqual(["crawl-canonical|/corrigee", "crawl-description|/corrigee", "crawl-h1|/corrigee", "crawl-title|/corrigee"])
  })

  it("une page retirée du plan du site (lu avec succès) : tous ses constats se résolvent, ceux de contenu avec le motif", () => {
    const existing = [open("crawl-http", "/retiree"), open("crawl-noindex", "/retiree"), open("crawl-title", "/retiree"), open("crawl-canonical", "/retiree")]
    const resolves = plan([page("/accueil", 200, [])], existing, {}).resolves
    expect(resolves.map((f) => [f.id, f.note ?? null]).sort()).toEqual([
      ["crawl-canonical|/retiree", "Page retirée du plan du site"],
      ["crawl-http|/retiree", null],
      ["crawl-noindex|/retiree", null],
      ["crawl-title|/retiree", "Page retirée du plan du site"],
    ])
    // Une page encore listée mais illisible n'est pas « retirée ».
    expect(plan([page("/lente", null, ["fetch_failed"])], [open("crawl-title", "/lente")], {}).resolves).toEqual([])
  })

  it("plan du site non lu (exploration vide ou aucune exploration) : rien ne se résout", () => {
    const crawl: CrawlInput = { runId: RUN, finishedAt: null, pages: [], summary: null }
    for (const input of [crawl, null]) {
      const evaluation = evaluateRuleSet({ gsc: null, crawl: input })
      const p = planFindingSync([open("crawl-title", "/retiree")], evaluation.chosen, {
        now,
        evaluatedRules: evaluatedRules({ gsc: false, crawl: input }),
        valid: evaluation.valid,
        isEvaluated: evaluation.isEvaluated,
        outOfScope: evaluation.outOfScope,
      })
      expect(p.resolves).toEqual([])
    }
  })

  it("lien cassé : résolu seulement s'il a été revérifié (ou retiré des pages), jamais au-delà du plafond ni sans réponse", () => {
    const linking = page("/", 200, [], { internal_links: ["/repare", "/hors-plafond", "/muet"] })
    const existing = [open("crawl-broken-link", "/repare"), open("crawl-broken-link", "/hors-plafond"), open("crawl-broken-link", "/muet"), open("crawl-broken-link", "/plus-cite")]
    // /hors-plafond : cité mais jamais vérifié (plafond) ; /muet : sans réponse ; /plus-cite : le lien a été retiré.
    const resolved = plan([linking], existing, { "/repare": { status: 200 }, "/muet": { status: null } }, 3).resolves.map((f) => f.id).sort()
    expect(resolved).toEqual(["crawl-broken-link|/plus-cite", "crawl-broken-link|/repare"])
  })

  it("synthèse ancienne sans liste des liens non vérifiés : aucun lien cassé résolu", () => {
    const pages = [page("/", 200, [])]
    const summary = buildCrawlSummary({ pages, sitemapPaths: ["/"], outsideResults: {}, outsideTotal: 0, freshness: { checked: 0, missing: [], error: null } })
    delete summary.checks.links.unverified
    const crawl: CrawlInput = { runId: RUN, finishedAt: null, pages, summary }
    const evaluation = evaluateRuleSet({ gsc: null, crawl })
    expect(evaluation.isEvaluated("crawl-broken-link", "/casse")).toBe(false)
  })

  it("Search Console : une page sans réponse garde ses constats ; une page redirigée les résout", () => {
    const pages = [page("/lent", null, ["fetch_failed"]), page("/deplacee", 301, ["redirect"])]
    const summary = buildCrawlSummary({ pages, sitemapPaths: pages.map((p) => p.path), outsideResults: {}, outsideTotal: 0, freshness: { checked: 0, missing: [], error: null } })
    const period = { current: { from: "2026-09-09", to: "2026-10-06" }, previous: { from: "2026-08-12", to: "2026-09-08" } }
    const stat = { clicks: 0, impressions: 40, position: 6 }
    const evaluation = evaluateRuleSet({ gsc: { current: { "/lent": stat, "/deplacee": stat }, previous: {}, period }, crawl: { runId: RUN, finishedAt: null, pages, summary } })
    const existing = [open("gsc-no-click", "/lent"), open("gsc-no-click", "/deplacee")]
    const p = planFindingSync(existing, evaluation.chosen, {
      now,
      evaluatedRules: evaluatedRules({ gsc: true, crawl: { runId: RUN, finishedAt: null, pages, summary } }),
      valid: evaluation.valid,
      isEvaluated: evaluation.isEvaluated,
    })
    expect(p.resolves.map((f) => f.id)).toEqual(["gsc-no-click|/deplacee"])
  })
})

/* ------------------------------------------------------------------ */
/* Contrôle « Pages en noindex par décision »                          */
/* ------------------------------------------------------------------ */

describe("contrôle « Pages en noindex par décision »", () => {
  it("indexable (200 sans noindex) : à corriger", () => {
    const c = noindexDecisionControl({ encountered: 3, verifiedNoindex: 1, indexable: ["/facturation/plombier/lyon"], otherStatus: 0, unverified: 1 })
    expect(c.state).toBe("alert")
    expect(c.result).toBe("1 page métier × ville indexable (réponse 200 sans noindex) : à corriger.")
    expect(c.details[0]).toBe("/facturation/plombier/lyon")
  })

  it("rien de vérifié : « Non vérifié », sans affirmer l'absence de l'index", () => {
    const none = noindexDecisionControl({ encountered: 0, verifiedNoindex: 0, indexable: [], otherStatus: 0, unverified: 0 })
    expect(none).toMatchObject({ state: "unknown", result: "Non vérifié : aucune page métier × ville rencontrée par des liens." })
    const capped = noindexDecisionControl({ encountered: 4, verifiedNoindex: 0, indexable: [], otherStatus: 0, unverified: 4 })
    expect(capped.state).toBe("unknown")
    expect([none, capped].map((c) => `${c.result} ${c.details.join(" ")}`).join(" ")).not.toMatch(/absentes de l'index|Ce n'est pas une erreur/)
  })

  it("vérifié en partie : ce qui est vérifié, ce qui ne l'est pas, ce qui répond autrement", () => {
    const c = noindexDecisionControl({ encountered: 6, verifiedNoindex: 3, indexable: [], otherStatus: 1, unverified: 2 })
    expect(c).toMatchObject({ state: "info", result: "3 pages métier × ville vérifiées en noindex, 2 non vérifiées, 1 redirigée ou en erreur." })
    // Synthèse ancienne : le reste n'est que « non confirmé ».
    expect(noindexDecisionControl({ encountered: 5, verifiedNoindex: 4 }).result).toBe("4 pages métier × ville vérifiées en noindex, 1 non confirmée en noindex.")
  })
})
