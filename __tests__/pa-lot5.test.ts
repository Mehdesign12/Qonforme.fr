/**
 * Lot 5 de l'émission par la plateforme agréée : déclaration de l'encaissement
 * (fr:212) quand l'artisan marque la facture payée, et avoirs qui suivent le
 * chemin de leur facture.
 */
import { beforeEach, describe, expect, it, vi } from "vitest"

const claim = vi.fn()
const confirm = vi.fn()
const release = vi.fn()
const apply = vi.fn()
const token = vi.fn()
vi.mock("@/lib/pa/outbound", async (orig) => ({
  ...(await orig<typeof import("@/lib/pa/outbound")>()),
  claimPaymentReport: (...a: unknown[]) => claim(...a),
  confirmPaymentReported: (...a: unknown[]) => confirm(...a),
  releasePaymentReport: (...a: unknown[]) => release(...a),
  applyOutboundEvents: (...a: unknown[]) => apply(...a),
}))
vi.mock("@/lib/pa/deposit", () => ({ obtainToken: (...a: unknown[]) => token(...a) }))

import { PAYMENT_STATUS_CODE, reportPaymentFor } from "@/lib/pa/payment"
import { creditNotePlatformChoice } from "@/lib/pa/credit-note-delivery"
import type { OutboundRow } from "@/lib/pa/outbound"

const row = (over: Partial<OutboundRow> = {}): OutboundRow => ({
  id: "o1", user_id: "u1", provider: "superpdp", mode: "test", document_type: "invoice", document_id: "inv1",
  document_number: "F-2026-011", attempt: 2, phase: "sent", platform_invoice_id: 1707070,
  recipient_address: "0225:315143296_117728", sender_address: null, last_status_code: "fr:202", last_status_at: null,
  events: [], error: null, deposited_at: "2026-11-03T13:47:00Z", payment_reported_at: null, payment_event_id: null,
  superseded_at: null, created_at: "2026-11-03T13:46:00Z", updated_at: "2026-11-03T13:48:00Z", ...over,
})
const admin = {} as never

describe("déclaration de l'encaissement (fr:212)", () => {
  beforeEach(() => {
    for (const f of [claim, confirm, release, apply, token]) f.mockReset()
    claim.mockResolvedValue(true)
    confirm.mockResolvedValue(true)
    release.mockResolvedValue(true)
    apply.mockResolvedValue({ updated: 1, changed: [] })
  })

  it("déclare fr:212 sur la facture de la plateforme, puis l'ajoute au parcours", async () => {
    const createEvent = vi.fn().mockResolvedValue({ id: 99, invoice_id: 1707070, status_code: "fr:212", created_at: "2026-11-03T15:00:00Z" })
    const res = await reportPaymentFor(admin, row(), { api: { createEvent } as never })
    expect(res).toEqual({ state: "reported" })
    expect(createEvent).toHaveBeenCalledWith({ invoiceId: 1707070, statusCode: PAYMENT_STATUS_CODE })
    expect(confirm).toHaveBeenCalledWith(admin, "o1", 99)
    expect(apply).toHaveBeenCalled()
    expect(release).not.toHaveBeenCalled()
  })

  it("une seule déclaration : réservation déjà prise, aucun appel", async () => {
    claim.mockResolvedValue(false)
    const createEvent = vi.fn()
    expect(await reportPaymentFor(admin, row(), { api: { createEvent } as never })).toEqual({ state: "already" })
    expect(createEvent).not.toHaveBeenCalled()
  })

  it("déjà déclarée, pas déposée ou rejetée : rien n'est envoyé", async () => {
    const createEvent = vi.fn()
    expect((await reportPaymentFor(admin, row({ payment_reported_at: "x" }), { api: { createEvent } as never })).state).toBe("already")
    expect((await reportPaymentFor(admin, row({ phase: "rejected" }), { api: { createEvent } as never })).state).toBe("not_platform")
    expect((await reportPaymentFor(admin, row({ platform_invoice_id: null }), { api: { createEvent } as never })).state).toBe("not_platform")
    expect(createEvent).not.toHaveBeenCalled()
    expect(claim).not.toHaveBeenCalled()
  })

  it("plateforme en panne : la réservation est rendue (la relève réessaiera)", async () => {
    const createEvent = vi.fn().mockRejectedValue(new Error("Super PDP 503"))
    const res = await reportPaymentFor(admin, row(), { api: { createEvent } as never })
    expect(res.state).toBe("failed")
    expect(release).toHaveBeenCalledWith(admin, "o1")
  })

  it("raccordement indisponible : réservation rendue, aucun appel", async () => {
    token.mockResolvedValue({ ok: false, reason: "busy", error: "occupé" })
    const res = await reportPaymentFor(admin, row())
    expect(res).toEqual({ state: "failed", error: "occupé" })
    expect(release).toHaveBeenCalledWith(admin, "o1")
  })
})

describe("avoir : il suit le chemin de sa facture", () => {
  const inv = { phase: "sent" as const, recipient_address: "0225:315143296_117728", mode: "test" as const }
  const base = { invoiceRow: inv, creditNoteRow: null, connectionActive: true, hasPlan: true, openModes: ["test"] as const }

  it("facture transmise par la plateforme : avoir proposé à la même adresse", () => {
    expect(creditNotePlatformChoice(base)).toEqual({ offered: true, address: inv.recipient_address, mode: "test" })
  })
  it("facture partie par email (ou envoi non abouti) : email", () => {
    expect(creditNotePlatformChoice({ ...base, invoiceRow: null })).toMatchObject({ offered: false, reason: "invoice_by_email" })
    expect(creditNotePlatformChoice({ ...base, invoiceRow: { ...inv, phase: "failed" } })).toMatchObject({ offered: false, reason: "invoice_by_email" })
  })
  it("avoir déjà transmis : pas de second dépôt ; renvoi permis après un échec", () => {
    expect(creditNotePlatformChoice({ ...base, creditNoteRow: { phase: "sent", created_at: "2026-11-03T00:00:00Z" } })).toMatchObject({ reason: "already_sent" })
    expect(creditNotePlatformChoice({ ...base, creditNoteRow: { phase: "failed", created_at: "2026-11-03T00:00:00Z" } })).toMatchObject({ offered: true })
  })
  it("mode fermé, raccordement inactif, sans formule, formule illisible", () => {
    expect(creditNotePlatformChoice({ ...base, openModes: [] })).toMatchObject({ reason: "disabled" })
    expect(creditNotePlatformChoice({ ...base, connectionActive: false })).toMatchObject({ reason: "not_connected" })
    expect(creditNotePlatformChoice({ ...base, hasPlan: false })).toMatchObject({ reason: "no_plan" })
    expect(creditNotePlatformChoice({ ...base, hasPlan: null })).toMatchObject({ reason: "unavailable" })
  })
})
