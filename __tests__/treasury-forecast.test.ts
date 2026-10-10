/**
 * Tests pour lib/treasury/forecast.ts (page Trésorerie) : classement des
 * factures émises et reçues en retard / dans l'horizon / au-delà, déduction des
 * avoirs et de la retenue de garantie, échéance par défaut d'une facture reçue,
 * découpage par semaine (lundi → dimanche), solde et ordre de l'échéancier.
 */
import { describe, it, expect } from 'vitest'
import {
  buildForecast, mondayOf, payableOf, receivableOf, type ForecastInvoice, type ForecastPayable,
} from '@/lib/treasury/forecast'

const TODAY = '2026-10-14' // un mercredi

const inv = (id: string, due: string, ttc: number, extra: Partial<ForecastInvoice> = {}): ForecastInvoice => ({
  id, invoice_number: 'F-2026-' + id, client_name: 'Client ' + id, due_date: due, total_ttc: ttc, status: 'sent', ...extra,
})
const pay = (id: string, due: string | null, amount: number, extra: Partial<ForecastPayable> = {}): ForecastPayable => ({
  id, invoice_number: 'FR-' + id, supplier_name: 'Fournisseur ' + id, issue_date: '2026-10-01', due_date: due, amount_due: amount, credit: false, ...extra,
})

describe('montants', () => {
  it('déduit avoirs et retenue de garantie, jamais sous zéro', () => {
    expect(receivableOf({ total_ttc: 1200, credited_ttc: 200, retention_ttc: 50 })).toBe(950)
    expect(receivableOf({ total_ttc: 1200, credited_ttc: 1500 })).toBe(0)
  })
  it('compte un avoir fournisseur en négatif', () => {
    expect(payableOf({ amount_due: 300, credit: false })).toBe(300)
    expect(payableOf({ amount_due: 300, credit: true })).toBe(-300)
  })
  it('trouve le lundi, dimanche compris', () => {
    expect(mondayOf('2026-10-14')).toBe('2026-10-12')
    expect(mondayOf('2026-10-18')).toBe('2026-10-12')
  })
})

describe('buildForecast', () => {
  const invoices = [
    inv('001', '2026-08-20', 500),                         // 55 jours de retard
    inv('002', '2026-10-13', 300),                         // échue hier
    inv('003', '2026-10-14', 1000),                        // échoit aujourd'hui : pas en retard
    inv('004', '2026-10-18', 200),                         // dimanche, semaine en cours
    inv('005', '2026-10-19', 700, { retention_ttc: 35 }),  // semaine suivante, retenue de 5 %
    inv('006', '2026-11-20', 900),                         // au-delà de 30 jours
    inv('007', '2026-10-20', 400, { status: 'paid' }),     // réglée : ignorée
    inv('008', '2026-10-20', 400, { status: 'draft' }),    // brouillon : ignoré
    inv('009', '2026-10-21', 600, { credited_ttc: 600 }),  // soldée par avoir : ignorée
  ]
  const payables = [
    pay('a', '2026-10-05', 250),                 // fournisseur en retard
    pay('b', '2026-10-16', 400),                 // cette semaine
    pay('c', null, 120),                         // sans échéance : 1er oct. + 30 j = 31 oct.
    pay('d', '2026-10-16', 50, { credit: true }), // avoir fournisseur
    pay('e', '2026-12-30', 999),                 // au-delà de l'horizon
  ]
  const f = buildForecast(invoices, payables, TODAY, 30)

  it('classe les factures émises', () => {
    expect(f.inflow.overdue).toEqual({ amount: 800, count: 2, over30: 500 })
    expect(f.inflow.inHorizon).toEqual({ amount: 1865, count: 3 })
    expect(f.inflow.thisWeek).toEqual({ amount: 1200, count: 2 })
    expect(f.inflow.later).toEqual({ amount: 900, count: 1 })
    expect(f.inflow.total).toEqual({ amount: 3565, count: 6 })
  })

  it('classe les factures reçues, avoirs déduits, échéance par défaut à 30 jours', () => {
    expect(f.outflow.overdue).toEqual({ amount: 250, count: 1 })
    expect(f.outflow.inHorizon).toEqual({ amount: 470, count: 3 })
    expect(f.outflow.later).toEqual({ amount: 999, count: 1 })
    const c = f.schedule.find((s) => s.id === 'c')!
    expect(c).toMatchObject({ due_date: '2026-10-31', assumedDue: true, kind: 'out' })
  })

  it('calcule le solde de l’horizon (sorties en retard comprises)', () => {
    expect(f.net).toBe(1865 - 470 - 250)
  })

  it('découpe en semaines contiguës, entrées et sorties', () => {
    expect(f.weeks[0]).toMatchObject({ start: '2026-10-12', end: '2026-10-18', in: 1200, out: 350, inCount: 2, outCount: 2 })
    expect(f.weeks[1]).toMatchObject({ start: '2026-10-19', in: 665, out: 0 })
    expect(f.weeks.reduce((s, w) => s + w.in, 0)).toBe(f.inflow.inHorizon.amount)
    expect(f.weeks.reduce((s, w) => s + w.out, 0)).toBe(f.outflow.inHorizon.amount)
  })

  it('liste les retards d’abord, puis les échéances par date', () => {
    expect(f.schedule.slice(0, 3).map((s) => s.id)).toEqual(['001', 'a', '002'])
    expect(f.schedule[0]).toMatchObject({ daysLate: 55, kind: 'in' })
    expect(f.schedule.slice(3).map((s) => s.id)).toEqual(['003', 'b', 'd', '004', '005', 'c'])
  })

  it('élargit l’horizon à 90 jours', () => {
    const g = buildForecast(invoices, payables, TODAY, 90)
    expect(g.inflow.later.count).toBe(0)
    expect(g.outflow.inHorizon.amount).toBe(470 + 999)
    expect(g.weeks).toHaveLength(14)
  })
})
