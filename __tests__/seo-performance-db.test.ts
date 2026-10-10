/**
 * Module Performance avec une base simulée (sous-ensemble de PostgREST et
 * fonctions SQL seo_gsc_* recopiées en JavaScript) :
 * - synchronisation de Search Console (rafraîchissement, reprise, curseur) ;
 * - lectures de la Vue d'ensemble (totaux, période précédente, jours vides) ;
 * - priorités, articles, visibilité IA ;
 * - mesure hebdomadaire PageSpeed ;
 * - routes : 401 sans session admin, 503 migration absente, 409 analyse en
 *   cours, 400 chemin hors du site, mesure enregistrée.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

type Row = Record<string, unknown>
type DbError = { code?: string; message: string }
type Filter = (row: Row) => boolean

interface FakeDb {
  tables: Record<string, Row[]>
  missing: Set<string>
  client: unknown
}

function cmp(a: unknown, b: unknown): number {
  if (a === b) return 0
  if (a === null || a === undefined) return -1
  if (b === null || b === undefined) return 1
  if (typeof a === "number" && typeof b === "number") return a - b
  return String(a) < String(b) ? -1 : 1
}

/** Agrégat des fonctions SQL : sommes et position pondérée par les impressions. */
function agg(rows: Row[]) {
  const clicks = rows.reduce((s, r) => s + Number(r.clicks), 0)
  const impressions = rows.reduce((s, r) => s + Number(r.impressions), 0)
  const weighted = rows.reduce((s, r) => s + Number(r.position) * Number(r.impressions), 0)
  return { clicks, impressions, avg_position: impressions === 0 ? null : weighted / impressions }
}

function groupBy(rows: Row[], key: string) {
  const out = new Map<string, Row[]>()
  rows.forEach((r) => out.set(String(r[key]), [...(out.get(String(r[key])) ?? []), r]))
  return Array.from(out.entries())
}

