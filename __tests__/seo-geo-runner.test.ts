/**
 * Visibilité IA : création d'un relevé (moteurs non configurés exclus, 409 si un relevé
 * tourne), traitement par paquets (essais, budget, résumé, clôture), tâche planifiée et
 * routes de l'admin (401, validation des questions). Base en mémoire imitant le
 * sous-ensemble de PostgREST utilisé ; moteurs simulés (aucun appel réseau).
 */
import { beforeEach, describe, expect, it, vi } from "vitest"
import type { GeoEngine } from "@/lib/seo/types"
import type { GeoEngineClient } from "@/lib/seo/geo/types"
import { GeoEngineError } from "@/lib/seo/geo/engines/http"

/* ------------------------------------------------------------------ */
/* Base en mémoire                                                     */
/* ------------------------------------------------------------------ */

type Row = Record<string, unknown>
type Filter = (r: Row) => boolean

function cmp(a: unknown, b: unknown): number {
  if (a === b) return 0
  if (a === null || a === undefined) return -1
  if (b === null || b === undefined) return 1
  return String(a) < String(b) ? -1 : 1
}

function fakeDb(initial: Record<string, Row[]> = {}) {
  const tables: Record<string, Row[]> = Object.fromEntries(Object.entries(initial).map(([k, v]) => [k, v.map((r) => ({ ...r }))]))
  let seq = 0
  const uuid = () => `00000000-0000-4000-8000-${String(++seq).padStart(12, "0")}`
  const rowsOf = (t: string) => (tables[t] ??= [])

  function from(table: string) {
    const filters: Filter[] = []
    let kind: "select" | "insert" | "update" | "delete" | "upsert" = "select"
    let values: Row | Row[] | null = null
    let returning = false
    const order: { col: string; asc: boolean }[] = []
    let limit: number | null = null
    let single: "single" | "maybe" | null = null
    let onConflict = "id"

    const run = () => {
      const rows = rowsOf(table)
      if (kind === "insert" || kind === "upsert") {
        const list = Array.isArray(values) ? values : [values as Row]
        const out: Row[] = []
        for (const v of list) {
          if (kind === "upsert") {
            const existing = rows.find((r) => onConflict.split(",").every((k) => r[k] === v[k]))
            if (existing) {
              Object.assign(existing, v)
              out.push({ ...existing })
              continue
            }
          }
          const row: Row = { id: uuid(), created_at: new Date().toISOString(), ...v }
          if (table === "seo_geo_runs" && row.status === undefined) row.status = "queued"
          rows.push(row)
          out.push({ ...row })
        }
        return finish(out)
      }
      let matched = rows.filter((r) => filters.every((f) => f(r)))
      if (kind === "update") {
        matched.forEach((r) => Object.assign(r, values))
        return finish(matched.map((r) => ({ ...r })))
      }
      if (kind === "delete") {
        tables[table] = rows.filter((r) => !matched.includes(r))
        return finish(matched.map((r) => ({ ...r })))
      }
      matched = matched.slice().sort((x, y) => {
        for (const o of order) {
          const c = cmp(x[o.col], y[o.col])
          if (c !== 0) return o.asc ? c : -c
        }
        return 0
      })
      if (limit !== null) matched = matched.slice(0, limit)
      return finish(matched.map((r) => ({ ...r })))
    }
    const finish = (out: Row[]) => {
      if (single) {
        if (out.length === 0) return single === "maybe" ? { data: null, error: null } : { data: null, error: { code: "PGRST116", message: "0 rows" } }
        return { data: out[0], error: null }
      }
      return { data: kind !== "select" && !returning ? null : out, error: null }
    }
    const api = {
      select: () => {
        if (kind !== "select") returning = true
        return api
      },
      insert: (v: Row | Row[]) => ((kind = "insert"), (values = v), api),
      upsert: (v: Row, opts?: { onConflict?: string }) => ((kind = "upsert"), (values = v), (onConflict = opts?.onConflict ?? "id"), api),
      update: (v: Row) => ((kind = "update"), (values = v), api),
      delete: () => ((kind = "delete"), api),
      eq: (k: string, v: unknown) => (filters.push((r) => r[k] === v), api),
      neq: (k: string, v: unknown) => (filters.push((r) => r[k] !== v), api),
      in: (k: string, list: unknown[]) => (filters.push((r) => list.includes(r[k])), api),
      lt: (k: string, v: unknown) => (filters.push((r) => r[k] !== null && r[k] !== undefined && cmp(r[k], v) < 0), api),
      // Sous-ensemble de la syntaxe PostgREST : « col.is.null,col.lt.valeur »
      or: (expr: string) => {
        const conds = expr.split(",").map((c) => {
          const [col, op, ...rest] = c.split(".")
          // Valeur entre guillemets (« lock_until.lt."2026-…" ») : guillemets retirés, comme PostgREST
          return { col, op, value: rest.join(".").replace(/^"(.*)"$/, "$1") }
        })
        filters.push((r) =>
          conds.some(({ col, op, value }) => {
            const v = r[col]
            if (op === "is") return value === "null" && (v === null || v === undefined)
            if (op === "lt") return v !== null && v !== undefined && cmp(v, value) < 0
            if (op === "eq") return String(v) === value
            return false
          }),
        )
        return api
      },
      order: (col: string, opts?: { ascending?: boolean }) => (order.push({ col, asc: opts?.ascending !== false }), api),
      limit: (n: number) => ((limit = n), api),
      single: () => ((single = "single"), Promise.resolve(run())),
      maybeSingle: () => ((single = "maybe"), Promise.resolve(run())),
      then: (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) => Promise.resolve(run()).then(resolve, reject),
    }
    return api
  }
  return { tables, client: { from } as unknown as import("@/lib/seo/db").SeoDb }
}

