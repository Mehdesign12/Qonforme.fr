/**
 * Fenêtre d'un article (admin › SEO › Articles) : plages de Search Console,
 * mot-clé principal, lecture complète (Search Console illisible, colonnes de
 * la migration 20261006 absentes), route GET, rendu de la fenêtre et du
 * « + » du calendrier.
 */
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest"
import * as React from "react"
import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { NextRequest } from "next/server"
import { fakeArticlesDb, uuid, type FakeArticlesDb, type Row } from "./seo-articles-fake-db"

const state = vi.hoisted(() => ({ admin: true, client: null as unknown }))

vi.mock("@/lib/supabase/server", () => ({ createClient: async () => state.client, createAdminClient: () => state.client }))
vi.mock("@/lib/admin-require", () => ({ isAdminAuthenticated: async () => state.admin }))
vi.mock("next/cache", () => ({ revalidatePath: () => {} }))
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: () => {}, replace: () => {}, refresh: () => {} }),
  usePathname: () => "/admin/seo/articles",
  useSearchParams: () => new URLSearchParams(""),
}))

import {
  detailsRanges,
  editorKeywordFromPlan,
  editorKeywordFromRow,
  findArticleKeyword,
  GSC_READ_ERROR,
  loadArticleDetails,
  withPageMetrics,
  type ArticleDetailsPayload,
} from "@/lib/seo/articles/details"
import { GET as getPost } from "@/app/api/admin/seo/articles/posts/[id]/route"
import { PLAN_KEYWORDS } from "@/lib/seo/keywords/plan"
import { monthGrid } from "@/lib/seo/articles/schedule"
import type { KeywordRow } from "@/lib/seo/keywords/types"
import { loadCalendar, loadCalendarPage, type CalendarData } from "@/lib/seo/articles/data"
import type { SeoDb } from "@/lib/seo/db"

// Espaces insécables (« 21 octobre », « 13 oct. ») ramenées à des espaces simples pour les comparaisons
const flat = (s: string) => s.replace(/[\u00a0\u202f]/g, " ")
const html = (el: unknown) => flat(renderToStaticMarkup(el as React.ReactElement))

// Le JSX du dépôt est compilé en React.createElement : React doit être global avant le chargement des composants
let Dialog: typeof import("@/components/admin/seo/articles/ArticleDetailsDialog")
let Calendar: typeof import("@/components/admin/seo/articles/CalendarView")

beforeAll(async () => {
  ;(globalThis as unknown as { React: typeof React }).React = React
  Dialog = await import("@/components/admin/seo/articles/ArticleDetailsDialog")
  Calendar = await import("@/components/admin/seo/articles/CalendarView")
})

/* ------------------------------------------------------------------ */
/* Base simulée : PostgREST du module Articles + Search Console        */
/* ------------------------------------------------------------------ */

type GscPageRow = { date: string; page: string; device: string; country: string; clicks: number; impressions: number; position: number }
type GscQueryRow = { date: string; query: string; page: string; clicks: number; impressions: number; position: number }

interface Gsc {
  bounds: { first_date: string | null; last_date: string | null } | null
  pages: GscPageRow[]
  queries: GscQueryRow[]
  failing: boolean
}

/** Valeurs d'une liste `in.("a","b")` de PostgREST (pgrstInList). */
function parseInList(value: string): string[] {
  return Array.from(value.matchAll(/"((?:[^"\\]|\\.)*)"/g)).map((m) => m[1].replace(/\\(.)/g, "$1"))
}

function inRange(date: string, args: Record<string, unknown>): boolean {
  return date >= String(args.p_from) && date <= String(args.p_to)
}

function aggregate<T extends { clicks: number; impressions: number; position: number }>(rows: T[], key: (r: T) => string) {
  const out = new Map<string, { clicks: number; impressions: number; weighted: number; sample: T }>()
  rows.forEach((r) => {
    const k = key(r)
    const cur = out.get(k) ?? { clicks: 0, impressions: 0, weighted: 0, sample: r }
    cur.clicks += r.clicks
    cur.impressions += r.impressions
    cur.weighted += r.position * r.impressions
    out.set(k, cur)
  })
  return Array.from(out.values()).map((v) => ({ ...v.sample, clicks: v.clicks, impressions: v.impressions, avg_position: v.impressions ? v.weighted / v.impressions : null }))
}

