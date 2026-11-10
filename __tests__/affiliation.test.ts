import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"
import type { SupabaseClient } from "@supabase/supabase-js"
import {
  commissionCents,
  commissionTotals,
  displayState,
  isValidCode,
  landingPath,
  normalizePageUrl,
  parseRefCookie,
  partnerLink,
  partnerLinkHtml,
  refFromParam,
  shouldCountVisit,
  siteDomain,
  slugCode,
  weeklyCounts,
  withinCommissionWindow,
} from "@/lib/affiliation/model"
import { checkPartnerPage, fetchableUrl, findOurLinks, nextPageStatus, relOf } from "@/lib/affiliation/link-check"
import { groupByPage, ourGain, parseRankedKeywords, parseStoredRecommendations, recommendPages, requestMessage } from "@/lib/affiliation/recommend"
import { attributeSignup, recordInvoiceCommission } from "@/lib/affiliation/attribution"
import { linkSummary, payingAccounts } from "@/lib/affiliation/data"
import { staticLinkCandidates } from "@/lib/seo/links/catalog"
import { OPENSEO_TOOLS } from "@/lib/seo/keywords/openseo"
import { NO_TRACKING_PATHS } from "@/lib/consent"

const DAY = 24 * 3600 * 1000

describe("affiliation : code et cookie", () => {
  it("fabrique un code propre à partir du nom", () => {
    expect(slugCode("Le Mag du Bâtiment")).toBe("lemagdubatiment")
    expect(isValidCode("lemagdubatiment")).toBe(true)
    expect(isValidCode("a")).toBe(false)
    expect(isValidCode("ab-c")).toBe(false)
  })

  it("lit ?ref= sans lui faire confiance", () => {
    expect(refFromParam("MagBat")).toBe("magbat")
    expect(refFromParam("mag bat")).toBeNull()
    expect(refFromParam("<script>")).toBeNull()
    expect(refFromParam(null)).toBeNull()
  })

  it("relit le cookie q_ref et déduplique les rechargements", () => {
    const now = Date.now()
    expect(parseRefCookie(`magbat.${now}`)).toEqual({ code: "magbat", at: now })
    expect(parseRefCookie("magbat")).toBeNull()
    expect(parseRefCookie("x.123")).toBeNull()
    const prev = { code: "magbat", at: now - 5 * 60_000 }
    expect(shouldCountVisit(prev, "magbat", now)).toBe(false)
    expect(shouldCountVisit(prev, "autre", now)).toBe(true)
    expect(shouldCountVisit({ code: "magbat", at: now - 31 * 60_000 }, "magbat", now)).toBe(true)
    expect(shouldCountVisit(null, "magbat", now)).toBe(true)
  })

  it("garde un chemin d'arrivée interne seulement", () => {
    expect(landingPath("/modele?ref=x#a")).toBe("/modele")
    expect(landingPath("//evil.com")).toBe("/")
    expect(landingPath("https://evil.com")).toBe("/")
  })
})

describe("affiliation : lien du partenaire", () => {
  it("mène directement à la page, sans redirection", () => {
    expect(partnerLink("/logiciel-devis-gratuit", "magbat")).toBe("https://qonforme.fr/logiciel-devis-gratuit?ref=magbat")
    const html = partnerLinkHtml("/modele", "magbat", "modèle de devis \"gratuit\"")
    expect(html).toBe('<a href="https://qonforme.fr/modele?ref=magbat">modèle de devis &quot;gratuit&quot;</a>')
    expect(html).not.toMatch(/rel=/)
  })

  it("normalise un site et une page", () => {
    expect(siteDomain("https://www.Mag-Batiment.fr/blog")).toBe("mag-batiment.fr")
    expect(siteDomain("192.168.0.1")).toBeNull()
    expect(siteDomain("pas un site")).toBeNull()
    expect(normalizePageUrl("https://www.mag-batiment.fr/guide/?utm=1#x")).toBe("mag-batiment.fr/guide")
    expect(normalizePageUrl("javascript:alert(1)")).toBeNull()
  })
})

