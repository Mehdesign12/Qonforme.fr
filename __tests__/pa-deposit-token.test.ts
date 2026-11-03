/** Jeton d'accès pour un dépôt (lib/pa/deposit.ts) : sous verrou, verrou toujours rendu. */
import { beforeEach, describe, expect, it, vi } from "vitest"

const m = vi.hoisted(() => ({ lockFree: true, released: 0, row: { status: "active" } as Record<string, unknown> | null, token: async (): Promise<string> => "tok" }))
vi.mock("@/lib/pa/store", async (orig) => ({
  ...(await orig<typeof import("@/lib/pa/store")>()),
  claimLock: async () => m.lockFree,
  releaseLock: async () => { m.released++ },
  loadConnection: async () => ({ ok: true, row: m.row }),
  accessTokenFor: async () => m.token(),
}))
import { obtainToken } from "@/lib/pa/deposit"
import { ConnectionError } from "@/lib/pa/store"

const admin = {} as never
const wait = async () => {}
beforeEach(() => { Object.assign(m, { lockFree: true, released: 0, row: { status: "active" }, token: async () => "tok" }) })

describe("jeton pour un dépôt", () => {
  it("raccordement actif : jeton, verrou rendu", async () => {
    expect(await obtainToken(admin, "u1", { wait })).toEqual({ ok: true, token: "tok" })
    expect(m.released).toBe(1)
  })
  it("verrou pris par la relève : « busy » après quelques essais, rien à rendre", async () => {
    m.lockFree = false
    expect(await obtainToken(admin, "u1", { wait, tries: 3 })).toMatchObject({ ok: false, reason: "busy" })
    expect(m.released).toBe(0)
  })
  it("raccordement pas actif, autorisation expirée, panne : refus lisible, verrou rendu", async () => {
    m.row = { status: "verifying" }
    expect(await obtainToken(admin, "u1", { wait })).toMatchObject({ ok: false, reason: "not_connected" })
    m.row = { status: "active" }
    m.token = async () => { throw new ConnectionError("expired", "x") }
    expect(await obtainToken(admin, "u1", { wait })).toMatchObject({ ok: false, reason: "expired" })
    m.token = async () => { throw new Error("réseau") }
    expect(await obtainToken(admin, "u1", { wait })).toMatchObject({ ok: false, reason: "unavailable" })
    expect(m.released).toBe(3)
  })
})
