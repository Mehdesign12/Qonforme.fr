/**
 * Tests pour les fonctions de formatage du FEC (Fichier des Écritures Comptables).
 * Vérifie que les montants et dates respectent le format DGFiP.
 */
import { describe, it, expect } from 'vitest'

// ── Fonctions de formatage extraites de lib/export/fec.ts ────────────────────
// On les teste ici sans dépendance à l'export complet

function fmtDate(iso: string): string {
  return iso.replace(/-/g, '').slice(0, 8) // YYYYMMDD
}

function fmtAmount(n: number): string {
  return n.toFixed(2).replace('.', ',')
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('FEC — formatage de dates', () => {
  it('convertit une date ISO en YYYYMMDD', () => {
    expect(fmtDate('2026-03-15')).toBe('20260315')
  })

  it('ignore la partie heure si présente', () => {
    expect(fmtDate('2026-01-01T00:00:00.000Z')).toBe('20260101')
  })
})

describe('FEC — formatage des montants', () => {
  it('formate un entier avec 2 décimales et virgule', () => {
    expect(fmtAmount(1200)).toBe('1200,00')
  })

  it('formate un décimal avec virgule', () => {
    expect(fmtAmount(99.9)).toBe('99,90')
  })

  it('formate zéro correctement', () => {
    expect(fmtAmount(0)).toBe('0,00')
  })

  it('arrondit correctement à 2 décimales', () => {
    expect(fmtAmount(10.005)).toBe('10,01')
  })
})

describe('FEC — règles métier', () => {
  it('le séparateur décimal est une virgule (norme DGFiP)', () => {
    const amount = fmtAmount(1234.56)
    expect(amount).not.toContain('.')
    expect(amount).toContain(',')
  })

  it('la date ne contient aucun tiret (norme DGFiP)', () => {
    const date = fmtDate('2026-12-31')
    expect(date).not.toContain('-')
    expect(date).toHaveLength(8)
  })
})
