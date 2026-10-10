import { describe, expect, it } from "vitest"
import { canonicalKeyword, foldAccents, looksLikeUrl, normalizeKeyword } from "@/lib/seo/keywords/normalize"
import {
  aggregateQueries,
  compareKeywords,
  isBrandQuery,
  isQuickWin,
  keywordKpis,
  planDiscoveries,
  planMetricUpdates,
  type SortableKeyword,
} from "@/lib/seo/keywords/rules"
import { INTERRUPTED_MESSAGE, analysisState, cooldownMessage, fmtLongDay, needsMetrics, nextAnalysisDay } from "@/lib/seo/keywords/analysis"
import { metricsPatch } from "@/lib/seo/keywords/metrics"
import { keywordsDue } from "@/lib/seo/keywords/task"
import { parseCreateKeyword, parsePatchKeyword, topicTitleFor } from "@/lib/seo/keywords/input"
import { keywordPage, keywordsHref, parseKeywordFilters, statusCounts, MOBILE_STEP, PAGE_SIZE } from "@/lib/seo/keywords/view"
import { toKeywordRow } from "@/lib/seo/keywords/types"
import { metricsNote } from "@/lib/seo/keywords/provenance"
import { queryVariants, readAllPages } from "@/lib/seo/keywords/data"
import { pageLabel } from "@/lib/seo/keywords/page-label"
import { SeoDbError } from "@/lib/seo/db"
import { notesNeedResend, notesNeedSave, notesStateWhenBackToSaved, notesToFlush } from "@/lib/seo/keywords/notes"
import type { SeoJobRow } from "@/lib/seo/cron"

const NBSP = String.fromCharCode(0xa0)

describe("normalisation d'un mot-clé", () => {
  it("met en minuscules, réduit les espaces et redresse les apostrophes", () => {
    expect(normalizeKeyword("  Factures   Mentions\tObligatoires ")).toEqual({ ok: true, keyword: "factures mentions obligatoires" })
    expect(normalizeKeyword(`Devis d${String.fromCharCode(0x2019)}artisan`)).toEqual({ ok: true, keyword: "devis d'artisan" })
    expect(normalizeKeyword(`taux${NBSP}de${String.fromCharCode(0x202f)}TVA`)).toEqual({ ok: true, keyword: "taux de tva" })
    expect(canonicalKeyword("ÉLECTRICIEN")).toBe("électricien")
  })

  it("refuse un mot-clé vide, trop court, trop long ou une adresse web", () => {
    expect(normalizeKeyword("   ").ok).toBe(false)
    expect(normalizeKeyword(42).ok).toBe(false)
    expect(normalizeKeyword("a").ok).toBe(false)
    expect(normalizeKeyword("ab")).toEqual({ ok: true, keyword: "ab" })
    expect(normalizeKeyword("x".repeat(120)).ok).toBe(true)
    expect(normalizeKeyword("x".repeat(121)).ok).toBe(false)
    expect(normalizeKeyword("https://qonforme.fr/modele").ok).toBe(false)
    expect(normalizeKeyword("www.qonforme.fr").ok).toBe(false)
    expect(normalizeKeyword("qonforme.fr/guide/tva-travaux").ok).toBe(false)
    // Un nom de domaine seul est une requête tapée telle quelle
    expect(normalizeKeyword("qonforme.fr")).toEqual({ ok: true, keyword: "qonforme.fr" })
    expect(looksLikeUrl("devis 2026")).toBe(false)
  })

  it("rend une forme stable (invisibles retirés avant de réduire les espaces)", () => {
    const zwsp = String.fromCharCode(0x200b)
    const raw = `Devis ${zwsp} artisan`
    expect(canonicalKeyword(raw)).toBe("devis artisan")
    expect(normalizeKeyword(raw)).toEqual({ ok: true, keyword: "devis artisan" })
    ;[raw, `  a${NBSP}${zwsp}${NBSP}b  `, `l${String.fromCharCode(0x2019)}${zwsp} artisan`, "x\u0007 \u0007 y"].forEach((x) => {
      expect(canonicalKeyword(canonicalKeyword(x))).toBe(canonicalKeyword(x))
    })
  })

  it("compare sans accents ni casse", () => {
    expect(foldAccents("Qönforme Électricité")).toBe("qonforme electricite")
  })
})

