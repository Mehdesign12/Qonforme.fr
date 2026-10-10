/**
 * Phrases des écrans Search Console qui dépendent de l'état des données
 * (Vue d'ensemble, Performance › Recherche Google). Module pur, testé.
 */
import type { SyncState } from "@/lib/seo/search-console/read"

/**
 * Pourquoi aucune donnée n'est encore enregistrée :
 * - « running » : une synchronisation tourne en ce moment ;
 * - « synced_empty » : une synchronisation a déjà abouti, mais Search Console
 *   n'a renvoyé aucune ligne (propriété sans données, ou autre propriété) ;
 * - « never » : aucune synchronisation n'a encore abouti.
 */
export type NoDataReason = "running" | "synced_empty" | "never"

export function noDataReason(sync: SyncState | null): NoDataReason {
  if (sync?.status === "running") return "running"
  if (sync?.lastOkAt) return "synced_empty"
  return "never"
}

/**
 * Ligne des évolutions sur téléphone : « Évolutions par rapport aux 28 jours
 * précédents », ou l'absence d'évolution tant que l'historique ne couvre pas
 * la période précédente.
 */
export function mobileCompareText(compareLabel: string | null): string {
  if (!compareLabel) return "Pas encore d'évolution : historique en cours de reprise"
  return `Évolutions ${compareLabel.replace(/^vs /, "par rapport aux ")}`
}
