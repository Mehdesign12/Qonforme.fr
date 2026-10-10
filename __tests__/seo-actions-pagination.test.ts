/**
 * Lectures complètes des constats sous le plafond de PostgREST (1 000 lignes
 * par réponse) : constats existants filtrés par la base et lus en entier,
 * liste de l'écran sans troncature, actions à vérifier au-delà des 200
 * premières, requêtes fusionnées par page.
 */
import { describe, expect, it } from "vitest"
import { fakeOnboardingDb, type FakeOnboardingDb } from "./helpers/fake-onboarding-db"
import { loadExistingFindings } from "@/lib/seo/actions/sync"
import { listFindings } from "@/lib/seo/actions/data"
import { readAllRows } from "@/lib/seo/actions/paginate"
import { readQueriesByPage } from "@/lib/seo/actions/gsc"
import { verifyDueFindings } from "@/lib/seo/actions/verify"
import { readVerification } from "@/lib/seo/actions/verdict"
import { SeoDbError, type SeoDb } from "@/lib/seo/db"

type Row = Record<string, unknown>
type Thenable = { then: (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) => Promise<unknown> }

/** Client simulé qui, comme PostgREST, ne rend jamais plus de `max` lignes par réponse. */
function capped(fake: FakeOnboardingDb, max = 1000, rpc?: (fn: string, args: Record<string, string>) => unknown): SeoDb {
  const from = (table: string) => {
    const api = fake.client.from(table) as Thenable
    const then = api.then
    api.then = (resolve, reject) =>
      then((v) => {
        const r = v as { data: unknown }
        return resolve(Array.isArray(r.data) ? { ...r, data: r.data.slice(0, max) } : r)
      }, reject)
    return api
  }
  return { ...fake.client, from, rpc } as unknown as SeoDb
}

const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`
const finding = (n: number, status: string, extra: Row = {}): Row => ({
  id: id(n),
  rule: "crawl-title",
  path: `/page-${n}`,
  status,
  done_at: null,
  ignored_at: null,
  detected_at: "2026-10-01T08:00:00Z",
  metrics: {},
  history: [],
  ...extra,
})

describe("constats existants (tâche des constats)", () => {
  const now = new Date("2026-10-09T08:00:00Z")

  it("lit tous les constats ouverts au-delà de 1 000 et seulement les faits ou ignorés des 30 derniers jours", async () => {
    const rows: Row[] = []
    for (let i = 0; i < 1205; i++) rows.push(finding(i, "open"))
    rows.push(finding(5000, "done", { done_at: "2026-08-20T08:00:00Z" })) // 50 jours : jamais lu
    rows.push(finding(5001, "done", { done_at: "2026-09-29T08:00:00Z" }))
    rows.push(finding(5002, "ignored", { ignored_at: "2026-10-04T08:00:00Z" }))
    rows.push(finding(5003, "ignored", { ignored_at: "2026-09-01T08:00:00Z" })) // 38 jours : jamais lu
    rows.push(finding(5004, "resolved"))
    const fake = fakeOnboardingDb({ seo_findings: rows })

    const existing = await loadExistingFindings(capped(fake), now)
    expect(existing.filter((f) => f.status === "open")).toHaveLength(1205)
    expect(existing.filter((f) => f.status !== "open").map((f) => f.id).sort()).toEqual([id(5001), id(5002)])
  })

  it("liste de l'écran : tous les constats, sans troncature, ni les résolus", async () => {
    const rows: Row[] = []
    for (let i = 0; i < 2350; i++) rows.push(finding(i, i % 3 === 0 ? "done" : i % 3 === 1 ? "ignored" : "open"))
    rows.push(finding(9999, "resolved"))
    const fake = fakeOnboardingDb({ seo_findings: rows })
    const list = await listFindings(capped(fake))
    expect(list).toHaveLength(2350)
    expect(new Set(list.map((f) => f.id)).size).toBe(2350)
  })

  it("au-delà du plafond de sécurité, la lecture échoue au lieu de rendre une liste tronquée", async () => {
    const rows = Array.from({ length: 30 }, (_, i) => ({ n: i }))
    const page = (from: number, to: number) => Promise.resolve({ data: rows.slice(from, to + 1), error: null })
    await expect(readAllRows(page, "les lignes", { pageSize: 10, maxRows: 20 })).rejects.toBeInstanceOf(SeoDbError)
    expect(await readAllRows(page, "les lignes", { pageSize: 10, maxRows: 40 })).toHaveLength(30)
  })
})

describe("actions à vérifier", () => {
  it("mesure une action échue même derrière plus de 200 actions déjà mesurées", async () => {
    const measured = { before: { from: "2026-08-01", to: "2026-08-14", clicks: 1, impressions: 10, ctr: 0.1, position: 5 }, after: { from: "2026-08-15", to: "2026-08-28", clicks: 1, impressions: 10, ctr: 0.1, position: 5 }, verdict: "stable" }
    const rows: Row[] = []
    for (let i = 0; i < 250; i++) {
      rows.push(finding(i, "done", { path: "/deja", done_at: "2026-08-15T10:00:00Z", verify_after: "2026-08-29T10:00:00Z", verification: measured }))
    }
    rows.push(finding(900, "done", { path: "/modele", done_at: "2026-09-20T10:00:00Z", verify_after: "2026-10-04T10:00:00Z", verification: { before: null, after: null, verdict: null } }))
    const fake = fakeOnboardingDb({ seo_findings: rows })
    const rpc = (fn: string) => {
      const data = fn === "seo_gsc_by_page" ? [{ page: "/modele", clicks: 2, impressions: 50, avg_position: 6 }] : []
      return Object.assign(Promise.resolve({ data, error: null }), { range: (a: number, b: number) => Promise.resolve({ data: data.slice(a, b + 1), error: null }) })
    }
    const verified = await verifyDueFindings(capped(fake, 1000, rpc), { now: new Date("2026-10-09T10:00:00Z"), lastDataDay: "2026-10-06" })
    expect(verified).toBe(1)
    expect(readVerification(fake.tables.seo_findings.find((f) => f.id === id(900))?.verification)?.after).toMatchObject({ impressions: 50 })
  })
})

describe("requêtes par page", () => {
  it("fusionne une même requête vue sur deux adresses d'une même page", async () => {
    const data = [
      { query: "devis modele", page: "/modele", clicks: 1, impressions: 30, avg_position: 3 },
      { query: "devis modele", page: "https://qonforme.fr/modele/", clicks: 0, impressions: 10, avg_position: 7 },
      { query: "modele facture", page: "/modele", clicks: 0, impressions: 12, avg_position: 9 },
    ]
    const rpc = () => Object.assign(Promise.resolve({ data, error: null }), { range: (a: number, b: number) => Promise.resolve({ data: data.slice(a, b + 1), error: null }) })
    const out = await readQueriesByPage({ rpc } as unknown as SeoDb, "2026-09-09", "2026-10-06")
    expect(out["/modele"]).toEqual([
      { query: "devis modele", clicks: 1, impressions: 40, position: 4 },
      { query: "modele facture", clicks: 0, impressions: 12, position: 9 },
    ])
  })
})
