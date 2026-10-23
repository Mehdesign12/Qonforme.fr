import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { fakeArticlesDb, uuid, type FakeArticlesDb, type Row } from "./seo-articles-fake-db"
import { SETTINGS_DEFAULTS } from "@/lib/seo/settings-schema"
import { findCompetitorMentions } from "@/lib/seo/competitors"

const mocks = vi.hoisted(() => ({
  text: vi.fn(),
  image: vi.fn(),
  store: vi.fn(),
  cover: vi.fn(),
  revalidated: [] as string[],
}))

vi.mock("@/lib/seo/articles/models", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/seo/articles/models")>()),
  generateText: mocks.text,
  generateImage: mocks.image,
}))
vi.mock("@/lib/blog-images/server", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/blog-images/server")>()),
  storeBlogImage: mocks.store,
}))
vi.mock("@/lib/blog-images/cover/make", () => ({ makeCover: mocks.cover }))
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
    // Lecture d'un passage pour une photo du texte (lib/blog-images/passage.ts)
    if (pass === "PASSAGE" || pass === "PARAGRA") {
      return {
        text: JSON.stringify({
          subject: "Relance d'une facture",
          scene: "Un artisan au téléphone dans sa camionnette relance un client, tablette posée sur le tableau de bord, chantier visible derrière le pare-brise.",
          styles: ["artisan", "vif"],
          alt: "Un artisan relance un client au téléphone depuis sa camionnette",
        }),
        model,
        usage,
      }
    }
    throw new Error(`passe inattendue : ${pass}`)
  })
  mocks.image.mockImplementation(async ({ model }: { model: string }) => ({ data: Buffer.from("png"), mimeType: "image/png", model }))
  let stored = 0
  mocks.store.mockImplementation(async ({ hint }: { hint: string }) => ({
    url: `https://stockage.test/blog-covers/editor/ia/2026/10/photo-${++stored}.webp#w=1600&h=900`,
    width: 1600,
    height: 900,
    hint,
  }))
  mocks.cover.mockImplementation(async ({ title }: { title: string }) => ({
    url: "https://stockage.test/blog-covers/covers/2026/10/relancer-facture-impayee-abc123.webp#w=1600&h=900",
    width: 1600,
    height: 900,
    alt: title,
    family: "papiers",
  }))
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
  // Sans photo dans le texte par défaut : la passe « images » a ses propres tests (describe plus bas)
  const db = fakeArticlesDb({
    seo_topics: [topic],
    blog_posts: [],
    seo_article_jobs: [],
    seo_settings: [{ key: "articles", value: { inlineImages: 0 }, updated_at: "2026-10-01T00:00:00Z" }],
    ...extra,
  })
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
  mocks.store.mockReset()
  mocks.cover.mockReset()
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
    expect(outcomes.map((o) => o.ran)).toEqual(["plan", "write", "check", "links", "cover", "save"])
    expect(outcomes.at(-1)).toMatchObject({ status: "done", step: "done" })

    // Claude partout par défaut : plan et contrôle par Sonnet 5.5, rédaction par Opus 5.5 ; Gemini seulement en secours
    expect(calls.map((c) => [c.pass, c.model])).toEqual([
      ["PASSE 1", "claude-sonnet-5-5"],
      ["PASSE 2", "claude-opus-5-5"],
      ["PASSE 3", "claude-sonnet-5-5"],
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
      ai_model: "plan claude-sonnet-5-5 · rédaction claude-opus-5-5 · contrôle claude-sonnet-5-5 · image couverture Qonforme",
    })
    expect((post.seo_description as string).length).toBeGreaterThanOrEqual(120)
    expect((post.seo_description as string).length).toBeLessThanOrEqual(155)
    // Couverture dessinée par le code : adresse sans le fragment des dimensions, texte alternatif = titre
    expect(post.cover_url).toBe("https://stockage.test/blog-covers/covers/2026/10/relancer-facture-impayee-abc123.webp")
    expect(post.cover_alt).toBe(PLAN.title)
    expect(mocks.cover).toHaveBeenCalledWith({ title: PLAN.title, keyword: "relances automatiques factures" })
    expect(post.audit_result).toMatchObject({ version: 1, issues: [], blocking: 0 })
    expect(post.ai_keywords).toEqual(["relances automatiques factures", "relance facture", "facture impayée"])
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
    expect(outcomes.map((o) => o.ran)).toEqual(["plan", "write", "check", "fix", "check", "links", "cover", "save"])
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

  it("couverture : un échec de dessin ou de stockage n'empêche pas l'article", async () => {
    mocks.cover.mockImplementationOnce(async () => {
      throw new Error("Stockage du blog indisponible.")
    })
    const a = setup()
    const jobA = await startJob(a.client, a.topicId)
    const outA = await runAll(a.client, jobA.id)
    expect(outA.at(-1)?.status).toBe("done")
    expect(a.db.tables.blog_posts[0].cover_url).toBeNull()
    expect(outA.at(-1)?.notices.join(" ")).toContain("Article sans image de couverture")
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

describe("fournisseur indisponible", () => {
  it("le plan tourne sur le modèle de repli : notice à l'écran, modèle réellement utilisé gardé pour l'état et les coûts", async () => {
    mocks.text.mockImplementation(async ({ model, system, prompt }: { model: string; system: string; prompt: string }) => {
      const pass = prompt.slice(0, 7)
      calls.push({ model, pass, system, prompt })
      const usage = { inputTokens: 100, outputTokens: 50 }
      // Le plan est demandé à Claude Sonnet 5.5, indisponible : generateText répond avec le repli (Gemini) et le dit
      if (pass === "PASSE 1") {
        return { text: JSON.stringify(PLAN), model: "gemini-3.8-flash", usage, fallbackFrom: { model, reason: "Anthropic indisponible (529)" } }
      }
      if (pass === "PASSE 2") return { text: writeContent, model, usage }
      if (pass === "PASSE 3") return { text: JSON.stringify({ problems: reviewProblems }), model, usage }
      if (pass === "PASSE 4") return { text: fixContent, model, usage }
      throw new Error(`passe inattendue : ${pass}`)
    })
    const { client, topicId } = setup()
    const job = await startJob(client, topicId)
    const first = await runJobStep(client, job.id, { deadline: Date.now() + 290_000 })
    expect(first).toMatchObject({ ran: "plan", status: "queued", step: "write", error: null })
    expect(first.notices).toContain("Plan par Gemini 3.8 Flash au lieu de Claude Sonnet 5.5 : Anthropic indisponible (529).")
    const outcomes = await runAll(client, job.id)
    expect(outcomes.at(-1)?.status).toBe("done")
    // La rédaction, elle, n'a pas bougé : le repli ne vaut que pour la passe qui en avait besoin
    expect(calls.find((c) => c.pass === "PASSE 2")?.model).toBe("claude-opus-5-5")
  })

  it("clé Anthropic pas encore ajoutée : les trois passes tournent sur Gemini, et l'écran dit pourquoi", async () => {
    delete process.env.ANTHROPIC_API_KEY
    const { client, topicId } = setup()
    const job = await startJob(client, topicId)
    const outcomes = await runAll(client, job.id)
    expect(outcomes.at(-1)?.status).toBe("done")
    expect(calls.map((c) => [c.pass, c.model])).toEqual([
      ["PASSE 1", "gemini-3.8-flash"],
      ["PASSE 2", "gemini-3.8-flash"],
      ["PASSE 3", "gemini-3.8-flash"],
    ])
    const notices = outcomes.at(-1)?.notices.join(" ") ?? ""
    expect(notices).toContain("Plan par Gemini 3.8 Flash au lieu de Claude Sonnet 5.5 : Clé ANTHROPIC_API_KEY absente.")
    expect(notices).toContain("Rédaction par Gemini 3.8 Flash au lieu de Claude Opus 5.5 : Clé ANTHROPIC_API_KEY absente.")
  })

  it("trois essais en échec : le message ne promet plus de nouvel essai, et « Réessayer » reste proposé", async () => {
    const { ModelError } = await import("@/lib/seo/articles/models")
    mocks.text.mockRejectedValue(new ModelError("http", "Anthropic indisponible (529). Nouvel essai au prochain passage."))
    const { db, client, topicId } = setup()
    const job = await startJob(client, topicId)
    const outcomes = await runAll(client, job.id)
    // Deux premiers échecs : la rédaction attend le prochain passage, le message le dit
    expect(outcomes[0]).toMatchObject({ status: "queued", error: "Anthropic indisponible (529). Nouvel essai au prochain passage." })
    expect(outcomes[1]).toMatchObject({ status: "queued" })
    // Troisième : définitif
    const last = outcomes.at(-1)
    expect(last).toMatchObject({ status: "failed" })
    expect(last?.error).toContain("Anthropic indisponible (529)")
    expect(last?.error).not.toContain("Nouvel essai au prochain passage")
    expect(last?.error).toContain("« Réessayer »")
    expect(db.tables.seo_topics[0]).toMatchObject({ status: "failed" })
    expect(String(db.tables.seo_topics[0].last_error)).toContain("« Réessayer »")
  })

  it("un échec définitif d'une autre nature garde son message tel quel", async () => {
    const { ModelError } = await import("@/lib/seo/articles/models")
    mocks.text.mockRejectedValue(new ModelError("not_configured", "Clé GEMINI_API_KEY refusée par Google : vérifiez-la dans les variables d'environnement.", false))
    const { client, topicId } = setup()
    const job = await startJob(client, topicId)
    const outcomes = await runAll(client, job.id)
    expect(outcomes.at(-1)).toMatchObject({ status: "failed", error: "Clé GEMINI_API_KEY refusée par Google : vérifiez-la dans les variables d'environnement." })
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

  it("article sans sujet programmé depuis l'éditeur : publié comme « directement », même si les Préférences disent « brouillon »", async () => {
    const past = new Date(Date.now() - 60_000).toISOString()
    const clean = { id: uuid(), slug: "editeur-propre", title: "Article de l'éditeur", excerpt: null, content: "Texte propre, sans valeur périmée.", is_published: false, published_at: null, scheduled_at: past, review_status: null, seo_description: null }
    const stale = { id: uuid(), slug: "editeur-perime", title: "Article périmé", excerpt: null, content: "La franchise : 36 800 € en services.", is_published: false, published_at: null, scheduled_at: past, review_status: null, seo_description: null }
    const db = fakeArticlesDb({
      blog_posts: [clean, stale],
      seo_topics: [],
      seo_settings: [{ key: "articles", value: { ...SETTINGS_DEFAULTS.articles, publishMode: "draft" }, updated_at: "2026-10-01T08:00:00.000Z" }],
    })
    const res = await publishDuePosts(db.client as SeoDb, { now: new Date(), deadline: Date.now() + 60_000 })
    expect(res).toEqual({ published: 1, held: 1 })
    // Signalements simples (longueur, sous-titres…) : publié quand même, comme « Publier maintenant »
    expect(db.tables.blog_posts[0]).toMatchObject({ is_published: true, review_status: "approved", held_reason: null })
    expect(mocks.revalidated).toContain("/blog/editeur-propre")
    // Valeur périmée : retenu, toujours
    expect(db.tables.blog_posts[1]).toMatchObject({ is_published: false, review_status: "to_review" })
    expect(db.tables.blog_posts[1].held_reason).toContain("Anciens seuils de franchise de TVA")
  })

  it("titre Google et texte alternatif contrôlés comme le texte (concurrent nommé : retenu, refusé à la main)", async () => {
    const past = new Date(Date.now() - 60_000).toISOString()
    const base = { excerpt: null, content: "Texte propre, sans valeur périmée.", is_published: false, published_at: null, scheduled_at: past, review_status: null, seo_description: null }
    const byTitle = { ...base, id: uuid(), slug: "titre-google", title: "Logiciel de devis", seo_title: `Logiciel certifié, mieux que ${competitors[0]}` }
    const byAlt = { ...base, id: uuid(), slug: "texte-alternatif", title: "Devis de maçonnerie", cover_alt: `Capture de ${competitors[0]}` }
    const db = fakeArticlesDb({ blog_posts: [byTitle, byAlt], seo_topics: [], seo_settings: [] })
    const client = db.client as SeoDb
    const ctx = await loadCheckContext(client)
    expect(await publishNow(client, (await readPublishablePost(client, byTitle.id))!, ctx)).toMatchObject({ ok: false })
    expect(await publishNow(client, (await readPublishablePost(client, byAlt.id))!, ctx)).toMatchObject({ ok: false })
    expect(await publishDuePosts(client, { now: new Date(), deadline: Date.now() + 60_000, ctx })).toEqual({ published: 0, held: 2 })
    expect(db.tables.blog_posts.map((p) => p.is_published)).toEqual([false, false])
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
    expect((b.db.tables.seo_article_jobs[0].state as { passes: number }).passes).toBe(6)
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

describe("maillage interne des articles générés", () => {
  const withPhrases = (content: string) => content.replace("Introduction sur les relances.", "Introduction : rappelez les mentions obligatoires d'un devis, lisez [un guide](/guide/guide-invente) et [la TVA](https://qonforme.fr/guide/tva-travaux).")

  it("la consigne de rédaction liste les pages du site à lier et le nombre de liens attendu", async () => {
    const { client, topicId } = setup()
    const job = await startJob(client, topicId)
    await runAll(client, job.id)
    const write = calls.find((c) => c.pass === "PASSE 2")!
    expect(write.prompt).toContain("MAILLAGE INTERNE")
    expect(write.prompt).toMatch(/entre \d+ et \d+ liens/)
    expect(write.prompt).toMatch(/- \/(guide|modele|outils|blog)\/[a-z0-9-]+ : /)
    expect(write.prompt).toContain("n'inventez aucune adresse interne")
    // Aucun concurrent dans la consigne (garde-fou commun)
    expect(findCompetitorMentions(write.prompt, competitors)).toEqual([])
  })

  it("adresse inventée retirée, adresse complète ramenée au chemin, liens complétés sur le texte", async () => {
    writeContent = withPhrases(CLEAN)
    const { db, client, topicId } = setup()
    const job = await startJob(client, topicId)
    const outcomes = await runAll(client, job.id)
    expect(outcomes.map((o) => o.ran)).toContain("links")
    const content = db.tables.blog_posts[0].content as string
    expect(content).not.toContain("/guide/guide-invente")
    expect(content).toContain("lisez un guide et")
    expect(content).toContain("[la TVA](/guide/tva-travaux)")
    expect(content).toContain("[mentions obligatoires d'un devis](/guide/mentions-obligatoires-devis)")
    const state = db.tables.seo_article_jobs[0].state as { links: { before: number; after: number; added: { path: string }[]; removed: string[] }; notices?: string[] }
    expect(state.links.removed).toEqual(["/guide/guide-invente"])
    expect(state.links.added.map((a) => a.path)).toContain("/guide/mentions-obligatoires-devis")
    expect(state.notices?.join(" ")).toMatch(/1 lien vers des pages qui n'existent pas retiré/)
  })

  it("un texte sans expression à lier reçoit le bloc « Pour aller plus loin » sous le minimum", async () => {
    writeContent = CLEAN.replace("## Pour aller plus loin\n\nEssayez Qonforme pour vos devis.", "## Conclusion\n\nEssayez Qonforme.")
    const { db, client, topicId } = setup()
    const job = await startJob(client, topicId)
    await runAll(client, job.id)
    const content = db.tables.blog_posts[0].content as string
    expect(content).toMatch(/## Pour aller plus loin\n\n- \[[^\]]+\]\(\/[a-z0-9/-]+\)/)
    // Chaque lien du bloc mène à une page connue
    const paths = Array.from(content.matchAll(/\]\((\/[^)]+)\)/g)).map((m) => m[1])
    expect(paths.length).toBeGreaterThan(0)
    const state = db.tables.seo_article_jobs[0].state as { links: { related: number } }
    expect(state.links.related).toBe(paths.length)
  })

  it("préférence « Liens internes automatiques » désactivée : ni liste de pages, ni passe de maillage", async () => {
    const { db, client, topicId } = setup(topicRow(), { seo_settings: [{ key: "articles", value: { autoLinks: false, inlineImages: 0 }, updated_at: "2026-10-01T00:00:00Z" }] })
    writeContent = withPhrases(CLEAN)
    const job = await startJob(client, topicId)
    const outcomes = await runAll(client, job.id)
    expect(outcomes.map((o) => o.ran)).toEqual(["plan", "write", "check", "cover", "save"])
    expect(calls.find((c) => c.pass === "PASSE 2")!.prompt).not.toContain("MAILLAGE INTERNE")
    expect((db.tables.seo_article_jobs[0].state as { input: { autoLinks: boolean } }).input.autoLinks).toBe(false)
  })

  it("un travail créé avant le maillage (sans la préférence) suit le maillage automatique", async () => {
    const { db, client, topicId } = setup()
    const job = await startJob(client, topicId)
    const state = db.tables.seo_article_jobs[0].state as { input: Record<string, unknown> }
    delete state.input.autoLinks
    const outcomes = await runAll(client, job.id)
    expect(outcomes.map((o) => o.ran)).toContain("links")
  })
})

describe("photos du texte des articles générés", () => {
  const SECTIONS = ["Quand relancer", "Que dire au client", "Les pénalités de retard", "Quel courrier envoyer"]
  // Quatre sections d'un premier paragraphe puis de quatre paragraphes de 110 mots : environ 2 000 mots, donc quatre photos
  const section = (title: string, i: number) =>
    `## ${title}\n\nPremier paragraphe de la section ${title.toLowerCase()}, avec assez de mots pour porter une photo qui l'illustre bien. ${words(25)}\n\n${[0, 1, 2, 3].map((j) => words(110).replace(/chantier/g, `part${i}${j}x`)).join("\n\n")}`
  const IMAGED = `Introduction sur les relances.\n\n${SECTIONS.map(section).join("\n\n")}\n\n## Questions fréquentes\n\n### Combien de relances envoyer ?\nDeux ou trois.\n\n### Faut-il un courrier ?\nPas toujours.\n\n### Quelles pénalités ?\nCelles du Code de commerce.\n\n## Pour aller plus loin\n\nEssayez Qonforme pour vos devis.`
  const withPhotos = (inlineImages: number | undefined = 4) =>
    setup(topicRow(), { seo_settings: [{ key: "articles", value: inlineImages === undefined ? {} : { inlineImages }, updated_at: "2026-10-01T00:00:00Z" }] })
  const stateOf = (db: FakeArticlesDb) =>
    db.tables.seo_article_jobs[0].state as { passes: number; images: { heading: string; url?: string; error?: string }[]; notices?: string[]; imageSlots: unknown[] }
  const imageLines = (content: string) => Array.from(content.matchAll(/^!\[([^\]]*)\]\(([^)]+)\)$/gm))

  it("quatre photos réparties, une par passe : lues, générées, enregistrées, insérées après un paragraphe", async () => {
    writeContent = IMAGED
    const { db, client, topicId } = withPhotos()
    const job = await startJob(client, topicId)
    const outcomes = await runAll(client, job.id)
    expect(outcomes.map((o) => o.ran)).toEqual(["plan", "write", "check", "links", "images", "images", "images", "images", "cover", "save"])
    expect(outcomes.at(-1)?.status).toBe("done")

    // Quatre photos de format paysage, la scène lue dans le passage, jamais d'autre texte que la description
    expect(mocks.image).toHaveBeenCalledTimes(4)
    const first = mocks.image.mock.calls[0][0] as { model: string; prompt: string; aspect: string }
    expect(first.aspect).toBe("16:9")
    expect(first.prompt).toContain("Un artisan au téléphone dans sa camionnette")
    // Enregistrées comme des illustrations générées, avec les métadonnées de Qonforme
    expect(mocks.store).toHaveBeenCalledTimes(4)
    const store = mocks.store.mock.calls[0][0] as { generated: boolean; hint: string; meta: { creator: string; source: string; description: string } }
    expect(store.generated).toBe(true)
    expect(SECTIONS.some((title) => store.hint.includes(title))).toBe(true)
    expect(store.meta).toMatchObject({ creator: "Qonforme", source: "ai", description: "Un artisan relance un client au téléphone depuis sa camionnette" })

    const content = db.tables.blog_posts[0].content as string
    const images = imageLines(content)
    expect(images).toHaveLength(4)
    expect(images[0][1]).toBe("Un artisan relance un client au téléphone depuis sa camionnette")
    // Jamais sous un titre, jamais dans l'introduction ni dans la FAQ ; toujours après un paragraphe de texte
    expect(content).not.toMatch(/^#{2,3} [^\n]+\n\n!\[/m)
    expect(content.slice(0, content.indexOf("## Quand relancer"))).not.toContain("![")
    expect(content.slice(content.indexOf("## Questions fréquentes"))).not.toContain("![")
    // Réparties : au moins 250 mots de texte entre deux photos, et pas deux photos dans le même paragraphe
    const gaps = content
      .split(/\n\n!\[[^\n]+\)\n\n/)
      .slice(1, -1)
      .map((part) => part.split(/\s+/).length)
    expect(gaps).toHaveLength(3)
    for (const gap of gaps) expect(gap).toBeGreaterThanOrEqual(250)

    const state = stateOf(db)
    expect(state.images).toHaveLength(4)
    expect(state.images.every((i) => i.url && !i.error && SECTIONS.includes(i.heading))).toBe(true)
    // La couverture n'est pas dans le texte et la photo n'a pas pris sa place
    expect(db.tables.blog_posts[0].cover_url).toContain("covers/")
    expect(db.tables.blog_posts[0].ai_model).toContain("photos ")
    expect(state.passes).toBe(10)
  })

  it("selon la longueur : trois photos pour un article de 1 500 mots", async () => {
    writeContent = `Introduction sur les relances.\n\n${SECTIONS.slice(0, 3).map(section).join("\n\n")}\n\n## Questions fréquentes\n\n### Combien ?\nDeux ou trois.\n\n## Pour aller plus loin\n\nEssayez Qonforme pour vos devis.`
    fixContent = writeContent
    const { db, client, topicId } = withPhotos()
    const job = await startJob(client, topicId)
    const outcomes = await runAll(client, job.id)
    expect(outcomes.filter((o) => o.ran === "images")).toHaveLength(3)
    expect(imageLines(db.tables.blog_posts[0].content as string)).toHaveLength(3)
  })

  it("le plafond des Préférences borne le nombre de photos", async () => {
    writeContent = IMAGED
    const { db, client, topicId } = withPhotos(2)
    const job = await startJob(client, topicId)
    const outcomes = await runAll(client, job.id)
    expect(outcomes.filter((o) => o.ran === "images")).toHaveLength(2)
    expect(imageLines(db.tables.blog_posts[0].content as string)).toHaveLength(2)
  })

  it("préférence à zéro, ou travail créé avant la préférence : aucune passe de photos", async () => {
    writeContent = IMAGED
    const none = withPhotos(0)
    const jobA = await startJob(none.client, none.topicId)
    expect((await runAll(none.client, jobA.id)).map((o) => o.ran)).not.toContain("images")

    const old = withPhotos()
    const jobB = await startJob(old.client, old.topicId)
    delete (old.db.tables.seo_article_jobs[0].state as { input: Record<string, unknown> }).input.inlineImages
    const outcomes = await runAll(old.client, jobB.id)
    expect(outcomes.map((o) => o.ran)).not.toContain("images")
    expect(mocks.image).not.toHaveBeenCalled()
  })

  it("une photo qui échoue est notée et passée : l'article sort avec les autres", async () => {
    writeContent = IMAGED
    const { ModelError } = await import("@/lib/seo/articles/models")
    let n = 0
    mocks.image.mockImplementation(async ({ model }: { model: string }) => {
      if (++n === 2) throw new ModelError("http", "Gemini indisponible (503).")
      return { data: Buffer.from("png"), mimeType: "image/png", model }
    })
    const { db, client, topicId } = withPhotos()
    const job = await startJob(client, topicId)
    const outcomes = await runAll(client, job.id)
    expect(outcomes.at(-1)?.status).toBe("done")
    expect(outcomes.filter((o) => o.ran === "images")).toHaveLength(4)
    expect(imageLines(db.tables.blog_posts[0].content as string)).toHaveLength(3)
    const state = stateOf(db)
    expect(state.images[1]).toMatchObject({ error: "Gemini indisponible (503)." })
    expect(state.notices?.join(" ")).toContain(`Photo de « ${state.images[1].heading} » non créée`)
  })

  it("quota épuisé : les photos restantes sont abandonnées d'un coup, l'article sort quand même", async () => {
    writeContent = IMAGED
    const { ModelError } = await import("@/lib/seo/articles/models")
    mocks.image.mockRejectedValue(new ModelError("quota", "Google refuse le modèle d'image (429) : quota épuisé.", false))
    const { db, client, topicId } = withPhotos()
    const job = await startJob(client, topicId)
    const outcomes = await runAll(client, job.id)
    expect(outcomes.at(-1)?.status).toBe("done")
    expect(outcomes.filter((o) => o.ran === "images")).toHaveLength(1)
    expect(mocks.image).toHaveBeenCalledTimes(1)
    expect(imageLines(db.tables.blog_posts[0].content as string)).toHaveLength(0)
    expect(stateOf(db).notices?.join(" ")).toContain("Photos du texte non créées")
  })

  it("clé du modèle d'image absente : rien n'est lu ni payé, une seule passe, l'article sort", async () => {
    writeContent = IMAGED
    const { db, client, topicId } = withPhotos()
    const job = await startJob(client, topicId)
    delete process.env.GEMINI_API_KEY
    const outcomes = await runAll(client, job.id)
    expect(outcomes.at(-1)?.status).toBe("done")
    expect(outcomes.filter((o) => o.ran === "images")).toHaveLength(1)
    expect(mocks.image).not.toHaveBeenCalled()
    expect(calls.filter((c) => c.pass === "PASSAGE" || c.pass === "PARAGRA")).toHaveLength(0)
    expect(stateOf(db).notices?.join(" ")).toContain("clé GEMINI_API_KEY absente")
    expect(imageLines(db.tables.blog_posts[0].content as string)).toHaveLength(0)
  })

  it("modèle de lecture indisponible : la scène vient des mots du passage, la photo est quand même créée", async () => {
    writeContent = IMAGED
    const { ModelError } = await import("@/lib/seo/articles/models")
    const scripted = mocks.text.getMockImplementation()!
    mocks.text.mockImplementation(async (input: { prompt: string }) => {
      if (input.prompt.startsWith("PASSAGE") || input.prompt.startsWith("PARAGRA")) throw new ModelError("quota", "Quota épuisé", false)
      return scripted(input)
    })
    const { db, client, topicId } = withPhotos(1)
    const job = await startJob(client, topicId)
    const outcomes = await runAll(client, job.id)
    expect(outcomes.at(-1)?.status).toBe("done")
    expect(mocks.image).toHaveBeenCalledTimes(1)
    expect(imageLines(db.tables.blog_posts[0].content as string)).toHaveLength(1)
  })

  it("peu de places : moins de photos que demandé ; aucune section ne se prête à une photo : une note, pas d'échec", async () => {
    writeContent = CLEAN
    const { db, client, topicId } = withPhotos()
    const job = await startJob(client, topicId)
    const outcomes = await runAll(client, job.id)
    expect(outcomes.at(-1)?.status).toBe("done")
    // CLEAN n'a qu'un paragraphe de développement, collé à la FAQ : aucune place qui ne soit pas tout en bas
    expect(mocks.image).not.toHaveBeenCalled()
    expect(stateOf(db).notices?.join(" ")).toContain("aucune section ne s'y prête")
    writeContent = "Introduction sans aucun titre de section.\n\n" + words(1700)
    fixContent = writeContent
    const flat = withPhotos()
    mocks.image.mockClear()
    const job2 = await startJob(flat.client, flat.topicId)
    const flatOutcomes = await runAll(flat.client, job2.id)
    expect(flatOutcomes.at(-1)?.status).toBe("done")
    expect(mocks.image).not.toHaveBeenCalled()
    expect(stateOf(flat.db).notices?.join(" ")).toContain("aucune section ne s'y prête")
  })
})
