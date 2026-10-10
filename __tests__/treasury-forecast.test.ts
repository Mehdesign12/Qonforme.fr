/**
 * Tests pour lib/treasury/forecast.ts (page Trésorerie).
 *
 * Vérifie le classement des factures ouvertes en retard / à échoir / au-delà de
 * l'horizon, la déduction des avoirs partiels, le découpage par semaine (lundi →
 * dimanche) et l'ordre de l'échéancier.
 */
import { describe, it, expect } from 'vitest'
import { buildForecast, mondayOf, addDays, daysBetween, amountDue, type ForecastInvoice } from '@/lib/treasury/forecast'

const TODAY = '2026-10-14' // un mercredi

const inv = (id: string, due: string, ttc: number, extra: Partial<ForecastInvoice> = {}): ForecastInvoice => ({
  id, invoice_number: 'F-2026-' + id, client_name: 'Client ' + id, due_date: due, total_ttc: ttc, status: 'sent', ...extra,
})

describe('dates', () => {
  it('trouve le lundi de la semaine, dimanche compris', () => {
    expect(mondayOf('2026-10-14')).toBe('2026-10-12')
    expect(mondayOf('2026-10-12')).toBe('2026-10-12')
    expect(mondayOf('2026-10-18')).toBe('2026-10-12') // dimanche
  })

  it('compte les jours sans être piégé par le passage à l’heure d’hiver', () => {
    expect(addDays('2026-10-24', 2)).toBe('2026-10-26')
    expect(daysBetween('2026-10-24', '2026-10-26')).toBe(2)
  })
})

describe('amountDue', () => {
  it('déduit les avoirs et ne descend jamais sous zéro', () => {
    expect(amountDue({ total_ttc: 1200, credited_ttc: 200 })).toBe(1000)
    expect(amountDue({ total_ttc: 1200, credited_ttc: 1500 })).toBe(0)
  })
})

describe('buildForecast', () => {
  const invoices = [
    inv('001', '2026-08-20', 500),                       // 55 jours de retard
    inv('002', '2026-10-13', 300),                       // échue hier
    inv('003', '2026-10-14', 1000),                      // échoit aujourd'hui : pas en retard
    inv('004', '2026-10-18', 200),                       // dimanche, semaine en cours
    inv('005', '2026-10-19', 700),                       // semaine suivante
    inv('006', '2026-11-20', 900),                       // au-delà de 30 jours
    inv('007', '2026-10-20', 400, { status: 'paid' }),   // réglée : ignorée
    inv('008', '2026-10-20', 400, { status: 'draft' }),  // brouillon : ignoré
    inv('009', '2026-10-21', 600, { credited_ttc: 600 }), // soldée par avoir : ignorée
    inv('010', '2026-10-22', 1000, { credited_ttc: 250, status: 'overdue' }),
  ]
  const f = buildForecast(invoices, TODAY, 30)

  it('sépare retards, échéances de l’horizon et le reste', () => {
    expect(f.overdue).toEqual({ amount: 800, count: 2, over30: 500 })
    expect(f.dueInHorizon).toEqual({ amount: 2650, count: 4 })
    expect(f.later).toEqual({ amount: 900, count: 1 })
    expect(f.totalOpen).toEqual({ amount: 4350, count: 7 })
  })

  it('compte la semaine en cours jusqu’au dimanche', () => {
    expect(f.thisWeek).toEqual({ amount: 1200, count: 2 })
  })

  it('découpe l’horizon en semaines contiguës du lundi au dimanche', () => {
    expect(f.weeks[0]).toEqual({ start: '2026-10-12', end: '2026-10-18', amount: 1200, count: 2 })
    expect(f.weeks[1]).toEqual({ start: '2026-10-19', end: '2026-10-25', amount: 1450, count: 2 })
    expect(f.weeks.at(-1)!.start <= addDays(TODAY, 30)).toBe(true)
    expect(f.weeks.at(-1)!.end >= addDays(TODAY, 30)).toBe(true)
    expect(f.weeks.reduce((s, w) => s + w.amount, 0)).toBe(f.dueInHorizon.amount)
  })

  it('liste les retards d’abord, les plus anciens en tête, puis les échéances', () => {
    expect(f.schedule.map((s) => s.id)).toEqual(['001', '002', '003', '004', '005', '010'])
    expect(f.schedule[0]).toMatchObject({ overdue: true, daysLate: 55 })
    expect(f.schedule[2]).toMatchObject({ overdue: false, daysLate: 0 })
  })

  it('élargit l’horizon à 90 jours', () => {
    const g = buildForecast(invoices, TODAY, 90)
    expect(g.later.count).toBe(0)
    expect(g.dueInHorizon.amount).toBe(3550)
    expect(g.weeks.length).toBe(14)
  })
})
