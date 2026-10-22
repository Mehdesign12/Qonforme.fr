'use client'

export const dynamic = "force-dynamic"

import { Suspense, useEffect, useMemo, useState } from "react"
import { useSearchParams } from "next/navigation"
import { PlanningView, type AppointmentFormValues, type PlanningApi, type PlanningClient } from "@/components/planning/PlanningView"
import { NotesPanel } from "@/components/planning/NotesPanel"
import { appNotesApi } from "@/lib/planning/notes-api"
import { weekRangeIso, type Appointment } from "@/lib/planning/appointments"
import { todayInParis } from "@/lib/utils/paris-date"

async function call<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init)
  const json = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(json.error ?? "Erreur réseau")
  return json as T
}

const json = (method: string, body: unknown): RequestInit => ({
  method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
})

/** Planning : semaine sur ordinateur, journée sur téléphone. Ouvert à tous les comptes. */
function PlanningPage() {
  const params = useSearchParams()
  const [today, setToday] = useState<string | null>(null)
  const [clients, setClients] = useState<PlanningClient[]>([])
  const [chantiers, setChantiers] = useState<{ id: string; name: string }[]>([])

  useEffect(() => {
    setToday(todayInParis())
    fetch("/api/clients").then((r) => r.json()).then((j) => {
      if (Array.isArray(j.clients)) setClients(j.clients.map((c: PlanningClient) => ({ id: c.id, name: c.name, address: c.address, zip_code: c.zip_code, city: c.city })))
    }).catch(() => {})
    // Chantiers : table facultative (formule Artisan), la liste reste vide sans elle
    fetch("/api/chantiers").then((r) => r.json()).then((j) => {
      if (j.available !== false && Array.isArray(j.chantiers)) setChantiers(j.chantiers.map((c: { id: string; name: string }) => ({ id: c.id, name: c.name })))
    }).catch(() => {})
  }, [])

  const api = useMemo<PlanningApi>(() => ({
    async load(start) {
      const { from, to } = weekRangeIso(start)
      const res = await call<{ available?: boolean; appointments?: Appointment[] }>(`/api/appointments?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`)
      return { available: res.available !== false, appointments: res.appointments ?? [] }
    },
    async save(id, values: AppointmentFormValues) {
      const res = await call<{ appointment: Appointment }>(id ? `/api/appointments/${id}` : "/api/appointments", json(id ? "PATCH" : "POST", values))
      return res.appointment
    },
    async setStatus(id, status) {
      const res = await call<{ appointment: Appointment }>(`/api/appointments/${id}`, json("PATCH", { status }))
      return res.appointment
    },
    async remove(id) { await call(`/api/appointments/${id}`, { method: "DELETE" }) },
  }), [])

  return <PlanningView mode="app" today={today} api={api} clients={clients} chantiers={chantiers} openNew={params.get("nouveau") === "1"}
    footer={<NotesPanel api={appNotesApi} scope={{}} focusComposer={params.get("note") === "1"} />} />
}

export default function Page() {
  return <Suspense fallback={null}><PlanningPage /></Suspense>
}
