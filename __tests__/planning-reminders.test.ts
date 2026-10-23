// @vitest-environment node
/** Rappels par email du planning : quand ils partent, jamais deux fois, jamais pour un rendez-vous passé. */
import { beforeEach, describe, expect, it, vi } from "vitest"
import { appointmentReminderDue, inLabel, runPlanningReminders } from "@/lib/planning/reminders"
import { parseNoteInput, remindAtOf } from "@/lib/planning/notes"
import { parseAppointmentInput } from "@/lib/planning/appointments"
import { buildAppointmentReminderEmail, buildTasksReminderEmail } from "@/lib/email/templates/planning-reminder"

const h = vi.hoisted(() => ({
  sent: [] as { to: string; subject: string; html: string }[],
  failSend: false,
  appts: [] as Record<string, unknown>[],
  notes: [] as Record<string, unknown>[],
  missing: { appointments: false, work_notes: false },
}))

vi.mock("@/lib/email/resend", () => ({
  sendEmail: async (o: { to: string; subject: string; html: string }) => {
    if (h.failSend) throw new Error("Resend error")
    h.sent.push(o)
    return { id: "e1" }
  },
}))

const MISSING = { code: "42P01", message: "relation does not exist" }

/** Base minimale : lit les lignes selon les filtres demandés, applique les mises à jour conditionnelles. */
function fakeAdmin() {
  const table = (name: "appointments" | "work_notes") => {
    const rows = () => (name === "appointments" ? h.appts : h.notes)
    return {
      select() {
        const filters: ((r: Record<string, unknown>) => boolean)[] = []
        const c: Record<string, unknown> = {}
        c.eq = (k: string, v: unknown) => { filters.push((r) => r[k] === v); return c }
        c.is = (k: string, v: unknown) => { filters.push((r) => (r[k] ?? null) === v); return c }
        c.not = (k: string) => { filters.push((r) => r[k] !== null && r[k] !== undefined); return c }
        c.gt = (k: string, v: string) => { filters.push((r) => String(r[k]) > v); return c }
        c.lte = (k: string, v: string) => { filters.push((r) => String(r[k]) <= v); return c }
        for (const m of ["order", "limit"]) c[m] = () => c
        c.then = (ok: (r: unknown) => unknown) =>
          Promise.resolve(h.missing[name] ? { data: null, error: MISSING } : { data: rows().filter((r) => filters.every((f) => f(r))), error: null }).then(ok)
        return c
      },
      update(values: Record<string, unknown>) {
        const filters: ((r: Record<string, unknown>) => boolean)[] = []
        const c: Record<string, unknown> = {}
        c.eq = (k: string, v: unknown) => { filters.push((r) => r[k] === v); return c }
        c.is = (k: string, v: unknown) => { filters.push((r) => (r[k] ?? null) === v); return c }
        c.in = (k: string, v: unknown[]) => { filters.push((r) => v.includes(r[k])); return c }
        const apply = () => {
          const hit = rows().filter((r) => filters.every((f) => f(r)))
          hit.forEach((r) => Object.assign(r, values))
          return hit.map((r) => ({ id: r.id }))
        }
        c.select = async () => ({ data: apply(), error: null })
        c.then = (ok: (r: unknown) => unknown) => Promise.resolve({ data: apply(), error: null }).then(ok)
        return c
      },
    }
  }
  return {
    from: (n: string) => table(n as "appointments" | "work_notes"),
    auth: { admin: { getUserById: async (id: string) => ({ data: { user: { email: `${id}@example.fr` } } }) } },
  } as never
}

const NOW = new Date("2026-10-21T08:00:00Z") // 10 h à Paris
const appt = (id: string, startsAt: string, minutes: number | null, over: Record<string, unknown> = {}) => ({
  id, user_id: "u1", kind: "visite", title: `Visite ${id}`, starts_at: startsAt, address: "8 rue des Tilleuls", reminder_minutes: minutes,
  reminder_sent_at: null, status: "planned", client: { name: "M. Test" }, ...over,
})
const task = (id: string, remindAt: string | null, over: Record<string, unknown> = {}) => ({
  id, user_id: "u1", kind: "task", body: `Tâche ${id}`, due_at: "2026-10-22T10:00:00Z", remind_at: remindAt, reminder_sent_at: null, done_at: null, client: null, ...over,
})

