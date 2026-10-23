// @vitest-environment node
/** Notes et tâches : validation, ordre d'affichage et routes /api/notes (avec et sans la migration). */
import { beforeEach, describe, expect, it, vi } from "vitest"
import { NextRequest } from "next/server"
import { isLate, noteFromRow, parseNoteInput, parseNotePatch, splitNotes, type WorkNote } from "@/lib/planning/notes"

const note = (id: string, over: Partial<WorkNote> = {}): WorkNote => ({
  id, kind: "task", body: id, due_date: null, done_at: null, remind_at: null, client_id: null, client_name: null, chantier_id: null,
  created_at: "2026-10-20T10:00:00.000Z", ...over,
})

describe("validation d'une note", () => {
  it("accepte une tâche avec échéance : jour à Paris, stocké à midi", () => {
    const r = parseNoteInput({ kind: "task", body: "  Commander  ", due_date: "2026-10-23", client_id: "" })
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.value.body).toBe("Commander")
      expect(r.value.due_at).toBe("2026-10-23T10:00:00.000Z") // 12 h à Paris, heure d'été
      expect(r.value.client_id).toBeNull()
    }
  })
  it("une note simple n'a pas d'échéance", () => {
    expect(parseNoteInput({ kind: "note", body: "x", due_date: "2026-10-23" }).ok).toBe(false)
    expect(parseNoteInput({ body: "x" }).ok).toBe(true)
  })
  it.each([
    [{ body: "   " }, /quelque chose/],
    [{ body: "x".repeat(4001) }, /trop long/],
    [{ kind: "rappel", body: "x" }, /Type/],
    [{ kind: "task", body: "x", due_date: "2026-02-30" }, /Échéance/],
    [{ body: "x", client_id: "abc" }, /Client/],
    [{ body: "x", chantier_id: 3 }, /Chantier/],
  ])("refuse %#", (body, message) => {
    const r = parseNoteInput(body as Record<string, unknown>)
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.error).toMatch(message)
  })
})

describe("modification", () => {
  const now = new Date("2026-10-21T08:00:00Z")
  it("cocher pose la date, décocher l'efface, et ne vaut que pour une tâche", () => {
    const done = parseNotePatch({ done: true }, now)
    expect(done.ok && done.value).toEqual({ update: { done_at: "2026-10-21T08:00:00.000Z" }, taskOnly: true })
    const undone = parseNotePatch({ done: false }, now)
    expect(undone.ok && undone.value.update).toEqual({ done_at: null })
  })
  it("modifier le texte d'une note reste permis pour une note", () => {
    const r = parseNotePatch({ body: " nouveau " })
    expect(r.ok && r.value).toEqual({ update: { body: "nouveau" }, taskOnly: false })
  })
  it("retire ou change l'échéance", () => {
    expect(parseNotePatch({ due_date: null }).ok && (parseNotePatch({ due_date: null }) as { value: { update: unknown } }).value.update).toEqual({ due_at: null })
    expect(parseNotePatch({ due_date: "pas-un-jour" }).ok).toBe(false)
  })
  it("refuse le vide, un état inconnu et un texte vide", () => {
    expect(parseNotePatch({}).ok).toBe(false)
    expect(parseNotePatch({ done: "oui" }).ok).toBe(false)
    expect(parseNotePatch({ body: "  " }).ok).toBe(false)
  })
})

