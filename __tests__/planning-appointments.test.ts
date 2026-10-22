// @vitest-environment node
/**
 * Planning : heure de Paris, validation des rendez-vous, mise en page de la
 * grille et routes /api/appointments (avec et sans la migration).
 */
import { beforeEach, describe, expect, it, vi } from "vitest"
import { NextRequest } from "next/server"
import {
  appointmentsOnDay, dayLabel, durationLabel, parseAppointmentInput, parisParts, parisToIso, placeDay,
  timeLabel, weekDays, weekLabel, weekRangeIso, weekStart, type Appointment,
} from "@/lib/planning/appointments"

const appt = (id: string, start: string, end: string, status: Appointment["status"] = "planned"): Appointment => ({
  id, kind: "visite", title: id, starts_at: start, ends_at: end, address: null, notes: null, status,
  client_id: null, client_name: null, chantier_id: null,
})

describe("heure de Paris", () => {
  it("convertit l'heure d'été (UTC+2) et d'hiver (UTC+1)", () => {
    expect(parisToIso("2026-07-15", "09:00")).toBe("2026-07-15T07:00:00.000Z")
    expect(parisToIso("2026-12-15", "09:00")).toBe("2026-12-15T08:00:00.000Z")
  })
  it("suit les deux changements d'heure de 2026", () => {
    // 29 mars : 02:00 devient 03:00 ; 25 octobre : 03:00 redevient 02:00
    expect(parisToIso("2026-03-29", "08:00")).toBe("2026-03-29T06:00:00.000Z")
    expect(parisToIso("2026-03-28", "08:00")).toBe("2026-03-28T07:00:00.000Z")
    expect(parisToIso("2026-10-25", "08:00")).toBe("2026-10-25T07:00:00.000Z")
    expect(parisToIso("2026-10-24", "08:00")).toBe("2026-10-24T06:00:00.000Z")
  })
  it("relit la date et l'heure à Paris, minuit compris", () => {
    expect(parisParts("2026-07-15T07:00:00.000Z")).toEqual({ date: "2026-07-15", time: "09:00", minutes: 540 })
    expect(parisParts("2026-07-14T22:00:00.000Z")).toEqual({ date: "2026-07-15", time: "00:00", minutes: 0 })
  })
  it("aller-retour sans dérive sur toute l'année", () => {
    for (let d = 0; d < 366; d += 7) {
      const day = new Date(Date.UTC(2026, 0, 1 + d)).toISOString().slice(0, 10)
      for (const t of ["00:00", "07:30", "12:00", "23:45"]) {
        const p = parisParts(parisToIso(day, t))
        expect([p.date, p.time]).toEqual([day, t])
      }
    }
  })
})

describe("semaine et libellés", () => {
  it("la semaine commence le lundi", () => {
    expect(weekStart("2026-10-21")).toBe("2026-10-19") // mercredi
    expect(weekStart("2026-10-25")).toBe("2026-10-19") // dimanche
    expect(weekStart("2026-10-19")).toBe("2026-10-19")
    expect(weekDays("2026-10-19")).toHaveLength(7)
    expect(weekDays("2026-10-19")[6]).toBe("2026-10-25")
  })
  it("libellés en français", () => {
    expect(dayLabel("2026-10-21")).toBe("Mercredi 21 octobre")
    expect(weekLabel("2026-10-19")).toBe("19 – 25 octobre 2026")
    expect(weekLabel("2026-09-28")).toBe("28 sep. – 4 oct. 2026")
    expect(timeLabel("08:00")).toBe("8 h")
    expect(timeLabel("13:30")).toBe("13 h 30")
    expect(durationLabel(30)).toBe("30 min")
    expect(durationLabel(120)).toBe("2 h")
    expect(durationLabel(90)).toBe("1 h 30")
  })
  it("la fenêtre de lecture couvre exactement la semaine à Paris", () => {
    const { from, to } = weekRangeIso("2026-10-19")
    expect(from).toBe("2026-10-18T22:00:00.000Z")
    // Le dimanche 25 octobre 2026 est le jour du retour à l'heure d'hiver : lundi 0 h = 23 h UTC
    expect(to).toBe("2026-10-25T23:00:00.000Z")
  })
})

