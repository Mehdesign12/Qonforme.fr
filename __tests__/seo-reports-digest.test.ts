/**
 * Construction et rendu du résumé hebdomadaire SEO à partir d'une base
 * simulée : vrais chiffres seulement, « — » ou phrase quand ils manquent,
 * sections décochées non lues, lecture en échec signalée, jamais de
 * concurrent dans l'email.
 */
import { beforeEach, describe, expect, it, vi } from "vitest"
import { fakeSeoDb, type FakeSeoDb } from "./seo-reports-fake-db"

let db: FakeSeoDb
vi.mock("@/lib/supabase/server", () => ({ createAdminClient: () => db.client, createClient: () => db.client }))

import { buildDigest, digestWeek, parisDayStart } from "@/lib/seo/reports/digest"
import { dayRange, digestSubject, renderSeoDigest } from "@/lib/email/templates/seo-digest"
import { ALL_DIGEST_SECTIONS } from "@/lib/seo/reports/types"
import type { SeoDb } from "@/lib/seo/db"

const NBSP = " "
const NOW = new Date("2026-10-12T06:30:00Z") // lundi 12 oct. 2026, 8 h 30 à Paris
const BASE = "https://qonforme.fr"
const asDb = () => db.client as unknown as SeoDb

const GEO_SUMMARY = {
  questions: 8,
  engines: {
    gemini: { mention_rate: 0, citation_rate: 0 },
    chatgpt: { mention_rate: 0.1, citation_rate: 0 },
  },
  overall: { mention_rate: 0.05, citation_rate: 0 },
  domains: { "qonforme.fr": { mention_rate: null, citation_rate: 0 }, "tolteck.com": { mention_rate: null, citation_rate: 0.06 } },
}

function withData() {
  db = fakeSeoDb({
    seo_settings: [],
    seo_findings: [
      { id: "f1", status: "open", severity: "low", title: "Page à renforcer", path: "/guide", explanation: "3 impressions", detected_at: "2026-10-08T10:00:00Z" },
      { id: "f2", status: "open", severity: "high", title: "Page bien classée sans clic", path: "/modele", explanation: "122 impressions, 0 clic", detected_at: "2026-10-01T10:00:00Z" },
      { id: "f3", status: "open", severity: "medium", title: "Page en baisse", path: "/facturation/fleuriste", explanation: null, detected_at: "2026-10-05T10:00:00Z" },
      { id: "f4", status: "open", severity: "medium", title: "Accueil sous la première page", path: "/", explanation: null, detected_at: "2026-10-07T10:00:00Z" },
      { id: "f5", status: "done", severity: "high", title: "Faite", path: "/demo", explanation: null, detected_at: "2026-10-09T10:00:00Z" },
    ],
    blog_posts: [
      { title: "Article de la semaine", slug: "article-semaine", is_published: true, published_at: "2026-10-07T19:19:00Z" },
      { title: "Article ancien", slug: "ancien", is_published: true, published_at: "2026-09-20T08:00:00Z" },
      { title: "Brouillon", slug: "brouillon", is_published: false, published_at: null },
    ],
    seo_geo_runs: [
      { kind: "import", status: "done", created_at: "2026-09-28T12:00:00Z", finished_at: "2026-09-28T12:00:00Z", summary: GEO_SUMMARY },
      { kind: "monthly", status: "running", created_at: "2026-10-01T12:00:00Z", finished_at: null, summary: null },
    ],
  })
  db.rpcs.seo_gsc_bounds = () => [{ first_date: "2026-08-01", last_date: "2026-10-09" }]
  db.rpcs.seo_gsc_totals = (args) =>
    args.p_from === "2026-10-03"
      ? [{ clicks: 1, impressions: 238, avg_position: 17.64 }]
      : [{ clicks: 1, impressions: 118, avg_position: 19.9 }]
}

beforeEach(() => withData())

