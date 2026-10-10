import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { fakeArticlesDb, uuid, type FakeArticlesDb, type Row } from "./seo-articles-fake-db"
import { SETTINGS_DEFAULTS } from "@/lib/seo/settings-schema"
import { findCompetitorMentions } from "@/lib/seo/competitors"

const mocks = vi.hoisted(() => ({
  text: vi.fn(),
  image: vi.fn(),
  revalidated: [] as string[],
}))

vi.mock("@/lib/seo/articles/models", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/seo/articles/models")>()),
  generateText: mocks.text,
  generateImage: mocks.image,
}))
vi.mock("next/cache", () => ({ revalidatePath: (p: string) => mocks.revalidated.push(p) }))

import { createJob, loadGenerationContext, MAX_PASSES, readTopic, retryFailedJob, runJobStep, type JobRow, type StepOutcome } from "@/lib/seo/articles/generate"
import { loadCheckContext, publishDuePosts, publishNow, readPublishablePost } from "@/lib/seo/articles/publish"
import { hasArticlesWork, runArticlesTask } from "@/lib/seo/articles/task"
import { loadGenerateDialog, loadTopics } from "@/lib/seo/articles/data"
import { SeoDbError, type SeoDb } from "@/lib/seo/db"

const competitors = SETTINGS_DEFAULTS.targeting.competitors
const env = { ...process.env }

const words = (n: number) => Array.from({ length: n }, (_, i) => `chantier${i}`).join(" ")
const CLEAN = `Introduction sur les relances.\n\n## Quand relancer\n\n${words(1700)}\n\n## Questions fréquentes\n\n### Combien de relances envoyer ?\nDeux ou trois.\n\n### Faut-il un courrier ?\nPas toujours.\n\n### Quelles pénalités ?\nCelles du Code de commerce.\n\n## Pour aller plus loin\n\nEssayez Qonforme pour vos devis.`
const STALE = CLEAN.replace("Introduction sur les relances.", "Introduction : la franchise s'arrête à 36 800 € pour les services.")

const PLAN = {
  title: "Relancer une facture impayée sans perdre le client",
  slug: "relancer-facture-impayee",
  metaDescription: "Relancer une facture impayée sans froisser votre client : les bons délais, les bons mots et les pénalités prévues par la loi pour les artisans du bâtiment.",
  outline: [
    { h2: "Quand relancer", h3: [] },
    { h2: "Que dire", h3: [] },
    { h2: "Les pénalités", h3: [] },
  ],
  faq: ["Combien de relances envoyer ?", "Faut-il un courrier ?", "Quelles pénalités ?"],
  keywords: ["relance facture", "facture impayée"],
  sources: [
    { title: "Code de commerce", url: "https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000045800227" },
    { title: "Blog quelconque", url: "https://www.exemple.com/article" },
  ],
}

interface Call {
  model: string
  pass: string
  system: string
  prompt: string
}

let calls: Call[]
let writeContent: string
let fixContent: string
let reviewProblems: unknown[]

function scripted() {
  mocks.text.mockImplementation(async ({ model, system, prompt }: { model: string; system: string; prompt: string }) => {
    const pass = prompt.slice(0, 7)
    calls.push({ model, pass, system, prompt })
    const usage = { inputTokens: 100, outputTokens: 50 }
    if (pass === "PASSE 1") return { text: JSON.stringify(PLAN), model, usage }
    if (pass === "PASSE 2") return { text: writeContent, model, usage }
    if (pass === "PASSE 3") return { text: JSON.stringify({ problems: reviewProblems }), model, usage }
    if (pass === "PASSE 4") return { text: fixContent, model, usage }
    throw new Error(`passe inattendue : ${pass}`)
  })
  mocks.image.mockImplementation(async ({ model }: { model: string }) => ({ data: Buffer.from("img"), mimeType: "image/jpeg", model }))
}

function topicRow(over: Row = {}): Row {
  return {
    id: uuid(),
    title: "Relancer une facture impayée sans perdre le client",
    keyword: "relances automatiques factures",
    article_type: "howto",
    angle: null,
    notes: null,
    source: "keyword",
    keyword_id: null,
    status: "unplanned",
    scheduled_at: null,
    publish_mode: "draft",
    post_id: null,
    last_error: null,
    ...over,
  }
}

