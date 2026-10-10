import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { NextRequest } from "next/server"
import { POST as createKeyword } from "@/app/api/admin/seo/keywords/route"
import { PATCH as patchKeyword } from "@/app/api/admin/seo/keywords/[id]/route"
import { POST as createTopic } from "@/app/api/admin/seo/keywords/[id]/topic/route"
import { POST as analyze } from "@/app/api/admin/seo/keywords/analyze/route"
import { syncKeywordsFromSearchConsole } from "@/lib/seo/keywords/sync"
import { pgrstInList, topPageFor } from "@/lib/seo/keywords/data"
import { SeoDbError } from "@/lib/seo/db"

/* ------------------------------------------------------------------ */
/* Base simulée : sous-ensemble de PostgREST utilisé par le module       */
/* ------------------------------------------------------------------ */

type Row = Record<string, unknown>
type DbError = { code?: string; message: string }

interface FakeDb {
  tables: Record<string, Row[]>
  rpcs: Record<string, (args: Row) => Row[]>
  missing: Set<string>
  /** Colonnes absentes (« table.colonne ») : un select qui les nomme reçoit PGRST204. */
  missingColumns: Set<string>
  client: { from: (t: string) => unknown; rpc: (name: string, args?: Row) => unknown }
}

let seq = 0
const uuid = () => `00000000-0000-4000-8000-${String(++seq).padStart(12, "0")}`

/** Liste `(…)` d'un filtre `in` de PostgREST : valeurs entre guillemets (\\ et \" échappés) ou nues. */
function parseInList(value: string): string[] {
  const body = value.slice(1, -1)
  const out: string[] = []
  let i = 0
  while (i < body.length) {
    if (body[i] === '"') {
      let cur = ""
      i++
      while (i < body.length && body[i] !== '"') {
        if (body[i] === "\\") i++
        cur += body[i]
        i++
      }
      i++
      out.push(cur)
      if (body[i] === ",") i++
    } else {
      const j = body.indexOf(",", i)
      const end = j < 0 ? body.length : j
      out.push(body.slice(i, end))
      i = end + 1
    }
  }
  return out
}

