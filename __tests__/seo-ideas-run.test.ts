import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { NextRequest } from "next/server"
import { fakeArticlesDb, type FakeArticlesDb, type Row } from "./seo-articles-fake-db"
import { generateIdeas } from "@/lib/seo/ideas/run"
import { adoptIdea, AdoptError } from "@/lib/seo/ideas/adopt"
import { POST as ideasRoute } from "@/app/api/admin/seo/ideas/route"
import { POST as adoptRoute } from "@/app/api/admin/seo/ideas/adopt/route"
import { ModelError, type GenerateTextInput } from "@/lib/seo/articles/models"
import { DataForSeoError, type KeywordMetrics } from "@/lib/seo/keywords/dataforseo"
import type { AdoptedIdea } from "@/lib/seo/ideas/types"

/* ------------------------------------------------------------------ */
/* Modules simulés                                                     */
/* ------------------------------------------------------------------ */

const gsc = vi.hoisted(() => ({ rows: [] as { query: string; impressions: number; avg_position: number | null }[], fail: false }))
let db: FakeArticlesDb
let admin = true

vi.mock("@/lib/supabase/server", () => ({ createClient: async () => db.client, createAdminClient: () => db.client }))
vi.mock("@/lib/admin-require", () => ({ isAdminAuthenticated: async () => admin }))
vi.mock("@/lib/seo/keywords/data", async (importOriginal) => {
  const real = await importOriginal<typeof import("@/lib/seo/keywords/data")>()
  return {
    ...real,
    gscBounds: async () => {
      if (gsc.fail) throw new Error("Search Console injoignable")
      return { first: "2026-01-01", last: "2026-10-15" }
    },
    gscQueries: async () => gsc.rows,
  }
})

const NOW = new Date("2026-10-17T10:00:00Z")
const COMPETITOR = "costructor.com"

const settingsRow = (key: string, value: Record<string, unknown>): Row => ({ key, value, updated_at: "2026-10-01T00:00:00Z" })

function seed(extra: Record<string, Row[]> = {}) {
  db = fakeArticlesDb({
    seo_settings: [settingsRow("targeting", { competitors: [COMPETITOR], brandTerms: ["qonforme"] })],
    seo_keywords: [],
    seo_topics: [],
    blog_posts: [],
    ...extra,
  })
}

const idea = (keyword: string, over: Record<string, unknown> = {}) => ({
  keyword,
  title: `Titre : ${keyword}`,
  articleType: "guide",
  stage: "do",
  why: "Veut agir",
  ...over,
})

const completion = (ideas: unknown[], over: Record<string, unknown> = {}) => ({
  text: JSON.stringify({ ideas }),
  model: "claude-sonnet-5-5",
  usage: { inputTokens: 100, outputTokens: 100 },
  ...over,
})

const metricsOf = (entries: Record<string, Partial<KeywordMetrics>>) =>
  new Map(Object.entries(entries).map(([k, v]) => [k, { volume: null, cpc: null, difficulty: null, intent: null, ...v } as KeywordMetrics]))

beforeEach(() => {
  seed()
  admin = true
  gsc.rows = []
  gsc.fail = false
  vi.stubEnv("ANTHROPIC_API_KEY", "test")
  vi.stubEnv("GEMINI_API_KEY", "test")
})

afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

/* ------------------------------------------------------------------ */
/* Moteur                                                              */
/* ------------------------------------------------------------------ */

