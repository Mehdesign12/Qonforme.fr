/**
 * Emails des comptes (Admin › Utilisateurs) : liens de retour signés, webhook
 * Resend, journal d'envoi, reprise automatique par blocage, modèles, suivi,
 * mesures par modèle, garde-fous de l'envoi à la main.
 */
import { createHmac } from "node:crypto"
import { beforeEach, describe, expect, it, vi } from "vitest"

const sendEmail = vi.fn(async () => ({ id: "re_123" }))
vi.mock("@/lib/email/resend", () => ({ sendEmail: (...a: unknown[]) => sendEmail(...(a as [])) }))

import { eventUpdate, sendAccountEmail, trackedLink, verifyTrackedLink, wrapLinks } from "@/lib/email/journal"
import { verifySvixSignature } from "@/lib/email/svix"
import { planReprise, type RepriseInput } from "@/lib/onboarding/reprise"
import { buildAccountEmail } from "@/lib/email/templates/reprise"
import { trackSteps, trackSummary } from "@/components/admin/emails/track"
import { computeEmailStats, type AccountEvents } from "@/lib/admin/email-stats"
import { manualSendBlocker, suggestedTemplate, type AccountContext } from "@/lib/admin/account-emails"

const SECRET = "secret-de-test-assez-long"
const BASE = "https://qonforme.fr"
const ID = "11111111-2222-3333-4444-555555555555"

describe("liens de retour", () => {
  it("signe et vérifie un chemin du site", () => {
    const link = trackedLink(ID, "/quotes/new", BASE, SECRET)!
    const u = new URL(link)
    expect(u.pathname).toBe("/api/emails/c")
    expect(verifyTrackedLink({ e: u.searchParams.get("e"), p: u.searchParams.get("p"), s: u.searchParams.get("s") }, SECRET))
      .toEqual({ emailId: ID, path: "/quotes/new" })
  })

  it("refuse une destination modifiée ou externe", () => {
    const u = new URL(trackedLink(ID, "/quotes/new", BASE, SECRET)!)
    expect(verifyTrackedLink({ e: ID, p: "/admin", s: u.searchParams.get("s") }, SECRET)).toBeNull()
    expect(verifyTrackedLink({ e: ID, p: "//evil.example", s: u.searchParams.get("s") }, SECRET)).toBeNull()
    expect(trackedLink(ID, "https://evil.example", BASE, SECRET)).toBeNull()
  })

  it("réécrit les liens du site, garde la désinscription et les liens externes", () => {
    const html = `<a href="${BASE}/dashboard?inscription=reprendre&amp;x=1">a</a><a href="${BASE}/desinscription?t=abc">b</a><a href="https://service-public.fr">c</a>`
    const out = wrapLinks(html, ID, BASE, SECRET)
    expect(out).toContain(`${BASE}/api/emails/c?e=`)
    expect(out).toContain(`href="${BASE}/desinscription?t=abc"`)
    expect(out).toContain('href="https://service-public.fr"')
    const href = out.match(/href="([^"]+)"/)![1].replace(/&amp;/g, "&")
    const u = new URL(href)
    expect(u.searchParams.get("p")).toBe("/dashboard?inscription=reprendre&x=1")
  })

  it("sans secret, ne touche à rien", () => {
    const html = `<a href="${BASE}/dashboard">a</a>`
    expect(wrapLinks(html, ID, BASE, null)).toBe(html)
  })
})

describe("signature Svix (webhook Resend)", () => {
  const key = Buffer.from("cle-de-test-du-webhook").toString("base64")
  const secret = `whsec_${key}`
  const sign = (id: string, ts: string, body: string) =>
    `v1,${createHmac("sha256", Buffer.from(key, "base64")).update(`${id}.${ts}.${body}`).digest("base64")}`
  const now = 1_800_000_000_000
  const ts = String(now / 1000)

  it("accepte une signature valable", () => {
    const body = '{"type":"email.delivered"}'
    expect(verifySvixSignature({ secret, id: "msg_1", timestamp: ts, signature: `v0,xx ${sign("msg_1", ts, body)}`, body, now })).toBe(true)
  })

  it("refuse un corps modifié, une signature absente ou trop ancienne", () => {
    const body = '{"type":"email.delivered"}'
    expect(verifySvixSignature({ secret, id: "msg_1", timestamp: ts, signature: sign("msg_1", ts, body), body: body + " ", now })).toBe(false)
    expect(verifySvixSignature({ secret, id: "msg_1", timestamp: ts, signature: null, body, now })).toBe(false)
    const old = String(now / 1000 - 600)
    expect(verifySvixSignature({ secret, id: "msg_1", timestamp: old, signature: sign("msg_1", old, body), body, now })).toBe(false)
  })

  it("traduit les événements en mise à jour du journal", () => {
    expect(eventUpdate({ type: "email.delivered", created_at: "2026-11-10T09:00:00Z" })).toEqual({ status: "delivered", delivered_at: "2026-11-10T09:00:00.000Z" })
    expect(eventUpdate({ type: "email.bounced" })?.status).toBe("bounced")
    expect(eventUpdate({ type: "email.sent" })).toBeNull()
  })
})

