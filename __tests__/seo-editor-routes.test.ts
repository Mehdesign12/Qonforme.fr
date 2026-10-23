import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { NextRequest } from "next/server"
import { fakeArticlesDb, uuid, type FakeArticlesDb, type Row } from "./seo-articles-fake-db"
import { SETTINGS_DEFAULTS } from "@/lib/seo/settings-schema"
import { brandOfDomain } from "@/lib/seo/competitors"

const state = vi.hoisted(() => ({
  admin: true,
  client: null as unknown,
  revalidated: [] as string[],
  text: null as null | ((input: { model: string; system: string; prompt: string }) => Promise<{ text: string; model: string; usage: { inputTokens: number | null; outputTokens: number | null } }>),
  prompts: [] as string[],
}))

vi.mock("@/lib/supabase/server", () => ({ createClient: async () => state.client, createAdminClient: () => state.client }))
vi.mock("@/lib/admin-require", () => ({ isAdminAuthenticated: async () => state.admin }))
vi.mock("next/cache", () => ({ revalidatePath: (p: string) => state.revalidated.push(p) }))
vi.mock("@/lib/seo/articles/models", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/seo/articles/models")>()),
  generateText: async (input: { model: string; system: string; prompt: string }) => {
    state.prompts.push(`${input.system}\n${input.prompt}`)
    if (!state.text) throw new Error("aucune réponse simulée")
    return state.text(input)
  },
}))

import { POST as createPost } from "@/app/api/admin/blog/route"
import { PATCH as patchPost } from "@/app/api/admin/blog/[id]/route"
import { GET as seoContext } from "@/app/api/admin/blog/seo-context/route"
import { POST as suggest } from "@/app/api/admin/blog/suggest/route"
import { POST as assist } from "@/app/api/admin/blog/assist/route"
import { POST as integrate } from "@/app/api/admin/blog/integrate-keyword/route"
import { POST as importPlan } from "@/app/api/admin/seo/keywords/plan/route"
import { ModelError } from "@/lib/seo/articles/models"
import { PLAN_KEYWORDS, PLAN_NOTE } from "@/lib/seo/keywords/plan"
import type { AssistResponse, IntegrateResponse, PlanImportResult, SeoContext, SuggestResponse } from "@/lib/seo/articles/editor-types"

/* ------------------------------------------------------------------ */
/* Base simulée : colonnes absentes, fonctions SQL, pagination           */
/* ------------------------------------------------------------------ */

type Builder = Record<string, unknown>
const MISSING = { data: null, error: { code: "PGRST204", message: "Could not find the column of 'blog_posts' in the schema cache" } }

function failing(): Builder {
  const b: Builder = {}
  const self = () => b
  Object.assign(b, {
    select: self,
    eq: self,
    order: self,
    limit: self,
    single: async () => MISSING,
    maybeSingle: async () => MISSING,
    then: (resolve: (v: unknown) => unknown) => Promise.resolve(MISSING).then(resolve),
  })
  return b
}

/** Client de la base simulée, avec des colonnes absentes et des fonctions SQL (rpc). */
function clientOf(db: FakeArticlesDb, opts: { missingColumns?: string[]; rpcs?: Record<string, Row[]>; rpcError?: boolean } = {}) {
  const missing = new Set(opts.missingColumns ?? [])
  const base = db.client as { from: (t: string) => Builder; storage: unknown }
  const touches = (v: unknown) => (Array.isArray(v) ? v : [v]).some((r) => r && Object.keys(r as Row).some((k) => missing.has(k)))
  return {
    storage: base.storage,
    from(table: string) {
      const b = base.from(table)
      // Pagination de PostgREST (listAllKeywords) : la base simulée rend tout en une page
      b.range = () => b
      return new Proxy(b, {
        get(target, prop: string) {
          if (prop === "insert" || prop === "update" || prop === "upsert") {
            return (v: unknown, o?: unknown) => (touches(v) ? failing() : (target[prop] as (v: unknown, o?: unknown) => Builder)(v, o))
          }
          if (prop === "select") {
            return (cols?: string, o?: unknown) =>
              cols && cols.split(",").some((c) => missing.has(c.trim())) ? failing() : (target.select as (c?: string, o?: unknown) => Builder)(cols, o)
          }
          return target[prop]
        },
      })
    },
    rpc(name: string) {
      const res = opts.rpcError ? { data: null, error: { message: "fetch failed: timeout" } } : { data: opts.rpcs?.[name] ?? [], error: null }
      const b: Builder = {}
      Object.assign(b, { filter: () => b, range: () => b, then: (resolve: (v: unknown) => unknown) => Promise.resolve(res).then(resolve) })
      return b
    },
  }
}

let db: FakeArticlesDb
const req = (url: string, method: string, body?: unknown) =>
  new NextRequest(`http://localhost${url}`, { method, body: body === undefined ? undefined : JSON.stringify(body) })
const params = (id: string) => ({ params: Promise.resolve({ id }) })

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
    review_status: null,
    seo_description: null,
    held_reason: null,
    created_at: "2026-10-01T08:00:00.000Z",
    ...over,
  }
}

const inHours = (h: number) => new Date(Date.now() + h * 3600_000).toISOString()
const competitor = SETTINGS_DEFAULTS.targeting.competitors[0]

beforeEach(() => {
  state.admin = true
  state.revalidated = []
  state.prompts = []
  state.text = null
  db = fakeArticlesDb({ blog_posts: [], seo_topics: [], seo_settings: [], seo_keywords: [] })
  state.client = clientOf(db)
})

afterEach(() => {
  vi.restoreAllMocks()
})

/* ------------------------------------------------------------------ */
/* POST /api/admin/blog                                                */
/* ------------------------------------------------------------------ */

