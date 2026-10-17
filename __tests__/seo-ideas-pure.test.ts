import { afterEach, describe, expect, it, vi } from "vitest"
import { SETTINGS_DEFAULTS } from "@/lib/seo/settings"
import {
  buildIdeasPrompt,
  buildIdeasSystemPrompt,
  clampCount,
  IDEAS_JSON_SCHEMA,
  parseIdeasOutput,
  requestedCandidates,
  SEARCHER_SITUATIONS,
} from "@/lib/seo/ideas/prompt"
import { overlapsOf, scoreIdea, shapeIdea, type ExistingSources } from "@/lib/seo/ideas/rank"
import {
  clearSuggestCache,
  foldPhrase,
  googleSuggest,
  parseSuggestResponse,
  verifyKeyword,
  verifyKeywords,
  type SuggestFn,
} from "@/lib/seo/ideas/autocomplete"
import { IDEA_DEFAULT_COUNT, IDEA_MAX_COUNT, IDEA_SITUATIONS } from "@/lib/seo/ideas/types"

const ctx = { competitors: ["Costructor"], brandTerms: ["qonforme"] }
const raw = (over: Partial<Parameters<typeof shapeIdea>[0]> = {}) => ({
  keyword: "exemple devis maçonnerie",
  title: "Exemple de devis de maçonnerie à copier",
  articleType: "guide",
  stage: "do",
  why: "Veut un modèle chiffré",
  ...over,
})

/* ------------------------------------------------------------------ */
/* Consigne                                                            */
/* ------------------------------------------------------------------ */

