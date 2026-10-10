/**
 * Base en mémoire pour les tests des Paramètres et Rapports de l'onglet SEO :
 * imite le sous-ensemble de PostgREST utilisé par lib/seo/reports,
 * lib/seo/connections-test.ts et lib/seo/settings.ts (select avec count,
 * insert, update, upsert ; filtres eq, neq, in, like, gte, lte, lt ; order,
 * limit ; count avec head ; single, maybeSingle ; rpc) et les contraintes qui
 * comptent :
 * - seo_digests.period_key unique (23505) ;
 * - seo_settings.key unique (23505).
 * Une table de `missing` répond comme une table absente (migration non
 * appliquée), une table de `failing` comme une coupure réseau.
 * (Fichier d'aide, pas un test : vitest ne lit que les *.test.ts.)
 */
export type Row = Record<string, unknown>
type DbError = { message: string; code?: string }
type Filter = (row: Row) => boolean

export interface Op {
  table: string
  kind: "select" | "insert" | "update" | "upsert" | "delete" | "rpc"
  values?: unknown
}

export interface FakeSeoDb {
  tables: Record<string, Row[]>
  missing: Set<string>
  failing: Set<string>
  ops: Op[]
  rpcs: Record<string, (args: Record<string, unknown>) => unknown>
  client: { from: (table: string) => unknown; rpc: (name: string, args?: Record<string, unknown>) => Promise<unknown> }
}

const UNIQUE: Record<string, string> = { seo_digests: "period_key", seo_settings: "key" }

function compare(a: unknown, b: unknown): number {
  if (typeof a === "number" && typeof b === "number") return a - b
  if (typeof a === "boolean" || typeof b === "boolean") return String(a).localeCompare(String(b))
  const da = typeof a === "string" ? Date.parse(a) : NaN
  const db = typeof b === "string" ? Date.parse(b) : NaN
  if (!Number.isNaN(da) && !Number.isNaN(db)) return da - db
  return String(a) < String(b) ? -1 : String(a) > String(b) ? 1 : 0
}