describe("POST /api/admin/blog", () => {
  const body = { title: "Exemple de devis de maçonnerie", slug: "exemple-devis-maconnerie", content: "## Lignes\n\nTexte." }

  it("crée l'article et rend son identifiant et son adresse (201)", async () => {
    const res = await createPost(req("/api/admin/blog", "POST", { ...body, target_keyword: "  Exemple Devis Maçonnerie ", cover_alt: "Un maçon  monte un mur", seo_title: "Exemple de devis de maçonnerie" }))
    expect(res.status).toBe(201)
    const json = await res.json()
    expect(json).toEqual({ success: true, id: db.tables.blog_posts[0].id, slug: "exemple-devis-maconnerie" })
    expect(db.tables.blog_posts[0]).toMatchObject({ target_keyword: "exemple devis maçonnerie", cover_alt: "Un maçon monte un mur", seo_title: "Exemple de devis de maçonnerie", is_published: false })
  })

  it("programmé : date gardée, article hors ligne", async () => {
    const at = inHours(48)
    const res = await createPost(req("/api/admin/blog", "POST", { ...body, scheduled_at: at }))
    expect(res.status).toBe(201)
    expect(db.tables.blog_posts[0]).toMatchObject({ scheduled_at: new Date(at).toISOString(), is_published: false, published_at: null })
    expect(state.revalidated).toHaveLength(0)
  })

  it("400 : champs manquants, adresse invalide, date passée, publication et programmation à la fois", async () => {
    expect((await createPost(req("/api/admin/blog", "POST", { title: "x" }))).status).toBe(400)
    const bad = await createPost(req("/api/admin/blog", "POST", { ...body, slug: "Devis Maçon" }))
    expect(bad.status).toBe(400)
    expect((await bad.json()).error).toContain("Adresse invalide")
    const past = await createPost(req("/api/admin/blog", "POST", { ...body, scheduled_at: "2020-01-01T08:00:00Z" }))
    expect(past.status).toBe(400)
    expect((await past.json()).error).toContain("à venir")
    expect((await createPost(req("/api/admin/blog", "POST", { ...body, is_published: true, scheduled_at: inHours(5) }))).status).toBe(400)
    expect(db.tables.blog_posts).toHaveLength(0)
  })

  it("400 : adresse de couverture qui n'est pas une adresse web (javascript:, guillemets)", async () => {
    for (const cover_url of ["javascript:alert(1)", 'https://exemple.fr/x.jpg" onerror="x', "//exemple.fr/x.jpg"]) {
      const res = await createPost(req("/api/admin/blog", "POST", { ...body, cover_url }))
      expect(res.status, cover_url).toBe(400)
    }
    expect(db.tables.blog_posts).toHaveLength(0)
    const ok = await createPost(req("/api/admin/blog", "POST", { ...body, slug: "devis--placo-", cover_url: "https://exemple.fr/x.jpg#w=1600&h=900" }))
    expect(ok.status).toBe(201)
    expect(db.tables.blog_posts[0]).toMatchObject({ slug: "devis-placo", cover_url: "https://exemple.fr/x.jpg#w=1600&h=900" })
  })

  it("adresse déjà prise : 409", async () => {
    db.tables.blog_posts.push(post({ slug: body.slug }))
    const res = await createPost(req("/api/admin/blog", "POST", body))
    expect(res.status).toBe(409)
    expect((await res.json()).error).toBe("Cette adresse est déjà utilisée par un autre article.")
  })

  it("colonnes facultatives absentes : créé sans elles ; programmation impossible : 503", async () => {
    state.client = clientOf(db, { missingColumns: ["cover_alt", "target_keyword", "scheduled_at", "seo_title"] })
    const res = await createPost(req("/api/admin/blog", "POST", { ...body, target_keyword: "devis", cover_alt: "Un mur" }))
    expect(res.status).toBe(201)
    expect(db.tables.blog_posts[0].cover_alt).toBeUndefined()
    const scheduled = await createPost(req("/api/admin/blog", "POST", { ...body, slug: "autre", scheduled_at: inHours(5) }))
    expect(scheduled.status).toBe(503)
    expect(db.tables.blog_posts).toHaveLength(1)
  })

  it("refuse sans session admin", async () => {
    state.admin = false
    expect((await createPost(req("/api/admin/blog", "POST", body))).status).toBe(403)
  })

  it("créé directement en ligne : même contrôle que « Publier maintenant », rien n'est créé si un passage bloque", async () => {
    const refused = await createPost(req("/api/admin/blog", "POST", { ...body, is_published: true, seo_title: `Mieux que ${competitor}` }))
    expect(refused.status).toBe(409)
    const json = await refused.json()
    expect(json).toMatchObject({ code: "check_failed", created: false })
    expect(json.issues.map((i: { label: string }) => i.label)).toContain("Concurrent nommé")
    expect(db.tables.blog_posts).toHaveLength(0)
    const ok = await createPost(req("/api/admin/blog", "POST", { ...body, is_published: true }))
    expect(ok.status).toBe(201)
    expect(db.tables.blog_posts[0]).toMatchObject({ is_published: true })
  })
})

/* ------------------------------------------------------------------ */
/* PATCH /api/admin/blog/<id>                                          */
/* ------------------------------------------------------------------ */

