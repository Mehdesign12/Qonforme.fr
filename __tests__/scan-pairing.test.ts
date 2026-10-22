// @vitest-environment node
/** Appairage du téléphone : jeton haché, cookie, expiration, révocation, et ce que le téléphone peut (et ne peut pas) faire. */
import { beforeEach, describe, expect, it, vi } from "vitest"
import { NextRequest } from "next/server"
import { hashToken, generateToken } from "@/lib/signature/crypto"
import { pairingState } from "@/lib/scan/pairing"
import { isTrackingPage } from "@/lib/consent"

type Result = { data?: unknown; error?: { code?: string; message?: string } | null; count?: number | null }
type Rec = { client: "admin" | "user"; table: string; op: string; payload?: unknown; filters: [string, ...unknown[]][]; cols?: string; opts?: { head?: boolean } }

const h = vi.hoisted(() => ({
  user: { id: "11111111-1111-4111-8111-111111111111" } as { id: string } | null,
  cookie: undefined as string | undefined,
  calls: [] as Rec[],
  on: (() => ({ data: null, error: null })) as (rec: Rec) => Result,
  uploads: [] as string[],
  removed: [] as string[][],
}))

vi.mock("next/headers", () => ({ cookies: () => ({ get: (name: string) => (name === "q_scan_pair" && h.cookie ? { value: h.cookie } : undefined) }) }))
vi.mock("@/lib/artisan/server", () => ({ ownsClient: async () => true }))
vi.mock("@/lib/blog-images/server", async (orig) => {
  const real = await orig<typeof import("@/lib/blog-images/server")>()
  return { ...real, prepareImage: async (buf: Buffer) => ({ data: Buffer.alloc(Math.min(buf.length, 5000), 1), mimeType: "image/webp", width: 800, height: 1100 }) }
})
function fake(client: "admin" | "user") {
  return {
    auth: { getUser: async () => ({ data: { user: h.user } }) },
    from(table: string) {
      const rec: Rec = { client, table, op: "select", filters: [] }
      h.calls.push(rec)
      const c: Record<string, unknown> = {}
      for (const m of ["eq", "is", "in", "gt", "lt", "order", "limit"]) c[m] = (...a: unknown[]) => { rec.filters.push([m, ...a]); return c }
      c.select = (cols?: string, opts?: { head?: boolean }) => { rec.cols = cols; rec.opts = opts; return c }
      c.insert = (p: unknown) => { rec.op = "insert"; rec.payload = p; return c }
      c.update = (p: unknown) => { rec.op = "update"; rec.payload = p; return c }
      c.delete = () => { rec.op = "delete"; return c }
      c.single = async () => h.on(rec)
      c.maybeSingle = async () => h.on(rec)
      c.then = (ok: (r: Result) => unknown, ko?: (e: unknown) => unknown) => Promise.resolve(h.on(rec)).then(ok, ko)
      return c
    },
    storage: { from: () => ({
      upload: async (path: string) => { h.uploads.push(path); return { error: null } },
      remove: async (paths: string[]) => { h.removed.push(paths); return { error: null } },
      createSignedUrls: async () => ({ data: [] }),
    }) },
  }
}
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => fake("user"), createAdminClient: () => fake("admin") }))

const UID = "11111111-1111-4111-8111-111111111111"
const PID = "44444444-4444-4444-8444-444444444444"
const DOC = "22222222-2222-4222-8222-222222222222"
const TOKEN = generateToken()
const future = () => new Date(Date.now() + 10 * 60_000).toISOString()
const past = () => new Date(Date.now() - 60_000).toISOString()
const pairingRow = (over: Record<string, unknown> = {}) => ({ id: PID, user_id: UID, token_hash: hashToken(TOKEN), created_at: past(), expires_at: future(), claimed_at: null, revoked_at: null, ...over })
const MISSING = { code: "42P01", message: "relation does not exist" }
const docRow = () => ({ id: DOC, kind: "other", status: "to_classify", title: null, supplier: null, doc_number: null, doc_date: null, amount_cents: null, client_id: null, chantier_id: null, created_at: "2026-10-22T10:00:00Z", client: null, pages: [] })