describe("buildDigest", () => {
  it("lit les 7 derniers jours de Search Console et les compare aux 7 précédents", async () => {
    const digest = await buildDigest(asDb(), NOW, ALL_DIGEST_SECTIONS)
    expect(digest.kpis?.range).toEqual({ from: "2026-10-03", to: "2026-10-09" })
    expect(digest.kpis?.current).toEqual({ clicks: 1, impressions: 238, ctr: 1 / 238, position: 17.64 })
    expect(digest.kpis?.previous?.impressions).toBe(118)
    const totals = db.ops.filter((o) => o.kind === "rpc" && o.table === "seo_gsc_totals").map((o) => o.values)
    expect(totals).toContainEqual({ p_from: "2026-09-26", p_to: "2026-10-02", p_device: null, p_country: null })
  })

  it("prend les 3 constats ouverts les plus graves et compte les autres", async () => {
    const digest = await buildDigest(asDb(), NOW, ALL_DIGEST_SECTIONS)
    expect(digest.findings?.top.map((f) => f.id)).toEqual(["f2", "f4", "f3"])
    expect(digest.findings?.openCount).toBe(4)
  })

  it("ne garde que les articles publiés des 7 derniers jours et le dernier relevé terminé", async () => {
    const digest = await buildDigest(asDb(), NOW, ALL_DIGEST_SECTIONS)
    expect(digest.articles?.map((a) => a.slug)).toEqual(["article-semaine"])
    expect(digest.geo).toMatchObject({ imported: true, mentionRate: 0.05, citationRate: 0, at: "2026-09-28T12:00:00Z" })
    expect(digest.geo?.engines.map((e) => e.key)).toEqual(["gemini", "chatgpt"])
    expect(digest.week).toEqual({ from: "2026-10-05", to: "2026-10-11" })
  })

  it("semaine du résumé : les 7 jours de Paris entiers avant l'envoi, articles du premier jour compris", async () => {
    db.tables.blog_posts = [
      { title: "Veille, 23 h 30 à Paris", slug: "veille", is_published: true, published_at: "2026-10-04T21:30:00Z" },
      { title: "Premier jour, 0 h 30 à Paris", slug: "minuit", is_published: true, published_at: "2026-10-04T22:30:00Z" },
      { title: "Premier jour avant l'heure d'envoi", slug: "lundi-matin", is_published: true, published_at: "2026-10-05T05:00:00Z" },
      { title: "Dernier jour, 23 h 50 à Paris", slug: "dimanche-soir", is_published: true, published_at: "2026-10-11T21:50:00Z" },
      { title: "Jour de l'envoi", slug: "aujourdhui", is_published: true, published_at: "2026-10-12T05:00:00Z" },
    ]
    const digest = await buildDigest(asDb(), NOW, ALL_DIGEST_SECTIONS)
    expect(digest.week).toEqual({ from: "2026-10-05", to: "2026-10-11" })
    expect(digest.articles?.map((a) => a.slug)).toEqual(["dimanche-soir", "lundi-matin", "minuit"])
    // La semaine suivante reprend exactement où celle-ci s'arrête
    expect(digestWeek(new Date("2026-10-19T06:30:00Z"))).toEqual({ from: "2026-10-12", to: "2026-10-18" })
  })

  it("minuit à Paris, heure d'été comme d'hiver", () => {
    expect(parisDayStart("2026-10-05").toISOString()).toBe("2026-10-04T22:00:00.000Z")
    expect(parisDayStart("2026-12-01").toISOString()).toBe("2026-11-30T23:00:00.000Z")
    expect(parisDayStart("2026-10-25").toISOString()).toBe("2026-10-24T22:00:00.000Z")
    expect(parisDayStart("2026-10-26").toISOString()).toBe("2026-10-25T23:00:00.000Z")
    expect(parisDayStart("2026-03-29").toISOString()).toBe("2026-03-28T23:00:00.000Z")
    expect(parisDayStart("2026-03-30").toISOString()).toBe("2026-03-29T22:00:00.000Z")
  })

  it("un constat grave ancien passe devant des centaines de constats récents moins graves", async () => {
    const many = Array.from({ length: 600 }, (_, i) => ({
      id: `low-${i}`,
      status: "open",
      severity: "low",
      title: `Constat ${i}`,
      path: `/page-${i}`,
      explanation: null,
      detected_at: new Date(Date.parse("2026-10-09T00:00:00Z") + i * 60_000).toISOString(),
    }))
    db.tables.seo_findings = many.concat([
      { id: "old-high", status: "open", severity: "high", title: "Grave et ancien", path: "/", explanation: null, detected_at: "2026-01-01T00:00:00Z" },
      { id: "old-medium", status: "open", severity: "medium", title: "Moyen et ancien", path: "/guide", explanation: null, detected_at: "2026-01-02T00:00:00Z" },
    ])
    const digest = await buildDigest(asDb(), NOW, ALL_DIGEST_SECTIONS)
    expect(digest.findings?.top.map((f) => f.id)).toEqual(["old-high", "old-medium", "low-599"])
    expect(digest.findings?.openCount).toBe(602)
  })

  it("base plus courte que 7 jours : plage réduite aux jours enregistrés, données partielles annoncées", async () => {
    db.rpcs.seo_gsc_bounds = () => [{ first_date: "2026-10-07", last_date: "2026-10-09" }]
    const digest = await buildDigest(asDb(), NOW, ALL_DIGEST_SECTIONS)
    expect(digest.kpis?.range).toEqual({ from: "2026-10-07", to: "2026-10-09" })
    expect(digest.kpis?.partial).toBe(true)
    expect(digest.kpis?.previous).toBeNull()
    const totals = db.ops.filter((o) => o.kind === "rpc" && o.table === "seo_gsc_totals").map((o) => o.values)
    expect(totals).toEqual([{ p_from: "2026-10-07", p_to: "2026-10-09", p_device: null, p_country: null }])
    const { html, subject } = renderSeoDigest(digest, { baseUrl: BASE })
    expect(html).toContain("Données partielles")
    expect(html).toContain(`Du 7${NBSP}oct. au 9${NBSP}oct.${NBSP}2026`)
    expect(subject).toContain(`du 7 au 9${NBSP}oct.`)
  })

  it("ne lit pas les sections décochées", async () => {
    const digest = await buildDigest(asDb(), NOW, { kpis: false, pages: true, articles: false, geo: false })
    expect(digest.kpis).toBeUndefined()
    expect(digest.articles).toBeUndefined()
    expect(digest.geo).toBeUndefined()
    expect(db.ops.some((o) => o.kind === "rpc")).toBe(false)
    expect(db.ops.some((o) => o.table === "blog_posts" || o.table === "seo_geo_runs")).toBe(false)
  })

  it("lit les sections des réglages quand aucune n'est imposée", async () => {
    db.tables.seo_settings.push({
      key: "reports",
      updated_at: "2026-10-05T10:00:00Z",
      value: { weeklyDigest: true, weekday: 1, time: "08:00", sections: { kpis: false, pages: false, articles: true, geo: false } },
    })
    const digest = await buildDigest(asDb(), NOW)
    expect(digest.sections).toEqual({ kpis: false, pages: false, articles: true, geo: false })
    expect(digest.articles).toHaveLength(1)
    expect(digest.findings).toBeUndefined()
  })

  it("sans aucune donnée : null, jamais un chiffre inventé", async () => {
    db = fakeSeoDb({ seo_findings: [], blog_posts: [], seo_geo_runs: [] })
    db.rpcs.seo_gsc_bounds = () => [{ first_date: null, last_date: null }]
    const digest = await buildDigest(asDb(), NOW, ALL_DIGEST_SECTIONS)
    expect(digest.kpis).toBeNull()
    expect(digest.findings).toEqual({ top: [], openCount: 0 })
    expect(digest.articles).toEqual([])
    expect(digest.geo).toBeNull()
    expect(digest.unavailable).toEqual([])
  })

  it("sans les 7 jours précédents complets : pas de comparaison", async () => {
    db.rpcs.seo_gsc_bounds = () => [{ first_date: "2026-09-30", last_date: "2026-10-09" }]
    const digest = await buildDigest(asDb(), NOW, ALL_DIGEST_SECTIONS)
    expect(digest.kpis?.previous).toBeNull()
    const { html } = renderSeoDigest(digest, { baseUrl: BASE })
    expect(html).toContain("Pas de comparaison")
  })

  it("une lecture en échec rend la section indisponible sans bloquer les autres", async () => {
    db.failing.add("seo_findings")
    const digest = await buildDigest(asDb(), NOW, ALL_DIGEST_SECTIONS)
    expect(digest.unavailable).toEqual(["pages"])
    expect(digest.findings).toBeUndefined()
    expect(digest.kpis?.current.impressions).toBe(238)
    const { html } = renderSeoDigest(digest, { baseUrl: BASE })
    expect(html).toContain("Données indisponibles")
  })
})