describe("PATCH /api/admin/blog/<id>", () => {
  it("mot-clé et texte alternatif enregistrés, sous leur forme propre", async () => {
    const p = post()
    db.tables.blog_posts.push(p)
    const res = await patchPost(req(`/api/admin/blog/${p.id}`, "PATCH", { target_keyword: "Devis  PLACO", cover_alt: " Cloison  en plaques " }), params(p.id as string))
    expect(res.status).toBe(200)
    expect(db.tables.blog_posts[0]).toMatchObject({ target_keyword: "devis placo", cover_alt: "Cloison en plaques" })
    // Retrait
    await patchPost(req(`/api/admin/blog/${p.id}`, "PATCH", { target_keyword: "", cover_alt: null }), params(p.id as string))
    expect(db.tables.blog_posts[0]).toMatchObject({ target_keyword: null, cover_alt: null })
  })

  it("programmer : hors ligne, plus de décision de relecture, blog rafraîchi si l'article y était", async () => {
    const p = post({ is_published: true, published_at: "2026-10-01T08:00:00.000Z", review_status: "approved", held_reason: "Retenu", slug: "en-ligne" })
    db.tables.blog_posts.push(p)
    const at = inHours(30)
    const res = await patchPost(req(`/api/admin/blog/${p.id}`, "PATCH", { scheduled_at: at, is_published: false }), params(p.id as string))
    expect(res.status).toBe(200)
    expect(db.tables.blog_posts[0]).toMatchObject({ is_published: false, scheduled_at: new Date(at).toISOString(), review_status: null, held_reason: null })
    expect(state.revalidated).toContain("/blog/en-ligne")
  })

  it("publier : la date programmée est retirée ; date de publication posée une seule fois", async () => {
    const p = post({ scheduled_at: inHours(10) })
    db.tables.blog_posts.push(p)
    const res = await patchPost(req(`/api/admin/blog/${p.id}`, "PATCH", { is_published: true }), params(p.id as string))
    expect(res.status).toBe(200)
    expect(db.tables.blog_posts[0]).toMatchObject({ is_published: true, scheduled_at: null })
    const first = db.tables.blog_posts[0].published_at
    expect(first).toBeTruthy()
    await patchPost(req(`/api/admin/blog/${p.id}`, "PATCH", { is_published: true, title: "Nouveau titre" }), params(p.id as string))
    expect(db.tables.blog_posts[0].published_at).toBe(first)
  })

  it("brouillon : « scheduled_at: null » retire la programmation", async () => {
    const p = post({ scheduled_at: inHours(10) })
    db.tables.blog_posts.push(p)
    await patchPost(req(`/api/admin/blog/${p.id}`, "PATCH", { is_published: false, scheduled_at: null }), params(p.id as string))
    expect(db.tables.blog_posts[0]).toMatchObject({ is_published: false, scheduled_at: null })
  })

  it("400 : date passée, sans fuseau, publication et programmation à la fois, mot-clé en adresse", async () => {
    const p = post()
    db.tables.blog_posts.push(p)
    const at = (b: unknown) => patchPost(req(`/api/admin/blog/${p.id}`, "PATCH", b), params(p.id as string))
    expect((await at({ scheduled_at: "2020-01-01T08:00:00Z" })).status).toBe(400)
    expect((await at({ scheduled_at: "2026-12-01T08:00:00" })).status).toBe(400)
    expect((await at({ scheduled_at: inHours(5), is_published: true })).status).toBe(400)
    expect((await at({ target_keyword: "https://qonforme.fr/modele" })).status).toBe(400)
    expect((await at({ title: "  " })).status).toBe(400)
    expect(db.tables.blog_posts[0]).toMatchObject({ scheduled_at: null, is_published: false, title: "Un article" })
  })

  it("article de l'onglet SEO publié depuis l'éditeur : même garde, date programmée retirée", async () => {
    const p = post({ content: "La franchise : 36 800 € en services.", review_status: "to_review", audit_result: { version: 1, checkedAt: "2026-10-09T08:00:00.000Z", blocking: 0, issues: [] }, scheduled_at: inHours(10) })
    db.tables.blog_posts.push(p)
    const res = await patchPost(req(`/api/admin/blog/${p.id}`, "PATCH", { is_published: true }), params(p.id as string))
    expect(res.status).toBe(409)
    expect((await res.json()).code).toBe("check_failed")
    expect(db.tables.blog_posts[0]).toMatchObject({ is_published: false, scheduled_at: null })
  })

  it("article écrit à la main publié depuis l'éditeur : contrôlé aussi (texte, titre Google, texte alternatif)", async () => {
    const p = post({ seo_title: `Logiciel de devis, mieux que ${competitor}` })
    db.tables.blog_posts.push(p)
    const res = await patchPost(req(`/api/admin/blog/${p.id}`, "PATCH", { is_published: true }), params(p.id as string))
    expect(res.status).toBe(409)
    expect((await res.json()).issues.map((i: { label: string }) => i.label)).toContain("Concurrent nommé")
    expect(db.tables.blog_posts[0].is_published).toBe(false)
    // Titre Google corrigé, mais concurrent dans le texte alternatif de la couverture
    const alt = await patchPost(req(`/api/admin/blog/${p.id}`, "PATCH", { seo_title: "Logiciel de devis", cover_alt: `Capture de ${competitor}`, is_published: true }), params(p.id as string))
    expect(alt.status).toBe(409)
    expect(db.tables.blog_posts[0]).toMatchObject({ is_published: false, seo_title: "Logiciel de devis" })
    const ok = await patchPost(req(`/api/admin/blog/${p.id}`, "PATCH", { cover_alt: "Un maçon au travail", is_published: true }), params(p.id as string))
    expect(ok.status).toBe(200)
    expect(db.tables.blog_posts[0].is_published).toBe(true)
  })

  it("programmer depuis l'éditeur : tous les sujets de l'article passent en « Directement », date recopiée sur un sujet rédigé ou planifié", async () => {
    const p = post()
    db.tables.blog_posts.push(p)
    const topic = (status: string) => ({ id: uuid(), title: "Sujet", status, publish_mode: "draft", post_id: p.id, scheduled_at: null, updated_at: "2026-10-01T08:00:00.000Z" })
    db.tables.seo_topics.push(topic("published"), topic("archived"), topic("drafted"), topic("generating"))
    const at = inHours(30)
    expect((await patchPost(req(`/api/admin/blog/${p.id}`, "PATCH", { scheduled_at: at }), params(p.id as string))).status).toBe(200)
    expect(db.tables.seo_topics.map((t) => [t.status, t.publish_mode, t.scheduled_at])).toEqual([
      ["published", "direct", null],
      ["archived", "direct", null],
      ["drafted", "direct", new Date(at).toISOString()],
      ["generating", "draft", null],
    ])
  })

  it("article retiré du blog depuis l'éditeur : son sujet redevient « rédigé »", async () => {
    const p = post({ is_published: true, published_at: "2026-10-01T08:00:00.000Z", review_status: "approved" })
    db.tables.blog_posts.push(p)
    db.tables.seo_topics.push({ id: uuid(), title: "Sujet", status: "published", publish_mode: "draft", post_id: p.id, scheduled_at: null, updated_at: "2026-10-01T08:00:00.000Z" })
    expect((await patchPost(req(`/api/admin/blog/${p.id}`, "PATCH", { is_published: false, scheduled_at: null }), params(p.id as string))).status).toBe(200)
    expect(db.tables.seo_topics[0].status).toBe("drafted")
  })

  it("texte modifié seul (l'éditeur n'envoie que ce qui change) : la page de l'article est rafraîchie ; adresse changée : l'ancienne et la nouvelle", async () => {
    const p = post({ is_published: true, published_at: "2026-10-01T08:00:00.000Z", slug: "ancienne" })
    db.tables.blog_posts.push(p)
    expect((await patchPost(req(`/api/admin/blog/${p.id}`, "PATCH", { content: "Texte corrigé." }), params(p.id as string))).status).toBe(200)
    expect(state.revalidated).toContain("/blog/ancienne")
    state.revalidated = []
    expect((await patchPost(req(`/api/admin/blog/${p.id}`, "PATCH", { slug: "nouvelle" }), params(p.id as string))).status).toBe(200)
    expect(state.revalidated).toEqual(expect.arrayContaining(["/blog/ancienne", "/blog/nouvelle"]))
  })

  it("colonnes facultatives absentes : réenregistré sans elles ; programmation impossible : 503", async () => {
    const p = post()
    db.tables.blog_posts.push(p)
    state.client = clientOf(db, { missingColumns: ["cover_alt", "scheduled_at", "target_keyword"] })
    const res = await patchPost(req(`/api/admin/blog/${p.id}`, "PATCH", { title: "Titre revu", cover_alt: "Une image" }), params(p.id as string))
    expect(res.status).toBe(200)
    expect(db.tables.blog_posts[0]).toMatchObject({ title: "Titre revu" })
    expect(db.tables.blog_posts[0].cover_alt).toBeUndefined()
    const scheduled = await patchPost(req(`/api/admin/blog/${p.id}`, "PATCH", { scheduled_at: inHours(5) }), params(p.id as string))
    expect(scheduled.status).toBe(503)
  })

  it("adresse et couverture contrôlées ; une adresse ancienne renvoyée telle quelle reste acceptée", async () => {
    const legacy = post({ slug: "Ancienne_Adresse" })
    db.tables.blog_posts.push(legacy)
    const at = (b: unknown) => patchPost(req(`/api/admin/blog/${legacy.id}`, "PATCH", b), params(legacy.id as string))
    // Adresse inchangée (hors des règles d'aujourd'hui) : enregistrement possible
    expect((await at({ slug: "Ancienne_Adresse", title: "Titre revu" })).status).toBe(200)
    expect(db.tables.blog_posts[0]).toMatchObject({ slug: "Ancienne_Adresse", title: "Titre revu" })
    // Nouvelle adresse mal formée : refusée
    const bad = await at({ slug: "Nouvelle Adresse" })
    expect(bad.status).toBe(400)
    expect((await bad.json()).error).toContain("Adresse invalide")
    // Tirets en trop retirés
    expect((await at({ slug: "nouvelle--adresse-" })).status).toBe(200)
    expect(db.tables.blog_posts[0].slug).toBe("nouvelle-adresse")
    // Couverture
    expect((await at({ cover_url: "javascript:alert(1)" })).status).toBe(400)
    expect((await at({ cover_url: "" })).status).toBe(200)
    expect(db.tables.blog_posts[0].cover_url).toBeNull()
  })

  it("identifiant illisible : 400 sans appel à la base", async () => {
    const res = await patchPost(req("/api/admin/blog/abc", "PATCH", { title: "x" }), params("abc"))
    expect(res.status).toBe(400)
  })

  it("article introuvable : 404", async () => {
    const res = await patchPost(req(`/api/admin/blog/${uuid()}`, "PATCH", { is_published: true }), params(uuid()))
    expect(res.status).toBe(404)
  })
})

