/**
 * Authentification admin — cookie HMAC-SHA256
 * Utilise uniquement Web Crypto API (disponible en Edge + Node 18+, zéro dépendance)
 */

export const ADMIN_COOKIE = 'admin_session'
const TTL_MS = 24 * 60 * 60 * 1000 // 24h

async function getKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify'],
  )
}

/**
 * Génère la valeur du cookie : "timestamp.base64(HMAC(timestamp))"
 */
export async function signAdminSession(secret: string): Promise<string> {
  const payload = String(Date.now())
  const key = await getKey(secret)
  const sigBuffer = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payload))
  const sigB64 = btoa(String.fromCharCode(...new Uint8Array(sigBuffer)))
  return `${payload}.${sigB64}`
}

/**
 * Vérifie la signature et l'expiration du cookie.
 * Retourne true uniquement si valide et non expiré.
 */
export async function verifyAdminSession(token: string, secret: string): Promise<boolean> {
  try {
    const dotIndex = token.indexOf('.')
    if (dotIndex === -1) return false

    const payload = token.slice(0, dotIndex)
    const sigB64  = token.slice(dotIndex + 1)

    // Vérification expiration
    const ts = parseInt(payload, 10)
    if (isNaN(ts) || Date.now() - ts > TTL_MS) return false

    // Vérification HMAC
    const key      = await getKey(secret)
    const sigBytes = Uint8Array.from(atob(sigB64), (c) => c.charCodeAt(0))
    return await crypto.subtle.verify('HMAC', key, sigBytes, new TextEncoder().encode(payload))
  } catch {
    return false
  }
}
