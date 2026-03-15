/**
 * Tests pour la logique du middleware Supabase.
 * Vérifie la règle critique : distinguer "aucune ligne" (PGRST116) d'une vraie erreur réseau.
 * Documente le bug connu (voir CLAUDE.md).
 */
import { describe, it, expect } from 'vitest'

// Reproduit la logique du middleware sans dépendance à Next.js
function shouldRedirectToPricing(
  data: unknown | null,
  error: { code: string; message: string } | null,
): boolean {
  // Erreur technique (réseau, timeout, etc.) → laisser passer
  if (error && error.code !== 'PGRST116') return false
  // Aucune ligne trouvée → rediriger
  if (!data) return true
  return false
}

describe('Middleware — logique de redirection abonnement', () => {
  it('redirige si aucun abonnement trouvé (PGRST116)', () => {
    expect(shouldRedirectToPricing(null, { code: 'PGRST116', message: 'no rows' })).toBe(true)
  })

  it('redirige si data null sans erreur', () => {
    expect(shouldRedirectToPricing(null, null)).toBe(true)
  })

  it('ne redirige PAS si erreur réseau (pas PGRST116)', () => {
    expect(shouldRedirectToPricing(null, { code: '500', message: 'network timeout' })).toBe(false)
  })

  it('ne redirige PAS si abonnement présent', () => {
    expect(shouldRedirectToPricing({ id: 'sub_123', status: 'active' }, null)).toBe(false)
  })

  it('ne redirige PAS si erreur Supabase générique', () => {
    expect(shouldRedirectToPricing(null, { code: 'PGRST301', message: 'jwt expired' })).toBe(false)
  })
})
