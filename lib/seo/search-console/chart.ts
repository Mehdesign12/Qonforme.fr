/**
 * Séries du graphique de Search Console selon l'indicateur choisi
 * (SearchPerformanceCard). Module pur, testé.
 */
import type { ChartSeries } from "@/components/admin/seo/SeoChart"
import { fmtPosition, fmtRate } from "@/lib/seo/format"
import type { GscDay } from "@/lib/seo/types"
import type { MetricKey } from "@/lib/seo/search-console/filters"

const fmtAxisCount = (n: number) => n.toLocaleString("fr-FR", { maximumFractionDigits: 1 })

export function chartSeriesFor(metric: MetricKey, series: GscDay[]): ChartSeries[] {
  if (metric === "ctr") {
    // Un taux de 0 % mesuré (impressions sans clic) est une donnée, pas un jour vide
    return [{ label: "Taux de clic", values: series.map((d) => d.ctr), kind: "line", format: (n) => fmtRate(n), area: true, zeroIsData: true }]
  }
  if (metric === "position") {
    return [{ label: "Position moyenne", values: series.map((d) => d.position), kind: "line", format: (n) => fmtPosition(n), invert: true }]
  }
  return [
    { label: "Clics (axe de gauche)", values: series.map((d) => d.clicks), kind: "bars", format: fmtAxisCount },
    { label: "Impressions (axe de droite)", values: series.map((d) => d.impressions), kind: "line", format: fmtAxisCount },
  ]
}