const kw = (over: Partial<SortableKeyword>): SortableKeyword => ({
  keyword: "mot",
  status: "candidate",
  volume: null,
  difficulty: null,
  position: null,
  impressions: null,
  ...over,
})

describe("gain rapide", () => {
  it("volume connu ≥ 100, difficulté connue ≤ 20, pas en première page", () => {
    // factures mentions obligatoires : 3 600 / mois, difficulté 12, aucune position
    expect(isQuickWin(kw({ volume: 3600, difficulty: 12, status: "covered" }))).toBe(true)
    expect(isQuickWin(kw({ volume: 100, difficulty: 20, position: 10.5 }))).toBe(true)
  })

  it("jamais sur une valeur inconnue, déjà en première page ou ignoré", () => {
    expect(isQuickWin(kw({ volume: null, difficulty: 3 }))).toBe(false)
    expect(isQuickWin(kw({ volume: 1600, difficulty: null }))).toBe(false)
    expect(isQuickWin(kw({ volume: 99, difficulty: 5 }))).toBe(false)
    expect(isQuickWin(kw({ volume: 500, difficulty: 21 }))).toBe(false)
    expect(isQuickWin(kw({ volume: 500, difficulty: 5, position: 10 }))).toBe(false)
    expect(isQuickWin(kw({ volume: 500, difficulty: 5, status: "ignored" }))).toBe(false)
  })

  it("trie : gains rapides, puis impressions, puis volume, valeurs absentes en dernier", () => {
    const rows = [
      kw({ keyword: "c", impressions: 45 }),
      kw({ keyword: "a", impressions: null, volume: 1600 }),
      kw({ keyword: "quick", volume: 3600, difficulty: 12 }),
      kw({ keyword: "b", impressions: 44 }),
      kw({ keyword: "d", impressions: null, volume: null }),
    ]
    expect(rows.sort(compareKeywords).map((r) => r.keyword)).toEqual(["quick", "c", "b", "a", "d"])
  })

  it("indicateurs : suivis tous statuts confondus, volume cumulé de la liste affichée, première page hors ignorés", () => {
    const all = [
      kw({ keyword: "factures mentions obligatoires", volume: 3600, difficulty: 12 }),
      kw({ keyword: "logiciel devis facturation", volume: 1600 }),
      kw({ keyword: "devis modele", position: 2.7 }),
      kw({ keyword: "ignoré", status: "ignored", position: 1, volume: 900 }),
    ]
    const k = keywordKpis(all, all.slice(0, 2))
    expect(k).toEqual({ quickWins: 1, firstQuickWin: "factures mentions obligatoires", tracked: 4, volume: 5200, firstPage: 1 })
    expect(keywordKpis(all, [all[2]]).volume).toBeNull()
    // Même nombre que l'onglet « Tous » sans filtre (ignorés compris).
    const rows = all.map((r, i) => toKeywordRow({ id: String(i), ...r }))
    expect(keywordKpis(rows, rows).tracked).toBe(statusCounts(rows).all)
  })
})

describe("requêtes de marque", () => {
  const terms = ["Qonforme", "qonforme.fr"]
  it("repère la marque mot pour mot, sans accents ni casse", () => {
    expect(isBrandQuery("qonforme avis", terms)).toBe(true)
    expect(isBrandQuery("QÖNFORME", terms)).toBe(true)
    expect(isBrandQuery("qonforme.fr connexion", terms)).toBe(true)
    expect(isBrandQuery("logiciel conforme", terms)).toBe(false)
    expect(isBrandQuery("qonformes", ["qonforme"])).toBe(false)
  })
})