function fakeDb(initial: Record<string, Row[]> = {}): FakeDb {
  const db: FakeDb = {
    tables: Object.fromEntries(Object.entries(initial).map(([t, rows]) => [t, rows.map((r) => ({ ...r }))])),
    rpcs: {},
    missing: new Set(),
    missingColumns: new Set(),
    client: null as unknown as FakeDb["client"],
  }
  const rowsOf = (t: string) => (db.tables[t] ??= [])
  const UNIQUE: Record<string, string> = { seo_keywords: "keyword", seo_jobs: "name" }

  function builder(source: () => { rows: Row[]; error: DbError | null }, table: string | null) {
    const filters: ((r: Row) => boolean)[] = []
    let kind: "select" | "insert" | "update" | "upsert" = "select"
    let values: Row | Row[] | null = null
    let upsertOpts: { onConflict?: string; ignoreDuplicates?: boolean } = {}
    let returning = false
    let range: [number, number] | null = null
    let limit: number | null = null
    let single: "single" | "maybe" | null = null
    let columns = ""

    const run = (): { data: unknown; error: DbError | null } => {
      if (table && db.missing.has(table)) return { data: null, error: { code: "PGRST205", message: `Could not find the table 'public.${table}' in the schema cache` } }
      const absent = columns.split(",").map((c) => c.trim()).find((c) => table && db.missingColumns.has(`${table}.${c}`))
      if (absent) return { data: null, error: { code: "PGRST204", message: `Could not find the '${absent}' column of '${table}' in the schema cache` } }
      const src = source()
      if (src.error) return { data: null, error: src.error }
      const rows = src.rows
      if (kind === "insert" || kind === "upsert") {
        const list = Array.isArray(values) ? values : [values as Row]
        const out: Row[] = []
        const unique = table ? UNIQUE[table] : undefined
        for (const v of list) {
          const key = upsertOpts.onConflict ?? unique
          const existing = key ? rows.find((r) => r[key] === v[key]) : undefined
          if (existing) {
            if (kind === "insert") return { data: null, error: { code: "23505", message: "duplicate key value violates unique constraint" } }
            if (!upsertOpts.ignoreDuplicates) Object.assign(existing, v)
            continue
          }
          const row = { id: uuid(), ...v }
          rows.push(row)
          out.push({ ...row })
        }
        return finish(out)
      }
      const matched = rows.filter((r) => filters.every((f) => f(r)))
      if (kind === "update") {
        matched.forEach((r) => Object.assign(r, values))
        return finish(matched.map((r) => ({ ...r })))
      }
      let out = matched.map((r) => ({ ...r }))
      if (range) out = out.slice(range[0], range[1] + 1)
      if (limit !== null) out = out.slice(0, limit)
      return finish(out)
    }
    const finish = (out: Row[]) => {
      if (single) {
        if (!out.length) return single === "maybe" ? { data: null, error: null } : { data: null, error: { code: "PGRST116", message: "0 rows" } }
        return { data: out[0], error: null }
      }
      return { data: kind !== "select" && !returning ? null : out, error: null }
    }
    const api = {
      select: (cols?: string) => {
        if (kind !== "select") returning = true
        else columns = cols ?? ""
        return api
      },
      insert: (v: Row | Row[]) => ((kind = "insert"), (values = v), api),
      upsert: (v: Row | Row[], opts?: { onConflict?: string; ignoreDuplicates?: boolean }) => ((kind = "upsert"), (values = v), (upsertOpts = opts ?? {}), api),
      update: (v: Row) => ((kind = "update"), (values = v), api),
      eq: (k: string, v: unknown) => (filters.push((r) => r[k] === v), api),
      in: (k: string, list: unknown[]) => (filters.push((r) => list.includes(r[k])), api),
      is: (k: string, v: unknown) => (filters.push((r) => (r[k] ?? null) === v), api),
      filter: (k: string, op: string, v: string) => {
        if (op !== "in") throw new Error(`opérateur non simulé : ${op}`)
        const list = parseInList(v)
        filters.push((r) => list.includes(String(r[k])))
        return api
      },
      or: () => api,
      order: () => api,
      limit: (n: number) => ((limit = n), api),
      range: (a: number, b: number) => ((range = [a, b]), api),
      single: () => ((single = "single"), Promise.resolve(run())),
      maybeSingle: () => ((single = "maybe"), Promise.resolve(run())),
      then: (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) => Promise.resolve(run()).then(resolve, reject),
    }
    return api
  }

  db.client = {
    from: (table: string) => builder(() => ({ rows: rowsOf(table), error: null }), table),
    rpc: (name: string, args: Row = {}) =>
      builder(() => {
        const fn = db.rpcs[name]
        if (!fn) return { rows: [], error: { code: "PGRST202", message: `Could not find the function public.${name}` } }
        return { rows: fn(args), error: null }
      }, null),
  }
  return db
}

/* ------------------------------------------------------------------ */
/* Modules simulés                                                     */
/* ------------------------------------------------------------------ */

let db = fakeDb()
let admin = true

vi.mock("@/lib/supabase/server", () => ({ createClient: async () => db.client, createAdminClient: () => db.client }))
vi.mock("@/lib/admin-require", () => ({ isAdminAuthenticated: async () => admin }))


const req = (url: string, method: string, body?: unknown) =>
  new NextRequest(`http://localhost${url}`, { method, body: body === undefined ? undefined : JSON.stringify(body) })
const params = (id: string) => ({ params: Promise.resolve({ id }) })

const keywordRow = (over: Row): Row => ({
  id: uuid(),
  status: "candidate",
  intent: null,
  source: "import",
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
})

beforeEach(() => {
  db = fakeDb({ seo_keywords: [], seo_topics: [], seo_jobs: [], cron_logs: [], seo_settings: [] })
  admin = true
})

afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
})