/** Compte gratuit raisonnable ; `pairing` renvoie la ligne d'appairage demandée par jeton ou par identifiant. */
function world(opts: { pairing?: Record<string, unknown> | null; docs?: number; docPairing?: string | null; missing?: boolean } = {}) {
  const { pairing = pairingRow(), docs = 2, docPairing = PID, missing = false } = opts
  return (rec: Rec): Result => {
    if (rec.table === "scan_pairings") {
      if (missing) return { data: null, error: MISSING }
      if (rec.op === "insert") return { data: { id: PID }, error: null }
      if (rec.op === "update") return { data: null, error: null }
      return { data: pairing, error: null }
    }
    if (rec.table === "subscriptions") return { data: null, error: null }
    if (rec.table === "scanned_documents" && rec.opts?.head) {
      return { data: null, error: null, count: rec.filters.some((f) => f[1] === "pairing_id") ? docs : 3 }
    }
    if (rec.table === "scanned_document_pages" && rec.cols === "bytes") return { data: [{ bytes: 1000 }], error: null }
    if (rec.table === "scanned_document_pages" && rec.op === "insert") return { data: { id: "p", position: 1, bytes: 5000, width: 800, height: 1100 }, error: null }
    if (rec.table === "scanned_documents" && rec.op === "insert") return { data: docRow(), error: null }
    if (rec.table === "scanned_documents" && rec.op === "select") return { data: { id: DOC, pairing_id: docPairing }, error: null }
    if (rec.table === "scanned_documents" && rec.op === "delete") return { data: [{ id: DOC }], error: null }
    if (rec.table === "scanned_document_pages") return { data: [], error: null }
    return { data: [], error: null }
  }
}

const req = (url: string, method = "GET", body?: unknown) =>
  new NextRequest(`https://qonforme.test${url}`, { method, ...(body ? { body: JSON.stringify(body), headers: { "Content-Type": "application/json" } } : {}) })
const ctx = (id: string) => ({ params: Promise.resolve({ id }) })
function png(extra = 0): Buffer {
  const b = Buffer.alloc(33 + extra)
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(b, 0)
  b.writeUInt32BE(13, 8); b.write("IHDR", 12); b.writeUInt32BE(10, 16); b.writeUInt32BE(10, 20)
  return b
}
const pageReq = (file: Buffer) => {
  const form = new FormData()
  form.set("file", new File([new Uint8Array(file)], "p.jpg", { type: "image/jpeg" }))
  form.set("position", "1")
  return new NextRequest(`https://qonforme.test/x`, { method: "POST", body: form })
}

beforeEach(() => { h.user = { id: UID }; h.cookie = TOKEN; h.calls = []; h.uploads = []; h.removed = []; h.on = world() })

describe("état d'un appairage", () => {
  it("actif, expiré, révoqué", () => {
    expect(pairingState({ expires_at: future(), revoked_at: null })).toBe("active")
    expect(pairingState({ expires_at: past(), revoked_at: null })).toBe("expired")
    expect(pairingState({ expires_at: future(), revoked_at: past() })).toBe("revoked")
  })
})

describe("POST /api/scan/pairings (ordinateur)", () => {
  const usable = (rec: Rec): Result => {
    if (rec.table === "scanned_documents" && rec.opts?.head) return { data: null, error: null, count: 1 }
    if (rec.table === "scanned_document_pages") return { data: [], error: null }
    return world()(rec)
  }
  it("crée un code : l'empreinte est stockée, jamais le jeton, et l'adresse contient le jeton une seule fois", async () => {
    const { POST } = await import("@/app/api/scan/pairings/route")
    h.on = usable
    const res = await POST()
    expect(res.status).toBe(201)
    const json = await res.json()
    const token = String(json.url).split("/scan/p/")[1]
    expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/)
    const insert = h.calls.find((c) => c.table === "scan_pairings" && c.op === "insert")!
    expect(insert.client).toBe("admin")
    const row = insert.payload as Record<string, string>
    expect(row.token_hash).toBe(hashToken(token))
    expect(JSON.stringify(row)).not.toContain(token)
    expect(row.user_id).toBe(UID)
    expect(new Date(row.expires_at).getTime() - new Date(row.created_at).getTime()).toBe(15 * 60_000)
    // le code précédent est révoqué
    expect(h.calls.some((c) => c.table === "scan_pairings" && c.op === "update" && (c.payload as Record<string, unknown>).revoked_at)).toBe(true)
  })
  it("401 sans connexion ; 503 PAIRING_UNAVAILABLE sans la migration", async () => {
    const { POST } = await import("@/app/api/scan/pairings/route")
    h.user = null
    expect((await POST()).status).toBe(401)
    h.user = { id: UID }
    h.on = (rec) => (rec.table === "scan_pairings" ? { data: null, error: MISSING } : usable(rec))
    const res = await POST()
    expect(res.status).toBe(503)
    expect((await res.json()).code).toBe("PAIRING_UNAVAILABLE")
  })
})

