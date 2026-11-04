/**
 * Fiche d'un chantier : « Prochains rendez-vous » (lot 5 du 04/11/2026) et
 * « Planifier » qui ouvre le planning sur un rendez-vous déjà rattaché.
 */
import { readFileSync } from "node:fs"
import { join } from "node:path"
import * as React from "react"
import { beforeAll, describe, expect, it } from "vitest"
import { chantierDefaults } from "@/lib/planning/chantier-defaults"
import { parisToIso, type Appointment } from "@/lib/planning/appointments"

let demo: { appointments: Appointment[]; chantier: string; today: string }
let upcomingAppointments: typeof import("@/components/planning/ChantierAppointments").upcomingAppointments
const CHANTIER_APPOINTMENTS_SHOWN = 5
beforeAll(async () => {
  ;(globalThis as { React?: typeof React }).React = React
  const panel = await import("@/components/planning/ChantierAppointments")
  upcomingAppointments = panel.upcomingAppointments
  expect(panel.CHANTIER_APPOINTMENTS_SHOWN).toBe(CHANTIER_APPOINTMENTS_SHOWN)
  const [{ DEMO_APPOINTMENTS }, { DEMO_SUB_CHANTIER_ID, DEMO_TODAY }] = await Promise.all([import("@/lib/demo/planning"), import("@/lib/demo/data")])
  demo = { appointments: DEMO_APPOINTMENTS, chantier: DEMO_SUB_CHANTIER_ID, today: DEMO_TODAY }
})

const lire = (rel: string) => readFileSync(join(process.cwd(), rel), "utf8")

const appt = (id: string, day: string, start: string, status: Appointment["status"] = "planned"): Appointment => {
  const starts_at = parisToIso(day, start)
  return {
    id, kind: "chantier", title: id, starts_at, ends_at: new Date(Date.parse(starts_at) + 3_600_000).toISOString(),
    address: null, notes: null, status, client_id: null, client_name: null, chantier_id: "c", reminder_minutes: null,
  }
}

describe("upcomingAppointments", () => {
  it("garde le jour même et la suite, dans l'ordre, sans les annulés", () => {
    const list = [
      appt("demain", "2026-11-05", "08:00"),
      appt("hier", "2026-11-03", "08:00"),
      appt("annule", "2026-11-06", "08:00", "cancelled"),
      appt("ce-matin", "2026-11-04", "07:00", "done"),
      appt("cet-apres-midi", "2026-11-04", "14:00"),
    ]
    expect(upcomingAppointments(list, "2026-11-04").map((a) => a.id)).toEqual(["ce-matin", "cet-apres-midi", "demain"])
  })
  it(`montre ${CHANTIER_APPOINTMENTS_SHOWN} rendez-vous au plus`, () => {
    const list = Array.from({ length: 9 }, (_, i) => appt(`r${i}`, `2026-11-1${i}`, "09:00"))
    expect(upcomingAppointments(list, "2026-11-01")).toHaveLength(CHANTIER_APPOINTMENTS_SHOWN)
  })
  it("la démo a des rendez-vous à venir sur son chantier en sous-traitance", () => {
    const mine = demo.appointments.filter((a) => a.chantier_id === demo.chantier)
    expect(upcomingAppointments(mine, demo.today).length).toBeGreaterThan(0)
  })
})

describe("chantierDefaults", () => {
  const chantiers = [{ id: "c1", name: "Maison Lambert", client_id: "cl", address: "3 rue du Port", zip_code: "49400", city: "Saumur" }]
  it("rattache le rendez-vous au chantier, à son client et à son adresse", () => {
    expect(chantierDefaults(chantiers, "c1")).toEqual({
      kind: "chantier", chantier_id: "c1", client_id: "cl", title: "Chantier Maison Lambert", address: "3 rue du Port, 49400 Saumur",
    })
  })
  it("rien pour un chantier absent ou inconnu", () => {
    expect(chantierDefaults(chantiers, null)).toBeUndefined()
    expect(chantierDefaults(chantiers, "x")).toBeUndefined()
  })
})

describe("branchement", () => {
  it("fiche réelle et fiche de la démo passent le même panneau", () => {
    for (const page of ["app/(app)/chantiers/[id]/page.tsx", "app/demo/chantiers/[id]/page.tsx"]) {
      const src = lire(page)
      expect(src).toContain("<ChantierAppointments")
      expect(src).toContain("nouveau=1&chantier=")
    }
    expect(lire("components/artisan/ChantierDetailView.tsx")).toContain("{appointments}")
  })
  it("le planning réel attend les chantiers avant d'ouvrir la création pré-remplie", () => {
    const src = lire("app/(app)/planning/page.tsx")
    expect(src).toContain('params.get("chantier")')
    expect(src).toContain("(!chantierParam || chantiersLoaded)")
    expect(lire("app/demo/planning/page.tsx")).toContain('chantierDefaults(CHANTIERS, params.get("chantier"))')
  })
})
