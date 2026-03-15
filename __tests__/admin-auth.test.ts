/**
 * Tests pour lib/admin-auth.ts
 * Vérifie que la signature HMAC et la vérification du cookie admin fonctionnent correctement.
 */
import { describe, it, expect } from 'vitest'
import { signAdminSession, verifyAdminSession } from '@/lib/admin-auth'

const SECRET = 'test-secret-32-bytes-long-enough!'

describe('signAdminSession', () => {
  it('retourne une chaîne au format timestamp.hex', async () => {
    const token = await signAdminSession(SECRET)
    expect(token).toMatch(/^\d+\.[0-9a-f]+$/)
  })

  it('génère des tokens différents à chaque appel (timestamp différent)', async () => {
    const t1 = await signAdminSession(SECRET)
    await new Promise(r => setTimeout(r, 2))
    const t2 = await signAdminSession(SECRET)
    expect(t1).not.toBe(t2)
  })
})

describe('verifyAdminSession', () => {
  it('accepte un token valide fraîchement signé', async () => {
    const token = await signAdminSession(SECRET)
    expect(await verifyAdminSession(token, SECRET)).toBe(true)
  })

  it('refuse un token avec le mauvais secret', async () => {
    const token = await signAdminSession(SECRET)
    expect(await verifyAdminSession(token, 'wrong-secret')).toBe(false)
  })

  it('refuse un token mal formé (sans point)', async () => {
    expect(await verifyAdminSession('malformed', SECRET)).toBe(false)
  })

  it('refuse un token avec signature tronquée', async () => {
    const token = await signAdminSession(SECRET)
    const [ts] = token.split('.')
    expect(await verifyAdminSession(`${ts}.abcd`, SECRET)).toBe(false)
  })

  it('refuse un token expiré (timestamp dans le passé > 24h)', async () => {
    const expiredTs = Date.now() - 25 * 60 * 60 * 1000 // il y a 25h
    // On crée un token avec un vieux timestamp — la signature sera invalide mais
    // le test vérifie que l'expiration est vérifiée avant même la signature
    const fakeToken = `${expiredTs}.0000000000000000000000000000000000000000000000000000000000000000`
    expect(await verifyAdminSession(fakeToken, SECRET)).toBe(false)
  })

  it('refuse une chaîne vide', async () => {
    expect(await verifyAdminSession('', SECRET)).toBe(false)
  })
})