describe("synchronisation avec Search Console", () => {
  const rows = [
    { query: "devis modele", clicks: 0, impressions: 45, avg_position: 2.7 },
    { query: "modele devis", clicks: 1, impressions: "44", avg_position: "4.1" },
    { query: `devis d${String.fromCharCode(0x2019)}artisan`, clicks: 1, impressions: 2, avg_position: 10 },
    { query: "devis d'artisan", clicks: 0, impressions: 2, avg_position: 20 },
    { query: "qonforme avis", clicks: 3, impressions: 12, avg_position: 1.2 },
    { query: "rare", clicks: 0, impressions: 2, avg_position: 30 },
  ]

  it("regroupe les requêtes par forme canonique (position pondérée)", () => {
    const agg = aggregateQueries(rows)
    expect(agg.get("devis d'artisan")).toEqual({ keyword: "devis d'artisan", clicks: 1, impressions: 4, position: 15 })
    expect(agg.get("modele devis")?.impressions).toBe(44)
  })

  it("découvre les requêtes d'au moins 3 impressions, hors marque et hors table", () => {
    const agg = aggregateQueries(rows)
    const found = planDiscoveries(agg, new Set(["devis modele"]), { brandTerms: ["Qonforme"], includeBrandQueries: false })
    expect(found.map((q) => q.keyword)).toEqual(["modele devis", "devis d'artisan"])
    const withBrand = planDiscoveries(agg, new Set(["devis modele"]), { brandTerms: ["Qonforme"], includeBrandQueries: true })
    expect(withBrand.map((q) => q.keyword)).toContain("qonforme avis")
  })

  it("ajoute 50 requêtes au plus par passage, les plus vues d'abord", () => {
    const many = Array.from({ length: 80 }, (_, i) => ({ query: `requete ${i}`, clicks: 0, impressions: 3 + i, avg_position: 20 }))
    const found = planDiscoveries(aggregateQueries(many), new Set(), { brandTerms: [], includeBrandQueries: false })
    expect(found).toHaveLength(50)
    expect(found[0].keyword).toBe("requete 79")
  })

  it("un mot-clé absent de Search Console reçoit des mesures nulles, pas 0", () => {
    const agg = aggregateQueries(rows)
    const updates = planMetricUpdates(
      [
        { id: "1", keyword: "devis modele", position: null, impressions: null, clicks: null },
        { id: "2", keyword: "taux de tva travaux", position: 12, impressions: 8, clicks: 1 },
        { id: "3", keyword: "modele devis", position: 4.1, impressions: 44, clicks: 1 },
        { id: "4", keyword: "inconnu", position: null, impressions: null, clicks: null },
      ],
      agg,
    )
    expect(updates).toEqual([
      { id: "1", position: 2.7, impressions: 45, clicks: 0 },
      { id: "2", position: null, impressions: null, clicks: null },
    ])
  })

  const job = (over: Partial<SeoJobRow>): SeoJobRow => ({
    name: "keywords",
    status: "ok",
    started_at: null,
    finished_at: null,
    last_ok_at: null,
    lock_until: null,
    cursor: {},
    result: null,
    error: null,
    ...over,
  })

  it("tourne une fois par jour, après Search Console ou à partir de 10 h", () => {
    const morning = new Date("2026-10-09T06:00:00Z") // 8 h à Paris
    const late = new Date("2026-10-09T08:30:00Z") // 10 h 30 à Paris
    expect(keywordsDue(null, null, morning)).toBe(false)
    expect(keywordsDue(null, job({ name: "search-console", last_ok_at: "2026-10-09T05:40:00Z" }), morning)).toBe(true)
    expect(keywordsDue(null, job({ name: "search-console", last_ok_at: "2026-10-08T05:40:00Z" }), morning)).toBe(false)
    expect(keywordsDue(null, null, late)).toBe(true)
    expect(keywordsDue(job({ last_ok_at: "2026-10-09T08:00:00Z" }), null, late)).toBe(false)
    // Passage interrompu : reprise au passage suivant
    expect(keywordsDue(job({ last_ok_at: "2026-10-09T08:00:00Z", cursor: { incomplete: true } }), null, late)).toBe(true)
  })
})

