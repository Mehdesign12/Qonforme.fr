/**
 * Côté serveur des mentions du bâtiment, contre une fausse base en mémoire :
 * lecture du profil tolérante à la migration absente, import des prestations
 * du métier (désignation, unité et TVA tirées de la liste, jamais de la
 * requête ; aucun doublon ; prix à 0 € s'il n'est pas saisi).
 */
import { beforeEach, describe, expect, it, vi } from "vitest"
import { NextRequest } from "next/server"
import { selectCompanyWithProfile } from "@/lib/legal/db"
import { POST as importProducts } from "@/app/api/products/import/route"

const mocks = vi.hoisted(() => ({ db: undefined as unknown }))
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => mocks.db }))

type Row = Record<string, unknown>

/** Sous-ensemble de PostgREST : select de colonnes, eq, maybeSingle, insert().select(). */
class FakeDb {
  tables: Record<string, Row[]> = { companies: [], products: [] }
  /** Colonnes absentes (migration pas encore appliquée). */
  missingColumns = new Set<string>()
  auth = { getUser: async () => ({ data: { user: { id: "user-1" } }, error: null }) }
  from(table: string) { return new FakeQuery(this, table) }
}

class FakeQuery {
  private filters: [string, unknown][] = []
  private columns = "*"
  private inserted: Row[] | null = null
  constructor(private db: FakeDb, private table: string) {}
  select(cols = "*") { this.columns = cols; return this }
  eq(col: string, value: unknown) { this.filters.push([col, value]); return this }
  limit() { return this }
  insert(rows: Row[]) { this.inserted = rows; return this }
  private run() {
    const missing = this.columns.split(",").map((c) => c.trim()).find((c) => this.db.missingColumns.has(c))
    if (missing) return { data: null, error: { code: "42703", message: `column companies.${missing} does not exist` } }
    if (this.inserted) {
      const rows = this.inserted.map((r, i) => ({ id: `p-${this.db.tables[this.table].length + i}`, ...r }))
      this.db.tables[this.table].push(...rows)
      return { data: rows, error: null }
    }
    const rows = this.db.tables[this.table].filter((r) => this.filters.every(([c, v]) => r[c] === v))
    return { data: rows, error: null }
  }
  async maybeSingle() {
    const r = this.run()
    return { data: Array.isArray(r.data) ? r.data[0] ?? null : r.data, error: r.error }
  }
  then<T>(resolve: (v: { data: unknown; error: unknown }) => T) { return Promise.resolve(this.run()).then(resolve) }
}

let db: FakeDb
beforeEach(() => {
  db = new FakeDb()
  mocks.db = db
})

const request = (body: unknown) => new NextRequest("http://localhost/api/products/import", { method: "POST", body: JSON.stringify(body) })

describe("lecture du profil légal", () => {
  it("avec la colonne : profil lu", async () => {
    db.tables.companies.push({ user_id: "user-1", name: "Garnier", legal_profile: { trade: "plaquiste" } })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const r = await selectCompanyWithProfile(db as any, "name", "user-1")
    expect(r.profileAvailable).toBe(true)
    expect(r.data?.legal_profile).toEqual({ trade: "plaquiste" })
  })

  it("migration absente : relue sans la colonne, sans erreur", async () => {
    db.missingColumns.add("legal_profile")
    db.tables.companies.push({ user_id: "user-1", name: "Garnier" })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const r = await selectCompanyWithProfile(db as any, "name", "user-1")
    expect(r.profileAvailable).toBe(false)
    expect(r.error).toBeNull()
    expect(r.data?.name).toBe("Garnier")
  })
})

describe("POST /api/products/import", () => {
  it("crée les prestations cochées, au taux du chantier type, prix à compléter", async () => {
    const res = await importProducts(request({
      trade: "chauffagiste",
      context: "renovation",
      items: [{ id: "pac-air-eau" }, { id: "chaudiere-gaz", unit_price_ht: 3200 }, { id: "entretien-chaudiere" }],
    }))
    expect(res.status).toBe(201)
    const json = await res.json()
    expect(json.created).toBe(3)
    expect(db.tables.products.map((p) => [p.name, p.unit, p.vat_rate, p.unit_price_ht, p.user_id])).toEqual([
      ["Pose d'une pompe à chaleur air/eau", "unité", 5.5, 0, "user-1"],
      ["Remplacement d'une chaudière gaz", "unité", 20, 3200, "user-1"],
      ["Entretien annuel de chaudière", "forfait", 10, 0, "user-1"],
    ])
  })

  it("ne recrée pas une prestation déjà au catalogue", async () => {
    db.tables.products.push({ id: "x", user_id: "user-1", name: "Pose d'une prise de courant" })
    const res = await importProducts(request({ trade: "electricien", context: "standard", items: [{ id: "prise" }] }))
    expect(res.status).toBe(200)
    expect(await res.json()).toMatchObject({ created: 0, skipped: 1 })
    expect(db.tables.products).toHaveLength(1)
  })

  it("refuse un métier, un chantier ou un prix invalides, et une liste vide", async () => {
    expect((await importProducts(request({ trade: "astronaute", context: "standard", items: [{ id: "x" }] }))).status).toBe(400)
    expect((await importProducts(request({ trade: "peintre", context: "lune", items: [{ id: "murs" }] }))).status).toBe(400)
    expect((await importProducts(request({ trade: "peintre", context: "standard", items: [] }))).status).toBe(400)
    expect((await importProducts(request({ trade: "peintre", context: "standard", items: [{ id: "murs", unit_price_ht: -1 }] }))).status).toBe(400)
    expect(db.tables.products).toHaveLength(0)
  })

  it("une désignation envoyée par la requête est ignorée", async () => {
    await importProducts(request({ trade: "peintre", context: "franchise", items: [{ id: "murs", name: "<script>" }] }))
    expect(db.tables.products.map((p) => [p.name, p.vat_rate])).toEqual([["Peinture des murs, deux couches", 0]])
  })
})
