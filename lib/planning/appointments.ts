/**
 * Planning : rendez-vous de l'artisan (visite, chantier, livraison).
 *
 * Module pur, sans réseau : validation des entrées (utilisée par les routes),
 * conversion heure de Paris ↔ instant UTC, calculs de semaine et mise en page de
 * la grille. Les horaires sont saisis et affichés à l'heure de Paris (comme les
 * relances et le tableau de bord) ; la base stocke un instant (timestamptz).
 */
import { addDays, isIsoDay, todayInParis } from "@/lib/utils/paris-date"

export const APPOINTMENT_KINDS = ["visite", "chantier", "livraison"] as const
export type AppointmentKind = (typeof APPOINTMENT_KINDS)[number]

export const APPOINTMENT_KIND_LABELS: Record<AppointmentKind, string> = {
  visite: "Visite",
  chantier: "Chantier",
  livraison: "Livraison",
}

export const APPOINTMENT_STATUSES = ["planned", "done", "cancelled"] as const
export type AppointmentStatus = (typeof APPOINTMENT_STATUSES)[number]

/** Rendez-vous tel que la page le reçoit (jointure client à plat). */
export interface Appointment {
  id: string
  kind: AppointmentKind
  title: string
  starts_at: string
  ends_at: string
  address: string | null
  notes: string | null
  status: AppointmentStatus
  client_id: string | null
  client_name: string | null
  chantier_id: string | null
  /** Rappel par email avant le rendez-vous, en minutes (null : aucun). */
  reminder_minutes: number | null
}

/** Colonnes lues en base (le chantier n'est pas joint : sa table est facultative). */
export const APPOINTMENT_COLUMNS =
  "id, kind, title, starts_at, ends_at, address, notes, status, client_id, chantier_id, reminder_minutes, client:clients(name)"

type Join = { name?: string | null } | { name?: string | null }[] | null

export function appointmentFromRow(row: Record<string, unknown>): Appointment {
  const join = row.client as Join
  const client = Array.isArray(join) ? join[0] ?? null : join
  return {
    id: String(row.id),
    kind: (APPOINTMENT_KINDS as readonly string[]).includes(String(row.kind)) ? (row.kind as AppointmentKind) : "visite",
    title: String(row.title ?? ""),
    starts_at: String(row.starts_at),
    ends_at: String(row.ends_at),
    address: (row.address as string | null) ?? null,
    notes: (row.notes as string | null) ?? null,
    status: (APPOINTMENT_STATUSES as readonly string[]).includes(String(row.status)) ? (row.status as AppointmentStatus) : "planned",
    client_id: (row.client_id as string | null) ?? null,
    client_name: client?.name ?? null,
    chantier_id: (row.chantier_id as string | null) ?? null,
    reminder_minutes: typeof row.reminder_minutes === "number" ? row.reminder_minutes : null,
  }
}

/* ------------------------------------------------------------------ */
/* Heure de Paris                                                      */
/* ------------------------------------------------------------------ */

const PARIS = "Europe/Paris"

const partsFormat = new Intl.DateTimeFormat("en-GB", {
  timeZone: PARIS, hourCycle: "h23",
  year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit",
})

/** Date (AAAA-MM-JJ) et heure (HH:MM) à Paris d'un instant. */
export function parisParts(iso: string): { date: string; time: string; minutes: number } {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return { date: iso.slice(0, 10), time: "00:00", minutes: 0 }
  const get: Record<string, string> = {}
  for (const p of partsFormat.formatToParts(d)) get[p.type] = p.value
  const hour = get.hour === "24" ? "00" : get.hour
  return {
    date: `${get.year}-${get.month}-${get.day}`,
    time: `${hour}:${get.minute}`,
    minutes: Number(hour) * 60 + Number(get.minute),
  }
}

/** Instant (ISO UTC) d'une date et d'une heure saisies à Paris, heure d'été comprise. */
export function parisToIso(date: string, time: string): string {
  const [y, m, d] = date.split("-").map(Number)
  const [h, mi] = time.split(":").map(Number)
  const wall = Date.UTC(y, m - 1, d, h, mi)
  // Décalage de Paris à cet instant : on l'estime puis on le corrige une fois (changement d'heure)
  let guess = wall
  for (let i = 0; i < 2; i++) {
    const p = parisParts(new Date(guess).toISOString())
    const [py, pm, pd] = p.date.split("-").map(Number)
    const seen = Date.UTC(py, pm - 1, pd, Math.floor(p.minutes / 60), p.minutes % 60)
    guess += wall - seen
  }
  return new Date(guess).toISOString()
}

/** Lundi de la semaine qui contient `day` (AAAA-MM-JJ). */
export function weekStart(day: string): string {
  const [y, m, d] = day.split("-").map(Number)
  const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay() // 0 = dimanche
  return addDays(day, -((dow + 6) % 7))
}

