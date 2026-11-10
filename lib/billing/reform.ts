/**
 * Échéance de la facture électronique montrée dans le mur de paiement
 * (piste B validée par le fondateur le 10/11/2026, canevas
 * https://claude.ai/artifact/5ZyR3KUG2RBz64VJieJvHE).
 *
 * Dates vérifiées (guides du site, service-public F39785) : réception
 * obligatoire pour toutes les entreprises depuis le 1er septembre 2026,
 * émission obligatoire pour les PME, TPE et micro-entreprises au
 * 1er septembre 2027. Module pur.
 */
import { daysBetween, todayInParis } from "@/lib/utils/paris-date"

export const EMISSION_DEADLINE = "2027-09-01"

/** Jours restants avant l'obligation d'émettre (heure de Paris) ; 0 ou moins : échéance passée. */
export function daysUntilEmission(now: Date = new Date()): number {
  return daysBetween(todayInParis(now), EMISSION_DEADLINE)
}

/** Phrase sous le titre du bandeau. */
export function emissionCountdownText(now: Date = new Date()): string {
  const days = daysUntilEmission(now)
  if (days <= 0) return "Obligatoire depuis le 1er septembre 2027, comme la réception depuis le 1er septembre 2026."
  const when = days === 1 ? "Demain." : `Dans ${days.toLocaleString("fr-FR")} jours.`
  return `${when} La réception est déjà obligatoire depuis le 1er septembre 2026.`
}
