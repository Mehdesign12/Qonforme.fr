/**
 * Authentification admin — cookie HMAC-SHA256
 * Utilise uniquement Web Crypto API (Edge + Node 18+, zéro dépendance)
 *
 * La signature est encodée en HEX (pas en base64) pour éviter tout problème
 * d'URL-encoding des caractères +, /, = dans les headers HTTP / proxies CDN.
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

/** Uint8Array → chaîne hex (ex: "a3f9...") — 100% safe dans les cookies */
function toHex(buf: ArrayBuffer): string {
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

/** Chaîne hex → Uint8Array */
function fromHex(hex: string): Uint8Array {
  if (hex.length % 2 !== 0) return new Uint8Array(0)
  const bytes = new Uint8Array(hex.length / 2)
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.slice(i, i + 2), 16)
  }
  return bytes
}

/**
 * Génère la valeur du cookie : "timestamp.hex(HMAC(timestamp))"
 */
export async function signAdminSession(secret: string): Promise<string> {
  const payload   = String(Date.now())
  const key       = await getKey(secret)
  const sigBuffer = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payload))
  return `${payload}.${toHex(sigBuffer)}`
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
    const sigHex  = token.slice(dotIndex + 1)

    // Vérification expiration
    const ts = parseInt(payload, 10)
    if (isNaN(ts) || Date.now() - ts > TTL_MS) return false

    // Vérification HMAC
    const key      = await getKey(secret)
    const sigBytes = fromHex(sigHex)
    if (sigBytes.length === 0) return false

    return await crypto.subtle.verify('HMAC', key, sigBytes, new TextEncoder().encode(payload))
  } catch {
    return false
  }
}