describe("Proposition IA · moteur", () => {
  it("contrôle, vérifie, mesure puis classe les idées", async () => {
    seed({ blog_posts: [{ id: "p1", title: "Mentions d'un devis", slug: "mentions-devis", target_keyword: "devis vierge pdf" }] })
    const complete = vi.fn(async (_input: GenerateTextInput) =>
      completion([
        idea("exemple devis maçonnerie"),
        idea("devis vierge pdf"),
        idea("alternative costructor devis"),
        idea("exemple devis maçonnerie"),
        idea("relance facture impayée mail", { stage: "learn" }),
      ]),
    )
    const out = await generateIdeas(
      db.client as never,
      { mode: "topics", count: 5 },
      {
        now: NOW,
        complete,
        suggest: async (q) => (q.startsWith("exemple devis") || q.startsWith("devis vierge") ? [q, `${q} gratuit`] : []),
        metrics: async () => metricsOf({ "exemple devis maçonnerie": { volume: 170, difficulty: 12, cpc: 1.2, intent: "informational" }, "devis vierge pdf": { volume: 170, difficulty: 20 } }),
      },
    )

    // Concurrent écarté, doublon unique
    expect(out.ideas.map((i) => i.keyword).sort()).toEqual(["devis vierge pdf", "exemple devis maçonnerie", "relance facture impayée mail"])
    expect(out.notes.join(" ")).toMatch(/1 proposition écartée/)

    const best = out.ideas[0]
    expect(best.keyword).toBe("exemple devis maçonnerie")
    expect(best).toMatchObject({ verified: true, volume: 170, difficulty: 12, cpc: 1.2, intent: "informational", tracked: false })
    expect(best.googleAlso).toEqual(["exemple devis maçonnerie gratuit"])

    // Un article vise déjà « devis vierge pdf » : doublon signalé et score abaissé
    const dup = out.ideas.find((i) => i.keyword === "devis vierge pdf")!
    expect(dup.overlaps.map((o) => o.kind)).toEqual(["article"])
    expect(dup.score).toBeLessThan(best.score)

    // Pas vérifiée dans Google ni mesurée : montrée telle quelle
    const raw = out.ideas.find((i) => i.keyword === "relance facture impayée mail")!
    expect(raw).toMatchObject({ verified: false, volume: null })
    expect(out.autocomplete).toBe("ok")
    expect(out.metrics).toBe("ok")
    expect(out.model).toBe("Claude Sonnet 5.5")
    expect(complete).toHaveBeenCalledTimes(1)
  })

  it("la consigne ne contient jamais un concurrent, même dans l'existant", async () => {
    seed({
      seo_keywords: [
        { id: "k1", keyword: "devis vierge pdf", status: "targeted", target_path: null },
        { id: "k2", keyword: "avis costructor", status: "candidate", target_path: null },
      ],
      seo_topics: [
        { id: "t1", title: "Comparer Costructor et Qonforme", keyword: null, status: "unplanned" },
        { id: "t2", title: "Facturer un acompte", keyword: null, status: "unplanned" },
      ],
      blog_posts: [{ id: "p1", title: "Costructor ou un autre logiciel", slug: "x", target_keyword: null }],
    })
    gsc.rows = [
      { query: "costructor tarif", impressions: 300, avg_position: 8 },
      { query: "qonforme avis", impressions: 200, avg_position: 3 },
      { query: "relance facture", impressions: 150, avg_position: 14 },
    ]
    let seen: GenerateTextInput | null = null
    await generateIdeas(
      db.client as never,
      { mode: "topics", focus: "me faire payer" },
      {
        now: NOW,
        complete: async (input) => ((seen = input), completion([idea("exemple devis plomberie")])),
        suggest: async () => [],
        metrics: null,
      },
    )
    const text = `${seen!.system}\n${seen!.prompt}`
    expect(text).not.toMatch(/costructor/i)
    // La requête de marque n'est pas un sujet, le reste est transmis
    expect(text).not.toContain("qonforme avis")
    expect(text).toContain("devis vierge pdf")
    expect(text).toContain("Facturer un acompte")
    expect(text).toContain("relance facture (150 affichages, position 14)")
    expect(seen!.json).toBeTruthy()
  })

  it("une requête déjà bien placée dans Google est signalée", async () => {
    gsc.rows = [{ query: "relance facture impayée mail", impressions: 90, avg_position: 7.2 }]
    const out = await generateIdeas(db.client as never, { mode: "topics" }, { now: NOW, complete: async () => completion([idea("relance facture impayée mail")]), suggest: async (q) => [q], metrics: null })
    expect(out.ideas[0].ranking).toEqual({ impressions: 90, position: 7.2 })
    expect(out.ideas[0].overlaps.map((o) => o.kind)).toEqual(["ranking"])
  })

  it("DataForSEO non configuré, en panne ou sans réponse : l'idée reste proposée, la remarque l'explique", async () => {
    const run = (metrics: Parameters<typeof generateIdeas>[2] extends infer D ? (D extends { metrics?: infer M } ? M : never) : never) =>
      generateIdeas(db.client as never, { mode: "topics" }, { now: NOW, complete: async () => completion([idea("exemple devis peinture")]), suggest: async (q) => [q], metrics })

    const none = await run(null)
    expect(none.metrics).toBe("not_configured")
    expect(none.notes.join(" ")).toMatch(/Aucune source de mesures/)

    const down = await run(async () => {
      throw new DataForSeoError("DataForSEO est injoignable pour le moment.")
    })
    expect(down.metrics).toBe("unavailable")
    expect(down.notes).toContain("DataForSEO est injoignable pour le moment.")
    expect(down.ideas).toHaveLength(1)
    expect(down.ideas[0].volume).toBeNull()

    const odd = await run(async () => {
      throw new Error("boom")
    })
    expect(odd.notes.join(" ")).toMatch(/Les mesures n'ont pas répondu/)
  })

  it("Google injoignable : phrases non vérifiées et remarque", async () => {
    const out = await generateIdeas(db.client as never, { mode: "topics" }, { now: NOW, complete: async () => completion([idea("exemple devis peinture")]), suggest: async () => null, metrics: null })
    expect(out.autocomplete).toBe("unavailable")
    expect(out.ideas[0].verified).toBe(false)
    expect(out.notes.join(" ")).toMatch(/saisie semi-automatique de Google n'a pas répondu/)
  })

  it("Search Console injoignable : la proposition se fait quand même", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {})
    gsc.fail = true
    const out = await generateIdeas(db.client as never, { mode: "topics" }, { now: NOW, complete: async () => completion([idea("exemple devis peinture")]), suggest: async (q) => [q], metrics: null })
    expect(out.ideas).toHaveLength(1)
    expect(out.notes.join(" ")).toMatch(/Search Console est injoignable/)
  })

  it("réponse illisible ou entièrement refusée : liste vide et explication", async () => {
    const garbage = await generateIdeas(db.client as never, { mode: "topics" }, { now: NOW, complete: async () => ({ ...completion([]), text: "désolé" }), suggest: async () => [], metrics: null })
    expect(garbage.ideas).toEqual([])
    expect(garbage.notes.join(" ")).toMatch(/Aucune proposition exploitable/)
    const refused = await generateIdeas(db.client as never, { mode: "topics" }, { now: NOW, complete: async () => completion([idea("alternative costructor"), idea("qonforme avis")]), suggest: async () => [], metrics: null })
    expect(refused.ideas).toEqual([])
    expect(refused.notes.join(" ")).toMatch(/2 propositions écartées/)
  })

  it("repli du modèle annoncé : clé absente, ou panne du fournisseur", async () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "")
    const noKey = await generateIdeas(db.client as never, { mode: "topics" }, { now: NOW, complete: async () => completion([idea("exemple devis peinture")], { model: "gemini-3.8-flash" }), suggest: async () => [], metrics: null })
    expect(noKey.notes.join(" ")).toMatch(/Idées par .* au lieu de .*ANTHROPIC_API_KEY absente/)

    vi.stubEnv("ANTHROPIC_API_KEY", "test")
    const outage = await generateIdeas(
      db.client as never,
      { mode: "topics" },
      {
        now: NOW,
        complete: async () => completion([idea("exemple devis peinture")], { model: "gemini-3.8-flash", fallbackFrom: { model: "claude-sonnet-5-5", reason: "Claude indisponible (503)" } }),
        suggest: async () => [],
        metrics: null,
      },
    )
    expect(outage.notes.join(" ")).toMatch(/au lieu de .*Claude indisponible \(503\)/)
  })

  it("mode article : l'article n'est pas son propre doublon et rien d'autre n'est listé", async () => {
    seed({ blog_posts: [{ id: "p1", title: "Comment faire un devis de peinture", slug: "devis-peinture", target_keyword: "devis peinture" }] })
    let prompt = ""
    const out = await generateIdeas(
      db.client as never,
      { mode: "article", article: { title: "Comment faire un devis de peinture", content: "Le devis commence par la visite.", keyword: "devis peinture", articleType: "howto" } },
      {
        now: NOW,
        complete: async (input) => ((prompt = input.prompt), completion([idea("comment faire un devis de peinture", { articleType: "howto" })])),
        suggest: async (q) => [q],
        metrics: null,
      },
    )
    expect(prompt).not.toContain("DÉJÀ COUVERT")
    expect(prompt).toContain("Le devis commence par la visite.")
    expect(out.ideas[0].overlaps).toEqual([])
  })

  it("limite le nombre d'idées rendues", async () => {
    const many = Array.from({ length: 12 }, (_, i) => idea(`exemple devis chantier numéro ${i + 1}`))
    const out = await generateIdeas(db.client as never, { mode: "topics", count: 4 }, { now: NOW, complete: async () => completion(many), suggest: async () => [], metrics: null })
    expect(out.ideas).toHaveLength(4)
  })

  it("une erreur du modèle remonte telle quelle", async () => {
    await expect(
      generateIdeas(db.client as never, { mode: "topics" }, { now: NOW, complete: async () => { throw new ModelError("http", "Gemini indisponible (503)") }, suggest: async () => [], metrics: null }),
    ).rejects.toMatchObject({ kind: "http" })
  })
})

