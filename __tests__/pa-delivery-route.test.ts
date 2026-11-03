/**
 * Route d'envoi d'une facture : le canal « plateforme » est refusé tant que le
 * dépôt (lot 3) n'est pas livré, AVANT toute lecture ou émission (aucun numéro
 * attribué) ; une adresse mal formée est refusée.
 */
import { describe, expect, it, vi } from "vitest"
import { NextRequest } from "next/server"

const touched: string[] = []
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: { getUser: async () => ({ data: { user: { id: "u1", email: "a@b.fr" } } }) },
    from: (t: string) => { touched.push(t); throw new Error(`lecture inattendue de ${t}`) },
  }),
}))

import { POST } from "@/app/api/invoices/[id]/send/route"

const params = { params: Promise.resolve({ id: "inv-1" }) }
const req = (body: unknown) => new NextRequest("http://localhost/api", { method: "POST", body: JSON.stringify(body) })

describe("envoi par la plateforme, avant le lot 3", () => {
  it("refusé (409) sans rien lire ni émettre", async () => {
    const res = await POST(req({ channel: "platform", address: "0225:443061841" }), params)
    expect(res.status).toBe(409)
    expect((await res.json()).error).toContain("pas encore ouvert")
    expect(touched).toEqual([])
  })
  it("adresse absente ou mal formée, canal inconnu : 400", async () => {
    expect((await POST(req({ channel: "platform" }), params)).status).toBe(400)
    expect((await POST(req({ channel: "platform", address: "a b" }), params)).status).toBe(400)
    expect((await POST(req({ channel: "fax" }), params)).status).toBe(400)
    expect(touched).toEqual([])
  })
})
