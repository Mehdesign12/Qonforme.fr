"use client"

/**
 * Planning : semaine sur ordinateur, journée sur téléphone. Vue partagée par
 * /planning et /demo/planning (règle « Mode démo » de CLAUDE.md) : la page
 * réelle la branche sur l'API, la démo sur des données en mémoire.
 *
 * Les horaires sont ceux de Paris (lib/planning/appointments.ts). Aucun
 * traceur, aucun flou, aucune propriété will-change : sûr sur iOS.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { CalendarDays, CalendarPlus, Check, ChevronLeft, ChevronRight, Loader2, MapPin, Trash2 } from "lucide-react"
import { toast } from "sonner"
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog"
import { EmptyState, PageHeader, Panel } from "@/components/app/kit"
import { cn } from "@/lib/utils"
import { addDays } from "@/lib/utils/paris-date"
import {
  APPOINTMENT_KINDS, APPOINTMENT_KIND_LABELS, DURATION_CHOICES, GRID_END_HOUR, GRID_START_HOUR, HOUR_PX,
  appointmentsOnDay, dayLabel, dayParts, durationLabel, minutesBetween, parisParts, placeDay, timeLabel, weekDays, weekLabel, weekStart,
  type Appointment, type AppointmentKind,
} from "@/lib/planning/appointments"

export interface AppointmentFormValues {
  kind: AppointmentKind
  title: string
  client_id: string | null
  chantier_id: string | null
  date: string
  start: string
  duration_min: number
  address: string | null
}

export interface PlanningApi {
  load(weekStartDay: string): Promise<{ available: boolean; appointments: Appointment[] }>
  save(id: string | null, values: AppointmentFormValues): Promise<Appointment>
  setStatus(id: string, status: "planned" | "done"): Promise<Appointment>
  remove(id: string): Promise<void>
}

export interface PlanningClient { id: string; name: string; address?: string | null; zip_code?: string | null; city?: string | null }

const KIND_STYLE: Record<AppointmentKind, string> = {
  visite: "border-[var(--q-accent)] bg-[var(--q-wash)] text-[var(--q-accent-strong)]",
  chantier: "border-[var(--q-ink)] bg-[var(--q-ink)] text-[var(--q-surface)]",
  livraison: "border-[var(--q-line)] bg-[var(--q-surface-2)] text-[var(--q-ink)]",
}

const hours = Array.from({ length: GRID_END_HOUR - GRID_START_HOUR }, (_, i) => GRID_START_HOUR + i)

function mapsHref(address: string): string {
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(address)}`
}

function emptyValues(date: string, start = "09:00"): AppointmentFormValues {
  return { kind: "visite", title: "", client_id: null, chantier_id: null, date, start, duration_min: 60, address: null }
}

function toValues(a: Appointment): AppointmentFormValues {
  const s = parisParts(a.starts_at)
  return {
    kind: a.kind, title: a.title, client_id: a.client_id, chantier_id: a.chantier_id,
    date: s.date, start: s.time, duration_min: minutesBetween(a.starts_at, a.ends_at) || 60, address: a.address,
  }
}

export function PlanningView({
  mode, today, api, clients, chantiers = [], openNew = false,
}: {
  mode: "app" | "demo"
  today: string | null
  api: PlanningApi
  clients: PlanningClient[]
  chantiers?: { id: string; name: string }[]
  /** Ouvre la fenêtre de création à l'arrivée (menu « Nouveau », ?nouveau=1). */
  openNew?: boolean
}) {
  const [week, setWeek] = useState<string | null>(today ? weekStart(today) : null)
  const [selected, setSelected] = useState<string | null>(today)
  const [items, setItems] = useState<Appointment[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [unavailable, setUnavailable] = useState(false)
  const [dialog, setDialog] = useState<{ editing: Appointment | null; values: AppointmentFormValues } | null>(null)
  const openedNew = useRef(false)

  // La date du jour n'est connue qu'après le montage (serveur et navigateur peuvent ne pas être le même jour)
  useEffect(() => {
    if (today && week === null) { setWeek(weekStart(today)); setSelected(today) }
  }, [today, week])

  const load = useCallback(async (start: string) => {
    setLoading(true)
    setError(null)
    try {
      const res = await api.load(start)
      setUnavailable(!res.available)
      setItems(res.appointments)
    } catch {
      setError("Vérifiez votre connexion, puis réessayez.")
    } finally {
      setLoading(false)
    }
  }, [api])

  useEffect(() => { if (week) void load(week) }, [week, load])

  const openCreate = useCallback((date?: string, start?: string) => {
    if (!today) return
    setDialog({ editing: null, values: emptyValues(date ?? selected ?? today, start) })
  }, [selected, today])

  useEffect(() => {
    if (openNew && today && !openedNew.current && !loading && !unavailable) {
      openedNew.current = true
      openCreate()
    }
  }, [openNew, today, loading, unavailable, openCreate])

  const days = useMemo(() => (week ? weekDays(week) : []), [week])
  const goTo = (day: string) => { setWeek(weekStart(day)); setSelected(day) }

  const onSaved = (a: Appointment, creating: boolean) => {
    setItems((prev) => {
      const without = prev.filter((x) => x.id !== a.id)
      const day = parisParts(a.starts_at).date
      // Un rendez-vous déplacé hors de la semaine affichée disparaît de la liste
      const inWeek = week !== null && day >= week && day <= addDays(week, 6)
      return inWeek ? [...without, a].sort((x, y) => x.starts_at.localeCompare(y.starts_at)) : without
    })
    toast.success(creating ? "Rendez-vous ajouté." : "Rendez-vous enregistré.")
  }

  if (!today || !week) return <PlanningSkeleton />

  const label = weekLabel(week)
  const thisWeek = weekStart(today)

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Planning"
        eyebrow={dayLabel(today)}
        actions={
          <button type="button" onClick={() => openCreate()} disabled={unavailable} className="q-btn q-btn-primary h-11">
            <CalendarPlus aria-hidden />
            Rendez-vous
          </button>
        }
      />

      <div className="flex items-center gap-2">
        <div className="flex shrink-0 items-center gap-1">
          <button type="button" onClick={() => goTo(addDays(week, -7))} aria-label="Semaine précédente" className="q-btn q-btn-secondary size-10 !p-0 sm:size-11">
            <ChevronLeft aria-hidden />
          </button>
          <button type="button" onClick={() => goTo(addDays(week, 7))} aria-label="Semaine suivante" className="q-btn q-btn-secondary size-10 !p-0 sm:size-11">
            <ChevronRight aria-hidden />
          </button>
        </div>
        <h2 className="q-h2 min-w-0 flex-1 truncate px-1 !text-[15px] sm:!text-[length:inherit]" aria-live="polite">{label.replace(/ \d{4}$/, "")}<span className="max-sm:hidden">{label.slice(-5)}</span></h2>
        <button type="button" onClick={() => goTo(today)} disabled={week === thisWeek && selected === today} className="q-btn q-btn-secondary h-10 shrink-0 !px-3 sm:h-11 sm:!px-4">
          Aujourd&apos;hui
        </button>
      </div>

      {error ? (
        <Panel><EmptyState icon={<CalendarDays />} title="Le planning n'a pas pu être chargé." text={error}
          action={<button type="button" onClick={() => void load(week)} className="q-btn q-btn-secondary">Réessayer</button>} /></Panel>
      ) : unavailable ? (
        <Panel><EmptyState icon={<CalendarDays />} title="Le planning n'est pas encore activé."
          text="Il sera disponible dès que la mise à jour de la base sera appliquée." /></Panel>
      ) : (
        <>
          {/* Journée : téléphone et tablette */}
          <div className="flex flex-col gap-4 lg:hidden">
            <div className="grid grid-cols-7 gap-1" role="tablist" aria-label="Jours de la semaine">
              {days.map((d) => {
                const p = dayParts(d)
                const isToday = d === today
                const isSel = d === selected
                const has = items.some((a) => a.status !== "cancelled" && appointmentsOnDay(d, [a]).length > 0)
                return (
                  <button key={d} type="button" role="tab" aria-selected={isSel} aria-label={dayLabel(d)} onClick={() => setSelected(d)}
                    className="flex min-h-[64px] flex-col items-center justify-center gap-1 rounded-xl py-1.5">
                    <span className="text-[11px] font-semibold uppercase tracking-wide text-[var(--q-text-4)]">{p.short.slice(0, 1)}</span>
                    <span className={cn(
                      "grid size-9 place-items-center rounded-full text-base font-semibold tabular-nums",
                      isToday && isSel && "bg-[var(--q-accent)] text-white",
                      isToday && !isSel && "text-[var(--q-accent-strong)]",
                      !isToday && isSel && "bg-[var(--q-ink)] text-[var(--q-surface)]",
                    )}>{p.num}</span>
                    <span className={cn("size-1.5 rounded-full", has ? "bg-[var(--q-text-4)]" : "bg-transparent")} aria-hidden />
                  </button>
                )
              })}
            </div>
            <DayList
              day={selected ?? today} items={items} loading={loading}
              onOpen={(a) => setDialog({ editing: a, values: toValues(a) })}
              onNew={() => openCreate(selected ?? today)}
            />
          </div>

          {/* Semaine : ordinateur */}
          <div className="hidden lg:block">
            <WeekGrid
              days={days} today={today} items={items} loading={loading}
              onOpen={(a) => setDialog({ editing: a, values: toValues(a) })}
              onNew={(date, start) => openCreate(date, start)}
            />
          </div>
        </>
      )}

      {dialog && (
        <AppointmentDialog
          key={dialog.editing?.id ?? "new"}
          initial={dialog.values}
          editing={dialog.editing}
          clients={clients}
          chantiers={chantiers}
          mode={mode}
          api={api}
          onClose={() => setDialog(null)}
          onSaved={(a, creating) => { onSaved(a, creating); setDialog(null) }}
          onChanged={(a) => setItems((prev) => prev.map((x) => (x.id === a.id ? a : x)))}
          onRemoved={(id) => { setItems((prev) => prev.filter((x) => x.id !== id)); setDialog(null); toast.success("Rendez-vous supprimé.") }}
        />
      )}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Journée                                                             */
/* ------------------------------------------------------------------ */

function DayList({
  day, items, loading, onOpen, onNew,
}: { day: string; items: Appointment[]; loading: boolean; onOpen: (a: Appointment) => void; onNew: () => void }) {
  const list = appointmentsOnDay(day, items)
  return (
    <section aria-label={dayLabel(day)} className="flex flex-col gap-3">
      <h3 className="px-0.5 text-[15px] font-semibold text-[var(--q-ink)]">{dayLabel(day)}</h3>
      {loading && list.length === 0 ? (
        <div className="q-card h-24 animate-pulse" aria-hidden />
      ) : list.length === 0 ? (
        <Panel>
          <EmptyState icon={<CalendarDays />} title="Rien de prévu ce jour-là."
            action={<button type="button" onClick={onNew} className="q-btn q-btn-secondary"><CalendarPlus aria-hidden />Ajouter un rendez-vous</button>} />
        </Panel>
      ) : (
        <ul className="flex flex-col gap-2.5">
          {list.map((a) => {
            const s = parisParts(a.starts_at)
            const startTime = s.date === day ? s.time : "00:00"
            const cancelled = a.status === "cancelled"
            return (
              <li key={a.id} className="flex gap-3">
                <span className="w-12 shrink-0 pt-3 font-mono text-[13px] text-[var(--q-text-3)]">{startTime}</span>
                <div className={cn("min-w-0 flex-1 rounded-2xl border", KIND_STYLE[a.kind], cancelled && "opacity-50")}>
                  <button type="button" onClick={() => onOpen(a)} className="block min-h-[56px] w-full px-3.5 py-3 text-left">
                    <span className={cn("block text-[15px] font-bold leading-snug", a.status === "done" && "line-through opacity-80")}>{a.title}</span>
                    <span className="mt-0.5 block text-[13px] opacity-90">
                      {APPOINTMENT_KIND_LABELS[a.kind]} · {durationLabel(minutesBetween(a.starts_at, a.ends_at))}
                      {a.client_name ? ` · ${a.client_name}` : ""}
                    </span>
                  </button>
                  {a.address && (
                    <div className="flex gap-2 px-3.5 pb-3">
                      <a href={mapsHref(a.address)} target="_blank" rel="noopener noreferrer"
                        className="inline-flex h-11 items-center gap-1.5 rounded-xl bg-[var(--q-surface)] px-3.5 text-[13.5px] font-semibold text-[var(--q-ink)]">
                        <MapPin className="size-4" aria-hidden />Itinéraire
                      </a>
                    </div>
                  )}
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}

/* ------------------------------------------------------------------ */
/* Semaine                                                             */
/* ------------------------------------------------------------------ */

function WeekGrid({
  days, today, items, loading, onOpen, onNew,
}: {
  days: string[]; today: string; items: Appointment[]; loading: boolean
  onOpen: (a: Appointment) => void; onNew: (date: string, start: string) => void
}) {
  const gridHeight = hours.length * HOUR_PX
  const placed = days.map((d) => placeDay(d, items))
  const outside = items.filter((a) => a.status !== "cancelled" && !placed.some((col) => col.some((p) => p.appointment.id === a.id)))

  return (
    <div className="q-card overflow-hidden">
      <div className="grid grid-cols-[56px_repeat(7,minmax(0,1fr))] border-b border-[var(--q-line)]">
        <div />
        {days.map((d) => {
          const p = dayParts(d)
          const isToday = d === today
          return (
            <div key={d} className="flex flex-col items-center gap-0.5 border-l border-[var(--q-line-soft)] py-2.5">
              <span className="text-[11.5px] font-semibold uppercase tracking-wide text-[var(--q-text-4)]">{p.short}</span>
              <span className={cn("grid size-8 place-items-center rounded-full text-[15px] font-semibold tabular-nums",
                isToday ? "bg-[var(--q-accent)] text-white" : "text-[var(--q-ink)]")}>{p.num}</span>
            </div>
          )
        })}
      </div>
      <div className={cn("relative grid grid-cols-[56px_repeat(7,minmax(0,1fr))]", loading && "opacity-60")} style={{ height: gridHeight }}>
        <div className="relative">
          {hours.map((h, i) => (
            <span key={h} className="absolute right-2 -translate-y-1/2 font-mono text-[11.5px] text-[var(--q-text-4)]" style={{ top: i * HOUR_PX, display: i === 0 ? "none" : undefined }}>
              {String(h).padStart(2, "0")}:00
            </span>
          ))}
        </div>
        {days.map((d, col) => (
          <div
            key={d}
            className={cn("relative border-l border-[var(--q-line-soft)]", d === today && "bg-[var(--q-wash)]/40")}
            onClick={(e) => {
              if (e.target !== e.currentTarget) return
              const y = e.clientY - e.currentTarget.getBoundingClientRect().top
              const minutes = Math.round(((y / HOUR_PX) * 60) / 30) * 30 + GRID_START_HOUR * 60
              const clamped = Math.min(Math.max(minutes, GRID_START_HOUR * 60), (GRID_END_HOUR - 1) * 60)
              onNew(d, `${String(Math.floor(clamped / 60)).padStart(2, "0")}:${String(clamped % 60).padStart(2, "0")}`)
            }}
          >
            {hours.map((h, i) => (
              <div key={h} className="pointer-events-none absolute inset-x-0 border-t border-[var(--q-line-soft)]" style={{ top: i * HOUR_PX }} />
            ))}
            {placed[col].map((p) => {
              const a = p.appointment
              const width = 100 / p.columns
              return (
                <button
                  key={a.id}
                  type="button"
                  onClick={() => onOpen(a)}
                  className={cn("absolute overflow-hidden rounded-lg border px-2 py-1 text-left text-[12.5px] leading-tight", KIND_STYLE[a.kind], a.status === "done" && "opacity-70")}
                  style={{ top: p.top + 1, height: p.height - 2, left: `calc(${p.column * width}% + 2px)`, width: `calc(${width}% - 4px)` }}
                >
                  <span className={cn("block font-bold", p.height >= 76 ? "line-clamp-3" : p.height >= 52 ? "line-clamp-2" : "truncate", a.status === "done" && "line-through")}>{a.title}</span>
                  {p.height >= 52 && <span className="block truncate opacity-90">{timeLabel(parisParts(a.starts_at).time)}{a.client_name ? ` · ${a.client_name}` : ""}</span>}
                </button>
              )
            })}
          </div>
        ))}
      </div>
      {outside.length > 0 && (
        <div className="border-t border-[var(--q-line)] px-4 py-3 text-sm text-[var(--q-text-3)]">
          <span className="font-semibold text-[var(--q-ink)]">Hors de la plage {GRID_START_HOUR} h – {GRID_END_HOUR} h : </span>
          {outside.map((a, i) => (
            <button key={a.id} type="button" onClick={() => onOpen(a)} className="q-link">
              {i > 0 ? ", " : ""}{dayParts(parisParts(a.starts_at).date).short} {timeLabel(parisParts(a.starts_at).time)} {a.title}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Fenêtre d'un rendez-vous                                            */
/* ------------------------------------------------------------------ */

function AppointmentDialog({
  initial, editing, clients, chantiers, mode, api, onClose, onSaved, onChanged, onRemoved,
}: {
  initial: AppointmentFormValues
  editing: Appointment | null
  clients: PlanningClient[]
  chantiers: { id: string; name: string }[]
  mode: "app" | "demo"
  api: PlanningApi
  onClose: () => void
  onSaved: (a: Appointment, creating: boolean) => void
  onChanged: (a: Appointment) => void
  onRemoved: (id: string) => void
}) {
  const [v, setV] = useState<AppointmentFormValues>(initial)
  const [busy, setBusy] = useState<null | "save" | "status" | "remove">(null)
  const [confirmRemove, setConfirmRemove] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const set = <K extends keyof AppointmentFormValues>(k: K, value: AppointmentFormValues[K]) => setV((p) => ({ ...p, [k]: value }))
  const canSave = v.title.trim().length > 0 && v.date.length === 10 && /^\d{2}:\d{2}$/.test(v.start)
  const durations = DURATION_CHOICES.includes(v.duration_min) ? DURATION_CHOICES : [...DURATION_CHOICES, v.duration_min].sort((a, b) => a - b)

  const pickClient = (id: string) => {
    const c = clients.find((x) => x.id === id)
    setV((p) => {
      const fill = !p.address && c?.address ? [c.address, [c.zip_code, c.city].filter(Boolean).join(" ")].filter(Boolean).join(", ") : p.address
      return { ...p, client_id: id || null, address: fill || null }
    })
  }

  const run = async (kind: "save" | "status" | "remove", fn: () => Promise<void>) => {
    setBusy(kind)
    setError(null)
    try { await fn() } catch (e) { setError(e instanceof Error ? e.message : "Une erreur est survenue. Réessayez.") } finally { setBusy(null) }
  }

  return (
    <Dialog open onOpenChange={(o) => { if (!o && !busy) onClose() }}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] gap-0 overflow-y-auto p-0 sm:max-w-[520px]">
        <div className="flex flex-col gap-1 px-[22px] pr-14 pt-5">
          <DialogTitle className="q-display text-[22px] leading-tight text-[var(--q-ink)]">{editing ? "Rendez-vous" : "Nouveau rendez-vous"}</DialogTitle>
          <DialogDescription className="text-sm text-[var(--q-text-4)]">
            {mode === "demo" ? "Exemple : rien n'est enregistré au-delà de cette page." : "Heure de Paris."}
          </DialogDescription>
        </div>
        <form
          className="flex flex-col gap-4 px-[22px] pb-5 pt-4"
          onSubmit={(e) => {
            e.preventDefault()
            if (!canSave || busy) return
            void run("save", async () => { onSaved(await api.save(editing?.id ?? null, { ...v, title: v.title.trim() }), !editing) })
          }}
        >
          <div className="q-seg w-full" role="group" aria-label="Type de rendez-vous">
            {APPOINTMENT_KINDS.map((k) => (
              <button key={k} type="button" aria-pressed={v.kind === k} onClick={() => set("kind", k)} className="!h-11 flex-1">{APPOINTMENT_KIND_LABELS[k]}</button>
            ))}
          </div>
          <label className="flex flex-col gap-1.5">
            <span className="q-label">Intitulé</span>
            <input className="q-input" value={v.title} maxLength={200} required autoFocus={!editing} onChange={(e) => set("title", e.target.value)} placeholder="Visite : tableau électrique" />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="q-label">Client</span>
            <select className="q-input" value={v.client_id ?? ""} onChange={(e) => pickClient(e.target.value)}>
              <option value="">Aucun</option>
              {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </label>
          {chantiers.length > 0 && (
            <label className="flex flex-col gap-1.5">
              <span className="q-label">Chantier <span className="font-normal text-[var(--q-text-4)]">(facultatif)</span></span>
              <select className="q-input" value={v.chantier_id ?? ""} onChange={(e) => set("chantier_id", e.target.value || null)}>
                <option value="">Aucun chantier</option>
                {chantiers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </label>
          )}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-[1.3fr_1fr_1fr]">
            <label className="col-span-2 flex flex-col gap-1.5 sm:col-span-1">
              <span className="q-label">Date</span>
              <input type="date" className="q-input" value={v.date} required onChange={(e) => set("date", e.target.value)} />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="q-label">Début</span>
              <input type="time" className="q-input" value={v.start} required step={300} onChange={(e) => set("start", e.target.value)} />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="q-label">Durée</span>
              <select className="q-input" value={v.duration_min} onChange={(e) => set("duration_min", Number(e.target.value))}>
                {durations.map((m) => <option key={m} value={m}>{durationLabel(m)}</option>)}
              </select>
            </label>
          </div>
          <label className="flex flex-col gap-1.5">
            <span className="q-label">Adresse</span>
            <input className="q-input" value={v.address ?? ""} maxLength={300} onChange={(e) => set("address", e.target.value || null)} placeholder="8 rue des Tilleuls, Lyon" />
          </label>
          {v.address && (
            <a href={mapsHref(v.address)} target="_blank" rel="noopener noreferrer" className="q-link -mt-2 inline-flex min-h-11 items-center gap-1.5 self-start text-sm">
              <MapPin className="size-4" aria-hidden />Voir l&apos;itinéraire
            </a>
          )}
          {error && <p role="alert" className="q-field-error">{error}</p>}
          <div className="flex flex-wrap items-center gap-2 pt-1">
            {editing && (
              <>
                <button type="button" disabled={busy !== null} className="q-btn q-btn-secondary h-11"
                  onClick={() => void run("status", async () => { onChanged(await api.setStatus(editing.id, editing.status === "done" ? "planned" : "done")); onClose() })}>
                  {busy === "status" ? <Loader2 className="animate-spin" aria-hidden /> : <Check aria-hidden />}
                  {editing.status === "done" ? "Remettre à faire" : "Terminé"}
                </button>
                {confirmRemove ? (
                  <button type="button" disabled={busy !== null} className="q-btn q-btn-danger h-11"
                    onClick={() => void run("remove", async () => { await api.remove(editing.id); onRemoved(editing.id) })}>
                    {busy === "remove" ? <Loader2 className="animate-spin" aria-hidden /> : <Trash2 aria-hidden />}
                    Confirmer la suppression
                  </button>
                ) : (
                  <button type="button" disabled={busy !== null} className="q-btn q-btn-secondary h-11" onClick={() => setConfirmRemove(true)}>
                    <Trash2 aria-hidden />Supprimer
                  </button>
                )}
              </>
            )}
            <button type="submit" disabled={!canSave || busy !== null} className="q-btn q-btn-primary ml-auto h-11 min-w-[130px]">
              {busy === "save" && <Loader2 className="animate-spin" aria-hidden />}
              Enregistrer
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function PlanningSkeleton() {
  return (
    <div className="flex flex-col gap-5" aria-busy="true">
      <div className="h-10 w-48 animate-pulse rounded-lg bg-[var(--q-sunken)]" />
      <div className="q-card h-[420px] animate-pulse" />
    </div>
  )
}