/* ------------------------------------------------------------------ */
/* POST /api/admin/seo/keywords/plan                                   */
/* ------------------------------------------------------------------ */

describe("POST /api/admin/seo/keywords/plan", () => {
  it("ajoute les mots-clés absents en « Ciblé », complète les existants, rejouable", async () => {
    db.tables.seo_keywords.push({ id: uuid(), keyword: "exemple devis peinture", status: "ignored", intent: null, source: "search_console", target_path: null, notes: null, volume: null })
    const res = await importPlan()
    expect(res.status).toBe(200)
    const json = (await res.json()) as PlanImportResult
    expect(json).toEqual({ added: PLAN_KEYWORDS.length - 1, updated: 1, total: PLAN_KEYWORDS.length })
    const peinture = db.tables.seo_keywords.find((k) => k.keyword === "exemple devis peinture")!
    expect(peinture).toMatchObject({ status: "ignored", volume: 320, target_path: "/modele/devis-peinture", intent: "informational" })
    const added = db.tables.seo_keywords.find((k) => k.keyword === "devis vierge pdf")!
    expect(added).toMatchObject({ status: "targeted", source: "import", volume: 170, target_path: "/modele/devis-vierge", notes: PLAN_NOTE })

    const again = (await (await importPlan()).json()) as PlanImportResult
    expect(again).toEqual({ added: 0, updated: 0, total: PLAN_KEYWORDS.length })
    expect(db.tables.seo_keywords).toHaveLength(PLAN_KEYWORDS.length)
  })

  it("401 sans session ; 503 si la base ne répond pas", async () => {
    state.admin = false
    expect((await importPlan()).status).toBe(401)
    state.admin = true
    db.failing.add("seo_keywords")
    expect((await importPlan()).status).toBe(503)
  })
})

