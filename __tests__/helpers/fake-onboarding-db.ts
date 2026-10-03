/**
 * Base en mémoire pour les tests du démarrage (séquence, rappel, devis d'essai,
 * désinscription) : imite le sous-ensemble de PostgREST utilisé par
 * lib/onboarding et ses routes (select, insert, update, upsert, delete ; filtres
 * eq, in, lte, gte ; order, limit, range ; single, maybeSingle ; count en tête)
 * et les contraintes qui comptent :
 * - onboarding_emails : une étape par compte (23505) ;
 * - onboarding_reminders : un seul rappel « pending » par compte (23505) ;
 * - onboarding_journeys, email_preferences : une ligne par compte.
 * Une table de `missing` répond comme une table absente (migration non
 * appliquée), une table de `failing` comme une coupure réseau.
 */
export type Row = Record<string, unknown>

type DbError = { message: string; code?: string }
type Filter = (row: Row) => boolean

export interface Op {
  table: string
  kind: "select" | "insert" | "update" | "upsert" | "delete"
  values?: unknown
}

export interface FakeOnboardingDb {
  tables: Record<string, Row[]>
  missing: Set<string>
  failing: Set<string>
  ops: Op[]
  users: Record<string, { email: string; user_metadata?: Record<string, unknown> }>
  /** Utilisateur connecté (auth.getUser) ; null : non connecté. */
  sessionUserId: string | null
  client: {
    from: (table: string) => unknown
    auth: {
      getUser: () => Promise<{ data: { user: unknown } }>
      admin: { getUserById: (id: string) => Promise<{ data: { user: unknown } | null; error: DbError | null }> }
    }
  }
}

const KEYS: Record<string, string[]> = {
  onboarding_journeys: ["user_id"],
  email_preferences: ["user_id"],
  reminder_settings: ["user_id"],
}

function compare(a: unknown, b: unknown): number {
  const da = typeof a === "string" ? Date.parse(a) : NaN
  const db = typeof b === "string" ? Date.parse(b) : NaN
  if (!Number.isNaN(da) && !Number.isNaN(db)) return da - db
  return String(a) < String(b) ? -1 : String(a) > String(b) ? 1 : 0
}

export function fakeOnboardingDb(initial: Record<string, Row[]> = {}): FakeOnboardingDb {
  let nextId = 1
  const db: FakeOnboardingDb = {
    tables: Object.fromEntries(Object.entries(initial).map(([t, rows]) => [t, rows.map((r) => ({ ...r }))])),
    missing: new Set(),
    failing: new Set(),
    ops: [],
    users: {},
    sessionUserId: null,
    client: null as unknown as FakeOnboardingDb["client"],
  }
  const rowsOf = (t: string) => (db.tables[t] ??= [])

  const violation = (table: string, row: Row, ignore?: Row): DbError | null => {
    const others = rowsOf(table).filter((r) => r !== ignore)
    if (table === "onboarding_emails" && others.some((r) => r.user_id === row.user_id && r.step === row.step)) {
      return { code: "23505", message: "duplicate key value violates unique constraint" }
    }
    if (table === "onboarding_reminders" && row.status === "pending" &&
      others.some((r) => r.user_id === row.user_id && r.status === "pending")) {
      return { code: "23505", message: "duplicate key value violates unique constraint" }
    }
    const keys = KEYS[table]
    if (keys && others.some((r) => keys.every((k) => r[k] === row[k]))) {
      return { code: "23505", message: "duplicate key value violates unique constraint" }
    }
    return null
  }

  function from(table: string) {
    const filters: Filter[] = []
    let kind: Op["kind"] = "select"
    let values: Row | Row[] | null = null
    let upsertOpts: { onConflict?: string; ignoreDuplicates?: boolean } = {}
    let returning = false
    let head = false
    let count = false
    let limit: number | null = null
    let range: [number, number] | null = null
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
          const row: Row = { id: `row-${nextId++}`, ...v }
          if (kind === "upsert") {
            const keys = (upsertOpts.onConflict ?? "id").split(",")
            const existing = rows.find((r) => keys.every((k) => r[k] === row[k]))
            if (existing) {
              if (!upsertOpts.ignoreDuplicates) Object.assign(existing, v)
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
          const next = { ...r, ...(values as Row) }
          const err = violation(table, next, r)
          if (err) return { data: null, error: err }
          Object.assign(r, values)
        }
        return finish(matched.map((r) => ({ ...r })))
      }
      if (kind === "delete") {
        db.tables[table] = rows.filter((r) => !matched.includes(r))
        return finish(matched.map((r) => ({ ...r })))
      }
      let out = matched.map((r) => ({ ...r }))
      if (range) out = out.slice(range[0], range[1] + 1)
      if (limit !== null) out = out.slice(0, limit)
      if (head) return { data: null, error: null, count: matched.length }
      return finish(out, count ? matched.length : undefined)
    }

    const finish = (out: Row[], total?: number) => {
      const writing = kind !== "select"
      if (single) {
        if (out.length === 0) {
          return single === "maybe"
            ? { data: null, error: null }
            : { data: null, error: { code: "PGRST116", message: "0 rows" } }
        }
        return { data: out[0], error: null }
      }
      return { data: writing && !returning ? null : out, error: null, count: total ?? null }
    }

    const api = {
      select: (_cols?: string, opts?: { count?: string; head?: boolean }) => {
        if (kind !== "select") returning = true
        if (opts?.head) head = true
        if (opts?.count) count = true
        return api
      },
      insert: (v: Row | Row[]) => { kind = "insert"; values = v; return api },
      upsert: (v: Row | Row[], opts?: { onConflict?: string; ignoreDuplicates?: boolean }) => {
        kind = "upsert"; values = v; upsertOpts = opts ?? {}; return api
      },
      update: (v: Row) => { kind = "update"; values = v; return api },
      delete: () => { kind = "delete"; return api },
      eq: (k: string, v: unknown) => { filters.push((r) => r[k] === v); return api },
      in: (k: string, list: unknown[]) => { filters.push((r) => list.includes(r[k])); return api },
      lte: (k: string, v: unknown) => { filters.push((r) => compare(r[k], v) <= 0); return api },
      gte: (k: string, v: unknown) => { filters.push((r) => compare(r[k], v) >= 0); return api },
      order: () => api,
      limit: (n: number) => { limit = n; return api },
      range: (a: number, b: number) => { range = [a, b]; return api },
      single: () => { single = "single"; return Promise.resolve(run()) },
      maybeSingle: () => { single = "maybe"; return Promise.resolve(run()) },
      then: (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) => Promise.resolve(run()).then(resolve, reject),
    }
    return api
  }

  db.client = {
    from,
    auth: {
      getUser: () => {
        const id = db.sessionUserId
        const u = id ? db.users[id] : null
        return Promise.resolve({ data: { user: u && id ? { id, email: u.email, user_metadata: u.user_metadata ?? {} } : null } })
      },
      admin: {
        getUserById: (id: string) => {
          const u = db.users[id]
          return Promise.resolve(u
            ? { data: { user: { id, email: u.email, user_metadata: u.user_metadata ?? {} } }, error: null }
            : { data: null, error: { message: "User not found" } })
        },
      },
    },
  }
  return db
}
