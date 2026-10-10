/**
 * PageSpeed (module Performance) : lecture d'une réponse de l'API v5 (extrait
 * réaliste, mobile), seuils du LCP, historique d'une page, échéance de la
 * mesure hebdomadaire.
 */
import { describe, expect, it } from "vitest"
import type { SeoJobRow } from "@/lib/seo/cron"
import { fieldVerdict, fmtCls, fmtMs, lcpScalePercent, lcpVerdict, parsePageSpeed } from "@/lib/seo/pagespeed/parse"
import { summarizeHistory, type PageSpeedRow } from "@/lib/seo/pagespeed/read"
import { pagespeedDue, parsePageSpeedCursor, weekOf, weeklyItems } from "@/lib/seo/pagespeed/task"
import { measureErrorMessage } from "@/lib/seo/pagespeed/measure"
import { GoogleApiError } from "@/lib/seo/google"

/** Extrait d'une réponse runPagespeed (strategy=mobile, category=performance, locale=fr). */
const PSI_MOBILE = {
  captchaResult: "CAPTCHA_NOT_NEEDED",
  kind: "pagespeedonline#result",
  id: "https://qonforme.fr/modele",
  loadingExperience: {
    id: "https://qonforme.fr/",
    metrics: {
      CUMULATIVE_LAYOUT_SHIFT_SCORE: { percentile: 5, distributions: [], category: "FAST" },
      INTERACTION_TO_NEXT_PAINT: { percentile: 182, distributions: [], category: "FAST" },
      LARGEST_CONTENTFUL_PAINT_MS: { percentile: 2711, distributions: [], category: "AVERAGE" },
      FIRST_CONTENTFUL_PAINT_MS: { percentile: 1500, distributions: [], category: "FAST" },
    },
    overall_category: "AVERAGE",
    initial_url: "https://qonforme.fr/modele",
    origin_fallback: true,
  },
  lighthouseResult: {
    requestedUrl: "https://qonforme.fr/modele",
    finalUrl: "https://qonforme.fr/modele",
    finalDisplayedUrl: "https://qonforme.fr/modele",
    lighthouseVersion: "12.6.0",
    fetchTime: "2026-10-09T08:12:31.402Z",
    runWarnings: [],
    configSettings: { emulatedFormFactor: "mobile", formFactor: "mobile", locale: "fr", onlyCategories: ["performance"] },
    audits: {
      "first-contentful-paint": { id: "first-contentful-paint", score: 0.93, numericValue: 1201.4, numericUnit: "millisecond", displayValue: "1,2 s" },
      "largest-contentful-paint": { id: "largest-contentful-paint", score: 0.84, numericValue: 2712.62, numericUnit: "millisecond", displayValue: "2,7 s" },
      "total-blocking-time": { id: "total-blocking-time", score: 0.97, numericValue: 96.5, numericUnit: "millisecond", displayValue: "100 ms" },
      "cumulative-layout-shift": { id: "cumulative-layout-shift", score: 1, numericValue: 0.0123, numericUnit: "unitless", displayValue: "0,012" },
      "speed-index": { id: "speed-index", score: 0.88, numericValue: 3402.1, numericUnit: "millisecond", displayValue: "3,4 s" },
      "unused-javascript": {
        id: "unused-javascript",
        score: 0.5,
        numericValue: 300,
        numericUnit: "millisecond",
        details: { type: "opportunity", overallSavingsMs: 300, overallSavingsBytes: 70656, items: [{ url: "https://qonforme.fr/_next/static/chunks/a.js", wastedBytes: 70656 }] },
      },
    },
    categories: { performance: { id: "performance", title: "Performances", score: 0.88 } },
  },
  analysisUTCTimestamp: "2026-10-09T08:12:31.402Z",
}

describe("réponse de PageSpeed Insights", () => {
  it("laboratoire : LCP, CLS, TBT, FCP, Speed Index, JavaScript inutilisé, score", () => {
    const m = parsePageSpeed(PSI_MOBILE)
    expect(m).toMatchObject({
      performance_score: 88,
      lcp_ms: 2713,
      tbt_ms: 97,
      fcp_ms: 1201,
      si_ms: 3402,
      unused_js_bytes: 70656,
      error: null,
    })
    expect(m.cls).toBeCloseTo(0.0123, 6)
  })

  it("terrain : 75ᵉ centile, CLS divisé par 100, repli sur l'origine signalé", () => {
    const m = parsePageSpeed(PSI_MOBILE)
    expect(m.field).toEqual({
      scope: "origin",
      overall: "AVERAGE",
      lcp: { p75: 2711, category: "AVERAGE" },
      inp: { p75: 182, category: "FAST" },
      cls: { p75: 0.05, category: "FAST" },
    })
  })

  it("sans données terrain : field vide (bandeau « Données terrain indisponibles »)", () => {
    const { loadingExperience: _ignored, ...lab } = PSI_MOBILE
    void _ignored
    expect(parsePageSpeed(lab).field).toBeNull()
    expect(parsePageSpeed({ ...lab, loadingExperience: { id: "https://qonforme.fr/modele" } }).field).toBeNull()
  })

  it("JavaScript inutilisé sans total : somme des éléments", () => {
    const json = structuredClone(PSI_MOBILE) as typeof PSI_MOBILE
    ;(json.lighthouseResult.audits["unused-javascript"].details as Record<string, unknown>).overallSavingsBytes = undefined
    expect(parsePageSpeed(json).unused_js_bytes).toBe(70656)
  })

  it("Lighthouse en échec : erreur en français, pas de mesure inventée", () => {
    const m = parsePageSpeed({
      lighthouseResult: {
        runtimeError: { code: "FAILED_DOCUMENT_REQUEST", message: "Lighthouse was unable to reliably load the page." },
        audits: {},
        categories: { performance: { score: null } },
      },
    })
    expect(m.lcp_ms).toBeNull()
    expect(m.performance_score).toBeNull()
    expect(m.error).toContain("Lighthouse n'a pas pu mesurer la page")
    expect(parsePageSpeed({}).error).toBe("Réponse de PageSpeed sans résultat Lighthouse.")
  })

  it("messages d'échec d'appel", () => {
    expect(measureErrorMessage(new GoogleApiError(429, "PageSpeed : Quota exceeded")).status).toBe(429)
    expect(measureErrorMessage(new GoogleApiError(500, "PageSpeed : erreur 500")).message).toBe("PageSpeed : erreur 500")
    const timeout = new Error("signal timed out")
    timeout.name = "TimeoutError"
    expect(measureErrorMessage(timeout).message).toContain("n'a pas répondu à temps")
  })
})

