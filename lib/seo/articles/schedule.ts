/**
 * Dates du module Articles, toujours à l'heure de Paris : créneaux du rythme de
 * publication (Préférences › Rythme), mois du calendrier, jour et heure d'un
 * horodatage. Les serveurs tournent en UTC et l'heure d'été change le décalage
 * (le 25 octobre 2026, 3 h devient 2 h) : chaque conversion passe par Intl.
 *
 * Module pur, sans réseau : serveur, navigateur et tests.
 */
import { addDays, todayInParis } from "@/lib/utils/paris-date"

const PARIS = "Europe/Paris"

const PARTS = new Intl.DateTimeFormat("en-GB", {
  timeZone: PARIS,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
})

/** Décalage de Paris sur UTC (ms) à un instant donné : +1 h en hiver, +2 h en été. */
function parisOffsetMs(instant: number): number {
  const p = Object.fromEntries(PARTS.formatToParts(new Date(instant)).map((x) => [x.type, x.value]))
  const asUtc = Date.UTC(Number(p.year), Number(p.month) - 1, Number(p.day), Number(p.hour), Number(p.minute), Number(p.second))
  return asUtc - Math.floor(instant / 1000) * 1000
}

/**
 * Instant UTC d'une heure de Paris (« 2026-10-26 », « 08:00 »). Une heure qui
 * n'existe pas (passage à l'heure d'été) glisse d'une heure ; une heure en double
 * (passage à l'heure d'hiver) prend la première.
 */
export function parisInstant(day: string, time: string): Date {
  const [y, m, d] = day.split("-").map(Number)
  const [hh, mm] = time.split(":").map(Number)
  const naive = Date.UTC(y, m - 1, d, hh || 0, mm || 0)
  let guess = naive - parisOffsetMs(naive)
  guess = naive - parisOffsetMs(guess)
  return new Date(guess)
}

/** Jour (AAAA-MM-JJ) et heure (HH:MM) de Paris d'un instant. */
export function parisDayTime(value: string | Date): { day: string; time: string } {
  const date = typeof value === "string" ? new Date(value) : value
  const p = Object.fromEntries(PARTS.formatToParts(date).map((x) => [x.type, x.value]))
  return { day: `${p.year}-${p.month}-${p.day}`, time: `${p.hour}:${p.minute}` }
}

/** Jour de la semaine d'une date AAAA-MM-JJ : 1 = lundi … 7 = dimanche. */
export function weekdayOf(day: string): number {
  const [y, m, d] = day.split("-").map(Number)
  const js = new Date(Date.UTC(y, m - 1, d)).getUTCDay()
  return js === 0 ? 7 : js
}

/**
 * Jours du rythme : `perWeek` jours répartis dans la semaine à partir de
 * `weekday` (2 par semaine depuis le lundi : lundi et jeudi ; 3 : lundi,
 * mercredi, vendredi). 0 article par semaine : aucun créneau automatique.
 */
export function rhythmWeekdays(perWeek: number, weekday: number): number[] {
  if (perWeek <= 0) return []
  const n = Math.min(7, Math.max(1, Math.floor(perWeek)))
  const days = new Set<number>()
  for (let i = 0; i < n; i++) days.add(((weekday - 1 + Math.floor((i * 7) / n)) % 7) + 1)
  return Array.from(days).sort((a, b) => a - b)
}

export interface Slot {
  /** Jour de Paris (AAAA-MM-JJ). */
  day: string
  /** Heure de Paris (HH:MM). */
  time: string
  /** Instant UTC (ISO). */
  at: string
}

/**
 * Prochains créneaux libres du rythme, après `now` + `minLeadMinutes`. Un jour
 * déjà occupé (sujet planifié ou article programmé ce jour-là, heure de Paris)
 * n'est pas proposé.
 */