function fakeDb(initial: Record<string, Row[]> = {}): FakeDb {
  let nextId = 1
  const db: FakeDb = { tables: {}, missing: new Set(), client: null }
  Object.entries(initial).forEach(([t, rows]) => (db.tables[t] = rows.map((r) => ({ ...r }))))
  const rowsOf = (t: string) => (db.tables[t] ??= [])

  const inRange = (table: string, a: Row) =>
    rowsOf(table).filter(
      (r) =>
        String(r.date) >= String(a.p_from) &&
        String(r.date) <= String(a.p_to) &&
        (a.p_device == null || r.device === a.p_device) &&
        (a.p_country == null || r.country === a.p_country),
    )

  const RPC: Record<string, { table: string; fn: (a: Row) => Row[] }> = {
    seo_gsc_bounds: {
      table: "seo_gsc_daily",
      fn: () => {
        const dates = rowsOf("seo_gsc_daily").map((r) => String(r.date)).sort()
        return [{ first_date: dates[0] ?? null, last_date: dates[dates.length - 1] ?? null }]
      },
    },
    seo_gsc_totals: { table: "seo_gsc_daily", fn: (a) => [agg(inRange("seo_gsc_daily", a))] },
    seo_gsc_by_date: {
      table: "seo_gsc_daily",
      fn: (a) => groupBy(inRange("seo_gsc_daily", a), "date").map(([date, rows]) => ({ date, ...agg(rows) })).sort((x, y) => cmp(x.date, y.date)),
    },
    seo_gsc_by_page: {
      table: "seo_gsc_pages",
      fn: (a) => groupBy(inRange("seo_gsc_pages", a), "page").map(([page, rows]) => ({ page, ...agg(rows) })).sort((x, y) => y.impressions - x.impressions),
    },
    seo_gsc_by_query: {
      table: "seo_gsc_queries",
      fn: (a) => groupBy(inRange("seo_gsc_queries", a), "query").map(([query, rows]) => ({ query, ...agg(rows) })).sort((x, y) => y.impressions - x.impressions),
    },
  }

  function builder(table: string, rpc?: { name: string; args: Row }) {
    const filters: Filter[] = []
    const orders: { col: string; asc: boolean; nullsFirst: boolean }[] = []
    let kind: "select" | "insert" | "update" | "upsert" | "delete" = "select"
    let values: Row | Row[] | null = null
    let upsertOpts: { onConflict?: string; ignoreDuplicates?: boolean } = {}
    let returning = false
    let count = false
    let limit: number | null = null
    let single: "single" | "maybe" | null = null

    const finish = (out: Row[], total?: number): { data: unknown; error: DbError | null; count?: number | null } => {
      if (single) {
        if (out.length === 0) return single === "maybe" ? { data: null, error: null } : { data: null, error: { code: "PGRST116", message: "0 rows" } }
        return { data: out[0], error: null }
      }
      return { data: kind !== "select" && !returning ? null : out, error: null, count: total ?? null }
    }

    const run = () => {
      if (rpc) {
        const def = RPC[rpc.name]
        if (!def || db.missing.has(def.table) || db.missing.has(rpc.name)) {
          return { data: null, error: { code: "PGRST202", message: `Could not find the function public.${rpc.name}` } }
        }
        let out = def.fn(rpc.args).filter((r) => filters.every((f) => f(r)))
        if (limit !== null) out = out.slice(0, limit)
        return finish(out)
      }
      if (db.missing.has(table)) return { data: null, error: { code: "PGRST205", message: `Could not find the table 'public.${table}' in the schema cache` } }
      const rows = rowsOf(table)
      if (kind === "insert" || kind === "upsert") {
        const list = Array.isArray(values) ? values : [values as Row]
        const out: Row[] = []
        list.forEach((v) => {
          if (kind === "upsert") {
            const keys = (upsertOpts.onConflict ?? "id").split(",")
            const existing = rows.find((r) => keys.every((k) => r[k] === v[k]))
            if (existing) {
              if (!upsertOpts.ignoreDuplicates) Object.assign(existing, v)
              out.push({ ...existing })
              return
            }
          }
          const row = { id: `row-${nextId++}`, ...v }
          rows.push(row)
          out.push({ ...row })
        })
        return finish(out)
      }
      const matched = rows.filter((r) => filters.every((f) => f(r)))
      if (kind === "update") {
        matched.forEach((r) => Object.assign(r, values))
        return finish(matched.map((r) => ({ ...r })))
      }
      if (kind === "delete") {
        db.tables[table] = rows.filter((r) => !matched.includes(r))
        return finish(matched.map((r) => ({ ...r })))
      }
      let out = matched.map((r) => ({ ...r }))
      orders
        .slice()
        .reverse()
        .forEach((o) =>
          out.sort((a, b) => {
            const na = a[o.col] === null || a[o.col] === undefined
            const nb = b[o.col] === null || b[o.col] === undefined
            if (na !== nb) return na ? (o.nullsFirst ? -1 : 1) : o.nullsFirst ? 1 : -1
            return o.asc ? cmp(a[o.col], b[o.col]) : cmp(b[o.col], a[o.col])
          }),
        )
      if (limit !== null) out = out.slice(0, limit)
      return finish(out, count ? matched.length : undefined)
    }

    const api = {
      select: (_cols?: string, opts?: { count?: string }) => {
        if (kind !== "select") returning = true
        if (opts?.count) count = true
        return api
      },
      insert: (v: Row | Row[]) => ((kind = "insert"), (values = v), api),
      upsert: (v: Row | Row[], opts?: { onConflict?: string; ignoreDuplicates?: boolean }) => ((kind = "upsert"), (values = v), (upsertOpts = opts ?? {}), api),
      update: (v: Row) => ((kind = "update"), (values = v), api),
      delete: () => ((kind = "delete"), api),
      eq: (k: string, v: unknown) => (filters.push((r) => r[k] === v), api),
      is: (k: string, v: unknown) => (filters.push((r) => (v === null ? r[k] === null || r[k] === undefined : r[k] === v)), api),
      in: (k: string, list: unknown[]) => (filters.push((r) => list.includes(r[k])), api),
      gte: (k: string, v: unknown) => (filters.push((r) => cmp(r[k], v) >= 0), api),
      lte: (k: string, v: unknown) => (filters.push((r) => cmp(r[k], v) <= 0), api),
      lt: (k: string, v: unknown) => (filters.push((r) => r[k] !== null && r[k] !== undefined && cmp(r[k], v) < 0), api),
      // Seul motif utilisé (verrou de lib/seo/cron.ts) : « col.is.null,col.lt."valeur" »
      or: (expr: string) => {
        const parts = expr.split(/,(?=[a-z_]+\.)/).map((p) => p.match(/^([a-z_]+)\.(is|lt)\.(.+)$/))
        filters.push((r) =>
          parts.some((m) => {
            if (!m) return false
            const v = r[m[1]]
            if (m[2] === "is") return v === null || v === undefined
            return v !== null && v !== undefined && String(v) < m[3].replace(/^"|"$/g, "")
          }),
        )
        return api
      },
      order: (col: string, opts?: { ascending?: boolean; nullsFirst?: boolean }) => (
        orders.push({ col, asc: opts?.ascending !== false, nullsFirst: opts?.nullsFirst ?? opts?.ascending === false }), api
      ),
      limit: (n: number) => ((limit = n), api),
      single: () => ((single = "single"), Promise.resolve(run())),
      maybeSingle: () => ((single = "maybe"), Promise.resolve(run())),
      then: (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) => Promise.resolve(run()).then(resolve, reject),
    }
    return api
  }

  db.client = { from: (t: string) => builder(t), rpc: (name: string, args: Row = {}) => builder(`rpc:${name}`, { name, args }) }
  return db
}

/* ------------------------------------------------------------------ */
/* Simulations des modules                                             */
/* ------------------------------------------------------------------ */

let db: FakeDb
let admin = true
const gscCalls: { startDate: string; endDate: string; dimensions: string[] }[] = []
let pagespeedResponse: Record<string, unknown> | Error = {}