export function weekDays(start: string): string[] {
  return Array.from({ length: 7 }, (_, i) => addDays(start, i))
}

const WEEKDAYS = ["Dimanche", "Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi"]
const MONTHS = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"]

export function dayParts(day: string): { weekday: string; short: string; num: number; month: string; year: number } {
  const [y, m, d] = day.split("-").map(Number)
  const weekday = WEEKDAYS[new Date(Date.UTC(y, m - 1, d)).getUTCDay()]
  return { weekday, short: weekday.slice(0, 3), num: d, month: MONTHS[m - 1], year: y }
}

/** « Mercredi 21 octobre » */
export function dayLabel(day: string): string {
  const p = dayParts(day)
  return `${p.weekday} ${p.num} ${p.month}`
}

/** « 19 – 25 octobre 2026 » ou « 28 sept. – 4 oct. 2026 » */
export function weekLabel(start: string): string {
  const a = dayParts(start)
  const b = dayParts(addDays(start, 6))
  if (a.month === b.month) return `${a.num} – ${b.num} ${b.month} ${b.year}`
  const short = (m: string) => (m.length > 4 ? `${m.slice(0, m === "juillet" ? 4 : 3)}.` : m)
  return `${a.num} ${short(a.month)} – ${b.num} ${short(b.month)} ${b.year}`
}

/** « 08:00 » → « 8 h » ; « 13:30 » → « 13 h 30 » */
export function timeLabel(time: string): string {
  const [h, m] = time.split(":")
  return m === "00" ? `${Number(h)} h` : `${Number(h)} h ${m}`
}

export function durationLabel(minutes: number): string {
  if (minutes < 60) return `${minutes} min`
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return m === 0 ? `${h} h` : `${h} h ${String(m).padStart(2, "0")}`
}

/** Rappels proposés : une heure avant, ou la veille (24 h avant). Seuls ces délais sont acceptés. */
export const REMINDER_CHOICES = [60, 1440] as const
export const REMINDER_LABELS: Record<number, string> = { 60: "1 h avant", 1440: "La veille" }

/** Durées proposées dans la fenêtre. */
export const DURATION_CHOICES = [30, 60, 90, 120, 180, 240, 360, 480]

/** Durée en minutes entre deux instants. */
export function minutesBetween(startIso: string, endIso: string): number {
  return Math.max(0, Math.round((new Date(endIso).getTime() - new Date(startIso).getTime()) / 60_000))
}

/* ------------------------------------------------------------------ */
/* Validation                                                          */
/* ------------------------------------------------------------------ */