describe("état et révocation depuis l'ordinateur", () => {
  it("GET : état, téléphone connecté, documents reçus ; limité au compte", async () => {
    const { GET } = await import("@/app/api/scan/pairings/[id]/route")
    h.on = world({ pairing: pairingRow({ claimed_at: past() }), docs: 3 })
    const json = await (await GET(req("/x"), ctx(PID))).json()
    expect(json).toMatchObject({ state: "active", claimed: true, documents: 3 })
    expect(h.calls.find((c) => c.table === "scan_pairings")!.filters).toContainEqual(["eq", "user_id", UID])
    expect((await GET(req("/x"), ctx("pas-un-uuid"))).status).toBe(404)
    h.on = world({ pairing: null })
    expect((await GET(req("/x"), ctx(PID))).status).toBe(404)
  })
  it("DELETE : révoque le code du compte connecté", async () => {
    const { DELETE } = await import("@/app/api/scan/pairings/[id]/route")
    expect((await DELETE(req("/x", "DELETE"), ctx(PID))).status).toBe(200)
    const upd = h.calls.find((c) => c.op === "update")!
    expect(upd.filters).toContainEqual(["eq", "user_id", UID])
    expect((upd.payload as Record<string, unknown>).revoked_at).toBeTruthy()
    h.user = null
    expect((await DELETE(req("/x", "DELETE"), ctx(PID))).status).toBe(401)
  })
})

describe("GET /scan/p/<jeton> (entrée du téléphone)", () => {
  it("pose un cookie HttpOnly à durée limitée et redirige sans le jeton dans l'adresse", async () => {
    const { GET } = await import("@/app/scan/p/[token]/route")
    const res = await GET(req(`/scan/p/${TOKEN}`), { params: { token: TOKEN } })
    expect(res.status).toBe(303)
    expect(res.headers.get("location")).toBe("https://qonforme.test/scan-telephone")
    expect(res.headers.get("location")).not.toContain(TOKEN)
    const cookie = res.headers.get("set-cookie") ?? ""
    expect(cookie).toContain(`q_scan_pair=${TOKEN}`)
    expect(cookie.toLowerCase()).toContain("httponly")
    expect(cookie.toLowerCase()).toContain("samesite=lax")
    expect(cookie.toLowerCase()).toContain("secure")
    expect(Number(/max-age=(\d+)/i.exec(cookie)![1])).toBeLessThanOrEqual(600)
    expect(res.headers.get("cache-control")).toBe("no-store")
    expect(res.headers.get("referrer-policy")).toBe("no-referrer")
    // la première ouverture est notée
    expect(h.calls.some((c) => c.op === "update" && (c.payload as Record<string, unknown>).claimed_at)).toBe(true)
  })
  it("jeton inconnu, mal formé, expiré ou révoqué : aucun cookie", async () => {
    const { GET } = await import("@/app/scan/p/[token]/route")
    for (const [row, token, etat] of [[null, TOKEN, "inconnu"], [pairingRow(), "court", "inconnu"], [pairingRow({ expires_at: past() }), TOKEN, "expire"], [pairingRow({ revoked_at: past() }), TOKEN, "expire"]] as const) {
      h.on = world({ pairing: row })
      const res = await GET(req("/x"), { params: { token } })
      expect(res.headers.get("set-cookie")).toBeNull()
      expect(res.headers.get("location")).toContain(`etat=${etat}`)
    }
  })
})

