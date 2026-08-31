/**
 * Tests pour lib/utils/document-numbering.ts.
 *
 * Documente et vérifie le bug corrigé le 2026-08-31 : l'ancien code calculait
 * le "dernier numéro" via `.order(numberColumn, { ascending: false }).limit(1)`,
 * un tri SQL sur une colonne TEXTE. "F-2026-999" est lexicographiquement
 * supérieur à "F-2026-1000" (le caractère '9' > '1'), donc dès qu'une entreprise
 * atteignait 1000 documents dans l'année, le "dernier numéro" restait bloqué à
 * 999 et le document suivant recréait un doublon exact de "F-2026-1000".
 *
 * getNextDocumentNumber() calcule maintenant le vrai maximum numérique côté
 * application, sur l'ensemble des numéros existants — plus de tri texte.
 */
import { describe, it, expect } from 'vitest'
import { getNextDocumentNumber } from '@/lib/utils/document-numbering'
import type { SupabaseClient } from '@supabase/supabase-js'

// Fake client Supabase minimal : la chaîne .from().select().eq().like() est
// "thenable" (comme le vrai PostgrestFilterBuilder), donc awaitable directement.
function fakeSupabase(rows: Record<string, string>[]): SupabaseClient {
  const query = {
    select: () => query,
    eq: () => query,
    like: () => query,
    then: (resolve: (v: { data: typeof rows; error: null }) => void) => resolve({ data: rows, error: null }),
  }
  return { from: () => query } as unknown as SupabaseClient
}

describe('getNextDocumentNumber', () => {
  it('démarre à 001 quand aucun document n\'existe', async () => {
    const supabase = fakeSupabase([])
    const result = await getNextDocumentNumber(supabase, 'invoices', 'invoice_number', 'user1', 'F-2026-')
    expect(result).toBe('F-2026-001')
  })

  it('incrémente normalement en dessous de 1000', async () => {
    const supabase = fakeSupabase([
      { invoice_number: 'F-2026-001' },
      { invoice_number: 'F-2026-002' },
      { invoice_number: 'F-2026-003' },
    ])
    const result = await getNextDocumentNumber(supabase, 'invoices', 'invoice_number', 'user1', 'F-2026-')
    expect(result).toBe('F-2026-004')
  })

  it('ne reproduit PAS le bug de tri texte au passage à 1000 (régression)', async () => {
    // Avec l'ancien tri texte, "F-2026-999" > "F-2026-1000" lexicographiquement :
    // le code buggé aurait renvoyé "F-2026-1000" à nouveau (doublon).
    const supabase = fakeSupabase([
      { invoice_number: 'F-2026-998' },
      { invoice_number: 'F-2026-999' },
      { invoice_number: 'F-2026-1000' },
    ])
    const result = await getNextDocumentNumber(supabase, 'invoices', 'invoice_number', 'user1', 'F-2026-')
    expect(result).toBe('F-2026-1001')
  })

  it('trouve le vrai maximum numérique quelle que soit l\'ordre des lignes', async () => {
    const supabase = fakeSupabase([
      { invoice_number: 'F-2026-042' },
      { invoice_number: 'F-2026-1000' },
      { invoice_number: 'F-2026-005' },
      { invoice_number: 'F-2026-999' },
    ])
    const result = await getNextDocumentNumber(supabase, 'invoices', 'invoice_number', 'user1', 'F-2026-')
    expect(result).toBe('F-2026-1001')
  })

  it('ignore les valeurs non numériques sans planter', async () => {
    const supabase = fakeSupabase([
      { invoice_number: 'F-2026-abc' },
      { invoice_number: 'F-2026-003' },
    ])
    const result = await getNextDocumentNumber(supabase, 'invoices', 'invoice_number', 'user1', 'F-2026-')
    expect(result).toBe('F-2026-004')
  })
})
