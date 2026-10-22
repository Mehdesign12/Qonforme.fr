'use client'

export const dynamic = "force-dynamic"

import { Suspense, useMemo, useRef } from "react"
import { useSearchParams } from "next/navigation"
import { PlanningView, type AppointmentFormValues, type PlanningApi } from "@/components/planning/PlanningView"
import { DEMO_CLIENTS, DEMO_SUB_CHANTIER_ID, DEMO_TODAY } from "@/lib/demo/data"
import { DEMO_APPOINTMENTS } from "@/lib/demo/planning"
import { appointmentsOnDay, parseAppointmentInput, weekDays, type Appointment } from "@/lib/planning/appointments"

/** Miroir de /planning : mêmes composants, rendez-vous fictifs gardés en mémoire (rien n'est enregistré). */
function DemoPlanningPage() {
  const params = useSearchParams()
  const store = useRef<Appointment[]>([...DEMO_APPOINTMENTS])
  const seq = useRef(100)

  const api = useMemo<PlanningApi>(() => ({
    async load(start) {
      const days = weekDays(start)
      const list = store.current.filter((a) => days.some((d) => appointmentsOnDay(d, [a]).length > 0))
      return { available: true, appointments: list }
    },
    async save(id, values: AppointmentFormValues) {
      const parsed = parseAppointmentInput({ ...values })
      if (!parsed.ok) throw new Error(parsed.error)
      const client = DEMO_CLIENTS.find((c) => c.id === parsed.value.client_id)
      const existing = id ? store.current.find((a) => a.id === id) : undefined
      const next: Appointment = {
        id: id ?? `demo-rdv-${++seq.current}`, ...parsed.value, status: existing?.status ?? "planned",
        notes: existing?.notes ?? null, client_name: client?.name ?? null,
      }
      store.current = [...store.current.filter((a) => a.id !== next.id), next]
      return next
    },
    async setStatus(id, status) {
      const found = store.current.find((a) => a.id === id)
      if (!found) throw new Error("Rendez-vous introuvable")
      const next = { ...found, status }
      store.current = store.current.map((a) => (a.id === id ? next : a))
      return next
    },
    async remove(id) { store.current = store.current.filter((a) => a.id !== id) },
  }), [])

  return (
    <PlanningView
      mode="demo"
      today={DEMO_TODAY}
      api={api}
      clients={DEMO_CLIENTS.map((c) => ({ id: c.id, name: c.name, address: c.address, zip_code: c.zip_code, city: c.city }))}
      chantiers={[{ id: DEMO_SUB_CHANTIER_ID, name: "Résidence Le Clos Fleuri" }]}
      openNew={params.get("nouveau") === "1"}
    />
  )
}

export default function Page() {
  return <Suspense fallback={null}><DemoPlanningPage /></Suspense>
}