/* ------------------------------------------------------------------ */
/* Moteurs simulés                                                     */
/* ------------------------------------------------------------------ */

function fakeClients(
  behaviour: Partial<Record<GeoEngine, { configured: boolean; ask?: GeoEngineClient["ask"] }>>,
): Record<GeoEngine, GeoEngineClient> {
  const keys: GeoEngine[] = ["gemini", "chatgpt", "perplexity", "claude", "google_ai_overview"]
  return Object.fromEntries(
    keys.map((key) => [
      key,
      {
        key,
        isConfigured: () => behaviour[key]?.configured ?? false,
        ask: behaviour[key]?.ask ?? (async () => ({ answer: "Réponse neutre.", sources: [], model: "test" })),
      },
    ]),
  ) as Record<GeoEngine, GeoEngineClient>
}

const QUESTIONS = [
  { id: "q-1", question: "Quel logiciel de devis choisir pour un artisan ?", position: 1, active: true },
  { id: "q-2", question: "Quelles mentions sur une facture d'artisan ?", position: 2, active: true },
  { id: "q-3", question: "Question désactivée pour le suivi ?", position: 3, active: false },
]

const GEO_SETTINGS = {
  key: "geo",
  updated_at: "2026-10-01T00:00:00Z",
  value: {
    engines: { gemini: true, chatgpt: true, perplexity: true, claude: false, google_ai_overview: false },
    frequency: "monthly",
    dayOfMonth: 1,
    repetitions: 1,
    market: "France",
    language: "français",
  },
}

function seed(extra: Record<string, Row[]> = {}) {
  return fakeDb({ seo_geo_questions: QUESTIONS, seo_settings: [GEO_SETTINGS], seo_geo_runs: [], seo_geo_answers: [], ...extra })
}

/* ------------------------------------------------------------------ */
/* Relevés                                                             */
/* ------------------------------------------------------------------ */

import {
  cancelRun,
  CANCELLED_ERROR,
  createRun,
  GeoRunConflictError,
  GeoRunUnavailableError,
  INTERRUPTED_ERROR,
  processPending,
  runProgress,
} from "@/lib/seo/geo/runner"