describe("affiliation : commissions", () => {
  it("calcule la commission sur la somme payée", () => {
    expect(commissionCents(2400, 20)).toBe(480)
    expect(commissionCents(24000, 20)).toBe(4800)
    expect(commissionCents(3400, 15)).toBe(510)
    expect(commissionCents(0, 20)).toBe(0)
    expect(commissionCents(2400, 80)).toBe(1200) // plafonné à 50 %
  })

  it("ne compte que les paiements dans la durée prévue", () => {
    const signup = new Date("2026-01-15T10:00:00Z")
    expect(withinCommissionWindow(signup, new Date("2026-02-15T10:00:00Z"), 12)).toBe(true)
    expect(withinCommissionWindow(signup, new Date("2027-01-15T09:00:00Z"), 12)).toBe(true)
    expect(withinCommissionWindow(signup, new Date("2027-01-16T10:00:00Z"), 12)).toBe(false)
    expect(withinCommissionWindow(signup, new Date("2025-12-01T10:00:00Z"), 12)).toBe(false)
  })

  it("passe d'« en attente » à « à verser » après les 30 jours de garantie", () => {
    const now = new Date("2026-11-10T12:00:00Z")
    expect(displayState("earned", "2026-11-01T00:00:00Z", now)).toBe("pending")
    expect(displayState("earned", "2026-10-05T00:00:00Z", now)).toBe("due")
    expect(displayState("paid_out", "2026-09-01T00:00:00Z", now)).toBe("paid_out")
    expect(displayState("void", "2026-10-05T00:00:00Z", now)).toBe("void")
  })

  it("additionne en production seulement", () => {
    const now = new Date("2026-11-10T12:00:00Z")
    const t = commissionTotals(
      [
        { state: "earned", paid_at: "2026-10-02T00:00:00Z", commission_cents: 480, amount_paid_cents: 2400, livemode: true },
        { state: "earned", paid_at: "2026-11-02T00:00:00Z", commission_cents: 480, amount_paid_cents: 2400, livemode: true },
        { state: "paid_out", paid_at: "2026-09-02T00:00:00Z", commission_cents: 4800, amount_paid_cents: 24000, livemode: true },
        { state: "void", paid_at: "2026-10-29T00:00:00Z", commission_cents: 4800, amount_paid_cents: 24000, livemode: true },
        { state: "earned", paid_at: "2026-10-02T00:00:00Z", commission_cents: 999, amount_paid_cents: 2400, livemode: false },
      ],
      now,
    )
    expect(t).toEqual({ pending: 480, due: 480, paidOut: 4800, voided: 4800, total: 5760 })
  })

  it("compte les comptes payants une fois, par leur premier paiement", () => {
    const now = new Date("2026-11-10T12:00:00Z")
    const r = payingAccounts(
      [
        { user_id: "a", livemode: true, display: "paid_out", paid_at: "2026-08-01T00:00:00Z" },
        { user_id: "a", livemode: true, display: "pending", paid_at: "2026-11-01T00:00:00Z" },
        { user_id: "b", livemode: true, display: "pending", paid_at: "2026-11-05T00:00:00Z" },
        { user_id: "c", livemode: true, display: "void", paid_at: "2026-11-05T00:00:00Z" },
        { user_id: "d", livemode: false, display: "due", paid_at: "2026-10-01T00:00:00Z" },
      ],
      now,
    )
    expect(r).toEqual({ all: 2, last30: 1 })
  })

  it("range les visites par semaine", () => {
    const now = new Date("2026-11-10T12:00:00Z") // mardi
    const weeks = weeklyCounts(["2026-11-09T08:00:00Z", "2026-11-10T08:00:00Z", "2026-11-03T08:00:00Z", "2025-01-01T00:00:00Z"], now, 2)
    expect(weeks.map((w) => w.count)).toEqual([1, 2])
    expect(weeks[1].start.toISOString()).toBe("2026-11-09T00:00:00.000Z")
  })
})

