/**
 * Search Console (module Performance) : conversion des lignes de l'API
 * (chemins du site, fusion, position pondérée par les impressions), séries
 * quotidiennes complètes (jours vides), totaux, jours en retard, tranches de
 * reprise de l'historique et échéance de la tâche quotidienne.
 */
import { describe, expect, it } from "vitest"
import type { GscApiRow } from "@/lib/seo/google"
import type { SeoJobRow } from "@/lib/seo/cron"
import {
  backfillSlice,
  mergeRows,
  monthsBefore,
  parseCursor,
  refreshStart,
  searchConsoleDue,
  slicesBetween,
  toDailyRows,
  toPageRows,
  toQueryPageRows,
  toQueryRows,
} from "@/lib/seo/search-console/sync"
import { fillSeries, fmtDayList, historyCovers, missingDaysNotice, toTotals } from "@/lib/seo/search-console/read"
import { countryValue, deviceValue, parseCountry, parseDevice, parseMetric } from "@/lib/seo/search-console/filters"
import { mobileCompareText, noDataReason } from "@/lib/seo/search-console/messages"
import { chartSeriesFor } from "@/lib/seo/search-console/chart"
import type { SyncState } from "@/lib/seo/search-console/read"

const row = (keys: string[], clicks: number, impressions: number, position: number): GscApiRow => ({
  keys,
  clicks,
  impressions,
  ctr: impressions ? clicks / impressions : 0,
  position,
})

/** Espaces insécables (fmtDay) → espaces simples, pour comparer. */
const plain = (s: string | undefined) => (s ?? "").replace(/[\u00a0\u202f]/g, " ")

function job(partial: Partial<SeoJobRow>): SeoJobRow {
  return {
    name: "search-console",
    status: "ok",
    started_at: null,
    finished_at: null,
    last_ok_at: null,
    lock_until: null,
    cursor: {},
    result: null,
    error: null,
    ...partial,
  }
}

describe("lignes de Search Console → tables", () => {
  it("totaux du site : appareil en majuscules, pays en minuscules", () => {
    const rows = toDailyRows([row(["2026-10-04", "mobile", "FRA"], 1, 22, 9.5)])
    expect(rows).toEqual([{ date: "2026-10-04", device: "MOBILE", country: "fra", clicks: 1, impressions: 22, position: 9.5 }])
  })

  it("pages : URL → chemin, fusion des formes d'une même page, position pondérée, hors site ignoré", () => {
    const rows = toPageRows([
      row(["2026-10-04", "https://qonforme.fr/modele", "MOBILE", "fra"], 0, 30, 6),
      row(["2026-10-04", "https://www.qonforme.fr/modele/", "MOBILE", "fra"], 1, 10, 10),
      row(["2026-10-04", "https://autre-site.fr/modele", "MOBILE", "fra"], 5, 50, 1),
      row(["2026-10-04", "https://qonforme.fr/", "DESKTOP", "fra"], 0, 11, 32.4),
    ])
    expect(rows).toHaveLength(2)
    const modele = rows.find((r) => r.page === "/modele")
    expect(modele).toMatchObject({ clicks: 1, impressions: 40, device: "MOBILE", country: "fra" })
    // (6 × 30 + 10 × 10) / 40 = 7
    expect(modele?.position).toBeCloseTo(7, 10)
    expect(rows.find((r) => r.page === "/")?.position).toBe(32.4)
  })

  it("requêtes et couples requête × page", () => {
    expect(toQueryRows([row(["2026-10-04", "devis modele", "DESKTOP", "fra"], 0, 45, 2.7)])).toEqual([
      { date: "2026-10-04", query: "devis modele", device: "DESKTOP", country: "fra", clicks: 0, impressions: 45, position: 2.7 },
    ])
    expect(toQueryPageRows([row(["2026-10-04", "devis modele", "https://qonforme.fr/modele/"], 0, 45, 2.7)])).toEqual([
      { date: "2026-10-04", query: "devis modele", page: "/modele", clicks: 0, impressions: 45, position: 2.7 },
    ])
  })

  it("fusion sans impression : la position reste celle de la première ligne", () => {
    const merged = mergeRows(
      [
        { k: "a", clicks: 0, impressions: 0, position: 4 },
        { k: "a", clicks: 0, impressions: 0, position: 8 },
      ],
      (r) => r.k,
    )
    expect(merged).toEqual([{ k: "a", clicks: 0, impressions: 0, position: 4 }])
  })
})