describe("POST /api/admin/seo/keywords", () => {
  it("401 sans session admin", async () => {
    admin = false
    const res = await createKeyword(req("/api/admin/seo/keywords", "POST", { keyword: "devis" }))
    expect(res.status).toBe(401)
    expect(db.tables.seo_keywords).toHaveLength(0)
  })

  it("400 sur une saisie invalide, champ par champ", async () => {
    const url = await createKeyword(req("/api/admin/seo/keywords", "POST", { keyword: "https://qonforme.fr/modele" }))
    expect(url.status).toBe(400)
    expect((await url.json()).fieldErrors.keyword).toMatch(/adresse web/)
    const path = await createKeyword(req("/api/admin/seo/keywords", "POST", { keyword: "devis", target_path: "https://exemple.fr" }))
    expect(path.status).toBe(400)
    expect((await path.json()).fieldErrors.target_path).toBeTruthy()
  })

  it("ajoute la forme canonique, puis 409 sur un doublon", async () => {
    const res = await createKeyword(req("/api/admin/seo/keywords", "POST", { keyword: "  Mentions  Obligatoires DEVIS ", target_path: "/guide/mentions-obligatoires-devis/", status: "targeted" }))
    expect(res.status).toBe(201)
    const created = await res.json()
    expect(created.keyword).toBe("mentions obligatoires devis")
    expect(db.tables.seo_keywords[0]).toMatchObject({ keyword: "mentions obligatoires devis", status: "targeted", source: "manual", target_path: "/guide/mentions-obligatoires-devis" })

    const dup = await createKeyword(req("/api/admin/seo/keywords", "POST", { keyword: "mentions obligatoires devis" }))
    expect(dup.status).toBe(409)
    expect(await dup.json()).toMatchObject({ error: "Ce mot-clé est déjà suivi", id: created.id })
    expect(db.tables.seo_keywords).toHaveLength(1)
  })

  it("503 tant que la migration n'est pas appliquée", async () => {
    db.missing.add("seo_keywords")
    const res = await createKeyword(req("/api/admin/seo/keywords", "POST", { keyword: "devis" }))
    expect(res.status).toBe(503)
    expect((await res.json()).code).toBe("migration_pending")
  })
})

describe("PATCH /api/admin/seo/keywords/[id]", () => {
  it("401, 404 et 400 avant toute écriture", async () => {
    const row = keywordRow({ keyword: "devis modele" })
    db.tables.seo_keywords.push(row)
    admin = false
    expect((await patchKeyword(req("/x", "PATCH", { status: "covered" }), params(String(row.id)))).status).toBe(401)
    admin = true
    expect((await patchKeyword(req("/x", "PATCH", { status: "covered" }), params("pas-un-uuid"))).status).toBe(404)
    expect((await patchKeyword(req("/x", "PATCH", { keyword: "autre" }), params(String(row.id)))).status).toBe(400)
    expect((await patchKeyword(req("/x", "PATCH", { status: "supprimé" }), params(String(row.id)))).status).toBe(400)
    expect(db.tables.seo_keywords[0].status).toBe("candidate")
  })

  it("enregistre statut, page cible, intention et notes", async () => {
    const row = keywordRow({ keyword: "devis modele" })
    db.tables.seo_keywords.push(row)
    const res = await patchKeyword(
      req("/x", "PATCH", { status: "ignored", target_path: "https://www.qonforme.fr/modele/", intent: "transactional", notes: "À revoir" }),
      params(String(row.id)),
    )
    expect(res.status).toBe(200)
    expect(db.tables.seo_keywords[0]).toMatchObject({ status: "ignored", target_path: "/modele", intent: "transactional", notes: "À revoir" })
    expect((await patchKeyword(req("/x", "PATCH", { notes: "" }), params(uuid()))).status).toBe(404)
  })
})