beforeEach(() => { h.sent = []; h.failSend = false; h.appts = []; h.notes = []; h.missing = { appointments: false, work_notes: false } })

describe("quand un rappel de rendez-vous est dû", () => {
  it("après l'heure d'envoi, avant le début", () => {
    expect(appointmentReminderDue("2026-10-21T09:00:00Z", 60, NOW)).toBe(true)  // envoi à 8 h UTC : maintenant
    expect(appointmentReminderDue("2026-10-21T08:30:00Z", 60, NOW)).toBe(true)  // envoi à 7 h 30 : passé
    expect(appointmentReminderDue("2026-10-21T10:00:00Z", 60, NOW)).toBe(false) // envoi à 9 h : pas encore
    expect(appointmentReminderDue("2026-10-21T07:00:00Z", 60, NOW)).toBe(false) // déjà commencé
  })
  it("libellés d'échéance", () => {
    expect(inLabel("2026-10-21T09:00:00Z", NOW)).toBe("dans 1 h")
    expect(inLabel("2026-10-21T08:30:00Z", NOW)).toBe("dans 30 min")
    expect(inLabel("2026-10-22T07:00:00Z", NOW)).toBe("demain")
  })
})

describe("rendez-vous", () => {
  it("envoie un seul email puis plus rien au passage suivant", async () => {
    h.appts = [appt("a", "2026-10-21T09:00:00Z", 60)]
    const first = await runPlanningReminders(fakeAdmin(), NOW)
    expect(first.appointments.sent).toBe(1)
    expect(h.sent).toHaveLength(1)
    expect(h.sent[0].to).toBe("u1@example.fr")
    expect(h.sent[0].subject).toContain("Visite a")
    expect(h.sent[0].html).toContain("Itinéraire")
    await runPlanningReminders(fakeAdmin(), new Date(NOW.getTime() + 15 * 60_000))
    expect(h.sent).toHaveLength(1)
  })
  it("ne rappelle ni un rendez-vous sans rappel, ni un annulé, ni un terminé, ni un trop lointain", async () => {
    h.appts = [
      appt("sans", "2026-10-21T09:00:00Z", null),
      appt("annule", "2026-10-21T09:00:00Z", 60, { status: "cancelled" }),
      appt("fait", "2026-10-21T09:00:00Z", 60, { status: "done" }),
      appt("loin", "2026-10-23T09:00:00Z", 60),
      appt("passe", "2026-10-21T07:00:00Z", 60),
    ]
    const r = await runPlanningReminders(fakeAdmin(), NOW)
    expect(r.appointments.sent).toBe(0)
    expect(h.sent).toHaveLength(0)
  })
  it("la veille : part 24 h avant", async () => {
    h.appts = [appt("v", "2026-10-22T07:00:00Z", 1440)]
    expect((await runPlanningReminders(fakeAdmin(), NOW)).appointments.sent).toBe(1)
    expect(h.sent[0].subject).toContain("demain")
  })
  it("un email qui échoue libère la réservation : le rappel repart au passage suivant", async () => {
    h.appts = [appt("a", "2026-10-21T09:00:00Z", 60)]
    h.failSend = true
    const r = await runPlanningReminders(fakeAdmin(), NOW)
    expect(r.appointments.errors).toHaveLength(1)
    expect(h.appts[0].reminder_sent_at).toBeNull()
    h.failSend = false
    expect((await runPlanningReminders(fakeAdmin(), NOW)).appointments.sent).toBe(1)
  })
  it("sans la migration : ignoré sans erreur", async () => {
    h.missing.appointments = true
    const r = await runPlanningReminders(fakeAdmin(), NOW)
    expect(r.appointments).toMatchObject({ available: false, sent: 0, errors: [] })
  })
})

