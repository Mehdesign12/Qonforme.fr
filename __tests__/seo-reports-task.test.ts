/**
 * Tâche « digest » et route d'aperçu du résumé hebdomadaire SEO, avec une
 * base simulée : échéance, un seul envoi par semaine ISO (ligne insérée avant
 * l'envoi), raison notée sans adresse ni clé, échec noté, aperçu réservé à
 * l'admin et limité à 3 par heure.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { NextRequest } from "next/server"
import { fakeSeoDb, type FakeSeoDb } from "./seo-reports-fake-db"

let db: FakeSeoDb
let admin = true
let failSend = false
const sent: { to: string; subject: string; html: string }[] = []

vi.mock("@/lib/supabase/server", () => ({ createAdminClient: () => db.client, createClient: () => db.client }))
vi.mock("@/lib/admin-require", () => ({ isAdminAuthenticated: () => Promise.resolve(admin) }))
vi.mock("@/lib/email/resend", () => ({
  sendEmail: (o: (typeof sent)[number]) => {
    // Le message simulé porte la clé : elle ne doit jamais être enregistrée ni renvoyée
    if (failSend) return Promise.reject(new Error(`Resend 401 : Bearer ${process.env.RESEND_API_KEY} refusée (clé ${process.env.RESEND_API_KEY})`))
    sent.push(o)
    return Promise.resolve({ id: `email-${sent.length}` })
  },
}))

import { digestTask } from "@/lib/seo/reports/task"
import { POST as previewPost } from "@/app/api/admin/seo/reports/preview/route"
import { lastWeeklyAttempt, readWeekAttempts, weekDigestState } from "@/lib/seo/reports/send"
import { lastAttemptView } from "@/lib/seo/reports/attempt-view"
import type { SeoDb } from "@/lib/seo/db"
import type { SeoJobRow, SeoTaskContext } from "@/lib/seo/cron"

const MONDAY_830 = new Date("2026-10-12T06:30:00Z") // lundi 12 oct. 2026, 8 h 30 à Paris
const asDb = () => db.client as unknown as SeoDb

const job = { name: "digest", status: "idle", cursor: {} } as unknown as SeoJobRow

function ctx(now: Date, trigger: "cron" | "manual" = "cron"): SeoTaskContext {
  return { db: asDb(), now, deadline: Date.now() + 60_000, trigger, job, saveCursor: async () => {} }
}

function reportsSettings(weeklyDigest = true) {
  return {
    key: "reports",
    updated_at: "2026-10-05T10:00:00Z",
    value: { weeklyDigest, weekday: 1, time: "08:00", sections: { kpis: true, pages: true, articles: true, geo: true } },
  }
}

beforeEach(() => {
  admin = true
  failSend = false
  sent.length = 0
  process.env.ADMIN_EMAIL = "admin@exemple.fr"
  process.env.RESEND_API_KEY = "re_test_cle_secrete_123456"
  db = fakeSeoDb({ seo_settings: [reportsSettings()], seo_digests: [], seo_findings: [], blog_posts: [], seo_geo_runs: [] })
  db.rpcs.seo_gsc_bounds = () => [{ first_date: "2026-08-01", last_date: "2026-10-09" }]
  db.rpcs.seo_gsc_totals = () => [{ clicks: 3, impressions: 120, avg_position: 12.5 }]
})

afterEach(() => {
  vi.useRealTimers()
})

describe("échéance de la tâche", () => {
  it("due le jour choisi après l'heure choisie, tant que la semaine n'a pas de résumé", async () => {
    expect(await digestTask.isDue({ db: asDb(), now: MONDAY_830, job: null })).toBe(true)
    expect(await digestTask.isDue({ db: asDb(), now: new Date("2026-10-12T05:30:00Z"), job: null })).toBe(false)
    expect(await digestTask.isDue({ db: asDb(), now: new Date("2026-10-13T06:30:00Z"), job: null })).toBe(false)
    db.tables.seo_digests.push({ period_key: "2026-W42", kind: "weekly", status: "sent" })
    expect(await digestTask.isDue({ db: asDb(), now: MONDAY_830, job: null })).toBe(false)
  })

  it("jamais quand le résumé est éteint ou que la migration manque", async () => {
    db.tables.seo_settings = [reportsSettings(false)]
    expect(await digestTask.isDue({ db: asDb(), now: MONDAY_830, job: null })).toBe(false)
    db.missing.add("seo_settings")
    expect(await digestTask.isDue({ db: asDb(), now: MONDAY_830, job: null })).toBe(false)
  })

  it("une lecture en échec n'est pas prise pour « rien à faire »", async () => {
    db.failing.add("seo_settings")
    await expect(digestTask.isDue({ db: asDb(), now: MONDAY_830, job: null })).rejects.toThrow()
  })
})

describe("envoi hebdomadaire", () => {
  it("envoie une fois par semaine ISO, la ligne posée avant l'envoi", async () => {
    const first = await digestTask.run(ctx(MONDAY_830))
    expect(first).toMatchObject({ status: "sent", periodKey: "2026-W42" })
    expect(sent).toHaveLength(1)
    expect(sent[0].to).toBe("admin@exemple.fr")
    expect(sent[0].subject).toMatch(/^SEO.: 3.clics du 3 au 9.oct\./)
    const row = db.tables.seo_digests[0]
    expect(row).toMatchObject({ period_key: "2026-W42", kind: "weekly", status: "sent" })
    expect(row.sent_at).toBeTruthy()

    const second = await digestTask.run(ctx(new Date("2026-10-12T06:45:00Z")))
    expect(second).toMatchObject({ status: "duplicate" })
    expect(sent).toHaveLength(1)
    expect(db.tables.seo_digests).toHaveLength(1)
  })

  it("sans adresse de l'administrateur : semaine notée « skipped » avec la raison, aucun email", async () => {
    delete process.env.ADMIN_EMAIL
    const out = await digestTask.run(ctx(MONDAY_830))
    expect(out).toMatchObject({ status: "skipped" })
    expect(sent).toHaveLength(0)
    expect(db.tables.seo_digests[0]).toMatchObject({ status: "skipped" })
    expect(String(db.tables.seo_digests[0].error)).toContain("ADMIN_EMAIL")
  })

  it("sans clé Resend : « skipped » avec la raison", async () => {
    delete process.env.RESEND_API_KEY
    const out = await digestTask.run(ctx(MONDAY_830))
    expect(out).toMatchObject({ status: "skipped" })
    expect(String(db.tables.seo_digests[0].error)).toContain("RESEND_API_KEY")
  })

  it("un envoi refusé est noté « failed », puis refait au passage suivant", async () => {
    failSend = true
    await expect(digestTask.run(ctx(MONDAY_830))).rejects.toThrow(/non envoyé/)
    expect(db.tables.seo_digests[0]).toMatchObject({ period_key: "2026-W42", status: "failed" })
    const error = String(db.tables.seo_digests[0].error)
    expect(error).not.toContain("re_test_cle_secrete_123456")
    expect(error).toContain("•••")
    failSend = false
    const nextPass = new Date("2026-10-12T06:45:00Z")
    expect(await digestTask.isDue({ db: asDb(), now: nextPass, job: null })).toBe(true)
    expect(await digestTask.run(ctx(nextPass))).toMatchObject({ status: "sent", periodKey: "2026-W42#2" })
    expect(sent).toHaveLength(1)
    expect(db.tables.seo_digests.map((r) => [r.period_key, r.status])).toEqual([
      ["2026-W42", "failed"],
      ["2026-W42#2", "sent"],
    ])
    expect(await digestTask.isDue({ db: asDb(), now: new Date("2026-10-12T07:00:00Z"), job: null })).toBe(false)
    expect(await digestTask.run(ctx(new Date("2026-10-12T07:00:00Z")))).toMatchObject({ status: "duplicate" })
    expect(sent).toHaveLength(1)
  })

  it("nouvel essai possible n'importe quel jour de la même semaine, 3 essais au plus", async () => {
    failSend = true
    await expect(digestTask.run(ctx(MONDAY_830))).rejects.toThrow()
    const wednesday = new Date("2026-10-14T10:00:00Z")
    expect(await digestTask.isDue({ db: asDb(), now: wednesday, job: null })).toBe(true)
    await expect(digestTask.run(ctx(wednesday))).rejects.toThrow()
    await expect(digestTask.run(ctx(new Date("2026-10-14T10:15:00Z"), "manual"))).rejects.toThrow()
    expect(db.tables.seo_digests.map((r) => r.period_key)).toEqual(["2026-W42", "2026-W42#2", "2026-W42#3"])
    failSend = false
    const later = new Date("2026-10-15T10:00:00Z")
    expect(await digestTask.isDue({ db: asDb(), now: later, job: null })).toBe(false)
    // Le rattrapage manuel ne dépasse pas 3 essais non plus
    expect(await digestTask.run(ctx(later, "manual"))).toMatchObject({ status: "duplicate" })
    expect(sent).toHaveLength(0)
    expect(db.tables.seo_digests).toHaveLength(3)
    // La semaine suivante repart de zéro
    expect(await digestTask.isDue({ db: asDb(), now: new Date("2026-10-19T06:30:00Z"), job: null })).toBe(true)
  })

  it("un envoi interrompu (« sending » depuis plus de 15 minutes) est refait, l'essai précédent noté en échec", async () => {
    db.tables.seo_digests.push({ period_key: "2026-W42", kind: "weekly", status: "sending", created_at: MONDAY_830.toISOString() })
    const tenMinutes = new Date("2026-10-12T06:40:00Z")
    expect(await digestTask.isDue({ db: asDb(), now: tenMinutes, job: null })).toBe(false)
    expect(await digestTask.run(ctx(tenMinutes, "manual"))).toMatchObject({ status: "duplicate" })
    expect(sent).toHaveLength(0)
    const sixteenMinutes = new Date("2026-10-12T06:46:00Z")
    expect(await digestTask.isDue({ db: asDb(), now: sixteenMinutes, job: null })).toBe(true)
    expect(await digestTask.run(ctx(sixteenMinutes))).toMatchObject({ status: "sent", periodKey: "2026-W42#2" })
    expect(db.tables.seo_digests[0]).toMatchObject({ status: "failed" })
    expect(String(db.tables.seo_digests[0].error)).toMatch(/interrompu/)
    expect(sent).toHaveLength(1)
  })

  it("page Rapports : dernier essai en échec avec le motif sans clé et le nouvel essai prévu", async () => {
    db.tables.seo_digests.push(
      { period_key: "2026-W41", kind: "weekly", status: "sent", created_at: "2026-10-05T06:30:00Z", sent_at: "2026-10-05T06:30:05Z" },
      // Ancienne ligne dont le motif contiendrait la clé : masquée à la lecture
      { period_key: "2026-W42", kind: "weekly", status: "failed", created_at: MONDAY_830.toISOString(), error: "Resend 401 : clé re_test_cle_secrete_123456 refusée" },
    )
    const now = new Date("2026-10-12T06:40:00Z")
    const attempts = await readWeekAttempts(asDb(), "2026-W42")
    const state = weekDigestState(attempts, now)
    expect(state.kind).toBe("retry")
    const last = await lastWeeklyAttempt(asDb())
    expect(last).toMatchObject({ periodKey: "2026-W42", attempt: 1, status: "failed" })
    expect(last?.error).not.toContain("re_test_cle_secrete_123456")
    const view = lastAttemptView(last, now, state.kind, 3, "2026-10-05T06:30:05Z")
    expect(view.tone).toBe("danger")
    expect(view.label).toMatch(/^En échec le 12 oct\. 2026.*\(essai 1 sur 3\)$/)
    expect(view.details.join(" ")).toMatch(/Motif : Resend 401 : clé ••• refusée/)
    expect(view.details.join(" ")).toMatch(/Nouvel essai au prochain passage \(essai 2 sur 3\)/)
    expect(view.details.join(" ")).toMatch(/Dernier résumé envoyé : 5 oct\. 2026/)
    expect(view.details.join(" ")).not.toContain("re_test_cle_secrete_123456")
  })

  it("page Rapports : envoyé, interrompu, essais épuisés", () => {
    const now = new Date("2026-10-12T08:00:00Z")
    const base = { periodKey: "2026-W42", attempt: 1, createdAt: "2026-10-12T06:30:00Z", sentAt: null, error: null }
    expect(lastAttemptView({ ...base, status: "sent", sentAt: "2026-10-12T06:30:05Z" }, now, "done", 3, null)).toMatchObject({
      tone: "neutral",
      label: expect.stringMatching(/^Envoyé le 12 oct\. 2026/),
    })
    expect(lastAttemptView({ ...base, status: "sending" }, now, "retry", 3, null).label).toMatch(/^Interrompu le/)
    expect(lastAttemptView({ ...base, status: "sending" }, new Date("2026-10-12T06:35:00Z"), "wait", 3, null).label).toMatch(/^Envoi en cours/)
    const exhausted = lastAttemptView({ ...base, periodKey: "2026-W42#3", attempt: 3, status: "failed", error: "Resend 500" }, now, "done", 3, null)
    expect(exhausted.details.join(" ")).toMatch(/3 essais en échec cette semaine/)
    expect(lastAttemptView(null, now, "none", 3, null)).toEqual({ label: "—", tone: "neutral", details: [] })
  })

  it("le cron ne part pas si le résumé a été éteint entre-temps ; un lancement manuel, si", async () => {
    db.tables.seo_settings = [reportsSettings(false)]
    expect(await digestTask.run(ctx(MONDAY_830, "cron"))).toEqual({ status: "disabled" })
    expect(sent).toHaveLength(0)
    expect(await digestTask.run(ctx(MONDAY_830, "manual"))).toMatchObject({ status: "sent" })
  })
})

describe("POST /api/admin/seo/reports/preview", () => {
  const call = (body: unknown = {}) =>
    previewPost(
      new NextRequest("https://qonforme.fr/api/admin/seo/reports/preview", {
        method: "POST",
        body: JSON.stringify(body),
        headers: { "Content-Type": "application/json" },
      }),
    )

  it("401 hors de l'admin", async () => {
    admin = false
    expect((await call()).status).toBe(401)
    expect(sent).toHaveLength(0)
  })

  it("400 pour un contenu invalide", async () => {
    expect((await call({ sections: { kpis: "oui" } })).status).toBe(400)
  })

  it("409 sans adresse de l'administrateur", async () => {
    delete process.env.ADMIN_EMAIL
    const res = await call()
    expect(res.status).toBe(409)
    expect((await res.json()).error).toContain("ADMIN_EMAIL")
  })

  it("envoie l'aperçu avec les sections demandées, 3 fois par heure au plus", async () => {
    vi.useFakeTimers({ toFake: ["Date"] })
    vi.setSystemTime(MONDAY_830)
    const sections = { kpis: false, pages: true, articles: false, geo: false }
    for (let i = 0; i < 3; i++) {
      const res = await call({ sections })
      expect(res.status).toBe(200)
    }
    expect(sent).toHaveLength(3)
    expect(sent[0].subject).toMatch(/^Aperçu · SEO/)
    expect(sent[0].html).not.toContain(">Indicateurs<")
    expect(db.tables.seo_digests.filter((r) => r.kind === "preview" && r.status === "sent")).toHaveLength(3)

    const limited = await call({ sections })
    expect(limited.status).toBe(429)
    expect((await limited.json()).error).toMatch(/3 aperçus par heure/)
    expect(sent).toHaveLength(3)

    vi.setSystemTime(new Date(MONDAY_830.getTime() + 61 * 60_000))
    expect((await call({ sections })).status).toBe(200)
  })

  it("demandes simultanées : jamais plus de 3 aperçus dans l'heure", async () => {
    vi.useFakeTimers({ toFake: ["Date"] })
    vi.setSystemTime(MONDAY_830)
    const sections = { kpis: false, pages: true, articles: false, geo: false }
    const responses = await Promise.all(Array.from({ length: 6 }, () => call({ sections })))
    const statuses = responses.map((r) => r.status)
    expect(sent.length).toBeLessThanOrEqual(3)
    expect(statuses.filter((st) => st === 200)).toHaveLength(sent.length)
    expect(statuses.every((st) => st === 200 || st === 429)).toBe(true)
    const rows = db.tables.seo_digests.filter((r) => r.kind === "preview")
    expect(rows).toHaveLength(6)
    expect(rows.filter((r) => r.status === "sent")).toHaveLength(sent.length)
    expect(rows.filter((r) => r.status === "skipped")).toHaveLength(6 - sent.length)
    // Les demandes refusées ne comptent pas : il reste exactement 3 - envoyés places
    const more = await Promise.all(Array.from({ length: 3 - sent.length }, () => call({ sections })))
    expect(more.every((r) => r.status === 200)).toBe(true)
    expect(sent).toHaveLength(3)
    expect((await call({ sections })).status).toBe(429)
    expect(sent).toHaveLength(3)
  })

  it("400 sans aucune section cochée, rien n'est noté ni envoyé", async () => {
    const res = await call({ sections: { kpis: false, pages: false, articles: false, geo: false } })
    expect(res.status).toBe(400)
    expect((await res.json()).error).toMatch(/au moins une section/)
    expect(db.tables.seo_digests).toHaveLength(0)
    expect(sent).toHaveLength(0)
  })

  it("502 si Resend refuse l'aperçu : noté « failed », sans la clé", async () => {
    failSend = true
    const res = await call({ sections: { kpis: true, pages: true, articles: true, geo: true } })
    expect(res.status).toBe(502)
    const text = await res.text()
    expect(text).not.toContain("re_test_cle_secrete_123456")
    const row = db.tables.seo_digests.find((r) => r.kind === "preview")
    expect(row).toMatchObject({ status: "failed" })
    expect(String(row?.error)).not.toContain("re_test_cle_secrete_123456")
    expect(String(row?.error)).toContain("Bearer •••")
  })

  it("503 si la base n'est pas à jour", async () => {
    db.missing.add("seo_digests")
    const res = await call({ sections: { kpis: true, pages: true, articles: true, geo: true } })
    expect(res.status).toBe(503)
    expect(sent).toHaveLength(0)
  })
})
