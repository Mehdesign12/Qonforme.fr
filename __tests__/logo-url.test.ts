/**
 * Tests pour lib/utils/logo-url.ts.
 *
 * Documente et vérifie le correctif SSRF du 2026-08-31 : company.logo_url était
 * fetch()é côté serveur sans validation à chaque génération de PDF. isAllowedLogoUrl()
 * n'accepte que le bucket Supabase Storage public de ce projet (https + même host
 * que NEXT_PUBLIC_SUPABASE_URL) — jamais une URL arbitraire fournie par l'utilisateur.
 */
import { describe, it, expect, beforeAll } from 'vitest'
import { isAllowedLogoUrl } from '@/lib/utils/logo-url'

beforeAll(() => {
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://xxnowrmyyaylvnognifu.supabase.co'
})

describe('isAllowedLogoUrl', () => {
  it('accepte une URL du bucket Storage public du projet', () => {
    expect(isAllowedLogoUrl('https://xxnowrmyyaylvnognifu.supabase.co/storage/v1/object/public/company-assets/logos/u1/logo.png')).toBe(true)
  })

  it('rejette un autre domaine (coeur du SSRF : cible choisie par l\'attaquant)', () => {
    expect(isAllowedLogoUrl('https://evil.example.com/payload.png')).toBe(false)
  })

  it('rejette une adresse de métadonnées cloud interne', () => {
    expect(isAllowedLogoUrl('http://169.254.169.254/latest/meta-data/')).toBe(false)
  })

  it('rejette le protocole http (même sur le bon host)', () => {
    expect(isAllowedLogoUrl('http://xxnowrmyyaylvnognifu.supabase.co/storage/v1/object/public/company-assets/logo.png')).toBe(false)
  })

  it('rejette un schéma non-http (file://, javascript:, etc.)', () => {
    expect(isAllowedLogoUrl('file:///etc/passwd')).toBe(false)
  })

  it('rejette une URL malformée sans planter', () => {
    expect(isAllowedLogoUrl('pas-une-url')).toBe(false)
  })

  it('rejette si NEXT_PUBLIC_SUPABASE_URL est absent', () => {
    const saved = process.env.NEXT_PUBLIC_SUPABASE_URL
    delete process.env.NEXT_PUBLIC_SUPABASE_URL
    expect(isAllowedLogoUrl('https://xxnowrmyyaylvnognifu.supabase.co/storage/v1/object/public/logo.png')).toBe(false)
    process.env.NEXT_PUBLIC_SUPABASE_URL = saved
  })
})