vi.mock("@/lib/admin-require", () => ({ isAdminAuthenticated: () => Promise.resolve(admin) }))
vi.mock("@/lib/supabase/server", () => ({ createAdminClient: () => db.client, createClient: () => db.client }))
vi.mock("@/lib/seo/actions/task", () => ({
  findingsTask: { name: "findings", label: "SEO · Actions", isDue: () => false, run: async () => ({ open: 0 }) },
}))
vi.mock("@/lib/seo/google", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/seo/google")>()
  return {
    ...actual,
    gscQuery: vi.fn(async (body: { startDate: string; endDate: string; dimensions: string[] }) => {
      gscCalls.push(body)
      const dims = body.dimensions.join(",")
      if (body.startDate > "2026-10-06" || body.endDate < "2026-10-06") return []
      // Une journée de données, le 6 oct., pour chaque requête
      if (dims === "date,device,country") return [{ keys: ["2026-10-06", "MOBILE", "fra"], clicks: 1, impressions: 20, ctr: 0.05, position: 8 }]
      if (dims === "date,page,device,country")
        return [
          { keys: ["2026-10-06", "https://qonforme.fr/modele/", "MOBILE", "fra"], clicks: 1, impressions: 12, ctr: 0, position: 6 },
          { keys: ["2026-10-06", "https://www.qonforme.fr/modele", "MOBILE", "fra"], clicks: 0, impressions: 8, ctr: 0, position: 11 },
          { keys: ["2026-10-06", "https://ailleurs.fr/", "MOBILE", "fra"], clicks: 3, impressions: 9, ctr: 0, position: 1 },
        ]
      if (dims === "date,query,device,country") return [{ keys: ["2026-10-06", "devis modele", "MOBILE", "fra"], clicks: 0, impressions: 15, ctr: 0, position: 2.7 }]
      return [{ keys: ["2026-10-06", "devis modele", "https://qonforme.fr/modele"], clicks: 0, impressions: 15, ctr: 0, position: 2.7 }]
    }),
    runPageSpeed: vi.fn(async (url: string) => {
      if (!url.startsWith("https://qonforme.fr/")) throw new actual.GoogleApiError(400, "PageSpeed ne mesure que les pages de qonforme.fr.")
      if (pagespeedResponse instanceof Error) throw pagespeedResponse
      return pagespeedResponse
    }),
  }
})

process.env.GOOGLE_SERVICE_ACCOUNT_JSON = JSON.stringify({ client_email: "seo@exemple.iam.gserviceaccount.com", private_key: "clé de test" })

import type { SeoJobRow, SeoTaskContext } from "@/lib/seo/cron"
import { runSearchConsoleSync, syncRange } from "@/lib/seo/search-console/sync"
import { readPages, readSearchPerformance } from "@/lib/seo/search-console/read"
import { articleOrigin, geoLines, readArticlesSummary, readGeoSnapshot, readPriorities } from "@/lib/seo/overview"
import { PageSpeedUnavailableError, runWeeklyPageSpeed } from "@/lib/seo/pagespeed/task"
import { readPageSpeedHistory } from "@/lib/seo/pagespeed/read"
import { GoogleApiError } from "@/lib/seo/google"
import { POST as syncRoute } from "@/app/api/admin/seo/search-console/sync/route"
import { POST as pagespeedRoute } from "@/app/api/admin/seo/pagespeed/route"
import { NextRequest } from "next/server"

function ctxFor(job: Partial<SeoJobRow>, opts: { now: Date; deadline?: number; trigger?: "cron" | "manual" }): SeoTaskContext & { saved: Record<string, unknown>[] } {
  const saved: Record<string, unknown>[] = []
  const row: SeoJobRow = {
    name: "search-console",
    status: "running",
    started_at: null,
    finished_at: null,
    last_ok_at: null,
    lock_until: null,
    cursor: {},
    result: null,
    error: null,
    ...job,
  }
  return {
    db: db.client as SeoTaskContext["db"],
    now: opts.now,
    deadline: opts.deadline ?? Date.now() + 60_000,
    trigger: opts.trigger ?? "cron",
    job: row,
    saved,
    saveCursor: async (cursor) => {
      saved.push(cursor)
      row.cursor = cursor
    },
  }
}

const NOW = new Date("2026-10-09T06:30:00Z") // vendredi 9 oct., 08:30 à Paris

beforeEach(() => {
  admin = true
  gscCalls.length = 0
  pagespeedResponse = {}
  db = fakeDb({ seo_jobs: [], cron_logs: [], seo_settings: [] })
})

afterEach(() => {
  vi.useRealTimers()
})

/* ------------------------------------------------------------------ */
/* Synchronisation                                                     */
/* ------------------------------------------------------------------ */

