/**
 * Envoi d'une facture par la plateforme agréée (route d'envoi, lot 3) : ordre
 * des étapes et sort de la facture à chaque échec.
 *  - contrôle refusé, réservation refusée, jeton indisponible : AUCUNE émission
 *    (la facture reste en brouillon, aucun numéro) ;
 *  - dépôt refusé après l'émission : facture émise, raison gardée, à renvoyer ;
 *  - doublon chez Super PDP : l'envoi reprend la facture déjà déposée ;
 *  - réussite : PDF avec les adresses de l'annuaire, statut « Envoyée ».
 */
import { beforeEach, describe, expect, it, vi } from "vitest"
import { NextRequest } from "next/server"
import { ApiError } from "@/lib/pa/superpdp/api"
import { depositErrorText, duplicateIdOf } from "@/lib/pa/deposit"

const m = vi.hoisted(() => ({
  steps: [] as string[],
  invoice: {} as Record<string, unknown>,
  options: null as unknown,
  reserve: null as unknown,
  token: null as unknown,
  deposit: null as null | (() => Promise<unknown>),
  pdfInput: null as null | { invoice: Record<string, unknown>; company: Record<string, unknown> },
  updates: [] as Record<string, unknown>[],
  failed: [] as string[],
  deposited: [] as Record<string, unknown>[],
  platformNumber: "000000001",
  validation: { valid: true, failures: [] as string[] },
}))

const userDb = {
  auth: { getUser: async () => ({ data: { user: { id: "u1", email: "a@b.fr" } } }) },
  from: (t: string) => {
    const q: Record<string, unknown> = {}
    const chain = () => q
    Object.assign(q, {
      select: chain, eq: chain,
      single: async () => (t === "invoices" ? { data: m.invoice, error: null } : { data: { name: "Martin", invoice_prefix: "F" }, error: null }),
      update: (patch: Record<string, unknown>) => { m.updates.push(patch); m.steps.push("statut"); return { eq: () => ({ eq: async () => ({ error: null }) }) } },
    })
    return q
  },
}
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => userDb, createAdminClient: () => ({}) }))
vi.mock("@/lib/legal/issuer", () => ({ requireIssuerIdentity: async () => null }))
vi.mock("@/lib/stripe/subscription", () => ({ requireIssuingAccess: async () => null }))
vi.mock("@/lib/artisan/access", () => ({ requireArtisanAccess: async () => null }))
vi.mock("@/lib/email/resend", () => ({ sendEmail: async () => { m.steps.push("email"); return { id: "e" } } }))
vi.mock("@/lib/pa/delivery-server", () => ({ loadDeliveryOptions: async () => { m.steps.push("contrôle"); return m.options } }))
vi.mock("@/lib/pa/store", async (orig) => ({ ...(await orig<typeof import("@/lib/pa/store")>()), loadConnection: async () => ({ ok: true, row: { electronic_address: "0225:552100554", status: "active", siren: "000000001" } }) }))
vi.mock("@/lib/pa/outbound", async (orig) => ({
  ...(await orig<typeof import("@/lib/pa/outbound")>()),
  reserveOutbound: async () => { m.steps.push("réservation"); return m.reserve },
  markFailed: async (_a: unknown, _id: string, text: string) => { m.failed.push(text); return true },
  markDeposited: async (_a: unknown, _r: unknown, input: Record<string, unknown>) => { m.deposited.push(input); return true },
}))
vi.mock("@/lib/pa/deposit", async (orig) => ({ ...(await orig<typeof import("@/lib/pa/deposit")>()), obtainToken: async () => { m.steps.push("jeton"); return m.token } }))
vi.mock("@/lib/pa/superpdp/api", async (orig) => ({
  ...(await orig<typeof import("@/lib/pa/superpdp/api")>()),
  createSuperPdpApi: () => ({
    company: async () => ({ id: 1, number: m.platformNumber }),
    validateInvoice: async () => { m.steps.push("contrôle plateforme"); return m.validation },
    depositInvoice: async () => { m.steps.push("dépôt"); return m.deposit!() },
  }),
}))
vi.mock("@/lib/utils/document-numbering", async (orig) => ({
  ...(await orig<typeof import("@/lib/utils/document-numbering")>()),
  issueDraftInvoice: async () => { m.steps.push("émission"); return { data: { ...m.invoice, status: "sent", invoice_number: "F-2026-007" }, error: null } },
}))
vi.mock("@/lib/pdf/invoice", () => ({ generateInvoicePdf: async (input: never) => { m.pdfInput = input; m.steps.push("pdf"); return new Uint8Array([37, 80, 68, 70]) } }))

