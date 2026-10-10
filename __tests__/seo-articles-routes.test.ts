import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { NextRequest } from "next/server"
import { fakeArticlesDb, uuid, type FakeArticlesDb, type Row } from "./seo-articles-fake-db"

const state = vi.hoisted(() => ({
  admin: true,
  db: null as unknown as { client: unknown },
  text: [] as string[],
  gemini: 0,
}))

vi.mock("@/lib/supabase/server", () => ({ createClient: async () => state.db.client, createAdminClient: () => state.db.client }))
vi.mock("@/lib/admin-require", () => ({ isAdminAuthenticated: async () => state.admin }))
vi.mock("next/cache", () => ({ revalidatePath: () => {} }))
// L'ancien générateur ne doit jamais appeler Gemini pour de vrai dans les tests
vi.mock("@/lib/ai/gemini", () => ({
  generateBlogPost: async () => {
    state.gemini++
    throw new Error("Gemini simulé : aucun appel réel")
  },
  generateCoverImage: async () => {
    state.gemini++
    throw new Error("Gemini simulé : aucun appel réel")
  },
}))
vi.mock("@/lib/seo/articles/models", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/seo/articles/models")>()),
  generateText: async ({ model, prompt }: { model: string; prompt: string }) => {
    state.text.push(prompt.slice(0, 7))
    return {
      text: JSON.stringify({
        title: "Relancer une facture impayée sans perdre le client",
        slug: "relancer-facture",
        metaDescription: "m".repeat(130),
        outline: [{ h2: "Quand relancer", h3: [] }, { h2: "Que dire", h3: [] }, { h2: "Les pénalités", h3: [] }],
        faq: [],
        keywords: [],
        sources: [],
      }),
      model,
      usage: { inputTokens: 1, outputTokens: 1 },
    }
  },
  generateImage: async () => {
    throw new Error("pas d'image dans les tests")
  },
}))

import { POST as generate } from "@/app/api/admin/seo/articles/generate/route"
import { POST as step } from "@/app/api/admin/seo/articles/jobs/[id]/step/route"
import { GET as readJobRoute } from "@/app/api/admin/seo/articles/jobs/[id]/route"
import { PATCH as patchPost } from "@/app/api/admin/seo/articles/posts/[id]/route"
import { POST as createTopic } from "@/app/api/admin/seo/topics/route"
import { PATCH as patchTopic } from "@/app/api/admin/seo/topics/[id]/route"
import { POST as bulk } from "@/app/api/admin/seo/topics/bulk/route"
import { GET as oldCron } from "@/app/api/cron/generate-blog/route"
import { PATCH as patchBlogPost } from "@/app/api/admin/blog/[id]/route"
import { parisDayTime } from "@/lib/seo/articles/schedule"

const env = { ...process.env }
let db: FakeArticlesDb

const req = (url: string, method: string, body?: unknown, headers?: Record<string, string>) =>
  new NextRequest(`http://localhost${url}`, { method, body: body === undefined ? undefined : JSON.stringify(body), headers })
const params = (id: string) => ({ params: Promise.resolve({ id }) })