describe("lecture et ordre", () => {
  it("relit l'échéance à Paris et le client joint", () => {
    const n = noteFromRow({ id: "1", kind: "task", body: "b", due_at: "2026-10-23T10:00:00Z", done_at: null, created_at: "x", client: [{ name: "M. Test" }] })
    expect(n.due_date).toBe("2026-10-23")
    expect(n.client_name).toBe("M. Test")
  })
  it("en retard : tâche ouverte dont l'échéance est passée, jamais une tâche faite ni une note", () => {
    expect(isLate(note("a", { due_date: "2026-10-20" }), "2026-10-21")).toBe(true)
    expect(isLate(note("a", { due_date: "2026-10-21" }), "2026-10-21")).toBe(false)
    expect(isLate(note("a", { due_date: "2026-10-20", done_at: "2026-10-20T10:00:00Z" }), "2026-10-21")).toBe(false)
    expect(isLate(note("a", { kind: "note", due_date: "2026-10-20" }), "2026-10-21")).toBe(false)
  })
  it("tâches ouvertes par échéance (sans échéance en dernier), puis notes récentes d'abord", () => {
    const { open, done, texts } = splitNotes([
      note("sans"), note("tard", { due_date: "2026-10-25" }), note("tot", { due_date: "2026-10-22" }),
      note("fait", { done_at: "2026-10-20T12:00:00Z" }),
      note("n1", { kind: "note", created_at: "2026-10-19T10:00:00Z" }), note("n2", { kind: "note", created_at: "2026-10-20T10:00:00Z" }),
    ])
    expect(open.map((n) => n.id)).toEqual(["tot", "tard", "sans"])
    expect(done.map((n) => n.id)).toEqual(["fait"])
    expect(texts.map((n) => n.id)).toEqual(["n2", "n1"])
  })
})

type Result = { data?: unknown; error?: { code?: string; message?: string } | null }
const h = vi.hoisted(() => ({
  user: { id: "11111111-1111-4111-8111-111111111111" } as { id: string } | null,
  result: { data: [], error: null } as Result,
  calls: [] as { op: string; payload?: unknown; filters: [string, unknown][] }[],
  ownsClient: true,
}))
vi.mock("@/lib/artisan/server", () => ({ ownsClient: async () => h.ownsClient }))
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: { getUser: async () => ({ data: { user: h.user } }) },
    from() {
      const rec = { op: "select", payload: undefined as unknown, filters: [] as [string, unknown][] }
      h.calls.push(rec)
      const c: Record<string, unknown> = {}
      for (const m of ["eq", "is"]) c[m] = (k: string, v: unknown) => { rec.filters.push([`${m}:${k}`, v]); return c }
      for (const m of ["select", "order", "limit"]) c[m] = () => c
      c.insert = (p: unknown) => { rec.op = "insert"; rec.payload = p; return c }
      c.update = (p: unknown) => { rec.op = "update"; rec.payload = p; return c }
      c.delete = () => { rec.op = "delete"; return c }
      c.single = async () => h.result
      c.maybeSingle = async () => h.result
      c.then = (ok: (r: Result) => unknown, ko?: (e: unknown) => unknown) => Promise.resolve(h.result).then(ok, ko)
      return c
    },
  }),
}))

const ID = "22222222-2222-4222-8222-222222222222"
const row = { id: ID, kind: "task", body: "Tâche", due_at: null, done_at: null, client_id: null, chantier_id: null, created_at: "2026-10-20T10:00:00Z", client: null }
const MISSING = { code: "42P01", message: 'relation "public.work_notes" does not exist' }
const req = (url: string, method = "GET", body?: unknown) =>
  new NextRequest(`https://qonforme.test${url}`, { method, ...(body ? { body: JSON.stringify(body), headers: { "Content-Type": "application/json" } } : {}) })
const ctx = (id: string) => ({ params: Promise.resolve({ id }) })

