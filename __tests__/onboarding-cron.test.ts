/**
 * Cron GET /api/cron/onboarding avec une base simulée : seuls les comptes
 * inscrits à la création reçoivent la séquence (les comptes existants jamais),
 * aucun email ne part deux fois, l'email s'arrête dès que l'action est faite,
 * rappels « plus tard » à l'heure, rien sans la migration ni sur des faits
 * illisibles.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { NextRequest } from "next/server"
import { fakeOnboardingDb, type FakeOnboardingDb } from "./helpers/fake-onboarding-db"

let db: FakeOnboardingDb
const sent: { to: string; subject: string; headers?: Record<string, string>; html: string }[] = []
let failSend = false

vi.mock("@/lib/supabase/server", () => ({ createAdminClient: () => db.client, createClient: () => db.client }))
vi.mock("@/lib/email/resend", () => ({
  sendEmail: (o: (typeof sent)[number]) => {
    if (failSend) return Promise.reject(new Error("Resend indisponible"))
    sent.push(o)
    return Promise.resolve({ id: `email-${sent.length}` })
  },
}))

process.env.CRON_SECRET = "cron-secret"
process.env.EMAIL_UNSUBSCRIBE_SECRET = "secret-de-test-assez-long-pour-hmac"

import { GET } from "@/app/api/cron/onboarding/route"

const NEW = "aaaaaaaa-0000-4000-8000-000000000001" // inscrit après la migration
const OLD = "bbbbbbbb-0000-4000-8000-000000000002" // compte existant, jamais inscrit
const ENROLLED = "2026-10-05T08:00:00.000Z" // lundi 10 h à Paris

const call = () => GET(new NextRequest("https://qonforme.fr/api/cron/onboarding", { headers: { Authorization: "Bearer cron-secret" } }))
const at = (iso: string) => vi.setSystemTime(new Date(iso))

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] })
  sent.length = 0
  failSend = false
  db = fakeOnboardingDb({
    onboarding_journeys: [{ user_id: NEW, enrolled_at: ENROLLED }],
    onboarding_emails: [{ id: "w", user_id: NEW, step: "welcome", sent_at: ENROLLED }],
    onboarding_reminders: [],
    email_preferences: [],
    quotes: [],
    invoices: [],
    subscriptions: [],
    cron_logs: [],
  })
  db.users[NEW] = { email: "nouveau@example.com", user_metadata: { first_name: "Léa" } }
  db.users[OLD] = { email: "ancien@example.com", user_metadata: { first_name: "Marc" } }
})

afterEach(() => { vi.useRealTimers() })

describe("séquence", () => {
  it("J+1 au seul compte inscrit, jamais aux comptes existants", async () => {
    at("2026-10-06T08:30:00Z")
    const res = await call()
    expect(res.status).toBe(200)
    expect(sent.map((s) => s.to)).toEqual(["nouveau@example.com"])
    expect(sent[0].subject).toBe("Votre premier devis en quelques minutes")
    expect(sent[0].html).toContain("Bonjour Léa,")
    expect(sent[0].html).toContain("/desinscription?t=")
    expect(sent[0].headers?.["List-Unsubscribe-Post"]).toBe("List-Unsubscribe=One-Click")
    expect(db.tables.onboarding_emails.filter((r) => r.user_id === OLD)).toHaveLength(0)
  })

  it("jamais deux fois : un second passage n'envoie rien", async () => {
    at("2026-10-06T08:30:00Z")
    await call()
    at("2026-10-06T08:45:00Z")
    await call()
    at("2026-10-08T08:45:00Z")
    await call()
    expect(sent).toHaveLength(1)
    expect(db.tables.onboarding_emails.filter((r) => r.step === "first_quote")).toHaveLength(1)
  })

  it("s'arrête dès que l'action est faite : un devis créé, pas de relance à J+7", async () => {
    at("2026-10-06T08:30:00Z")
    await call()
    db.tables.quotes.push({ id: "q1", user_id: NEW, status: "draft", sent_at: null })
    at("2026-10-12T08:00:00Z")
    await call()
    expect(sent.map((s) => s.subject)).toEqual(["Votre premier devis en quelques minutes"])
  })

  it("sans devis, relance à J+7 avec l'accès au tableau de bord", async () => {
    at("2026-10-06T08:30:00Z")
    await call()
    at("2026-10-12T08:00:00Z")
    await call()
    expect(sent.map((s) => s.subject)).toEqual(["Votre premier devis en quelques minutes", "Un devis, quand vous voulez"])
    expect(sent[1].html).toContain("/dashboard")
  })

  it("devis envoyé puis facture en brouillon : du devis à la facture, puis Essentiel", async () => {
    db.tables.quotes.push({ id: "q1", user_id: NEW, status: "sent", sent_at: "2026-10-05T12:00:00Z" })
    at("2026-10-06T08:30:00Z")
    await call()
    db.tables.invoices.push({ id: "i1", user_id: NEW, status: "draft" })
    at("2026-10-07T08:30:00Z")
    await call()
    expect(sent.map((s) => s.subject)).toEqual([
      "Votre devis est parti : la suite, c'est la facture",
      "Avant votre première facture : ce que change Essentiel",
    ])
    expect(sent[1].html).toContain("12 €")
    expect(sent[1].html).toContain("30&nbsp;jours")
  })

  it("compte désinscrit : rien", async () => {
    db.tables.email_preferences.push({ user_id: NEW, onboarding_emails: false })
    at("2026-10-06T08:30:00Z")
    await call()
    expect(sent).toHaveLength(0)
  })

  it("lecture des devis en échec : aucun email (pas de « premier devis » sur une coupure réseau)", async () => {
    db.failing.add("quotes")
    at("2026-10-06T08:30:00Z")
    const body = await (await call()).json()
    expect(sent).toHaveLength(0)
    expect(body.results.sequence.errors.length).toBeGreaterThan(0)
  })

  it("email en échec : l'étape est libérée et repart au passage suivant", async () => {
    failSend = true
    at("2026-10-06T08:30:00Z")
    await call()
    expect(db.tables.onboarding_emails.filter((r) => r.step === "first_quote")).toHaveLength(0)
    failSend = false
    at("2026-10-06T08:45:00Z")
    await call()
    expect(sent).toHaveLength(1)
  })

  it("inscription de plus de 31 jours : plus lue", async () => {
    at("2026-11-10T09:00:00Z")
    await call()
    expect(sent).toHaveLength(0)
  })

  it("migration absente : réponse « inactive », rien n'est envoyé", async () => {
    db.missing.add("onboarding_reminders")
    at("2026-10-06T08:30:00Z")
    const body = await (await call()).json()
    expect(body).toEqual({ ok: true, mode: "inactive" })
    expect(sent).toHaveLength(0)
  })
})

describe("rappels « plus tard »", () => {
  beforeEach(() => {
    // Rappel d'un compte existant (l'écran de démarrage reste accessible à tous) ; pas de séquence ici
    db.tables.onboarding_journeys = []
    db.tables.onboarding_reminders.push({
      id: "r1", user_id: OLD, target: "quote", status: "pending",
      remind_at: "2026-10-06T17:00:00.000Z", created_at: "2026-10-06T10:00:00.000Z",
    })
  })

  it("part à l'heure (même hors des heures de la séquence), une seule fois", async () => {
    at("2026-10-06T16:50:00Z")
    await call()
    expect(sent).toHaveLength(0)
    at("2026-10-06T17:05:00Z") // 19 h 05 à Paris
    await call()
    at("2026-10-06T17:20:00Z")
    await call()
    expect(sent).toHaveLength(1)
    expect(sent[0].to).toBe("ancien@example.com")
    expect(sent[0].subject).toBe("Votre rappel : faire votre premier devis")
    expect(sent[0].html).toContain("/quotes/new")
    expect(sent[0].headers).toBeUndefined()
    expect(db.tables.onboarding_reminders[0].status).toBe("sent")
  })

  it("annulé : ne part pas", async () => {
    db.tables.onboarding_reminders[0].status = "cancelled"
    at("2026-10-06T17:05:00Z")
    await call()
    expect(sent).toHaveLength(0)
  })

  it("périmé (cron arrêté plus de 24 h) : pas envoyé", async () => {
    at("2026-10-08T08:00:00Z")
    await call()
    expect(sent.filter((s) => s.to === "ancien@example.com")).toHaveLength(0)
    expect(db.tables.onboarding_reminders[0].status).toBe("expired")
  })

  it("compte illisible (coupure réseau) : repasse en attente ; compte supprimé : abandonné", async () => {
    const original = db.client.auth.admin.getUserById
    db.client.auth.admin.getUserById = () => Promise.resolve({ data: null, error: { message: "fetch failed" } })
    at("2026-10-06T17:05:00Z")
    await call()
    expect(db.tables.onboarding_reminders[0].status).toBe("pending")
    db.client.auth.admin.getUserById = original
    delete db.users[OLD]
    await call()
    expect(db.tables.onboarding_reminders[0].status).toBe("expired")
    expect(sent).toHaveLength(0)
  })

  it("email en échec : repasse en attente", async () => {
    failSend = true
    at("2026-10-06T17:05:00Z")
    await call()
    expect(db.tables.onboarding_reminders[0].status).toBe("pending")
  })
})

describe("inscription dans la séquence (route d'inscription)", () => {
  it("seule la création d'un compte inscrit ; idempotente ; sans migration, rien et pas d'erreur", async () => {
    const { enrollInOnboarding } = await import("@/lib/onboarding/store")
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const admin = db.client as any
    expect(await enrollInOnboarding(admin, OLD)).toBe(true)
    expect(await enrollInOnboarding(admin, OLD)).toBe(true)
    expect(db.tables.onboarding_journeys.filter((r) => r.user_id === OLD)).toHaveLength(1)
    db.missing.add("onboarding_journeys")
    expect(await enrollInOnboarding(admin, "cccccccc-0000-4000-8000-000000000003")).toBe(false)
  })
})

it("refuse un appel sans le secret du cron", async () => {
  const res = await GET(new NextRequest("https://qonforme.fr/api/cron/onboarding"))
  expect(res.status).toBe(401)
})