/** Client : base en mémoire, `range`/`filter` ajoutés, colonnes absentes simulées, fonctions seo_gsc_*. */
function detailsClient(fake: FakeArticlesDb, gsc: Gsc, opts: { missingColumns?: string[] } = {}) {
  const base = fake.client as { from: (t: string) => Record<string, (...a: never[]) => unknown> }
  const from = (table: string) => {
    const q = base.from(table) as Record<string, unknown> & { select: (...a: unknown[]) => unknown; in: (c: string, l: unknown[]) => unknown; limit: (n: number) => unknown; maybeSingle: () => Promise<unknown> }
    let schemaError = false
    const select = q.select
    q.select = (cols?: unknown, o?: unknown) => {
      if (typeof cols === "string" && opts.missingColumns?.some((c) => cols.includes(c))) schemaError = true
      return select(cols, o)
    }
    q.filter = (col: string, op: string, value: string) => {
      if (op !== "in") throw new Error(`filter(${op}) non géré`)
      return q.in(col, parseInList(value))
    }
    q.range = (a: number, b: number) => q.limit(b - a + 1)
    const maybeSingle = q.maybeSingle
    q.maybeSingle = () =>
      schemaError ? Promise.resolve({ data: null, error: { code: "42703", message: "column blog_posts.cover_alt does not exist" } }) : maybeSingle()
    return q
  }
  const rpc = (fn: string, args: Record<string, unknown> = {}) => {
    let pages: string[] | null = null
    const run = () => {
      if (gsc.failing) return { data: null, error: { message: "fetch failed: timeout" } }
      if (fn === "seo_gsc_bounds") return { data: gsc.bounds ? [gsc.bounds] : [], error: null }
      const keep = (p: string) => !pages || pages.includes(p)
      if (fn === "seo_gsc_by_page") return { data: aggregate(gsc.pages.filter((r) => inRange(r.date, args) && keep(r.page)), (r) => r.page), error: null }
      if (fn === "seo_gsc_query_pages_agg") return { data: aggregate(gsc.queries.filter((r) => inRange(r.date, args) && keep(r.page)), (r) => `${r.query}|${r.page}`), error: null }
      throw new Error(`rpc ${fn} non géré`)
    }
    const chain = {
      filter: (_col: string, _op: string, value: string) => ((pages = parseInList(value)), chain),
      range: () => chain,
      then: (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) => Promise.resolve(run()).then(resolve, reject),
    }
    return chain
  }
  return { from, rpc } as unknown as SeoDb
}

function gscPagesTable(gsc: Gsc): Row[] {
  return gsc.pages.map((r) => ({ ...r }))
}

const NOW = new Date("2026-10-16T10:00:00Z")

function post(over: Row = {}): Row {
  return {
    id: uuid(),
    slug: "exemple-devis-maconnerie",
    title: "Exemple de devis de maçonnerie : modèle gratuit et chiffré",
    excerpt: "Un exemple de devis de maçonnerie complet, avec les mentions obligatoires, la TVA par ligne et un acompte.",
    content: "## Les lignes d'un devis\n\nUn exemple de devis de maçonnerie aide à chiffrer un mur sans rien oublier.\n\n## Les mentions\n\nVoir le [guide](/guide/mentions-obligatoires-devis).",
    is_published: true,
    published_at: "2026-10-07T19:19:00Z",
    created_at: "2026-10-01T08:00:00Z",
    updated_at: "2026-10-07T19:19:00Z",
    ai_generated: true,
    source: null,
    article_type: "howto",
    target_keyword: "exemple devis maçonnerie",
    scheduled_at: null,
    review_status: "approved",
    audit_result: null,
    held_reason: null,
    cover_url: "https://x.supabase.co/storage/v1/object/public/blog-covers/a.jpg",
    cover_alt: "Maçon montant un mur en parpaings",
    seo_title: null,
    seo_description: null,
    ai_keywords: ["devis maçonnerie", 3],
    ...over,
  }
}

function keywordRow(over: Partial<KeywordRow> = {}): KeywordRow {
  return {
    id: uuid(),
    keyword: "exemple devis maçonnerie",
    status: "targeted",
    intent: "informational",
    source: "manual",
    target_path: null,
    notes: null,
    volume: null,
    difficulty: 12,
    cpc: null,
    cpc_currency: null,
    metrics_checked_at: null,
    position: 4.5,
    impressions: 300,
    clicks: 2,
    gsc_updated_at: null,
    created_at: "2026-10-01T00:00:00Z",
    updated_at: "2026-10-01T00:00:00Z",
    ...over,
  }
}

/* ------------------------------------------------------------------ */
/* Plages                                                              */
/* ------------------------------------------------------------------ */

