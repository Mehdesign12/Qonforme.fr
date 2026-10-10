/**
 * Vérification à 14 jours d'une action faite : fenêtres avant/après, verdict,
 * mesure par la tâche dès que Search Console couvre les 14 jours suivants.
 */
import { describe, expect, it } from "vitest"
import { fakeOnboardingDb, type FakeOnboardingDb } from "./helpers/fake-onboarding-db"
import { afterWindow, beforeWindow, readVerification, verdictOf, verifyAfterOf } from "@/lib/seo/actions/verdict"
import { verifyDueFindings } from "@/lib/seo/actions/verify"
import type { SeoDb } from "@/lib/seo/db"

type PageRow = { page: string; clicks: number; impressions: number; avg_position: number | null }

/** Client simulé avec les fonctions SQL seo_gsc_* (bornes, pages par période). */
function withGsc(fake: FakeOnboardingDb, opts: { lastDay: string | null; pages: (from: string, to: string) => PageRow[] }): SeoDb {
  const rpc = (fn: string, args: Record<string, string>) => {
    let data: unknown[] = []
    if (fn === "seo_gsc_bounds") data = [{ first_date: opts.lastDay ? "2026-01-01" : null, last_date: opts.lastDay }]
    if (fn === "seo_gsc_by_page") data = opts.pages(args.p_from, args.p_to)
    const result = { data, error: null }
    return Object.assign(Promise.resolve(result), {
      range: (a: number, b: number) => Promise.resolve({ data: data.slice(a, b + 1), error: null }),
    })
  }
  return { ...fake.client, rpc } as unknown as SeoDb
}

describe("fenêtres de mesure", () => {
  it("avant : 14 jours connus avant l'action ; après : les 14 jours suivants", () => {
    expect(beforeWindow("2026-10-09T10:00:00Z", "2026-10-06")).toEqual({ from: "2026-09-23", to: "2026-10-06" })
    expect(beforeWindow("2026-10-09T10:00:00Z", "2026-10-20")).toEqual({ from: "2026-09-25", to: "2026-10-08" })
    expect(afterWindow("2026-10-09T10:00:00Z")).toEqual({ from: "2026-10-10", to: "2026-10-23" })
    // Jour de Paris : 23:30 UTC le 9 est déjà le 10 à Paris.
    expect(afterWindow("2026-10-09T23:30:00Z").from).toBe("2026-10-11")
    expect(verifyAfterOf(new Date("2026-10-09T10:00:00Z"))).toBe("2026-10-23T10:00:00.000Z")
  })
})

describe("verdict", () => {
  const m = (clicks: number, impressions: number, position: number | null) => ({ clicks, impressions, position })

  it("mieux : plus de clics, ou des places gagnées", () => {
    expect(verdictOf(m(0, 122, 6.2), m(3, 140, 5.1))).toBe("mieux")
    expect(verdictOf(m(0, 18, 14.3), m(0, 18, 9.8))).toBe("mieux")
    expect(verdictOf(m(0, 10, 20), m(0, 30, 20))).toBe("mieux") // impressions +20 (×3)
  })

  it("moins bien : moins de clics, des places perdues ou des impressions en chute", () => {
    expect(verdictOf(m(4, 50, 5), m(1, 50, 5))).toBe("moins bien")
    expect(verdictOf(m(0, 50, 5), m(0, 50, 8))).toBe("moins bien")
    expect(verdictOf(m(0, 50, 5), m(0, 20, 5))).toBe("moins bien")
  })

  it("stable : écarts faibles ou qui se compensent", () => {
    expect(verdictOf(m(0, 10, 6.2), m(0, 12, 6.6))).toBe("stable")
    expect(verdictOf(m(2, 50, 5), m(3, 50, 7))).toBe("stable") // un clic de plus, deux places de moins
    expect(verdictOf(m(0, 0, null), m(0, 0, null))).toBe("stable")
  })

  it("lit une vérification enregistrée sans planter sur une valeur vide", () => {
    expect(readVerification(null)).toBeNull()
    expect(readVerification({ before: null })).toEqual({ before: null, after: null, verdict: null, measuredAt: undefined })
  })
})

describe("mesure par la tâche", () => {
  const before = { from: "2026-09-06", to: "2026-09-19", clicks: 0, impressions: 122, ctr: 0, position: 6.2 }
  const rows = () => [
    { id: "f-pret", path: "/modele", status: "done", done_at: "2026-09-20T10:00:00Z", verify_after: "2026-10-04T10:00:00Z", verification: { before, after: null, verdict: null }, history: [{ at: "2026-09-20T10:00:00Z", event: "done" }] },
    { id: "f-trop-tot", path: "/guide", status: "done", done_at: "2026-10-01T10:00:00Z", verify_after: "2026-10-15T10:00:00Z", verification: { before: null, after: null, verdict: null }, history: [] },
    { id: "f-attend-gsc", path: "/demo", status: "done", done_at: "2026-09-24T10:00:00Z", verify_after: "2026-10-08T10:00:00Z", verification: null, history: [] },
  ]

  it("mesure les actions dont les 14 jours suivants sont dans Search Console, et seulement elles", async () => {
    const fake = fakeOnboardingDb({ seo_findings: rows() })
    const db = withGsc(fake, {
      lastDay: "2026-10-06",
      pages: (from, to) => (from === "2026-09-21" && to === "2026-10-04" ? [{ page: "/modele", clicks: 3, impressions: 140, avg_position: 5.1 }] : []),
    })
    const verified = await verifyDueFindings(db, { now: new Date("2026-10-09T10:00:00Z"), lastDataDay: "2026-10-06" })
    expect(verified).toBe(1)

    const done = fake.tables.seo_findings.find((f) => f.id === "f-pret")
    const v = readVerification(done?.verification)
    expect(v?.verdict).toBe("mieux")
    expect(v?.before).toEqual(before)
    expect(v?.after).toMatchObject({ from: "2026-09-21", to: "2026-10-04", clicks: 3, impressions: 140, position: 5.1 })
    expect((done?.history as { event: string; note: string }[]).at(-1)).toMatchObject({ event: "verified" })
    expect((done?.history as { note: string }[]).at(-1)?.note).toMatch(/^Mieux : /)

    // Après le 6 oct. (décalage de Search Console) : /demo attend encore ; /guide n'est pas échu.
    expect(fake.tables.seo_findings.find((f) => f.id === "f-attend-gsc")?.verification).toBeNull()
    expect(readVerification(fake.tables.seo_findings.find((f) => f.id === "f-trop-tot")?.verification)?.after).toBeNull()
  })
})