describe("création d'un relevé", () => {
  it("une réponse par question active × moteur allumé ET configuré × répétition", async () => {
    const db = seed()
    // perplexity allumé mais sans clé, claude configuré mais éteint : exclus tous deux
    const clients = fakeClients({ gemini: { configured: true }, chatgpt: { configured: true }, perplexity: { configured: false }, claude: { configured: true } })
    const { run, total } = await createRun(db.client, "immediate", { clients })
    expect(run.engines).toEqual(["gemini", "chatgpt"])
    expect(run.status).toBe("queued")
    expect(total).toBe(4)
    const answers = db.tables.seo_geo_answers
    expect(answers.map((a) => `${a.question_id}:${a.engine}:${a.repetition}`).sort()).toEqual(["q-1:chatgpt:1", "q-1:gemini:1", "q-2:chatgpt:1", "q-2:gemini:1"])
    expect(answers.every((a) => a.status === "pending" && typeof a.question === "string")).toBe(true)
  })

  it("répétitions du réglage", async () => {
    const db = seed({ seo_settings: [{ ...GEO_SETTINGS, value: { ...GEO_SETTINGS.value, repetitions: 3 } }] })
    const { total } = await createRun(db.client, "monthly", { clients: fakeClients({ gemini: { configured: true } }) })
    expect(total).toBe(2 * 1 * 3)
  })

  it("refuse un second relevé tant qu'un relevé tourne (409)", async () => {
    const db = seed({ seo_geo_runs: [{ id: "run-active", kind: "monthly", status: "running", engines: ["gemini"], repetitions: 1, created_at: "2026-10-01T06:00:00Z" }] })
    await expect(createRun(db.client, "immediate", { clients: fakeClients({ gemini: { configured: true } }) })).rejects.toBeInstanceOf(GeoRunConflictError)
  })

  it("sans moteur configuré ou sans question active : refus explicite", async () => {
    await expect(createRun(seed().client, "immediate", { clients: fakeClients({}) })).rejects.toBeInstanceOf(GeoRunUnavailableError)
    const db = seed({ seo_geo_questions: QUESTIONS.map((q) => ({ ...q, active: false })) })
    await expect(createRun(db.client, "immediate", { clients: fakeClients({ gemini: { configured: true } }) })).rejects.toThrow(/Aucune question active/)
  })
})

