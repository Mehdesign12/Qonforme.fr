/**
 * Heures de Paris pour les rappels et la séquence d'emails (heure d'été comprise).
 *
 * Les serveurs tournent en UTC : « ce soir 19 h » vaut 17:00 UTC l'été et 18:00
 * UTC l'hiver. Paris n'a que deux décalages, +1 h (CET) et +2 h (CEST), ce qui
 * permet une conversion exacte sans bibliothèque :
 * - une heure qui n'existe pas (passage à l'heure d'été, 2 h 30 le dernier
 *   dimanche de mars) est repoussée d'une heure (3 h 30) ;
 * - une heure qui existe deux fois (retour à l'heure d'hiver, 2 h 30 le dernier
 *   dimanche d'octobre) donne la première des deux.
 *
 * Module pur : serveur, navigateur et tests.
 */
import { addDays } from "@/lib/utils/paris-date"

const PARTS = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Europe/Paris",
  year: "numeric", month: "2-digit", day: "2-digit",
  hour: "2-digit", minute: "2-digit", hourCycle: "h23",
  weekday: "short",
})

const WEEKDAYS: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 }

export interface ParisParts {
  /** Jour calendaire à Paris, AAAA-MM-JJ. */
  day: string
  hour: number
  minute: number
  /** 0 = dimanche … 6 = samedi. */
  weekday: number
}

/** Date, heure et jour de la semaine à Paris d'un instant. */
export function parisParts(date: Date): ParisParts {
  const p: Record<string, string> = {}
  for (const part of PARTS.formatToParts(date)) p[part.type] = part.value
  return {
    day: `${p.year}-${p.month}-${p.day}`,
    hour: Number(p.hour) % 24,
    minute: Number(p.minute),
    weekday: WEEKDAYS[p.weekday] ?? 0,
  }
}

/** Instant (UTC) de l'heure « murale » de Paris `hour:minute` le jour `day` (AAAA-MM-JJ). */
export function parisWallTime(day: string, hour: number, minute = 0): Date {
  const [y, m, d] = day.split("-").map(Number)
  const naive = Date.UTC(y, m - 1, d, hour, minute)
  // Heure d'été d'abord (+2 h), puis d'hiver (+1 h) : la première qui tombe juste
  for (const offsetMinutes of [120, 60]) {
    const candidate = new Date(naive - offsetMinutes * 60_000)
    const p = parisParts(candidate)
    if (p.day === day && p.hour === hour && p.minute === minute) return candidate
  }
  // Heure sautée au passage à l'heure d'été : une heure plus tard
  return new Date(naive - 60 * 60_000)
}

/** Jour de Paris décalé de `days` jours. */
export function parisDayPlus(date: Date, days: number): string {
  return addDays(parisParts(date).day, days)
}

/** « 19 h », « 7 h 30 ». */
export function frenchHour(hour: number, minute: number): string {
  return minute ? `${hour} h ${String(minute).padStart(2, "0")}` : `${hour} h`
}

const LONG_DAY = new Intl.DateTimeFormat("fr-FR", { timeZone: "Europe/Paris", weekday: "long", day: "numeric", month: "long" })

/** « samedi 10 octobre », « jeudi 1er octobre » (heure de Paris). */
export function frenchDay(date: Date): string {
  return LONG_DAY.format(date).replace(/(^|\s)1(\s)/, "$11er$2")
}
