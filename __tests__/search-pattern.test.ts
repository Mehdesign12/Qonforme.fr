/**
 * Tests pour lib/search/types.ts (palette ⌘K) : la saisie est toujours du
 * texte littéral, jamais un motif SQL.
 */
import { describe, it, expect } from 'vitest'
import { fold, likePattern } from '@/lib/search/types'

describe('likePattern', () => {
  it('encadre la saisie de jokers', () => {
    expect(likePattern('Dupont')).toBe('%Dupont%')
  })
  it('échappe % _ et la barre oblique inverse', () => {
    expect(likePattern('50%_a\\b')).toBe('%50\\%\\_a\\\\b%')
  })
  it('laisse passer virgules et parenthèses telles quelles (requêtes .ilike, pas .or)', () => {
    expect(likePattern('Martin, (SARL)')).toBe('%Martin, (SARL)%')
  })
})

describe('fold', () => {
  it('ignore la casse et les accents', () => {
    expect(fold('  Électricité ')).toBe('electricite')
  })
})