describe("traitement des réponses", () => {
  it("interroge, repère, enregistre, puis clôt le relevé avec son résumé", async () => {
    const db = seed({
      seo_settings: [
        GEO_SETTINGS,
        { key: "targeting", updated_at: "2026-10-01T00:00:00Z", value: { brandTerms: ["Qonforme", "qonforme.fr"], competitors: ["tolteck.com"] } },
      ],
    })
    const clients = fakeClients({
      gemini: {
        configured: true,
        ask: async () => ({
          answer: "Qonforme est pensé pour les artisans ; Tolteck aussi.",
          sources: [{ url: "https://qonforme.fr/guide/tva-travaux", domain: "qonforme.fr", title: "TVA" }],
          model: "gemini-2.5-flash",
        }),
      },
      chatgpt: { configured: true, ask: async () => ({ answer: "Plusieurs outils existent.", sources: [], model: "gpt-4.1-mini" }) },
    })
    const { run } = await createRun(db.client, "immediate", { clients })
    const res = await processPending(db.client, { stopAt: Date.now() + 120_000, runId: run.id, clients })
    expect(res).toMatchObject({ processed: 4, done: 4, failed: 0, finalized: [run.id] })

    const saved = db.tables.seo_geo_answers.find((a) => a.engine === "gemini")!
    expect(saved).toMatchObject({ status: "done", brand_mentioned: true, site_cited: true, competitors_mentioned: ["tolteck.com"], attempts: 1, model: "gemini-2.5-flash" })

    const closed = db.tables.seo_geo_runs[0]
    expect(closed.status).toBe("done")
    const summary = closed.summary as { engines: Record<string, unknown>; overall: unknown; domains: Record<string, unknown> }
    expect(summary.engines.gemini).toMatchObject({ mention_rate: 1, citation_rate: 1, answers: 2 })
    expect(summary.engines.chatgpt).toMatchObject({ mention_rate: 0, citation_rate: 0, answers: 2 })
    expect(summary.overall).toMatchObject({ mention_rate: 0.5, citation_rate: 0.5 })
    expect(summary.domains["tolteck.com"]).toMatchObject({ mention_rate: 0.5 })
    expect(await runProgress(db.client, run.id)).toEqual({ runId: run.id, done: 4, total: 4, status: "done" })
  })

  it("deux essais au plus ; une erreur définitive n'est pas renouvelée ; tout en échec : relevé « failed »", async () => {
    const db = seed()
    let calls = 0
    const clients = fakeClients({
      gemini: {
        configured: true,
        ask: async () => {
          calls++
          throw new GeoEngineError("Gemini : limite de requêtes atteinte, HTTP 429", "rate_limit", { status: 429 })
        },
      },
      chatgpt: {
        configured: true,
        ask: async () => {
          throw new GeoEngineError("ChatGPT : clé refusée par le fournisseur, HTTP 401", "auth", { status: 401, retryable: false })
        },
      },
    })
    const { run } = await createRun(db.client, "immediate", { clients })
    const first = await processPending(db.client, { stopAt: Date.now() + 120_000, clients })
    // Limite de débit : pas de second essai aussitôt, la réponse attend sa pause (2 min sur un 429)
    expect(calls).toBe(2)
    expect(first.failed).toBe(2)
    const waiting = db.tables.seo_geo_answers.filter((a) => a.engine === "gemini")
    expect(waiting.every((a) => a.status === "pending" && a.attempts === 1 && Date.parse(String(a.lock_until)) > Date.now() + 100_000)).toBe(true)
    expect(db.tables.seo_geo_runs.find((r) => r.id === run.id)!.status).toBe("running")

    // Pause écoulée : second et dernier essai
    waiting.forEach((a) => (a.lock_until = "2000-01-01T00:00:00Z"))
    const second = await processPending(db.client, { stopAt: Date.now() + 120_000, clients })
    expect(calls).toBe(4) // 2 questions × 2 essais
    expect(second.failed).toBe(2)
    const chat = db.tables.seo_geo_answers.filter((a) => a.engine === "chatgpt")
    expect(chat.every((a) => a.status === "failed" && a.attempts === 1 && String(a.error).includes("clé refusée"))).toBe(true)
    const closed = db.tables.seo_geo_runs.find((r) => r.id === run.id)!
    expect(closed.status).toBe("failed")
    expect(String(closed.note)).toMatch(/Aucune réponse obtenue/)
  })

  it("pas de nouvel appel sous 20 s de budget ; un délai dépassé (même coupé par le budget du pas) compte comme un essai", async () => {
    const db = seed()
    const ask = vi.fn(async () => ({ answer: "x", sources: [], model: "m" }))
    const clients = fakeClients({ gemini: { configured: true, ask } })
    const { run } = await createRun(db.client, "immediate", { clients })
    const none = await processPending(db.client, { stopAt: Date.now() + 10_000, clients })
    expect(ask).not.toHaveBeenCalled()
    expect(none.processed).toBe(0)

    let calls = 0
    const timeout = fakeClients({
      gemini: {
        configured: true,
        ask: async () => {
          calls++
          throw new GeoEngineError("Gemini : pas de réponse en 25 s", "timeout")
        },
      },
    })
    await processPending(db.client, { stopAt: Date.now() + 25_000, clients: timeout })
    expect(calls).toBe(2)
    expect(db.tables.seo_geo_answers.every((a) => a.status === "pending" && a.attempts === 1 && /délai dépassé/.test(String(a.error)))).toBe(true)

    // Pause écoulée : second et dernier essai, puis échec « délai dépassé » et relevé clos
    db.tables.seo_geo_answers.forEach((a) => (a.lock_until = "2000-01-01T00:00:00Z"))
    const res = await processPending(db.client, { stopAt: Date.now() + 25_000, clients: timeout })
    expect(calls).toBe(4)
    expect(res.failed).toBe(2)
    expect(db.tables.seo_geo_answers.every((a) => a.status === "failed" && a.attempts === 2 && /délai dépassé/.test(String(a.error)))).toBe(true)
    expect(db.tables.seo_geo_runs.find((r) => r.id === run.id)!.status).toBe("failed")
  })

  it("une réponse interrompue à chaque essai (serveur arrêté pendant l'appel) passe en échec au lieu d'être relancée", async () => {
    const db = seed({
      seo_geo_runs: [{ id: "run-1", kind: "immediate", status: "running", engines: ["gemini"], repetitions: 1, created_at: "2026-10-09T08:00:00Z" }],
      seo_geo_answers: [
        { id: "a-1", run_id: "run-1", question_id: "q-1", question: "Q ?", engine: "gemini", repetition: 1, status: "running", attempts: 2, lock_until: "2000-01-01T00:00:00Z", created_at: "2026-10-09T08:00:00Z" },
      ],
    })
    const ask = vi.fn(async () => ({ answer: "x", sources: [], model: "m" }))
    const res = await processPending(db.client, { stopAt: Date.now() + 120_000, clients: fakeClients({ gemini: { configured: true, ask } }) })
    expect(ask).not.toHaveBeenCalled()
    expect(res.failed).toBe(1)
    expect(db.tables.seo_geo_answers[0]).toMatchObject({ status: "failed", error: INTERRUPTED_ERROR })
    expect(db.tables.seo_geo_runs[0].status).toBe("failed")
  })

  it("reprend une réponse « en cours » dont le verrou a expiré", async () => {
    const db = seed({
      seo_geo_runs: [{ id: "run-1", kind: "immediate", status: "running", engines: ["gemini"], repetitions: 1, created_at: "2026-10-09T08:00:00Z" }],
      seo_geo_answers: [
        { id: "a-1", run_id: "run-1", question_id: "q-1", question: "Q ?", engine: "gemini", repetition: 1, status: "running", attempts: 0, lock_until: "2000-01-01T00:00:00Z", created_at: "2026-10-09T08:00:00Z" },
      ],
    })
    const res = await processPending(db.client, { stopAt: Date.now() + 120_000, clients: fakeClients({ gemini: { configured: true } }) })
    expect(res.done).toBe(1)
    expect(db.tables.seo_geo_runs[0].status).toBe("done")
  })
})