export interface AppointmentInput {
  kind: AppointmentKind
  title: string
  client_id: string | null
  chantier_id: string | null
  starts_at: string
  ends_at: string
  address: string | null
  notes: string | null
  reminder_minutes: number | null
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/

function text(value: unknown, max: number): string | null | "invalid" {
  if (value === undefined || value === null) return null
  if (typeof value !== "string") return "invalid"
  const t = value.trim()
  if (t.length === 0) return null
  return t.length > max ? "invalid" : t
}

function id(value: unknown): string | null | "invalid" {
  if (value === undefined || value === null || value === "") return null
  return typeof value === "string" && UUID.test(value) ? value : "invalid"
}

/**
 * Valide un rendez-vous. Le corps porte `date` (AAAA-MM-JJ), `start` (HH:MM) et
 * `duration_min` (15 à 1 440) en heure de Paris : le serveur seul en tire les
 * instants stockés. Un rendez-vous ne passe jamais de minuit à minuit au-delà d'un jour.
 */
export function parseAppointmentInput(
  body: Record<string, unknown>,
): { ok: true; value: AppointmentInput } | { ok: false; error: string } {
  const kind = body.kind ?? "visite"
  if (typeof kind !== "string" || !(APPOINTMENT_KINDS as readonly string[]).includes(kind)) {
    return { ok: false, error: "Type de rendez-vous inconnu." }
  }
  const title = typeof body.title === "string" ? body.title.trim() : ""
  if (title.length === 0) return { ok: false, error: "Donnez un intitulé au rendez-vous." }
  if (title.length > 200) return { ok: false, error: "L'intitulé est trop long (200 caractères au plus)." }

  if (!isIsoDay(body.date)) return { ok: false, error: "Date invalide." }
  if (typeof body.start !== "string" || !TIME.test(body.start)) return { ok: false, error: "Heure de début invalide." }
  const duration = Number(body.duration_min)
  if (!Number.isInteger(duration) || duration < 15 || duration > 1440) {
    return { ok: false, error: "Durée invalide (de 15 minutes à 24 heures)." }
  }

  const clientId = id(body.client_id)
  const chantierId = id(body.chantier_id)
  if (clientId === "invalid") return { ok: false, error: "Client invalide." }
  if (chantierId === "invalid") return { ok: false, error: "Chantier invalide." }
  const address = text(body.address, 300)
  const notes = text(body.notes, 2000)
  if (address === "invalid") return { ok: false, error: "L'adresse est trop longue (300 caractères au plus)." }
  if (notes === "invalid") return { ok: false, error: "Les notes sont trop longues (2 000 caractères au plus)." }

  let reminder: number | null = null
  if (body.reminder_minutes !== undefined && body.reminder_minutes !== null && body.reminder_minutes !== "") {
    const r = Number(body.reminder_minutes)
    if (!(REMINDER_CHOICES as readonly number[]).includes(r)) return { ok: false, error: "Rappel invalide." }
    reminder = r
  }

  const starts_at = parisToIso(body.date, body.start)
  const ends_at = new Date(new Date(starts_at).getTime() + duration * 60_000).toISOString()
  return {
    ok: true,
    value: { kind: kind as AppointmentKind, title, client_id: clientId, chantier_id: chantierId, starts_at, ends_at, address, notes, reminder_minutes: reminder },
  }
}

/** Corps d'un PATCH qui ne change que l'état (fait, annulé, replanifié). */
export function parseStatus(value: unknown): AppointmentStatus | null {
  return typeof value === "string" && (APPOINTMENT_STATUSES as readonly string[]).includes(value)
    ? (value as AppointmentStatus)
    : null
}

/* ------------------------------------------------------------------ */
/* Grille de la semaine                                                */
/* ------------------------------------------------------------------ */

export const GRID_START_HOUR = 7
export const GRID_END_HOUR = 19
export const HOUR_PX = 56

export interface Placed {
  appointment: Appointment
  day: string
  top: number
  height: number
  /** Colonne et nombre de colonnes quand plusieurs rendez-vous se chevauchent. */
  column: number
  columns: number
}

/** Positionne les rendez-vous d'une journée dans la grille (chevauchements côte à côte). */
export function placeDay(day: string, list: Appointment[]): Placed[] {
  const items = list
    .filter((a) => a.status !== "cancelled")
    .map((a) => {
      const s = parisParts(a.starts_at)
      const e = parisParts(a.ends_at)
      const startMin = s.date === day ? s.minutes : 0
      const endMin = e.date === day ? e.minutes : 24 * 60
      return { a, startMin, endMin: Math.max(endMin, startMin + 20), onDay: s.date === day || (s.date < day && e.date >= day) }
    })
    .filter((x) => x.onDay)
    .sort((x, y) => x.startMin - y.startMin || x.endMin - y.endMin)

  const placed: Placed[] = []
  let group: typeof items = []
  let groupEnd = -1
  const flush = () => {
    if (group.length === 0) return
    const colEnds: number[] = []
    const cols = group.map((g) => {
      let c = colEnds.findIndex((end) => end <= g.startMin)
      if (c === -1) { c = colEnds.length; colEnds.push(g.endMin) } else colEnds[c] = g.endMin
      return c
    })
    group.forEach((g, i) => {
      const top = ((Math.max(g.startMin, GRID_START_HOUR * 60) - GRID_START_HOUR * 60) / 60) * HOUR_PX
      const bottom = ((Math.min(g.endMin, GRID_END_HOUR * 60) - GRID_START_HOUR * 60) / 60) * HOUR_PX
      placed.push({ appointment: g.a, day, top, height: Math.max(bottom - top, 22), column: cols[i], columns: colEnds.length })
    })
    group = []
  }
  for (const it of items) {
    if (group.length > 0 && it.startMin >= groupEnd) { flush(); groupEnd = -1 }
    group.push(it)
    groupEnd = Math.max(groupEnd, it.endMin)
  }
  flush()
  // Hors de la plage affichée (avant 7 h, après 19 h) : le rendez-vous reste listé en dessous de la grille
  return placed.filter((p) => p.height > 0 && p.top < (GRID_END_HOUR - GRID_START_HOUR) * HOUR_PX)
}

/** Rendez-vous d'un jour (heure de Paris), triés par heure, annulés en dernier. */
export function appointmentsOnDay(day: string, list: Appointment[]): Appointment[] {
  return list
    .filter((a) => {
      const s = parisParts(a.starts_at).date
      const e = parisParts(a.ends_at).date
      return s <= day && e >= day
    })
    .sort((x, y) => {
      if ((x.status === "cancelled") !== (y.status === "cancelled")) return x.status === "cancelled" ? 1 : -1
      return x.starts_at.localeCompare(y.starts_at)
    })
}

/** Fenêtre de lecture d'une semaine : instants UTC de lundi 0 h à lundi suivant 0 h (Paris). */
export function weekRangeIso(start: string): { from: string; to: string } {
  return { from: parisToIso(start, "00:00"), to: parisToIso(addDays(start, 7), "00:00") }
}

export { todayInParis }