/** Faux client admin : enregistre les écritures sur account_emails. */
function fakeAdmin(opts: { insertError?: { code?: string; message: string } } = {}) {
  const calls: { op: string; values?: unknown }[] = []
  const chain = (op: string, values?: unknown) => {
    calls.push({ op, values })
    const q: Record<string, unknown> = {
      eq: () => q, in: () => q, is: () => q,
      select: () => q,
      single: async () => (opts.insertError ? { data: null, error: opts.insertError } : { data: { id: ID }, error: null }),
      then: (r: (v: { error: null }) => void) => r({ error: null }),
    }
    return q
  }
  return {
    calls,
    from: () => ({
      insert: (v: unknown) => chain("insert", v),
      update: (v: unknown) => chain("update", v),
      delete: () => chain("delete"),
    }),
  }
}

describe("envoi journalisé", () => {
  beforeEach(() => {
    sendEmail.mockClear()
    sendEmail.mockImplementation(async () => ({ id: "re_123" }))
  })

  const mail = { userId: ID, category: "manual" as const, template: "manual_free", to: "a@example.fr", subject: "S", html: "<p>x</p>" }

  it("réserve, envoie, note l'identifiant Resend", async () => {
    const admin = fakeAdmin()
    const out = await sendAccountEmail(admin as never, mail)
    expect(out).toEqual({ sent: true, journalId: ID })
    expect(admin.calls.map((c) => c.op)).toEqual(["insert", "update"])
    expect(admin.calls[1].values).toMatchObject({ status: "sent", resend_id: "re_123" })
  })

  it("table absente : l'email part quand même, sans journal", async () => {
    const out = await sendAccountEmail(fakeAdmin({ insertError: { code: "42P01", message: "relation does not exist" } }) as never, mail)
    expect(out).toEqual({ sent: true, journalId: null })
    expect(sendEmail).toHaveBeenCalledTimes(1)
  })

  it("une reprise déjà au journal ne repart pas", async () => {
    const out = await sendAccountEmail(fakeAdmin({ insertError: { code: "23505", message: "duplicate" } }) as never, { ...mail, category: "reprise", template: "reprise_company_1" })
    expect(out).toEqual({ taken: true })
    expect(sendEmail).not.toHaveBeenCalled()
  })

  it("un échec de reprise retire la réservation ; un autre échec reste marqué", async () => {
    sendEmail.mockImplementation(async () => { throw new Error("Resend en panne") })
    const a = fakeAdmin()
    expect(await sendAccountEmail(a as never, { ...mail, category: "reprise", template: "reprise_company_1" })).toEqual({ error: "Resend en panne" })
    expect(a.calls.map((c) => c.op)).toEqual(["insert", "delete"])
    const b = fakeAdmin()
    await sendAccountEmail(b as never, mail)
    expect(b.calls[1]).toMatchObject({ op: "update", values: { status: "failed" } })
  })
})