describe("relecture : base en panne, concurrents ajoutés après coup", () => {
  it("une écriture en base qui échoue n'est pas une panne du moteur : ni essai compté, ni faux message", async () => {
    const db = seed()
    const clients = fakeClients({ gemini: { configured: true } })
    await createRun(db.client, "immediate", { clients })
    // L'enregistrement « done » échoue (base injoignable) ; le verrou « running » reste posé
    const failing = {
      from: (table: string) => {
        const q = db.client.from(table) as unknown as Record<string, unknown>
        if (table !== "seo_geo_answers") return q
        return {
          ...q,
          update: (v: Record<string, unknown>) => {
            if (v.status === "done") {
              const chain = { eq: () => chain, then: (resolve: (x: unknown) => unknown) => resolve({ data: null, error: { code: "08006", message: "connexion perdue" } }) }
              return chain
            }
            return (q.update as (v: unknown) => unknown)(v)
          },
        }
      },
    } as unknown as import("@/lib/seo/db").SeoDb
    const { SeoDbError } = await import("@/lib/seo/db")
    await expect(processPending(failing, { stopAt: Date.now() + 120_000, clients, concurrency: 1 })).rejects.toBeInstanceOf(SeoDbError)
    // Reste « en cours » (repris à l'expiration du verrou) ; l'essai compté à la prise borne les reprises
    const answer = db.tables.seo_geo_answers.find((a) => a.status === "running")!
    expect(answer.attempts).toBe(1)
    expect(answer.error ?? null).toBeNull()
  })

  it("une question qui nomme un concurrent suivi n'est jamais envoyée aux moteurs (noté sur le relevé)", async () => {
    const db = seed({
      seo_geo_questions: [...QUESTIONS, { id: "q-4", question: "Tolteck est-il adapté aux artisans du bâtiment ?", position: 4, active: true }],
    })
    const clients = fakeClients({ gemini: { configured: true } })
    const { run, total } = await createRun(db.client, "immediate", { clients })
    expect(total).toBe(2)
    expect(db.tables.seo_geo_answers.some((a) => a.question_id === "q-4")).toBe(false)
    expect(run.note).toMatch(/1 question écartée/)
    await processPending(db.client, { stopAt: Date.now() + 120_000, clients })
    // Relevé réussi : la note est gardée
    expect(db.tables.seo_geo_runs[0]).toMatchObject({ status: "done", note: run.note })
  })
})