describe("detailsRanges", () => {
  it("sans donnée de Search Console : aucune plage", () => {
    expect(detailsRanges({ first: null, last: null }, "2026-10-07T19:19:00Z", NOW)).toEqual({ last: null, last28: null, sincePublished: null, series: null, queries: null })
  })

  it("article ancien : 28 jours, depuis la publication, courbe de 28 jours, requêtes sur 90 jours", () => {
    const r = detailsRanges({ first: "2025-06-01", last: "2026-10-13" }, "2026-03-02T09:00:00Z", NOW)
    expect(r.last).toBe("2026-10-13")
    expect(r.last28).toEqual({ from: "2026-09-16", to: "2026-10-13" })
    expect(r.sincePublished).toEqual({ from: "2026-03-02", to: "2026-10-13" })
    expect(r.series).toEqual({ from: "2026-09-16", to: "2026-10-13" })
    expect(r.queries).toEqual({ from: "2026-07-16", to: "2026-10-13" })
  })

  it("article récent : courbe et requêtes depuis la publication (jour de Paris), 7 jours affichés au moins", () => {
    // 22 h 30 UTC le 7 = 0 h 30 le 8 à Paris
    const r = detailsRanges({ first: "2025-06-01", last: "2026-10-13" }, "2026-10-07T22:30:00Z", NOW)
    expect(r.sincePublished).toEqual({ from: "2026-10-08", to: "2026-10-13" })
    expect(r.series).toEqual({ from: "2026-10-07", to: "2026-10-13" })
    expect(r.queries).toEqual({ from: "2026-10-08", to: "2026-10-13" })

    const twoWeeks = detailsRanges({ first: "2025-06-01", last: "2026-10-13" }, "2026-09-29T08:00:00Z", NOW)
    expect(twoWeeks.series).toEqual({ from: "2026-09-29", to: "2026-10-13" })
  })

  it("publié après le dernier jour disponible : plage vide, aucune requête à lire", () => {
    const r = detailsRanges({ first: "2025-06-01", last: "2026-10-13" }, "2026-10-15T08:00:00Z", NOW)
    expect(r.sincePublished).toBe("empty")
    expect(r.series).toEqual({ from: "2026-10-07", to: "2026-10-13" })
    expect(r.queries).toBeNull()
  })

  it("article hors ligne : pas de « depuis la publication », 28 jours et 90 jours quand même", () => {
    const r = detailsRanges({ first: "2025-06-01", last: "2026-10-13" }, null, NOW)
    expect(r.sincePublished).toBeNull()
    expect(r.last28).toEqual({ from: "2026-09-16", to: "2026-10-13" })
    expect(r.queries).toEqual({ from: "2026-07-16", to: "2026-10-13" })
  })

  it("historique plus court que la courbe : la courbe commence au premier jour enregistré", () => {
    const r = detailsRanges({ first: "2026-10-05", last: "2026-10-13" }, null, NOW)
    expect(r.series).toEqual({ from: "2026-10-05", to: "2026-10-13" })
    expect(r.last28?.from).toBe("2026-09-16")
  })

  it("dernier jour dans le futur : ramené à aujourd'hui (Paris)", () => {
    expect(detailsRanges({ first: null, last: "2026-12-01" }, null, NOW).last).toBe("2026-10-16")
  })
})

/* ------------------------------------------------------------------ */
/* Mot-clé principal                                                   */
/* ------------------------------------------------------------------ */

describe("mot-clé principal", () => {
  it("ligne de l'onglet Mots-clés : mesures conservées, volume et page complétés par le plan (comparaison sans accents)", () => {
    const row = keywordRow({ keyword: "exemple devis maconnerie", volume: null, target_path: null })
    const k = findArticleKeyword("Exemple devis maçonnerie", [row])
    expect(k).toMatchObject({ id: row.id, keyword: "exemple devis maconnerie", status: "targeted", difficulty: 12, position: 4.5, fromPlan: true, volume: 170, targetPath: "/modele/devis-maconnerie" })
  })

  it("préfère l'orthographe exacte quand deux lignes se rapprochent", () => {
    const without = keywordRow({ keyword: "exemple devis maconnerie", volume: 999 })
    const exact = keywordRow({ keyword: "exemple devis maçonnerie", volume: 10 })
    expect(findArticleKeyword("exemple devis maçonnerie", [without, exact])?.id).toBe(exact.id)
  })

  it("mot-clé du plan pas encore suivi, mot-clé libre, aucun mot-clé", () => {
    expect(findArticleKeyword("logiciel plombier", [])).toEqual(editorKeywordFromPlan(PLAN_KEYWORDS.find((p) => p.keyword === "logiciel plombier")!))
    expect(findArticleKeyword("logiciel plombier", [])).toMatchObject({ id: null, status: null, volume: 260, fromPlan: true, targetPath: "/facturation/plombier" })
    expect(findArticleKeyword("  Facture   d’acompte ", [])).toEqual({
      id: null,
      keyword: "facture d'acompte",
      status: null,
      intent: null,
      volume: null,
      difficulty: null,
      position: null,
      clicks: null,
      impressions: null,
      targetPath: null,
      fromPlan: false,
    })
    expect(findArticleKeyword(null, [keywordRow()])).toBeNull()
    expect(findArticleKeyword("   ", [keywordRow()])).toBeNull()
  })

  it("conversion d'une ligne hors plan", () => {
    expect(editorKeywordFromRow(keywordRow({ keyword: "devis carrelage", volume: 50, target_path: "/x" }))).toMatchObject({ keyword: "devis carrelage", volume: 50, targetPath: "/x", fromPlan: false })
  })

  it("position de l'article : la requête correspondante de la page, sinon « pas encore classé »", () => {
    const k = editorKeywordFromRow(keywordRow())
    const ranked = withPageMetrics(k, [
      { query: "devis maçon", clicks: 1, impressions: 40, position: 9 },
      { query: "exemple devis maconnerie", clicks: 3, impressions: 120, position: 12.4 },
    ])
    expect(ranked).toMatchObject({ position: 12.4, clicks: 3, impressions: 120, volume: k.volume })
    expect(withPageMetrics(k, [{ query: "devis maçon", clicks: 1, impressions: 40, position: 9 }])).toMatchObject({ position: null, clicks: null, impressions: null })
  })
})