describe("validation", () => {
  const ok = { kind: "chantier", title: "  Pose  ", date: "2026-10-21", start: "08:30", duration_min: 90, client_id: "", address: " 8 rue X " }
  it("accepte un rendez-vous complet et calcule les instants", () => {
    const r = parseAppointmentInput(ok)
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.value.title).toBe("Pose")
      expect(r.value.address).toBe("8 rue X")
      expect(r.value.client_id).toBeNull()
      expect(r.value.starts_at).toBe("2026-10-21T06:30:00.000Z")
      expect(r.value.ends_at).toBe("2026-10-21T08:00:00.000Z")
    }
  })
  it.each([
    [{ ...ok, title: "   " }, /intitulé/],
    [{ ...ok, title: "x".repeat(201) }, /trop long/],
    [{ ...ok, kind: "reunion" }, /Type/],
    [{ ...ok, date: "2026-02-30" }, /Date/],
    [{ ...ok, start: "25:00" }, /Heure/],
    [{ ...ok, start: "8:30" }, /Heure/],
    [{ ...ok, duration_min: 5 }, /Durée/],
    [{ ...ok, duration_min: 1441 }, /Durée/],
    [{ ...ok, duration_min: 1.5 }, /Durée/],
    [{ ...ok, client_id: "pas-un-uuid" }, /Client/],
    [{ ...ok, chantier_id: 12 }, /Chantier/],
    [{ ...ok, address: "a".repeat(301) }, /adresse/],
    [{ ...ok, notes: "n".repeat(2001) }, /notes/],
  ])("refuse %#", (body, message) => {
    const r = parseAppointmentInput(body as Record<string, unknown>)
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.error).toMatch(message)
  })
})

describe("grille de la semaine", () => {
  const day = "2026-10-21"
  it("place un rendez-vous selon l'heure de Paris", () => {
    const a = appt("a", parisToIso(day, "09:00"), parisToIso(day, "11:00"))
    const [p] = placeDay(day, [a])
    expect(p.top).toBe(2 * 56)
    expect(p.height).toBe(2 * 56)
    expect([p.column, p.columns]).toEqual([0, 1])
  })
  it("met côte à côte deux rendez-vous qui se chevauchent, pas deux qui se suivent", () => {
    const a = appt("a", parisToIso(day, "09:00"), parisToIso(day, "11:00"))
    const b = appt("b", parisToIso(day, "10:00"), parisToIso(day, "12:00"))
    const c = appt("c", parisToIso(day, "12:00"), parisToIso(day, "13:00"))
    const placed = placeDay(day, [a, b, c])
    const by = Object.fromEntries(placed.map((p) => [p.appointment.id, p]))
    expect(by.a.columns).toBe(2)
    expect(by.b.columns).toBe(2)
    expect(by.a.column).not.toBe(by.b.column)
    expect(by.c.columns).toBe(1)
  })
  it("ignore les rendez-vous annulés et ceux d'un autre jour", () => {
    const a = appt("a", parisToIso(day, "09:00"), parisToIso(day, "10:00"), "cancelled")
    const b = appt("b", parisToIso("2026-10-22", "09:00"), parisToIso("2026-10-22", "10:00"))
    expect(placeDay(day, [a, b])).toHaveLength(0)
  })
  it("donne une hauteur minimale à un rendez-vous très court", () => {
    const a = appt("a", parisToIso(day, "09:00"), parisToIso(day, "09:15"))
    expect(placeDay(day, [a])[0].height).toBeGreaterThanOrEqual(22)
  })
  it("liste la journée par heure, les annulés en dernier", () => {
    const a = appt("a", parisToIso(day, "14:00"), parisToIso(day, "15:00"))
    const b = appt("b", parisToIso(day, "08:00"), parisToIso(day, "09:00"), "cancelled")
    const c = appt("c", parisToIso(day, "10:00"), parisToIso(day, "11:00"))
    expect(appointmentsOnDay(day, [a, b, c]).map((x) => x.id)).toEqual(["c", "a", "b"])
  })
})

/* ------------------------------------------------------------------ */
/* Routes                                                              */
/* ------------------------------------------------------------------ */

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
      for (const m of ["eq", "lt", "gt"]) c[m] = (k: string, v: unknown) => { rec.filters.push([`${m}:${k}`, v]); return c }
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

const row = {
  id: "22222222-2222-4222-8222-222222222222", kind: "visite", title: "Visite", starts_at: "2026-10-21T06:00:00Z",
  ends_at: "2026-10-21T07:00:00Z", address: null, notes: null, status: "planned", client_id: null, chantier_id: null, client: { name: "M. Test" },
}
const MISSING = { code: "42P01", message: 'relation "public.appointments" does not exist' }
const req = (url: string, method = "GET", body?: unknown) =>
  new NextRequest(`https://qonforme.test${url}`, { method, ...(body ? { body: JSON.stringify(body), headers: { "Content-Type": "application/json" } } : {}) })
const ctx = (id: string) => ({ params: Promise.resolve({ id }) })