describe("affiliation : contrôle des liens", () => {
  const page = "https://mag-batiment.fr/article"

  it("trouve le lien vers qonforme.fr et son attribut", () => {
    const html = `<p><a href="https://example.com">x</a> <a class="b" rel="nofollow" href="https://qonforme.fr/modele?ref=magbat">a</a> <a href='https://www.qonforme.fr/logiciel-devis-gratuit'>b</a></p>`
    const links = findOurLinks(html, page)
    expect(links).toHaveLength(2)
    expect(links[0]).toMatchObject({ rel: "follow", path: "/logiciel-devis-gratuit" })
    expect(links[1]).toMatchObject({ rel: "nofollow", path: "/modele" })
  })

  it("lit l'attribut le plus restrictif et le nofollow de toute la page", () => {
    expect(relOf("noopener sponsored nofollow")).toBe("sponsored")
    expect(relOf("ugc")).toBe("ugc")
    expect(relOf(null)).toBe("follow")
    const html = `<meta name="robots" content="index, nofollow"><a href="https://qonforme.fr/">q</a>`
    expect(findOurLinks(html, page)[0].rel).toBe("nofollow")
  })

  it("n'ouvre ni adresse IP ni localhost", () => {
    expect(fetchableUrl("http://127.0.0.1/admin")).toBeNull()
    expect(fetchableUrl("localhost:3000")).toBeNull()
    expect(fetchableUrl("intranet.local/x")).toBeNull()
    expect(fetchableUrl("mag-batiment.fr/article")).toBe("https://mag-batiment.fr/article")
  })

  it("vérifie une page avec un faux réseau", async () => {
    const fake = (async () => new Response(`<a href="https://qonforme.fr/modele?ref=magbat">x</a>`, { status: 200, headers: { "content-type": "text/html" } })) as unknown as typeof fetch
    const r = await checkPartnerPage("mag-batiment.fr/article", fake)
    expect(r).toMatchObject({ ok: true, found: true, rel: "follow", targetPath: "/modele" })
    const gone = (async () => new Response("nope", { status: 404 })) as unknown as typeof fetch
    expect((await checkPartnerPage("mag-batiment.fr/article", gone)).ok).toBe(false)
  })

  it("garde une page proposée tant que le lien n'y est pas", () => {
    const none = { ok: true, found: false, rel: null, href: null, targetPath: null, error: null }
    const yes = { ...none, found: true, rel: "follow" as const }
    const err = { ...none, ok: false, error: "x" }
    expect(nextPageStatus("proposed", none)).toBe("proposed")
    expect(nextPageStatus("proposed", yes)).toBe("found")
    expect(nextPageStatus("found", none)).toBe("missing")
    expect(nextPageStatus("found", err)).toBe("error")
    expect(nextPageStatus("proposed", err)).toBe("proposed")
  })

  it("résume l'état des liens d'un partenaire", () => {
    expect(linkSummary([{ status: "found", rel: "follow" }]).tone).toBe("ok")
    expect(linkSummary([{ status: "found", rel: "nofollow" }]).tone).toBe("warn")
    expect(linkSummary([{ status: "missing", rel: null }, { status: "found", rel: "nofollow" }])).toMatchObject({ tone: "danger", missing: 1, notFollowed: 1 })
    expect(linkSummary([{ status: "proposed", rel: null }]).label).toBe("À proposer")
  })
})

/** Forme réelle de get_ranked_keywords (relevée le 10/11/2026), réduite. */
function row(url: string, keyword: string, rank: number, volume: number, etv: number) {
  return {
    keyword_data: { keyword, keyword_info: { search_volume: volume } },
    ranked_serp_element: { serp_item: { url, rank_group: rank, rank_absolute: rank + 3, etv } },
  }
}

