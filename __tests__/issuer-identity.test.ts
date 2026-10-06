/**
 * Garde d'envoi (lib/legal/issuer.ts) : sans nom, adresse complète ni SIREN
 * valide, l'envoi d'un devis, d'une facture ou d'un bon de commande et le
 * partage d'un lien de signature répondent 409 `COMPANY_REQUIRED`, AVANT le mur
 * de paiement (un artisan ne paie jamais pour être bloqué ensuite). Les
 * brouillons, l'archivage et la désactivation d'un lien restent libres.
 */
import { beforeEach, describe, expect, it, vi } from "vitest"
import { NextRequest, NextResponse } from "next/server"
import { fakeCompanyDb, type FakeCompanyDb } from "./helpers/fake-company-db"

const mocks = vi.hoisted(() => ({
  db: undefined as unknown as FakeCompanyDb,
  paywall: [] as string[],
  sent: [] as unknown[],
}))

const paywallResponse = () => NextResponse.json({ code: "SUBSCRIPTION_REQUIRED", error: "Formule requise" }, { status: 402 })

vi.mock("@/lib/supabase/server", () => ({ createClient: async () => mocks.db.client, createAdminClient: () => mocks.db.client }))
vi.mock("@/lib/stripe/subscription", () => ({
  requireIssuingAccess: async () => { mocks.paywall.push("issuing"); return paywallResponse() },
}))
vi.mock("@/lib/artisan/access", () => ({
  requireArtisanAccess: async () => { mocks.paywall.push("artisan"); return paywallResponse() },
}))
vi.mock("@/lib/signature/access", () => ({
  requireSignatureAccess: async () => { mocks.paywall.push("signature"); return paywallResponse() },
  hasSignatureAccess: async () => false,
}))
vi.mock("@/lib/email/resend", () => ({ sendEmail: async (o: unknown) => { mocks.sent.push(o); return { id: "email-1" } } }))

import { COMPANY_REQUIRED_MESSAGE, issuerIdentityError, issuerSiren, requireIssuerIdentity } from "@/lib/legal/issuer"
import { COMPANY_REQUIRED } from "@/lib/onboarding/inscription"
import { POST as sendQuote } from "@/app/api/quotes/[id]/send/route"
import { POST as sendInvoice } from "@/app/api/invoices/[id]/send/route"
import { PATCH as patchInvoice } from "@/app/api/invoices/[id]/route"
import { POST as sendPurchaseOrder } from "@/app/api/purchase-orders/[id]/send/route"
import { POST as signatureAction } from "@/app/api/signature/[type]/[id]/route"
import { PATCH as patchQuote } from "@/app/api/quotes/[id]/route"
import { PATCH as patchPurchaseOrder } from "@/app/api/purchase-orders/[id]/route"

const USER = "user-1"
const SIREN = "948211370" // clé de Luhn valide
const COMPLETE = { user_id: USER, name: "GARNIER PLÂTRERIE", siren: SIREN, siret: null, address: "14 rue des Lices", zip_code: "49100", city: "Angers" }
const NO_SIREN = { ...COMPLETE, siren: "" }