/* ------------------------------------------------------------------ */
/* Adoption                                                            */
/* ------------------------------------------------------------------ */

const adopted = (over: Partial<AdoptedIdea> = {}): AdoptedIdea => ({
  keyword: "Exemple Devis  Maçonnerie",
  title: "Exemple de devis de maçonnerie à copier",
  articleType: "guide",
  intent: "informational",
  volume: 170,
  difficulty: 12,
  cpc: 1.2,
  note: "Veut un modèle chiffré",
  ...over,
})
const opts = (over: Partial<Parameters<typeof adoptIdea>[2]> = {}) => ({ createTopic: true, competitors: [COMPETITOR], now: NOW, ...over })

describe("Proposition IA · adoption", () => {
  it("ajoute le mot-clé (ciblé, source « suggestion », mesures) et crée le sujet", async () => {
    const res = await adoptIdea(db.client as never, adopted(), opts())
    expect(res).toMatchObject({ keyword: "exemple devis maçonnerie", keywordAdded: true, topicExisting: false })
    expect(res.topicId).toBeTruthy()
    expect(db.tables.seo_keywords[0]).toMatchObject({
      keyword: "exemple devis maçonnerie",
      status: "targeted",
      source: "suggestion",
      intent: "informational",
      volume: 170,
      difficulty: 12,
      cpc: 1.2,
      cpc_currency: "USD",
    })
    expect(String(db.tables.seo_keywords[0].notes)).toMatch(/^Proposition IA du 17\/10\/2026 : Veut un modèle chiffré/)
    expect(db.tables.seo_keywords[0].metrics_checked_at).toBe(NOW.toISOString())
    expect(db.tables.seo_topics[0]).toMatchObject({
      title: "Exemple de devis de maçonnerie à copier",
      keyword: "exemple devis maçonnerie",
      keyword_id: res.keywordId,
      source: "keyword",
      article_type: "guide",
      status: "unplanned",
    })
  })

  it("« Suivre seulement » : candidat, sans sujet ; « ciblé » quand un article l'utilise", async () => {
    const follow = await adoptIdea(db.client as never, adopted({ volume: null, difficulty: null, cpc: null }), opts({ createTopic: false }))
    expect(follow.topicId).toBeNull()
    expect(db.tables.seo_topics).toHaveLength(0)
    expect(db.tables.seo_keywords[0]).toMatchObject({ status: "candidate" })
    expect(db.tables.seo_keywords[0]).not.toHaveProperty("metrics_checked_at")

    // Un article le choisit ensuite : le candidat passe à ciblé
    await adoptIdea(db.client as never, adopted(), opts({ createTopic: false, targeted: true }))
    expect(db.tables.seo_keywords).toHaveLength(1)
    expect(db.tables.seo_keywords[0].status).toBe("targeted")
  })

  it("un mot-clé déjà suivi garde son statut et ses réglages ; seules les mesures manquantes sont complétées", async () => {
    seed({ seo_keywords: [{ id: "k1", keyword: "exemple devis maçonnerie", status: "covered", intent: "commercial", volume: null, difficulty: 30, cpc: null, source: "import" }] })
    const res = await adoptIdea(db.client as never, adopted(), opts())
    expect(res).toMatchObject({ keywordId: "k1", keywordAdded: false })
    expect(db.tables.seo_keywords).toHaveLength(1)
    expect(db.tables.seo_keywords[0]).toMatchObject({ status: "covered", intent: "commercial", volume: 170, difficulty: 30, cpc: 1.2, cpc_currency: "USD" })
  })

  it("un sujet encore ouvert est rendu au lieu d'un second", async () => {
    seed({
      seo_keywords: [{ id: "k1", keyword: "exemple devis maçonnerie", status: "candidate", source: "manual" }],
      seo_topics: [{ id: "t1", title: "Sujet existant", keyword: "exemple devis maçonnerie", keyword_id: "k1", status: "planned" }],
    })
    const res = await adoptIdea(db.client as never, adopted(), opts())
    expect(res).toMatchObject({ topicId: "t1", topicExisting: true })
    expect(db.tables.seo_topics).toHaveLength(1)
    expect(db.tables.seo_keywords[0].status).toBe("targeted")
  })

  it("rattache un sujet sans mot-clé connu dont le texte correspond", async () => {
    seed({ seo_topics: [{ id: "t9", title: "Ancien sujet", keyword: "Exemple devis maçonnerie", keyword_id: null, status: "unplanned" }] })
    const res = await adoptIdea(db.client as never, adopted(), opts())
    expect(res).toMatchObject({ topicId: "t9", topicExisting: true })
    expect(db.tables.seo_topics[0].keyword_id).toBe(res.keywordId)
  })

  it("un sujet déjà publié ne bloque pas un nouveau sujet", async () => {
    seed({
      seo_keywords: [{ id: "k1", keyword: "exemple devis maçonnerie", status: "covered", source: "manual" }],
      seo_topics: [{ id: "t1", title: "Publié", keyword: "exemple devis maçonnerie", keyword_id: "k1", status: "published" }],
    })
    const res = await adoptIdea(db.client as never, adopted(), opts())
    expect(res.topicExisting).toBe(false)
    expect(db.tables.seo_topics).toHaveLength(2)
  })

  it("refuse un mot-clé ignoré, un concurrent, une adresse web", async () => {
    seed({ seo_keywords: [{ id: "k1", keyword: "exemple devis maçonnerie", status: "ignored", source: "manual" }] })
    await expect(adoptIdea(db.client as never, adopted(), opts())).rejects.toMatchObject({ status: 409, code: "ignored" })
    await expect(adoptIdea(db.client as never, adopted({ keyword: "avis costructor" }), opts())).rejects.toMatchObject({ status: 400, code: "competitor" })
    await expect(adoptIdea(db.client as never, adopted({ title: "Mieux que Costructor" }), opts())).rejects.toMatchObject({ status: 400, code: "competitor" })
    await expect(adoptIdea(db.client as never, adopted({ keyword: "https://exemple.fr/devis" }), opts())).rejects.toBeInstanceOf(AdoptError)
    expect(db.tables.seo_topics).toHaveLength(0)
  })

  it("un ajout simultané (doublon à l'insertion) reprend le mot-clé de l'autre onglet", async () => {
    const real = db.client as { from: (t: string) => unknown }
    const racing = (status: string) => {
      let reads = 0
      return {
        from: (table: string) =>
          table !== "seo_keywords"
            ? real.from(table)
            : {
                // Première lecture : rien ; l'autre onglet insère avant nous ; l'insertion échoue sur l'index unique
                select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: ++reads === 1 ? null : { id: "k-race", status }, error: null }) }) }),
                insert: () => ({ select: () => ({ single: async () => ({ data: null, error: { code: "23505", message: "duplicate key" } }) }) }),
              },
      }
    }
    const res = await adoptIdea(racing("candidate") as never, adopted(), opts({ createTopic: false }))
    expect(res).toMatchObject({ keywordId: "k-race", keywordAdded: false })
    await expect(adoptIdea(racing("ignored") as never, adopted(), opts({ createTopic: false }))).rejects.toMatchObject({ status: 409, code: "ignored" })
  })

  it("migration pas appliquée : erreur de lecture explicite", async () => {
    db.missing.add("seo_keywords")
    await expect(adoptIdea(db.client as never, adopted(), opts())).rejects.toMatchObject({ kind: "migration_pending" })
  })
})