/* ------------------------------------------------------------------ */
/* Lecture complète                                                    */
/* ------------------------------------------------------------------ */

function gscFor(path: string): Gsc {
  const pages: GscPageRow[] = []
  const queries: GscQueryRow[] = []
  for (const date of ["2026-10-08", "2026-10-10", "2026-10-13"]) {
    pages.push({ date, page: path, device: "MOBILE", country: "fra", clicks: 1, impressions: 20, position: 10 })
    pages.push({ date, page: `${path}/`, device: "DESKTOP", country: "fra", clicks: 0, impressions: 10, position: 16 })
    pages.push({ date, page: "/modele", device: "MOBILE", country: "fra", clicks: 9, impressions: 900, position: 4 })
    queries.push({ date, query: "exemple devis maconnerie", page: path, clicks: 1, impressions: 15, position: 12 })
    queries.push({ date, query: "devis maçon", page: path, clicks: 0, impressions: 5, position: 20 })
    queries.push({ date, query: "modele devis", page: "/modele", clicks: 9, impressions: 900, position: 4 })
  }
  return { bounds: { first_date: "2025-06-01", last_date: "2026-10-13" }, pages, queries, failing: false }
}

describe("loadArticleDetails", () => {
  let fake: FakeArticlesDb
  let gsc: Gsc

  beforeEach(() => {
    const p = post({ id: "11111111-1111-4111-8111-111111111111" })
    fake = fakeArticlesDb({ blog_posts: [p, post({ id: uuid(), slug: "autre", title: "Un autre article du blog" })], seo_settings: [], seo_keywords: [keywordRow({ keyword: "exemple devis maconnerie", volume: null }) as unknown as Row] })
    gsc = gscFor("/blog/exemple-devis-maconnerie")
    fake.tables.seo_gsc_pages = gscPagesTable(gsc)
  })

  it("article publié : performances de la page seule, courbe, requêtes, position de l'article, qualité", async () => {
    const d = (await loadArticleDetails(detailsClient(fake, gsc), "11111111-1111-4111-8111-111111111111", NOW)) as ArticleDetailsPayload
    expect(d.post).toMatchObject({ status: "published", type: "howto", source: "ai", coverAlt: "Maçon montant un mur en parpaings", targetKeyword: "exemple devis maçonnerie", keywords: ["devis maçonnerie"] })
    expect(d.performance).toMatchObject({ connected: true, lastDate: "2026-10-13", error: null })
    // « /blog/x » et « /blog/x/ » lus ensemble, « /modele » écarté
    expect(d.performance.last28).toMatchObject({ clicks: 3, impressions: 90 })
    expect(d.performance.last28.position).toBe(12)
    expect(d.performance.sincePublished).toMatchObject({ clicks: 3, impressions: 90 })
    // Publié le 7 (heure de Paris) : courbe du 7 au 13
    expect(d.performance.series.map((s) => s.day)).toEqual(["2026-10-07", "2026-10-08", "2026-10-09", "2026-10-10", "2026-10-11", "2026-10-12", "2026-10-13"])
    expect(d.performance.series.find((s) => s.day === "2026-10-10")).toEqual({ day: "2026-10-10", clicks: 1, impressions: 30 })
    expect(d.performance.queries.map((q) => q.query)).toEqual(["exemple devis maconnerie", "devis maçon"])
    expect(d.keyword).toMatchObject({ keyword: "exemple devis maconnerie", fromPlan: true, volume: 170, position: 12, impressions: 45, clicks: 3 })
    expect(d.quality.words).toBeGreaterThan(10)
    expect(d.quality.h2).toBe(2)
    expect(d.quality.internalLinks).toBe(1)
    expect(d.quality.issues.length).toBeGreaterThan(0)
    expect(d.quality.issues.length).toBeLessThanOrEqual(6)
    expect(d.quality.issues.every((i) => i.status === "warn" || i.status === "error")).toBe(true)
  })

  it("Search Console illisible : la fiche s'affiche quand même, « non reliée » avec un message", async () => {
    gsc.failing = true
    const spy = vi.spyOn(console, "error").mockImplementation(() => {})
    const d = (await loadArticleDetails(detailsClient(fake, gsc), "11111111-1111-4111-8111-111111111111", NOW)) as ArticleDetailsPayload
    spy.mockRestore()
    expect(d.performance).toEqual({ connected: false, lastDate: null, last28: { clicks: 0, impressions: 0, ctr: null, position: null }, sincePublished: null, series: [], queries: [], error: GSC_READ_ERROR })
    // Mesures de l'onglet Mots-clés gardées (pas de position d'article inventée)
    expect(d.keyword).toMatchObject({ keyword: "exemple devis maconnerie", position: 4.5 })
    expect(d.quality.score).toBeGreaterThan(0)
  })

  it("Search Console jamais synchronisée : non reliée, sans message d'erreur", async () => {
    gsc.bounds = { first_date: null, last_date: null }
    const d = (await loadArticleDetails(detailsClient(fake, gsc), "11111111-1111-4111-8111-111111111111", NOW)) as ArticleDetailsPayload
    expect(d.performance).toMatchObject({ connected: false, error: null, series: [] })
  })

  it("colonnes de la migration 20261006 absentes : relue sans elles", async () => {
    const d = (await loadArticleDetails(detailsClient(fake, gsc, { missingColumns: ["cover_alt"] }), "11111111-1111-4111-8111-111111111111", NOW)) as ArticleDetailsPayload
    expect(d.post).toMatchObject({ coverAlt: null, seoTitle: null, seoDescription: null, title: "Exemple de devis de maçonnerie : modèle gratuit et chiffré" })
  })

  it("article programmé sans mot-clé : statut, pas de « depuis la publication », pas de mot-clé", async () => {
    fake.tables.blog_posts[0] = post({ id: "11111111-1111-4111-8111-111111111111", is_published: false, published_at: null, scheduled_at: "2026-10-22T06:00:00Z", review_status: null, target_keyword: null })
    const d = (await loadArticleDetails(detailsClient(fake, gsc), "11111111-1111-4111-8111-111111111111", NOW)) as ArticleDetailsPayload
    expect(d.post.status).toBe("scheduled")
    expect(d.performance.sincePublished).toBeNull()
    expect(d.keyword).toBeNull()
  })

  it("article absent : null", async () => {
    expect(await loadArticleDetails(detailsClient(fake, gsc), uuid(), NOW)).toBeNull()
  })
})

