/**
 * Chiffrement des jetons OAuth de la plateforme (AES-256-GCM) et du cookie
 * d'aller-retour du raccordement. Clé dérivée de `PA_TOKEN_SECRET`, à défaut de
 * la clé service_role de Supabase (comme les liens de signature). Changer la
 * clé rend les jetons illisibles : l'artisan n'a qu'à autoriser à nouveau.
 */
import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes } from "crypto"

function secretMaterial(): string {
  const secret = process.env.PA_TOKEN_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!secret) throw new Error("Clé absente : définir PA_TOKEN_SECRET ou SUPABASE_SERVICE_ROLE_KEY")
  return secret
}

export function paKey(purpose: "token" | "cookie", secret: string = secretMaterial()): Buffer {
  return createHmac("sha256", secret).update(`qonforme:pa:${purpose}:v1`).digest()
}

/** « v1.iv.tag.texte » (base64url). */
export function seal(plain: string, key: Buffer): string {
  const iv = randomBytes(12)
  const cipher = createCipheriv("aes-256-gcm", key, iv)
  const ct = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()])
  return ["v1", iv.toString("base64url"), cipher.getAuthTag().toString("base64url"), ct.toString("base64url")].join(".")
}

/** Texte en clair, ou null si la valeur est illisible (clé changée, valeur altérée). */
export function unseal(payload: string | null | undefined, key: Buffer): string | null {
  if (!payload) return null
  try {
    const [v, iv, tag, ct] = payload.split(".")
    if (v !== "v1" || !iv || !tag || !ct) return null
    const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(iv, "base64url"))
    decipher.setAuthTag(Buffer.from(tag, "base64url"))
    return Buffer.concat([decipher.update(Buffer.from(ct, "base64url")), decipher.final()]).toString("utf8")
  } catch {
    return null
  }
}

/** Chaîne aléatoire base64url (état OAuth, vérificateur PKCE). */
export function randomToken(bytes = 32): string {
  return randomBytes(bytes).toString("base64url")
}

/** Défi PKCE S256 (RFC 7636). */
export function pkceChallenge(verifier: string): string {
  return createHash("sha256").update(verifier).digest("base64url")
}