describe("synchronisation de Search Console", () => {
  it("sans compte de service : passage sauté sans erreur", async () => {
    const ctx = ctxFor({}, { now: NOW })
    expect(await runSearchConsoleSync(ctx, { configured: false })).toEqual({ skipped: "not_configured" })
    expect(gscCalls).toHaveLength(0)
  })

  it("premier passage : dernière semaine relue, puis reprise par tranches de 30 jours jusqu'à 16 mois", async () => {
    const ctx = ctxFor({}, { now: NOW })
    const result = await runSearchConsoleSync(ctx, { configured: true })
    expect(result.refreshed).toEqual({ from: "2026-10-02", to: "2026-10-08", complete: true })
    expect(result.backfill).toEqual({ until: "2025-06-09", done: true, slices: 16 })
    expect(ctx.job.cursor).toEqual({ refreshedOn: "2026-10-09", backfillUntil: "2025-06-09", backfillDone: true })
    // Première tranche de reprise : les 30 jours avant le 2 oct.
    expect(gscCalls.filter((c) => c.dimensions.length === 3 && c.dimensions[0] === "date" && c.dimensions[1] === "device")[1]).toMatchObject({
      startDate: "2026-09-02",
      endDate: "2026-10-01",
    })

    expect(db.tables.seo_gsc_daily).toEqual([
      expect.objectContaining({ date: "2026-10-06", device: "MOBILE", country: "fra", clicks: 1, impressions: 20, position: 8 }),
    ])
    // /modele/ et www.qonforme.fr/modele fusionnés ; ailleurs.fr ignoré
    expect(db.tables.seo_gsc_pages).toHaveLength(1)
    expect(db.tables.seo_gsc_pages[0]).toMatchObject({ page: "/modele", clicks: 1, impressions: 20, position: 8 })
    expect(db.tables.seo_gsc_query_pages[0]).toMatchObject({ query: "devis modele", page: "/modele" })
  })

  it("reprise interrompue à la limite, reprise au passage suivant", async () => {
    const ctx = ctxFor({}, { now: NOW, deadline: Date.now() + 16_000 })
    const first = await runSearchConsoleSync(ctx, { configured: true })
    // 5 s estimées par tranche + 15 s de marge : rien ne démarre
    expect(first.refreshed?.complete).toBe(false)
    expect(ctx.saved).toHaveLength(0)

    const next = ctxFor({ cursor: { refreshedOn: "2026-10-09", backfillUntil: "2026-03-01" } }, { now: NOW })
    const second = await runSearchConsoleSync(next, { configured: true })
    expect(second.refreshed).toBeUndefined()
    expect(second.backfill?.done).toBe(true)
    expect(next.saved[0]).toEqual({ refreshedOn: "2026-10-09", backfillUntil: "2026-01-30" })
  })

  it("seo_gsc_daily écrite en dernier : un échec plus haut laisse le marqueur d'avancement en arrière", async () => {
    db.missing.add("seo_gsc_query_pages")
    await expect(syncRange(db.client as never, { from: "2026-10-02", to: "2026-10-08" })).rejects.toThrow()
    expect(db.tables.seo_gsc_pages).toHaveLength(1)
    expect(db.tables.seo_gsc_daily ?? []).toHaveLength(0)
  })

  it("lignes devenues obsolètes retirées de la plage relue", async () => {
    db.tables.seo_gsc_pages = [{ date: "2026-10-06", page: "/ancienne", device: "MOBILE", country: "fra", clicks: 0, impressions: 3, position: 9, synced_at: "2026-10-07T04:00:00.000Z" }]
    await runSearchConsoleSync(ctxFor({ cursor: { backfillDone: true, refreshedOn: "2026-10-08" } }, { now: NOW }), { configured: true })
    expect(db.tables.seo_gsc_pages.map((r) => r.page)).toEqual(["/modele"])
  })
})

/* ------------------------------------------------------------------ */
/* Lectures                                                            */
/* ------------------------------------------------------------------ */

function daily(date: string, clicks: number, impressions: number, position: number, extra: Row = {}): Row {
  return { date, device: "MOBILE", country: "fra", clicks, impressions, position, ...extra }
}