describe("reprise automatique", () => {
  // Lundi 2 novembre 2026, 10 h à Paris (UTC+1)
  const ENROLLED = "2026-11-02T09:00:00.000Z"
  const at = (iso: string, over: Partial<RepriseInput> = {}) =>
    planReprise({
      now: new Date(iso), enrolledAt: ENROLLED, optedOut: false, hasSiren: false,
      oldestDraftQuoteAt: null, quotesSent: 0, hasDocuments: false, lastSignInAt: null,
      sent: new Set(), lastEmailAt: null, ...over,
    })

  it("Bloqué : Entreprise : J+1, J+3, J+7, dans l'ordre", () => {
    expect(at("2026-11-03T09:00:00Z")).toBe("reprise_company_1")
    expect(at("2026-11-04T09:00:00Z", { sent: new Set(["reprise_company_1"]) })).toBeNull()
    expect(at("2026-11-05T09:00:00Z", { sent: new Set(["reprise_company_1"]) })).toBe("reprise_company_2")
    expect(at("2026-11-09T09:00:00Z", { sent: new Set(["reprise_company_1", "reprise_company_2"]) })).toBe("reprise_company_3")
    expect(at("2026-11-12T09:00:00Z", { sent: new Set(["reprise_company_1", "reprise_company_2", "reprise_company_3"]) })).toBeNull()
  })

  it("s'arrête dès le SIREN, respecte l'écart de 20 h, les heures et la désinscription", () => {
    expect(at("2026-11-03T09:00:00Z", { hasSiren: true })).toBeNull()
    expect(at("2026-11-03T09:00:00Z", { lastEmailAt: "2026-11-03T02:00:00Z" })).toBeNull()
    expect(at("2026-11-03T20:00:00Z")).toBeNull() // 21 h à Paris
    expect(at("2026-11-08T10:00:00Z")).toBeNull() // dimanche
    expect(at("2026-11-03T09:00:00Z", { optedOut: true })).toBeNull()
    expect(at("2026-12-10T09:00:00Z")).toBeNull() // après 30 jours
  })

  it("devis jamais envoyé : 2 puis 5 jours après le brouillon", () => {
    const base = { hasSiren: true, oldestDraftQuoteAt: "2026-11-03T10:00:00Z", hasDocuments: true }
    expect(at("2026-11-04T09:00:00Z", base)).toBeNull()
    expect(at("2026-11-05T09:00:00Z", base)).toBe("reprise_quote_send_1")
    expect(at("2026-11-07T09:00:00Z", { ...base, sent: new Set(["reprise_quote_send_1"]) })).toBeNull()
    expect(at("2026-11-09T09:00:00Z", { ...base, sent: new Set(["reprise_quote_send_1"]) })).toBe("reprise_quote_send_2")
    expect(at("2026-11-05T09:00:00Z", { ...base, quotesSent: 1 })).toBeNull()
  })

  it("inactif 14 jours : une fois, seulement avec la dernière connexion connue", () => {
    const base = { hasSiren: true, hasDocuments: true }
    expect(at("2026-11-20T09:00:00Z", { ...base, lastSignInAt: "2026-11-05T09:00:00Z" })).toBe("reprise_inactive_14")
    expect(at("2026-11-20T09:00:00Z", { ...base, lastSignInAt: "2026-11-15T09:00:00Z" })).toBeNull()
    expect(at("2026-11-20T09:00:00Z", base)).toBeNull()
    expect(at("2026-11-20T09:00:00Z", { ...base, lastSignInAt: "2026-11-05T09:00:00Z", sent: new Set(["reprise_inactive_14"]) })).toBeNull()
  })
})

describe("modèles", () => {
  const ctx = { firstName: "Karim <b>", signupDate: "6 novembre 2026", unsubscribeUrl: "https://qonforme.fr/desinscription?t=x" }

  it("échappe le prénom, le client et la phrase ajoutée", () => {
    const { html } = buildAccountEmail("manual_quote_send", {
      ...ctx,
      draftQuote: { id: "q1", number: "D-2026-001", clientName: "M. <script>", totalTtc: 1840, clientHasEmail: false },
      note: "Ligne 1\n<img src=x>",
    })
    expect(html).not.toContain("<script>")
    expect(html).not.toContain("<img src=x>")
    expect(html).toContain("Karim &lt;b&gt;")
    expect(html).toContain("D-2026-001")
    expect(html).toContain("fenêtre d'envoi")
  })

  it("chaque modèle a le lien de désinscription et ne promet ni appel ni délai", () => {
    for (const t of ["reprise_company_1", "reprise_company_2", "reprise_company_3", "reprise_quote_send_1", "reprise_quote_send_2", "reprise_inactive_14", "manual_first_quote"] as const) {
      const { html, subject } = buildAccountEmail(t, ctx)
      expect(subject.length).toBeGreaterThan(5)
      expect(html).toContain("desinscription?t=x")
      expect(html).not.toMatch(/appel|rendez-vous|sous 24|certifi/i)
    }
  })

  it("email libre : un paragraphe par bloc", () => {
    const { subject, html } = buildAccountEmail("manual_free", { ...ctx, freeSubject: "Bonjour", freeBody: "Un.\n\nDeux." })
    expect(subject).toBe("Bonjour")
    expect(html.match(/<p style/g)!.length).toBeGreaterThanOrEqual(3)
  })
})