describe("/api/appointments", () => {
  beforeEach(() => { h.user = { id: "11111111-1111-4111-8111-111111111111" }; h.result = { data: [row], error: null }; h.calls = []; h.ownsClient = true })

  it("GET : refuse sans connexion et une période absurde", async () => {
    const { GET } = await import("@/app/api/appointments/route")
    h.user = null
    expect((await GET(req("/api/appointments"))).status).toBe(401)
    h.user = { id: "u" }
    expect((await GET(req("/api/appointments?from=2026-10-20T00:00:00Z&to=2026-10-19T00:00:00Z"))).status).toBe(400)
    expect((await GET(req("/api/appointments?from=2026-01-01T00:00:00Z&to=2026-12-31T00:00:00Z"))).status).toBe(400)
  })
  it("GET : lit les rendez-vous du compte avec le nom du client", async () => {
    const { GET } = await import("@/app/api/appointments/route")
    const res = await GET(req("/api/appointments?from=2026-10-18T22:00:00Z&to=2026-10-25T22:00:00Z"))
    const json = await res.json()
    expect(json.available).toBe(true)
    expect(json.appointments[0]).toMatchObject({ id: row.id, client_name: "M. Test", kind: "visite" })
    expect(h.calls[0].filters).toContainEqual(["eq:user_id", h.user!.id])
  })
  it("GET : sans la migration, répond « indisponible » au lieu d'une erreur", async () => {
    const { GET } = await import("@/app/api/appointments/route")
    h.result = { data: null, error: MISSING }
    const json = await (await GET(req("/api/appointments"))).json()
    expect(json).toMatchObject({ available: false, appointments: [] })
  })
  it("POST : crée avec les instants calculés côté serveur et le propriétaire du compte", async () => {
    const { POST } = await import("@/app/api/appointments/route")
    const res = await POST(req("/api/appointments", "POST", { title: "Visite", date: "2026-10-21", start: "08:00", duration_min: 60, user_id: "pirate" }))
    expect(res.status).toBe(201)
    const insert = h.calls.find((c) => c.op === "insert")!.payload as Record<string, unknown>
    expect(insert.user_id).toBe(h.user!.id)
    expect(insert.starts_at).toBe("2026-10-21T06:00:00.000Z")
    expect(insert.status).toBeUndefined()
  })
  it("POST : 400 sur une saisie invalide, 404 sur le client d'un autre, 503 sans migration", async () => {
    const { POST } = await import("@/app/api/appointments/route")
    expect((await POST(req("/api/appointments", "POST", { title: "", date: "2026-10-21", start: "08:00", duration_min: 60 }))).status).toBe(400)
    h.ownsClient = false
    const body = { title: "V", date: "2026-10-21", start: "08:00", duration_min: 60, client_id: "33333333-3333-4333-8333-333333333333" }
    expect((await POST(req("/api/appointments", "POST", body))).status).toBe(404)
    h.ownsClient = true
    h.result = { data: null, error: MISSING }
    expect((await POST(req("/api/appointments", "POST", body))).status).toBe(503)
  })
  it("PATCH : changement d'état seul, jamais d'un état inconnu ; identifiant invalide refusé", async () => {
    const { PATCH } = await import("@/app/api/appointments/[id]/route")
    expect((await PATCH(req("/x", "PATCH", { status: "done" }), ctx("pas-un-uuid"))).status).toBe(404)
    expect((await PATCH(req("/x", "PATCH", { status: "archivé" }), ctx(row.id))).status).toBe(400)
    const res = await PATCH(req("/x", "PATCH", { status: "done" }), ctx(row.id))
    expect(res.status).toBe(200)
    const update = h.calls.find((c) => c.op === "update")!
    expect(update.payload).toEqual({ status: "done" })
    expect(update.filters).toContainEqual(["eq:user_id", h.user!.id])
  })
  it("PATCH : rendez-vous d'un autre compte → 404", async () => {
    const { PATCH } = await import("@/app/api/appointments/[id]/route")
    h.result = { data: null, error: null }
    expect((await PATCH(req("/x", "PATCH", { status: "done" }), ctx(row.id))).status).toBe(404)
  })
  it("DELETE : limité au compte ; 404 si rien n'est supprimé", async () => {
    const { DELETE } = await import("@/app/api/appointments/[id]/route")
    h.result = { data: [{ id: row.id }], error: null }
    expect((await DELETE(req("/x", "DELETE"), ctx(row.id))).status).toBe(200)
    expect(h.calls.find((c) => c.op === "delete")!.filters).toContainEqual(["eq:user_id", h.user!.id])
    h.result = { data: [], error: null }
    expect((await DELETE(req("/x", "DELETE"), ctx(row.id))).status).toBe(404)
  })
})