import { POST } from "@/app/api/invoices/[id]/send/route"

const params = { params: Promise.resolve({ id: "inv-1" }) }
const req = (body: unknown) => new NextRequest("http://localhost/api", { method: "POST", body: JSON.stringify(body) })
const ADDRESS = "0225:443061841"
const send = () => POST(req({ channel: "platform", address: ADDRESS }), params)

beforeEach(() => {
  Object.assign(m, { steps: [], updates: [], failed: [], deposited: [], pdfInput: null, platformNumber: "000000001", validation: { valid: true, failures: [] } })
  m.invoice = { id: "inv-1", status: "draft", invoice_number: null, client: { name: "SCI Les Tilleuls", email: null, siren: "443061841" } }
  m.options = { ok: true, mode: "test", options: { platform: { offered: true, addresses: [{ identifier: ADDRESS, main: true }], defaultAddress: ADDRESS, sender: "0225:552100554", manualEntry: false }, email: { offered: false, to: null }, recommended: "platform", connected: true } }
  m.reserve = { ok: true, row: { id: "o1", attempt: 1, events: [] } }
  m.token = { ok: true, token: "tok" }
  m.deposit = async () => ({ id: 1700500, events: [{ id: 1, invoice_id: 1700500, status_code: "api:uploaded", created_at: "2026-11-03T12:00:00Z" }] })
})