describe("seuils et formats", () => {
  it("LCP : bon ≤ 2,5 s, à améliorer ≤ 4 s, mauvais au-delà", () => {
    expect(lcpVerdict(2500)).toBe("good")
    expect(lcpVerdict(2501)).toBe("improve")
    expect(lcpVerdict(4000)).toBe("improve")
    expect(lcpVerdict(4001)).toBe("poor")
    expect(lcpVerdict(null)).toBeNull()
    expect(fieldVerdict("SLOW")).toBe("poor")
    expect(fieldVerdict("NONE")).toBeNull()
  })

  it("repère sur la barre (échelle de 6 s)", () => {
    expect(lcpScalePercent(2700)).toBeCloseTo(45, 6)
    expect(lcpScalePercent(5300)).toBeCloseTo(88.33, 1)
    expect(lcpScalePercent(9000)).toBe(100)
  })

  it("formats", () => {
    expect(fmtMs(96.5).replace(/ /g, " ")).toBe("97 ms")
    expect(fmtCls(0.0123)).toBe("0,012")
    expect(fmtCls(null)).toBe("—")
  })
})

const ps = (partial: Partial<PageSpeedRow>): PageSpeedRow => ({
  id: partial.id ?? "x",
  path: "/modele",
  strategy: "mobile",
  measured_at: "2026-10-04T12:00:00Z",
  source: "api",
  note: null,
  performance_score: null,
  lcp_ms: null,
  cls: null,
  tbt_ms: null,
  fcp_ms: null,
  si_ms: null,
  unused_js_bytes: null,
  field: null,
  error: null,
  ...partial,
})

describe("historique d'une page", () => {
  it("dernière mesure réussie, précédente (« Avant »), dernier essai en échec", () => {
    const h = summarizeHistory("/modele", [
      ps({ id: "avant", measured_at: "2026-10-04T08:00:00Z", lcp_ms: 5300, source: "import" }),
      ps({ id: "echec", measured_at: "2026-10-09T08:00:00Z", error: "Quota de PageSpeed atteint." }),
      ps({ id: "apres", measured_at: "2026-10-04T18:00:00Z", lcp_ms: 2700, source: "import" }),
    ])
    expect(h.current?.id).toBe("apres")
    expect(h.previous?.id).toBe("avant")
    expect(h.lastAttempt?.id).toBe("echec")
  })

  it("aucune mesure", () => {
    expect(summarizeHistory("/demo", [])).toEqual({ path: "/demo", current: null, previous: null, lastAttempt: null })
  })
})

describe("mesure hebdomadaire", () => {
  const settings = { pages: [{ path: "/", label: "Accueil" }, { path: "/modele", label: "Modèles" }], weekly: true }
  const job = (cursor: Record<string, unknown>, extra: Partial<SeoJobRow> = {}): SeoJobRow => ({
    name: "pagespeed",
    status: "ok",
    started_at: null,
    finished_at: null,
    last_ok_at: null,
    lock_until: null,
    cursor,
    result: null,
    error: null,
    ...extra,
  })
  // Lundi 12 oct. 2026 : 04:30 et 05:30 à Paris
  const mondayEarly = new Date("2026-10-12T02:30:00Z")
  const mondayLater = new Date("2026-10-12T03:30:00Z")
  const wednesday = new Date("2026-10-14T10:00:00Z")

  it("chaque page sur mobile puis sur ordinateur", () => {
    expect(weeklyItems(settings)).toEqual([
      { path: "/", strategy: "mobile" },
      { path: "/", strategy: "desktop" },
      { path: "/modele", strategy: "mobile" },
      { path: "/modele", strategy: "desktop" },
    ])
  })

  it("le lundi après 05:00 (Paris), une fois par semaine", () => {
    expect(weekOf(mondayLater)).toBe("2026-10-12")
    expect(weekOf(wednesday)).toBe("2026-10-12")
    expect(pagespeedDue(null, mondayEarly, settings)).toBe(false)
    expect(pagespeedDue(null, mondayLater, settings)).toBe(true)
    expect(pagespeedDue(job({ completedWeek: "2026-10-12" }), wednesday, settings)).toBe(false)
    // Lundi manqué : rattrapé dans la semaine
    expect(pagespeedDue(job({ completedWeek: "2026-10-05" }), wednesday, settings)).toBe(true)
  })

  it("jamais si la mesure hebdomadaire est coupée ou sans page suivie", () => {
    expect(pagespeedDue(null, mondayLater, { ...settings, weekly: false })).toBe(false)
    expect(pagespeedDue(null, mondayLater, { pages: [], weekly: true })).toBe(false)
  })

  it("curseur lu avec prudence", () => {
    expect(parsePageSpeedCursor({ week: "2026-10-12", next: 3, completedWeek: 4 })).toEqual({ week: "2026-10-12", next: 3 })
    expect(parsePageSpeedCursor({ next: -1 })).toEqual({})
  })
})