describe("totaux et série quotidienne", () => {
  it("taux de clic = clics / impressions ; sans impression, ni taux ni position", () => {
    expect(toTotals({ clicks: 1, impressions: 238, avg_position: 17.6 })).toEqual({ clicks: 1, impressions: 238, ctr: 1 / 238, position: 17.6 })
    expect(toTotals({ clicks: "3", impressions: "120", avg_position: 9.96 })).toMatchObject({ clicks: 3, impressions: 120, ctr: 0.025 })
    expect(toTotals({ clicks: 0, impressions: 0, avg_position: null })).toEqual({ clicks: 0, impressions: 0, ctr: null, position: null })
    expect(toTotals(null)).toEqual({ clicks: 0, impressions: 0, ctr: null, position: null })
  })

  it("jours sans ligne : 0 clic, 0 impression, taux et position absents", () => {
    const series = fillSeries(
      ["2026-09-07", "2026-09-08", "2026-09-09"],
      [{ date: "2026-09-08", clicks: 1, impressions: 4, avg_position: 5 }],
    )
    expect(series).toEqual([
      { date: "2026-09-07", clicks: 0, impressions: 0, ctr: null, position: null },
      { date: "2026-09-08", clicks: 1, impressions: 4, ctr: 0.25, position: 5 },
      { date: "2026-09-09", clicks: 0, impressions: 0, ctr: null, position: null },
    ])
  })

  it("la période précédente n'est comparée que si l'historique la couvre", () => {
    expect(historyCovers("2025-06-01", false, "2026-08-10")).toBe(true)
    expect(historyCovers("2026-09-01", false, "2026-08-10")).toBe(false)
    expect(historyCovers("2026-09-01", true, "2026-08-10")).toBe(true)
    expect(historyCovers(null, false, "2026-08-10")).toBe(false)
  })

  it("jours pas encore disponibles", () => {
    expect(plain(fmtDayList(["2026-10-05", "2026-10-06"]))).toBe("le 5 et le 6 oct.")
    expect(plain(fmtDayList(["2026-09-30", "2026-10-01"]))).toBe("le 30 sept. et le 1er oct.")
    const normal = missingDaysNotice(["2026-10-05", "2026-10-06"])
    expect(normal?.late).toBe(false)
    expect(plain(normal?.text)).toBe("2 à 3 jours de décalage : le 5 et le 6 oct. ne sont pas encore disponibles.")
    expect(plain(missingDaysNotice(["2026-10-06"])?.text)).toBe("2 à 3 jours de décalage : le 6 oct. n'est pas encore disponible.")
    const late = missingDaysNotice(["2026-10-01", "2026-10-02", "2026-10-03", "2026-10-04", "2026-10-05", "2026-10-06"])
    expect(late?.late).toBe(true)
    expect(plain(late?.text)).toContain("les jours du 1er au 6 oct.")
    expect(missingDaysNotice([])).toBeNull()
  })
})

describe("filtres", () => {
  it("France par défaut, tous appareils, valeurs inconnues ignorées", () => {
    expect(parseCountry(undefined)).toBe("fr")
    expect(countryValue(parseCountry("fr"))).toBe("fra")
    expect(countryValue(parseCountry("tous"))).toBeNull()
    expect(parseDevice("tablette")).toBe("all")
    expect(deviceValue(parseDevice("mobile"))).toBe("MOBILE")
    expect(deviceValue(parseDevice("desktop"))).toBe("DESKTOP")
    expect(parseMetric("position", "clics")).toBe("position")
    expect(parseMetric("autre", "impressions")).toBe("impressions")
  })
})

describe("reprise de l'historique", () => {
  it("16 mois en arrière, fin de mois ramenée", () => {
    expect(monthsBefore("2026-10-09", 16)).toBe("2025-06-09")
    expect(monthsBefore("2026-07-31", 16)).toBe("2025-03-31")
    expect(monthsBefore("2026-06-30", 16)).toBe("2025-02-28")
  })

  it("tranches de 30 jours, de la plus ancienne à la plus récente", () => {
    expect(slicesBetween("2026-10-01", "2026-10-08")).toEqual([{ from: "2026-10-01", to: "2026-10-08" }])
    const slices = slicesBetween("2026-08-01", "2026-10-08")
    expect(slices[0]).toEqual({ from: "2026-08-01", to: "2026-08-30" })
    expect(slices[slices.length - 1].to).toBe("2026-10-08")
    expect(slicesBetween("2026-10-09", "2026-10-08")).toEqual([])
  })

  it("tranche de reprise : les 30 jours avant le curseur, sans passer la limite", () => {
    expect(backfillSlice("2026-10-02", "2025-06-09")).toEqual({ from: "2026-09-02", to: "2026-10-01" })
    expect(backfillSlice("2025-06-20", "2025-06-09")).toEqual({ from: "2025-06-09", to: "2025-06-19" })
    expect(backfillSlice("2025-06-09", "2025-06-09")).toBeNull()
  })

  it("rafraîchissement : les 5 derniers jours enregistrés, la dernière semaine au premier passage", () => {
    expect(refreshStart("2026-10-06", "2026-10-08", "2025-06-09")).toBe("2026-10-02")
    expect(refreshStart(null, "2026-10-08", "2025-06-09")).toBe("2026-10-02")
  })

  it("curseur lu avec prudence", () => {
    expect(parseCursor({ backfillUntil: "2026-01-01", backfillDone: true, refreshedOn: "x" })).toEqual({
      backfillUntil: "2026-01-01",
      backfillDone: true,
    })
    expect(parseCursor(null)).toEqual({})
  })
})