describe("délai de 30 jours entre deux analyses", () => {
  const base = { status: "ok" as const, started_at: null, finished_at: null, lock_until: null, error: null }

  it("bloque l'analyse 30 jours après un succès (heure de Paris)", () => {
    expect(nextAnalysisDay("2026-10-03T22:30:00Z")).toBe("2026-11-03") // déjà le 4 oct. à Paris → 3 nov.
    expect(nextAnalysisDay("2026-10-03T10:00:00Z")).toBe("2026-11-02")
    const state = analysisState({ ...base, last_ok_at: "2026-10-03T10:00:00Z" }, new Date("2026-10-09T10:00:00Z"))
    expect(state).toEqual({ kind: "cooldown", lastOkAt: "2026-10-03T10:00:00Z", nextDay: "2026-11-02" })
    expect(analysisState({ ...base, last_ok_at: "2026-10-03T10:00:00Z" }, new Date("2026-11-02T08:00:00Z")).kind).toBe("available")
    expect(cooldownMessage("2026-11-02")).toBe(
      `Prochaine recherche de mots-clés à partir du 2${NBSP}novembre${NBSP}2026${NBSP}: réanalyser avant ne trouvera pas de nouveaux mots-clés.`,
    )
    expect(fmtLongDay("2026-11-01")).toBe(`1er${NBSP}novembre${NBSP}2026`)
  })

  it("le jour où le bouton redevient actif, les mots-clés de l'analyse précédente sont à analyser", () => {
    const job = { ...base, last_ok_at: "2026-10-03T13:00:05Z" }
    const now = new Date("2026-11-02T09:00:00Z") // 10 h à Paris, plus tôt que l'heure de l'analyse précédente
    expect(analysisState(job, now).kind).toBe("available")
    expect(needsMetrics({ status: "covered", metrics_checked_at: "2026-10-03T13:00:00Z" }, now)).toBe(true)
    // 1er nov., 23 h 59 à Paris : encore dans le délai, pour le bouton comme pour les mots-clés.
    const eve = new Date("2026-11-01T22:59:00Z")
    expect(analysisState(job, eve).kind).toBe("cooldown")
    expect(needsMetrics({ status: "covered", metrics_checked_at: "2026-10-03T13:00:00Z" }, eve)).toBe(false)
  })

  it("une analyse coupée net (verrou expiré, statut resté « en cours ») est montrée comme échouée et relançable", () => {
    const stale = analysisState(
      { ...base, status: "running", last_ok_at: null, started_at: "2026-10-09T10:00:00Z", lock_until: "2026-10-09T10:01:05Z" },
      new Date("2026-10-09T10:05:00Z"),
    )
    expect(stale).toEqual({ kind: "available", lastOkAt: null, failed: { at: "2026-10-09T10:00:00Z", error: INTERRUPTED_MESSAGE } })
  })

  it("une analyse échouée reste relançable ; une analyse en cours bloque", () => {
    const failed = analysisState({ ...base, status: "error", last_ok_at: null, finished_at: "2026-10-09T10:00:00Z", error: "Solde insuffisant" })
    expect(failed).toEqual({ kind: "available", lastOkAt: null, failed: { at: "2026-10-09T10:00:00Z", error: "Solde insuffisant" } })
    const running = analysisState(
      { ...base, status: "running", last_ok_at: null, started_at: "2026-10-09T10:00:00Z", lock_until: "2026-10-09T10:02:00Z" },
      new Date("2026-10-09T10:00:30Z"),
    )
    expect(running.kind).toBe("running")
    expect(analysisState(null).kind).toBe("available")
  })

  it("interroge les mots-clés non ignorés sans mesures ou mesurés il y a plus de 30 jours", () => {
    const now = new Date("2026-10-09T10:00:00Z")
    expect(needsMetrics({ status: "candidate", metrics_checked_at: null }, now)).toBe(true)
    expect(needsMetrics({ status: "ignored", metrics_checked_at: null }, now)).toBe(false)
    expect(needsMetrics({ status: "covered", metrics_checked_at: "2026-10-01T10:00:00Z" }, now)).toBe(false)
    expect(needsMetrics({ status: "covered", metrics_checked_at: "2026-09-01T10:00:00Z" }, now)).toBe(true)
  })

  it("n'efface pas une valeur connue et ne remplace pas une intention choisie", () => {
    const now = "2026-10-09T10:00:00.000Z"
    expect(metricsPatch({ intent: "informational" }, { volume: 3600, cpc: 1.2, difficulty: null, intent: "commercial" }, now)).toEqual({
      metrics_checked_at: now,
      updated_at: now,
      volume: 3600,
      cpc: 1.2,
      cpc_currency: "USD",
    })
    expect(metricsPatch({ intent: null }, { volume: null, cpc: null, difficulty: 12, intent: "transactional" }, now)).toEqual({
      metrics_checked_at: now,
      updated_at: now,
      difficulty: 12,
      intent: "transactional",
    })
    expect(metricsPatch({ intent: null }, null, now)).toEqual({ metrics_checked_at: now, updated_at: now })
  })
})

