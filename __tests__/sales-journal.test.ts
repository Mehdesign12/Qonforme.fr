/**
 * Tests pour lib/export/sales-journal.ts (export CSV du journal des ventes).
 */
import { describe, it, expect } from 'vitest'
import { csvAmount, csvField, generateSalesJournal } from '@/lib/export/sales-journal'
import type { InvoiceLine } from '@/types'

const line = (ht: number, rate: 0 | 5.5 | 10 | 20): InvoiceLine => ({
  id: String(ht), description: 'x', quantity: 1, unit_price_ht: ht, vat_rate: rate,
  total_ht: ht, total_vat: Math.round(ht * rate) / 100, total_ttc: ht + Math.round(ht * rate) / 100,
})

describe('csv', () => {
  it('formate les montants à la française, sans -0', () => {
    expect(csvAmount(1234.5)).toBe('1234,50')
    expect(csvAmount(-0.001)).toBe('0,00')
  })
  it('protège les séparateurs, guillemets et formules', () => {
    expect(csvField('Martin; fils')).toBe('"Martin; fils"')
    expect(csvField('Le "Clos"')).toBe('"Le ""Clos"""')
    expect(csvField('=HYPERLINK("x")')).toBe('"\'=HYPERLINK(""x"")"')
  })
})

describe('generateSalesJournal', () => {
  const csv = generateSalesJournal({
    invoices: [{
      invoice_number: 'F-2026-0002', issue_date: '2026-10-14', status: 'paid',
      lines: [line(1000, 20), line(500, 10)], subtotal_ht: 1500, total_vat: 250, total_ttc: 1750,
      client: { id: 'c1', name: 'Bâti Ouest SAS', siren: '948211375' },
    }, {
      invoice_number: 'F-2026-0001', issue_date: '2026-10-02', status: 'sent',
      lines: [line(200, 5.5)], subtotal_ht: 200, total_vat: 11, total_ttc: 211,
      client: null,
    }],
    creditNotes: [{
      credit_note_number: 'AV-2026-001', issue_date: '2026-10-20',
      lines: [line(100, 20)], subtotal_ht: 100, total_vat: 20, total_ttc: 120,
      client: { id: 'c1', name: 'Bâti Ouest SAS', siren: '948211375' },
    }],
  })
  const rows = csv.replace('﻿', '').trim().split('\r\n')

  it('commence par un BOM et une ligne d’en-tête', () => {
    expect(csv.startsWith('﻿')).toBe(true)
    expect(rows[0].split(';')[0]).toBe('Date')
    expect(rows).toHaveLength(4)
  })

  it('trie par date et ventile la TVA par taux', () => {
    expect(rows[1].split(';').slice(0, 3)).toEqual(['02/10/2026', 'Facture', 'F-2026-0001'])
    expect(rows[1].split(';').slice(9, 11)).toEqual(['200,00', '11,00'])
    expect(rows[2].split(';').slice(5, 9)).toEqual(['1000,00', '200,00', '500,00', '50,00'])
    expect(rows[2].split(';').slice(12)).toEqual(['1500,00', '250,00', '1750,00', 'Payée'])
  })

  it('passe les avoirs en négatif', () => {
    expect(rows[3].split(';').slice(1, 3)).toEqual(['Avoir', 'AV-2026-001'])
    expect(rows[3].split(';').slice(12, 15)).toEqual(['-100,00', '-20,00', '-120,00'])
  })
})