describe("tâches", () => {
  it("un seul email par compte avec toutes les tâches dues, jamais une tâche cochée", async () => {
    h.notes = [
      task("a", "2026-10-21T06:00:00Z"), task("b", "2026-10-21T07:00:00Z"),
      task("faite", "2026-10-21T06:00:00Z", { done_at: "2026-10-21T07:00:00Z" }),
      task("futur", "2026-10-22T06:00:00Z"), task("sans", null),
    ]
    const r = await runPlanningReminders(fakeAdmin(), NOW)
    expect(r.tasks.sent).toBe(2)
    expect(h.sent).toHaveLength(1)
    expect(h.sent[0].subject).toBe("Rappel : 2 tâches à faire")
    expect(h.sent[0].html).toContain("Tâche a")
    expect(h.sent[0].html).not.toContain("Tâche faite")
    expect((await runPlanningReminders(fakeAdmin(), NOW)).tasks.sent).toBe(0)
  })
  it("un rappel resté plus de 24 h en attente n'est pas envoyé, seulement marqué", async () => {
    h.notes = [task("vieux", "2026-10-19T06:00:00Z")]
    const r = await runPlanningReminders(fakeAdmin(), NOW)
    expect(r.tasks).toMatchObject({ sent: 0, skipped: 1 })
    expect(h.sent).toHaveLength(0)
    expect(h.notes[0].reminder_sent_at).not.toBeNull()
  })
  it("échec d'envoi : les tâches sont rendues, rien n'est perdu", async () => {
    h.notes = [task("a", "2026-10-21T06:00:00Z")]
    h.failSend = true
    await runPlanningReminders(fakeAdmin(), NOW)
    expect(h.notes[0].reminder_sent_at).toBeNull()
  })
  it("sans la migration : ignoré sans erreur", async () => {
    h.missing.work_notes = true
    expect((await runPlanningReminders(fakeAdmin(), NOW)).tasks).toMatchObject({ available: false, errors: [] })
  })
})

describe("saisie des rappels", () => {
  it("tâche : matin à 8 h ou veille à 18 h, heure de Paris", () => {
    expect(remindAtOf("2026-10-23", "morning")).toBe("2026-10-23T06:00:00.000Z")
    expect(remindAtOf("2026-10-23", "eve")).toBe("2026-10-22T16:00:00.000Z")
  })
  it("exige une tâche avec échéance et une heure à venir", () => {
    const now = new Date("2026-10-21T08:00:00Z")
    expect(parseNoteInput({ kind: "task", body: "x", due_date: "2026-10-23", remind: "morning" }, now).ok).toBe(true)
    expect(parseNoteInput({ kind: "task", body: "x", remind: "morning" }, now).ok).toBe(false)
    expect(parseNoteInput({ kind: "note", body: "x", remind: "morning" }, now).ok).toBe(false)
    expect(parseNoteInput({ kind: "task", body: "x", due_date: "2026-10-21", remind: "morning" }, now).ok).toBe(false) // 8 h Paris déjà passé
    expect(parseNoteInput({ kind: "task", body: "x", due_date: "2026-10-23", remind: "soir" }, now).ok).toBe(false)
  })
  it("rendez-vous : seuls 1 h avant et la veille sont acceptés", () => {
    const base = { title: "V", date: "2026-10-21", start: "08:00", duration_min: 60 }
    for (const ok of [null, undefined, 60, 1440]) expect(parseAppointmentInput({ ...base, reminder_minutes: ok }).ok).toBe(true)
    for (const bad of [5, 90, -60, "abc"]) expect(parseAppointmentInput({ ...base, reminder_minutes: bad }).ok).toBe(false)
  })
})

describe("emails", () => {
  it("échappent le texte saisi", () => {
    const { html } = buildTasksReminderEmail({ planningUrl: "https://qonforme.fr/planning", tasks: [{ body: "<script>alert(1)</script>", dueLabel: null, clientName: "A & B" }] })
    expect(html).not.toContain("<script>alert")
    expect(html).toContain("&lt;script&gt;")
    expect(html).toContain("A &amp; B")
    const a = buildAppointmentReminderEmail({ title: "<b>x</b>", kindLabel: "Visite", whenLabel: "jeudi", inLabel: "demain", clientName: null, address: null, mapsUrl: null, planningUrl: "https://qonforme.fr/planning" })
    expect(a.html).not.toContain("<b>x</b>")
  })
})
