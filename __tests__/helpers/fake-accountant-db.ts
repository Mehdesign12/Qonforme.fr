/**
 * Fausse base Supabase en mémoire pour les tests de l'accès comptable :
 * sous-ensemble de PostgREST utilisé par lib/accountant (select, insert,
 * update, delete ; eq, neq, is, not is null, gt, gte, lt, lte, in ; order,
 * limit, range ; single, maybeSingle ; count en tête) et les contraintes
 * d'unicité de la migration 20261003_accountant_access.sql.
 */
type Row = Record<string, unknown>
type DbError = { code: string; message: string }
type Result = { data: unknown; error: DbError | null; count?: number | null }

export class FakeAccountantDb {
  tables: Record<string, Row[]> = {}
  /** Tables « absentes » (migration pas appliquée) : erreur PGRST205. */
  missing = new Set<string>()
  /** Tables dont l'écriture échoue (panne simulée). */
  failingWrites = new Set<string>()
  seq = 0
  from(table: string) { return new FakeQuery(this, table) }

  /** Contraintes d'unicité des accès (index partiels de la migration). */
  violates(table: string, candidate: Row, ignore?: Row): DbError | null {
    if (table !== "accountant_accesses") return null
    const others = (this.tables[table] ?? []).filter((r) => r !== ignore)
    const dup = (pred: (r: Row) => boolean) => others.some(pred)
    if (candidate.token_hash && dup((r) => r.token_hash === candidate.token_hash)) return { code: "23505", message: "duplicate token_hash" }
    if (!candidate.revoked_at && dup((r) => !r.revoked_at && r.owner_id === candidate.owner_id && r.email === candidate.email)) {
      return { code: "23505", message: "duplicate live email" }
    }
    if (!candidate.revoked_at && candidate.accountant_id
      && dup((r) => !r.revoked_at && r.owner_id === candidate.owner_id && r.accountant_id === candidate.accountant_id)) {
      return { code: "23505", message: "duplicate live accountant" }
    }
    return null
  }
}

class FakeQuery {
  private filters: ((r: Row) => boolean)[] = []
  private op: "select" | "insert" | "update" | "delete" = "select"
  private payload: Row = {}
  private wantCount = false
  private head = false
  private orders: { col: string; asc: boolean }[] = []
  private max: number | null = null
  private window: [number, number] | null = null

  constructor(private db: FakeAccountantDb, private table: string) {}

  select(_cols?: string, opts?: { count?: string; head?: boolean }) {
    if (opts?.count) this.wantCount = true
    if (opts?.head) this.head = true
    return this
  }
  insert(row: Row) { this.op = "insert"; this.payload = row; return this }
  update(p: Row) { this.op = "update"; this.payload = p; return this }
  delete() { this.op = "delete"; return this }
  eq(k: string, v: unknown) { this.filters.push((r) => r[k] === v); return this }
  neq(k: string, v: unknown) { this.filters.push((r) => r[k] !== v); return this }
  is(k: string, v: null) { this.filters.push((r) => (r[k] ?? null) === v); return this }
  not(k: string, op: string, v: null) {
    if (op === "is" && v === null) this.filters.push((r) => r[k] !== null && r[k] !== undefined)
    return this
  }
  gt(k: string, v: string) { this.filters.push((r) => String(r[k]) > v); return this }
  gte(k: string, v: string) { this.filters.push((r) => String(r[k]) >= v); return this }
  lt(k: string, v: string) { this.filters.push((r) => String(r[k]) < v); return this }
  lte(k: string, v: string) { this.filters.push((r) => String(r[k]) <= v); return this }
  in(k: string, vs: unknown[]) { this.filters.push((r) => vs.includes(r[k])); return this }
  order(col: string, o?: { ascending?: boolean }) { this.orders.push({ col, asc: o?.ascending ?? true }); return this }
  limit(n: number) { this.max = n; return this }
  range(a: number, b: number) { this.window = [a, b]; return this }

  private run(): Result {
    if (this.db.missing.has(this.table)) {
      return { data: null, error: { code: "PGRST205", message: `Could not find the table 'public.${this.table}' in the schema cache` } }
    }
    if (this.op !== "select" && this.db.failingWrites.has(this.table)) {
      return { data: null, error: { code: "08006", message: "connection failure" } }
    }
    const rows = (this.db.tables[this.table] ??= [])
    if (this.op === "insert") {
      const row: Row = { id: `00000000-0000-4000-8000-${String(++this.db.seq).padStart(12, "0")}`, created_at: new Date().toISOString(), ...this.payload }
      const err = this.db.violates(this.table, row)
      if (err) return { data: null, error: err }
      rows.push(row)
      return { data: [{ ...row }], error: null }
    }
    let found = rows.filter((r) => this.filters.every((f) => f(r)))
    if (this.op === "update") {
      for (const r of found) {
        const err = this.db.violates(this.table, { ...r, ...this.payload }, r)
        if (err) return { data: null, error: err }
      }
      found.forEach((r) => Object.assign(r, this.payload))
      return { data: found.map((r) => ({ ...r })), error: null }
    }
    if (this.op === "delete") {
      this.db.tables[this.table] = rows.filter((r) => !found.includes(r))
      return { data: null, error: null }
    }
    for (const { col, asc } of [...this.orders].reverse()) {
      found = [...found].sort((a, b) => (String(a[col] ?? "") < String(b[col] ?? "") ? -1 : String(a[col] ?? "") > String(b[col] ?? "") ? 1 : 0) * (asc ? 1 : -1))
    }
    const count = found.length
    if (this.window) found = found.slice(this.window[0], this.window[1] + 1)
    if (this.max !== null) found = found.slice(0, this.max)
    return { data: this.head ? null : found.map((r) => ({ ...r })), error: null, count: this.wantCount ? count : null }
  }

  maybeSingle(): Promise<Result> {
    const r = this.run()
    return Promise.resolve(r.error ? r : { data: (r.data as Row[] | null)?.[0] ?? null, error: null })
  }
  single(): Promise<Result> {
    const r = this.run()
    if (r.error) return Promise.resolve(r)
    const first = (r.data as Row[] | null)?.[0]
    return Promise.resolve(first ? { data: first, error: null } : { data: null, error: { code: "PGRST116", message: "no rows" } })
  }
  then<T>(resolve: (r: Result) => T, reject?: (e: unknown) => T) {
    return Promise.resolve().then(() => this.run()).then(resolve, reject)
  }
}