function setup(topic: Row = topicRow(), extra: Record<string, Row[]> = {}): { db: FakeArticlesDb; client: SeoDb; topicId: string } {
  const db = fakeArticlesDb({ seo_topics: [topic], blog_posts: [], seo_article_jobs: [], seo_settings: [], ...extra })
  return { db, client: db.client as SeoDb, topicId: topic.id as string }
}

async function startJob(client: SeoDb, topicId: string): Promise<JobRow> {
  const ctx = await loadGenerationContext(client)
  const topic = await readTopic(client, topicId)
  return (await createJob(client, topic!, ctx)).job
}

async function runAll(client: SeoDb, jobId: string): Promise<StepOutcome[]> {
  const outcomes: StepOutcome[] = []
  for (let i = 0; i < 15; i++) {
    const o = await runJobStep(client, jobId, { deadline: Date.now() + 290_000 })
    outcomes.push(o)
    if (o.status === "done" || o.status === "failed") break
  }
  return outcomes
}

beforeEach(() => {
  process.env.GEMINI_API_KEY = "cle-gemini-test"
  process.env.ANTHROPIC_API_KEY = "cle-anthropic-test"
  calls = []
  writeContent = CLEAN
  fixContent = CLEAN
  reviewProblems = []
  mocks.revalidated.length = 0
  mocks.text.mockReset()
  mocks.image.mockReset()
  scripted()
})

afterEach(() => {
  process.env = { ...env }
})