describe("suivi et mesures", () => {
  const row = { category: "manual", status: "delivered", sent_at: "2026-11-09T08:30:00Z", delivered_at: "2026-11-09T08:30:05Z", bounced_at: null, opened_at: null, first_clicked_at: null, click_count: 0 }

  it("lit le suivi d'un email", () => {
    expect(trackSteps(row).map((s) => s.label)).toEqual(["Remis", "Pas encore cliqué"])
    expect(trackSteps({ ...row, first_clicked_at: "2026-11-09T10:00:00Z", click_count: 1 }).map((s) => s.label)).toContain("Revenu sur Qonforme")
    expect(trackSummary({ ...row, status: "bounced" }).tone).toBe("danger")
    expect(trackSteps({ ...row, status: "failed" })[0].label).toBe("Non parti")
  })

  it("compte l'étape franchie sous 7 jours", () => {
    const ev = (o: Partial<AccountEvents>): AccountEvents => ({ quoteCreated: [], quoteSent: [], invoiceCreated: [], subscribed: [], hasSiren: false, ...o })
    const events = new Map([
      ["u1", ev({ quoteSent: ["2026-11-05T10:00:00Z"] })],
      ["u2", ev({ quoteSent: ["2026-11-20T10:00:00Z"] })],
    ])
    const stats = computeEmailStats([
      { user_id: "u1", template: "reprise_quote_send_1", category: "reprise", status: "sent", sent_at: "2026-11-04T09:00:00Z", first_clicked_at: "2026-11-04T10:00:00Z" },
      { user_id: "u2", template: "reprise_quote_send_1", category: "reprise", status: "delivered", sent_at: "2026-11-04T09:00:00Z", first_clicked_at: null },
      { user_id: "u2", template: "manual_free", category: "manual", status: "failed", sent_at: "2026-11-04T09:00:00Z", first_clicked_at: null },
    ], events)
    expect(stats).toEqual([{ template: "reprise_quote_send_1", category: "reprise", sent: 2, bounced: 0, clicked: 1, reached: 1 }])
  })
})

describe("envoi à la main", () => {
  const facts = { hasSiren: true, oldestDraftQuote: null, quotesSent: 0, draftQuotes: 0, quotesAwaiting: 0, repriseSent: new Set<string>(), lastEmailAt: null }
  const ctx = (o: Partial<AccountContext> = {}): AccountContext => ({
    userId: ID, email: "a@example.fr", firstName: "", signupDate: "1 novembre 2026", hasSignupDraft: false, facts, quotes: 0, optedOut: false, ...o,
  })
  const now = new Date("2026-11-10T10:00:00Z")

  it("conseille le modèle selon le blocage", () => {
    expect(suggestedTemplate({ ...facts, hasSiren: false }, 0)).toBe("manual_company")
    expect(suggestedTemplate({ ...facts, oldestDraftQuote: { id: "q", number: null, clientName: null, totalTtc: null, clientHasEmail: true, createdAt: "2026-11-01T10:00:00Z" } }, 1)).toBe("manual_quote_send")
    expect(suggestedTemplate(facts, 0)).toBe("manual_first_quote")
    expect(suggestedTemplate({ ...facts, quotesSent: 2 }, 2)).toBe("manual_free")
  })

  it("refuse un compte désinscrit, un email trop rapproché, un devis absent, un email libre vide", () => {
    expect(manualSendBlocker(ctx({ optedOut: true }), { template: "manual_first_quote" }, now)).toMatch(/désinscrit/)
    expect(manualSendBlocker(ctx({ facts: { ...facts, lastEmailAt: "2026-11-10T01:00:00Z" } }), { template: "manual_first_quote" }, now)).toMatch(/20 heures/)
    expect(manualSendBlocker(ctx(), { template: "manual_quote_send" }, now)).toMatch(/brouillon/)
    expect(manualSendBlocker(ctx(), { template: "manual_free", freeSubject: "", freeBody: "x" }, now)).toMatch(/objet/)
    expect(manualSendBlocker(ctx(), { template: "manual_first_quote" }, now)).toBeNull()
  })
})