describe("lectures Search Console", () => {
  it("totaux pondérés, série complète, jours en retard, comparaison", async () => {
    db.tables.seo_gsc_daily = [
      daily("2026-10-01", 0, 10, 10),
      daily("2026-10-01", 1, 30, 20, { device: "DESKTOP" }),
      daily("2026-10-03", 0, 10, 4),
      daily("2026-09-20", 0, 5, 30), // période précédente (7 jours : 20-26 sept.)
      daily("2026-09-25", 0, 8, 30),
      daily("2026-09-19", 4, 40, 3), // avant la période précédente : ignoré
      daily("2026-10-02", 0, 2, 50, { country: "bel" }), // filtré par le pays
    ]
    db.tables.seo_jobs = [{ name: "search-console", status: "ok", cursor: { backfillDone: true } }]
    const perf = await readSearchPerformance(db.client as never, { period: "7j", device: "all", country: "fr", now: NOW })
    expect(perf.bounds).toEqual({ first: "2026-09-19", last: "2026-10-03" })
    expect(perf.period.current).toEqual({ from: "2026-09-27", to: "2026-10-03" })
    expect(perf.totals.clicks).toBe(1)
    expect(perf.totals.impressions).toBe(50)
    // (10 × 10 + 20 × 30 + 4 × 10) / 50 = 14,8
    expect(perf.totals.position).toBeCloseTo(14.8, 10)
    expect(perf.totals.ctr).toBeCloseTo(0.02, 10)
    expect(perf.series).toHaveLength(7)
    expect(perf.series.find((d) => d.date === "2026-10-02")).toEqual({ date: "2026-10-02", clicks: 0, impressions: 0, ctr: null, position: null })
    expect(perf.period.previous).toEqual({ from: "2026-09-20", to: "2026-09-26" })
    expect(perf.previous).toMatchObject({ clicks: 0, impressions: 13, position: 30 })
    expect(perf.missingDays).toEqual(["2026-10-04", "2026-10-05", "2026-10-06", "2026-10-07", "2026-10-08"])
  })

  it("historique pas encore repris : aucune évolution affichée", async () => {
    db.tables.seo_gsc_daily = [daily("2026-10-01", 0, 10, 10)]
    db.tables.seo_jobs = [{ name: "search-console", status: "ok", cursor: { backfillUntil: "2026-09-30" } }]
    const perf = await readSearchPerformance(db.client as never, { period: "28j", device: "all", country: "fr", now: NOW })
    expect(perf.previous).toBeNull()
    expect(perf.sync?.backfillDone).toBe(false)
  })

  it("aucune donnée : pas de lecture des totaux, série vide", async () => {
    const perf = await readSearchPerformance(db.client as never, { period: "28j", device: "all", country: "fr", now: NOW })
    expect(perf.bounds.last).toBeNull()
    expect(perf.series.every((d) => d.impressions === 0)).toBe(true)
    expect(perf.sync).toBeNull()
  })

  it("pages par impressions décroissantes, filtrées par appareil", async () => {
    db.tables.seo_gsc_pages = [
      { date: "2026-10-01", page: "/", device: "MOBILE", country: "fra", clicks: 0, impressions: 11, position: 32.4 },
      { date: "2026-10-01", page: "/modele", device: "MOBILE", country: "fra", clicks: 0, impressions: 122, position: 6.2 },
      { date: "2026-10-01", page: "/demo", device: "DESKTOP", country: "fra", clicks: 0, impressions: 1, position: 3 },
    ]
    const pages = await readPages(db.client as never, { from: "2026-09-01", to: "2026-10-04" }, { device: "MOBILE", country: "fra" })
    expect(pages.map((p) => p.page)).toEqual(["/modele", "/"])
    expect(pages[0]).toMatchObject({ clicks: 0, impressions: 122, ctr: 0, position: 6.2 })
  })

  it("migration absente : SeoDbError « migration_pending », jamais une liste vide", async () => {
    db.missing.add("seo_gsc_daily")
    await expect(readSearchPerformance(db.client as never, { period: "28j", device: "all", country: "fr", now: NOW })).rejects.toMatchObject({
      kind: "migration_pending",
    })
  })
})