describe("rédaction en plusieurs passes", () => {
  it("plan → rédaction → contrôle → image → enregistrement, un modèle par passe, brouillon à relire", async () => {
    const { db, client, topicId } = setup()
    const job = await startJob(client, topicId)
    expect(db.tables.seo_topics[0].status).toBe("generating")

    const outcomes = await runAll(client, job.id)
    expect(outcomes.map((o) => o.ran)).toEqual(["plan", "write", "check", "cover", "save"])
    expect(outcomes.at(-1)).toMatchObject({ status: "done", step: "done" })

    // Plan et contrôle par Gemini 3.8 Flash, rédaction par Claude Opus 5.5 (réglages par défaut)
    expect(calls.map((c) => [c.pass, c.model])).toEqual([
      ["PASSE 1", "gemini-3.8-flash"],
      ["PASSE 2", "claude-opus-5-5"],
      ["PASSE 3", "gemini-3.8-flash"],
    ])
    expect(calls[2].system).toMatch(/^Vous relisez/)
    // Aucun concurrent n'est jamais envoyé au modèle
    for (const c of calls) expect(findCompetitorMentions(`${c.system}\n${c.prompt}`, competitors)).toEqual([])

    const post = db.tables.blog_posts[0]
    expect(post).toMatchObject({
      slug: "relancer-facture-impayee",
      title: PLAN.title,
      is_published: false,
      published_at: null,
      ai_generated: true,
      source: "seo",
      article_type: "howto",
      target_keyword: "relances automatiques factures",
      review_status: "to_review",
      held_reason: null,
      seo_title: PLAN.title,
      seo_description: PLAN.metaDescription,
      ai_model: "plan gemini-3.8-flash · rédaction claude-opus-5-5 · contrôle gemini-3.8-flash · image gemini-nano-banana-2.1",
    })
    expect((post.seo_description as string).length).toBeGreaterThanOrEqual(120)
    expect((post.seo_description as string).length).toBeLessThanOrEqual(155)
    expect(post.cover_url).toMatch(/^https:\/\/stockage\.test\/blog-covers\/seo\/relancer-facture-impayee-/)
    expect(post.audit_result).toMatchObject({ version: 1, issues: [], blocking: 0 })
    expect(post.ai_keywords).toEqual(["relances automatiques factures", "relance facture", "facture impayée"])
    expect(db.uploads[0]).toMatchObject({ bucket: "blog-covers", contentType: "image/jpeg" })
    expect(db.tables.seo_topics[0]).toMatchObject({ status: "drafted", post_id: post.id })
    expect(db.tables.seo_article_jobs[0]).toMatchObject({ status: "done", post_id: post.id })
    // Seules les sources officielles restent dans le plan envoyé à la rédaction
    expect(calls[1].prompt).toContain("legifrance.gouv.fr")
    expect(calls[1].prompt).not.toContain("exemple.com")
    // Jamais publié : rien à rafraîchir sur le blog
    expect(mocks.revalidated).toEqual([])
  })

  it("clé Anthropic absente : la rédaction passe sur le modèle du plan, et l'écran le dit", async () => {
    delete process.env.ANTHROPIC_API_KEY
    const { db, client, topicId } = setup()
    const job = await startJob(client, topicId)
    const outcomes = await runAll(client, job.id)
    expect(calls.find((c) => c.pass === "PASSE 2")?.model).toBe("gemini-3.8-flash")
    const notice = "Rédaction par Gemini 3.8 Flash au lieu de Claude Opus 5.5 : Clé ANTHROPIC_API_KEY absente."
    expect(outcomes.at(-1)?.notices).toContain(notice)
    expect(db.tables.blog_posts[0].ai_model).toContain("rédaction gemini-3.8-flash")
  })

  it("valeur périmée : une passe de correction par le même auteur, puis publication directe une fois corrigée", async () => {
    writeContent = STALE
    const { db, client, topicId } = setup(topicRow({ publish_mode: "direct" }))
    const job = await startJob(client, topicId)
    const outcomes = await runAll(client, job.id)
    expect(outcomes.map((o) => o.ran)).toEqual(["plan", "write", "check", "fix", "check", "cover", "save"])
    const fix = calls.find((c) => c.pass === "PASSE 4")!
    expect(fix.model).toBe("claude-opus-5-5")
    expect(fix.prompt).toContain("Anciens seuils de franchise de TVA")
    expect(fix.prompt).toContain("36 800")
    const post = db.tables.blog_posts[0]
    expect(post).toMatchObject({ is_published: true, review_status: "approved", held_reason: null })
    expect(post.published_at).toBeTruthy()
    expect(db.tables.seo_topics[0].status).toBe("published")
    expect(mocks.revalidated).toContain("/blog/relancer-facture-impayee")
  })

  it("publication directe retenue si la valeur périmée reste après la correction", async () => {
    writeContent = STALE
    fixContent = STALE
    const { db, client, topicId } = setup(topicRow({ publish_mode: "direct" }))
    const job = await startJob(client, topicId)
    await runAll(client, job.id)
    expect(calls.filter((c) => c.pass === "PASSE 4")).toHaveLength(1)
    const post = db.tables.blog_posts[0]
    expect(post).toMatchObject({ is_published: false, review_status: "to_review" })
    expect(post.held_reason).toContain("Anciens seuils de franchise de TVA")
    expect(db.tables.seo_topics[0].status).toBe("drafted")
  })

  it("un concurrent cité par le rédacteur est retiré de la consigne de correction, jamais envoyé", async () => {
    writeContent = CLEAN.replace("Introduction sur les relances.", "Introduction : contrairement à Tolteck (tolteck.com), le logiciel relance.")
    const { db, client, topicId } = setup()
    const job = await startJob(client, topicId)
    const outcomes = await runAll(client, job.id)
    expect(outcomes.at(-1)?.status).toBe("done")
    const review = calls.find((c) => c.pass === "PASSE 3")!
    const fix = calls.find((c) => c.pass === "PASSE 4")!
    expect(review.prompt).toContain("[nom retiré]")
    expect(fix.prompt).toContain("[nom retiré]")
    for (const c of calls) expect(findCompetitorMentions(`${c.system}\n${c.prompt}`, competitors)).toEqual([])
    expect(db.tables.blog_posts[0].audit_result).toMatchObject({ issues: [], fixPass: true })
  })

  it("après contrôle : un problème repéré par le relecteur retient l'article", async () => {
    reviewProblems = [{ category: "unverifiable_claim", excerpt: "Introduction sur les relances", explanation: "Affirmation sans source", fix: "Citer le texte" }]
    const { db, client, topicId } = setup(topicRow({ publish_mode: "after_check" }))
    const job = await startJob(client, topicId)
    fixContent = CLEAN
    await runAll(client, job.id)
    const post = db.tables.blog_posts[0]
    expect(post.is_published).toBe(false)
    expect(post.review_status).toBe("to_review")
    expect(post.held_reason).toContain("Affirmation invérifiable")
  })

  it("un concurrent dans le contexte de marque bloque la rédaction avant tout appel", async () => {
    const brand = { ...SETTINGS_DEFAULTS.brand, offer: "Comme Tolteck, mais pour les artisans." }
    const { db, client, topicId } = setup(topicRow(), { seo_settings: [{ key: "brand", value: brand, updated_at: new Date().toISOString() }] })
    const job = await startJob(client, topicId)
    const outcomes = await runAll(client, job.id)
    expect(mocks.text).not.toHaveBeenCalled()
    expect(outcomes.at(-1)).toMatchObject({ status: "failed" })
    expect(outcomes.at(-1)?.error).toMatch(/concurrent suivi/)
    expect(db.tables.seo_topics[0]).toMatchObject({ status: "failed" })
    expect(db.tables.seo_topics[0].last_error).toMatch(/concurrent/)
  })

  it("un sujet qui nomme un concurrent est refusé dès la création de la rédaction", async () => {
    const { client, topicId } = setup(topicRow({ title: "Tolteck ou un autre logiciel ?" }))
    await expect(startJob(client, topicId)).rejects.toThrow(/concurrent suivi/)
  })

  it("une seule rédaction active par sujet", async () => {
    const { db, client, topicId } = setup()
    const first = await startJob(client, topicId)
    const ctx = await loadGenerationContext(client)
    const again = await createJob(client, (await readTopic(client, topicId))!, ctx)
    expect(again).toMatchObject({ created: false, job: { id: first.id } })
    expect(db.tables.seo_article_jobs).toHaveLength(1)
  })

  it("image : le repli est noté, et un échec d'image n'empêche pas l'article", async () => {
    mocks.image.mockImplementationOnce(async () => ({ data: Buffer.from("img"), mimeType: "image/png", model: "gemini-3.1-flash-image", fallbackFrom: { model: "gemini-nano-banana-2.1", reason: "503" } }))
    const a = setup()
    const jobA = await startJob(a.client, a.topicId)
    const outA = await runAll(a.client, jobA.id)
    expect(outA.at(-1)?.notices.join(" ")).toContain("Image par Nano Banana 2 au lieu de Nano Banana 2.1")
    expect(a.db.tables.blog_posts[0].ai_model).toContain("image gemini-3.1-flash-image")

    mocks.image.mockImplementationOnce(async () => {
      throw new Error("Aucune image renvoyée par le modèle.")
    })
    const b = setup()
    const jobB = await startJob(b.client, b.topicId)
    const outB = await runAll(b.client, jobB.id)
    expect(outB.at(-1)?.status).toBe("done")
    expect(b.db.tables.blog_posts[0].cover_url).toBeNull()
    expect(outB.at(-1)?.notices.join(" ")).toContain("Article sans image de couverture")
  })

  it("plan refusé : nouvel essai avec le motif, puis échec au troisième", async () => {
    mocks.text.mockImplementation(async ({ model, prompt }: { model: string; prompt: string }) => {
      calls.push({ model, pass: prompt.slice(0, 7), system: "", prompt })
      return { text: JSON.stringify({ ...PLAN, title: "x".repeat(90) }), model, usage: { inputTokens: 1, outputTokens: 1 } }
    })
    const { db, client, topicId } = setup()
    const job = await startJob(client, topicId)
    const outcomes = await runAll(client, job.id)
    expect(outcomes).toHaveLength(3)
    expect(calls[1].prompt).toContain("ESSAI PRÉCÉDENT REFUSÉ : Titre de plus de 70 caractères")
    expect(outcomes.at(-1)).toMatchObject({ status: "failed" })
    expect(db.tables.seo_topics[0].status).toBe("failed")
  })
})

