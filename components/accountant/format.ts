/**
 * Formats d'affichage de l'accès comptable (Paramètres et espace comptable).
 *
 * Dates et heures composées à la main, en heure de Paris, à partir de
 * formatToParts : le rendu serveur et le rendu du navigateur sont identiques
 * (pas d'écart d'hydratation dû à des versions d'ICU différentes).
 */
import { mediumDate } from "@/components/invoices/invoice-view"
import type { Period } from "@/lib/accountant/types"

const MONTHS_SHORT = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."]

function parisParts(iso: string): { y: number; m: number; d: number; hh: string; mm: string } | null {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return null
  const p = Object.fromEntries(
    new Intl.DateTimeFormat("en-GB", {
      timeZone: "Europe/Paris", year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit", hourCycle: "h23",
    }).formatToParts(date).map((x) => [x.type, x.value]),
  )
  return { y: Number(p.year), m: Number(p.month), d: Number(p.day), hh: p.hour, mm: p.minute }
}

/** « 3 oct. 2026 à 14:05 » (heure de Paris). */
export function dateTime(iso: string | null | undefined): string {
  if (!iso) return "—"
  const p = parisParts(iso)
  if (!p) return "—"
  return `${p.d === 1 ? "1er" : p.d} ${MONTHS_SHORT[p.m - 1]} ${p.y} à ${p.hh}:${p.mm}`
}

/** « 3 oct. 2026 » d'un horodatage (heure de Paris). */
export function dayOf(iso: string | null | undefined): string {
  if (!iso) return "—"
  const p = parisParts(iso)
  if (!p) return "—"
  return mediumDate(`${p.y}-${String(p.m).padStart(2, "0")}-${String(p.d).padStart(2, "0")}`)
}

/** « du 1er janv. 2026 au 31 déc. 2026 ». */
export function periodText(p: Period): string {
  return `du ${mediumDate(p.from)} au ${mediumDate(p.to)}`
}
