/**
 * Vérification d'une signature Svix (webhooks Resend), sans dépendance.
 *
 * Format (docs.svix.com, « Verifying webhooks manually ») : contenu signé
 * « <svix-id>.<svix-timestamp>.<corps> », HMAC-SHA256 avec le secret décodé
 * du base64 après le préfixe « whsec_ », en-tête « v1,<signature base64> »
 * (plusieurs signatures séparées par des espaces).
 */
import { createHmac, timingSafeEqual } from "node:crypto"

export const SVIX_TOLERANCE_SECONDS = 5 * 60

export function verifySvixSignature(input: {
  secret: string
  id: string | null
  timestamp: string | null
  signature: string | null
  body: string
  now?: number
}): boolean {
  const { secret, id, timestamp, signature, body } = input
  if (!secret || !id || !timestamp || !signature) return false
  const ts = Number(timestamp)
  if (!Number.isFinite(ts)) return false
  const nowSec = Math.floor((input.now ?? Date.now()) / 1000)
  if (Math.abs(nowSec - ts) > SVIX_TOLERANCE_SECONDS) return false

  let key: Buffer
  try {
    key = Buffer.from(secret.startsWith("whsec_") ? secret.slice(6) : secret, "base64")
  } catch {
    return false
  }
  if (key.length === 0) return false
  const expected = Buffer.from(createHmac("sha256", key).update(`${id}.${timestamp}.${body}`).digest("base64"))
  return signature.split(" ").some((part) => {
    const [version, sig] = part.split(",")
    if (version !== "v1" || !sig) return false
    const given = Buffer.from(sig)
    return given.length === expected.length && timingSafeEqual(given, expected)
  })
}
