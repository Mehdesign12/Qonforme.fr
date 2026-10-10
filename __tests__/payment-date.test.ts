/**
 * Date de paiement des factures (lib/utils/payment-date.ts) et « encaissé » du
 * tableau de bord (components/dashboard/model.ts) : seuls les paiements datés
 * comptent, dans la période choisie, à l'heure de Paris.
 */
import { describe, expect, it } from "vitest"
import { paidAtChange } from "@/lib/utils/payment-date"
import { buildDashboardView } from "@/components/dashboard/model"

const now = new Date("2026-10-10T16:30:00Z")
const base = { issueDate: "2026-09-01", today: "2026-10-10", now }

describe("date de paiement", () => {
  it("posée au passage à « payée » : aujourd'hui par défaut, ou le jour choisi", () => {
    expect(paidAtChange({ ...base, from: "sent", to: "paid" })).toEqual({ ok: true, value: now.toISOString() })
    expect(paidAtChange({ ...base, from: "overdue", to: "paid", requested: "2026-10-10" })).toEqual({ ok: true, value: now.toISOString() })
    expect(paidAtChange({ ...base, from: "sent", to: "paid", requested: "2026-10-02" })).toEqual({ ok: true, value: "2026-10-02T12:00:00.000Z" })
  })

  it("refuse une date future, mal formée ou bien antérieure à la facture", () => {
    expect(paidAtChange({ ...base, from: "sent", to: "paid", requested: "2026-10-11" }).ok).toBe(false)
    expect(paidAtChange({ ...base, from: "sent", to: "paid", requested: "02/10/2026" }).ok).toBe(false)
    expect(paidAtChange({ ...base, from: "sent", to: "paid", requested: "2026-07-03" }).ok).toBe(true)  // 60 jours avant la facture
    expect(paidAtChange({ ...base, from: "sent", to: "paid", requested: "2026-07-02" }).ok).toBe(false) // 61 jours
  })

  it("effacée quand la facture revient à « envoyée » ou « en retard », inchangée sinon", () => {
    expect(paidAtChange({ ...base, from: "paid", to: "sent" })).toEqual({ ok: true, value: null })
    expect(paidAtChange({ ...base, from: "paid", to: "overdue" })).toEqual({ ok: true, value: null })
    expect(paidAtChange({ ...base, from: "paid", to: "paid" })).toEqual({ ok: true, value: undefined })
    expect(paidAtChange({ ...base, from: "sent", to: "overdue" })).toEqual({ ok: true, value: undefined })
  })
})

describe("tableau de bord : encaissé de la période", () => {
  const input = (period: "mois" | "trimestre" | "annee", paid: { total_ttc: number; paid_at?: string | null }[]) => ({
    mode: "demo" as const, period, today: "2026-10-10", firstName: "A", company: null, counts: { invoices: 3, quotes: 0 },
    issued: [], open: [], drafts: [], recent: [], quotes: [], clientsWithoutSiren: 0,
    paid: paid.map((p) => ({ ...p, client_id: null, client_name: null })),
  })

  it("aucun paiement daté : pas d'encaissé affiché", () => {
    expect(buildDashboardView(input("mois", [{ total_ttc: 500 }])).kpi.collected).toBeNull()
  })

  it("compte les paiements datés de la période, à l'heure de Paris", () => {
    const paid = [
      { total_ttc: 1000, paid_at: "2026-10-02T12:00:00.000Z" },
      { total_ttc: 300, paid_at: "2026-09-30T22:30:00.000Z" }, // 1er octobre 0 h 30 à Paris
      { total_ttc: 200, paid_at: "2026-09-15T12:00:00.000Z" },
      { total_ttc: 900, paid_at: "2026-02-01T12:00:00.000Z" },
      { total_ttc: 5000 },                                      // marquée payée sans date : jamais comptée
    ]
    expect(buildDashboardView(input("mois", paid)).kpi.collected).toEqual({ amount: 1300, count: 2, label: "ce mois" })
    expect(buildDashboardView(input("trimestre", paid)).kpi.collected).toEqual({ amount: 1300, count: 2, label: "ce trimestre" })
    expect(buildDashboardView(input("annee", paid)).kpi.collected).toEqual({ amount: 2400, count: 4, label: "cette année" })
  })
})