describe("provenance des mesures (panneau de détail)", () => {
  const row = (over: Record<string, unknown>) => toKeywordRow({ id: "1", keyword: "devis modele", status: "covered", ...over })

  it("n'attribue jamais à DataForSEO une valeur reprise de PushRank", () => {
    // « devis modele » importé de PushRank : difficulté 3, CPC 3,11 € ; analyse passée sans rien fournir.
    const note = metricsNote(row({ source: "import", difficulty: 3, cpc: 3.11, metrics_checked_at: "2026-10-03T13:00:00Z" }), true)
    expect(note).toBe(
      `Dernière analyse DataForSEO le 3${NBSP}octobre${NBSP}2026 ; CPC repris de PushRank, en euros ; un volume ou une difficulté que DataForSEO n'a pas fournis restent ceux de PushRank.`,
    )
    expect(note).not.toMatch(/DataForSEO, relevé/)
    const measured = metricsNote(row({ source: "search_console", volume: 880, cpc: 1.5, cpc_currency: "USD", metrics_checked_at: "2026-10-03T13:00:00Z" }), true)
    expect(measured).toBe(`Dernière analyse DataForSEO le 3${NBSP}octobre${NBSP}2026 ; CPC en dollars US (Google Ads).`)
  })

  it("dit quand DataForSEO n'est pas configuré, et quand Google Ads refuse la requête", () => {
    expect(metricsNote(row({ source: "manual" }), false)).toBe("Pas encore mesuré : DataForSEO n'est pas configuré (Paramètres › Connexions).")
    expect(metricsNote(row({ source: "manual" }), true)).toMatch(/^Pas encore mesuré : l'analyse des mots-clés/)
    expect(metricsNote(row({ source: "import", volume: 3600 }), true)).toBe("Valeurs reprises de PushRank, en attente d'une analyse.")
    expect(metricsNote(row({ source: "import", volume: 3600 }), false)).toBe(
      "Valeurs reprises de PushRank ; DataForSEO n'est pas configuré (Paramètres › Connexions).",
    )
    expect(metricsNote(row({ keyword: "prix, devis", source: "manual", metrics_checked_at: "2026-10-03T13:00:00Z" }), true)).toMatch(
      /^Google Ads ne mesure pas cette requête.*restent inconnus\.$/,
    )
  })
})

describe("notes enregistrées d'elles-mêmes", () => {
  it("un caractère tapé puis effacé avant l'enregistrement n'est jamais envoyé, même à la fermeture", () => {
    // Notes enregistrées « abc » ; l'admin tape « d » puis l'efface avant 800 ms, puis ferme le panneau.
    expect(notesNeedSave("abcd", "abc")).toBe(true)
    expect(notesNeedSave("abc", "abc")).toBe(false)
    expect(notesStateWhenBackToSaved("pending")).toBe("idle")
    expect(notesToFlush("abc", null, "abc")).toBeNull()
  })

  it("après un échec, revenir à la valeur enregistrée efface l'erreur et n'envoie rien", () => {
    expect(notesStateWhenBackToSaved("error")).toBe("idle")
    expect(notesStateWhenBackToSaved("saving")).toBe("saving")
    expect(notesToFlush("abc", null, "abc")).toBeNull()
  })

  it("revenir à l'ancienne valeur pendant un envoi la renvoie ensuite (ou à la fermeture)", () => {
    // « abcd » en cours d'envoi, saisie revenue à « abc » : à la fermeture, « abc » doit repartir.
    expect(notesToFlush("abc", "abcd", "abc")).toBe("abc")
    // Envoi de « abcd » réussi alors que la saisie vaut « abc » : nouvel envoi.
    expect(notesNeedResend("abc", "abcd")).toBe(true)
    expect(notesNeedResend("abcd", "abcd")).toBe(false)
    // Saisie non enregistrée à la fermeture : elle part.
    expect(notesToFlush("abcde", null, "abc")).toBe("abcde")
    expect(notesToFlush("abcd", "abcd", "abc")).toBeNull()
  })
})

describe("lectures", () => {
  it("variantes d'apostrophe interrogées pour la page qui ressort", () => {
    expect(queryVariants("devis modele")).toEqual(["devis modele"])
    const v = queryVariants("devis d'artisan")
    expect(v[0]).toBe("devis d'artisan")
    expect(v).toContain(`devis d${String.fromCharCode(0x2019)}artisan`)
    expect(v).toContain("devis d`artisan")
  })

  it("lit toutes les pages, et échoue plutôt que de tronquer en silence", async () => {
    const pageOf = (n: number) => Array.from({ length: n }, (_, i) => ({ i }))
    const calls: [number, number][] = []
    const rows = await readAllPages(async (from, to) => (calls.push([from, to]), { data: pageOf(from === 0 ? 1000 : 3), error: null }), "les essais")
    expect(rows).toHaveLength(1003)
    expect(calls).toEqual([[0, 999], [1000, 1999]])
    await expect(readAllPages(async () => ({ data: pageOf(1000), error: null }), "les essais", 2)).rejects.toBeInstanceOf(SeoDbError)
  })

  it("libellé de la page cible", () => {
    expect(pageLabel(null)).toBeNull()
    expect(pageLabel("/")).toEqual({ label: "Accueil", path: "/" })
    expect(pageLabel("/guide/mentions-obligatoires-facture")?.label).toMatch(/^Guide «/)
    expect(pageLabel("/guide/inconnu-xyz")).toEqual({ label: null, path: "/guide/inconnu-xyz" })
    expect(pageLabel("/modele")).toEqual({ label: null, path: "/modele" })
  })
})

describe("saisies", () => {
  it("valide l'ajout d'un mot-clé (page cible du site, statut initial)", () => {
    expect(parseCreateKeyword({ keyword: " Modèle Devis ", target_path: "https://qonforme.fr/modele/" })).toEqual({
      ok: true,
      value: { keyword: "modèle devis", target_path: "/modele", status: "candidate" },
    })
    const badPath = parseCreateKeyword({ keyword: "devis", target_path: "https://exemple.fr/page" })
    expect(badPath.ok === false && badPath.fieldErrors.target_path).toBeTruthy()
    const badStatus = parseCreateKeyword({ keyword: "devis", status: "ignored" })
    expect(badStatus.ok === false && badStatus.fieldErrors.status).toBeTruthy()
    expect(parseCreateKeyword({ keyword: "devis", target_path: "", status: "covered" })).toEqual({
      ok: true,
      value: { keyword: "devis", target_path: null, status: "covered" },
    })
  })

  it("valide la modification (champs connus seulement, au moins un)", () => {
    expect(parsePatchKeyword({ status: "ignored", notes: "  ", intent: "" })).toEqual({
      ok: true,
      value: { status: "ignored", notes: null, intent: null },
    })
    expect(parsePatchKeyword({}).ok).toBe(false)
    expect(parsePatchKeyword({ keyword: "autre" }).ok).toBe(false)
    expect(parsePatchKeyword({ status: "supprimé" }).ok).toBe(false)
    expect(parsePatchKeyword({ intent: "curiosité" }).ok).toBe(false)
    expect(parsePatchKeyword({ notes: "x".repeat(5001) }).ok).toBe(false)
    expect(parsePatchKeyword({ target_path: "/guide/tva-travaux/" })).toEqual({ ok: true, value: { target_path: "/guide/tva-travaux" } })
  })

  it("propose un titre de sujet tiré du mot-clé", () => {
    expect(topicTitleFor("factures mentions obligatoires")).toBe("Factures mentions obligatoires")
    expect(topicTitleFor("étiquette")).toBe("Étiquette")
  })
})

describe("liste filtrée par l'adresse", () => {
  const rows = [
    { id: "1", keyword: "devis modele", status: "covered", intent: "transactional", impressions: 45, target_path: "/modele" },
    { id: "2", keyword: "factures mentions obligatoires", status: "covered", intent: "informational", volume: 3600, difficulty: 12 },
    { id: "3", keyword: "réforme 2027 facturation", status: "candidate" },
    { id: "4", keyword: "ancien", status: "ignored" },
  ].map((r) => toKeywordRow(r))

  it("lit les filtres et les remet dans l'adresse", () => {
    const f = parseKeywordFilters({ statut: "couverts", intention: "informational", q: " Facture ", page: "2", "mot-cle": "abc" })
    expect(f).toEqual({ statut: "covered", intention: "informational", q: "Facture", page: 2, selected: "abc" })
    expect(keywordsHref(f)).toBe("/admin/seo/mots-cles?statut=couverts&intention=informational&q=Facture&page=2&mot-cle=abc")
    expect(parseKeywordFilters({ statut: "n'importe", intention: "x", page: "-3" })).toEqual({
      statut: null,
      intention: null,
      q: "",
      page: 1,
      selected: null,
    })
  })

  it("filtre, compte et trie (gain rapide en tête)", () => {
    expect(statusCounts(rows)).toEqual({ all: 4, candidate: 1, targeted: 0, covered: 2, ignored: 1 })
    const all = keywordPage(rows, parseKeywordFilters({}))
    expect(all.shown.map((k) => k.id)).toEqual(["2", "1", "3", "4"])
    expect(keywordPage(rows, parseKeywordFilters({ q: "reforme" })).shown.map((k) => k.id)).toEqual(["3"])
    expect(keywordPage(rows, parseKeywordFilters({ q: "/modele" })).shown.map((k) => k.id)).toEqual(["1"])
    expect(keywordPage(rows, parseKeywordFilters({ intention: "aucune" })).shown.map((k) => k.id)).toEqual(["3", "4"])
    expect(keywordPage(rows, parseKeywordFilters({ statut: "ignores" })).shown.map((k) => k.id)).toEqual(["4"])
  })

  it("découpe en pages de 15 lignes (ordinateur)", () => {
    expect(PAGE_SIZE).toBe(15)
    const many = Array.from({ length: PAGE_SIZE + 3 }, (_, i) => toKeywordRow({ id: String(i), keyword: `mot ${String(i).padStart(2, "0")}`, status: "candidate" }))
    const p2 = keywordPage(many, parseKeywordFilters({ page: "2" }))
    expect(p2).toMatchObject({ page: 2, pageCount: 2, from: PAGE_SIZE + 1, to: PAGE_SIZE + 3 })
    expect(keywordPage(many, parseKeywordFilters({ page: "9" })).page).toBe(2)
  })

  it("téléphone : 8 mots-clés, puis 8 de plus à chaque « Afficher plus »", () => {
    expect(MOBILE_STEP).toBe(8)
    const many = Array.from({ length: 63 }, (_, i) => toKeywordRow({ id: String(i), keyword: `mot ${String(i).padStart(2, "0")}`, status: "candidate" }))
    const first = keywordPage(many, parseKeywordFilters({}))
    expect(first.mobileRows.map((k) => k.id)).toEqual(["0", "1", "2", "3", "4", "5", "6", "7"])
    expect(first.mobileNextPage).toBe(2)
    expect(first.pageRows).toHaveLength(15)
    // Page 7 : 56 lignes sur téléphone ; le tableau s'arrête à sa dernière page (5) ; les liens gardent la page 7.
    const p7 = keywordPage(many, parseKeywordFilters({ page: "7" }))
    expect(p7).toMatchObject({ page: 5, requestedPage: 7, mobileNextPage: 8 })
    expect(p7.mobileRows).toHaveLength(56)
    const last = keywordPage(many, parseKeywordFilters({ page: "20" }))
    expect(last).toMatchObject({ requestedPage: 8, mobileNextPage: null })
    expect(last.mobileRows).toHaveLength(63)
  })
})
