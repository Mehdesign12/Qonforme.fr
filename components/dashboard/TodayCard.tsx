"use client"

/**
 * « Aujourd'hui » : les rendez-vous du jour (planning). Lit /api/appointments
 * dans l'application et les rendez-vous de la démo dans la démo. N'affiche rien
 * tant que le planning charge, ou s'il n'est pas activé : le tableau de bord ne
 * saute pas et ne montre jamais d'erreur pour une fonction annexe.
 */
import { useEffect, useState } from "react"
import Link from "next/link"
import { CalendarDays } from "lucide-react"
import { Panel } from "@/components/app/kit"
import { cn } from "@/lib/utils"
import { DEMO_APPOINTMENTS } from "@/lib/demo/planning"
import {
  APPOINTMENT_KIND_LABELS, appointmentsOnDay, parisParts, parisToIso, type Appointment,
} from "@/lib/planning/appointments"
import { addDays } from "@/lib/utils/paris-date"

const KIND_DOT: Record<Appointment["kind"], string> = {
  visite: "bg-[var(--q-accent)]",
  chantier: "bg-[var(--q-ink)]",
  livraison: "bg-[var(--q-text-4)]",
}

export function TodayCard({ mode, today }: { mode: "app" | "demo"; today: string }) {
  const [items, setItems] = useState<Appointment[] | null>(null)

  useEffect(() => {
    if (mode === "demo") { setItems(appointmentsOnDay(today, DEMO_APPOINTMENTS)); return }
    let live = true
    const from = parisToIso(today, "00:00")
    const to = parisToIso(addDays(today, 1), "00:00")
    fetch(`/api/appointments?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`)
      .then((r) => r.json())
      .then((j) => { if (live && j.available !== false && Array.isArray(j.appointments)) setItems(appointmentsOnDay(today, j.appointments)) })
      .catch(() => {})
    return () => { live = false }
  }, [mode, today])

  if (items === null) return null
  const href = mode === "demo" ? "/demo/planning" : "/planning"
  const list = items.filter((a) => a.status !== "cancelled")

  return (
    <Panel
      title="Aujourd'hui"
      aria-label="Rendez-vous du jour"
      action={<Link href={href} className="q-link text-sm">Voir le planning</Link>}
      bodyClassName="px-5 pb-4"
    >
      {list.length === 0 ? (
        <p className="flex items-center gap-2 py-2 text-sm text-[var(--q-text-4)]">
          <CalendarDays className="size-4" aria-hidden />
          Aucun rendez-vous aujourd&apos;hui.
        </p>
      ) : (
        <ul className="flex flex-col">
          {list.map((a) => (
            <li key={a.id} className="border-t border-[var(--q-line-soft)] first:border-t-0">
              <Link href={href} className="flex min-h-[52px] items-center gap-3 py-2">
                <span className="w-12 shrink-0 font-mono text-[13px] text-[var(--q-text-3)]">{parisParts(a.starts_at).time}</span>
                <span className={cn("size-2 shrink-0 rounded-full", KIND_DOT[a.kind])} aria-hidden />
                <span className="min-w-0 flex-1">
                  <span className={cn("block truncate text-[14.5px] font-semibold text-[var(--q-ink)]", a.status === "done" && "line-through opacity-70")}>{a.title}</span>
                  <span className="block truncate text-[12.5px] text-[var(--q-text-4)]">
                    {APPOINTMENT_KIND_LABELS[a.kind]}{a.client_name ? ` · ${a.client_name}` : ""}
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  )
}
