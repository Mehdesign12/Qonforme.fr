/**
 * Base en mémoire pour les tests du module Articles : le sous-ensemble de
 * PostgREST utilisé par lib/seo/articles (select, insert, update, upsert,
 * delete ; filtres eq, neq, in, is, lt, lte, gte, like, or « col.is.null,col.lt."…" » ;
 * order, limit ; count en tête ; single, maybeSingle) et les contraintes qui
 * comptent : adresse unique des articles, une rédaction active par sujet,
 * une ligne de réglages par clé. Un stockage simulé reçoit les couvertures.
 */
export type Row = Record<string, unknown>
type DbError = { message: string; code?: string }
type Filter = (row: Row) => boolean

export interface FakeArticlesDb {
  tables: Record<string, Row[]>
  missing: Set<string>
  failing: Set<string>
  uploads: { bucket: string; path: string; contentType?: string }[]
  client: unknown
}

let counter = 0
export function uuid(): string {
  counter++
  return `00000000-0000-4000-8000-${String(counter).padStart(12, "0")}`
}

function cmp(a: unknown, b: unknown): number {
  if (a === b) return 0
  if (a === null || a === undefined) return 1
  if (b === null || b === undefined) return -1
  const da = typeof a === "string" ? Date.parse(a) : NaN
  const db = typeof b === "string" ? Date.parse(b) : NaN
  if (!Number.isNaN(da) && !Number.isNaN(db) && /^\d{4}-\d{2}-\d{2}/.test(String(a))) return da - db
  if (typeof a === "number" && typeof b === "number") return a - b
  return String(a) < String(b) ? -1 : 1
}

const UNIQUE: Record<string, (row: Row, others: Row[]) => boolean> = {
  blog_posts: (row, others) => others.some((r) => r.slug === row.slug),
  seo_article_jobs: (row, others) =>
    ["queued", "running"].includes(String(row.status)) && others.some((r) => r.topic_id === row.topic_id && ["queued", "running"].includes(String(r.status))),
  seo_settings: (row, others) => others.some((r) => r.key === row.key),
  seo_jobs: (row, others) => others.some((r) => r.name === row.name),
}

function parseOr(expr: string): Filter {
  const parts = expr.split(",").map((p) => p.trim())
  const tests = parts.map((p) => {
    const m = p.match(/^([a-z_]+)\.(is|lt|lte|gt|gte|eq)\.(.*)$/)
    if (!m) throw new Error(`or() non géré : ${p}`)
    const [, col, op, rawValue] = m
    const value = rawValue.replace(/^"|"$/g, "")
    return (r: Row) => {
      const v = r[col]
      if (op === "is") return value === "null" ? v === null || v === undefined : String(v) === value
      if (v === null || v === undefined) return false
      const c = cmp(v, value)
      return op === "lt" ? c < 0 : op === "lte" ? c <= 0 : op === "gt" ? c > 0 : op === "gte" ? c >= 0 : c === 0
    }
  })
  return (r) => tests.some((t) => t(r))
}

