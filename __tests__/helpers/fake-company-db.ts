/**
 * Base en mémoire pour les tests de la fenêtre « Bienvenue » et de la garde
 * d'envoi (lib/legal/issuer.ts) : imite le sous-ensemble de PostgREST et de
 * Supabase Auth qu'utilisent PATCH /api/onboarding/inscription et les routes
 * d'envoi (select de colonnes, insert, update, filtres eq et is, single,
 * maybeSingle ; auth.getUser et auth.updateUser).
 *
 * - `missingColumns` : colonne absente (migration non appliquée), en lecture
 *   comme en écriture (42703, comme Postgres) ;
 * - `failing` : table injoignable (coupure réseau) ;
 * - `companies.user_id` unique (23505), comme en base.
 */
export type Row = Record<string, unknown>

type DbError = { message: string; code?: string }

export interface Op {
  table: string
  kind: "select" | "insert" | "update"
  columns?: string
  values?: unknown
}

export interface FakeCompanyDb {
  tables: Record<string, Row[]>
  missingColumns: Set<string>
  failing: Set<string>
  ops: Op[]
  /** Utilisateur connecté ; null : non connecté. */
  user: { id: string; email: string; user_metadata: Record<string, unknown> } | null
  /** Vrai : auth.updateUser répond en erreur. */
  authFails: boolean
  /** Appelé juste avant chaque INSERT : permet de simuler une requête concurrente. */
  beforeInsert?: (table: string) => void
  client: {
    from: (table: string) => unknown
    auth: {
      getUser: () => Promise<{ data: { user: unknown }; error: null }>
      updateUser: (attrs: { data?: Record<string, unknown> }) => Promise<{ data: { user: unknown }; error: DbError | null }>
    }
  }
}

const UNIQUE: Record<string, string> = { companies: "user_id" }

export function fakeCompanyDb(initial: Record<string, Row[]> = {}): FakeCompanyDb {
  let nextId = 1
  const db: FakeCompanyDb = {
    tables: Object.fromEntries(Object.entries(initial).map(([t, rows]) => [t, rows.map((r) => ({ ...r }))])),
    missingColumns: new Set(),
    failing: new Set(),
    ops: [],
    user: null,
    authFails: false,
    client: null as unknown as FakeCompanyDb["client"],
  }
  const rowsOf = (t: string) => (db.tables[t] ??= [])

  function from(table: string) {
    const filters: ((r: Row) => boolean)[] = []
    let kind: Op["kind"] = "select"
    let columns = "*"
    let values: Row | Row[] | null = null
    let single: "single" | "maybe" | null = null

    const missingIn = (keys: string[]) => keys.map((k) => k.trim()).find((k) => db.missingColumns.has(k))

    const run = (): { data: unknown; error: DbError | null } => {
      db.ops.push({ table, kind, columns: kind === "select" ? columns : undefined, values: values ?? undefined })
      if (db.failing.has(table)) return { data: null, error: { message: "fetch failed: timeout" } }

      const list = values === null ? [] : Array.isArray(values) ? values : [values]
      const missing = kind === "select"
        ? missingIn(columns.split(","))
        : missingIn(list.flatMap((v) => Object.keys(v)))
      if (missing) return { data: null, error: { code: "42703", message: `column ${table}.${missing} does not exist` } }

      const rows = rowsOf(table)
      if (kind === "insert") {
        db.beforeInsert?.(table)
        const out: Row[] = []
        for (const v of list) {
          const key = UNIQUE[table]
          if (key && rows.some((r) => r[key] === v[key])) {
            return { data: null, error: { code: "23505", message: "duplicate key value violates unique constraint" } }
          }
          const row = { id: `row-${nextId++}`, ...v }
          rows.push(row)
          out.push({ ...row })
        }
        return finish(out)
      }
      const matched = rows.filter((r) => filters.every((f) => f(r)))
      if (kind === "update") {
        for (const r of matched) Object.assign(r, values)
        return finish(matched.map((r) => ({ ...r })))
      }
      return finish(matched.map((r) => ({ ...r })))
    }

    const finish = (out: Row[]) => {
      if (single) {
        if (out.length === 0) {
          return single === "maybe" ? { data: null, error: null } : { data: null, error: { code: "PGRST116", message: "0 rows" } }
        }
        return { data: out[0], error: null }
      }
      return { data: out, error: null }
    }

    const api = {
      select: (cols = "*") => { if (kind === "select") columns = cols; return api },
      insert: (v: Row | Row[]) => { kind = "insert"; values = v; return api },
      update: (v: Row) => { kind = "update"; values = v; return api },
      eq: (k: string, v: unknown) => { filters.push((r) => r[k] === v); return api },
      is: (k: string, v: null) => { filters.push((r) => (r[k] ?? null) === v); return api },
      order: () => api,
      limit: () => api,
      single: () => { single = "single"; return Promise.resolve(run()) },
      maybeSingle: () => { single = "maybe"; return Promise.resolve(run()) },
      then: (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) => Promise.resolve(run()).then(resolve, reject),
    }
    return api
  }

  db.client = {
    from,
    auth: {
      getUser: () => Promise.resolve({ data: { user: db.user ? { ...db.user } : null }, error: null }),
      updateUser: ({ data }) => {
        if (db.authFails || !db.user) return Promise.resolve({ data: { user: null }, error: { message: "Auth session missing" } })
        // Comme Supabase Auth : les clés de `data` s'ajoutent aux métadonnées existantes
        db.user.user_metadata = { ...db.user.user_metadata, ...data }
        return Promise.resolve({ data: { user: { ...db.user } }, error: null })
      },
    },
  }
  return db
}
