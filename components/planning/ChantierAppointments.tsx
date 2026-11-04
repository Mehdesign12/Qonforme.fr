"use client"

/**
 * « Prochains rendez-vous » de la fiche d'un chantier : les rendez-vous du
 * planning rattachés à ce chantier (visite, chantier, livraison), du jour même
 * aux semaines suivantes, avec un bouton « Planifier » qui ouvre le planning sur
 * la fenêtre de création, le chantier déjà choisi.
 *
 * La page donne `load` (route réelle ou données de la démo : règle « Mode
 * démo » de CLAUDE.md). Comme le panneau des notes, il reste invisible tant que
 * la table du planning n'existe pas : une fonction annexe ne montre jamais
 * d'erreur à la place de la page qui l'accueille.
 */
import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { CalendarDays, CalendarPlus, MapPin } from "lucide-react"
import { Panel } from "@/components/app/kit"
import { cn } from "@/lib/utils"
import {
  APPOINTMENT_KIND_LABELS, dayLabel, parisParts, timeLabel, type Appointment, type AppointmentKind,
} from "@/lib/planning/appointments"

/** Mêmes couleurs que le planning : visite bleue, chantier vert, livraison ambre. */
const KIND_DOT: Record<AppointmentKind, string> = {
  visite: "bg-[var(--q-accent)]",
  chantier: "bg-[var(--q-ok)]",
  livraison: "bg-[var(--q-warn)]",
}

const upperFirst = (t: string) => t.charAt(0).toUpperCase() + t.slice(1)

/** Nombre de rendez-vous montrés : le reste est dans le planning. */
export const CHANTIER_APPOINTMENTS_SHOWN = 5

/** Rendez-vous à venir (à partir du jour `today`, heure de Paris), annulés exclus, dans l'ordre. */
export function upcomingAppointments(list: Appointment[], today: string, limit = CHANTIER_APPOINTMENTS_SHOWN): Appointment[] {
  return list
    .filter((a) => a.status !== "cancelled" && parisParts(a.ends_at).date >= today)
    .sort((x, y) => x.starts_at.localeCompare(y.starts_at))
    .slice(0, limit)
}

export interface ChantierAppointmentsProps {
  today: string | null
  load: () => Promise<{ available: boolean; appointments: Appointment[] }>
  /** Le planning (lien « Tout voir »). */
  planningHref: string
  /** Le planning ouvert sur la création d'un rendez-vous pour ce chantier. */
  newHref: string
}

export function ChantierAppointments({ today, load, planningHref, newHref }: ChantierAppointmentsProps) {
  const [items, setItems] = useState<Appointment[] | null>(null)
  const [available, setAvailable] = useState(true)
  const [error, setError] = useState(false)

  const refresh = useCallback(async () => {
    setError(false)
    try {
      const res = await load()
      setAvailable(res.available)
      setItems(res.appointments)
    } catch {
      setError(true)
    }
  }, [load])

  useEffect(() => { void refresh() }, [refresh])

  if (!available) return null

  const upcoming = items && today ? upcomingAppointments(items, today) : null
  const action = (
    <Link href={newHref} className="q-btn q-btn-secondary q-btn-sm inline-flex items-center gap-1.5">
      <CalendarPlus className="size-4" aria-hidden />
      Planifier
    </Link>
  )

  return (
    <Panel title="Prochains rendez-vous" action={action} aria-label="Prochains rendez-vous du chantier" bodyClassName="flex flex-col px-5 pb-5 pt-1 text-sm">
      {error ? (
        <div className="flex flex-col items-start gap-2 py-2">
          <p className="text-[var(--q-text-3)]">Les rendez-vous n&apos;ont pas pu être chargés.</p>
          <button type="button" className="q-link text-[13.5px] font-semibold" onClick={() => void refresh()}>Réessayer</button>
        </div>
      ) : upcoming === null ? (
        <div className="flex flex-col gap-2 py-1" aria-hidden>
          {[0, 1].map((i) => <div key={i} className="h-12 animate-pulse rounded-xl bg-[var(--q-sunken)]" />)}
        </div>
      ) : upcoming.length === 0 ? (
        <div className="flex flex-col items-start gap-1 py-2">
          <p className="font-medium text-[var(--q-ink)]">Aucun rendez-vous prévu</p>
          <p className="text-[var(--q-text-3)]">Planifiez une visite, une journée de chantier ou une livraison : elle apparaîtra ici et dans le planning.</p>
        </div>
      ) : (
        <ul className="flex flex-col divide-y divide-[var(--q-line-soft)]">
          {upcoming.map((a) => {
            const start = parisParts(a.starts_at)
            return (
              <li key={a.id} className="flex items-start gap-3 py-3 first:pt-1">
                <span className={cn("mt-[7px] size-2 shrink-0 rounded-full", KIND_DOT[a.kind])} aria-hidden />
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] font-semibold text-[var(--q-text-3)]">
                    {start.date === today ? "Aujourd'hui" : upperFirst(dayLabel(start.date))}
                    {" · "}
                    {timeLabel(start.time)}
                    {" · "}
                    {APPOINTMENT_KIND_LABELS[a.kind]}
                  </p>
                  <p className="mt-0.5 truncate font-medium text-[var(--q-ink)]">{a.title}</p>
                  {a.address && (
                    <p className="mt-0.5 flex items-center gap-1 truncate text-[13px] text-[var(--q-text-4)]">
                      <MapPin className="size-3.5 shrink-0" aria-hidden />
                      <span className="truncate">{a.address}</span>
                    </p>
                  )}
                </div>
              </li>
            )
          })}
        </ul>
      )}
      <Link href={planningHref} className="mt-3 inline-flex items-center gap-1.5 self-start text-[13.5px] font-semibold text-[var(--q-accent-strong)] hover:underline">
        <CalendarDays className="size-4" aria-hidden />
        Tout voir dans le planning
      </Link>
    </Panel>
  )
}