describe("identité de l'émetteur", () => {
  it("complète : nom, adresse, code postal, ville et SIREN valide", () => {
    expect(issuerIdentityError(COMPLETE)).toBeNull()
    expect(issuerIdentityError({ ...COMPLETE, siren: "948 211 370" })).toBeNull()
  })

  it("sans entreprise, sans SIREN (« » en base) ou avec un SIREN mal formé : message de la route", () => {
    expect(issuerIdentityError(null)).toBe(COMPANY_REQUIRED_MESSAGE)
    expect(issuerIdentityError(NO_SIREN)).toBe(COMPANY_REQUIRED_MESSAGE)
    expect(issuerIdentityError({ ...COMPLETE, siren: null })).toBe(COMPANY_REQUIRED_MESSAGE)
    expect(issuerIdentityError({ ...COMPLETE, siren: "94821137" })).toBe(COMPANY_REQUIRED_MESSAGE)
    expect(issuerIdentityError({ ...COMPLETE, siren: "SIREN" })).toBe(COMPANY_REQUIRED_MESSAGE)
  })

  it("SIREN de 9 chiffres à la clé fausse (saisi avec l'ancien formulaire) : jamais bloqué d'un coup", () => {
    expect(issuerIdentityError({ ...COMPLETE, siren: "948211375" })).toBeNull()
  })

  it("adresse, code postal, ville ou nom manquant : refusé", () => {
    for (const key of ["name", "address", "zip_code", "city"]) {
      expect(issuerIdentityError({ ...COMPLETE, [key]: "  " })).toBe(COMPANY_REQUIRED_MESSAGE)
      expect(issuerIdentityError({ ...COMPLETE, [key]: null })).toBe(COMPANY_REQUIRED_MESSAGE)
    }
  })

  it("SIRET seul : son SIREN suffit", () => {
    expect(issuerSiren({ ...NO_SIREN, siret: `${SIREN}00017` })).toBe(SIREN)
    expect(issuerIdentityError({ ...NO_SIREN, siret: `${SIREN}00017` })).toBeNull()
    expect(issuerSiren({ ...NO_SIREN, siret: "94821137" })).toBeNull()
  })

  it("message : vouvoiement, espace insécable avant les deux-points, où compléter", () => {
    expect(COMPANY_REQUIRED_MESSAGE).toBe(
      "Ajoutez le SIREN et l'adresse de votre entreprise avant l'envoi : ils figurent obligatoirement sur vos devis et vos factures (Paramètres › Entreprise).",
    )
  })
})