describe("/api/notes", () => {
  beforeEach(() => { h.user = { id: "11111111-1111-4111-8111-111111111111" }; h.result = { data: [row], error: null }; h.calls = []; h.ownsClient = true })

  it("GET : 401, identifiant invalide, filtre par chantier et par compte", async () => {
    const { GET } = await import("@/app/api/notes/route")
    h.user = null
    expect((await GET(req("/api/notes"))).status).toBe(401)
    h.user = { id: "u" }
    expect((await GET(req("/api/notes?chantier_id=abc"))).status).toBe(400)
    const res = await GET(req(`/api/notes?chantier_id=${ID}`))
    expect((await res.json()).notes[0]).toMatchObject({ id: ID, kind: "task" })
    expect(h.calls[0].filters).toContainEqual(["eq:chantier_id", ID])
    expect(h.calls[0].filters).toContainEqual(["eq:user_id", "u"])
  })
  it("GET open=1 : tâches ouvertes seulement", async () => {
    const { GET } = await import("@/app/api/notes/route")
    await GET(req("/api/notes?open=1"))
    expect(h.calls[0].filters).toContainEqual(["eq:kind", "task"])
    expect(h.calls[0].filters).toContainEqual(["is:done_at", null])
  })
  it("GET : sans la migration, « indisponible »", async () => {
    const { GET } = await import("@/app/api/notes/route")
    h.result = { data: null, error: MISSING }
    expect(await (await GET(req("/api/notes"))).json()).toMatchObject({ available: false, notes: [] })
  })
  it("POST : crée pour le compte connecté, jamais pour un autre", async () => {
    const { POST } = await import("@/app/api/notes/route")
    const res = await POST(req("/api/notes", "POST", { kind: "task", body: "À faire", due_date: "2026-10-23", user_id: "pirate" }))
    expect(res.status).toBe(201)
    const ins = h.calls.find((c) => c.op === "insert")!.payload as Record<string, unknown>
    expect(ins.user_id).toBe(h.user!.id)
    expect(ins.due_at).toBe("2026-10-23T10:00:00.000Z")
  })
  it("POST : 400, 404 (client d'un autre) et 503 (sans migration)", async () => {
    const { POST } = await import("@/app/api/notes/route")
    expect((await POST(req("/api/notes", "POST", { body: "" }))).status).toBe(400)
    h.ownsClient = false
    const body = { body: "x", client_id: "33333333-3333-4333-8333-333333333333" }
    expect((await POST(req("/api/notes", "POST", body))).status).toBe(404)
    h.ownsClient = true
    h.result = { data: null, error: MISSING }
    expect((await POST(req("/api/notes", "POST", body))).status).toBe(503)
  })
  it("PATCH : cocher ne touche qu'une tâche du compte", async () => {
    const { PATCH } = await import("@/app/api/notes/[id]/route")
    expect((await PATCH(req("/x", "PATCH", { done: true }), ctx("nope"))).status).toBe(404)
    expect((await PATCH(req("/x", "PATCH", {}), ctx(ID))).status).toBe(400)
    const res = await PATCH(req("/x", "PATCH", { done: true }), ctx(ID))
    expect(res.status).toBe(200)
    const upd = h.calls.find((c) => c.op === "update")!
    expect(upd.filters).toContainEqual(["eq:kind", "task"])
    expect(upd.filters).toContainEqual(["eq:user_id", h.user!.id])
  })
  it("PATCH du texte d'une note : pas de filtre sur le type ; introuvable → 404", async () => {
    const { PATCH } = await import("@/app/api/notes/[id]/route")
    await PATCH(req("/x", "PATCH", { body: "corrigé" }), ctx(ID))
    expect(h.calls.find((c) => c.op === "update")!.filters.some(([k]) => k === "eq:kind")).toBe(false)
    h.result = { data: null, error: null }
    expect((await PATCH(req("/x", "PATCH", { body: "x" }), ctx(ID))).status).toBe(404)
  })
  it("DELETE : limité au compte, 404 si rien n'est supprimé", async () => {
    const { DELETE } = await import("@/app/api/notes/[id]/route")
    h.result = { data: [{ id: ID }], error: null }
    expect((await DELETE(req("/x", "DELETE"), ctx(ID))).status).toBe(200)
    expect(h.calls.find((c) => c.op === "delete")!.filters).toContainEqual(["eq:user_id", h.user!.id])
    h.result = { data: [], error: null }
    expect((await DELETE(req("/x", "DELETE"), ctx(ID))).status).toBe(404)
  })
})
