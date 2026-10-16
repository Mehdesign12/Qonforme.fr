import { describe, expect, it } from "vitest"
import {
  editorKeywordOf,
  sameFamily,
  keywordKey,
  mergePlanKeywords,
  planEditorKeyword,
  planImportChanges,
  planMissing,
  secondaryCandidates,
  significantWords,
  SECONDARY_LIMIT,
} from "@/lib/seo/articles/secondary"
import { PLAN_KEYWORDS, PLAN_NOTE } from "@/lib/seo/keywords/plan"
import type { KeywordRow } from "@/lib/seo/keywords/types"
import type { EditorKeyword, PageQuery } from "@/lib/seo/articles/editor-types"

function kw(keyword: string, over: Partial<EditorKeyword> = {}): EditorKeyword {
  return {
    id: `id-${keyword}`,
    keyword,
    status: "candidate",
    intent: null,
    volume: null,
    difficulty: null,
    position: null,
    clicks: null,
    impressions: null,
    targetPath: null,
    fromPlan: false,
    ...over,
  }
}

function row(keyword: string, over: Partial<KeywordRow> = {}): KeywordRow {
  return {
    id: `row-${keyword}`,
    keyword,
    status: "candidate",
    intent: null,
    source: "search_console",
    target_path: null,
    notes: null,
    volume: null,
    difficulty: null,
    cpc: null,
    cpc_currency: null,
    metrics_checked_at: null,
    position: null,
    impressions: null,
    clicks: null,
    gsc_updated_at: null,
    created_at: "2026-10-01T00:00:00Z",
    updated_at: "2026-10-01T00:00:00Z",
    ...over,
  }
}

const q = (query: string, impressions: number, clicks = 0): PageQuery => ({ query, impressions, clicks, position: 12 })

describe("conversions", () => {
  it("ligne de seo_keywords → mot-clé de l'éditeur", () => {
    const e = editorKeywordOf(row("devis placo", { status: "targeted", volume: 110, difficulty: 12, position: 8.4, target_path: "/modele/devis-placo" }))
    expect(e).toEqual({
      id: "row-devis placo",
      keyword: "devis placo",
      status: "targeted",
      intent: null,
      volume: 110,
      difficulty: 12,
      position: 8.4,
      clicks: null,
      impressions: null,
      targetPath: "/modele/devis-placo",
      fromPlan: false,
    })
  })

  it("mot-clé du plan pas encore suivi", () => {
    const e = planEditorKeyword(PLAN_KEYWORDS[0])
    expect(e).toMatchObject({ id: null, status: null, keyword: PLAN_KEYWORDS[0].keyword, volume: PLAN_KEYWORDS[0].volume, fromPlan: true })
  })

  it("famille de mots : cinq premières lettres communes", () => {
    expect(sameFamily("macon", "maconnerie")).toBe(true)
    expect(sameFamily("plombier", "plomberie")).toBe(true)
    expect(sameFamily("electricien", "electricite")).toBe(true)
    expect(sameFamily("pose", "poser")).toBe(false)
    expect(sameFamily("placo", "plaquiste")).toBe(false)
  })

  it("mots significatifs : sans accents, singulier, sans mots vides", () => {
    expect(significantWords("Les devis des maçons pour l'électricité")).toEqual(["devis", "macon", "electricite"])
  })
})

describe("mergePlanKeywords", () => {
  it("ajoute les absents, marque les présents (comparaison sans accents), complète volume et page", () => {
    const rows = [
      kw("logiciel devis facture batiment", { volume: null, targetPath: null }),
      kw("exemple devis paysagiste", { volume: 500, targetPath: "/autre-page" }),
      kw("devis carrelage"),
    ]
    const plan = PLAN_KEYWORDS.filter((p) => ["logiciel devis facture bâtiment", "exemple devis paysagiste", "devis vierge pdf"].includes(p.keyword))
    const merged = mergePlanKeywords(rows, plan)
    expect(merged).toHaveLength(4)
    expect(merged[0]).toMatchObject({ keyword: "logiciel devis facture batiment", fromPlan: true, volume: 880, targetPath: "/" })
    // Les mesures de l'onglet Mots-clés priment
    expect(merged[1]).toMatchObject({ fromPlan: true, volume: 500, targetPath: "/autre-page" })
    expect(merged[2]).toMatchObject({ keyword: "devis carrelage", fromPlan: false })
    expect(merged[3]).toMatchObject({ keyword: "devis vierge pdf", id: null, fromPlan: true, volume: 170 })
    // Pas de modification de l'entrée
    expect(rows[0].fromPlan).toBe(false)
  })

  it("plan complet par défaut", () => {
    expect(mergePlanKeywords([])).toHaveLength(PLAN_KEYWORDS.length)
  })
})