describe("publication à l'heure prévue et tâche planifiée", () => {
  it("après contrôle, date à venir : enregistré planifié, publié à l'heure si le contrôle ne repère rien", async () => {
    const at = new Date(Date.now() + 3 * 3600_000).toISOString()
    const { db, client, topicId } = setup(topicRow({ status: "planned", scheduled_at: at, publish_mode: "after_check" }))
    const job = await startJob(client, topicId)
    await runAll(client, job.id)
    const post = db.tables.blog_posts[0]
    expect(post).toMatchObject({ is_published: false, review_status: null, scheduled_at: at })

    expect(await publishDuePosts(client, { now: new Date(), deadline: Date.now() + 60_000 })).toEqual({ published: 0, held: 0 })
    const later = new Date(Date.now() + 4 * 3600_000)
    expect(await publishDuePosts(client, { now: later, deadline: Date.now() + 60_000 })).toEqual({ published: 1, held: 0 })
    expect(db.tables.blog_posts[0].is_published).toBe(true)
    expect(db.tables.seo_topics[0].status).toBe("published")
    expect(mocks.revalidated).toContain("/blog/relancer-facture-impayee")
  })

  it("directement : retenu à l'heure prévue si le texte cite une valeur périmée ; brouillon : jamais publié", async () => {
    const past = new Date(Date.now() - 60_000).toISOString()
    const direct = { id: uuid(), slug: "a", title: "Article A", excerpt: null, content: "La franchise : 36 800 € en services.", is_published: false, published_at: null, scheduled_at: past, review_status: null, seo_description: null }
    // Brouillon arrivé à l'heure sans décision prise : passe par la branche du mode « brouillon »
    const draft = { id: uuid(), slug: "b", title: "Article B", excerpt: null, content: "Texte propre.", is_published: false, published_at: null, scheduled_at: past, review_status: null, seo_description: null }
    const db = fakeArticlesDb({
      blog_posts: [direct, draft],
      seo_topics: [topicRow({ post_id: direct.id, publish_mode: "direct", status: "drafted" }), topicRow({ post_id: draft.id, publish_mode: "draft", status: "drafted" })],
      seo_settings: [],
    })
    const res = await publishDuePosts(db.client as SeoDb, { now: new Date(), deadline: Date.now() + 60_000 })
    expect(res).toEqual({ published: 0, held: 2 })
    expect(db.tables.blog_posts[0]).toMatchObject({ is_published: false, review_status: "to_review" })
    expect(db.tables.blog_posts[0].held_reason).toContain("Anciens seuils de franchise de TVA")
    expect(db.tables.blog_posts[1]).toMatchObject({ is_published: false, review_status: "to_review" })
    expect(mocks.revalidated).toHaveLength(0)
    // Décision prise : la tâche ne le reprend plus
    expect(await publishDuePosts(db.client as SeoDb, { now: new Date(), deadline: Date.now() + 60_000 })).toEqual({ published: 0, held: 0 })
  })

  it("la tâche prépare un sujet planifié dans les 24 h et termine sa rédaction", async () => {
    const at = new Date(Date.now() + 10 * 3600_000).toISOString()
    const far = new Date(Date.now() + 72 * 3600_000).toISOString()
    const soon = topicRow({ status: "planned", scheduled_at: at, publish_mode: "draft" })
    const later = topicRow({ title: "Autoliquidation en sous-traitance : la mention à écrire", status: "planned", scheduled_at: far })
    const db = fakeArticlesDb({ seo_topics: [soon, later], blog_posts: [], seo_article_jobs: [], seo_settings: [] })
    const result = await runArticlesTask({ db: db.client as SeoDb, now: new Date(), deadline: Date.now() + 270_000 })
    expect(result).toMatchObject({ prepared: 1, done: 1, failed: 0 })
    expect(db.tables.blog_posts).toHaveLength(1)
    expect(db.tables.blog_posts[0]).toMatchObject({ is_published: false, review_status: "to_review", scheduled_at: at })
    expect(db.tables.seo_topics.find((t) => t.id === soon.id)?.status).toBe("drafted")
    expect(db.tables.seo_topics.find((t) => t.id === later.id)?.status).toBe("planned")
  })
})