describe("ce que le téléphone peut faire", () => {
  it("créer un document pour le compte de l'appairage, sans client ni chantier, marqué de l'appairage", async () => {
    const { POST } = await import("@/app/api/scan/pair/documents/route")
    const res = await POST(req("/x", "POST", { kind: "delivery_note", supplier: "Point P", client_id: "33333333-3333-4333-8333-333333333333", chantier_id: "33333333-3333-4333-8333-333333333333", user_id: "pirate", pairing_id: "autre" }))
    expect(res.status).toBe(201)
    const ins = h.calls.find((c) => c.table === "scanned_documents" && c.op === "insert")!
    expect(ins.client).toBe("admin")
    expect(ins.payload).toMatchObject({ user_id: UID, pairing_id: PID, kind: "delivery_note", supplier: "Point P" })
    expect(ins.payload).not.toHaveProperty("client_id")
    expect(ins.payload).not.toHaveProperty("chantier_id")
  })
  it("refus sans cookie (401), avec un code expiré ou révoqué (410), inconnu (401)", async () => {
    const { POST } = await import("@/app/api/scan/pair/documents/route")
    h.cookie = undefined
    expect((await POST(req("/x", "POST", {}))).status).toBe(401)
    h.cookie = TOKEN
    h.on = world({ pairing: pairingRow({ expires_at: past() }) })
    expect((await POST(req("/x", "POST", {}))).status).toBe(410)
    h.on = world({ pairing: pairingRow({ revoked_at: past() }) })
    expect((await POST(req("/x", "POST", {}))).status).toBe(410)
    h.on = world({ pairing: null })
    expect((await POST(req("/x", "POST", {}))).status).toBe(401)
    expect(h.calls.some((c) => c.table === "scanned_documents" && c.op === "insert")).toBe(false)
  })
  it("20 documents au plus par code", async () => {
    const { POST } = await import("@/app/api/scan/pair/documents/route")
    h.on = world({ docs: 20 })
    const res = await POST(req("/x", "POST", {}))
    expect(res.status).toBe(409)
    expect((await res.json()).code).toBe("PAIRING_LIMIT")
  })
  it("le quota du compte s'applique aussi au téléphone", async () => {
    const { POST } = await import("@/app/api/scan/pair/documents/route")
    const base = world()
    h.on = (rec) => (rec.table === "scanned_documents" && rec.opts?.head && !rec.filters.some((f) => f[1] === "pairing_id") ? { data: null, error: null, count: 50 } : base(rec))
    const res = await POST(req("/x", "POST", {}))
    expect(res.status).toBe(409)
    expect((await res.json()).code).toBe("SCAN_QUOTA")
  })
  it("envoyer une page à un document de SON appairage seulement", async () => {
    const { POST } = await import("@/app/api/scan/pair/documents/[id]/pages/route")
    expect((await POST(pageReq(png(500)), ctx(DOC))).status).toBe(201)
    expect(h.uploads).toEqual([`${UID}/${DOC}/1.webp`])
    // document d'un autre appairage, ou ajouté depuis l'ordinateur : introuvable
    for (const docPairing of ["99999999-9999-4999-8999-999999999999", null]) {
      h.uploads = []
      h.on = world({ docPairing })
      expect((await POST(pageReq(png(500)), ctx(DOC))).status).toBe(404)
      expect(h.uploads).toHaveLength(0)
    }
    h.cookie = undefined
    expect((await POST(pageReq(png()), ctx(DOC))).status).toBe(401)
  })
  it("supprimer seulement un document de SON appairage", async () => {
    const { DELETE } = await import("@/app/api/scan/pair/documents/[id]/route")
    expect((await DELETE(req("/x", "DELETE"), ctx(DOC))).status).toBe(200)
    h.on = world({ docPairing: null })
    h.calls = []
    expect((await DELETE(req("/x", "DELETE"), ctx(DOC))).status).toBe(404)
    expect(h.calls.some((c) => c.op === "delete")).toBe(false)
  })
  it("aucune route de lecture n'existe côté téléphone : la liste et les fiches restent au compte connecté", async () => {
    const fs = await import("node:fs")
    expect(fs.existsSync("app/api/scan/pair/documents/route.ts")).toBe(true)
    const src = fs.readFileSync("app/api/scan/pair/documents/route.ts", "utf8")
    expect(src).not.toMatch(/export async function (GET|PATCH)/)
  })
})

describe("pages du téléphone appairé", () => {
  it("ni bandeau de cookies ni traceur sur le scan du téléphone", () => {
    expect(isTrackingPage("/scan-telephone")).toBe(false)
    expect(isTrackingPage("/scan/p/abc")).toBe(false)
    expect(isTrackingPage("/documents")).toBe(true)
  })
})