describe("secondaryCandidates", () => {
  it("sans mot-clé principal : rien", () => {
    expect(secondaryCandidates(null, [kw("devis placo")], [])).toEqual([])
    expect(secondaryCandidates("  ", [kw("devis placo")], [])).toEqual([])
  })

  it("au moins un mot significatif partagé (accents, casse et pluriel près), sans le principal", () => {
    const list = [
      kw("Exemple devis maçonnerie", { volume: 170 }),
      kw("devis macon", { volume: 90 }),
      kw("prix mur en parpaing", { volume: 400 }),
      kw("maçons auto-entrepreneurs", { volume: 30 }),
    ]
    const out = secondaryCandidates("devis maçon", list, [])
    // « maçonnerie » est de la famille de « maçon » ; « prix mur en parpaing » ne partage aucun mot
    expect(out.map((c) => c.keyword)).toEqual(["exemple devis maçonnerie", "maçons auto-entrepreneurs"])
  })

  it("mot distinctif obligatoire : un mot courant du site (« devis », « exemple ») ne suffit pas ; tri par volume puis impressions", () => {
    const list = [
      kw("logiciel devis facture bâtiment", { volume: 880, fromPlan: true }),
      kw("prix paysagiste", { volume: 90 }),
      kw("devis paysagiste gratuit", { volume: 90, impressions: 40 }),
      kw("tarif paysagiste", { volume: 210 }),
      kw("exemple devis placo", { volume: 110, fromPlan: true }),
      kw("devis vierge pdf", { volume: 170 }),
    ]
    const out = secondaryCandidates("exemple devis paysagiste", list, [])
    expect(out.map((c) => c.keyword)).toEqual(["tarif paysagiste", "devis paysagiste gratuit", "prix paysagiste"])
  })

  it("principal fait de mots courants : deux mots partagés au moins", () => {
    const list = [kw("devis vierge pdf", { volume: 170 }), kw("logiciel devis bâtiment gratuit", { volume: 90 }), kw("logiciel plombier", { volume: 260 })]
    const out = secondaryCandidates("logiciel devis artisan", list, [])
    expect(out.map((c) => c.keyword)).toEqual(["logiciel devis bâtiment gratuit"])
  })

  it("requêtes de la page : 3 impressions au moins, toujours retenues, fusionnées avec les mots-clés", () => {
    const list = [kw("devis placo", { volume: 110 }), kw("devis vierge pdf", { volume: 170 })]
    const queries = [q("prix pose placo m2", 12), q("devis placo", 25), q("plaquiste tarif", 2), q("exemple devis placo", 50)]
    const out = secondaryCandidates("exemple devis placo", list, queries)
    expect(out).toEqual([
      { keyword: "devis placo", volume: 110, impressions: 25, fromPlan: false, fromPage: true },
      { keyword: "prix pose placo m2", volume: null, impressions: 12, fromPlan: false, fromPage: true },
    ])
  })

  it("dédoublonnage sans accents et limite de 10", () => {
    const list = [kw("devis maçon", { volume: 50 }), kw("devis macon", { volume: 60 })]
    const out = secondaryCandidates("maçonnerie devis", list, [])
    expect(out).toHaveLength(1)
    const many = Array.from({ length: 15 }, (_, i) => kw(`devis placo ${i}`, { volume: i }))
    expect(secondaryCandidates("placo", many, [])).toHaveLength(SECONDARY_LIMIT)
  })
})

describe("plan mots-clés : import", () => {
  it("mots-clés du plan pas encore suivis (sans accents ; un ignoré est suivi)", () => {
    const tracked = [row("logiciel devis facture batiment", { status: "ignored" }), row("exemple devis paysagiste")]
    const missing = planMissing(tracked)
    expect(missing).toHaveLength(PLAN_KEYWORDS.length - 2)
    expect(missing.some((p) => keywordKey(p.keyword) === keywordKey("logiciel devis facture bâtiment"))).toBe(false)
  })

  it("ajoute les absents en « Ciblé », complète les existants sans toucher au statut", () => {
    const tracked = [
      row("logiciel devis facture batiment", { status: "ignored", volume: null, target_path: null, intent: null }),
      row("exemple devis paysagiste", { status: "covered", volume: 400, target_path: "/x", intent: "informational" }),
    ]
    const changes = planImportChanges(tracked, PLAN_NOTE)
    expect(changes.inserts).toHaveLength(PLAN_KEYWORDS.length - 2)
    expect(changes.inserts[0]).toEqual({
      keyword: "exemple devis auto entrepreneur",
      status: "targeted",
      source: "import",
      intent: "informational",
      volume: 480,
      target_path: "/modele/devis-auto-entrepreneur",
      notes: PLAN_NOTE,
    })
    expect(changes.updates).toEqual([{ id: "row-logiciel devis facture batiment", values: { volume: 880, target_path: "/", intent: "commercial" } }])
  })

  it("rejouable : rien à faire une fois le plan suivi", () => {
    const tracked = PLAN_KEYWORDS.map((p) => row(p.keyword, { volume: p.volume, target_path: p.targetPath, intent: p.intent }))
    expect(planImportChanges(tracked, PLAN_NOTE)).toEqual({ inserts: [], updates: [] })
  })
})