describe("Proposition IA · consigne", () => {
  const system = buildIdeasSystemPrompt({ brand: SETTINGS_DEFAULTS.brand, strategy: SETTINGS_DEFAULTS.strategy })

  it("pense comme l'artisan qui cherche et garde les règles d'honnêteté", () => {
    expect(system).toMatch(/phrases EXACTES/)
    expect(system).toMatch(/exemple devis maçonnerie/)
    expect(system).toMatch(/jamais « PDP »/)
    // « gratuit » : la règle commune aux titres et aux idées
    expect(system).toMatch(/gratuit/i)
    // Ce que Qonforme ne fait pas encore ne se promet pas
    expect(system).toMatch(/plateforme agréée/)
    expect(system).toMatch(/contact humain/)
    SEARCHER_SITUATIONS.forEach((s) => expect(system).toContain(s))
  })

  it("mode sujets : demande le double d'idées et liste ce qui est déjà couvert", () => {
    const prompt = buildIdeasPrompt(
      { mode: "topics", count: 8, focus: "relancer un client", trade: "plombier" },
      { keywords: ["devis vierge pdf"], topics: ["Facturer un acompte"], posts: [{ title: "Mentions d'un devis", keyword: "mentions devis" }], queries: [{ query: "relance facture", impressions: 120, position: 14.2 }] },
    )
    expect(prompt).toContain(`proposez ${requestedCandidates(8)} idées`)
    expect(prompt).toContain("ANGLE DEMANDÉ : relancer un client")
    expect(prompt).toContain("MÉTIER : plombier")
    expect(prompt).toContain("DÉJÀ COUVERT")
    expect(prompt).toContain("devis vierge pdf")
    expect(prompt).toContain("Mentions d'un devis [mentions devis]")
    expect(prompt).toContain("relance facture (120 affichages, position 14)")
    expect(prompt).toContain('{"ideas"')
  })

  it("mode article : part du titre et du texte, sans liste de l'existant", () => {
    const prompt = buildIdeasPrompt(
      { mode: "article", article: { title: "Comment faire un devis de peinture", content: "Texte <b>important</b>", keyword: "devis peinture", articleType: "howto" } },
      { keywords: ["a"], topics: ["b"], posts: [], queries: [] },
    )
    expect(prompt).toContain("CET ARTICLE")
    expect(prompt).toContain("Titre de l'article : Comment faire un devis de peinture")
    expect(prompt).toContain("« devis peinture »")
    expect(prompt).toContain("Type de l'article : howto")
    // Les chevrons du texte ne sortent pas du bloc délimité
    expect(prompt).not.toContain("<b>")
    expect(prompt).not.toContain("DÉJÀ COUVERT")
    expect(prompt).toContain("ARTICLE (extrait)")
  })

  it("un article sans texte s'appuie sur le titre", () => {
    const prompt = buildIdeasPrompt({ mode: "article", article: { title: "Relancer une facture", content: "  " } }, { keywords: [], topics: [], posts: [], queries: [] })
    expect(prompt).toContain("texte pas encore écrit")
  })

  it("borne le nombre d'idées", () => {
    expect(clampCount(undefined)).toBe(IDEA_DEFAULT_COUNT)
    expect(clampCount(1)).toBe(3)
    expect(clampCount(500)).toBe(IDEA_MAX_COUNT)
    expect(clampCount(Number.NaN)).toBe(IDEA_DEFAULT_COUNT)
    expect(requestedCandidates(3)).toBe(6)
    expect(requestedCandidates(15)).toBe(30)
  })

  it("le schéma de réponse exige les cinq champs", () => {
    const item = (IDEAS_JSON_SCHEMA.properties as Record<string, { items: { required: string[] } }>).ideas.items
    expect(item.required).toEqual(["keyword", "title", "articleType", "stage", "why"])
  })

  it("lit la réponse du modèle : JSON, bloc de code, texte autour", () => {
    const json = '{"ideas":[{"keyword":"a b","title":"T","articleType":"howto","stage":"do","why":"w"},{"keyword":42},"x",null]}'
    expect(parseIdeasOutput(json)).toHaveLength(2)
    expect(parseIdeasOutput("```json\n" + json + "\n```")).toHaveLength(2)
    expect(parseIdeasOutput("Voici : " + json + " Fin.")).toHaveLength(2)
    expect(parseIdeasOutput("pas du json")).toEqual([])
    expect(parseIdeasOutput('{"ideas":"non"}')).toEqual([])
    // Un champ du mauvais type devient vide, jamais une exception
    expect(parseIdeasOutput(json)[1]).toEqual({ keyword: "", title: "", articleType: "", stage: "", why: "" })
  })

  it("les situations de la fenêtre ont chacune un libellé et un angle", () => {
    expect(IDEA_SITUATIONS.length).toBeGreaterThanOrEqual(5)
    IDEA_SITUATIONS.forEach((s) => {
      expect(s.label.length).toBeGreaterThan(3)
      expect(s.focus.length).toBeLessThanOrEqual(300)
    })
    expect(new Set(IDEA_SITUATIONS.map((s) => s.id)).size).toBe(IDEA_SITUATIONS.length)
  })
})

/* ------------------------------------------------------------------ */
/* Contrôle d'une idée                                                 */
/* ------------------------------------------------------------------ */