describe("email du résumé", () => {
  it("objet : clics datés par leur vraie plage et constat prioritaire", async () => {
    const digest = await buildDigest(asDb(), NOW, ALL_DIGEST_SECTIONS)
    expect(digestSubject(digest)).toBe(`SEO${NBSP}: 1${NBSP}clic du 3 au 9${NBSP}oct., page bien classée sans clic sur /modele`)
    expect(digestSubject(digest, { ...ALL_DIGEST_SECTIONS, pages: false })).toBe(`SEO${NBSP}: 1${NBSP}clic du 3 au 9${NBSP}oct.`)
    expect(renderSeoDigest(digest, { baseUrl: BASE, preview: true }).subject).toMatch(/^Aperçu · SEO/)
  })

  it("en-tête et préentête : la semaine du résumé, sans le jour de l'envoi", async () => {
    const digest = await buildDigest(asDb(), NOW, ALL_DIGEST_SECTIONS)
    const { html, preheader } = renderSeoDigest(digest, { baseUrl: BASE })
    expect(preheader).toBe(`Le point SEO de qonforme.fr du 5${NBSP}oct. au 11${NBSP}oct.${NBSP}2026.`)
    expect(html).toContain(`du 5${NBSP}oct. au 11${NBSP}oct.${NBSP}2026`)
    expect(html).not.toContain(`12${NBSP}oct.`)
  })

  it("plages courtes", () => {
    expect(dayRange("2026-10-03", "2026-10-09")).toBe(`du 3 au 9${NBSP}oct.`)
    expect(dayRange("2026-09-28", "2026-10-04")).toBe(`du 28${NBSP}sept. au 4${NBSP}oct.`)
    expect(dayRange("2026-10-01", "2026-10-07")).toBe(`du 1er au 7${NBSP}oct.`)
    expect(dayRange("2026-10-09", "2026-10-09")).toBe(`le 9${NBSP}oct.`)
  })

  it("tableau des moteurs : vrai tableau de données (en-têtes de colonne)", async () => {
    const digest = await buildDigest(asDb(), NOW, ALL_DIGEST_SECTIONS)
    const { html } = renderSeoDigest(digest, { baseUrl: BASE })
    const table = html.slice(html.lastIndexOf("<table", html.indexOf(">Moteur<")), html.indexOf(">Moteur<"))
    expect(table).not.toContain('role="presentation"')
    expect(html).toContain('<th scope="col" align="left"')
  })

  it("rend les vrais chiffres, les liens de l'admin et signe Qonforme", async () => {
    const digest = await buildDigest(asDb(), NOW, ALL_DIGEST_SECTIONS)
    const { html } = renderSeoDigest(digest, { baseUrl: BASE })
    expect(html).toContain("238")
    expect(html).toContain(`0,4${NBSP}%`)
    expect(html).toContain("17,6")
    expect(html).toContain(`+102${NBSP}%`)
    expect(html).toContain("https://qonforme.fr/admin/seo/actions")
    expect(html).toContain("https://qonforme.fr/blog/article-semaine")
    expect(html).toContain("Relevé importé")
    expect(html).toContain("Paramètres › Rapports")
    expect(html).toMatch(/>Qonforme<\/p>/)
  })

  it("ne cite jamais un concurrent, même présent dans le relevé", async () => {
    const digest = await buildDigest(asDb(), NOW, ALL_DIGEST_SECTIONS)
    const { html, subject } = renderSeoDigest(digest, { baseUrl: BASE })
    expect(html).not.toMatch(/tolteck/i)
    expect(subject).not.toMatch(/tolteck/i)
  })

  it("sans données : « — » et phrases, aucun chiffre inventé", async () => {
    db = fakeSeoDb({ seo_findings: [], blog_posts: [], seo_geo_runs: [] })
    db.rpcs.seo_gsc_bounds = () => [{ first_date: null, last_date: null }]
    const digest = await buildDigest(asDb(), NOW, ALL_DIGEST_SECTIONS)
    const { html, subject } = renderSeoDigest(digest, { baseUrl: BASE })
    expect(subject).toBe(`SEO${NBSP}: aucun constat ouvert`)
    expect(html).toContain("Aucune donnée Search Console enregistrée")
    expect(html).toContain("Aucun constat ouvert")
    expect(html).toContain(`Aucun article publié du 5 au 11${NBSP}oct.`)
    expect(html).toContain("Aucun relevé terminé")
  })

  it("n'affiche que les sections cochées et échappe les textes de la base", async () => {
    db.tables.seo_findings[1].title = "<script>alert(1)</script>"
    const digest = await buildDigest(asDb(), NOW, ALL_DIGEST_SECTIONS)
    const { html } = renderSeoDigest(digest, { baseUrl: BASE, sections: { kpis: false, pages: true, articles: false, geo: false } })
    expect(html).not.toContain("<script>alert(1)</script>")
    expect(html).toContain("&lt;script&gt;")
    expect(html).not.toContain(">Indicateurs<")
    expect(html).not.toContain(">Visibilité IA<")
    expect(html).toContain(">Pages à surveiller<")
  })

  it("échappe titres et adresses d'articles, chemins, explications et objet", async () => {
    const attack = "<img src=x onerror=alert(1)>"
    db.tables.blog_posts[0].title = `Article ${attack}`
    db.tables.blog_posts[0].slug = `a"><script>x</script>`
    db.tables.seo_findings[1].title = `Titre ${attack}`
    db.tables.seo_findings[1].path = `/modele${attack}`
    db.tables.seo_findings[1].explanation = `Explication ${attack}`
    const digest = await buildDigest(asDb(), NOW, ALL_DIGEST_SECTIONS)
    const { html, subject } = renderSeoDigest(digest, { baseUrl: BASE })
    expect(subject).toContain("<img")
    expect(html).not.toContain("<img")
    expect(html).not.toContain("<script>")
    expect(html).toContain("&lt;img src=x onerror=alert(1)&gt;")
    expect(html).toContain("/blog/a%22%3E%3Cscript%3Ex%3C%2Fscript%3E")
    const title = html.slice(html.indexOf("<title>"), html.indexOf("</title>"))
    expect(title).toContain("&lt;img")
    expect(title).not.toContain("<img")
  })
})