describe("requireIssuerIdentity", () => {
  beforeEach(() => { mocks.db = fakeCompanyDb({ companies: [] }) })

  it("409 COMPANY_REQUIRED, null si l'identité est complète", async () => {
    mocks.db.tables.companies.push({ ...NO_SIREN })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const res = await requireIssuerIdentity(mocks.db.client as any, USER)
    expect(res?.status).toBe(409)
    expect(await res?.json()).toEqual({ code: COMPANY_REQUIRED, error: COMPANY_REQUIRED_MESSAGE })

    mocks.db.tables.companies[0].siren = SIREN
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(await requireIssuerIdentity(mocks.db.client as any, USER)).toBeNull()
  })

  it("lecture en erreur : 503, jamais un faux « entreprise incomplète »", async () => {
    mocks.db.failing.add("companies")
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const res = await requireIssuerIdentity(mocks.db.client as any, USER)
    expect(res?.status).toBe(503)
    expect((await res?.json()).code).toBeUndefined()
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Routes gardées
// ─────────────────────────────────────────────────────────────────────────────

const DOC_ID = "6b0f8c62-3c1e-4f3a-9d8e-2a7b5c4d1e0f"
const params = { params: Promise.resolve({ id: DOC_ID }) }
const post = () => new NextRequest("http://localhost/api", { method: "POST" })
const patchReq = (body: unknown) => new NextRequest("http://localhost/api", { method: "PATCH", body: JSON.stringify(body) })
const signReq = (action: string) => new NextRequest("http://localhost/api", { method: "POST", body: JSON.stringify({ action }) })

const LINE = { description: "Cloison", quantity: 1, unit_price_ht: 100, vat_rate: 10, total_ht: 100, total_vat: 10 }
const CLIENT = { id: "client-1", name: "M. et Mme Lambert", email: null }

async function expectCompanyRequired(res: Response) {
  expect(res.status).toBe(409)
  expect(await res.json()).toEqual({ code: COMPANY_REQUIRED, error: COMPANY_REQUIRED_MESSAGE })
  expect(mocks.paywall).toEqual([])
  expect(mocks.sent).toEqual([])
}

describe("routes d'envoi", () => {
  beforeEach(() => {
    mocks.paywall.length = 0
    mocks.sent.length = 0
    mocks.db = fakeCompanyDb({
      companies: [{ ...NO_SIREN }],
      quotes: [{ id: DOC_ID, user_id: USER, status: "draft", quote_number: "D-2026-001", issue_date: "2026-10-06", valid_until: "2026-11-05", lines: [LINE], client: CLIENT }],
      purchase_orders: [{ id: DOC_ID, user_id: USER, status: "draft", po_number: "BC-2026-001", issue_date: "2026-10-06", lines: [LINE], client: CLIENT }],
      invoices: [{ id: DOC_ID, user_id: USER, status: "draft", invoice_number: null, issue_date: "2026-10-06", due_date: "2026-11-05", lines: [LINE], client: { ...CLIENT, email: "lambert@example.com" } }],
      document_signatures: [],
    })
    mocks.db.user = { id: USER, email: "thomas@garnier.example.com", user_metadata: {} }
  })

  const status = (table: string) => mocks.db.tables[table][0].status

  it("devis : 409 sans SIREN, rien n'est envoyé ni marqué envoyé", async () => {
    await expectCompanyRequired(await sendQuote(post(), params))
    expect(status("quotes")).toBe("draft")
  })

  it("devis : identité complète, la route continue (client sans email : 422)", async () => {
    mocks.db.tables.companies[0].siren = SIREN
    expect((await sendQuote(post(), params)).status).toBe(422)
  })

  it("bon de commande : 409 sans SIREN", async () => {
    await expectCompanyRequired(await sendPurchaseOrder(post(), params))
    expect(status("purchase_orders")).toBe("draft")
  })

  it("facture : 409 AVANT le mur de paiement, la facture reste un brouillon sans numéro", async () => {
    await expectCompanyRequired(await sendInvoice(post(), params))
    expect(mocks.db.tables.invoices[0]).toMatchObject({ status: "draft", invoice_number: null })
  })

  it("facture : identité complète, le mur de paiement vient ensuite", async () => {
    mocks.db.tables.companies[0].siren = SIREN
    expect((await sendInvoice(post(), params)).status).toBe(402)
    expect(mocks.paywall).toEqual(["issuing"])
  })

  it("« Marquer comme envoyée » : 409 avant le mur de paiement", async () => {
    await expectCompanyRequired(await patchInvoice(patchReq({ status: "sent" }), params))
    expect(status("invoices")).toBe("draft")

    mocks.db.tables.companies[0].siren = SIREN
    expect((await patchInvoice(patchReq({ status: "sent" }), params)).status).toBe(402)
    expect(mocks.paywall).toEqual(["issuing"])
  })

  it("devis et bon de commande « Marquer comme envoyé » : 409 sans SIREN, brouillon modifiable", async () => {
    await expectCompanyRequired(await patchQuote(patchReq({ status: "sent" }), params))
    expect(status("quotes")).toBe("draft")
    await expectCompanyRequired(await patchPurchaseOrder(patchReq({ status: "sent" }), params))
    expect(status("purchase_orders")).toBe("draft")
    expect((await patchQuote(patchReq({ notes: "Accès par la cour" }), params)).status).toBe(200)

    mocks.db.tables.companies[0].siren = SIREN
    expect((await patchQuote(patchReq({ status: "sent" }), params)).status).toBe(200)
    expect(status("quotes")).toBe("sent")
  })

  it("brouillon modifié ou archivé : jamais bloqué", async () => {
    const res = await patchInvoice(patchReq({ notes: "Accès par la cour" }), params)
    expect(res.status).toBe(200)
    expect(mocks.db.tables.invoices[0].notes).toBe("Accès par la cour")
    expect((await patchInvoice(patchReq({ is_archived: true }), params)).status).toBe(200)
  })

  it("entreprise illisible : 503, ni mur de paiement ni envoi", async () => {
    mocks.db.tables.companies[0].siren = SIREN
    mocks.db.failing.add("companies")
    expect((await sendInvoice(post(), params)).status).toBe(503)
    expect(mocks.paywall).toEqual([])
  })

  it("lien de signature (créer, envoyer, renouveler) : 409 avant le mur de paiement", async () => {
    for (const action of ["link", "send", "renew"]) {
      await expectCompanyRequired(await signatureAction(signReq(action), { params: { type: "quote", id: DOC_ID } }))
    }
    expect(status("quotes")).toBe("draft")

    mocks.db.tables.companies[0].siren = SIREN
    expect((await signatureAction(signReq("link"), { params: { type: "quote", id: DOC_ID } })).status).toBe(402)
    expect(mocks.paywall).toEqual(["signature"])
  })

  it("désactiver un lien : jamais bloqué par l'identité", async () => {
    const res = await signatureAction(signReq("disable"), { params: { type: "purchase_order", id: DOC_ID } })
    expect((await res.json()).code).toBeUndefined()
    expect(mocks.db.ops.some((o) => o.table === "companies")).toBe(false)
  })
})