const REVIEWED = "Le taux applicable à ces travaux reste fixé à 7 % depuis toujours."
function reviewAudit(rule: "stale_value" | "forbidden_claim", excerpt = "reste fixé à 7 % depuis toujours") {
  return {
    version: 1,
    checkedAt: "2026-10-09T08:00:00.000Z",
    blocking: 1,
    issues: [{ kind: "review", rule, label: rule === "stale_value" ? "Valeur périmée (contrôle factuel)" : "Affirmation interdite (contrôle factuel)", detail: "Taux faux", excerpt, blocking: true, fixable: true }],
  }
}
function reviewedPost(over: Row = {}): Row {
  return { id: uuid(), slug: `article-${uuid()}`, title: "Article relu", excerpt: null, content: REVIEWED, is_published: false, published_at: null, scheduled_at: new Date(Date.now() - 60_000).toISOString(), review_status: null, seo_description: null, held_reason: null, ai_keywords: null, audit_result: reviewAudit("stale_value"), ...over }
}

describe("problèmes du relecteur gardés jusqu'à la publication", () => {
  it("à l'heure prévue, après contrôle et directement : retenu tant que le passage relevé reste", async () => {
    const a = reviewedPost()
    const d = reviewedPost()
    const fixed = reviewedPost({ content: "Le taux applicable à ces travaux suit le Code général des impôts." })
    const db = fakeArticlesDb({
      blog_posts: [a, d, fixed],
      seo_topics: [topicRow({ post_id: a.id, publish_mode: "after_check", status: "drafted" }), topicRow({ post_id: d.id, publish_mode: "direct", status: "drafted" }), topicRow({ post_id: fixed.id, publish_mode: "direct", status: "drafted" })],
      seo_settings: [],
    })
    const res = await publishDuePosts(db.client as SeoDb, { now: new Date(), deadline: Date.now() + 60_000 })
    expect(res).toEqual({ published: 1, held: 2 })
    for (const id of [a.id, d.id]) {
      const post = db.tables.blog_posts.find((p) => p.id === id)!
      expect(post).toMatchObject({ is_published: false, review_status: "to_review" })
      expect(post.held_reason).toContain("Valeur périmée (contrôle factuel)")
      // La trace du relecteur reste dans audit_result
      expect(JSON.stringify(post.audit_result)).toContain("reste fixé à 7 %")
    }
    // Passage corrigé depuis : le problème du relecteur ne compte plus
    expect(db.tables.blog_posts.find((p) => p.id === fixed.id)?.is_published).toBe(true)
  })

  it("« Publier maintenant » refusé par une affirmation interdite du relecteur, trace conservée", async () => {
    const post = reviewedPost({ audit_result: reviewAudit("forbidden_claim"), scheduled_at: null, review_status: "to_review" })
    const db = fakeArticlesDb({ blog_posts: [post], seo_topics: [], seo_settings: [] })
    const client = db.client as SeoDb
    const res = await publishNow(client, (await readPublishablePost(client, post.id as string))!, await loadCheckContext(client))
    expect(res.ok).toBe(false)
    if (!res.ok) expect(res.blockers.map((b) => b.label)).toContain("Affirmation interdite (contrôle factuel)")
    expect(db.tables.blog_posts[0].is_published).toBe(false)
    expect(JSON.stringify(db.tables.blog_posts[0].audit_result)).toContain("Affirmation interdite (contrôle factuel)")
    expect(mocks.revalidated).toHaveLength(0)
  })

  it("« Publier maintenant » sur un article déjà publié : aucune écriture", async () => {
    const post = reviewedPost({ is_published: true, published_at: "2026-10-01T08:00:00.000Z", review_status: "approved" })
    const db = fakeArticlesDb({ blog_posts: [post], seo_topics: [], seo_settings: [] })
    const client = db.client as SeoDb
    const before = JSON.stringify(db.tables.blog_posts[0])
    expect(await publishNow(client, (await readPublishablePost(client, post.id as string))!, await loadCheckContext(client))).toEqual({ ok: true })
    expect(JSON.stringify(db.tables.blog_posts[0])).toBe(before)
  })
})

