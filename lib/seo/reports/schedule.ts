/**
 * Échéance du résumé hebdomadaire (Paramètres › Rapports) : jour et heure de
 * Paris, une semaine ISO = un résumé au plus (seo_digests.period_key
 * « 2026-W41 », clé unique : anti-doublon).
 *
 * Module pur (Intl seulement) : utilisé par la tâche planifiée, la page
 * serveur, l'affichage « Prochain envoi » dans le navigateur et les tests.
 */
import { addDays, todayInParis } from "@/lib/utils/paris-date"
import { fmtDay, NBSP } from "@/lib/seo/format"

/** Réglages qui fixent l'échéance (sous-ensemble de reports). */
export interface DigestSchedule {
  weeklyDigest: boolean
  /** 1 = lundi … 7 = dimanche. */
  weekday: number
  /** « 08:00 », heure de Paris. */
  time: string
}

/** Index 1 à 7 (0 inutilisé). */
export const WEEKDAY_NAMES = ["", "Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi", "Dimanche"] as const

/** Heures proposées dans le menu (une heure enregistrée hors liste y est ajoutée). */
export const DIGEST_TIMES = ["06:00", "07:00", "08:00", "09:00", "10:00", "11:00", "12:00", "14:00", "16:00", "18:00"]

const PARIS_TIME = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Europe/Paris",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
})

/** Minutes écoulées depuis minuit, heure de Paris. */
export function parisMinutes(now: Date): number {
  const parts = Object.fromEntries(PARIS_TIME.formatToParts(now).map((p) => [p.type, p.value]))
  return Number(parts.hour) * 60 + Number(parts.minute)
}

/** « 08:00 » → 480. */
export function hhmmToMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number)
  return (h || 0) * 60 + (m || 0)
}

/** Jour de la semaine d'une date AAAA-MM-JJ : 1 = lundi … 7 = dimanche. */
export function weekdayOf(day: string): number {
  const [y, m, d] = day.slice(0, 10).split("-").map(Number)
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay() || 7
}

/**
 * Semaine ISO 8601 d'une date AAAA-MM-JJ : « 2026-W41 ». La semaine commence
 * le lundi ; la semaine 1 est celle du premier jeudi de l'année (le 31 décembre
 * 2026, un jeudi, est en « 2026-W53 » ; le 3 janvier 2021 en « 2020-W53 »).
 */
export function isoWeekKey(day: string): string {
  const [y, m, d] = day.slice(0, 10).split("-").map(Number)
  const date = new Date(Date.UTC(y, m - 1, d))
  const dow = date.getUTCDay() || 7
  // Jeudi de la même semaine : il fixe l'année de la semaine
  date.setUTCDate(date.getUTCDate() + 4 - dow)
  const isoYear = date.getUTCFullYear()
  const week = Math.ceil(((date.getTime() - Date.UTC(isoYear, 0, 1)) / 86_400_000 + 1) / 7)
  return `${isoYear}-W${String(week).padStart(2, "0")}`
}

/** Clé de la semaine en cours à Paris. */
export function currentWeekKey(now: Date): string {
  return isoWeekKey(todayInParis(now))
}

/**
 * Vrai le jour choisi, à partir de l'heure choisie (Paris), si le résumé est
 * activé. La tâche vérifie ensuite qu'aucun résumé n'existe pour la semaine.
 */
export function isDigestDue(schedule: DigestSchedule, now: Date): boolean {
  if (!schedule.weeklyDigest) return false
  const today = todayInParis(now)
  return weekdayOf(today) === schedule.weekday && parisMinutes(now) >= hhmmToMinutes(schedule.time)
}

export interface NextDigestSend {
  /** Jour de Paris (AAAA-MM-JJ). */
  day: string
  time: string
  /** Échéance passée sans envoi cette semaine : part au prochain passage de la tâche (15 min au plus). */
  pendingNow: boolean
}

/**
 * Prochain envoi : le prochain jour choisi à l'heure choisie, en sautant la
 * semaine en cours si son résumé existe déjà. null si le résumé est éteint.
 */
export function nextDigestSend(schedule: DigestSchedule, now: Date, currentWeekDone: boolean): NextDigestSend | null {
  if (!schedule.weeklyDigest) return null
  const today = todayInParis(now)
  const minutes = parisMinutes(now)
  const at = hhmmToMinutes(schedule.time)
  const thisWeek = isoWeekKey(today)
  for (let offset = 0; offset <= 14; offset++) {
    const day = addDays(today, offset)
    if (weekdayOf(day) !== schedule.weekday) continue
    if (currentWeekDone && isoWeekKey(day) === thisWeek) continue
    if (offset === 0 && minutes >= at) return { day, time: schedule.time, pendingNow: true }
    return { day, time: schedule.time, pendingNow: false }
  }
  return null
}

/** « Lundi 12 oct. 2026 à 08:00 (Paris) ». */
export function fmtNextSend(next: NextDigestSend | null): string {
  if (!next) return "—"
  if (next.pendingNow) return `Aujourd'hui, au prochain passage (dans 15${NBSP}minutes au plus)`
  return `${WEEKDAY_NAMES[weekdayOf(next.day)]} ${fmtDay(next.day, true)} à ${next.time} (Paris)`
}
