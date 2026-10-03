/**
 * Mini base « invoices » en mémoire pour les tests de numérotation : imite le
 * sous-ensemble de PostgREST utilisé par lib/utils/document-numbering.ts
 * (select / insert / update, filtres eq, is null, like 'préfixe%', single et
 * maybeSingle) et les deux contraintes qui comptent :
 * - UNIQUE(user_id, invoice_number), plusieurs NULL admis (code 23505) ;
 * - NOT NULL sur invoice_number tant que la migration n'est pas appliquée (23502).
 */
import type { SupabaseClient } from "@supabase/supabase-js"

export type Row = Record<string, unknown> & { id: string }

type Filter = (row: Row) => boolean
type DbError = { message: string; code: string }

export interface FakeDb {
  client: SupabaseClient
  rows: Row[]
  /** Appelé juste avant chaque UPDATE : permet de simuler une requête concurrente. */
  beforeUpdate?: (attempt: number) => void
  /** Simule la base d'avant la migration : numéro obligatoire. */
  numberRequired: boolean
  updates: number
}

export function fakeInvoicesDb(initial: Row[] = []): FakeDb {
  const db: FakeDb = { client: null as unknown as SupabaseClient, rows: initial.map((r) => ({ ...r })), numberRequired: false, updates: 0 }
  let nextId = 1000

  const violates = (candidate: Row, ignoreId?: string): DbError | null => {
    if (db.numberRequired && (candidate.invoice_number === null || candidate.invoice_number === undefined)) {
      return { code: "23502", message: 'null value in column "invoice_number" violates not-null constraint' }
    }
    if (candidate.invoice_number != null) {
      const dup = db.rows.some((r) => r.id !== ignoreId && r.user_id === candidate.user_id && r.invoice_number === candidate.invoice_number)
      if (dup) return { code: "23505", message: "duplicate key value violates unique constraint" }
    }
    return null
  }

  function builder() {
    const filters: Filter[] = []
    let op: "select" | "insert" | "update" = "select"
    let payload: Record<string, unknown> = {}

    const run = (): { data: Row[] | null; error: DbError | null } => {
      if (op === "insert") {
        const row: Row = { id: `inv-${nextId++}`, ...payload }
        const err = violates(row)
        if (err) return { data: null, error: err }
        db.rows.push(row)
        return { data: [{ ...row }], error: null }
      }
      const matched = db.rows.filter((r) => filters.every((f) => f(r)))
      if (op === "update") {
        db.beforeUpdate?.(db.updates)
        db.updates++
        // Relecture après le crochet : la ligne a pu changer entre-temps
        const target = db.rows.filter((r) => filters.every((f) => f(r)))
        for (const r of target) {
          const err = violates({ ...r, ...payload }, r.id)
          if (err) return { data: null, error: err }
        }
        for (const r of target) Object.assign(r, payload)
        return { data: target.map((r) => ({ ...r })), error: null }
      }
      return { data: matched.map((r) => ({ ...r })), error: null }
    }

    const q = {
      select: () => q,
      insert: (row: Record<string, unknown>) => { op = "insert"; payload = row; return q },
      update: (row: Record<string, unknown>) => { op = "update"; payload = row; return q },
      eq: (col: string, value: unknown) => { filters.push((r) => r[col] === value); return q },
      is: (col: string, value: null) => { filters.push((r) => (r[col] ?? null) === value); return q },
      like: (col: string, pattern: string) => {
        const prefix = pattern.replace(/%$/, "")
        filters.push((r) => typeof r[col] === "string" && (r[col] as string).startsWith(prefix))
        return q
      },
      single: async () => {
        const { data, error } = run()
        if (error) return { data: null, error }
        if (!data || data.length !== 1) return { data: null, error: { code: "PGRST116", message: "JSON object requested, multiple (or no) rows returned" } }
        return { data: data[0], error: null }
      },
      maybeSingle: async () => {
        const { data, error } = run()
        if (error) return { data: null, error }
        return { data: data?.[0] ?? null, error: null }
      },
      then: (resolve: (v: { data: Row[] | null; error: DbError | null }) => unknown, reject?: (e: unknown) => unknown) => {
        try { return Promise.resolve(resolve(run())) } catch (e) { return reject ? Promise.resolve(reject(e)) : Promise.reject(e) }
      },
    }
    return q
  }

  db.client = { from: () => builder() } as unknown as SupabaseClient
  return db
}
