/**
 * Devis d'essai envoyé à soi-même : contenu (« Exemple », sans numéro), PDF en
 * mémoire avec filigrane, route POST /api/onboarding/trial-quote qui n'écrit
 * jamais dans `quotes` (donc hors des listes, des compteurs, de la recherche et
 * des chiffres), n'écrit qu'à l'adresse du compte et s'arrête à 3 par 24 h.
 */
import { beforeEach, describe, expect, it, vi } from "vitest"
import { PDFDocument } from "pdf-lib"
import { fakeOnboardingDb, type FakeOnboardingDb } from "./helpers/fake-onboarding-db"

let db: FakeOnboardingDb
const sent: { to: string; subject: string; html?: string; attachments?: { filename: string; content: Buffer }[]; fromName?: string }[] = []

vi.mock("@/lib/supabase/server", () => ({ createAdminClient: () => db.client, createClient: () => db.client }))
vi.mock("@/lib/email/resend", () => ({
  sendEmail: (o: (typeof sent)[number]) => { sent.push(o); return Promise.resolve({ id: "email-1" }) },
}))

import { buildTrialQuote, TRIAL_QUOTE_LABEL } from "@/lib/onboarding/trial-quote"
import { generateQuotePdf } from "@/lib/pdf/quote"
import { FRANCHISE_MENTION, resolveDocumentMentions } from "@/lib/legal/mentions"
import { POST } from "@/app/api/onboarding/trial-quote/route"

const USER = "3f2b8c1e-5a4d-4e7f-9b2a-1c0d9e8f7a6b"
const COMPANY = {
  user_id: USER, name: "Garnier Plâtrerie", siren: "948211375", siret: null, vat_number: null,
  address: "4 rue des Artisans", zip_code: "69003", city: "Lyon", iban: null, legal_notice: null,
  accent_color: "#2563EB", logo_url: null,
}

describe("contenu du devis d'essai", () => {
  it("sans numéro, marqué « Exemple », lignes génériques si le catalogue est vide", () => {
    const q = buildTrialQuote({ company: COMPANY, today: "2026-10-03" })
    expect(q.quote_number).toBe(TRIAL_QUOTE_LABEL)
    expect(q.quote_number).not.toMatch(/\d/)
    expect(q.notes).toMatch(/exemple/i)
    expect(q.client?.name).toBe("Client d'exemple")
    expect(q.lines).toHaveLength(3)
    expect(q.subtotal_ht).toBe(845)
    expect(q.total_vat).toBe(169)
    expect(q.total_ttc).toBe(1014)
    expect(q.valid_until).toBe("2026-11-02")
  })

  it("reprend jusqu'à 3 prestations du catalogue, sans prix nul", () => {
    const q = buildTrialQuote({
      company: COMPANY,
      today: "2026-10-03",
      products: [
        { name: "Pose de plaque BA13", unit_price_ht: 32.5, vat_rate: 10 },
        { name: "Gratuit", unit_price_ht: 0, vat_rate: 20 },
        { name: "Bande à joint", unit_price_ht: "4.2", vat_rate: "20" },
      ],
    })
    expect(q.lines?.map((l) => l.description)).toEqual(["Pose de plaque BA13", "Bande à joint"])
    expect(q.total_vat).toBe(4.09) // 3,25 + 0,84
  })

  it("franchise en base (art. 293 B) : pas de TVA", () => {
    const q = buildTrialQuote({ company: { ...COMPANY, legal_notice: "TVA non applicable, art. 293 B du CGI" }, today: "2026-10-03" })
    expect(q.total_vat).toBe(0)
    expect(q.lines?.every((l) => l.vat_rate === 0)).toBe(true)
  })

  it("franchise déclarée dans le profil légal (fenêtre « Bienvenue ») : pas de TVA, mention 293 B sur le PDF", () => {
    const company = { ...COMPANY, legal_notice: null, legal_profile: { trade: "plaquiste", vat_regime: "franchise" } }
    const q = buildTrialQuote({
      company,
      today: "2026-10-03",
      products: [{ name: "Pose de plaque BA13", unit_price_ht: 32.5, vat_rate: 10 }],
    })
    expect(q.total_vat).toBe(0)
    expect(q.total_ttc).toBe(32.5)
    expect(q.lines?.every((l) => l.vat_rate === 0)).toBe(true)
    // Le PDF lit les mêmes mentions (lib/pdf/quote.ts → withDocumentMentions) : brouillon, réglages actuels
    expect(resolveDocumentMentions(company, q, "quote").lines).toContain(FRANCHISE_MENTION)
  })

  it("TVA facturée déclarée dans le profil : l'ancienne mention 293 B ne retire plus la TVA", () => {
    const company = { ...COMPANY, legal_notice: "TVA non applicable, art. 293 B du CGI", legal_profile: { vat_regime: "assujetti" } }
    const q = buildTrialQuote({ company, today: "2026-10-03" })
    expect(q.total_vat).toBe(169)
    expect(resolveDocumentMentions(company, q, "quote").lines).not.toContain(FRANCHISE_MENTION)
  })

  it("PDF généré en mémoire, filigrane « EXEMPLE »", async () => {
    const quote = buildTrialQuote({ company: COMPANY, today: "2026-10-03" })
    const pdf = await generateQuotePdf({ quote, company: { name: COMPANY.name, city: COMPANY.city }, watermark: "EXEMPLE" })
    const loaded = await PDFDocument.load(pdf)
    expect(loaded.getTitle()).toBe("Exemple de devis")
    expect(loaded.getPageCount()).toBe(1)
  })
})