describe("Vue d'ensemble : priorités, articles, visibilité IA", () => {
  it("priorités : gravité puis date, total des constats ouverts", async () => {
    db.tables.seo_findings = [
      { id: "a", title: "Page à renforcer", path: "/guide", severity: "low", status: "open", detected_at: "2026-10-08T10:00:00Z" },
      { id: "b", title: "Page en baisse", path: "/facturation/fleuriste", severity: "medium", status: "open", detected_at: "2026-10-05T10:00:00Z" },
      { id: "c", title: "Page bien classée sans clic", path: "/modele", severity: "high", status: "open", detected_at: "2026-10-03T10:00:00Z" },
      { id: "d", title: "Page gagnante à renforcer", path: "/facturation/boulanger", severity: "medium", status: "open", detected_at: "2026-10-06T10:00:00Z" },
      { id: "e", title: "Déjà faite", path: "/", severity: "high", status: "done", detected_at: "2026-10-09T10:00:00Z" },
    ]
    const { items, total } = await readPriorities(db.client as never)
    expect(items.map((i) => i.id)).toEqual(["c", "d", "b"])
    expect(total).toBe(4)
  })

  it("priorités : un constat grave ancien passe avant 600 constats faibles récents", async () => {
    db.tables.seo_findings = [
      ...Array.from({ length: 600 }, (_, i) => ({
        id: `f${i}`, title: "Page à renforcer", path: `/p${i}`, severity: "low", status: "open", detected_at: "2026-10-08T10:00:00Z",
      })),
      { id: "grave", title: "Page bien classée sans clic", path: "/modele", severity: "high", status: "open", detected_at: "2026-08-01T10:00:00Z" },
    ]
    const { items, total } = await readPriorities(db.client as never)
    expect(items[0].id).toBe("grave")
    expect(items).toHaveLength(3)
    expect(total).toBe(601)
  })

  it("articles : dernier publié et deux prochains sujets planifiés", async () => {
    db.tables.blog_posts = [
      { id: "p1", title: "Ancien", slug: "ancien", is_published: true, published_at: "2026-09-01T10:00:00Z", source: null, ai_generated: true },
      { id: "p2", title: "Auto entrepreneur batiment", slug: "auto", is_published: true, published_at: "2026-10-07T19:19:00Z", source: "pushrank", ai_generated: false, article_type: "howto" },
      { id: "p3", title: "Brouillon", slug: "brouillon", is_published: false, published_at: null },
    ]
    db.tables.seo_topics = [
      { id: "t1", title: "Relancer une facture impayée", status: "planned", scheduled_at: "2026-10-13T06:00:00Z", article_type: "howto" },
      { id: "t2", title: "Plateforme agréée", status: "planned", scheduled_at: "2026-10-09T06:00:00Z", article_type: "guide" },
      { id: "t3", title: "Autoliquidation", status: "planned", scheduled_at: "2026-10-16T06:00:00Z", article_type: "guide" },
      { id: "t4", title: "Réforme 2027", status: "unplanned", scheduled_at: null, article_type: "news" },
    ]
    const summary = await readArticlesSummary(db.client as never)
    expect(summary.lastPublished).toMatchObject({ id: "p2", origin: "pushrank", articleType: "howto" })
    expect(summary.upcoming.map((t) => t.id)).toEqual(["t2", "t1"])
    expect(articleOrigin({ source: null, ai_generated: true })).toBe("ai")
    expect(articleOrigin({ source: null, ai_generated: false })).toBe("manual")
  })

  it("visibilité IA : dernier relevé terminé, une ligne par moteur", async () => {
    db.tables.seo_geo_runs = [
      {
        id: "r1",
        kind: "import",
        status: "done",
        created_at: "2026-09-28T12:00:00Z",
        finished_at: "2026-09-28T12:00:00Z",
        summary: {
          engines: {
            gemini: { mention_rate: 0, citation_rate: 0, mentions: 0, citations: 0, answers: 10 },
            chatgpt: { mention_rate: 0.2, citation_rate: 0, answers: 10 },
          },
          overall: { mention_rate: 0.1, citation_rate: 0 },
          domains: {},
        },
      },
      { id: "r2", kind: "monthly", status: "running", created_at: "2026-10-01T06:00:00Z", finished_at: null, summary: null },
    ]
    const geo = await readGeoSnapshot(db.client as never)
    expect(geo).toMatchObject({ runId: "r1", imported: true, mentionRate: 0.1, engineCount: 2 })
    expect(geo?.engines.map((e) => [e.key, e.mentions, e.answers])).toEqual([
      ["gemini", 0, 10],
      ["chatgpt", 2, 10],
      ["perplexity", null, null],
      ["claude", null, null],
      ["google_ai_overview", null, null],
    ])
  })
})

describe("visibilité IA : moteur interrogé sans réponse aboutie", () => {
  it("ni « 0 / 0 » ni moteur compté dans la moyenne", async () => {
    const lines = geoLines({
      engines: {
        gemini: { mention_rate: null, citation_rate: null, mentions: 0, citations: 0, answers: 0 },
        chatgpt: { mention_rate: 0.2, citation_rate: 0, answers: 10 },
      },
    } as never)
    expect(lines.find((l) => l.key === "gemini")).toMatchObject({ mentions: null, answers: null, rate: null, noAnswer: true })
    expect(lines.find((l) => l.key === "chatgpt")).toMatchObject({ mentions: 2, answers: 10, rate: 0.2 })

    db.tables.seo_geo_runs = [
      {
        id: "r1",
        kind: "monthly",
        status: "done",
        created_at: "2026-10-01T06:00:00Z",
        finished_at: "2026-10-01T07:00:00Z",
        summary: {
          engines: {
            gemini: { mention_rate: null, citation_rate: null, mentions: 0, citations: 0, answers: 0 },
            chatgpt: { mention_rate: 0.2, citation_rate: 0, answers: 10 },
          },
          overall: { mention_rate: 0.2, citation_rate: 0 },
          domains: {},
        },
      },
    ]
    expect(await readGeoSnapshot(db.client as never)).toMatchObject({ engineCount: 1, imported: false })
  })
})

/* ------------------------------------------------------------------ */
/* PageSpeed hebdomadaire                                              */
/* ------------------------------------------------------------------ */

const PSI = {
  lighthouseResult: {
    audits: {
      "largest-contentful-paint": { numericValue: 2712 },
      "cumulative-layout-shift": { numericValue: 0.01 },
      "total-blocking-time": { numericValue: 90 },
    },
    categories: { performance: { score: 0.9 } },
  },
}

