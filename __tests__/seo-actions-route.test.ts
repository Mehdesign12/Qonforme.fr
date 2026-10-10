/**
 * Routes des Actions SEO sur une base simulée :
 * - PATCH /api/admin/seo/findings/[id] : 401, 400, 404, transitions refusées
 *   (409), « fait » avec date de mesure à 14 jours et mesures « avant », « rouvrir » ;
 * - POST /api/admin/seo/findings/[id]/suggest : clé absente, règle sans
 *   proposition, proposition contrôlée sans concurrent dans la consigne.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { fakeOnboardingDb, type FakeOnboardingDb } from "./helpers/fake-onboarding-db"

let fake: FakeOnboardingDb
let client: unknown
let admin = true

vi.mock("@/lib/admin-require", () => ({ isAdminAuthenticated: () => Promise.resolve(admin) }))
vi.mock("@/lib/supabase/server", () => ({ createAdminClient: () => client, createClient: () => client }))

import { PATCH } from "@/app/api/admin/seo/findings/[id]/route"
import { POST as SUGGEST } from "@/app/api/admin/seo/findings/[id]/suggest/route"
import { readVerification } from "@/lib/seo/actions/verdict"
import { checkSuggestion, parseStoredSuggestion } from "@/lib/seo/actions/suggest"

const OPEN = "6f1d2c3b-4a5e-4f60-8a7b-9c0d1e2f3a4b"
const DONE = "7a2e3d4c-5b6f-4071-9b8c-0d1e2f3a4b5c"
const RESOLVED = "8b3f4e5d-6c70-4182-8c9d-1e2f3a4b5c6d"
const H1 = "9c405f6e-7d81-4293-9dae-2f3a4b5c6d7e"
const UNKNOWN = "0d516a7f-8e92-43a4-8ebf-3a4b5c6d7e8f"
const IMPORT = "1e627b80-9fa3-44b5-9fc0-4b5c6d7e8f90"

type Row = Record<string, unknown>

function finding(id: string, status: string, extra: Row = {}): Row {
  return {
    id,
    rule: "gsc-no-click",
    path: "/modele",
    page_type: "modele",
    title: "Page bien classée sans clic",
    explanation: "122 impressions, 0 clic, position 6,2",
    recommendation: "Réécrire le title.",
    severity: "high",
    source: "search_console",
    effort_minutes: 30,
    metrics: { title: "Modèle de devis et de facture gratuit, prêt à remplir", description: "Ancienne description." },
    suggestion: null,
    status,
    detected_at: "2026-10-03T08:00:00Z",
    last_seen_at: "2026-10-09T08:00:00Z",
    done_at: status === "done" ? "2026-10-05T08:00:00Z" : null,
    ignored_at: null,
    resolved_at: status === "resolved" ? "2026-10-06T08:00:00Z" : null,
    verify_after: status === "done" ? "2026-10-19T08:00:00Z" : null,
    verification: status === "done" ? { before: null, after: null, verdict: null } : null,
    history: [{ at: "2026-10-03T08:00:00Z", event: "detected" }],
    ...extra,
  }
}

function withGsc(f: FakeOnboardingDb, opts: { lastDay: string | null; pages?: Row[]; queries?: Row[] }): unknown {
  const rpc = (fn: string) => {
    let data: unknown[] = []
    if (fn === "seo_gsc_bounds") data = [{ first_date: opts.lastDay ? "2026-01-01" : null, last_date: opts.lastDay }]
    if (fn === "seo_gsc_by_page") data = opts.pages ?? []
    if (fn === "seo_gsc_query_pages_agg") data = opts.queries ?? []
    return Object.assign(Promise.resolve({ data, error: null }), {
      range: (a: number, b: number) => Promise.resolve({ data: data.slice(a, b + 1), error: null }),
    })
  }
  return { ...f.client, rpc }
}

const params = (id: string) => ({ params: Promise.resolve({ id }) })
const patch = (id: string, body: unknown) =>
  PATCH(new Request(`https://qonforme.fr/api/admin/seo/findings/${id}`, { method: "PATCH", body: JSON.stringify(body) }) as never, params(id))
const row = (id: string) => fake.tables.seo_findings.find((f) => f.id === id) as Row

beforeEach(() => {
  admin = true
  fake = fakeOnboardingDb({
    seo_findings: [
      finding(OPEN, "open"),
      finding(DONE, "done"),
      finding(RESOLVED, "resolved"),
      finding(H1, "open", { rule: "crawl-h1", source: "crawl" }),
      finding(IMPORT, "done", { rule: "manual", path: "/", source: "import", title: "Un seul H1 par page", recommendation: null, explanation: null, verify_after: null, verification: null }),
    ],
  })
  client = withGsc(fake, { lastDay: "2026-10-06", pages: [{ page: "/modele", clicks: 0, impressions: 61, avg_position: 6.4 }] })
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
})

describe("PATCH /api/admin/seo/findings/[id]", () => {
  it("401 sans session admin", async () => {
    admin = false
    expect((await patch(OPEN, { action: "done" })).status).toBe(401)
    expect(row(OPEN).status).toBe("open")
  })

  it("400 pour une action inconnue ou un corps illisible", async () => {
    expect((await patch(OPEN, { action: "supprimer" })).status).toBe(400)
    const res = await PATCH(new Request("https://qonforme.fr/x", { method: "PATCH", body: "pas du json" }) as never, params(OPEN))
    expect(res.status).toBe(400)
  })

  it("404 pour un constat inconnu ou un identifiant invalide (jamais envoyé à la base)", async () => {
    expect((await patch(UNKNOWN, { action: "done" })).status).toBe(404)
    const before = fake.ops.length
    expect((await patch("1 or 1=1", { action: "done" })).status).toBe(404)
    expect(fake.ops.length).toBe(before)
  })

  it("409 pour un changement refusé : déjà fait, rouvrir un constat ouvert ou résolu", async () => {
    const done = await patch(DONE, { action: "done" })
    expect(done.status).toBe(409)
    expect((await done.json()).code).toBe("transition_refused")
    expect((await patch(OPEN, { action: "reopen" })).status).toBe(409)
    expect((await patch(RESOLVED, { action: "reopen" })).status).toBe(409)
    expect((await patch(RESOLVED, { action: "ignore" })).status).toBe(409)
    expect(row(RESOLVED).status).toBe("resolved")
  })

  it("« Marquer comme fait » : date de mesure à 14 jours, mesures « avant », historique", async () => {
    const res = await patch(OPEN, { action: "done" })
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ ok: true, id: OPEN, status: "done" })
    const r = row(OPEN)
    expect(r.status).toBe("done")
    const doneAt = Date.parse(r.done_at as string)
    expect(Date.parse(r.verify_after as string) - doneAt).toBe(14 * 86_400_000)
    const v = readVerification(r.verification)
    expect(v?.after).toBeNull()
    expect(v?.before).toMatchObject({ to: "2026-10-06", impressions: 61, clicks: 0, position: 6.4 })
    expect((r.history as { event: string }[]).map((h) => h.event)).toEqual(["detected", "done"])
  })

  it("« Ignorer » puis « Rouvrir » : retour à faire, dates effacées", async () => {
    expect((await patch(OPEN, { action: "ignore" })).status).toBe(200)
    expect(row(OPEN)).toMatchObject({ status: "ignored" })
    expect(row(OPEN).ignored_at).toBeTruthy()
    expect((await patch(OPEN, { action: "reopen" })).status).toBe(200)
    expect(row(OPEN)).toMatchObject({ status: "open", ignored_at: null, done_at: null, verify_after: null, verification: null })
    expect((row(OPEN).history as { event: string }[]).map((h) => h.event)).toEqual(["detected", "ignored", "reopened"])
  })

  it("409 pour rouvrir une action reprise du journal des modifications", async () => {
    const res = await patch(IMPORT, { action: "reopen" })
    expect(res.status).toBe(409)
    expect((await res.json()).error).toMatch(/journal des modifications/)
    expect(row(IMPORT)).toMatchObject({ status: "done", verify_after: null })
  })

  it("« Fait » sans Search Console : la mesure « avant » attend la tâche", async () => {
    client = withGsc(fake, { lastDay: null })
    expect((await patch(OPEN, { action: "done" })).status).toBe(200)
    expect(readVerification(row(OPEN).verification)?.before).toBeNull()
  })
})

describe("POST /api/admin/seo/findings/[id]/suggest", () => {
  const suggest = (id: string) => SUGGEST(new Request(`https://qonforme.fr/api/admin/seo/findings/${id}/suggest`, { method: "POST" }), params(id))
  const GOOD = {
    title: "Devis modèle gratuit : modèle de devis artisan prêt à remplir",
    description: "Téléchargez un modèle de devis gratuit pour artisan du bâtiment, avec les mentions obligatoires, à remplir en ligne et à envoyer en PDF.",
  }
  const gemini = (bodies: unknown[]) => {
    const calls: { url: string; init: RequestInit }[] = []
    vi.stubGlobal("fetch", async (url: string, init: RequestInit) => {
      calls.push({ url, init })
      const body = bodies[Math.min(calls.length - 1, bodies.length - 1)]
      return new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: JSON.stringify(body) }] } }] }), { status: 200 })
    })
    return calls
  }

  it("401 sans session admin", async () => {
    admin = false
    expect((await suggest(OPEN)).status).toBe(401)
  })

  it("503 sans clé Gemini, sans appel", async () => {
    vi.stubEnv("GEMINI_API_KEY", "")
    const calls = gemini([GOOD])
    const res = await suggest(OPEN)
    expect(res.status).toBe(503)
    expect((await res.json()).code).toBe("not_configured")
    expect(calls).toHaveLength(0)
  })

  it("422 pour un constat qui ne porte pas sur le title ni la description", async () => {
    vi.stubEnv("GEMINI_API_KEY", "cle-de-test")
    gemini([GOOD])
    expect((await suggest(H1)).status).toBe(422)
  })

  it("enregistre une proposition contrôlée ; la consigne ne contient ni concurrent ni clé", async () => {
    vi.stubEnv("GEMINI_API_KEY", "cle-de-test")
    client = withGsc(fake, {
      lastDay: "2026-10-06",
      queries: [
        { query: "devis modele", page: "/modele", clicks: 0, impressions: 45, avg_position: 2.7 },
        { query: "tolteck devis gratuit", page: "/modele", clicks: 0, impressions: 9, avg_position: 8 },
      ],
    })
    const calls = gemini([GOOD])
    const res = await suggest(OPEN)
    expect(res.status).toBe(200)
    expect(calls).toHaveLength(1)
    expect(calls[0].url).toBe("https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent")
    expect((calls[0].init.headers as Record<string, string>)["x-goog-api-key"]).toBe("cle-de-test")
    const sent = String(calls[0].init.body)
    expect(sent).toContain("devis modele")
    expect(sent).toContain("Modèle de devis et de facture gratuit, prêt à remplir")
    expect(sent).not.toMatch(/tolteck|constructor|mediabat|inprocess/i)
    expect(sent).not.toContain("cle-de-test")

    const stored = parseStoredSuggestion(row(OPEN).suggestion as string)
    expect(stored).toMatchObject({ title: GOOD.title, description: GOOD.description, model: "gemini-2.5-flash" })
    expect((row(OPEN).history as { event: string }[]).at(-1)?.event).toBe("suggested")
  })

  it("garde l'historique écrit pendant l'appel à Gemini (constat résolu entre-temps)", async () => {
    vi.stubEnv("GEMINI_API_KEY", "cle-de-test")
    vi.stubGlobal("fetch", async () => {
      // La tâche des constats résout le constat pendant la rédaction.
      const r = row(OPEN)
      r.status = "resolved"
      r.resolved_at = "2026-10-09T09:00:00Z"
      r.history = [...(r.history as unknown[]), { at: "2026-10-09T09:00:00Z", event: "resolved" }]
      return new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: JSON.stringify(GOOD) }] } }] }), { status: 200 })
    })
    const res = await suggest(OPEN)
    expect(res.status).toBe(200)
    expect(row(OPEN).status).toBe("resolved")
    expect((row(OPEN).history as { event: string }[]).map((h) => h.event)).toEqual(["detected", "resolved", "suggested"])
    expect(parseStoredSuggestion(row(OPEN).suggestion as string)?.title).toBe(GOOD.title)
  })

  it("422 si la proposition reste hors des règles après le second essai (concurrent cité, title trop long)", async () => {
    vi.stubEnv("GEMINI_API_KEY", "cle-de-test")
    const calls = gemini([
      { ...GOOD, title: "Modèle de devis gratuit, mieux que Tolteck" },
      { ...GOOD, title: "x".repeat(80) },
    ])
    const res = await suggest(OPEN)
    expect(res.status).toBe(422)
    expect(calls).toHaveLength(2)
    // Le second essai reçoit la raison du refus.
    expect(String(calls[0].init.body)).not.toContain("Ta proposition précédente a été refusée")
    expect(String(calls[1].init.body)).toContain("Ta proposition précédente a été refusée")
    expect(String(calls[1].init.body)).toContain("Le texte cite un autre logiciel ou une autre entreprise.")
    expect(row(OPEN).suggestion).toBeNull()
  })
})

describe("contrôle d'une proposition", () => {
  const ok = {
    title: "Modèle de devis artisan gratuit, prêt à remplir",
    description: "Créez un devis d'artisan aux mentions obligatoires en quelques minutes : TVA par ligne, PDF prêt à envoyer à vos clients, sans carte bancaire.",
  }

  it("accepte un texte aux bonnes longueurs, au vouvoiement, sans affirmation interdite", () => {
    expect(checkSuggestion(ok, ["tolteck.com"])).toEqual([])
  })

  it("refuse les longueurs hors bornes, le tutoiement, les affirmations interdites et les concurrents", () => {
    expect(checkSuggestion({ ...ok, title: "x".repeat(71) }, [])[0]).toMatch(/71 caractères/)
    expect(checkSuggestion({ ...ok, description: "Trop courte." }, [])[0]).toMatch(/120 à 155/)
    expect(checkSuggestion({ ...ok, title: "Ton modèle de devis gratuit" }, []).join(" ")).toMatch(/tutoie/)
    expect(checkSuggestion({ ...ok, title: "Logiciel de devis certifié" }, []).length).toBeGreaterThan(0)
    expect(checkSuggestion({ ...ok, title: "Devis plus simple que Tolteck" }, ["tolteck.com"]).join(" ")).toMatch(/autre logiciel/)
  })
})