/* ------------------------------------------------------------------ */
/* Route                                                               */
/* ------------------------------------------------------------------ */

describe("GET /api/admin/seo/articles/posts/<id>", () => {
  const req = (id: string) => new NextRequest(`http://localhost/api/admin/seo/articles/posts/${id}`)
  const params = (id: string) => ({ params: Promise.resolve({ id }) })
  const ID = "22222222-2222-4222-8222-222222222222"
  let fake: FakeArticlesDb

  beforeEach(() => {
    state.admin = true
    fake = fakeArticlesDb({ blog_posts: [post({ id: ID })], seo_settings: [], seo_keywords: [] })
    const gsc = gscFor("/blog/exemple-devis-maconnerie")
    fake.tables.seo_gsc_pages = gscPagesTable(gsc)
    state.client = detailsClient(fake, gsc)
  })

  it("401 sans session, 400 pour un identifiant invalide, 404 pour un article absent", async () => {
    state.admin = false
    expect((await getPost(req(ID), params(ID))).status).toBe(401)
    state.admin = true
    expect((await getPost(req("abc"), params("abc"))).status).toBe(400)
    const missing = await getPost(req(uuid()), params(uuid()))
    expect(missing.status).toBe(404)
    expect((await missing.json()).error).toMatch(/introuvable/)
  })

  it("200 avec la fiche ; 503 si l'article ne peut pas être lu", async () => {
    const res = await getPost(req(ID), params(ID))
    expect(res.status).toBe(200)
    const body = (await res.json()) as ArticleDetailsPayload
    expect(body.post.id).toBe(ID)
    expect(body.performance.connected).toBe(true)
    fake.failing.add("blog_posts")
    const down = await getPost(req(ID), params(ID))
    expect(down.status).toBe(503)
    expect((await down.json()).error).toMatch(/Réessayez/)
  })
})

/* ------------------------------------------------------------------ */
/* Fenêtre : formats et rendu                                          */
/* ------------------------------------------------------------------ */

