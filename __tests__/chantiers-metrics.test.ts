/**
 * Tests pour lib/chantiers/metrics.ts (pages Chantiers).
 */
import { describe, it, expect } from 'vitest'
import { chantierMetrics, cleanLots, type ChantierDoc } from '@/lib/chantiers/metrics'

const doc = (status: string, ht: number): ChantierDoc => ({ id: status + ht, number: 'X', status, issue_date: '2026-10-01', subtotal_ht: ht, total_ttc: Math.round(ht * 120) / 100 })

describe('chantierMetrics', () => {
  it('prend le marché sur les lots en priorité', () => {
    const m = chantierMetrics({
      lots: [{ label: 'Doublages', amount_ht: 14200 }, { label: 'Cloisons', amount_ht: 11800 }],
      quotes: [doc('accepted', 99999)],
      invoices: [doc('paid', 6500), doc('sent', 6500), doc('draft', 3000), doc('cancelled', 1000)],
      retenue_garantie: true, retenue_rate: 5,
    })
    expect(m).toEqual({
      marketHt: 26000, marketFrom: 'lots',
      invoicedHt: 13000, invoicedTtc: 15600, paidTtc: 7800,
      remainingHt: 13000, progress: 50, retenueTtc: 780,
    })
  })

  it('se rabat sur les devis acceptés sans lots', () => {
    const m = chantierMetrics({ lots: [], quotes: [doc('accepted', 4000), doc('sent', 9000)], invoices: [doc('sent', 1000)], retenue_garantie: false, retenue_rate: 5 })
    expect(m.marketHt).toBe(4000)
    expect(m.marketFrom).toBe('quotes')
    expect(m.progress).toBe(25)
    expect(m.retenueTtc).toBe(0)
  })

  it('ne dépasse jamais 100 % ni un reste négatif', () => {
    const m = chantierMetrics({ lots: [{ label: 'Lot', amount_ht: 1000 }], quotes: [], invoices: [doc('sent', 1200)], retenue_garantie: false, retenue_rate: 5 })
    expect(m.progress).toBe(100)
    expect(m.remainingHt).toBe(0)
  })

  it('gère un chantier vide', () => {
    expect(chantierMetrics({ lots: [], quotes: [], invoices: [], retenue_garantie: true, retenue_rate: 5 })).toMatchObject({ marketHt: 0, marketFrom: 'none', progress: 0 })
  })
})

describe('cleanLots', () => {
  it('accepte la saisie française et écarte les lignes vides', () => {
    expect(cleanLots([
      { label: ' Dépose ', amount_ht: '9 500,50' },
      { label: '', amount_ht: '100' },
      { label: 'Sans montant', amount_ht: '' },
      { label: 'Plafonds', amount_ht: 1200 },
    ])).toEqual([{ label: 'Dépose', amount_ht: 9500.5 }, { label: 'Plafonds', amount_ht: 1200 }])
  })
})
