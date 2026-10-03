/**
 * Rappel « Je le ferai plus tard » (DECISIONS-STRATEGIQUES.md § 8) : l'artisan
 * choisit un moment (ce soir 19 h, demain 7 h 30, samedi 9 h, autre moment), en
 * heure de Paris, et reçoit un email avec un lien direct vers l'étape choisie.
 *
 * Fonctions pures : l'écran calcule les créneaux pour les afficher, la route
 * les recalcule à la réception (un créneau a pu passer entre-temps).
 */
import type { ReminderSlotKey, ReminderTarget } from "@/lib/onboarding/types"
import { frenchDay, frenchHour, parisDayPlus, parisParts, parisWallTime } from "@/lib/onboarding/paris-time"

/** Délai minimal entre maintenant et le rappel. */
export const REMINDER_MIN_LEAD_MINUTES = 30
/** Rappel au plus loin dans 30 jours. */
export const REMINDER_MAX_DAYS = 30
/** Au-delà de ce retard (cron arrêté), le rappel n'est plus envoyé. */
export const REMINDER_STALE_HOURS = 24

export const REMINDER_TARGETS: Record<ReminderTarget, { label: string; action: string; path: string }> = {
  quote: { label: "Faire un vrai devis", action: "faire votre premier devis", path: "/quotes/new" },
  trial: { label: "M'envoyer un devis d'essai", action: "vous envoyer un devis d'essai", path: "/demarrer?choix=essai" },
  invoice: { label: "Facturer un chantier terminé", action: "facturer un chantier terminé", path: "/invoices/new" },
  dashboard: { label: "Explorer le tableau de bord", action: "explorer votre tableau de bord", path: "/dashboard" },
}

export interface ReminderSlot {
  key: Exclude<ReminderSlotKey, "custom">
  /** « Ce soir, 19 h ». */
  label: string
  /** « vendredi 3 octobre ». */
  detail: string
  at: Date
}

const minutesBetween = (a: Date, b: Date) => (b.getTime() - a.getTime()) / 60_000

/**
 * Créneaux proposés à `now`. « Ce soir » disparaît moins de 30 minutes avant
 * 19 h ; « samedi » est le prochain samedi à 9 h encore à venir (aujourd'hui si
 * l'on est samedi avant 8 h 30).
 */
export function reminderSlots(now: Date): ReminderSlot[] {
  const today = parisParts(now)
  const slots: ReminderSlot[] = []

  const tonight = parisWallTime(today.day, 19, 0)
  if (minutesBetween(now, tonight) >= REMINDER_MIN_LEAD_MINUTES) {
    slots.push({ key: "tonight", label: `Ce soir, ${frenchHour(19, 0)}`, detail: frenchDay(tonight), at: tonight })
  }

  const tomorrow = parisWallTime(parisDayPlus(now, 1), 7, 30)
  slots.push({ key: "tomorrow", label: `Demain, ${frenchHour(7, 30)}`, detail: frenchDay(tomorrow), at: tomorrow })

  for (let i = 0; i <= 7; i++) {
    const day = parisDayPlus(now, i)
    const at = parisWallTime(day, 9, 0)
    if (parisParts(at).weekday === 6 && minutesBetween(now, at) >= REMINDER_MIN_LEAD_MINUTES) {
      slots.push({ key: "saturday", label: `Samedi, ${frenchHour(9, 0)}`, detail: frenchDay(at), at })
      break
    }
  }
  return slots
}

/** « 2026-10-10T09:00 » (champ datetime-local, heure de Paris) → instant, ou null. */
export function parseParisLocal(value: unknown): Date | null {
  if (typeof value !== "string") return null
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value.trim())
  if (!m) return null
  const [, y, mo, d, h, mi] = m
  const day = `${y}-${mo}-${d}`
  const check = new Date(Date.UTC(Number(y), Number(mo) - 1, Number(d)))
  if (check.toISOString().slice(0, 10) !== day) return null
  const hour = Number(h)
  const minute = Number(mi)
  if (hour > 23 || minute > 59) return null
  return parisWallTime(day, hour, minute)
}

/** Instant du rappel demandé, ou le message d'erreur à afficher. */
export function resolveReminderAt(
  input: { slot: ReminderSlotKey; custom?: unknown },
  now: Date,
): { at: Date } | { error: string } {
  if (input.slot !== "custom") {
    const slot = reminderSlots(now).find((s) => s.key === input.slot)
    return slot ? { at: slot.at } : { error: "Ce créneau est passé. Choisissez-en un autre." }
  }
  const at = parseParisLocal(input.custom)
  if (!at) return { error: "Indiquez une date et une heure." }
  if (minutesBetween(now, at) < REMINDER_MIN_LEAD_MINUTES) {
    return { error: "Choisissez un moment au moins 30 minutes après maintenant." }
  }
  if (minutesBetween(now, at) > REMINDER_MAX_DAYS * 24 * 60) {
    return { error: `Choisissez un moment dans les ${REMINDER_MAX_DAYS} prochains jours.` }
  }
  return { at }
}

/** « ce soir à 19 h », « demain à 7 h 30 », « samedi 10 octobre à 9 h » (heure de Paris). */
export function formatReminderMoment(at: Date, now: Date): string {
  const p = parisParts(at)
  const hour = frenchHour(p.hour, p.minute)
  if (p.day === parisParts(now).day) return p.hour >= 18 ? `ce soir à ${hour}` : `aujourd'hui à ${hour}`
  if (p.day === parisDayPlus(now, 1)) return `demain à ${hour}`
  return `${frenchDay(at)} à ${hour}`
}

/** Valeur min et max du champ « autre moment » (datetime-local, heure de Paris). */
export function customRange(now: Date): { min: string; max: string } {
  const toLocal = (d: Date) => {
    const p = parisParts(d)
    return `${p.day}T${String(p.hour).padStart(2, "0")}:${String(p.minute).padStart(2, "0")}`
  }
  return {
    min: toLocal(new Date(now.getTime() + REMINDER_MIN_LEAD_MINUTES * 60_000)),
    max: toLocal(new Date(now.getTime() + REMINDER_MAX_DAYS * 86_400_000)),
  }
}