describe("mesure hebdomadaire PageSpeed", () => {
  it("mesure chaque page sur mobile puis ordinateur, curseur après chaque mesure, semaine marquée faite", async () => {
    db.tables.seo_settings = [{ key: "pagespeed", value: { pages: [{ path: "/", label: "Accueil" }, { path: "/modele", label: "Modèles" }], weekly: true }, updated_at: "2026-10-09T00:00:00Z" }]
    const seen: string[] = []
    const ctx = ctxFor({ name: "pagespeed" }, { now: new Date("2026-10-12T04:00:00Z"), deadline: Date.now() + 10 * 60_000 })
    const result = await runWeeklyPageSpeed(ctx, { run: async (url, strategy) => (seen.push(`${url} ${strategy}`), PSI) })
    expect(seen).toEqual(["https://qonforme.fr/ mobile", "https://qonforme.fr/ desktop", "https://qonforme.fr/modele mobile", "https://qonforme.fr/modele desktop"])
    expect(result).toMatchObject({ week: "2026-10-12", measured: 4, remaining: 0 })
    expect(ctx.job.cursor).toMatchObject({ week: "2026-10-12", next: 4, completedWeek: "2026-10-12" })
    expect(db.tables.seo_pagespeed).toHaveLength(4)
    expect(db.tables.seo_pagespeed[0]).toMatchObject({ path: "/", strategy: "mobile", source: "api", lcp_ms: 2712, performance_score: 90 })
  })

  it("chemin refusé dans les réglages : noté, les pages suivantes sont mesurées, la semaine est faite", async () => {
    db.tables.seo_settings = [{ key: "pagespeed", value: { pages: [{ path: "//modele", label: "Hors site" }, { path: "/modele", label: "Modèles" }], weekly: true }, updated_at: "2026-10-09T00:00:00Z" }]
    const ctx = ctxFor({ name: "pagespeed" }, { now: new Date("2026-10-12T04:00:00Z"), deadline: Date.now() + 10 * 60_000 })
    const result = await runWeeklyPageSpeed(ctx, { run: async () => PSI })
    expect(result).toMatchObject({ measured: 2, remaining: 0 })
    expect((result.errors as string[]).map((e) => e.split(" : ")[0])).toEqual(["//modele (mobile)", "//modele (desktop)"])
    expect(ctx.job.cursor).toMatchObject({ next: 4, completedWeek: "2026-10-12" })
    expect(db.tables.seo_pagespeed.map((r) => r.path)).toEqual(["/modele", "/modele"])
  })

  it("quota atteint (429) : passage arrêté, curseur laissé sur la mesure, semaine pas marquée faite", async () => {
    db.tables.seo_settings = [{ key: "pagespeed", value: { pages: [{ path: "/", label: "Accueil" }, { path: "/modele", label: "Modèles" }], weekly: true }, updated_at: "2026-10-09T00:00:00Z" }]
    const ctx = ctxFor({ name: "pagespeed" }, { now: new Date("2026-10-12T04:00:00Z"), deadline: Date.now() + 10 * 60_000 })
    let calls = 0
    const run = async () => {
      calls++
      if (calls === 2) throw new GoogleApiError(429, "PageSpeed : erreur 429")
      return PSI
    }
    await expect(runWeeklyPageSpeed(ctx, { run })).rejects.toBeInstanceOf(PageSpeedUnavailableError)
    expect(calls).toBe(2)
    expect(ctx.job.cursor).toEqual({ week: "2026-10-12", next: 1 })
    // L'essai en échec reste visible dans l'historique
    expect(db.tables.seo_pagespeed.map((r) => [r.path, r.strategy, r.error ?? null])).toEqual([
      ["/", "mobile", null],
      ["/", "desktop", expect.stringContaining("Quota")],
    ])
  })

  it("s'arrête avant la limite et reprend au bon endroit ; semaine faite : rien", async () => {
    const ctx = ctxFor({ name: "pagespeed", cursor: { week: "2026-10-12", next: 3 } }, { now: new Date("2026-10-12T04:00:00Z"), deadline: Date.now() + 60_000 })
    const result = await runWeeklyPageSpeed(ctx, { run: async () => PSI })
    // Réglages par défaut : 5 pages × 2 ; moins de 105 s devant soi → aucune mesure
    expect(result).toMatchObject({ measured: 0, remaining: 7 })
    const done = ctxFor({ name: "pagespeed", cursor: { completedWeek: "2026-10-12" } }, { now: new Date("2026-10-14T04:00:00Z") })
    expect(await runWeeklyPageSpeed(done, { run: async () => PSI })).toEqual({ week: "2026-10-12", skipped: "already_done" })
  })
})

/* ------------------------------------------------------------------ */
/* Routes                                                              */
/* ------------------------------------------------------------------ */

describe("POST /api/admin/seo/search-console/sync", () => {
  it("401 sans session admin", async () => {
    admin = false
    const res = await syncRoute()
    expect(res.status).toBe(401)
    expect(gscCalls).toHaveLength(0)
  })

  it("503 tant que la migration n'est pas appliquée", async () => {
    db.missing.add("seo_jobs")
    const res = await syncRoute()
    expect(res.status).toBe(503)
    expect(await res.json()).toMatchObject({ code: "migration_pending" })
  })

  it("409 si une analyse tourne déjà", async () => {
    db.tables.seo_jobs = [{ name: "search-console", status: "running", lock_until: new Date(Date.now() + 5 * 60_000).toISOString(), cursor: {} }]
    const res = await syncRoute()
    expect(res.status).toBe(409)
    expect((await res.json()).error).toBe("Une analyse est déjà en cours")
  })

  it("synchronise puis recalcule les actions, journalise dans cron_logs", async () => {
    const res = await syncRoute()
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.ok).toBe(true)
    expect(body.results.map((r: { task: string; status: string }) => [r.task, r.status])).toEqual([
      ["search-console", "ok"],
      ["findings", "ok"],
    ])
    expect(db.tables.seo_gsc_daily.length).toBeGreaterThan(0)
    expect(db.tables.cron_logs.map((l) => l.job_name)).toEqual(["seo:search-console", "seo:findings"])
    expect(db.tables.seo_jobs.find((j) => j.name === "search-console")).toMatchObject({ status: "ok", lock_until: null })
  })
})