/* ------------------------------------------------------------------ */
/* GET /api/admin/blog/seo-context                                     */
/* ------------------------------------------------------------------ */

describe("GET /api/admin/blog/seo-context", () => {
  it("mots-clés fusionnés avec le plan (ignorés exclus), autres articles, pages qui visent le mot-clé", async () => {
    const self = post({ slug: "devis-placo", target_keyword: "exemple devis placo" })
    const other = post({ slug: "placo-prix", title: "Prix du placo", target_keyword: "Exemple devis placo" })
    db.tables.blog_posts.push(self, other)
    db.tables.seo_keywords.push(
      { id: uuid(), keyword: "exemple devis placo", status: "targeted", source: "manual", volume: 110, target_path: "/modele/devis-placo" },
      { id: uuid(), keyword: "devis vierge pdf", status: "ignored", source: "manual", volume: null },
    )
    state.client = clientOf(db, {
      rpcs: {
        seo_gsc_bounds: [{ first_date: "2026-01-01", last_date: "2026-10-13" }],
        seo_gsc_query_pages_agg: [
          { query: "exemple devis placo", page: "/modele/devis-placo", clicks: 3, impressions: 120, avg_position: 4.2 },
          { query: "exemple devis placo", page: "/blog/devis-placo", clicks: 0, impressions: 10, avg_position: 30 },
        ],
      },
    })
    const res = await seoContext(req(`/api/admin/blog/seo-context?id=${self.id}&keyword=Exemple%20devis%20placo`, "GET"))
    expect(res.status).toBe(200)
    const ctx = (await res.json()) as SeoContext
    expect(ctx.gsc).toEqual({ connected: true, lastDate: "2026-10-13" })
    // Le plan est fusionné ; « devis vierge pdf », ignoré dans l'onglet, n'est pas reproposé par le plan
    expect(ctx.keywords.find((k) => k.keyword === "exemple devis placo")).toMatchObject({ fromPlan: true, volume: 110 })
    expect(ctx.keywords.some((k) => k.keyword === "devis vierge pdf")).toBe(false)
    expect(ctx.keywords.some((k) => k.keyword === "devis vierge à imprimer" && k.id === null)).toBe(true)
    expect(ctx.others.map((o) => o.id)).toEqual([other.id])
    expect(ctx.keywordPages).toEqual({
      keyword: "exemple devis placo",
      topPage: { page: "/modele/devis-placo", clicks: 3, impressions: 120, position: 4.2 },
      targetPath: "/modele/devis-placo",
      posts: [{ id: other.id, title: "Prix du placo", slug: "placo-prix" }],
    })
    expect(ctx.pageQueries.length).toBeGreaterThan(0)
    expect(ctx.competitors).toEqual(SETTINGS_DEFAULTS.targeting.competitors)
    expect(ctx.prefs).toEqual({ lengthMin: SETTINGS_DEFAULTS.articles.lengthMin, lengthMax: SETTINGS_DEFAULTS.articles.lengthMax, publishTime: SETTINGS_DEFAULTS.articles.time })
  })

  it("changement de mot-clé (only=keyword) : seulement les pages du mot-clé, sans les réglages ni les requêtes de la page", async () => {
    const self = post({ slug: "devis-placo" })
    db.tables.blog_posts.push(self)
    const rpcs: string[] = []
    const base = clientOf(db, {
      rpcs: {
        seo_gsc_bounds: [{ first_date: "2026-01-01", last_date: "2026-10-13" }],
        seo_gsc_query_pages_agg: [{ query: "exemple devis placo", page: "/modele/devis-placo", clicks: 3, impressions: 120, avg_position: 4.2 }],
      },
    })
    const tables: string[] = []
    state.client = { ...base, from: (t: string) => (tables.push(t), base.from(t)), rpc: (name: string) => (rpcs.push(name), base.rpc(name)) }
    const res = await seoContext(req(`/api/admin/blog/seo-context?id=${self.id}&keyword=exemple%20devis%20placo&only=keyword`, "GET"))
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(Object.keys(json)).toEqual(["keywordPages"])
    expect(json.keywordPages).toMatchObject({ keyword: "exemple devis placo", topPage: { page: "/modele/devis-placo", impressions: 120 } })
    expect(tables).not.toContain("seo_settings")
    // Une seule lecture des requêtes × pages : celle du mot-clé (pas celle de la page de l'article)
    expect(rpcs.filter((r) => r === "seo_gsc_query_pages_agg")).toHaveLength(1)
  })

  it("Search Console en panne : la route répond quand même", async () => {
    db.tables.blog_posts.push(post())
    state.client = clientOf(db, { rpcError: true })
    const res = await seoContext(req("/api/admin/blog/seo-context?keyword=devis", "GET"))
    expect(res.status).toBe(200)
    const ctx = (await res.json()) as SeoContext
    expect(ctx.gsc).toEqual({ connected: false, lastDate: null })
    expect(ctx.keywordPages).toMatchObject({ keyword: "devis", topPage: null })
    expect(ctx.keywords.length).toBe(PLAN_KEYWORDS.length)
  })

  it("colonnes récentes absentes : lecture des articles sans elles", async () => {
    db.tables.blog_posts.push(post({ target_keyword: "x" }))
    state.client = clientOf(db, { missingColumns: ["target_keyword"] })
    const res = await seoContext(req("/api/admin/blog/seo-context", "GET"))
    expect(res.status).toBe(200)
    const ctx = (await res.json()) as SeoContext
    expect(ctx.others[0]).toMatchObject({ targetKeyword: null, seoTitle: null })
    expect(ctx.keywordPages).toBeNull()
  })

  it("400 identifiant invalide ; 401 sans session ; 503 si les articles sont illisibles", async () => {
    expect((await seoContext(req("/api/admin/blog/seo-context?id=abc", "GET"))).status).toBe(400)
    state.admin = false
    expect((await seoContext(req("/api/admin/blog/seo-context", "GET"))).status).toBe(401)
    state.admin = true
    db.failing.add("blog_posts")
    expect((await seoContext(req("/api/admin/blog/seo-context", "GET"))).status).toBe(503)
  })
})