describe("POST /api/admin/seo/keywords/[id]/topic", () => {
  it("401 sans session admin, sans créer de sujet ni changer le statut", async () => {
    const row = keywordRow({ keyword: "relances automatiques factures" })
    db.tables.seo_keywords.push(row)
    admin = false
    const res = await createTopic(req("/x", "POST"), params(String(row.id)))
    expect(res.status).toBe(401)
    expect(db.tables.seo_topics).toHaveLength(0)
    expect(db.tables.seo_keywords[0].status).toBe("candidate")
  })

  it("rend le sujet repris de PushRank (sans keyword_id) au lieu d'un doublon, le rattache et passe le candidat en ciblé", async () => {
    const row = keywordRow({ keyword: "relances automatiques factures" })
    db.tables.seo_keywords.push(row)
    // Sujet de la § 11 de la migration : texte du mot-clé, pas de keyword_id.
    db.tables.seo_topics.push(
      { id: "t-autre", title: "Autre", keyword: "facture électronique bâtiment", keyword_id: null, status: "unplanned", created_at: "2026-10-09T00:00:00Z" },
      { id: "t-repris", title: "Relancer une facture impayée", keyword: "Relances  automatiques factures", keyword_id: null, status: "unplanned", created_at: "2026-10-09T00:00:00Z" },
    )
    const res = await createTopic(req("/x", "POST"), params(String(row.id)))
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ topicId: "t-repris", existing: true, status: "targeted" })
    expect(db.tables.seo_topics).toHaveLength(2)
    expect(db.tables.seo_topics.find((t) => t.id === "t-repris")?.keyword_id).toBe(row.id)
    expect(db.tables.seo_topics.find((t) => t.id === "t-autre")?.keyword_id).toBeNull()
    expect(db.tables.seo_keywords[0].status).toBe("targeted")
  })

  it("un sujet en échec compte comme ouvert ; un sujet publié ou archivé non", async () => {
    const row = keywordRow({ keyword: "réforme 2027 facturation", status: "targeted" })
    db.tables.seo_keywords.push(row)
    db.tables.seo_topics.push(
      { id: "t-publie", keyword: "réforme 2027 facturation", keyword_id: row.id, status: "published" },
      { id: "t-echec", keyword: "réforme 2027 facturation", keyword_id: row.id, status: "failed" },
    )
    const res = await createTopic(req("/x", "POST"), params(String(row.id)))
    expect(await res.json()).toEqual({ topicId: "t-echec", existing: true, status: "targeted" })
    expect(db.tables.seo_topics).toHaveLength(2)

    db.tables.seo_topics.splice(1, 1)
    expect((await createTopic(req("/x", "POST"), params(String(row.id)))).status).toBe(201)
  })

  it("409 sur un mot-clé qui nomme un concurrent, sans créer de sujet", async () => {
    db.tables.seo_settings.push({ key: "targeting", value: { competitors: ["tolteck.com"] }, updated_at: "2026-10-09T00:00:00Z" })
    const row = keywordRow({ keyword: "tolteck avis" })
    db.tables.seo_keywords.push(row)
    const res = await createTopic(req("/x", "POST"), params(String(row.id)))
    expect(res.status).toBe(409)
    expect(db.tables.seo_topics).toHaveLength(0)
  })

  it("409 sur un mot-clé ignoré, sans créer de sujet", async () => {
    const row = keywordRow({ keyword: "ancien", status: "ignored" })
    db.tables.seo_keywords.push(row)
    const res = await createTopic(req("/x", "POST"), params(String(row.id)))
    expect(res.status).toBe(409)
    expect((await res.json()).code).toBe("ignored")
    expect(db.tables.seo_topics).toHaveLength(0)
    expect(db.tables.seo_keywords[0].status).toBe("ignored")
  })

  it("crée un sujet à planifier et passe le candidat en ciblé, une seule fois", async () => {
    const row = keywordRow({ keyword: "relances automatiques factures" })
    db.tables.seo_keywords.push(row)
    const res = await createTopic(req("/x", "POST"), params(String(row.id)))
    expect(res.status).toBe(201)
    expect(db.tables.seo_topics[0]).toMatchObject({
      title: "Relances automatiques factures",
      keyword: "relances automatiques factures",
      keyword_id: row.id,
      source: "keyword",
      article_type: "guide",
      status: "unplanned",
    })
    expect(db.tables.seo_keywords[0].status).toBe("targeted")

    const again = await createTopic(req("/x", "POST"), params(String(row.id)))
    expect(again.status).toBe(200)
    expect(await again.json()).toMatchObject({ existing: true })
    expect(db.tables.seo_topics).toHaveLength(1)
  })

  it("ne change pas un mot-clé déjà couvert ; 404 sur un mot-clé inconnu", async () => {
    const row = keywordRow({ keyword: "taux de tva travaux", status: "covered" })
    db.tables.seo_keywords.push(row)
    expect((await createTopic(req("/x", "POST"), params(String(row.id)))).status).toBe(201)
    expect(db.tables.seo_keywords[0].status).toBe("covered")
    expect((await createTopic(req("/x", "POST"), params(uuid()))).status).toBe(404)
  })
})