export function fakeArticlesDb(initial: Record<string, Row[]> = {}): FakeArticlesDb {
  const db: FakeArticlesDb = {
    tables: Object.fromEntries(Object.entries(initial).map(([t, rows]) => [t, rows.map((r) => ({ ...r }))])),
    missing: new Set(),
    failing: new Set(),
    uploads: [],
    client: null,
  }
  const rowsOf = (t: string) => (db.tables[t] ??= [])

  function from(table: string) {
    const filters: Filter[] = []
    let kind: "select" | "insert" | "update" | "upsert" | "delete" = "select"
    let values: Row | Row[] | null = null
    let upsertOpts: { onConflict?: string; ignoreDuplicates?: boolean } = {}
    let returning = false
    let head = false
    let count = false
    let limit: number | null = null
    const orders: { col: string; asc: boolean }[] = []
    let single: "single" | "maybe" | null = null

    const run = (): { data: unknown; error: DbError | null; count?: number | null } => {
      if (db.missing.has(table)) return { data: null, error: { code: "PGRST205", message: `Could not find the table 'public.${table}' in the schema cache` } }
      if (db.failing.has(table)) return { data: null, error: { message: "fetch failed: timeout" } }
      const rows = rowsOf(table)
      const nowIso = new Date().toISOString()

      if (kind === "insert" || kind === "upsert") {
        const list = Array.isArray(values) ? values : [values as Row]
        const out: Row[] = []
        for (const v of list) {
          if (kind === "upsert") {
            const keys = (upsertOpts.onConflict ?? "id").split(",")
            const existing = rows.find((r) => keys.every((k) => r[k] === v[k]))
            if (existing) {
              if (!upsertOpts.ignoreDuplicates) Object.assign(existing, v)
              out.push({ ...existing })
              continue
            }
          }
          const row: Row = { id: uuid(), created_at: nowIso, updated_at: nowIso, ...v }
          if (UNIQUE[table]?.(row, rows)) return { data: null, error: { code: "23505", message: "duplicate key value violates unique constraint" } }
          rows.push(row)
          out.push({ ...row })
        }
        return finish(out)
      }

      const matched = rows.filter((r) => filters.every((f) => f(r)))
      if (kind === "update") {
        for (const r of matched) {
          const next = { ...r, ...(values as Row) }
          if (UNIQUE[table]?.(next, rows.filter((x) => x !== r))) return { data: null, error: { code: "23505", message: "duplicate key value violates unique constraint" } }
        }
        for (const r of matched) Object.assign(r, values)
        return finish(matched.map((r) => ({ ...r })))
      }
      if (kind === "delete") {
        db.tables[table] = rows.filter((r) => !matched.includes(r))
        return finish(matched.map((r) => ({ ...r })))
      }
      let out = matched.map((r) => ({ ...r }))
      for (const o of orders.slice().reverse()) out.sort((a, b) => (o.asc ? cmp(a[o.col], b[o.col]) : -cmp(a[o.col], b[o.col])))
      if (head) return { data: null, error: null, count: matched.length }
      if (limit !== null) out = out.slice(0, limit)
      return finish(out, count ? matched.length : undefined)
    }

    const finish = (out: Row[], total?: number) => {
      if (single) {
        if (out.length === 0) return single === "maybe" ? { data: null, error: null } : { data: null, error: { code: "PGRST116", message: "0 rows" } }
        return { data: out[0], error: null }
      }
      return { data: kind !== "select" && !returning ? null : out, error: null, count: total ?? null }
    }

    const api = {
      select: (_cols?: string, opts?: { count?: string; head?: boolean }) => {
        if (kind !== "select") returning = true
        if (opts?.head) head = true
        if (opts?.count) count = true
        return api
      },
      insert: (v: Row | Row[]) => ((kind = "insert"), (values = v), api),
      upsert: (v: Row | Row[], opts?: { onConflict?: string; ignoreDuplicates?: boolean }) => ((kind = "upsert"), (values = v), (upsertOpts = opts ?? {}), api),
      update: (v: Row) => ((kind = "update"), (values = v), api),
      delete: () => ((kind = "delete"), api),
      eq: (k: string, v: unknown) => (filters.push((r) => r[k] === v), api),
      neq: (k: string, v: unknown) => (filters.push((r) => r[k] !== v), api),
      in: (k: string, list: unknown[]) => (filters.push((r) => list.includes(r[k])), api),
      is: (k: string, v: unknown) => (filters.push((r) => (v === null ? r[k] === null || r[k] === undefined : r[k] === v)), api),
      lt: (k: string, v: unknown) => (filters.push((r) => r[k] !== null && r[k] !== undefined && cmp(r[k], v) < 0), api),
      lte: (k: string, v: unknown) => (filters.push((r) => r[k] !== null && r[k] !== undefined && cmp(r[k], v) <= 0), api),
      gte: (k: string, v: unknown) => (filters.push((r) => r[k] !== null && r[k] !== undefined && cmp(r[k], v) >= 0), api),
      like: (k: string, pattern: string) => {
        const re = new RegExp(`^${pattern.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/%/g, ".*")}$`)
        filters.push((r) => typeof r[k] === "string" && re.test(r[k] as string))
        return api
      },
      or: (expr: string) => (filters.push(parseOr(expr)), api),
      order: (col: string, opts?: { ascending?: boolean }) => (orders.push({ col, asc: opts?.ascending !== false }), api),
      limit: (n: number) => ((limit = n), api),
      single: () => ((single = "single"), Promise.resolve(run())),
      maybeSingle: () => ((single = "maybe"), Promise.resolve(run())),
      then: (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) => Promise.resolve(run()).then(resolve, reject),
    }
    return api
  }

  db.client = {
    from,
    storage: {
      from: (bucket: string) => ({
        upload: async (path: string, _data: unknown, opts?: { contentType?: string }) => {
          db.uploads.push({ bucket, path, contentType: opts?.contentType })
          return { data: { path }, error: null }
        },
        getPublicUrl: (path: string) => ({ data: { publicUrl: `https://stockage.test/${bucket}/${path}` } }),
      }),
    },
  }
  return db
}