describe("reprise des rédactions", () => {
  it("le plan qui nomme un concurrent (adresse) est relancé, sans le nom dans la consigne", async () => {
    let planCalls = 0
    mocks.text.mockImplementation(async ({ model, system, prompt }: { model: string; system: string; prompt: string }) => {
      const pass = prompt.slice(0, 7)
      calls.push({ model, pass, system, prompt })
      const usage = { inputTokens: 1, outputTokens: 1 }
      if (pass === "PASSE 1") {
        planCalls++
        return { text: JSON.stringify(planCalls === 1 ? { ...PLAN, slug: "tolteck-ou-qonforme-relances" } : PLAN), model, usage }
      }
      if (pass === "PASSE 2") return { text: CLEAN, model, usage }
      if (pass === "PASSE 3") return { text: JSON.stringify({ problems: [] }), model, usage }
      throw new Error(`passe inattendue : ${pass}`)
    })
    const { db, client, topicId } = setup()
    const job = await startJob(client, topicId)
    const outcomes = await runAll(client, job.id)
    expect(outcomes.at(-1)?.status).toBe("done")
    const plans = calls.filter((c) => c.pass === "PASSE 1")
    expect(plans).toHaveLength(2)
    expect(plans[1].prompt).toContain("ESSAI PRÉCÉDENT REFUSÉ : Le plan nommait un autre logiciel")
    for (const c of calls) expect(findCompetitorMentions(`${c.system}\n${c.prompt}`, competitors)).toEqual([])
    expect(db.tables.blog_posts[0].slug).toBe("relancer-facture-impayee")
  })

  it("« Réessayer » repart du plan après un échec venu du contenu, reprend la passe sinon", async () => {
    const { db, client, topicId } = setup()
    const job = await startJob(client, topicId)
    const ctx = await loadGenerationContext(client)
    const row = db.tables.seo_article_jobs[0]
    Object.assign(row, { status: "failed", step: "check", state: { ...(row.state as object), content: "texte", lastFailure: { step: "check", fatal: true, message: "Refus du modèle" } } })
    db.tables.seo_topics[0].status = "failed"
    const restarted = await retryFailedJob(client, (await readTopic(client, topicId))!, ctx)
    expect(restarted).toMatchObject({ id: job.id, status: "queued", step: "plan" })
    expect(restarted?.state.content).toBeUndefined()
    expect(db.tables.seo_topics[0].status).toBe("generating")

    Object.assign(row, { status: "failed", step: "write", state: { ...(row.state as object), lastFailure: { step: "write", fatal: false, message: "Délai dépassé" } } })
    const resumed = await retryFailedJob(client, (await readTopic(client, topicId))!, ctx)
    expect(resumed).toMatchObject({ status: "queued", step: "write" })
  })

  it("deux créations simultanées : la seconde reçoit 23505 et rend la première", async () => {
    const { db, client, topicId } = setup()
    const ctx = await loadGenerationContext(client)
    const topic = (await readTopic(client, topicId))!
    const winner = await createJob(client, topic, ctx)
    // Le second passage a lu « aucune rédaction active » juste avant l'insertion du premier
    let hidden = false
    const racing = new Proxy(client, {
      get(target, prop, receiver) {
        if (prop !== "from") return Reflect.get(target, prop, receiver)
        return (table: string) => {
          if (table === "seo_article_jobs" && !hidden) {
            hidden = true
            const q: Record<string, unknown> = {}
            for (const m of ["select", "eq", "in"]) q[m] = () => q
            q.limit = async () => ({ data: [], error: null })
            return q
          }
          return target.from(table)
        }
      },
    }) as SeoDb
    const second = await createJob(racing, topic, ctx)
    expect(hidden).toBe(true)
    expect(second).toMatchObject({ created: false, job: { id: winner.job.id } })
    expect(db.tables.seo_article_jobs).toHaveLength(1)
  })

  it("verrou : une passe tenue n'est pas rejouée, un verrou expiré est repris", async () => {
    const { db, client, topicId } = setup()
    const job = await startJob(client, topicId)
    const row = db.tables.seo_article_jobs[0]
    Object.assign(row, { status: "running", lock_until: new Date(Date.now() + 60_000).toISOString() })
    expect(await runJobStep(client, job.id, { deadline: Date.now() + 290_000 })).toMatchObject({ locked: true })
    expect(mocks.text).not.toHaveBeenCalled()
    row.lock_until = new Date(Date.now() - 60_000).toISOString()
    const out = await runJobStep(client, job.id, { deadline: Date.now() + 290_000 })
    expect(out).toMatchObject({ ran: "plan", step: "write" })
  })
})