describe("affiliation : recommandations", () => {
  const payload = {
    keywords: [
      row("https://mag-batiment.fr/modele-devis-travaux-gratuit", "modèle devis travaux", 6, 1300, 120),
      row("https://mag-batiment.fr/modele-devis-travaux-gratuit", "modele de devis gratuit", 9, 900, 20),
      row("https://mag-batiment.fr/relancer-client-impaye", "relance facture impayée", 9, 720, 38),
      row("https://mag-batiment.fr/recette-tarte", "recette tarte aux pommes", 3, 9000, 400),
      row("https://autre-site.fr/devis", "modèle devis travaux", 2, 1300, 300),
    ],
  }

  it("lit la réponse d'OpenSEO", () => {
    const rows = parseRankedKeywords(payload)
    expect(rows).toHaveLength(5)
    expect(rows[0]).toEqual({ url: "https://mag-batiment.fr/modele-devis-travaux-gratuit", keyword: "modèle devis travaux", rank: 6, volume: 1300, traffic: 120 })
    expect(parseRankedKeywords({ keywords: [{}, null, "x"] })).toEqual([])
    expect(parseRankedKeywords(null)).toEqual([])
  })

  it("ne garde que les pages du site du partenaire", () => {
    const groups = groupByPage(parseRankedKeywords(payload), "mag-batiment.fr")
    expect(groups.map((g) => g.page).sort()).toEqual(["mag-batiment.fr/modele-devis-travaux-gratuit", "mag-batiment.fr/recette-tarte", "mag-batiment.fr/relancer-client-impaye"])
  })

  it("rapproche chaque page de la bonne page de Qonforme, sans les sujets hors propos", () => {
    const recos = recommendPages({
      rows: parseRankedKeywords(payload),
      site: "https://www.mag-batiment.fr",
      candidates: staticLinkCandidates(),
      ourPositions: new Map([["/modele", 11]]),
    })
    const byPage = new Map(recos.map((r) => [r.page, r]))
    expect(byPage.has("mag-batiment.fr/recette-tarte")).toBe(false)
    expect(byPage.has("autre-site.fr/devis")).toBe(false)
    const devis = byPage.get("mag-batiment.fr/modele-devis-travaux-gratuit")!
    expect(devis.targetPath).toMatch(/^\/modele/)
    expect(devis.keyword).toBe("modèle devis travaux")
    expect(devis.traffic).toBe(140)
    const relance = byPage.get("mag-batiment.fr/relancer-client-impaye")!
    expect(relance.targetPath).toMatch(/relance|impaye/)
    for (const r of recos) {
      expect(r.score).toBeGreaterThanOrEqual(0)
      expect(r.score).toBeLessThanOrEqual(100)
    }
    // La page la plus visitée et la plus proche passe en premier
    expect(recos[0].page).toBe("mag-batiment.fr/modele-devis-travaux-gratuit")
  })

  it("ne recommande pas une page déjà enregistrée", () => {
    const recos = recommendPages({
      rows: parseRankedKeywords(payload),
      site: "mag-batiment.fr",
      candidates: staticLinkCandidates(),
      ourPositions: new Map(),
      exclude: new Set(["mag-batiment.fr/modele-devis-travaux-gratuit"]),
    })
    expect(recos.some((r) => r.page === "mag-batiment.fr/modele-devis-travaux-gratuit")).toBe(false)
  })

  it("préfère une page de Qonforme entre la 4ᵉ et la 20ᵉ place", () => {
    expect(ourGain(11)).toBe(1)
    expect(ourGain(2)).toBeLessThan(ourGain(11))
    expect(ourGain(70)).toBeLessThan(ourGain(30))
  })

  it("relit les recommandations enregistrées sans leur faire confiance", () => {
    const stored = parseStoredRecommendations([
      { page: "mag-batiment.fr/a", targetPath: "/modele", keyword: "k", score: 140, traffic: -3 },
      { page: "mag-batiment.fr/b", targetPath: "//evil.com" },
      { page: "javascript:x", targetPath: "/modele" },
      "x",
    ])
    expect(stored).toHaveLength(1)
    expect(stored[0]).toMatchObject({ score: 100, traffic: 0, targetPath: "/modele" })
  })

  it("prépare un message avec le lien suivi", () => {
    const [r] = parseStoredRecommendations([{ page: "mag-batiment.fr/a", targetPath: "/modele", keyword: "modèle devis", rank: 6, anchor: "modèle de devis gratuit" }])
    const msg = requestMessage(r, partnerLink("/modele", "magbat"))
    expect(msg).toContain("https://mag-batiment.fr/a")
    expect(msg).toContain("6ᵉ sur Google pour « modèle devis »")
    expect(msg).toContain("https://qonforme.fr/modele?ref=magbat")
  })
})

/* ------------------------------------------------------------------ */
/* Attribution : fausse base                                           */
/* ------------------------------------------------------------------ */

type Row = Record<string, unknown>
function fakeDb(tables: Record<string, Row[]>) {
  const writes: { table: string; op: string; value: unknown }[] = []
  const from = (table: string) => {
    const filters: [string, unknown][] = []
    const rows = () => (tables[table] ?? []).filter((r) => filters.every(([k, v]) => r[k] === v))
    const q = {
      select: () => q,
      eq: (k: string, v: unknown) => {
        filters.push([k, v])
        return q
      },
      gte: () => q,
      maybeSingle: async () => ({ data: rows()[0] ?? null, error: null }),
      upsert: async (value: Row, opts: { onConflict: string }) => {
        writes.push({ table, op: "upsert", value })
        const key = opts.onConflict
        const list = (tables[table] ??= [])
        if (!list.some((r) => r[key] === value[key])) list.push(value)
        return { error: null }
      },
    }
    return q
  }
  return { db: { from } as unknown as SupabaseClient, writes, tables }
}