/* ------------------------------------------------------------------ */
/* POST /api/admin/blog/suggest                                        */
/* ------------------------------------------------------------------ */

describe("POST /api/admin/blog/suggest", () => {
  const body = {
    field: "seoTitle",
    keyword: "exemple devis maçonnerie",
    title: "Exemple de devis de maçonnerie",
    content: "## Les lignes\n\nFondations, murs et dalle.",
  }
  const answer = (suggestions: string[]) => async ({ model }: { model: string }) => ({ text: JSON.stringify({ suggestions }), model, usage: { inputTokens: 1, outputTokens: 1 } })

  it("rend les propositions qui passent le contrôle (trois au plus)", async () => {
    state.text = answer([
      "Exemple de devis de maçonnerie : les lignes à prévoir",
      "Exemple de devis de maçonnerie avec un logiciel certifié",
      "Exemple de devis de maçonnerie, poste par poste",
      "Court",
    ])
    const res = await suggest(req("/api/admin/blog/suggest", "POST", body))
    expect(res.status).toBe(200)
    const json = (await res.json()) as SuggestResponse
    expect(json.suggestions.map((s) => s.text)).toEqual(["Exemple de devis de maçonnerie : les lignes à prévoir", "Exemple de devis de maçonnerie, poste par poste"])
    expect(json.rejected).toBe(2)
    // Modèle du plan (rapide) ; jamais de concurrent dans la consigne
    expect(state.prompts[0]).toContain("TITRE GOOGLE")
  })

  it("concurrent caviardé dans le texte, refusé dans le mot-clé", async () => {
    state.text = answer(["Exemple de devis de maçonnerie : les lignes à prévoir"])
    const brand = brandOfDomain(competitor)
    const ok = await suggest(req("/api/admin/blog/suggest", "POST", { ...body, content: `Comparé à ${brand}, voici les lignes.` }))
    expect(ok.status).toBe(200)
    expect(state.prompts[0].toLowerCase()).not.toContain(brand.toLowerCase())
    const refused = await suggest(req("/api/admin/blog/suggest", "POST", { ...body, keyword: `devis ${brand}` }))
    expect(refused.status).toBe(422)
  })

  it("aucune proposition valable : 422", async () => {
    state.text = answer(["Court", "Exemple de devis de maçonnerie envoyé par votre PDP"])
    const res = await suggest(req("/api/admin/blog/suggest", "POST", body))
    expect(res.status).toBe(422)
    expect((await res.json()).code).toBe("no_suggestion")
  })

  it("clé absente : 503 ; échec du modèle : 502", async () => {
    state.text = async () => {
      throw new ModelError("not_configured", "Clé GEMINI_API_KEY absente.")
    }
    const missing = await suggest(req("/api/admin/blog/suggest", "POST", body))
    expect(missing.status).toBe(503)
    expect((await missing.json()).code).toBe("not_configured")
    state.text = async () => {
      throw new ModelError("http", "Erreur 500")
    }
    expect((await suggest(req("/api/admin/blog/suggest", "POST", body))).status).toBe(502)
  })

  it("400 : sans mot-clé, champ inconnu, ni titre ni texte", async () => {
    expect((await suggest(req("/api/admin/blog/suggest", "POST", { ...body, keyword: "" }))).status).toBe(400)
    expect((await suggest(req("/api/admin/blog/suggest", "POST", { ...body, field: "h1" }))).status).toBe(400)
    expect((await suggest(req("/api/admin/blog/suggest", "POST", { ...body, title: "", content: " " }))).status).toBe(400)
    expect(state.prompts).toHaveLength(0)
  })

  it("adresse : jamais celle d'un autre article", async () => {
    db.tables.blog_posts.push(post({ slug: "exemple-devis-maconnerie" }))
    state.text = answer(["exemple-devis-maconnerie", "exemple-devis-maconnerie-maison"])
    const res = await suggest(req("/api/admin/blog/suggest", "POST", { ...body, field: "slug" }))
    expect(res.status).toBe(200)
    expect(((await res.json()) as SuggestResponse).suggestions.map((s) => s.text)).toEqual(["exemple-devis-maconnerie-maison"])
  })
})

/* ------------------------------------------------------------------ */
/* POST /api/admin/blog/assist (action « resolve »)                     */
/* ------------------------------------------------------------------ */