/* ------------------------------------------------------------------ */
/* Routes                                                              */
/* ------------------------------------------------------------------ */

const req = (url: string, body?: unknown) => new NextRequest(`http://localhost${url}`, { method: "POST", body: body === undefined ? undefined : JSON.stringify(body) })

describe("POST /api/admin/seo/ideas", () => {
  it("401 sans session admin, 400 sur un corps invalide", async () => {
    admin = false
    expect((await ideasRoute(req("/api/admin/seo/ideas", { mode: "topics" }))).status).toBe(401)
    admin = true
    expect((await ideasRoute(req("/api/admin/seo/ideas", { mode: "autre" }))).status).toBe(400)
    expect((await ideasRoute(req("/api/admin/seo/ideas", { mode: "article" }))).status).toBe(400)
    expect((await ideasRoute(req("/api/admin/seo/ideas", { mode: "topics", count: 99 }))).status).toBe(400)
    expect((await ideasRoute(req("/api/admin/seo/ideas", { mode: "topics", trade: "astronaute" }))).status).toBe(400)
    expect((await ideasRoute(req("/api/admin/seo/ideas", { mode: "topics", focus: "x".repeat(301) }))).status).toBe(400)
    const noTitle = await ideasRoute(req("/api/admin/seo/ideas", { mode: "article", article: { title: " ", content: "x" } }))
    expect(noTitle.status).toBe(400)
    expect((await noTitle.json()).error).toMatch(/titre de l'article/)
  })

  it("422 quand l'angle ou le titre nomme un concurrent, avant tout appel de modèle", async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal("fetch", fetchMock)
    const focus = await ideasRoute(req("/api/admin/seo/ideas", { mode: "topics", focus: "mieux que Costructor" }))
    expect(focus.status).toBe(422)
    expect((await focus.json()).code).toBe("competitor")
    const title = await ideasRoute(req("/api/admin/seo/ideas", { mode: "article", article: { title: "Costructor : avis", content: "" } }))
    expect(title.status).toBe(422)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it("503 quand aucune clé de modèle n'est configurée", async () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "")
    vi.stubEnv("GEMINI_API_KEY", "")
    const res = await ideasRoute(req("/api/admin/seo/ideas", { mode: "topics" }))
    expect(res.status).toBe(503)
    expect((await res.json()).code).toBe("not_configured")
  })

  it("503 tant que la migration n'est pas appliquée", async () => {
    db.missing.add("seo_settings")
    const res = await ideasRoute(req("/api/admin/seo/ideas", { mode: "topics" }))
    expect(res.status).toBe(503)
    expect((await res.json()).code).toBe("migration_pending")
  })
})