describe("garde-fous de la rédaction", () => {
  it("un plan avec « < » dans le titre, la description ou un mot-clé est relancé, puis en échec", async () => {
    const bad = [
      { ...PLAN, title: "Relances </script><script>alert(1)</script>" },
      { ...PLAN, metaDescription: `${PLAN.metaDescription} <img src=x onerror=alert(1)>` },
      { ...PLAN, keywords: ["relance facture", "facture <b>impayée</b>"] },
    ]
    mocks.text.mockImplementation(async ({ model, prompt }: { model: string; prompt: string }) => {
      const i = calls.length
      calls.push({ model, pass: prompt.slice(0, 7), system: "", prompt })
      return { text: JSON.stringify(bad[i] ?? bad[0]), model, usage: { inputTokens: 1, outputTokens: 1 } }
    })
    const { db, client, topicId } = setup()
    const job = await startJob(client, topicId)
    const outcomes = await runAll(client, job.id)
    expect(outcomes).toHaveLength(3)
    expect(calls[1].prompt).toContain("ESSAI PRÉCÉDENT REFUSÉ : Titre avec un chevron")
    expect(calls[2].prompt).toContain("ESSAI PRÉCÉDENT REFUSÉ : Description avec un chevron")
    expect(outcomes.at(-1)).toMatchObject({ status: "failed" })
    expect(outcomes.at(-1)?.error).toContain("Mot-clé avec un chevron")
    expect(db.tables.blog_posts).toHaveLength(0)
  })

  it("texte vide après nettoyage : compté comme un essai, jamais une boucle", async () => {
    writeContent = "```markdown\n![Chantier](https://exemple.com/a.jpg)\n```"
    const { db, client, topicId } = setup()
    const job = await startJob(client, topicId)
    const outcomes = await runAll(client, job.id)
    expect(outcomes.map((o) => o.ran)).toEqual(["plan", "write", "write", "write"])
    expect(outcomes.at(-1)).toMatchObject({ status: "failed" })
    expect(outcomes.at(-1)?.error).toContain("Texte vide après nettoyage")
    expect(calls.filter((c) => c.pass === "PASSE 2")).toHaveLength(3)
    expect(calls.some((c) => c.pass === "PASSE 3")).toBe(false)
    expect(db.tables.seo_topics[0].status).toBe("failed")
  })

  it("plafond de passes par rédaction : arrêt net avec un motif clair, aucun appel", async () => {
    const { db, client, topicId } = setup()
    const job = await startJob(client, topicId)
    const row = db.tables.seo_article_jobs[0]
    row.state = { ...(row.state as object), passes: MAX_PASSES }
    const out = await runJobStep(client, job.id, { deadline: Date.now() + 290_000 })
    expect(out).toMatchObject({ status: "failed" })
    expect(out.error).toContain(`après ${MAX_PASSES} passes`)
    expect(mocks.text).not.toHaveBeenCalled()
    // Une rédaction normale compte ses passes
    const b = setup()
    const jobB = await startJob(b.client, b.topicId)
    await runAll(b.client, jobB.id)
    expect((b.db.tables.seo_article_jobs[0].state as { passes: number }).passes).toBe(5)
  })

  it("contrôle : un chevron dans le titre ou la description bloque aussi la publication manuelle", async () => {
    const post = reviewedPost({ title: "Titre </script><script>x</script>", content: "Texte propre.", audit_result: null, review_status: "to_review" })
    const db = fakeArticlesDb({ blog_posts: [post], seo_topics: [], seo_settings: [] })
    const client = db.client as SeoDb
    const res = await publishNow(client, (await readPublishablePost(client, post.id as string))!, await loadCheckContext(client))
    expect(res.ok).toBe(false)
    if (!res.ok) expect(res.blockers[0].label).toContain("Chevron")
    expect(db.tables.blog_posts[0].is_published).toBe(false)
  })
})