export function nextSlots(input: {
  now: Date
  perWeek: number
  weekday: number
  time: string
  /** Jours de Paris déjà occupés. */
  takenDays?: Iterable<string>
  count: number
  minLeadMinutes?: number
  /** Limite de recherche (jours). */
  horizonDays?: number
}): Slot[] {
  if (input.perWeek <= 0) return []
  const taken = new Set(Array.from(input.takenDays ?? []))
  const days = new Set(rhythmWeekdays(input.perWeek, input.weekday))
  const earliest = input.now.getTime() + (input.minLeadMinutes ?? 60) * 60_000
  const out: Slot[] = []
  let day = todayInParis(input.now)
  const horizon = input.horizonDays ?? 400
  for (let i = 0; i <= horizon && out.length < input.count; i++, day = addDays(day, 1)) {
    if (!days.has(weekdayOf(day)) || taken.has(day)) continue
    const at = parisInstant(day, input.time)
    if (at.getTime() < earliest) continue
    out.push({ day, time: input.time, at: at.toISOString() })
    taken.add(day)
  }
  return out
}

/* ------------------------------------------------------------------ */
/* Mois du calendrier                                                  */
/* ------------------------------------------------------------------ */

const MONTHS = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"]
const MONTHS_SHORT = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."]
const WEEKDAYS_SHORT = ["Lun.", "Mar.", "Mer.", "Jeu.", "Ven.", "Sam.", "Dim."]
export const WEEKDAY_LABELS = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi", "Dimanche"]
const NBSP = " "

/** « 2026-10 » valide, sinon null. */
export function parseMonth(value: string | null | undefined): string | null {
  if (!value || !/^\d{4}-(0[1-9]|1[0-2])$/.test(value)) return null
  const year = Number(value.slice(0, 4))
  return year >= 2020 && year <= 2100 ? value : null
}

export function currentMonth(now: Date): string {
  return todayInParis(now).slice(0, 7)
}

export function shiftMonth(month: string, delta: number): string {
  const [y, m] = month.split("-").map(Number)
  const index = y * 12 + (m - 1) + delta
  return `${Math.floor(index / 12)}-${String((index % 12) + 1).padStart(2, "0")}`
}

/** « Octobre 2026 ». */
export function monthLabel(month: string): string {
  const [y, m] = month.split("-").map(Number)
  const name = MONTHS[m - 1]
  return `${name.charAt(0).toUpperCase()}${name.slice(1)} ${y}`
}

/** « 7 oct. », « 1er oct. », avec l'année si demandé. */
export function shortDay(day: string, withYear = false): string {
  const [y, m, d] = day.split("-").map(Number)
  return `${d === 1 ? "1er" : d}${NBSP}${MONTHS_SHORT[m - 1]}${withYear ? `${NBSP}${y}` : ""}`
}

/** « Mer. 7 oct. ». */
export function weekdayDay(day: string): string {
  return `${WEEKDAYS_SHORT[weekdayOf(day) - 1]}${NBSP}${shortDay(day)}`
}

/** « Semaine du 28 sept. au 4 oct. », « Semaine du 5 au 11 oct. ». */
export function weekLabel(monday: string): string {
  const sunday = addDays(monday, 6)
  const sameMonth = monday.slice(0, 7) === sunday.slice(0, 7)
  const start = sameMonth ? (Number(monday.slice(8)) === 1 ? "1er" : String(Number(monday.slice(8)))) : shortDay(monday)
  return `Semaine du ${start} au ${shortDay(sunday)}`
}

/** Semaines (lundi → dimanche) qui couvrent le mois : 4 à 6 lignes de 7 jours. */
export function monthGrid(month: string): string[][] {
  const first = `${month}-01`
  const start = addDays(first, -(weekdayOf(first) - 1))
  const [y, m] = month.split("-").map(Number)
  const lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate()
  const last = `${month}-${String(lastDay).padStart(2, "0")}`
  const end = addDays(last, 7 - weekdayOf(last))
  const weeks: string[][] = []
  for (let monday = start; monday <= end; monday = addDays(monday, 7)) {
    weeks.push(Array.from({ length: 7 }, (_, i) => addDays(monday, i)))
  }
  return weeks
}

/** Bornes UTC d'une suite de jours de Paris : [début du premier jour, début du lendemain du dernier). */
export function dayRangeUtc(firstDay: string, lastDay: string): { from: string; to: string } {
  return { from: parisInstant(firstDay, "00:00").toISOString(), to: parisInstant(addDays(lastDay, 1), "00:00").toISOString() }
}