describe("échéance de la synchronisation", () => {
  // 9 oct. 2026 : 03:00 et 08:00 à Paris (heure d'été, UTC+2)
  const night = new Date("2026-10-09T01:00:00Z")
  const morning = new Date("2026-10-09T06:00:00Z")
  const done = { backfillDone: true, backfillUntil: "2025-06-09" }

  it("jamais sans compte de service", () => {
    expect(searchConsoleDue(null, morning, false)).toBe(false)
  })

  it("premier passage et reprise en cours : à chaque passage, même la nuit", () => {
    expect(searchConsoleDue(null, night, true)).toBe(true)
    expect(searchConsoleDue(job({ cursor: { backfillUntil: "2026-03-01", refreshedOn: "2026-10-09" } }), night, true)).toBe(true)
  })

  it("reprise finie : une fois par jour après 06:00", () => {
    expect(searchConsoleDue(job({ cursor: { ...done, refreshedOn: "2026-10-08" } }), night, true)).toBe(false)
    expect(searchConsoleDue(job({ cursor: { ...done, refreshedOn: "2026-10-08" }, last_ok_at: "2026-10-08T05:00:00Z" }), morning, true)).toBe(true)
    expect(searchConsoleDue(job({ cursor: { ...done, refreshedOn: "2026-10-09" }, last_ok_at: "2026-10-09T04:30:00Z" }), morning, true)).toBe(false)
  })

  it("après un échec, une heure d'attente", () => {
    const failed = job({ status: "error", finished_at: "2026-10-09T05:40:00Z", cursor: { refreshedOn: "2026-10-08" } })
    expect(searchConsoleDue(failed, morning, true)).toBe(false)
    expect(searchConsoleDue(failed, new Date("2026-10-09T06:45:00Z"), true)).toBe(true)
  })
})

describe("phrases selon l'état des données", () => {
  const sync = (partial: Partial<SyncState>): SyncState => ({
    status: "ok",
    finishedAt: null,
    lastOkAt: null,
    error: null,
    backfillDone: false,
    backfillUntil: null,
    ...partial,
  })

  it("aucune donnée : jamais synchronisée, en cours, ou synchronisée sans données", () => {
    expect(noDataReason(null)).toBe("never")
    expect(noDataReason(sync({ status: "error", error: "403" }))).toBe("never")
    expect(noDataReason(sync({ status: "running", lastOkAt: "2026-10-08T05:00:00Z" }))).toBe("running")
    expect(noDataReason(sync({ status: "ok", lastOkAt: "2026-10-09T05:00:00Z", backfillDone: true }))).toBe("synced_empty")
  })

  it("graphique du taux de clic : 0 % mesuré est une donnée, un jour sans impression reste vide", () => {
    const series = chartSeriesFor("ctr", [
      { date: "2026-10-01", clicks: 0, impressions: 12, ctr: 0, position: 9 },
      { date: "2026-10-02", clicks: 0, impressions: 0, ctr: null, position: null },
    ])
    expect(series).toHaveLength(1)
    expect(series[0]).toMatchObject({ values: [0, null], zeroIsData: true })
    expect(chartSeriesFor("clics", []).every((s) => !s.zeroIsData)).toBe(true)
  })

  it("ligne des évolutions sur téléphone, y compris pendant la reprise de l'historique", () => {
    expect(mobileCompareText("vs 28 jours précédents")).toBe("Évolutions par rapport aux 28 jours précédents")
    expect(mobileCompareText(null)).toBe("Pas encore d'évolution : historique en cours de reprise")
  })
})