describe("affiliation : attribution", () => {
  const partner = { id: "p1", code: "magbat", status: "active", commission_rate: 20, commission_months: 12 }

  it("rattache un inscrit arrivé par un lien de partenaire", async () => {
    const { db, tables } = fakeDb({ affiliate_partners: [partner] })
    expect(await attributeSignup(db, { userId: "u1", cookie: `magbat.${Date.now()}`, method: "email" })).toBe(true)
    expect(tables.affiliate_referrals[0]).toMatchObject({ user_id: "u1", partner_id: "p1", code: "magbat", method: "email" })
  })

  it("ignore un cookie absent, illisible, ou un partenaire archivé", async () => {
    const { db, writes } = fakeDb({ affiliate_partners: [{ ...partner, code: "vieux", status: "archived" }] })
    expect(await attributeSignup(db, { userId: "u1", cookie: undefined, method: "email" })).toBe(false)
    expect(await attributeSignup(db, { userId: "u1", cookie: "<x>.1", method: "email" })).toBe(false)
    expect(await attributeSignup(db, { userId: "u1", cookie: `vieux.${Date.now()}`, method: "google" })).toBe(false)
    expect(writes).toHaveLength(0)
  })

  it("écrit la commission d'une facture payée dans la durée prévue", async () => {
    const signedUp = new Date(Date.now() - 10 * DAY).toISOString()
    const { db, tables } = fakeDb({ affiliate_partners: [partner], affiliate_referrals: [{ user_id: "u1", partner_id: "p1", signed_up_at: signedUp }] })
    const cents = await recordInvoiceCommission(db, { stripeInvoiceId: "in_1", userId: "u1", livemode: true, amountPaidCents: 2400, paidAt: new Date(), plan: "starter", billingPeriod: "monthly" })
    expect(cents).toBe(480)
    expect(tables.affiliate_commissions[0]).toMatchObject({ stripe_invoice_id: "in_1", commission_cents: 480, rate: 20, livemode: true })
    // Rejoué (Stripe renvoie l'événement) : aucune seconde ligne
    await recordInvoiceCommission(db, { stripeInvoiceId: "in_1", userId: "u1", livemode: true, amountPaidCents: 2400, paidAt: new Date(), plan: "starter", billingPeriod: "monthly" })
    expect(tables.affiliate_commissions).toHaveLength(1)
  })

  it("aucune commission pour un compte non rattaché ou hors durée", async () => {
    const old = new Date(Date.now() - 400 * DAY).toISOString()
    const { db, writes } = fakeDb({ affiliate_partners: [partner], affiliate_referrals: [{ user_id: "u2", partner_id: "p1", signed_up_at: old }] })
    expect(await recordInvoiceCommission(db, { stripeInvoiceId: "in_2", userId: "u9", livemode: true, amountPaidCents: 2400, paidAt: new Date(), plan: null, billingPeriod: null })).toBe(0)
    expect(await recordInvoiceCommission(db, { stripeInvoiceId: "in_3", userId: "u2", livemode: true, amountPaidCents: 2400, paidAt: new Date(), plan: null, billingPeriod: null })).toBe(0)
    expect(writes).toHaveLength(0)
  })
})

describe("affiliation : enregistrement de la route et sûreté", () => {
  it("rend publiques la visite et la page du partenaire, sans traceur ni cache ni référencement", () => {
    const mw = readFileSync("lib/supabase/middleware.ts", "utf8")
    expect(mw).toContain("'/api/affiliation'")
    expect(mw).toContain("'/partenaire'")
    expect(NO_TRACKING_PATHS.test("/partenaire/abc")).toBe(true)
    expect(NO_TRACKING_PATHS.test("/logiciel-devis-gratuit")).toBe(false)
    const sw = readFileSync("public/sw.js", "utf8")
    expect(sw.match(/CACHEABLE_PAGE_PREFIXES = \[[^\]]*\]/)?.[0]).not.toContain("partenaire")
    expect(readFileSync("app/robots.ts", "utf8")).toContain('"/partenaire"')
  })

  it("n'appelle que des outils OpenSEO de lecture", () => {
    expect([...OPENSEO_TOOLS].sort()).toEqual(["get_keyword_metrics", "get_ranked_keywords", "list_projects", "whoami"])
  })

  it("ferme les tables à la clé publique", () => {
    const sql = readFileSync("supabase/migrations/20261110_affiliation.sql", "utf8")
    for (const t of ["affiliate_partners", "affiliate_pages", "affiliate_visits", "affiliate_referrals", "affiliate_commissions"]) {
      expect(sql).toContain(`ALTER TABLE ${t}`)
      expect(sql).toMatch(new RegExp(`'${t}'`))
    }
    expect(sql).toContain("REVOKE ALL ON TABLE %I FROM anon, authenticated")
    expect(sql).not.toMatch(/CREATE POLICY/i)
  })

  it("écrit le cookie dans la politique de confidentialité", () => {
    expect(readFileSync("app/confidentialite/page.tsx", "utf8")).toContain("q_ref")
  })
})