describe("POST /api/admin/seo/keywords/analyze", () => {
  it("401 sans session admin, avant tout appel à DataForSEO et toute écriture", async () => {
    vi.stubEnv("DATAFORSEO_LOGIN", "login")
    vi.stubEnv("DATAFORSEO_PASSWORD", "secret")
    db.tables.seo_keywords.push(keywordRow({ keyword: "devis" }))
    const fetchMock = vi.fn(async () => new Response("{}"))
    vi.stubGlobal("fetch", fetchMock)
    admin = false
    const res = await analyze()
    expect(res.status).toBe(401)
    expect(fetchMock).not.toHaveBeenCalled()
    expect(db.tables.seo_jobs).toHaveLength(0)
    expect(db.tables.cron_logs).toHaveLength(0)
    expect(db.tables.seo_keywords[0].metrics_checked_at).toBeNull()
  })

  it("409 pendant une analyse en cours (verrou posé)", async () => {
    vi.stubEnv("DATAFORSEO_LOGIN", "login")
    vi.stubEnv("DATAFORSEO_PASSWORD", "secret")
    db.tables.seo_keywords.push(keywordRow({ keyword: "devis" }))
    db.tables.seo_jobs.push({
      name: "keywords-metrics",
      status: "running",
      started_at: new Date().toISOString(),
      last_ok_at: null,
      lock_until: new Date(Date.now() + 60_000).toISOString(),
      cursor: {},
    })
    const fetchMock = vi.fn(async () => new Response("{}"))
    vi.stubGlobal("fetch", fetchMock)
    const res = await analyze()
    expect(res.status).toBe(409)
    expect((await res.json()).code).toBe("running")
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it("503 avant tout appel payant si la colonne cpc_currency (section 12) manque", async () => {
    vi.stubEnv("DATAFORSEO_LOGIN", "login")
    vi.stubEnv("DATAFORSEO_PASSWORD", "secret")
    db.tables.seo_keywords.push(keywordRow({ keyword: "devis" }))
    db.missingColumns.add("seo_keywords.cpc_currency")
    const fetchMock = vi.fn(async () => new Response("{}"))
    vi.stubGlobal("fetch", fetchMock)
    const res = await analyze()
    expect(res.status).toBe(503)
    expect((await res.json()).code).toBe("migration_pending")
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it("seulement des mots-clés refusés par Google Ads : marqués vérifiés, aucun appel, pas de délai de 30 jours", async () => {
    vi.stubEnv("DATAFORSEO_LOGIN", "login")
    vi.stubEnv("DATAFORSEO_PASSWORD", "secret")
    db.tables.seo_keywords.push(keywordRow({ keyword: "prix, devis" }))
    const fetchMock = vi.fn(async () => new Response("{}"))
    vi.stubGlobal("fetch", fetchMock)
    const res = await analyze()
    expect(res.status).toBe(200)
    expect(await res.json()).toMatchObject({ ok: true, requested: 1, measured: 0, skipped: 1 })
    expect(fetchMock).not.toHaveBeenCalled()
    expect(db.tables.seo_keywords[0].metrics_checked_at).toBeTruthy()
    // La tâche n'a pas tourné : aucun last_ok_at, le bouton reste disponible.
    expect(db.tables.seo_jobs).toHaveLength(0)
    expect(db.tables.cron_logs).toHaveLength(0)
  })

  it("garde volume, CPC et difficulté quand seul l'appel d'intention échoue", async () => {
    vi.stubEnv("DATAFORSEO_LOGIN", "login")
    vi.stubEnv("DATAFORSEO_PASSWORD", "secret")
    db.tables.seo_keywords.push(keywordRow({ keyword: "devis artisan" }))
    const ok = (result: unknown[]) => new Response(JSON.stringify({ status_code: 20000, tasks: [{ status_code: 20000, result }] }))
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        if (url.includes("search_volume")) return ok([{ keyword: "devis artisan", search_volume: 880, cpc: 1.5 }])
        if (url.includes("keyword_difficulty")) return ok([{ items: [{ keyword: "devis artisan", keyword_difficulty: 18 }] }])
        return new Response(JSON.stringify({ status_code: 20000, tasks: [{ status_code: 40501, status_message: "Invalid Field: 'keywords'." }] }))
      }),
    )
    const res = await analyze()
    expect(res.status).toBe(200)
    expect(db.tables.seo_keywords[0]).toMatchObject({ volume: 880, difficulty: 18, cpc: 1.5, cpc_currency: "USD", intent: null })
  })

  it("interroge par paquets de 1 000 mots-clés au plus", async () => {
    vi.stubEnv("DATAFORSEO_LOGIN", "login")
    vi.stubEnv("DATAFORSEO_PASSWORD", "secret")
    for (let i = 0; i < 1001; i++) db.tables.seo_keywords.push(keywordRow({ keyword: `mot ${String(i).padStart(4, "0")}` }))
    const sizes: number[] = []
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, init: RequestInit) => {
        if (url.includes("search_volume")) sizes.push((JSON.parse(String(init.body)) as { keywords: string[] }[])[0].keywords.length)
        return new Response(JSON.stringify({ status_code: 20000, tasks: [{ status_code: 20000, result: [] }] }))
      }),
    )
    const res = await analyze()
    expect(res.status).toBe(200)
    expect(sizes).toEqual([1000, 1])
    expect(db.tables.seo_keywords.every((k) => k.metrics_checked_at)).toBe(true)
  })

  it("409 sans DataForSEO configuré", async () => {
    vi.stubEnv("DATAFORSEO_LOGIN", "")
    vi.stubEnv("DATAFORSEO_PASSWORD", "")
    const res = await analyze()
    expect(res.status).toBe(409)
    expect((await res.json()).error).toBe("DataForSEO n'est pas configuré : Paramètres › Connexions")
  })

  it("409 moins de 30 jours après la dernière analyse réussie", async () => {
    vi.stubEnv("DATAFORSEO_LOGIN", "login")
    vi.stubEnv("DATAFORSEO_PASSWORD", "secret")
    db.tables.seo_jobs.push({ name: "keywords-metrics", status: "ok", last_ok_at: new Date(Date.now() - 5 * 86_400_000).toISOString(), lock_until: null, cursor: {} })
    const res = await analyze()
    expect(res.status).toBe(409)
    const body = await res.json()
    expect(body.code).toBe("cooldown")
    expect(body.error).toMatch(/^Prochaine recherche de mots-clés à partir du/)
  })

  it("mesure les mots-clés à analyser et garde la date de l'analyse", async () => {
    vi.stubEnv("DATAFORSEO_LOGIN", "login")
    vi.stubEnv("DATAFORSEO_PASSWORD", "secret")
    db.tables.seo_keywords.push(
      keywordRow({ keyword: "factures mentions obligatoires", intent: "informational" }),
      keywordRow({ keyword: "ancien", status: "ignored" }),
      keywordRow({ keyword: "déjà mesuré", metrics_checked_at: new Date().toISOString(), volume: 10 }),
    )
    const ok = (result: unknown[]) => new Response(JSON.stringify({ status_code: 20000, tasks: [{ status_code: 20000, result }] }))
    const fetchMock = vi.fn(async (url: string) => {
      if (url.includes("search_volume")) return ok([{ keyword: "factures mentions obligatoires", search_volume: 3600, cpc: 0.8 }])
      if (url.includes("keyword_difficulty")) return ok([{ items: [{ keyword: "factures mentions obligatoires", keyword_difficulty: 12 }] }])
      return ok([{ items: [{ keyword: "factures mentions obligatoires", keyword_intent: { label: "commercial", probability: 0.5 } }] }])
    })
    vi.stubGlobal("fetch", fetchMock)

    const res = await analyze()
    expect(res.status).toBe(200)
    expect(await res.json()).toMatchObject({ ok: true, requested: 1, measured: 1, withVolume: 1 })
    expect(fetchMock).toHaveBeenCalledTimes(3)
    expect(db.tables.seo_keywords[0]).toMatchObject({ volume: 3600, difficulty: 12, cpc: 0.8, cpc_currency: "USD", intent: "informational" })
    expect(db.tables.seo_keywords[0].metrics_checked_at).toBeTruthy()
    expect(db.tables.seo_keywords[1].metrics_checked_at).toBeNull()
    expect(db.tables.seo_jobs.find((j) => j.name === "keywords-metrics")).toMatchObject({ status: "ok" })
  })

  it("502 et analyse relançable quand DataForSEO échoue", async () => {
    vi.stubEnv("DATAFORSEO_LOGIN", "login")
    vi.stubEnv("DATAFORSEO_PASSWORD", "secret")
    db.tables.seo_keywords.push(keywordRow({ keyword: "devis" }))
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ status_code: 20000, tasks: [{ status_code: 40210, status_message: "Insufficient funds." }] }))))
    const res = await analyze()
    expect(res.status).toBe(502)
    expect((await res.json()).error).toMatch(/solde/)
    const job = db.tables.seo_jobs.find((j) => j.name === "keywords-metrics")
    expect(job).toMatchObject({ status: "error" })
    expect(job?.last_ok_at ?? null).toBeNull()
    expect(db.tables.seo_keywords[0].metrics_checked_at).toBeNull()
  })
})

