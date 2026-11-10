import { describe, expect, it } from "vitest"
import { countNew, eventAt, isNewLine, isNewSignup, markSeen, parseSeen, serializeSeen } from "@/lib/affiliation/news"

const P = "11111111-1111-4111-8111-111111111111"
const day = 86_400_000
const line = (over: Record<string, unknown> = {}) => ({ partner_id: P, display: "pending" as const, paid_at: "2026-11-10T10:00:00Z", created_at: "2026-11-10T10:00:05Z", voided_at: null, ...over })

describe("nouveaux événements de l'affiliation", () => {
  it("une commission jamais vue est nouvelle, puis plus après la visite de son onglet", () => {
    const seen = parseSeen(null)
    expect(isNewLine(line(), seen)).toBe(true)
    const after = markSeen(seen, { commissions: ["pending"] }, Date.parse("2026-11-10T12:00:00Z"))
    expect(isNewLine(line(), after)).toBe(false)
    // devenue « à verser » 30 jours après le paiement : nouvel événement
    expect(isNewLine(line({ display: "due" }), after)).toBe(true)
    expect(eventAt(line({ display: "due" }))).toBe(Date.parse("2026-11-10T10:00:00Z") + 30 * day)
  })

  it("annulée : nouvelle à la date d'annulation ; versée : jamais", () => {
    const seen = markSeen(parseSeen(null), { commissions: ["void"] }, Date.parse("2026-11-11T00:00:00Z"))
    expect(isNewLine(line({ display: "void", voided_at: "2026-11-12T00:00:00Z" }), seen)).toBe(true)
    expect(isNewLine(line({ display: "paid_out" }), parseSeen(null))).toBe(false)
  })

  it("la fiche du partenaire vaut visite pour ses commissions, son aperçu pour ses inscrits", () => {
    const now = Date.parse("2026-11-11T00:00:00Z")
    const seen = markSeen(parseSeen(null), { partnerCommissions: P }, now)
    expect(isNewLine(line(), seen)).toBe(false)
    expect(isNewSignup({ partner_id: P, signed_up_at: "2026-11-10T00:00:00Z" }, seen)).toBe(true)
    const seen2 = markSeen(seen, { partnerSignups: P }, now)
    expect(isNewSignup({ partner_id: P, signed_up_at: "2026-11-10T00:00:00Z" }, seen2)).toBe(false)
  })

  it("le cookie se relit sans confiance et garde ses dates", () => {
    expect(parseSeen("%%%")).toEqual({ c: {}, p: {}, q: {} })
    expect(parseSeen(encodeURIComponent(JSON.stringify({ c: { due: "x" }, p: { "pas-un-id": 5 } })))).toEqual({ c: {}, s: undefined, p: {}, q: {} })
    const seen = markSeen(parseSeen(null), { commissions: ["due"], signups: true, partnerCommissions: P }, 1_700_000_000_000)
    expect(parseSeen(serializeSeen(seen))).toEqual(seen)
  })

  it("compte par onglet", () => {
    const c = countNew([line(), line({ display: "due" }), line({ display: "paid_out" })], parseSeen(null))
    expect(c).toEqual({ due: 1, pending: 1, void: 0, total: 2 })
  })
})
