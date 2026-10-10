/**
 * Exploration du site : jamais d'appel hors de qonforme.fr (SSRF), redirections
 * enregistrées sans être suivies, corps plafonné à 2 Mo, échéance de la tâche,
 * exploration complète sur une base simulée (pages, liens, synthèse, contrôles).
 */
import { afterEach, describe, expect, it, vi } from "vitest"
import { fakeOnboardingDb } from "./helpers/fake-onboarding-db"
import { AUDIT_USER_AGENT, auditUrl, fetchSitePath, MAX_BODY_BYTES, OffSiteUrlError, type FetchLike } from "@/lib/seo/audit/fetcher"
import { readSitemapPaths } from "@/lib/seo/audit/sitemap"
import { advanceCrawl, isCrawlDue, startCrawl, type CrawlRunRow } from "@/lib/seo/audit/crawler"
import { controlsOf, readSummary } from "@/lib/seo/audit/checks"
import { crawlTask } from "@/lib/seo/audit/task"
import type { SeoDb } from "@/lib/seo/db"
import type { SeoTaskContext } from "@/lib/seo/cron"

type Call = { url: string; init: RequestInit }

function recorder(handler: (url: string, init: RequestInit) => Response): { fetchImpl: FetchLike; calls: Call[] } {
  const calls: Call[] = []
  return {
    calls,
    fetchImpl: async (url, init) => {
      calls.push({ url, init })
      return handler(url, init)
    },
  }
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe("aucune requête hors de qonforme.fr", () => {
  it("refuse une adresse d'un autre site sans l'appeler", async () => {
    const { fetchImpl, calls } = recorder(() => new Response("non"))
    for (const url of ["https://evil.example/x", "http://169.254.169.254/latest/meta-data", "//evil.example/x", "javascript:alert(1)", "ftp://qonforme.fr/x", ""]) {
      await expect(fetchSitePath(url, { fetchImpl })).rejects.toBeInstanceOf(OffSiteUrlError)
    }
    expect(calls).toHaveLength(0)
    expect(() => auditUrl("https://qonforme.fr.evil.example/")).toThrow(OffSiteUrlError)
  })

  it("reconstruit l'adresse sur https://qonforme.fr, sans suivre les redirections, avec son User-Agent", async () => {
    const { fetchImpl, calls } = recorder(() => new Response("<html></html>", { headers: { "content-type": "text/html" } }))
    const res = await fetchSitePath("http://www.qonforme.fr/guide/?utm=1#x", { fetchImpl, readBody: true })
    expect(res.status).toBe(200)
    expect(calls).toHaveLength(1)
    expect(calls[0].url).toBe("https://qonforme.fr/guide")
    expect(calls[0].init.redirect).toBe("manual")
    expect((calls[0].init.headers as Record<string, string>)["User-Agent"]).toBe(AUDIT_USER_AGENT)
    expect(calls[0].init.signal).toBeDefined()
  })

  it("enregistre une redirection vers un autre site sans l'appeler", async () => {
    const { fetchImpl, calls } = recorder(() => new Response(null, { status: 302, headers: { location: "https://evil.example/piege" } }))
    const res = await fetchSitePath("/ancienne-page", { fetchImpl, readBody: true })
    expect(res.status).toBe(302)
    expect(res.redirectTo).toBe("https://evil.example/piege")
    expect(calls).toHaveLength(1)

    const internal = recorder(() => new Response(null, { status: 308, headers: { location: "/nouvelle-page/" } }))
    expect((await fetchSitePath("/ancienne-page", { fetchImpl: internal.fetchImpl })).redirectTo).toBe("/nouvelle-page")
  })

  it("ne lit pas plus de 2 Mo d'une page", async () => {
    const big = "a".repeat(MAX_BODY_BYTES + 500_000)
    const { fetchImpl } = recorder(() => new Response(big, { headers: { "content-type": "text/html" } }))
    const res = await fetchSitePath("/grosse-page", { fetchImpl, readBody: true })
    expect(res.truncated).toBe(true)
    expect(res.body?.length).toBe(MAX_BODY_BYTES)
  })

  it("rend un échec réseau sans lever", async () => {
    const res = await fetchSitePath("/lente", {
      fetchImpl: async () => {
        throw Object.assign(new Error("timeout"), { name: "TimeoutError" })
      },
    })
    expect(res.status).toBeNull()
    expect(res.error).toMatch(/Pas de réponse en 15 s/)
  })

  it("ne lit pas un sous-plan du site hébergé ailleurs", async () => {
    const { fetchImpl, calls } = recorder((url) => {
      if (url === "https://qonforme.fr/sitemap.xml") {
        return new Response(
          `<sitemapindex><sitemap><loc>https://evil.example/sitemap.xml</loc></sitemap><sitemap><loc>https://qonforme.fr/sitemap-pages.xml</loc></sitemap></sitemapindex>`,
        )
      }
      return new Response(`<urlset><url><loc>https://qonforme.fr/modele</loc></url><url><loc>https://evil.example/x</loc></url></urlset>`)
    })
    expect(await readSitemapPaths(fetchImpl)).toEqual(["/modele"])
    expect(calls.map((c) => c.url)).toEqual(["https://qonforme.fr/sitemap.xml", "https://qonforme.fr/sitemap-pages.xml"])
  })
})

describe("échéance de la tâche d'exploration", () => {
  const run = (status: CrawlRunRow["status"], started: string, finished: string | null = null) => ({ status, started_at: started, finished_at: finished })

  it("le lundi à partir de 03:00 (Paris) si aucune exploration n'a fini cette semaine", () => {
    const lastWeek = [run("done", "2026-10-05T01:30:00Z", "2026-10-05T01:50:00Z")]
    expect(isCrawlDue(lastWeek, new Date("2026-10-12T00:30:00Z"))).toBe(false) // lundi 02:30 à Paris
    expect(isCrawlDue(lastWeek, new Date("2026-10-12T01:30:00Z"))).toBe(true) // lundi 03:30
    expect(isCrawlDue(lastWeek, new Date("2026-10-14T10:00:00Z"))).toBe(true) // rattrapage le mercredi
    const thisWeek = [...lastWeek, run("done", "2026-10-12T01:30:00Z", "2026-10-12T01:45:00Z")]
    expect(isCrawlDue(thisWeek, new Date("2026-10-14T10:00:00Z"))).toBe(false)
  })

  it("poursuit une exploration en cours ; n'insiste pas moins d'une heure après un échec", () => {
    expect(isCrawlDue([run("running", "2026-10-09T08:00:00Z")], new Date("2026-10-09T08:15:00Z"))).toBe(true)
    const failed = [run("failed", "2026-10-12T01:30:00Z", "2026-10-12T01:30:05Z")]
    expect(isCrawlDue(failed, new Date("2026-10-12T02:00:00Z"))).toBe(false)
    expect(isCrawlDue(failed, new Date("2026-10-12T03:00:00Z"))).toBe(true)
  })
})

/* ------------------------------------------------------------------ */
/* Exploration complète sur un site simulé                             */
/* ------------------------------------------------------------------ */

const page = (title: string, description: string, body: string, extraHead = "", canonical = "") =>
  `<html><head><title>${title}</title><meta name="description" content="${description}">${canonical ? `<link rel="canonical" href="${canonical}">` : ""}${extraHead}</head><body><main><h1>${title}</h1>${body}</main></body></html>`

const GOOD_DESC = "Une description de page qui tient entre cent vingt et cent cinquante-cinq caractères, pour que Google l'affiche en entier sous le lien."

function fakeSite(): FetchLike {
  return async (url, init) => {
    const path = new URL(url).pathname
    const html = (s: string) => new Response(s, { headers: { "content-type": "text/html; charset=utf-8" } })
    if (path === "/sitemap.xml") {
      return new Response(
        `<urlset>${["/", "/modele", "/vieux", "/cachee", "/blog/dans-le-plan"].map((p) => `<url><loc>https://qonforme.fr${p}</loc></url>`).join("")}</urlset>`,
      )
    }
    if (init.method === "HEAD") {
      if (path === "/hors-plan") return new Response(null, { status: 200 })
      if (path === "/casse") return new Response(null, { status: 404 })
      return new Response(null, { status: 405 })
    }
    switch (path) {
      case "/":
        return html(
          page(
            "Accueil | Qonforme",
            GOOD_DESC,
            `<a href="/modele">Modèle</a><a href="/hors-plan">Hors plan</a><a href="/casse">Cassé</a><a href="/vieux">Vieux</a><a href="/facturation/plombier/lyon">Plombier à Lyon</a>`,
            "",
            "https://qonforme.fr/",
          ),
        )
      case "/modele":
        return html(page("Un title beaucoup trop long pour tenir dans les résultats de Google sans être coupé | Qonforme", "Trop courte.", `<a href="/">Accueil</a>`, "", "/modele"))
      case "/cachee":
        return html(page("Cachée", GOOD_DESC, "", `<meta name="robots" content="noindex">`, "/cachee"))
      case "/blog/dans-le-plan":
        return html(page("Article", GOOD_DESC, "", "", "/blog/dans-le-plan"))
      case "/facturation/plombier/lyon":
        return html(page("Plombier à Lyon", GOOD_DESC, "", `<meta name="robots" content="noindex, follow">`))
      default:
        return new Response("Introuvable", { status: 404, headers: { "content-type": "text/html" } })
    }
  }
}

describe("exploration complète", () => {
  const now = new Date("2026-10-09T10:00:00Z")
  const posts = [
    { slug: "dans-le-plan", title: "Article", published_at: "2026-10-01T08:00:00Z", is_published: true },
    { slug: "oublie", title: "Article oublié", published_at: "2026-10-08T08:00:00Z", is_published: true },
    { slug: "tout-juste-publie", title: "Tout juste publié", published_at: "2026-10-09T09:30:00Z", is_published: true },
    { slug: "cache-par-choix", title: "Non indexé", published_at: "2026-10-02T08:00:00Z", is_published: true, robots: { index: false } },
  ]

  it("explore le plan du site, vérifie les liens et rend la synthèse", async () => {
    const fake = fakeOnboardingDb({ blog_posts: posts })
    const db = fake.client as unknown as SeoDb
    const fetchImpl = fakeSite()

    const run = await startCrawl(db, { trigger: "manual", now, fetchImpl })
    expect(run.status).toBe("running")
    expect(run.pages_total).toBe(5)

    const progress = await advanceCrawl(db, run, { stopAt: Date.now() + 60_000, fetchImpl, now: () => now })
    expect(progress.status).toBe("done")

    const stored = fake.tables.seo_crawl_runs[0]
    expect(stored.status).toBe("done")
    expect(fake.tables.seo_crawl_pages).toHaveLength(5)
    const summary = readSummary(stored.summary)
    expect(summary).not.toBeNull()
    if (!summary) return
    expect(summary.pagesExplored).toBe(5)
    expect(summary.checks.title).toMatchObject({ failing: 1, tooLong: 1, paths: ["/modele"] })
    expect(summary.checks.description).toMatchObject({ failing: 1, short: 1 })
    expect(summary.checks.noindexInSitemap.paths).toEqual(["/cachee"])
    expect(summary.checks.errors.pages.map((e) => e.path)).toEqual(["/vieux"])
    expect(summary.checks.links.broken.map((b) => [b.path, b.status, b.from])).toEqual([
      ["/casse", 404, ["/"]],
      ["/vieux", 404, ["/"]],
    ])
    expect(summary.checks.links.checkedOutside).toBe(3)
    expect(summary.checks.noindexByDecision).toEqual({ encountered: 1, verifiedNoindex: 1, indexable: [], otherStatus: 0, unverified: 0 })
    expect(summary.checks.links.unverified).toEqual([])
    // Article publié depuis plus de 2 h et absent : signalé ; trop récent ou en noindex : non.
    expect(summary.checks.sitemapFresh.missing.map((m) => m.path)).toEqual(["/blog/oublie"])

    const controls = controlsOf(summary)
    expect(controls[0].state).toBe("alert")
    expect(controls.find((c) => c.key === "noindex_decision")).toMatchObject({ state: "info", result: "1 page métier × ville vérifiée en noindex." })
    expect(controls.find((c) => c.key === "canonical")?.state).toBe("ok")
  })

  it("enregistre une exploration en échec si le plan du site est illisible", async () => {
    const fake = fakeOnboardingDb()
    const run = await startCrawl(fake.client as unknown as SeoDb, { trigger: "cron", now, fetchImpl: async () => new Response("", { status: 500 }) })
    expect(run.status).toBe("failed")
    expect(run.error).toMatch(/Plan du site illisible/)
  })

  it("la tâche ne crée pas d'exploration sur un simple « Continuer » ; « Ré-analyser » en crée une", async () => {
    vi.stubGlobal("fetch", fakeSite())
    const fake = fakeOnboardingDb({ blog_posts: posts })
    const ctx = (params: Record<string, unknown>): SeoTaskContext => ({
      db: fake.client as unknown as SeoDb,
      now,
      deadline: Date.now() + 60_000,
      trigger: "manual",
      job: { name: "crawl", status: "running", started_at: null, finished_at: null, last_ok_at: null, lock_until: null, cursor: {}, result: null, error: null },
      saveCursor: async () => undefined,
      params,
    })
    expect(await crawlTask.run(ctx({ start: false }))).toEqual({ status: "idle", runId: null })
    const result = await crawlTask.run(ctx({ start: true }))
    expect(result).toMatchObject({ status: "done", pagesDone: 5, pagesTotal: 5 })
  })
})
