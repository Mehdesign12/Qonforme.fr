/**
 * Passage complet des Actions SEO sur une base simulée : Search Console +
 * dernière exploration → constats créés, mis à jour, résolus ; sans Search
 * Console, ses constats restent tels quels.
 */
import { describe, expect, it } from "vitest"
import { fakeOnboardingDb, type FakeOnboardingDb } from "./helpers/fake-onboarding-db"
import { refreshFindings } from "@/lib/seo/actions/refresh"
import { buildCrawlSummary } from "@/lib/seo/audit/checks"
import type { SeoDb } from "@/lib/seo/db"

type Row = Record<string, unknown>

function withGsc(f: FakeOnboardingDb, opts: { lastDay: string | null; pages?: (from: string) => Row[]; queries?: Row[] }): SeoDb {
  const rpc = (fn: string, args: Record<string, string>) => {
    let data: unknown[] = []
    if (fn === "seo_gsc_bounds") data = [{ first_date: opts.lastDay ? "2026-01-01" : null, last_date: opts.lastDay }]
    if (fn === "seo_gsc_by_page") data = opts.pages?.(args.p_from) ?? []
    if (fn === "seo_gsc_query_pages_agg") data = opts.queries ?? []
    return Object.assign(Promise.resolve({ data, error: null }), {
      range: (a: number, b: number) => Promise.resolve({ data: data.slice(a, b + 1), error: null }),
    })
  }
  return { ...f.client, rpc } as unknown as SeoDb
}

const RUN = "11111111-2222-4333-8444-555555555555"
const crawlPages = [
  { run_id: RUN, path: "/modele", status_code: 200, redirect_to: null, title: "Modèle de devis et de facture gratuit, prêt à remplir", description: "d".repeat(130), h1_count: 1, h1: "Modèle", canonical: "https://qonforme.fr/modele", robots: null, noindex: false, internal_links: ["/"], word_count: 800, issues: [], error: null },
  { run_id: RUN, path: "/guide", status_code: 200, redirect_to: null, title: "Guides", description: "d".repeat(130), h1_count: 1, h1: "Guides", canonical: "https://qonforme.fr/guide", robots: null, noindex: false, internal_links: [], word_count: 500, issues: [], error: null },
  { run_id: RUN, path: "/demo", status_code: 200, redirect_to: null, title: "Démo", description: "d".repeat(130), h1_count: 3, h1: "Démo", canonical: "https://qonforme.fr/demo", robots: null, noindex: false, internal_links: [], word_count: 300, issues: ["h1_multiple"], error: null },
]
const summary = buildCrawlSummary({
  pages: crawlPages,
  sitemapPaths: crawlPages.map((p) => p.path),
  outsideResults: {},
  outsideTotal: 0,
  freshness: { checked: 5, missing: [], error: null },
})

function base(): FakeOnboardingDb {
  return fakeOnboardingDb({
    seo_crawl_runs: [{ id: RUN, status: "done", trigger: "cron", started_at: "2026-10-05T01:00:00Z", finished_at: "2026-10-05T01:20:00Z", pages_total: 3, pages_done: 3, summary, error: null }],
    seo_crawl_pages: crawlPages,
    seo_findings: [
      // Corrigé depuis : la dernière exploration ne le voit plus → résolu.
      { id: "a0000000-0000-4000-8000-000000000001", rule: "crawl-title", path: "/guide", status: "open", source: "crawl", done_at: null, ignored_at: null, history: [{ at: "2026-10-01T00:00:00Z", event: "detected" }] },
      // Toujours là : mis à jour, pas recréé.
      { id: "a0000000-0000-4000-8000-000000000002", rule: "crawl-h1", path: "/demo", status: "open", source: "crawl", done_at: null, ignored_at: null, history: [], last_seen_at: "2026-10-01T00:00:00Z" },
      // Journal repris : jamais touché.
      { id: "a0000000-0000-4000-8000-000000000003", rule: "manual", path: "/", status: "done", source: "import", done_at: "2026-10-04T12:00:00Z", ignored_at: null, history: [] },
    ],
  })
}

describe("passage des Actions SEO", () => {
  const now = new Date("2026-10-09T08:00:00Z")

  it("crée, met à jour et résout les constats à partir de Search Console et de l'exploration", async () => {
    const fake = base()
    const db = withGsc(fake, {
      lastDay: "2026-10-06",
      pages: (from) => (from === "2026-09-09" ? [{ page: "/modele", clicks: 0, impressions: 122, avg_position: 6.2 }] : []),
      queries: [{ query: "devis modele", page: "/modele", clicks: 0, impressions: 45, avg_position: 2.7 }],
    })
    const result = await refreshFindings(db, { now })
    expect(result).toMatchObject({ gsc: true, crawlRunId: RUN, inserted: 1, updated: 1, resolved: 1 })

    const rows = fake.tables.seo_findings
    const modele = rows.find((f) => f.rule === "gsc-no-click")
    expect(modele).toMatchObject({ path: "/modele", status: "open", severity: "high", source: "search_console" })
    expect((modele?.metrics as Row).title).toBe("Modèle de devis et de facture gratuit, prêt à remplir")
    expect(modele?.recommendation).toContain("devis modele")
    expect(rows.find((f) => f.rule === "crawl-title")).toMatchObject({ status: "resolved" })
    expect(rows.find((f) => f.rule === "crawl-h1")).toMatchObject({ status: "open", last_seen_at: now.toISOString() })
    expect(rows.find((f) => f.rule === "manual")).toMatchObject({ status: "done" })
  })

  it("sans Search Console, ses constats ouverts restent ouverts", async () => {
    const fake = base()
    fake.tables.seo_findings.push({ id: "a0000000-0000-4000-8000-000000000004", rule: "gsc-no-click", path: "/modele", status: "open", source: "search_console", done_at: null, ignored_at: null, history: [] })
    const result = await refreshFindings(withGsc(fake, { lastDay: null }), { now })
    expect(result.gsc).toBe(false)
    expect(fake.tables.seo_findings.find((f) => f.rule === "gsc-no-click")).toMatchObject({ status: "open" })
  })
})