describe("arrêter le relevé", () => {
  it("garde les réponses obtenues, écarte les autres, clôt le relevé avec son résumé et libère la place", async () => {
    const db = seed()
    const clients = fakeClients({ gemini: { configured: true }, chatgpt: { configured: true } })
    const { run } = await createRun(db.client, "immediate", { clients })
    // Une réponse obtenue, les autres en attente
    await processPending(db.client, { stopAt: Date.now() + 120_000, clients, concurrency: 1 }).catch(() => null)
    db.tables.seo_geo_answers.slice(1).forEach((a) => Object.assign(a, { status: "pending", answer: null, done_at: null, attempts: 0 }))
    db.tables.seo_geo_runs[0].status = "running"

    const res = await cancelRun(db.client, run.id)
    expect(res).toMatchObject({ cancelled: true, run: { status: "done" } })
    expect(res!.run.note).toMatch(/Relevé arrêté avant la fin : 3 réponses non obtenues/)
    expect(res!.run.summary?.overall).toBeTruthy()
    const skipped = db.tables.seo_geo_answers.filter((a) => a.status === "skipped")
    expect(skipped).toHaveLength(3)
    expect(skipped.every((a) => a.error === CANCELLED_ERROR)).toBe(true)
    // Déjà clos : rien ne change ; un nouveau relevé peut être créé
    expect(await cancelRun(db.client, run.id)).toMatchObject({ cancelled: false })
    await expect(createRun(db.client, "immediate", { clients })).resolves.toBeTruthy()
  })

  it("sans aucune réponse obtenue : relevé « cancelled » ; relevé inconnu : null", async () => {
    const db = seed()
    const { run } = await createRun(db.client, "immediate", { clients: fakeClients({ gemini: { configured: true } }) })
    expect(await cancelRun(db.client, run.id)).toMatchObject({ cancelled: true, run: { status: "cancelled", summary: null } })
    expect(await cancelRun(db.client, "00000000-0000-4000-8000-0000000000ff")).toBeNull()
  })
})

/* ------------------------------------------------------------------ */
/* Tâche planifiée                                                     */
/* ------------------------------------------------------------------ */

describe("tâche « geo »", () => {
  it("relevé mensuel dû à partir du jour réglé après 6 h (Paris), une fois par mois", async () => {
    const saved = { ...process.env }
    process.env.GEMINI_API_KEY = "test-key-gemini"
    const { monthlyDue } = await import("@/lib/seo/geo/task")
    const db = seed()
    expect(await monthlyDue(db.client, new Date("2026-10-01T03:30:00Z"))).toBe(false) // 5 h 30 à Paris
    expect(await monthlyDue(db.client, new Date("2026-10-01T04:30:00Z"))).toBe(true) // 6 h 30
    expect(await monthlyDue(db.client, new Date("2026-10-09T10:00:00Z"))).toBe(true) // rattrapage dans le mois
    db.tables.seo_geo_runs.push({ id: "m-1", kind: "monthly", status: "done", created_at: "2026-10-01T04:31:00Z" })
    expect(await monthlyDue(db.client, new Date("2026-10-09T10:00:00Z"))).toBe(false)
    expect(await monthlyDue(db.client, new Date("2026-11-01T06:00:00Z"))).toBe(true)
    delete process.env.GEMINI_API_KEY
    delete process.env.OPENAI_API_KEY
    delete process.env.PERPLEXITY_API_KEY
    expect(await monthlyDue(db.client, new Date("2026-11-01T06:00:00Z"))).toBe(false) // aucun moteur configuré
    process.env = saved
  })

  it("une analyse immédiate créée entre-temps (23505) : le passage continue au lieu d'échouer", async () => {
    const saved = { ...process.env }
    process.env.GEMINI_API_KEY = "test-key-gemini"
    const { geoTask } = await import("@/lib/seo/geo/task")
    const db = seed()
    // L'index unique refuse le relevé mensuel : une analyse immédiate vient de naître
    const racing = {
      from: (table: string) => {
        const q = db.client.from(table) as unknown as Record<string, unknown>
        if (table !== "seo_geo_runs") return q
        return {
          ...q,
          insert: () => {
            db.tables.seo_geo_runs.push({ id: "run-immediate", kind: "immediate", status: "queued", engines: [], repetitions: 1, created_at: new Date().toISOString() })
            const chain = { select: () => chain, single: async () => ({ data: null, error: { code: "23505", message: "duplicate key" } }) }
            return chain
          },
        }
      },
    } as unknown as import("@/lib/seo/db").SeoDb
    const ctx = { db: racing, now: new Date("2026-10-01T05:00:00Z"), deadline: Date.now() + 60_000 } as unknown as Parameters<typeof geoTask.run>[0]
    await expect(geoTask.run(ctx)).resolves.toMatchObject({ created: null })
    // Le relevé tout juste créé, encore sans réponses, n'est pas clos « sans réponse »
    expect(db.tables.seo_geo_runs.find((r) => r.id === "run-immediate")!.status).toBe("queued")
    process.env = saved
  })
})

/* ------------------------------------------------------------------ */
/* Routes de l'admin                                                   */
/* ------------------------------------------------------------------ */

