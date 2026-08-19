/**
 * Tests pour lib/push/apns.ts — signature JWT ES256 utilisée pour l'auth
 * "token-based" d'APNs (une clé .p8, valable pour toute l'app).
 *
 * Sans ce test, une erreur d'encodage (mauvais format de signature, mauvaise
 * variante base64, mauvaises claims) ne serait détectée qu'en production,
 * via un vrai aller-retour raté avec les serveurs Apple — ici on vérifie que
 * la signature produite est authentifiable avec la clé publique
 * correspondante, exactement ce qu'Apple fait de son côté avec notre .p8.
 */
import { describe, it, expect } from 'vitest'
import { generateKeyPairSync, createVerify } from 'node:crypto'
import { signApnsJwt } from '@/lib/push/apns'

function base64urlDecode(input: string): Buffer {
  const padded = input.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(input.length / 4) * 4, '=')
  return Buffer.from(padded, 'base64')
}

// Clé EC P-256 — même courbe que les clés .p8 fournies par Apple Developer.
const { privateKey, publicKey } = generateKeyPairSync('ec', {
  namedCurve: 'prime256v1',
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  publicKeyEncoding: { type: 'spki', format: 'pem' },
})

const config = { keyId: 'ABC1234567', teamId: 'TEAM123456', privateKey }

function verify(signingInput: string, signatureB64: string): boolean {
  const verifier = createVerify('SHA256')
  verifier.update(signingInput)
  verifier.end()
  return verifier.verify({ key: publicKey, dsaEncoding: 'ieee-p1363' }, base64urlDecode(signatureB64))
}

describe('signApnsJwt', () => {
  it('produit un JWT à 3 segments', () => {
    expect(signApnsJwt(config).split('.')).toHaveLength(3)
  })

  it('encode alg=ES256 et le bon kid dans le header', () => {
    const [headerB64] = signApnsJwt(config).split('.')
    const header = JSON.parse(base64urlDecode(headerB64).toString('utf8'))
    expect(header).toEqual({ alg: 'ES256', kid: 'ABC1234567' })
  })

  it('encode le bon iss (Team ID) et un iat récent dans le payload', () => {
    const [, payloadB64] = signApnsJwt(config).split('.')
    const payload = JSON.parse(base64urlDecode(payloadB64).toString('utf8'))
    const nowSec = Math.floor(Date.now() / 1000)
    expect(payload.iss).toBe('TEAM123456')
    expect(payload.iat).toBeGreaterThan(nowSec - 5)
    expect(payload.iat).toBeLessThanOrEqual(nowSec)
  })

  it('produit une signature vérifiable avec la clé publique correspondante (format IEEE P1363, pas DER)', () => {
    const [headerB64, payloadB64, signatureB64] = signApnsJwt(config).split('.')
    expect(verify(`${headerB64}.${payloadB64}`, signatureB64)).toBe(true)
  })

  it('rejette la vérification si le payload est altéré après signature', () => {
    const [headerB64, payloadB64, signatureB64] = signApnsJwt(config).split('.')
    const tampered = base64urlDecode(payloadB64).toString('utf8').replace('TEAM123456', 'HACKED0000')
    const tamperedB64 = Buffer.from(tampered, 'utf8')
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '')

    expect(verify(`${headerB64}.${tamperedB64}`, signatureB64)).toBe(false)
  })
})