describe("historique PageSpeed", () => {
  const ps = (id: string, path: string, measured_at: string, extra: Row = {}): Row => ({
    id,
    path,
    strategy: "mobile",
    measured_at,
    source: "api",
    note: null,
    performance_score: 90,
    lcp_ms: 2700,
    cls: 0.01,
    tbt_ms: 80,
    fcp_ms: null,
    si_ms: null,
    unused_js_bytes: null,
    field: null,
    error: null,
    ...extra,
  })

  it("chemin des réglages non normalisé (« /modele/ ») : mesures relues sous le chemin enregistré", async () => {
    db.tables.seo_pagespeed = [ps("a", "/modele", "2026-10-04T08:00:00Z", { lcp_ms: 5300 }), ps("b", "/modele", "2026-10-05T08:00:00Z")]
    const out = await readPageSpeedHistory(db.client as never, ["/modele/"], "mobile")
    expect(Object.keys(out)).toEqual(["/modele/"])
    expect(out["/modele/"]).toMatchObject({ current: { id: "b" }, previous: { id: "a" }, lastAttempt: { id: "b" } })
  })

  it("essais en échec répétés : la dernière mesure réussie reste affichée", async () => {
    const failures = Array.from({ length: 12 }, (_, i) =>
      ps(`f${i}`, "/", `2026-10-06T${String(i + 10).padStart(2, "0")}:00:00Z`, { lcp_ms: null, performance_score: null, error: "Quota de PageSpeed atteint." }),
    )
    db.tables.seo_pagespeed = [ps("ok1", "/", "2026-10-04T08:00:00Z"), ps("ok2", "/", "2026-10-05T08:00:00Z"), ...failures]
    const out = await readPageSpeedHistory(db.client as never, ["/"], "mobile")
    expect(out["/"]).toMatchObject({ current: { id: "ok2" }, previous: { id: "ok1" }, lastAttempt: { id: "f11" } })
  })
})

describe("POST /api/admin/seo/pagespeed", () => {
  const call = (body: unknown) =>
    pagespeedRoute(new NextRequest("https://qonforme.fr/api/admin/seo/pagespeed", { method: "POST", body: JSON.stringify(body), headers: { "Content-Type": "application/json" } }))

  it("401 sans session admin", async () => {
    admin = false
    expect((await call({ path: "/modele", strategy: "mobile" })).status).toBe(401)
  })

  it("400 : corps invalide ou adresse hors du site", async () => {
    expect((await call({ path: "/modele", strategy: "tablette" })).status).toBe(400)
    const res = await call({ path: "https://exemple.com/", strategy: "mobile" })
    expect(res.status).toBe(400)
    expect((await res.json()).error).toContain("qonforme.fr")
    expect(db.tables.seo_pagespeed ?? []).toHaveLength(0)
  })

  it("page suivie au chemin non normalisé : mesure enregistrée sous le chemin normalisé, chemin hors du site refusé", async () => {
    pagespeedResponse = PSI
    db.tables.seo_settings = [{ key: "pagespeed", value: { pages: [{ path: "/modele/", label: "Modèles" }, { path: "//modele", label: "Hors site" }], weekly: true }, updated_at: "2026-10-09T00:00:00Z" }]
    const res = await call({ path: "/modele/", strategy: "mobile" })
    expect(res.status).toBe(200)
    expect((await res.json()).measurement).toMatchObject({ path: "/modele" })
    expect((await call({ path: "//modele", strategy: "mobile" })).status).toBe(400)
  })

  it("mesure enregistrée (page suivie ou chemin du site)", async () => {
    pagespeedResponse = PSI
    const res = await call({ path: "/guide/tva-travaux/", strategy: "desktop" })
    expect(res.status).toBe(200)
    expect((await res.json()).measurement).toMatchObject({ path: "/guide/tva-travaux", strategy: "desktop", lcp_ms: 2712 })
  })

  it("échec de Google : ligne d'erreur enregistrée, 502 avec un message en français", async () => {
    const { GoogleApiError } = await import("@/lib/seo/google")
    pagespeedResponse = new GoogleApiError(500, "PageSpeed : erreur 500")
    const res = await call({ path: "/modele", strategy: "mobile" })
    expect(res.status).toBe(502)
    expect((await res.json()).error).toBe("PageSpeed : erreur 500")
    expect(db.tables.seo_pagespeed[0]).toMatchObject({ path: "/modele", error: "PageSpeed : erreur 500" })
  })

  it("503 tant que la migration n'est pas appliquée", async () => {
    db.missing.add("seo_settings")
    expect((await call({ path: "/modele", strategy: "mobile" })).status).toBe(503)
  })
})