describe("POST /api/onboarding/trial-quote", () => {
  beforeEach(() => {
    sent.length = 0
    db = fakeOnboardingDb({ companies: [COMPANY], products: [], trial_quote_sends: [] })
    db.users[USER] = { email: "thomas@garnier.example.com", user_metadata: { first_name: "Thomas" } }
    db.sessionUserId = USER
  })

  it("envoie à l'adresse du compte, PDF joint, sans rien écrire dans les devis", async () => {
    const res = await POST()
    expect(res.status).toBe(200)
    expect(sent).toHaveLength(1)
    expect(sent[0].to).toBe("thomas@garnier.example.com")
    expect(sent[0].fromName).toBe("Qonforme")
    expect(sent[0].subject).toMatch(/^Exemple/)
    expect(sent[0].attachments?.[0].filename).toBe("Devis-exemple.pdf")
    expect(sent[0].attachments?.[0].content.subarray(0, 5).toString()).toBe("%PDF-")
    // Hors des listes, compteurs, recherche et chiffres : aucune requête sur les devis ni les factures
    expect(db.ops.some((o) => o.table === "quotes" || o.table === "invoices")).toBe(false)
    expect(db.tables.quotes).toBeUndefined()
    expect(db.tables.trial_quote_sends).toHaveLength(1)
  })

  it("franchise du profil légal lue en base : devis d'essai sans TVA", async () => {
    db.tables.companies = [{ ...COMPANY, legal_profile: { vat_regime: "franchise" } }]
    expect((await POST()).status).toBe(200)
    expect(sent[0].html).toMatch(/845,00/)
    expect(sent[0].html).not.toMatch(/1\s?014,00/)
  })

  it("3 par 24 heures, puis 429 sans email", async () => {
    for (let i = 0; i < 3; i++) expect((await POST()).status).toBe(200)
    const res = await POST()
    expect(res.status).toBe(429)
    expect(sent).toHaveLength(3)
    expect(db.tables.trial_quote_sends).toHaveLength(3) // la 4e réservation est retirée
  })

  it("les envois de plus de 24 heures ne comptent plus", async () => {
    const old = new Date(Date.now() - 25 * 3_600_000).toISOString()
    db.tables.trial_quote_sends = [1, 2, 3].map((n) => ({ id: `old-${n}`, user_id: USER, sent_at: old }))
    expect((await POST()).status).toBe(200)
  })

  it("migration absente : 503, rien n'est envoyé", async () => {
    db.missing.add("trial_quote_sends")
    const res = await POST()
    expect(res.status).toBe(503)
    expect(sent).toHaveLength(0)
  })

  it("non connecté : 401 ; sans entreprise : 409", async () => {
    db.sessionUserId = null
    expect((await POST()).status).toBe(401)
    db.sessionUserId = USER
    db.tables.companies = []
    expect((await POST()).status).toBe(409)
    expect(sent).toHaveLength(0)
  })
})