export function fakeSeoDb(initial: Record<string, Row[]> = {}): FakeSeoDb {
  let nextId = 1
  const db: FakeSeoDb = {
    tables: Object.fromEntries(Object.entries(initial).map(([t, rows]) => [t, rows.map((r) => ({ ...r }))])),
    missing: new Set(),
    failing: new Set(),
    ops: [],
    rpcs: {},
    client: null as unknown as FakeSeoDb["client"],
  }
  const rowsOf = (t: string) => (db.tables[t] ??= [])

  const violation = (table: string, row: Row, ignore?: Row): DbError | null => {
    const key = UNIQUE[table]
    if (key && rowsOf(table).some((r) => r !== ignore && r[key] === row[key])) {
      return { code: "23505", message: "duplicate key value violates unique constraint" }
    }
    return null
  }

  function from(table: string) {
    const filters: Filter[] = []
    let kind: Op["kind"] = "select"
    let values: Row | Row[] | null = null
    let upsertOpts: { onConflict?: string } = {}
    let returning = false
    let count = false
    let head = false
    let limit: number | null = null
    let order: { col: string; asc: boolean } | null = null
    let single: "single" | "maybe" | null = null

    const run = (): { data: unknown; error: DbError | null; count?: number | null } => {
      db.ops.push({ table, kind, values: values ?? undefined })
      if (db.missing.has(table)) return { data: null, error: { code: "PGRST205", message: `Could not find the table 'public.${table}' in the schema cache` } }
      if (db.failing.has(table)) return { data: null, error: { message: "fetch failed: timeout" } }
      const rows = rowsOf(table)

      if (kind === "insert" || kind === "upsert") {
        const list = Array.isArray(values) ? values : [values as Row]
        const out: Row[] = []
        for (const v of list) {
          const row: Row = { id: `row-${nextId++}`, created_at: new Date().toISOString(), ...v }
          if (kind === "upsert") {
            const keys = (upsertOpts.onConflict ?? "id").split(",")
            const existing = rows.find((r) => keys.every((k) => r[k] === row[k]))
            if (existing) {
              Object.assign(existing, v)
              out.push({ ...existing })
              continue
            }
          }
          const err = violation(table, row)
          if (err) return { data: null, error: err }
          rows.push(row)
          out.push({ ...row })
        }
        return finish(out)
      }

      const matched = rows.filter((r) => filters.every((f) => f(r)))
      if (kind === "update") {
        for (const r of matched) {
          const err = violation(table, { ...r, ...(values as Row) }, r)
          if (err) return { data: null, error: err }
          Object.assign(r, values)
        }
        return finish(matched.map((r) => ({ ...r })))
      }
      let out = matched.map((r) => ({ ...r }))
      if (order) {
        const { col, asc } = order
        out.sort((a, b) => (asc ? 1 : -1) * compare(a[col], b[col]))
      }
      if (limit !== null) out = out.slice(0, limit)
      return finish(out, count ? matched.length : undefined)
    }

    const finish = (out: Row[], total?: number) => {
      const writing = kind !== "select"
      if (single) {
        if (out.length === 0) return single === "maybe" ? { data: null, error: null } : { data: null, error: { code: "PGRST116", message: "0 rows" } }
        return { data: out[0], error: null }
      }
      return { data: (writing && !returning) || head ? null : out, error: null, count: total ?? null }
    }

    const api = {
      select: (_cols?: string, opts?: { count?: string; head?: boolean }) => {
        if (kind !== "select") returning = true
        if (opts?.count) count = true
        if (opts?.head) head = true
        return api
      },
      insert: (v: Row | Row[]) => { kind = "insert"; values = v; return api },
      upsert: (v: Row | Row[], opts?: { onConflict?: string }) => { kind = "upsert"; values = v; upsertOpts = opts ?? {}; return api },
      update: (v: Row) => { kind = "update"; values = v; return api },
      eq: (k: string, v: unknown) => { filters.push((r) => r[k] === v); return api },
      neq: (k: string, v: unknown) => { filters.push((r) => r[k] !== v); return api },
      in: (k: string, list: unknown[]) => { filters.push((r) => list.includes(r[k])); return api },
      like: (k: string, pattern: string) => {
        const source = pattern.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/%/g, ".*").replace(/_/g, ".")
        const re = new RegExp(`^${source}$`)
        filters.push((r) => typeof r[k] === "string" && re.test(r[k] as string))
        return api
      },
      lt: (k: string, v: unknown) => { filters.push((r) => r[k] !== null && r[k] !== undefined && compare(r[k], v) < 0); return api },
      gte: (k: string, v: unknown) => { filters.push((r) => r[k] !== null && r[k] !== undefined && compare(r[k], v) >= 0); return api },
      lte: (k: string, v: unknown) => { filters.push((r) => r[k] !== null && r[k] !== undefined && compare(r[k], v) <= 0); return api },
      order: (col: string, opts?: { ascending?: boolean }) => { order = { col, asc: opts?.ascending !== false }; return api },
      limit: (n: number) => { limit = n; return api },
      single: () => { single = "single"; return Promise.resolve(run()) },
      maybeSingle: () => { single = "maybe"; return Promise.resolve(run()) },
      then: (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) => Promise.resolve(run()).then(resolve, reject),
    }
    return api
  }

  db.client = {
    from,
    rpc: (name: string, args: Record<string, unknown> = {}) => {
      db.ops.push({ table: name, kind: "rpc", values: args })
      if (db.missing.has(name)) return Promise.resolve({ data: null, error: { code: "PGRST202", message: `Could not find the function public.${name}` } })
      if (db.failing.has(name)) return Promise.resolve({ data: null, error: { message: "fetch failed: timeout" } })
      const fn = db.rpcs[name]
      return Promise.resolve({ data: fn ? fn(args) : [], error: null })
    },
  }
  return db
}