describe("POST /api/admin/blog/assist : correction d'un passage refusé par le contrôle", () => {
  const passage = "Pour rédiger vos [conditions de paiement](/outils/generateur-conditions-paiement) sans rien oublier, un générateur gratuit est disponible."
  const body = {
    action: "resolve",
    text: passage,
    issue: { label: "Affirmation interdite (contrôle factuel)", detail: "Un générateur de conditions de paiement ne fait pas partie des outils gratuits listés. À écrire : renvoyer vers le générateur de devis." },
    excerpt: passage,
    keyword: "conditions de paiement",
    title: "Relancer une facture impayée",
    before: "Fixez vos règles à l'avance.",
    after: "Écrivez l'échéance sur la facture.",
  }
  const answer = (text: string) => async ({ model }: { model: string }) => ({ text, model, usage: { inputTokens: 1, outputTokens: 1 } })

  it("rend le passage corrigé ; la consigne contient le passage, le problème et la précision du contrôle", async () => {
    state.text = answer("Pour rédiger vos [conditions de paiement](/outils/generateur-conditions-paiement) sans rien oublier, utilisez notre générateur de devis.")
    const res = await assist(req("/api/admin/blog/assist", "POST", body))
    expect(res.status).toBe(200)
    const json = (await res.json()) as AssistResponse
    expect(json.text).toContain("utilisez notre générateur de devis.")
    expect(json.text).toContain("(/outils/generateur-conditions-paiement)")
    expect(json.warnings).toEqual([])
    const prompt = state.prompts[0]
    expect(prompt).toContain('PASSAGE À CORRIGER :\n"""Pour rédiger vos [conditions de paiement]')
    expect(prompt).toContain("PROBLÈME REPÉRÉ PAR LE CONTRÔLE : Affirmation interdite (contrôle factuel)")
    expect(prompt).toContain("PRÉCISION DU CONTRÔLE : Un générateur de conditions de paiement ne fait pas partie")
    expect(prompt).toContain("MOT-CLÉ PRINCIPAL : conditions de paiement")
    expect(prompt).toContain("CONTEXTE AVANT LE PASSAGE")
  })

  it("avertit quand le passage refusé est resté tel quel, ou quand un chiffre apparaît", async () => {
    state.text = answer(passage)
    const same = (await (await assist(req("/api/admin/blog/assist", "POST", body))).json()) as AssistResponse
    expect(same.warnings[0]).toContain("Le passage refusé figure encore dans le texte proposé")

    state.text = answer("Pour rédiger vos conditions de paiement, utilisez notre générateur : 12 modèles sont disponibles.")
    const added = (await (await assist(req("/api/admin/blog/assist", "POST", body))).json()) as AssistResponse
    expect(added.warnings.join(" ")).toContain("« 12 » n'était pas dans le passage")
  })

  it("un chiffre donné par le contrôle n'est pas signalé comme nouveau", async () => {
    state.text = answer("La franchise de TVA s'applique jusqu'à 37 500 € de chiffre d'affaires.")
    const res = await assist(
      req("/api/admin/blog/assist", "POST", {
        ...body,
        text: "La franchise de TVA s'applique jusqu'à 36 800 € de chiffre d'affaires.",
        excerpt: "jusqu'à 36 800 € de chiffre d'affaires",
        issue: { label: "Anciens seuils de franchise de TVA", detail: "Seuil de 37 500 € depuis le 1er janvier 2025." },
      }),
    )
    expect(((await res.json()) as AssistResponse).warnings.join(" ")).not.toContain("37 500")
  })

  it("requête invalide ou concurrent cité : 400 et 422, aucune consigne envoyée", async () => {
    expect((await assist(req("/api/admin/blog/assist", "POST", { ...body, issue: undefined }))).status).toBe(400)
    expect((await assist(req("/api/admin/blog/assist", "POST", { ...body, text: " " }))).status).toBe(400)
    const brand = brandOfDomain(competitor)
    expect((await assist(req("/api/admin/blog/assist", "POST", { ...body, text: `Comparé à ${brand}, un générateur gratuit est disponible.` }))).status).toBe(422)
    expect(state.prompts).toHaveLength(0)
  })

  it("le concurrent cité par le contrôle est caviardé de la consigne ; non connecté : 401", async () => {
    state.text = answer("Un texte corrigé sans promesse.")
    const brand = brandOfDomain(competitor)
    const res = await assist(req("/api/admin/blog/assist", "POST", { ...body, issue: { ...body.issue, detail: `Voir aussi ${brand}.` } }))
    expect(res.status).toBe(200)
    expect(state.prompts[0].toLowerCase()).not.toContain(brand.toLowerCase())
    state.admin = false
    expect((await assist(req("/api/admin/blog/assist", "POST", body))).status).toBe(401)
  })

  it("les actions du menu de sélection fonctionnent toujours", async () => {
    state.text = answer("Un devis plus clair.")
    const res = await assist(req("/api/admin/blog/assist", "POST", { action: "rephrase", text: "Un devis pas clair." }))
    expect(res.status).toBe(200)
    expect(state.prompts[0]).toContain("PASSAGE À RÉÉCRIRE")
    expect(state.prompts[0]).not.toContain("PASSAGE À CORRIGER")
  })
})

/* ------------------------------------------------------------------ */
/* POST /api/admin/blog/integrate-keyword                               */
/* ------------------------------------------------------------------ */