describe("tâche planifiée et lectures", () => {
  it("hasArticlesWork : rien à faire, puis un article à l'heure ; lecture en échec = on vérifie", async () => {
    const now = new Date()
    const empty = fakeArticlesDb({ blog_posts: [], seo_topics: [], seo_article_jobs: [] })
    expect(await hasArticlesWork(empty.client as SeoDb, now)).toBe(false)
    const due = fakeArticlesDb({ blog_posts: [reviewedPost({ audit_result: null })], seo_topics: [], seo_article_jobs: [] })
    expect(await hasArticlesWork(due.client as SeoDb, now)).toBe(true)
    const failing = fakeArticlesDb({ blog_posts: [], seo_topics: [], seo_article_jobs: [] })
    failing.failing.add("seo_topics")
    expect(await hasArticlesWork(failing.client as SeoDb, now)).toBe(true)
  })

  it("une lecture en échec n'est jamais affichée comme une liste vide", async () => {
    for (const table of ["seo_keywords", "seo_topics"]) {
      const db = fakeArticlesDb({ seo_topics: [], seo_keywords: [], blog_posts: [], seo_article_jobs: [], seo_settings: [] })
      db.failing.add(table)
      await expect(loadTopics(db.client as SeoDb, new Date(), { archived: false })).rejects.toBeInstanceOf(SeoDbError)
      await expect(loadGenerateDialog(db.client as SeoDb, new Date())).rejects.toBeInstanceOf(SeoDbError)
    }
  })
})