function payload(over: Partial<ArticleDetailsPayload> = {}): ArticleDetailsPayload {
  return {
    post: {
      id: "33333333-3333-4333-8333-333333333333",
      slug: "exemple-devis-maconnerie",
      title: "Exemple de devis de maçonnerie",
      excerpt: null,
      coverUrl: null,
      coverAlt: null,
      status: "published",
      type: "howto",
      source: "ai",
      publishedAt: "2026-10-07T19:19:00Z",
      scheduledAt: null,
      createdAt: "2026-10-01T08:00:00Z",
      updatedAt: null,
      targetKeyword: "exemple devis maçonnerie",
      seoTitle: null,
      seoDescription: null,
      keywords: [],
      heldReason: null,
    },
    performance: {
      connected: true,
      lastDate: "2026-10-13",
      last28: { clicks: 3, impressions: 90, ctr: 3 / 90, position: 12.4 },
      sincePublished: { clicks: 3, impressions: 90, ctr: 3 / 90, position: 12.4 },
      series: [
        { day: "2026-10-12", clicks: 1, impressions: 30 },
        { day: "2026-10-13", clicks: 2, impressions: 60 },
      ],
      queries: [{ query: "exemple devis maçonnerie", clicks: 3, impressions: 45, position: 12.4 }],
      error: null,
    },
    keyword: { id: null, keyword: "exemple devis maçonnerie", status: null, intent: "informational", volume: 880, difficulty: 45, position: 12.4, clicks: 3, impressions: 45, targetPath: null, fromPlan: true },
    quality: { score: 72, words: 1842, readingMinutes: 8, h2: 6, internalLinks: 4, images: 1, issues: [{ label: "Valeur périmée", status: "error", detail: "« 36 800 € »", blocking: true }] },
    ...over,
  }
}

const sections = (d: ArticleDetailsPayload) => html(createElement(Dialog.ArticleDetailsSections, { details: d, period: "28d", onPeriodChange: () => {}, onRetry: () => {} }))

describe("fenêtre d'un article", () => {
  it("formats : dates longues à l'heure de Paris, difficulté, appréciation", () => {
    expect(Dialog.longDay("2026-10-20")).toBe("mardi 20\u00a0octobre")
    expect(flat(Dialog.longDay("2026-10-01", { year: true, capitalize: true }))).toBe("Jeudi 1er octobre 2026")
    expect(flat(Dialog.longDateTime("2026-10-07T19:19:00Z"))).toBe("mercredi 7 octobre 2026 à 21:19")
    const base = payload().post
    expect(flat(Dialog.articleDateLine(base)?.text ?? "")).toBe("Publié le mercredi 7 octobre 2026 à 21:19")
    expect(flat(Dialog.articleDateLine({ ...base, status: "scheduled", scheduledAt: "2026-10-22T06:00:00Z" })?.text ?? "")).toBe("Programmé pour le jeudi 22 octobre 2026 à 08:00")
    expect(flat(Dialog.articleDateLine({ ...base, status: "draft" })?.text ?? "")).toBe("Créé le jeudi 1er octobre 2026 à 10:00")
    // Retenu par le contrôle à son heure : la date prévue reste visible
    expect(flat(Dialog.articleDateLine({ ...base, status: "to_review", publishedAt: null, scheduledAt: "2026-10-14T06:00:00Z" })?.text ?? "")).toBe("Prévu le mercredi 14 octobre 2026 à 08:00")
    expect([Dialog.difficultyOf(12)?.label, Dialog.difficultyOf(30)?.label, Dialog.difficultyOf(60)?.label, Dialog.difficultyOf(null)]).toEqual(["Facile", "Moyenne", "Difficile", null])
    expect([Dialog.scoreVerdict(85), Dialog.scoreVerdict(60), Dialog.scoreVerdict(20)]).toEqual(["Bon", "À améliorer", "Insuffisant"])
  })

  it("replanifier : instant de Paris à venir, un an au plus", () => {
    const now = new Date("2026-10-16T10:00:00Z")
    expect(Dialog.rescheduleInstant("2026-10-22", "08:00", now)).toEqual({ ok: true, iso: "2026-10-22T06:00:00.000Z" })
    // Passage à l'heure d'hiver le 25 octobre : 08:00 à Paris = 07:00 UTC
    expect(Dialog.rescheduleInstant("2026-10-26", "08:00", now)).toEqual({ ok: true, iso: "2026-10-26T07:00:00.000Z" })
    expect(Dialog.rescheduleInstant("2026-10-16", "11:00", now)).toEqual({ ok: false, error: "Choisissez une date et une heure à venir." })
    expect(Dialog.rescheduleInstant("2027-12-01", "08:00", now).ok).toBe(false)
    expect(Dialog.rescheduleInstant("", "08:00", now).ok).toBe(false)
  })

  it("en-tête : statut, type, source, date, adresse à copier, couverture absente", () => {
    const out = html(createElement(Dialog.DetailsHeader, { post: payload().post, title: createElement("h2", null, "Titre") }))
    for (const s of ["Publié", "How-to", "Génération IA", "Publié le mercredi 7 octobre 2026 à 21:19", "qonforme.fr/blog/exemple-devis-maconnerie", "Copier", "Sans couverture"]) expect(out).toContain(s)
  })

  it("performances, mots-clés et qualité d'un article publié", () => {
    const out = sections(payload())
    for (const s of [
      "Performances dans Google",
      "28 derniers jours",
      "Depuis la publication",
      "Taux de clic",
      "Position moyenne",
      "12,4",
      "Données Search Console jusqu&#x27;au 13 oct. (2 à 3 jours de décalage).",
      "Recherches qui affichent l&#x27;article",
      "Mot-clé principal",
      "880",
      "recherches/mois",
      "Moyenne",
      "Plan d&#x27;octobre",
      "Qualité",
      "À améliorer",
      "1 842",
      "Bloque la publication",
      "Corriger dans l&#x27;éditeur",
    ])
      expect(out).toContain(s)
  })

  it("états : Search Console non reliée, illisible, article programmé, publié sans données, aucun mot-clé, tout en ordre", () => {
    const off = payload({ performance: { ...payload().performance, connected: false, lastDate: null, series: [], queries: [], sincePublished: null } })
    const offHtml = sections(off)
    expect(offHtml).toContain("Search Console n&#x27;a encore rien transmis")
    expect(offHtml).toContain('href="/admin/seo/parametres/connexions"')
    expect(offHtml).toContain("Reliez Search Console pour voir les recherches")

    const failed = sections(payload({ performance: { ...off.performance, error: GSC_READ_ERROR } }))
    expect(failed).toContain("Performances indisponibles")
    expect(failed).toContain("Réessayer")

    const scheduled = payload({
      post: { ...payload().post, status: "scheduled", publishedAt: null, scheduledAt: "2026-10-22T06:00:00Z" },
      performance: { ...payload().performance, last28: { clicks: 0, impressions: 0, ctr: null, position: null }, sincePublished: null, series: [], queries: [] },
      keyword: null,
      quality: { ...payload().quality, score: 90, issues: [] },
    })
    const scheduledHtml = sections(scheduled)
    expect(scheduledHtml).toContain("Pas encore en ligne")
    expect(scheduledHtml).toContain("Aucun mot-clé principal : choisissez-le dans l&#x27;éditeur.")
    expect(scheduledHtml).toContain("Tout est en ordre.")
    expect(scheduledHtml).toContain("Bon")

    const fresh = sections(
      payload({
        performance: { ...payload().performance, last28: { clicks: 0, impressions: 0, ctr: null, position: null }, sincePublished: { clicks: 0, impressions: 0, ctr: null, position: null }, series: [{ day: "2026-10-13", clicks: 0, impressions: 0 }], queries: [] },
        keyword: { ...payload().keyword!, position: null },
      }),
    )
    expect(fresh).toContain("Google n&#x27;a pas encore affiché cet article : une nouvelle page met souvent plusieurs jours à apparaître.")
    expect(fresh).toContain("Pas encore classé")
  })
})

