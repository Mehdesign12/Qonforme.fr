/**
 * Filtres et indicateurs des écrans Search Console (Vue d'ensemble,
 * Performance › Recherche Google), pilotés par l'adresse :
 * `?periode=7j|28j|3m`, `?metrique=clics|impressions|ctr|position`,
 * `?appareil=all|mobile|desktop`, `?pays=fr|tous`.
 *
 * Module pur : utilisable côté serveur, navigateur et tests.
 */
import { DEVICE_FILTERS, type DeviceFilter, type GscDevice } from "@/lib/seo/types"

/** Pays au sens de Search Console : ISO 3166-1 alpha-3 en minuscules ; null = tous les pays. */
export const COUNTRY_FILTERS = [
  { value: "fr", label: "France", country: "fra" },
  { value: "tous", label: "Tous les pays", country: null },
] as const satisfies readonly { value: string; label: string; country: string | null }[]

export type CountryFilter = (typeof COUNTRY_FILTERS)[number]["value"]

/** France par défaut : Qonforme vise le marché français (Paramètres › Ciblage). */
export const DEFAULT_COUNTRY: CountryFilter = "fr"
export const DEFAULT_DEVICE: DeviceFilter = "all"

function first(value: string | string[] | undefined | null): string | undefined {
  return (Array.isArray(value) ? value[0] : value) ?? undefined
}

export function parseDevice(value: string | string[] | undefined | null): DeviceFilter {
  const v = first(value)
  return DEVICE_FILTERS.some((d) => d.value === v) ? (v as DeviceFilter) : DEFAULT_DEVICE
}

export function parseCountry(value: string | string[] | undefined | null): CountryFilter {
  const v = first(value)
  return COUNTRY_FILTERS.some((c) => c.value === v) ? (v as CountryFilter) : DEFAULT_COUNTRY
}

/** Valeur de la colonne `device` (« MOBILE ») ; null pour tous les appareils. */
export function deviceValue(filter: DeviceFilter): GscDevice | null {
  return DEVICE_FILTERS.find((d) => d.value === filter)?.device ?? null
}

/** Valeur de la colonne `country` (« fra ») ; null pour tous les pays. */
export function countryValue(filter: CountryFilter): string | null {
  return COUNTRY_FILTERS.find((c) => c.value === filter)?.country ?? null
}

export function countryLabel(filter: CountryFilter): string {
  return COUNTRY_FILTERS.find((c) => c.value === filter)?.label ?? "France"
}

export function deviceLabel(filter: DeviceFilter): string {
  return DEVICE_FILTERS.find((d) => d.value === filter)?.label ?? "Tous"
}

/* ------------------------------------------------------------------ */
/* Indicateurs                                                         */
/* ------------------------------------------------------------------ */

export type MetricKey = "clics" | "impressions" | "ctr" | "position"

export const METRICS: { key: MetricKey; label: string }[] = [
  { key: "clics", label: "Clics" },
  { key: "impressions", label: "Impressions" },
  { key: "ctr", label: "Taux de clic" },
  { key: "position", label: "Position moyenne" },
]

export function parseMetric(value: string | string[] | undefined | null, fallback: MetricKey): MetricKey {
  const v = first(value)
  return METRICS.some((m) => m.key === v) ? (v as MetricKey) : fallback
}