const state = vi.hoisted(() => ({ admin: true, db: null as unknown }))
vi.mock("@/lib/admin-require", () => ({ isAdminAuthenticated: async () => state.admin }))
vi.mock("@/lib/seo/db", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/seo/db")>()
  return { ...actual, seoDb: () => state.db }
})

const req = (body?: unknown) =>
  new Request("http://localhost/api", { method: "POST", headers: { "content-type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) }) as unknown as import("next/server").NextRequest

describe("routes de l'admin", () => {
  beforeEach(() => {
    state.admin = true
    state.db = seed().client
  })

  it("401 sans session admin", async () => {
    state.admin = false
    const runs = await import("@/app/api/admin/seo/geo/runs/route")
    const questions = await import("@/app/api/admin/seo/geo/questions/route")
    const step = await import("@/app/api/admin/seo/geo/runs/[id]/step/route")
    const cancel = await import("@/app/api/admin/seo/geo/runs/[id]/cancel/route")
    expect((await cancel.POST(req(), { params: { id: "00000000-0000-4000-8000-000000000001" } })).status).toBe(401)
    const topic = await import("@/app/api/admin/seo/geo/questions/[id]/topic/route")
    expect((await runs.POST()).status).toBe(401)
    expect((await questions.POST(req({ question: "Une question assez longue ?" }))).status).toBe(401)
    expect((await step.POST(req(), { params: { id: "00000000-0000-4000-8000-000000000001" } })).status).toBe(401)
    expect((await topic.POST(req(), { params: { id: "00000000-0000-4000-8000-000000000001" } })).status).toBe(401)
  })

  it("questions : validation, doublon, 20 au plus", async () => {
    const { POST } = await import("@/app/api/admin/seo/geo/questions/route")
    const short = await POST(req({ question: "Court ?" }))
    expect(short.status).toBe(400)
    expect((await short.json()).error).toMatch(/au moins 10/)

    const dup = await POST(req({ question: "quel logiciel de devis choisir pour un artisan ?" }))
    expect(dup.status).toBe(409)

    // Un concurrent suivi ne part jamais chez les moteurs IA (usage interne)
    const competitor = await POST(req({ question: "Tolteck est-il adapté aux artisans du bâtiment ?" }))
    expect(competitor.status).toBe(400)
    expect((await competitor.json()).error).toMatch(/concurrent/)

    const ok = await POST(req({ question: "Comment relancer une facture impayée ?" }))
    expect(ok.status).toBe(201)
    expect((await ok.json()).question).toMatchObject({ position: 4, active: true })

    state.db = seed({
      seo_geo_questions: Array.from({ length: 20 }, (_, i) => ({ id: `q${i}`, question: `Question numéro ${i} ?`, position: i, active: true })),
    }).client
    const full = await POST(req({ question: "Une vingt et unième question ?" }))
    expect(full.status).toBe(400)
    expect((await full.json()).error).toMatch(/20 questions/)
  })

  it("questions : messages en français pour un corps mal formé", async () => {
    const { POST } = await import("@/app/api/admin/seo/geo/questions/route")
    const route = await import("@/app/api/admin/seo/geo/questions/[id]/route")
    const id = { params: { id: "00000000-0000-4000-8000-000000000001" } }
    expect((await (await POST(req(null))).json()).error).toBe("Corps attendu : { question }")
    expect((await (await route.PATCH(req({ active: "oui" }), id)).json()).error).toBe("« active » doit valoir vrai ou faux")
  })

  it("réactiver une question qui nomme un concurrent suivi : refusé", async () => {
    const qid = "00000000-0000-4000-8000-0000000000bb"
    state.db = seed({ seo_geo_questions: [{ id: qid, question: "Tolteck est-il adapté aux artisans du bâtiment ?", position: 1, active: false }] }).client
    const route = await import("@/app/api/admin/seo/geo/questions/[id]/route")
    const res = await route.PATCH(req({ active: true }), { params: { id: qid } })
    expect(res.status).toBe(400)
    expect((await res.json()).error).toMatch(/concurrent/)
    expect((await route.PATCH(req({ active: false }), { params: { id: qid } })).status).toBe(200)
  })

  it("modification et suppression : identifiant invalide → 404", async () => {
    const route = await import("@/app/api/admin/seo/geo/questions/[id]/route")
    const bad = await route.PATCH(req({ active: false }), { params: { id: "pas-un-uuid" } })
    expect(bad.status).toBe(404)
    const missing = await route.DELETE(req(), { params: { id: "00000000-0000-4000-8000-0000000000ff" } })
    expect(missing.status).toBe(404)
  })

  it("arrêter le relevé : identifiant invalide ou inconnu → 404, sinon le relevé clos", async () => {
    const fake = seed({ seo_geo_runs: [{ id: "00000000-0000-4000-8000-0000000000dd", kind: "immediate", status: "running", engines: ["gemini"], repetitions: 1, created_at: new Date().toISOString() }] })
    state.db = fake.client
    const { POST } = await import("@/app/api/admin/seo/geo/runs/[id]/cancel/route")
    expect((await POST(req(), { params: { id: "pas-un-uuid" } })).status).toBe(404)
    expect((await POST(req(), { params: { id: "00000000-0000-4000-8000-0000000000ee" } })).status).toBe(404)
    const res = await POST(req(), { params: { id: "00000000-0000-4000-8000-0000000000dd" } })
    expect(res.status).toBe(200)
    expect(await res.json()).toMatchObject({ cancelled: true, run: { status: "cancelled" } })
  })

  it("analyse immédiate : 409 si un relevé tourne", async () => {
    state.db = seed({ seo_geo_runs: [{ id: "run-active", kind: "monthly", status: "queued", engines: ["gemini"], repetitions: 1, created_at: "2026-10-09T06:00:00Z" }] }).client
    const { POST } = await import("@/app/api/admin/seo/geo/runs/route")
    const res = await POST()
    expect(res.status).toBe(409)
    expect(await res.json()).toMatchObject({ code: "run_in_progress", runId: "run-active" })
  })

  it("créer un sujet : un seul sujet par question, sans concurrent", async () => {
    const fake = seed({ seo_geo_questions: [{ id: "00000000-0000-4000-8000-0000000000aa", question: "Quel logiciel de devis choisir ?", position: 1, active: true }], seo_topics: [] })
    state.db = fake.client
    const { POST } = await import("@/app/api/admin/seo/geo/questions/[id]/topic/route")
    const params = { params: { id: "00000000-0000-4000-8000-0000000000aa" } }
    const first = await POST(req(), params)
    expect(first.status).toBe(201)
    const again = await POST(req(), params)
    expect(again.status).toBe(200)
    expect((await again.json()).existed).toBe(true)
    expect(fake.tables.seo_topics).toHaveLength(1)
    // Archivé compris : un sujet archivé se restaure dans Articles › Sujets, jamais doublé
    fake.tables.seo_topics[0].status = "archived"
    const archived = await POST(req(), params)
    expect(archived.status).toBe(200)
    expect(fake.tables.seo_topics).toHaveLength(1)
    fake.tables.seo_topics[0].status = "unplanned"
    expect(fake.tables.seo_topics[0]).toMatchObject({
      title: "Quel logiciel de devis choisir ?",
      source: "visibility",
      geo_question_id: "00000000-0000-4000-8000-0000000000aa",
      article_type: "faq",
      status: "unplanned",
    })
  })

  it("créer un sujet : deux demandes simultanées (23505) rendent le même sujet", async () => {
    const qid = "00000000-0000-4000-8000-0000000000cc"
    const fake = seed({ seo_geo_questions: [{ id: qid, question: "Quel logiciel de devis choisir ?", position: 1, active: true }], seo_topics: [] })
    state.db = {
      from: (table: string) => {
        const q = fake.client.from(table) as unknown as Record<string, unknown>
        if (table !== "seo_topics") return q
        return {
          ...q,
          insert: () => {
            // L'autre demande a gagné : son sujet existe, notre insertion heurte l'index unique
            fake.tables.seo_topics.push({ id: "topic-winner", title: "Quel logiciel de devis choisir ?", status: "unplanned", geo_question_id: qid, created_at: new Date().toISOString() })
            const chain = { select: () => chain, single: async () => ({ data: null, error: { code: "23505", message: "duplicate key" } }) }
            return chain
          },
        }
      },
    }
    const { POST } = await import("@/app/api/admin/seo/geo/questions/[id]/topic/route")
    const res = await POST(req(), { params: { id: qid } })
    expect(res.status).toBe(200)
    expect(await res.json()).toMatchObject({ existed: true, topic: { id: "topic-winner" } })
    expect(fake.tables.seo_topics).toHaveLength(1)
  })
})