/* ------------------------------------------------------------------ */
/* Calendrier : bouton « + »                                           */
/* ------------------------------------------------------------------ */

function calendar(): CalendarData {
  const weeks = monthGrid("2026-10")
  return {
    month: "2026-10",
    label: "Octobre 2026",
    prev: "2026-09",
    next: "2026-11",
    today: "2026-10-07",
    weeks: weeks.map((days) => ({
      monday: days[0],
      days: days.map((day) => ({
        day,
        inMonth: day.startsWith("2026-10"),
        isToday: day === "2026-10-07",
        events:
          day === "2026-10-09"
            ? [{ key: "post-1", kind: "post" as const, id: "1", title: "Article du vendredi", type: "guide" as const, status: "scheduled" as const, day, time: "08:00", keyword: null, sourceTag: null, href: "/admin/blog/1", topic: null }]
            : [],
      })),
    })),
    unplanned: [],
    slots: [],
    defaultMode: "draft",
    coverImage: true,
    publishTime: "08:00",
  }
}

describe("calendrier : « + » d'un jour", () => {
  it("aujourd'hui et les jours à venir seulement ; l'article ouvre sa fenêtre", () => {
    const out = html(createElement(Calendar.CalendarView, { data: calendar(), filter: null, generate: null }))
    expect(out).toContain('aria-label="Ajouter un article le mercredi 7 octobre"')
    expect(out).toContain('aria-label="Ajouter un article le vendredi 9 octobre"')
    expect(out).not.toContain("Ajouter un article le mardi 6 octobre")
    expect(out).not.toContain("Ajouter un article le lundi 28 septembre")
    // Téléphone : semaines vides à venir
    expect(out).toContain("Ajouter un article cette semaine")
    expect(out).toContain("Aucun article.")
    // Un article est un bouton (fenêtre), plus un lien vers l'éditeur
    expect(out).not.toContain('href="/admin/blog/1"')
    expect(out).toContain('aria-haspopup="dialog"')
  })

  it("téléphone : semaine aux articles déjà passés, « Ajouter un article cette semaine » en version compacte", () => {
    const data = calendar()
    // Article du lundi 5 (passé) ; aujourd'hui mercredi 7, jours libres jusqu'au dimanche
    data.weeks.forEach((w) =>
      w.days.forEach((d) => {
        d.events = d.day === "2026-10-05" ? [{ ...calendar().weeks[1].days[4].events[0], key: "post-0", id: "0", day: d.day, status: "published" as const }] : []
      }),
    )
    const out = html(createElement(Calendar.CalendarView, { data, filter: null, generate: null }))
    expect(out).toContain("À partir du mercredi 7 octobre")
    // Une semaine aux jours à venir déjà occupés garde ses « + » de jour, sans bouton de semaine en plus
    const busy = calendar()
    const busyOut = html(createElement(Calendar.CalendarView, { data: busy, filter: null, generate: null }))
    expect(busyOut).not.toContain("À partir du")
  })

  it("heure proposée : Préférences, prochain quart d'heure aujourd'hui, lendemain trop tard", () => {
    const morning = new Date("2026-10-16T04:00:00Z") // 6 h à Paris
    expect(Calendar.plannedSlot("2026-10-20", "2026-10-16", "08:00", morning)).toEqual({ day: "2026-10-20", time: "08:00", shifted: false })
    expect(Calendar.plannedSlot("2026-10-16", "2026-10-16", "08:00", morning)).toEqual({ day: "2026-10-16", time: "08:00", shifted: false })
    const noon = new Date("2026-10-16T10:07:00Z") // 12:07 à Paris
    expect(Calendar.plannedSlot("2026-10-16", "2026-10-16", "08:00", noon)).toEqual({ day: "2026-10-16", time: "12:45", shifted: true })
    const late = new Date("2026-10-16T21:30:00Z") // 23:30 à Paris
    expect(Calendar.plannedSlot("2026-10-16", "2026-10-16", "08:00", late)).toEqual({ day: "2026-10-17", time: "08:00", shifted: true })
  })

  it("avertissement des jours déjà occupés", () => {
    expect([Calendar.alreadyPlannedLabel(0), Calendar.alreadyPlannedLabel(1), Calendar.alreadyPlannedLabel(2)]).toEqual([null, "1 article déjà prévu ce jour", "2 articles déjà prévus ce jour"])
  })

  it("page restée ouverte depuis la veille : « aujourd'hui » se lit à l'horloge", () => {
    const noon = new Date("2026-10-16T10:07:00Z") // 12:07 à Paris, le 16
    // La page dit encore « aujourd'hui = 15 » : le 16 est bien aujourd'hui, l'heure passée est décalée
    expect(Calendar.plannedSlot("2026-10-16", "2026-10-15", "08:00", noon)).toEqual({ day: "2026-10-16", time: "12:45", shifted: true })
    expect(Calendar.isPastDay("2026-10-15", noon)).toBe(true)
    expect(Calendar.isPastDay("2026-10-16", noon)).toBe(false)
    // Minuit passé à Paris (22 h 30 UTC = 0 h 30 le 17)
    expect(Calendar.isPastDay("2026-10-16", new Date("2026-10-16T22:30:00Z"))).toBe(true)
  })

  it("jours occupés comptés sans le filtre de statut (un filtre « Publié » ne libère pas un jour)", async () => {
    const at = "2026-10-22T06:00:00Z"
    const fake = fakeArticlesDb({
      blog_posts: [
        post({ id: uuid(), slug: "a", is_published: false, published_at: null, scheduled_at: at, review_status: null }),
        post({ id: uuid(), slug: "b", is_published: false, published_at: null, scheduled_at: at, review_status: null }),
      ],
      seo_topics: [],
      seo_settings: [],
    })
    const filtered = await loadCalendar(fake.client as SeoDb, "2026-10", NOW, "published")
    const day = filtered.weeks.flatMap((w) => w.days).find((d) => d.day === "2026-10-22")
    expect(day?.events).toEqual([])
    expect(filtered.dayCounts?.["2026-10-22"]).toBe(2)
    expect(filtered.publishTime).toMatch(/^\d{2}:\d{2}$/)
  })

  it("page du calendrier : fenêtre « Générer » chargée avec lui, réglages lus une fois, sujets envoyés une fois", async () => {
    const fake = fakeArticlesDb({
      blog_posts: [],
      seo_topics: [
        { id: uuid(), title: "Sujet à planifier", keyword: null, article_type: "guide", angle: null, notes: null, source: "manual", keyword_id: null, status: "unplanned", scheduled_at: null, publish_mode: "draft", post_id: null, last_error: null, created_at: "2026-10-01T08:00:00Z", updated_at: "2026-10-01T08:00:00Z" },
      ],
      seo_settings: [],
      seo_keywords: [{ id: uuid(), keyword: "devis placo", status: "targeted" }],
    })
    const base = fake.client as { from: (t: string) => unknown }
    const reads: string[] = []
    const client = { ...base, from: (t: string) => (reads.push(t), base.from(t)) } as unknown as SeoDb
    const { calendar, generate } = await loadCalendarPage(client, "2026-10", NOW, null)
    expect(reads.filter((t) => t === "seo_settings")).toHaveLength(1)
    expect(calendar.unplanned.map((t) => t.title)).toEqual(["Sujet à planifier"])
    expect(generate).not.toHaveProperty("topics")
    expect(generate).toMatchObject({ keywords: [{ keyword: "devis placo", status: "targeted" }], slot: calendar.slots[0] ?? null })
  })
})