describe("POST /api/admin/seo/ideas/adopt", () => {
  const body = (over: Record<string, unknown> = {}) => ({
    keyword: "exemple devis maçonnerie",
    title: "Exemple de devis de maçonnerie à copier",
    articleType: "guide",
    intent: "informational",
    volume: 170,
    difficulty: 12,
    cpc: 1.2,
    note: "Veut un modèle",
    ...over,
  })

  it("401, puis 400 champ par champ", async () => {
    admin = false
    expect((await adoptRoute(req("/api/admin/seo/ideas/adopt", body()))).status).toBe(401)
    admin = true
    const short = await adoptRoute(req("/api/admin/seo/ideas/adopt", body({ title: "Ab" })))
    expect(short.status).toBe(400)
    expect((await short.json()).fieldErrors.title).toMatch(/5 caractères/)
    expect((await adoptRoute(req("/api/admin/seo/ideas/adopt", body({ articleType: "roman" })))).status).toBe(400)
    expect((await adoptRoute(req("/api/admin/seo/ideas/adopt", body({ difficulty: 140 })))).status).toBe(400)
    expect((await adoptRoute(req("/api/admin/seo/ideas/adopt", body({ intent: "inconnue" })))).status).toBe(400)
    expect(db.tables.seo_keywords).toHaveLength(0)
  })

  it("201 à la création, 200 quand tout existait déjà", async () => {
    const created = await adoptRoute(req("/api/admin/seo/ideas/adopt", body()))
    expect(created.status).toBe(201)
    const json = await created.json()
    expect(json).toMatchObject({ keyword: "exemple devis maçonnerie", keywordAdded: true, topicExisting: false })
    expect(json.topicId).toBeTruthy()

    const again = await adoptRoute(req("/api/admin/seo/ideas/adopt", body()))
    expect(again.status).toBe(200)
    expect(await again.json()).toMatchObject({ keywordAdded: false, topicExisting: true, topicId: json.topicId })
    expect(db.tables.seo_topics).toHaveLength(1)
  })

  it("createTopic: false suit seulement le mot-clé ; targeted le cible", async () => {
    const res = await adoptRoute(req("/api/admin/seo/ideas/adopt", body({ createTopic: false, targeted: true })))
    expect(res.status).toBe(201)
    expect((await res.json()).topicId).toBeNull()
    expect(db.tables.seo_topics).toHaveLength(0)
    expect(db.tables.seo_keywords[0].status).toBe("targeted")
  })

  it("409 pour un mot-clé ignoré, 400 pour un concurrent", async () => {
    seed({ seo_keywords: [{ id: "k1", keyword: "exemple devis maçonnerie", status: "ignored", source: "manual" }] })
    const ignored = await adoptRoute(req("/api/admin/seo/ideas/adopt", body()))
    expect(ignored.status).toBe(409)
    expect((await ignored.json()).code).toBe("ignored")
    const competitor = await adoptRoute(req("/api/admin/seo/ideas/adopt", body({ keyword: "avis costructor devis" })))
    expect(competitor.status).toBe(400)
  })
})