describe("envoi par la plateforme", () => {
  it("réussite : contrôle, réservation, jeton, émission, PDF, dépôt, statut ; aucun email", async () => {
    const res = await send()
    expect(res.status).toBe(200)
    expect(await res.json()).toMatchObject({ success: true, channel: "platform", sentTo: ADDRESS, invoice: { invoice_number: "F-2026-007", status: "sent" } })
    expect(m.steps).toEqual(["contrôle", "réservation", "jeton", "émission", "pdf", "contrôle plateforme", "dépôt", "statut"])
    expect((m.pdfInput!.invoice.client as Record<string, unknown>).electronic_address).toBe(ADDRESS)
    expect(m.pdfInput!.company.electronic_address).toBe("0225:552100554")
    // Bac à sable : vendeur = entreprise raccordée, au numéro fictif de Super PDP
    expect(m.pdfInput!.company).toMatchObject({ siren: "000000001", siret: null, vat_number: "FR15000000001" })
    expect(m.deposited[0]).toMatchObject({ platformInvoiceId: 1700500, documentNumber: "F-2026-007" })
  })

  it("production : SIREN de l'entreprise ≠ entreprise raccordée chez Super PDP : 409 avant toute émission", async () => {
    m.options = { ...(m.options as object), mode: "live" }
    m.platformNumber = "853322915"
    const res = await send()
    expect(res.status).toBe(409)
    expect((await res.json()).error).toContain("Paramètres › Entreprise")
    expect(m.steps).toEqual(["contrôle", "réservation", "jeton"])
    expect(m.failed).toHaveLength(1)
  })

  it("adresse hors de l'annuaire : 409, rien de réservé ni d'émis", async () => {
    const res = await POST(req({ channel: "platform", address: "0225:443061841_AUTRE" }), params)
    expect(res.status).toBe(409)
    expect(m.steps).toEqual(["contrôle"])
  })

  it("plateforme non proposée : la raison, rien d'émis", async () => {
    m.options = { ok: true, mode: "live", options: { platform: { offered: false, reason: "disabled" }, email: { offered: false, to: null }, recommended: "email", connected: true } }
    const res = await send()
    expect(res.status).toBe(409)
    expect((await res.json()).error).toContain("pas encore ouvert")
    expect(m.steps).toEqual(["contrôle"])
  })

  it("envoi déjà en cours : 409, rien d'émis", async () => {
    m.reserve = { ok: false, reason: "in_progress" }
    expect((await send()).status).toBe(409)
    expect(m.steps).not.toContain("émission")
  })

  it("jeton indisponible : 503, la facture reste un brouillon (aucun numéro)", async () => {
    m.token = { ok: false, reason: "busy", error: "Votre raccordement est en cours de mise à jour. Réessayez dans un instant." }
    const res = await send()
    expect(res.status).toBe(503)
    expect(m.steps).toEqual(["contrôle", "réservation", "jeton"])
    expect(m.failed).toHaveLength(1)
  })

  it("dépôt refusé après l'émission : facture émise, raison lisible, à renvoyer", async () => {
    m.deposit = async () => { throw new ApiError(400, "Super PDP 400 : pre-check: receiver address <0225:443061841> does not exist in peppol directory") }
    const res = await send()
    expect(res.status).toBe(502)
    const json = await res.json()
    expect(json).toMatchObject({ issued: true, invoice: { invoice_number: "F-2026-007" } })
    expect(json.error).toContain("F-2026-007 est émise")
    expect(json.error).toContain("n'existe pas dans l'annuaire")
    expect(m.updates).toEqual([])
    expect(m.failed[0]).toContain("n'existe pas dans l'annuaire")
  })

  it("contrôle de Super PDP refusé : rien n'est déposé, la raison est dite", async () => {
    m.validation = { valid: false, failures: ["BR-FR-05/BT-22 : La mention relative aux pénalités de retard (code PMD) est absente."] }
    const res = await send()
    expect(res.status).toBe(502)
    expect((await res.json()).error).toContain("BR-FR-05")
    expect(m.steps).not.toContain("dépôt")
    expect(m.failed[0]).toContain("contrôle de la plateforme")
  })

  it("doublon chez Super PDP (essai précédent interrompu) : la facture déjà déposée est reprise", async () => {
    m.deposit = async () => { throw new ApiError(400, "Super PDP 400 : La facture est déjà existante (id 1700416)") }
    const res = await send()
    expect(res.status).toBe(200)
    expect(m.deposited[0]).toMatchObject({ platformInvoiceId: 1700416 })
  })

  it("renvoi d'une facture déjà émise (après un échec) : pas de nouvelle émission", async () => {
    m.invoice = { ...m.invoice, status: "sent", invoice_number: "F-2026-007" }
    const res = await send()
    expect(res.status).toBe(200)
    expect(m.steps).not.toContain("émission")
  })
})

describe("erreurs de Super PDP", () => {
  it("doublon reconnu, autre erreur non", () => {
    expect(duplicateIdOf(new ApiError(400, "Super PDP 400 : La facture est déjà existante (id 42)"))).toBe(42)
    expect(duplicateIdOf(new ApiError(400, "Super PDP 400 : autre"))).toBeNull()
    expect(duplicateIdOf(new Error("x"))).toBeNull()
  })
  it("phrases pour l'artisan", () => {
    expect(depositErrorText(new ApiError(0, "Super PDP ne répond pas."))).toContain("ne répond pas")
    expect(depositErrorText(new ApiError(403, "Super PDP 403"))).toContain("renouvelez")
    expect(depositErrorText(new ApiError(503, "Super PDP 503"))).toContain("Réessayez")
    expect(depositErrorText(new ApiError(400, "Super PDP 400 : champ BT-1 manquant"))).toBe("Super PDP a refusé la facture : champ BT-1 manquant")
  })
})
