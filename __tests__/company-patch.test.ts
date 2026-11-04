/**
 * PATCH /api/company : un compte sans entreprise reçoit une 404 lisible
 * (avant : 500 « Cannot coerce the result to a single JSON object »).
 */
import { describe, it, expect, vi, beforeEach } from "vitest"
import { NextRequest } from "next/server"

let rows: Record<string, unknown>[] = []
let dbError: { message: string } | null = null

function client() {
  const chain = {
    update: () => chain,
    eq: () => chain,
    select: () => chain,
    maybeSingle: async () => ({ data: dbError ? null : rows[0] ?? null, error: dbError }),
    single: async () => (rows.length === 1 ? { data: rows[0], error: null } : { data: null, error: { message: "Cannot coerce the result to a single JSON object" } }),
  }
  return {
    auth: { getUser: async () => ({ data: { user: { id: "u1" } } }) },
    from: () => chain,
  }
}
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => client(),
  createAdminClient: () => client(),
  createClientWithToken: () => client(),
}))

import { PATCH } from "@/app/api/company/route"
const req = (body: string) => new NextRequest("https://qonforme.fr/api/company", { method: "PATCH", body, headers: { "content-type": "application/json" } })

describe("PATCH /api/company", () => {
  beforeEach(() => { rows = []; dbError = null })

  it("sans entreprise : 404 avec un message clair, jamais 500", async () => {
    const res = await PATCH(req(JSON.stringify({ name: "X", siren: "123456789" })))
    expect(res.status).toBe(404)
    const json = await res.json()
    expect(json.code).toBe("COMPANY_NOT_FOUND")
    expect(json.error).not.toMatch(/coerce/i)
  })

  it("avec une entreprise : 200 et l'entreprise mise à jour", async () => {
    rows = [{ id: "c1", name: "X" }]
    const res = await PATCH(req(JSON.stringify({ name: "X" })))
    expect(res.status).toBe(200)
    expect((await res.json()).company.id).toBe("c1")
  })

  it("corps illisible : 400 ; erreur de base : 500 sans message technique", async () => {
    expect((await PATCH(req("{pas du json"))).status).toBe(400)
    dbError = { message: "relation companies does not exist" }
    const res = await PATCH(req(JSON.stringify({ name: "X" })))
    expect(res.status).toBe(500)
    expect((await res.json()).error).not.toMatch(/relation/)
  })
})