describe("synchronisation Search Console (tâche keywords)", () => {
  it("met à jour les mots-clés suivis et découvre les requêtes, hors marque, 50 au plus", async () => {
    db.tables.seo_keywords.push(
      keywordRow({ keyword: "devis modele" }),
      keywordRow({ keyword: "taux de tva travaux", position: 12, impressions: 8, clicks: 1 }),
    )
    db.rpcs.seo_gsc_bounds = () => [{ first_date: "2026-06-01", last_date: "2026-10-06" }]
    const queries = [
      { query: "devis modele", clicks: 0, impressions: 45, avg_position: 2.7 },
      { query: "qonforme connexion", clicks: 4, impressions: 30, avg_position: 1 },
      { query: "modele facture artisan", clicks: 0, impressions: 3, avg_position: 18 },
      { query: "devis plombier", clicks: 0, impressions: 2, avg_position: 40 },
      ...Array.from({ length: 60 }, (_, i) => ({ query: `requete ${i}`, clicks: 0, impressions: 4 + i, avg_position: 30 })),
    ]
    let args: Row | null = null
    db.rpcs.seo_gsc_by_query = (a) => ((args = a), queries)

    const result = await syncKeywordsFromSearchConsole(db.client as never, { now: new Date("2026-10-09T09:00:00Z"), deadline: Date.now() + 60_000 })
    expect(args).toEqual({ p_from: "2026-09-09", p_to: "2026-10-06", p_device: null, p_country: null })
    expect(result).toMatchObject({ updated: 2, discovered: 50, complete: true })

    const byKeyword = new Map(db.tables.seo_keywords.map((k) => [k.keyword, k]))
    expect(byKeyword.get("devis modele")).toMatchObject({ position: 2.7, impressions: 45, clicks: 0 })
    expect(byKeyword.get("taux de tva travaux")).toMatchObject({ position: null, impressions: null, clicks: null })
    expect(byKeyword.has("qonforme connexion")).toBe(false)
    expect(byKeyword.has("devis plombier")).toBe(false)
    expect(byKeyword.get("requete 59")).toMatchObject({ status: "candidate", source: "search_console", impressions: 63 })
  })

  it("sans données Search Console : rien n'est remis à zéro", async () => {
    db.tables.seo_keywords.push(keywordRow({ keyword: "devis modele", position: 2.7, impressions: 45, clicks: 0 }))
    db.rpcs.seo_gsc_bounds = () => [{ first_date: null, last_date: null }]
    const result = await syncKeywordsFromSearchConsole(db.client as never, { now: new Date(), deadline: Date.now() + 60_000 })
    expect(result).toMatchObject({ skipped: "no_gsc_data", updated: 0 })
    expect(db.tables.seo_keywords[0]).toMatchObject({ position: 2.7, impressions: 45 })
  })

  it("dates Search Console présentes mais aucune requête : rien n'est remis à zéro", async () => {
    db.tables.seo_keywords.push(keywordRow({ keyword: "devis modele", position: 2.7, impressions: 45, clicks: 0 }))
    db.rpcs.seo_gsc_bounds = () => [{ first_date: "2026-06-01", last_date: "2026-10-06" }]
    db.rpcs.seo_gsc_by_query = () => []
    const result = await syncKeywordsFromSearchConsole(db.client as never, { now: new Date("2026-10-09T09:00:00Z"), deadline: Date.now() + 60_000 })
    expect(result).toMatchObject({ skipped: "no_query_data", updated: 0, discovered: 0 })
    expect(db.tables.seo_keywords[0]).toMatchObject({ position: 2.7, impressions: 45, clicks: 0 })
  })

  it("lecture des requêtes en échec : erreur levée, rien n'est remis à zéro", async () => {
    db.tables.seo_keywords.push(keywordRow({ keyword: "devis modele", position: 2.7, impressions: 45, clicks: 0 }))
    db.rpcs.seo_gsc_bounds = () => [{ first_date: "2026-06-01", last_date: "2026-10-06" }]
    // seo_gsc_by_query n'est pas défini : le faux client rend PGRST202.
    await expect(
      syncKeywordsFromSearchConsole(db.client as never, { now: new Date("2026-10-09T09:00:00Z"), deadline: Date.now() + 60_000 }),
    ).rejects.toBeInstanceOf(SeoDbError)
    expect(db.tables.seo_keywords[0]).toMatchObject({ position: 2.7, impressions: 45, clicks: 0 })
  })
})