describe("POST /api/admin/blog/integrate-keyword : mot-clé placé dans le texte avec l'IA", () => {
  const filler = Array.from({ length: 30 }, (_, i) => `mot${i}`).join(" ")
  const markdown = ["Une introduction sur la facturation.", "## Les acomptes", `L'acompte se calcule sur le devis accepté. ${filler}.`, "## Questions fréquentes", `Faut-il un acompte ? ${filler}.`].join("\n\n")
  const body = { mode: "secondary", keyword: "acompte plomberie", markdown, title: "Facturer un chantier", mainKeyword: "facture plomberie" }
  const answer = (text: string) => async ({ model }: { model: string }) => ({ text, model, usage: { inputTokens: 1, outputTokens: 1 } })
  const edit = (index: number, text: string) => JSON.stringify({ edits: [{ index, text }] })

  it("rend le passage retouché, avant et après ; la consigne numérote les passages du développement seulement", async () => {
    state.text = answer(edit(1, `L'acompte de plomberie se calcule sur le devis accepté. ${filler}.`))
    const res = await integrate(req("/api/admin/blog/integrate-keyword", "POST", body))
    expect(res.status).toBe(200)
    const json = (await res.json()) as IntegrateResponse
    expect(json.note).toBeNull()
    expect(json.proposals).toHaveLength(1)
    expect(json.proposals[0]).toMatchObject({ id: "1", kind: "paragraph", section: "Les acomptes" })
    expect(json.proposals[0].before).toContain("L'acompte se calcule")
    expect(json.proposals[0].after).toContain("L'acompte de plomberie se calcule")
    const prompt = state.prompts[0]
    expect(prompt).toContain("MOT-CLÉ À FAIRE FIGURER : acompte plomberie")
    expect(prompt).toContain("MOT-CLÉ PRINCIPAL DE L'ARTICLE : facture plomberie")
    expect(prompt).toContain("[1] (paragraphe, section « Les acomptes »)")
    expect(prompt).not.toContain("Faut-il un acompte")
    expect(prompt).not.toContain("[2]")
  })

  it("la réécriture sans le mot-clé est écartée et la raison est donnée ; un mauvais numéro est ignoré", async () => {
    state.text = answer(edit(1, `Le versement se calcule sur le devis accepté. ${filler}.`))
    const json = (await (await integrate(req("/api/admin/blog/integrate-keyword", "POST", body))).json()) as IntegrateResponse
    expect(json.proposals).toEqual([])
    expect(json.note).toContain("le mot-clé n'y figurait pas tel quel")

    state.text = answer(edit(9, "x"))
    const none = (await (await integrate(req("/api/admin/blog/integrate-keyword", "POST", body))).json()) as IntegrateResponse
    expect(none.proposals).toEqual([])
    expect(none.note).toContain("aucun passage")
  })

  it("aucun passage ne peut le recevoir : réponse vide expliquée, le modèle n'est pas appelé", async () => {
    const res = await integrate(req("/api/admin/blog/integrate-keyword", "POST", { ...body, markdown: "Un texte court." }))
    expect(res.status).toBe(200)
    expect(((await res.json()) as IntegrateResponse).note).toContain("Aucun passage du développement")
    expect(state.prompts).toHaveLength(0)
  })

  it("sous-titre et introduction : un seul passage, avec la consigne du mode", async () => {
    state.text = answer(edit(1, "Acompte et facture plomberie"))
    const heading = (await (await integrate(req("/api/admin/blog/integrate-keyword", "POST", { ...body, mode: "heading", keyword: "facture plomberie" }))).json()) as IntegrateResponse
    expect(heading.proposals[0]).toMatchObject({ kind: "heading", before: "Les acomptes", after: "Acompte et facture plomberie" })
    expect(state.prompts[0]).toContain("UN seul de ces sous-titres")

    state.text = answer(edit(1, "Facturer un chantier de plomberie demande de la méthode."))
    const intro = (await (await integrate(req("/api/admin/blog/integrate-keyword", "POST", { ...body, mode: "intro", keyword: "chantier de plomberie" }))).json()) as IntegrateResponse
    expect(intro.proposals[0]).toMatchObject({ kind: "paragraph", section: "Introduction" })
    expect(state.prompts[1]).toContain("paragraphe d'introduction")
  })

  it("requête invalide : 400 ; concurrent dans le mot-clé : 422 ; non connecté : 401 ; aucune consigne envoyée", async () => {
    expect((await integrate(req("/api/admin/blog/integrate-keyword", "POST", { ...body, mode: "autre" }))).status).toBe(400)
    expect((await integrate(req("/api/admin/blog/integrate-keyword", "POST", { ...body, keyword: "" }))).status).toBe(400)
    expect((await integrate(req("/api/admin/blog/integrate-keyword", "POST", { ...body, markdown: "  " }))).status).toBe(400)
    const brand = brandOfDomain(competitor)
    expect((await integrate(req("/api/admin/blog/integrate-keyword", "POST", { ...body, keyword: `${brand} devis` }))).status).toBe(422)
    state.admin = false
    expect((await integrate(req("/api/admin/blog/integrate-keyword", "POST", body))).status).toBe(401)
    expect(state.prompts).toHaveLength(0)
  })

  it("le concurrent du titre ou du mot-clé principal ne part jamais dans la consigne", async () => {
    state.text = answer(edit(1, `L'acompte de plomberie se calcule. ${filler}.`))
    const brand = brandOfDomain(competitor)
    const res = await integrate(req("/api/admin/blog/integrate-keyword", "POST", { ...body, title: `Facturer comme ${brand}`, mainKeyword: `${brand} facture` }))
    expect(res.status).toBe(200)
    expect(state.prompts[0].toLowerCase()).not.toContain(brand.toLowerCase())
  })

  it("clé du modèle absente : 503 ; quota : 502 avec le code ; échec : 502", async () => {
    state.text = async () => {
      throw new ModelError("not_configured", "Clé ANTHROPIC_API_KEY absente.")
    }
    const missing = await integrate(req("/api/admin/blog/integrate-keyword", "POST", body))
    expect(missing.status).toBe(503)
    expect(((await missing.json()) as { code: string }).code).toBe("not_configured")

    state.text = async () => {
      throw new ModelError("quota", "Quota épuisé.")
    }
    const quota = await integrate(req("/api/admin/blog/integrate-keyword", "POST", body))
    expect(quota.status).toBe(502)
    expect(((await quota.json()) as { code: string }).code).toBe("quota")

    vi.spyOn(console, "error").mockImplementation(() => {})
    state.text = async () => {
      throw new Error("boom")
    }
    expect((await integrate(req("/api/admin/blog/integrate-keyword", "POST", body))).status).toBe(502)
  })
})