describe("Proposition IA · contrôle d'une idée", () => {
  it("garde une requête propre et la met en forme canonique", () => {
    const res = shapeIdea(raw({ keyword: "  Exemple   DEVIS Maçonnerie " }), ctx)
    expect(res.ok).toBe(true)
    if (res.ok) {
      expect(res.idea.keyword).toBe("exemple devis maçonnerie")
      expect(res.idea.articleType).toBe("guide")
      expect(res.idea.stage).toBe("do")
      expect(res.idea.why).toBe("Veut un modèle chiffré")
    }
  })

  it("rétablit les accents : le site s'écrit avec, Google rapproche les deux formes", () => {
    const res = shapeIdea(raw({ keyword: "logiciel devis facture batiment" }), ctx)
    expect(res.ok).toBe(true)
    if (res.ok) expect(res.idea.keyword).toBe("logiciel devis facture bâtiment")
  })

  it("refuse un concurrent, la marque, une adresse web, une forme impossible", () => {
    expect(shapeIdea(raw({ keyword: "alternative costructor devis" }), ctx)).toEqual({ ok: false, reason: "concurrent" })
    expect(shapeIdea(raw({ keyword: "qonforme avis" }), ctx)).toEqual({ ok: false, reason: "marque" })
    expect(shapeIdea(raw({ keyword: "https://exemple.fr/devis" }), ctx)).toEqual({ ok: false, reason: "adresse" })
    expect(shapeIdea(raw({ keyword: "devis" }), ctx)).toEqual({ ok: false, reason: "forme" })
    expect(shapeIdea(raw({ keyword: "un deux trois quatre cinq six sept huit neuf dix" }), ctx)).toEqual({ ok: false, reason: "forme" })
    expect(shapeIdea(raw({ keyword: "devis <script> maçon" }), ctx)).toEqual({ ok: false, reason: "forme" })
    expect(shapeIdea(raw({ keyword: "" }), ctx)).toEqual({ ok: false, reason: "vide" })
  })

  it("refuse un concurrent nommé dans le titre de repli ou la valeur périmée", () => {
    // Titre qui nomme un concurrent : remplacé par la requête, jamais gardé
    const res = shapeIdea(raw({ title: "Mieux que Costructor : le devis maçon" }), ctx)
    expect(res.ok).toBe(true)
    if (res.ok) {
      expect(res.idea.title).not.toMatch(/costructor/i)
      expect(res.idea.title).toBe("Exemple devis maçonnerie")
    }
    // Valeur périmée repérée par la vérification des articles
    expect(shapeIdea(raw({ keyword: "devis obligatoire à partir de 150 €" }), ctx)).toEqual({ ok: false, reason: "affirmation" })
  })

  it("« PDP » reste une recherche réelle : elle n'est pas refusée", () => {
    const res = shapeIdea(raw({ keyword: "pdp facture électronique", title: "Plateforme agréée : ce qui change" }), ctx)
    expect(res.ok).toBe(true)
  })

  it("type et moment invalides sont déduits de la requête", () => {
    const howto = shapeIdea(raw({ keyword: "comment faire un devis maçon", articleType: "autre", stage: "jamais" }), ctx)
    expect(howto.ok && howto.idea.articleType).toBe("howto")
    expect(howto.ok && howto.idea.stage).toBe("do")
    const buy = shapeIdea(raw({ keyword: "logiciel devis maçon gratuit", articleType: "", stage: "" }), ctx)
    expect(buy.ok && buy.idea.stage).toBe("buy")
  })

  it("avertit quand « gratuit » viserait la facturation Qonforme", () => {
    const res = shapeIdea(raw({ keyword: "logiciel facturation gratuit artisan" }), ctx)
    expect(res.ok).toBe(true)
    if (res.ok) expect(res.idea.warnings.join(" ")).toMatch(/seuls les devis/)
    const free = shapeIdea(raw({ keyword: "modèle devis gratuit maçon" }), ctx)
    expect(free.ok && free.idea.warnings.filter((w) => /seuls les devis/.test(w))).toEqual([])
  })

  it("avertit quand la requête et le type d'article ne vont pas ensemble", () => {
    // Recherche d'achat de logiciel posée sur un « comment faire »
    const res = shapeIdea(raw({ keyword: "logiciel devis maçon", articleType: "howto" }), ctx)
    expect(res.ok).toBe(true)
    if (res.ok) expect(res.idea.warnings.join(" ")).toMatch(/Recherche d'achat de logiciel sur un « comment faire »/)
    const guide = shapeIdea(raw({ keyword: "logiciel devis maçon", articleType: "guide" }), ctx)
    expect(guide.ok && guide.idea.warnings).toEqual([])
    const fine = shapeIdea(raw({ keyword: "comment faire un devis maçon", articleType: "howto" }), ctx)
    expect(fine.ok && fine.idea.warnings).toEqual([])
  })

  it("retire les chevrons de l'explication et la borne", () => {
    const res = shapeIdea(raw({ why: `<b>${"x".repeat(400)}</b>` }), ctx)
    expect(res.ok && res.idea.why.length).toBeLessThanOrEqual(220)
    expect(res.ok && res.idea.why).not.toMatch(/[<>]/)
    expect(shapeIdea(raw({ why: "  " }), ctx).ok && true).toBe(true)
    const empty = shapeIdea(raw({ why: "" }), ctx)
    expect(empty.ok && empty.idea.why).toBe("—")
  })
})

/* ------------------------------------------------------------------ */
/* Rapprochement et score                                              */
/* ------------------------------------------------------------------ */

const sources = (over: Partial<ExistingSources> = {}): ExistingSources => ({ posts: [], topics: [], tracked: new Map(), ranking: new Map(), ...over })

describe("Proposition IA · rapprochement avec l'existant", () => {
  it("repère l'article, le sujet, le mot-clé suivi et la page déjà bien placée", () => {
    const keyword = "exemple devis maçonnerie"
    const found = overlapsOf(
      keyword,
      sources({
        posts: [
          { title: "Autre", slug: "a", target_keyword: "Exemple devis maçonnerie" },
          { title: "Un exemple devis maçonnerie complet", slug: "b" },
          { title: "Sans rapport", slug: "c" },
        ],
        topics: [
          { title: "Sujet un", keyword: "exemple devis maçonnerie" },
          { title: "Exemple devis maçonnerie à écrire", keyword: null },
        ],
        tracked: new Map([[keyword, { keyword, status: "targeted", target_path: "/modele/devis-maconnerie" }]]),
        ranking: new Map([[keyword, { impressions: 80, position: 9.4 }]]),
      }),
    )
    expect(found.tracked).toBe(true)
    expect(found.overlaps.map((o) => o.kind).sort()).toEqual(["article", "article", "keyword", "ranking", "topic", "topic"])
    expect(found.overlaps.find((o) => o.kind === "article")?.path).toBe("/blog/a")
    expect(found.overlaps.find((o) => o.kind === "keyword")?.detail).toBe("Page cible : /modele/devis-maconnerie")
    expect(found.overlaps.find((o) => o.kind === "ranking")?.label).toMatch(/position 9,4/)
  })

  it("une requête peu vue ou mal placée n'est pas une concurrence", () => {
    const keyword = "relance facture impayée mail"
    const few = overlapsOf(keyword, sources({ ranking: new Map([[keyword, { impressions: 5, position: 3 }]]) }))
    expect(few.overlaps).toEqual([])
    expect(few.ranking).toEqual({ impressions: 5, position: 3 })
    const far = overlapsOf(keyword, sources({ ranking: new Map([[keyword, { impressions: 500, position: 40 }]]) }))
    expect(far.overlaps).toEqual([])
    expect(overlapsOf(keyword, sources()).tracked).toBe(false)
  })

  it("score : vérifiée, volume, facilité et moment montent ; les doublons font descendre", () => {
    const base = { verified: false, volume: null, difficulty: null, stage: "learn" as const, overlaps: [], warnings: [] }
    expect(scoreIdea(base)).toBe(6)
    const strong = scoreIdea({ ...base, verified: true, volume: 1000, difficulty: 10, stage: "do" })
    expect(strong).toBe(35 + 30 + 15 + 12)
    expect(scoreIdea({ ...base, verified: true, volume: 10, difficulty: 45, stage: "buy" })).toBe(35 + 10 + 8 + 12)
    const dup = scoreIdea({ ...base, verified: true, stage: "do", overlaps: [{ kind: "article", label: "x" }] })
    expect(dup).toBe(35 + 12 - 30)
    expect(scoreIdea({ ...base, overlaps: [{ kind: "article", label: "x" }, { kind: "topic", label: "y" }, { kind: "ranking", label: "z" }] })).toBe(0)
    expect(scoreIdea({ ...base, verified: true, stage: "do", warnings: ["a", "b"] })).toBe(35 + 12 - 10)
    expect(scoreIdea({ ...base, verified: true, volume: 10_000_000, difficulty: 1, stage: "do" })).toBeLessThanOrEqual(100)
  })
})

/* ------------------------------------------------------------------ */
/* Saisie semi-automatique de Google                                   */
/* ------------------------------------------------------------------ */

describe("Proposition IA · saisie semi-automatique de Google", () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    clearSuggestCache()
  })

  it("compare sans accents, sans casse, apostrophes unifiées", () => {
    expect(foldPhrase("  Devis  d’Électricien ")).toBe("devis d'electricien")
    expect(parseSuggestResponse(["q", ["a ", "", 3, "b"]])).toEqual(["a", "b"])
    expect(parseSuggestResponse({})).toBeNull()
    expect(parseSuggestResponse(["q", "pas une liste"])).toBeNull()
  })

  it("une phrase que Google propose existe ; ses prolongations sont gardées", async () => {
    const suggest: SuggestFn = async () => ["exemple devis maçonnerie", "exemple devis maçonnerie pdf", "exemple devis maçonnerie gratuit", "exemple devis plomberie", "exemple devis maçonnerie word", "exemple devis maçonnerie excel"]
    const res = await verifyKeyword("exemple devis maçonnerie", suggest)
    expect(res).toEqual({ verified: true, also: ["exemple devis maçonnerie pdf", "exemple devis maçonnerie gratuit", "exemple devis maçonnerie word"], reached: true })
  })

  it("sans réponse directe, essaie la phrase privée de son dernier mot", async () => {
    const asked: string[] = []
    const suggest: SuggestFn = async (q) => {
      asked.push(q)
      return q === "comment facturer un" ? ["comment facturer un acompte"] : []
    }
    const res = await verifyKeyword("comment facturer un acompte", suggest)
    expect(asked).toEqual(["comment facturer un acompte", "comment facturer un"])
    expect(res.verified).toBe(true)
    // Deux mots seulement : pas de second essai
    const short: string[] = []
    await verifyKeyword("devis vierge", async (q) => (short.push(q), []))
    expect(short).toEqual(["devis vierge"])
  })

  it("Google injoignable : non vérifié, jamais une erreur", async () => {
    expect(await verifyKeyword("exemple devis", async () => null)).toEqual({ verified: false, also: [], reached: false })
  })

  it("plusieurs phrases : état ok, partiel ou indisponible", async () => {
    const all = await verifyKeywords(["a b", "c d"], { suggest: async (q) => [q] })
    expect(all.state).toBe("ok")
    expect(all.results.get("a b")?.verified).toBe(true)
    const none = await verifyKeywords(["a b", "c d"], { suggest: async () => null })
    expect(none.state).toBe("unavailable")
    const partial = await verifyKeywords(["a b", "c d"], { suggest: async (q) => (q === "a b" ? ["a b"] : null), concurrency: 1 })
    expect(partial.state).toBe("partial")
    expect((await verifyKeywords([], {})).state).toBe("ok")
  })

  it("s'arrête à l'heure limite : les phrases non atteintes restent non vérifiées", async () => {
    const out = await verifyKeywords(["a b", "c d", "e f"], { suggest: async (q) => [q], deadline: Date.now() - 1 })
    expect(out.results.size).toBe(0)
    expect(out.state).toBe("unavailable")
  })

  it("interroge Google en français, garde la réponse 6 heures et rend null en cas de panne", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify(["devis", ["devis maçon", "devis plombier"]]), { status: 200 }))
    vi.stubGlobal("fetch", fetchMock)
    expect(await googleSuggest("devis")).toEqual(["devis maçon", "devis plombier"])
    expect(await googleSuggest("DEVIS ")).toEqual(["devis maçon", "devis plombier"])
    expect(fetchMock).toHaveBeenCalledTimes(1)
    const url = String((fetchMock.mock.calls[0] as unknown[])[0])
    expect(url).toContain("client=firefox")
    expect(url).toContain("hl=fr")
    expect(url).toContain("gl=fr")
    expect(url).toContain("q=devis")

    clearSuggestCache()
    vi.stubGlobal("fetch", vi.fn(async () => new Response("", { status: 429 })))
    expect(await googleSuggest("devis")).toBeNull()
    vi.stubGlobal("fetch", vi.fn(async () => new Response("<html>", { status: 200 })))
    expect(await googleSuggest("devis")).toBeNull()
    vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("réseau") }))
    expect(await googleSuggest("devis")).toBeNull()
    expect(await googleSuggest("   ")).toEqual([])
  })
})