describe("page qui ressort dans Google (topPageFor)", () => {
  const range = { from: "2026-09-09", to: "2026-10-06" }

  it("regroupe les variantes d'apostrophe, garde la page la plus vue, départage par les clics", async () => {
    const rows = [
      { query: "devis d'artisan", page: "/guide/comment-faire-un-devis", clicks: 1, impressions: 10, avg_position: 8 },
      { query: `devis d${String.fromCharCode(0x2019)}artisan`, page: "/guide/comment-faire-un-devis", clicks: 0, impressions: 6, avg_position: 12 },
      { query: "devis d'artisan", page: "/modele", clicks: 3, impressions: 16, avg_position: 4 },
      { query: "autre requête", page: "/", clicks: 50, impressions: 900, avg_position: 1 },
    ]
    db.rpcs.seo_gsc_query_pages_agg = () => rows
    // 16 impressions chacune : /modele l'emporte par ses clics ; position pondérée (8×10 + 12×6) / 16 = 9,5 pour le guide.
    expect(await topPageFor(db.client as never, "devis d'artisan", range)).toEqual({ page: "/modele", clicks: 3, impressions: 16, position: 4 })
    rows[2].clicks = 0
    rows[0].clicks = 0
    expect(await topPageFor(db.client as never, "devis d'artisan", range)).toEqual({
      page: "/guide/comment-faire-un-devis",
      clicks: 0,
      impressions: 16,
      position: 9.5,
    })
  })

  it("un mot-clé avec virgule, parenthèse, guillemet ou barre oblique inverse reste une seule valeur du filtre", async () => {
    const keyword = 'modèle "devis", artisan (pdf) \\ 2026'
    expect(pgrstInList([keyword])).toBe('("modèle \\"devis\\", artisan (pdf) \\\\ 2026")')
    db.rpcs.seo_gsc_query_pages_agg = () => [
      { query: keyword, page: "/modele", clicks: 1, impressions: 5, avg_position: 7 },
      { query: "modèle", page: "/", clicks: 9, impressions: 99, avg_position: 1 },
    ]
    expect(await topPageFor(db.client as never, keyword, range)).toEqual({ page: "/modele", clicks: 1, impressions: 5, position: 7 })
  })
})