function topic(over: Row = {}): Row {
  return {
    id: uuid(),
    title: "Réforme 2027 : ce qui change pour une TPE du bâtiment",
    keyword: "réforme 2027 facturation",
    article_type: "news",
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

function post(over: Row = {}): Row {
  return {
    id: uuid(),
    slug: "un-article",
    title: "Un article",
    excerpt: "Résumé",
    content: "Un texte propre sur la facturation.",
    is_published: false,
    published_at: null,
    scheduled_at: null,
    review_status: "to_review",
    seo_description: null,
    held_reason: null,
    ...over,
  }
}

function inDays(n: number): string {
  return parisDayTime(new Date(Date.now() + n * 86_400_000)).day
}

beforeEach(() => {
  state.admin = true
  state.text = []
  state.gemini = 0
  process.env.GEMINI_API_KEY = "cle-gemini-test"
  process.env.ANTHROPIC_API_KEY = "cle-anthropic-test"
  db = fakeArticlesDb({ seo_topics: [], blog_posts: [], seo_article_jobs: [], seo_settings: [], seo_keywords: [], cron_logs: [] })
  state.db = db
})

afterEach(() => {
  process.env = { ...env }
})

describe("accès", () => {
  it("toutes les routes répondent 401 sans session admin", async () => {
    state.admin = false
    const id = uuid()
    const responses = await Promise.all([
      generate(req("/api/admin/seo/articles/generate", "POST", {})),
      step(req(`/api/admin/seo/articles/jobs/${id}/step`, "POST"), params(id)),
      readJobRoute(req(`/api/admin/seo/articles/jobs/${id}`, "GET"), params(id)),
      patchPost(req(`/api/admin/seo/articles/posts/${id}`, "PATCH", { action: "publish" }), params(id)),
      createTopic(req("/api/admin/seo/topics", "POST", {})),
      patchTopic(req(`/api/admin/seo/topics/${id}`, "PATCH", { action: "archive" }), params(id)),
      bulk(req("/api/admin/seo/topics/bulk", "POST", { ids: [id], action: "draft" })),
    ])
    expect(responses.map((r) => r.status)).toEqual([401, 401, 401, 401, 401, 401, 401])
  })
})

describe("POST /api/admin/seo/articles/generate", () => {
  it("valide le corps", async () => {
    const res = await generate(req("/api/admin/seo/articles/generate", "POST", { articleType: "guide", lengthMin: 1500, lengthMax: 2500, publication: "draft" }))
    expect(res.status).toBe(400)
    expect((await res.json()).error).toBe("Choisissez un sujet ou saisissez-en un")
    const sched = await generate(req("/api/admin/seo/articles/generate", "POST", { title: "Un sujet valable", articleType: "guide", lengthMin: 1500, lengthMax: 2500, publication: "schedule" }))
    expect(sched.status).toBe(400)
    expect((await sched.json()).fieldErrors.day).toMatch(/jour et l'heure/)
    const bad = await generate(req("/api/admin/seo/articles/generate", "POST", { title: "Un sujet valable", articleType: "roman", lengthMin: 1500, lengthMax: 2500, publication: "draft" }))
    expect(bad.status).toBe(400)
  })

  it("crée le sujet saisi et sa rédaction ; « Planifier » fixe la date et le contrôle avant publication", async () => {
    const day = inDays(3)
    const res = await generate(
      req("/api/admin/seo/articles/generate", "POST", {
        title: "Facturer un acompte sur un chantier",
        keyword: "Facture Acompte  Chantier",
        articleType: "howto",
        angle: "varied",
        lengthMin: 1200,
        lengthMax: 1800,
        publication: "schedule",
        day,
        time: "08:00",
      }),
    )
    expect(res.status).toBe(200)
    const body = await res.json()
    const t = db.tables.seo_topics.find((x) => x.id === body.topicId)!
    expect(t).toMatchObject({ title: "Facturer un acompte sur un chantier", keyword: "facture acompte chantier", source: "manual", status: "generating", publish_mode: "after_check" })
    expect(parisDayTime(t.scheduled_at as string)).toEqual({ day, time: "08:00" })
    const job = db.tables.seo_article_jobs[0]
    expect(job).toMatchObject({ id: body.jobId, status: "queued", step: "plan", model: "claude-opus-5-5" })
    expect((job.state as { input: Row }).input).toMatchObject({ lengthMin: 1200, lengthMax: 1800, planModel: "gemini-3.8-flash", reviewModel: "gemini-3.8-flash", imageModel: "gemini-nano-banana-2.1" })
  })

  it("refuse un sujet qui nomme un concurrent suivi, et un sujet déjà en rédaction", async () => {
    const res = await generate(req("/api/admin/seo/articles/generate", "POST", { title: "Tolteck face aux autres", articleType: "guide", lengthMin: 1500, lengthMax: 2500, publication: "draft" }))
    expect(res.status).toBe(400)
    expect((await res.json()).error).toMatch(/concurrent suivi/)

    const busy = topic({ status: "generating" })
    db.tables.seo_topics.push(busy)
    const again = await generate(req("/api/admin/seo/articles/generate", "POST", { topicId: busy.id, articleType: "guide", lengthMin: 1500, lengthMax: 2500, publication: "draft" }))
    expect(again.status).toBe(409)
  })
})

describe("POST /api/admin/seo/articles/jobs/<id>/step", () => {
  it("joue une seule passe par appel et rend l'étape suivante", async () => {
    const t = topic()
    db.tables.seo_topics.push(t)
    const created = await (await generate(req("/api/admin/seo/articles/generate", "POST", { topicId: t.id, articleType: "news", lengthMin: 1500, lengthMax: 2500, publication: "draft" }))).json()
    const res = await step(req(`/api/admin/seo/articles/jobs/${created.jobId}/step`, "POST"), params(created.jobId))
    expect(res.status).toBe(200)
    expect(await res.json()).toMatchObject({ ran: "plan", step: "write", status: "queued", label: "Rédaction…", error: null })
    expect(state.text).toEqual(["PASSE 1"])
    const read = await (await readJobRoute(req(`/api/admin/seo/articles/jobs/${created.jobId}`, "GET"), params(created.jobId))).json()
    expect(read).toMatchObject({ step: "write", label: "Rédaction…" })
    expect((await step(req("/api/admin/seo/articles/jobs/x/step", "POST"), params("x"))).status).toBe(400)
  })

  it("409 quand une autre passe tient le verrou", async () => {
    const jobId = uuid()
    db.tables.seo_article_jobs.push({ id: jobId, topic_id: null, status: "running", step: "write", state: { input: {} }, attempts: 0, lock_until: new Date(Date.now() + 60_000).toISOString() })
    const res = await step(req(`/api/admin/seo/articles/jobs/${jobId}/step`, "POST"), params(jobId))
    expect(res.status).toBe(409)
    expect(await res.json()).toMatchObject({ locked: true })
  })
})

describe("PATCH /api/admin/seo/articles/posts/<id>", () => {
  it("« Publier maintenant » refusé tant qu'une valeur périmée reste", async () => {
    const p = post({ content: "Le seuil de franchise est de 36 800 € pour les services." })
    db.tables.blog_posts.push(p)
    const res = await patchPost(req(`/api/admin/seo/articles/posts/${p.id}`, "PATCH", { action: "publish" }), params(p.id as string))
    expect(res.status).toBe(409)
    const body = await res.json()
    expect(body.code).toBe("check_failed")
    expect(body.issues[0].label).toBe("Anciens seuils de franchise de TVA")
    expect(db.tables.blog_posts[0].is_published).toBe(false)
  })

  it("publie un texte propre, puis le repasse en brouillon", async () => {
    const p = post({ content: "Un texte qui parle de PDP." })
    const t = topic({ status: "drafted", post_id: p.id })
    db.tables.blog_posts.push(p)
    db.tables.seo_topics.push(t)
    const res = await patchPost(req(`/api/admin/seo/articles/posts/${p.id}`, "PATCH", { action: "publish" }), params(p.id as string))
    expect(res.status).toBe(200)
    expect(db.tables.blog_posts[0]).toMatchObject({ is_published: true, review_status: "approved", held_reason: null })
    expect(db.tables.seo_topics[0].status).toBe("published")

    const back = await patchPost(req(`/api/admin/seo/articles/posts/${p.id}`, "PATCH", { action: "unpublish" }), params(p.id as string))
    expect(back.status).toBe(200)
    expect(db.tables.blog_posts[0]).toMatchObject({ is_published: false, scheduled_at: null, review_status: null })
    expect(db.tables.seo_topics[0].status).toBe("drafted")
    expect((await patchPost(req(`/api/admin/seo/articles/posts/${p.id}`, "PATCH", { action: "supprimer" }), params(p.id as string))).status).toBe(400)
    expect((await patchPost(req(`/api/admin/seo/articles/posts/${uuid()}`, "PATCH", { action: "publish" }), params(uuid()))).status).toBe(404)
  })
})

describe("sujets", () => {
  it("crée un sujet planifié (heure de Paris) et refuse une date passée", async () => {
    const day = inDays(5)
    const res = await createTopic(req("/api/admin/seo/topics", "POST", { title: "Autoliquidation : la mention à écrire", articleType: "guide", schedule: { day, time: "09:30", publishMode: "after_check" } }))
    expect(res.status).toBe(201)
    const { topic: created } = await res.json()
    expect(created).toMatchObject({ status: "planned", publish_mode: "after_check", source: "manual" })
    expect(parisDayTime(created.scheduled_at)).toEqual({ day, time: "09:30" })

    const past = await createTopic(req("/api/admin/seo/topics", "POST", { title: "Un sujet dans le passé", articleType: "guide", schedule: { day: "2020-01-06", time: "08:00", publishMode: "draft" } }))
    expect(past.status).toBe(400)
    expect((await past.json()).error).toMatch(/à venir/)
    expect((await createTopic(req("/api/admin/seo/topics", "POST", { title: "abc", articleType: "guide" }))).status).toBe(400)

    const impossible = await createTopic(req("/api/admin/seo/topics", "POST", { title: "Un sujet au 30 février", articleType: "guide", schedule: { day: "2027-02-30", time: "08:00", publishMode: "draft" } }))
    expect(impossible.status).toBe(400)
    expect((await impossible.json()).error).toMatch(/n'existe pas/)
    expect(db.tables.seo_topics).toHaveLength(1)
  })

  it("contrôle les transitions côté serveur", async () => {
    const generating = topic({ status: "generating" })
    const planned = topic({ status: "planned", scheduled_at: new Date(Date.now() + 86_400_000).toISOString() })
    db.tables.seo_topics.push(generating, planned)

    const refused = await patchTopic(req(`/api/admin/seo/topics/${generating.id}`, "PATCH", { action: "archive" }), params(generating.id as string))
    expect(refused.status).toBe(409)
    expect((await patchTopic(req(`/api/admin/seo/topics/${generating.id}`, "PATCH", { action: "draft" }), params(generating.id as string))).status).toBe(409)

    const un = await patchTopic(req(`/api/admin/seo/topics/${planned.id}`, "PATCH", { action: "unschedule" }), params(planned.id as string))
    expect(un.status).toBe(200)
    expect(db.tables.seo_topics[1]).toMatchObject({ status: "unplanned", scheduled_at: null })

    const drafted = await patchTopic(req(`/api/admin/seo/topics/${planned.id}`, "PATCH", { action: "draft" }), params(planned.id as string))
    expect(drafted.status).toBe(200)
    expect((await drafted.json()).jobId).toBeTruthy()
    expect(db.tables.seo_topics[1].status).toBe("generating")

    expect((await patchTopic(req(`/api/admin/seo/topics/${planned.id}`, "PATCH", { action: "voler" }), params(planned.id as string))).status).toBe(400)
  })

  it("« Planifier » groupé : créneaux suivants du rythme, un par jour", async () => {
    const a = topic()
    const b = topic({ title: "Facture électronique : ce que l'artisan doit préparer" })
    const done = topic({ status: "published" })
    db.tables.seo_topics.push(a, b, done)
    const res = await bulk(req("/api/admin/seo/topics/bulk", "POST", { ids: [a.id, b.id, done.id], action: "schedule" }))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.updated).toBe(2)
    expect(body.skipped).toHaveLength(1)
    const days = db.tables.seo_topics.slice(0, 2).map((t) => parisDayTime(t.scheduled_at as string))
    // Rythme par défaut : 1 article par semaine, le lundi à 08:00 (Paris)
    expect(days.every((d) => d.time === "08:00")).toBe(true)
    expect(days[0].day).not.toBe(days[1].day)
    expect(new Date(`${days[0].day}T12:00:00Z`).getUTCDay()).toBe(1)
    expect(db.tables.seo_topics.slice(0, 2).every((t) => t.status === "planned" && t.publish_mode === "draft")).toBe(true)
    expect((await bulk(req("/api/admin/seo/topics/bulk", "POST", { ids: [], action: "schedule" }))).status).toBe(400)
  })
})

describe("ancien générateur /api/cron/generate-blog", () => {
  const cronReq = () => req("/api/cron/generate-blog", "GET", undefined, { Authorization: "Bearer secret-cron" })

  it("ne génère plus rien quand l'onglet SEO est en place, et le journalise", async () => {
    process.env.CRON_SECRET = "secret-cron"
    const res = await oldCron(cronReq())
    expect(res.status).toBe(200)
    expect(await res.json()).toMatchObject({ ok: true, skipped: "remplacé par l'onglet SEO (/api/cron/seo)" })
    expect(db.tables.cron_logs[0]).toMatchObject({ job_name: "generate-blog", status: "ok", results: { skipped: "remplacé par l'onglet SEO (/api/cron/seo)" } })
    expect(db.tables.blog_posts).toHaveLength(0)
  })

  it("sans la migration, garde son comportement", async () => {
    process.env.CRON_SECRET = "secret-cron"
    db.missing.add("seo_settings")
    // Tous les sujets historiques déjà couverts : l'ancien chemin répond sans appeler Gemini
    const { SEO_TOPICS } = await import("@/lib/ai/seo-topics")
    db.tables.blog_posts.push(...SEO_TOPICS.map((t, i) => ({ id: uuid(), slug: `s-${i}`, title: t.topic, ai_prompt: `Sujet: ${t.topic} | Mots-clés: ${t.keywords.join(", ")}`, is_published: true })))
    const res = await oldCron(cronReq())
    const body = await res.json()
    expect(body).not.toHaveProperty("skipped", "remplacé par l'onglet SEO (/api/cron/seo)")
    expect(body).toMatchObject({ ok: true, skipped: true })
    expect(state.gemini).toBe(0)
  })

  it("lecture de seo_settings en échec : saute aussi (jamais deux générateurs)", async () => {
    process.env.CRON_SECRET = "secret-cron"
    db.failing.add("seo_settings")
    const res = await oldCron(cronReq())
    expect(await res.json()).toMatchObject({ ok: true, skipped: "remplacé par l'onglet SEO (/api/cron/seo)", note: "lecture de seo_settings en échec" })
    expect(state.gemini).toBe(0)
    expect(db.tables.blog_posts).toHaveLength(0)
  })

  it("refuse sans le secret", async () => {
    process.env.CRON_SECRET = "secret-cron"
    expect((await oldCron(req("/api/cron/generate-blog", "GET"))).status).toBe(401)
  })
})

describe("éditeur du blog : PATCH /api/admin/blog/<id>", () => {
  const blogReq = (id: string, body: unknown) => req(`/api/admin/blog/${id}`, "PATCH", body)
  const forbidden = {
    version: 1,
    checkedAt: "2026-10-09T08:00:00.000Z",
    blocking: 1,
    issues: [{ kind: "review", rule: "forbidden_claim", label: "Affirmation interdite (contrôle factuel)", detail: "Qonforme n'est pas certifié", excerpt: "logiciel certifié par l'État", blocking: true, fixable: true }],
  }

  it("article de l'onglet SEO : même garde que « Publier maintenant », modifications enregistrées", async () => {
    const p = post({ content: "Un logiciel certifié par l'État pour vos devis.", audit_result: forbidden })
    const t = topic({ status: "drafted", post_id: p.id })
    db.tables.blog_posts.push(p)
    db.tables.seo_topics.push(t)
    const res = await patchBlogPost(blogReq(p.id as string, { excerpt: "Nouveau résumé", is_published: true }), params(p.id as string))
    expect(res.status).toBe(409)
    const body = await res.json()
    expect(body.code).toBe("check_failed")
    expect(body.error).toContain("Affirmation interdite (contrôle factuel)")
    expect(db.tables.blog_posts[0]).toMatchObject({ is_published: false, excerpt: "Nouveau résumé" })
    expect(JSON.stringify(db.tables.blog_posts[0].audit_result)).toContain("logiciel certifié par l'État")

    // Passage corrigé dans l'éditeur : publié, sujet à jour
    const ok = await patchBlogPost(blogReq(p.id as string, { content: "Un logiciel pour vos devis.", is_published: true }), params(p.id as string))
    expect(ok.status).toBe(200)
    expect(db.tables.blog_posts[0]).toMatchObject({ is_published: true, review_status: "approved" })
    expect(db.tables.seo_topics[0].status).toBe("published")
  })

  it("article manuel sans audit_result : comportement habituel", async () => {
    const p = post({ content: "Le seuil de franchise est de 36 800 € pour les services.", review_status: null })
    db.tables.blog_posts.push(p)
    const res = await patchBlogPost(blogReq(p.id as string, { is_published: true }), params(p.id as string))
    expect(res.status).toBe(200)
    expect(db.tables.blog_posts[0].is_published).toBe(true)
    expect(db.tables.blog_posts[0].published_at).toBeTruthy()
  })
})
