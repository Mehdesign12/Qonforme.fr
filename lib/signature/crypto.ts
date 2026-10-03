/**
 * Jetons, codes de vérification et empreintes de la signature en ligne.
 * Côté serveur uniquement (node:crypto).
 *
 * - Le jeton du lien : 32 octets aléatoires (256 bits), en base64url (43 caractères).
 *   La base ne garde que son empreinte SHA-256, qui sert à le retrouver, et une
 *   copie chiffrée (AES-256-GCM) pour que l'artisan puisse recopier son lien.
 *   Une fuite de la base seule ne donne donc aucun lien utilisable.
 * - Le code de vérification : 6 chiffres tirés par crypto.randomInt, gardés
 *   sous forme d'empreinte HMAC liée au lien (inutilisable sur un autre lien).
 * - La clé : SIGNATURE_LINK_SECRET si elle est définie, sinon dérivée de
 *   SUPABASE_SERVICE_ROLE_KEY (toujours présente en production). Si elle
 *   change, les anciens liens restent valables (empreinte) ; seule la copie
 *   du lien devient impossible et l'artisan en génère un nouveau.
 */
import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, randomInt, timingSafeEqual } from "crypto"
import { SIGNATURE_IMAGE_MAX_BYTES } from "@/lib/signature/rules"

const TOKEN_BYTES = 32
const TOKEN_RE = /^[A-Za-z0-9_-]{43}$/

/** Jeton aléatoire du lien de signature (43 caractères base64url). */
export function generateToken(): string {
  return randomBytes(TOKEN_BYTES).toString("base64url")
}

/** Vrai si la chaîne a la forme d'un jeton (avant toute requête en base). */
export function isTokenFormat(value: unknown): value is string {
  return typeof value === "string" && TOKEN_RE.test(value)
}

export function sha256Hex(data: string | Uint8Array): string {
  return createHash("sha256").update(data).digest("hex")
}

/** Empreinte stockée du jeton. */
export function hashToken(token: string): string {
  return sha256Hex(token)
}

/** Comparaison à temps constant de deux empreintes hexadécimales. */
export function safeEqualHex(a: string | null | undefined, b: string | null | undefined): boolean {
  if (!a || !b || a.length !== b.length || !/^[0-9a-f]+$/i.test(a) || !/^[0-9a-f]+$/i.test(b)) return false
  return timingSafeEqual(Buffer.from(a, "hex"), Buffer.from(b, "hex"))
}

/** Le jeton présenté correspond-il à l'empreinte enregistrée ? */
export function tokenMatches(token: unknown, storedHash: string | null | undefined): boolean {
  return isTokenFormat(token) && safeEqualHex(hashToken(token), storedHash)
}

/* ------------------------------------------------------------------ */
/* Clé serveur                                                         */
/* ------------------------------------------------------------------ */

function secretMaterial(): string {
  const secret = process.env.SIGNATURE_LINK_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!secret) throw new Error("Clé de signature absente : définir SIGNATURE_LINK_SECRET ou SUPABASE_SERVICE_ROLE_KEY")
  return secret
}

/** Clé de 32 octets dérivée du secret, propre à un usage (`purpose`). */
export function deriveKey(purpose: "token" | "code", secret: string = secretMaterial()): Buffer {
  return createHmac("sha256", secret).update(`qonforme:signature:${purpose}:v1`).digest()
}

/** Copie chiffrée du jeton : « v1.iv.tag.texte » (base64url). */
export function encryptToken(token: string, key: Buffer = deriveKey("token")): string {
  const iv = randomBytes(12)
  const cipher = createCipheriv("aes-256-gcm", key, iv)
  const ct = Buffer.concat([cipher.update(token, "utf8"), cipher.final()])
  const tag = cipher.getAuthTag()
  return ["v1", iv.toString("base64url"), tag.toString("base64url"), ct.toString("base64url")].join(".")
}

/** Jeton en clair, ou null si la copie est illisible (clé changée, valeur altérée). */
export function decryptToken(payload: string | null | undefined, key?: Buffer): string | null {
  if (!payload) return null
  try {
    const [v, iv, tag, ct] = payload.split(".")
    if (v !== "v1" || !iv || !tag || !ct) return null
    const decipher = createDecipheriv("aes-256-gcm", key ?? deriveKey("token"), Buffer.from(iv, "base64url"))
    decipher.setAuthTag(Buffer.from(tag, "base64url"))
    const token = Buffer.concat([decipher.update(Buffer.from(ct, "base64url")), decipher.final()]).toString("utf8")
    return isTokenFormat(token) ? token : null
  } catch {
    return null
  }
}

/* ------------------------------------------------------------------ */
/* Code de vérification                                                */
/* ------------------------------------------------------------------ */

/** Code à 6 chiffres, zéros initiaux compris. */
export function generateCode(): string {
  return String(randomInt(0, 1_000_000)).padStart(6, "0")
}

/** Empreinte du code, liée au lien : un code ne vaut que pour son lien. */
export function hashCode(signatureId: string, code: string, key: Buffer = deriveKey("code")): string {
  return createHmac("sha256", key).update(`${signatureId}:${code}`).digest("hex")
}

export function codeMatches(signatureId: string, code: unknown, storedHash: string | null | undefined, key?: Buffer): boolean {
  if (typeof code !== "string" || !/^\d{6}$/.test(code)) return false
  return safeEqualHex(hashCode(signatureId, code, key), storedHash)
}

/* ------------------------------------------------------------------ */
/* Image de la signature tracée                                        */
/* ------------------------------------------------------------------ */

const PNG_MAGIC = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]

/**
 * Image PNG d'une signature tracée (« data:image/png;base64,… ») : octets
 * décodés, ou null si ce n'est pas un PNG ou s'il dépasse la taille admise.
 */
export function decodeSignaturePng(dataUrl: unknown): Buffer | null {
  if (typeof dataUrl !== "string") return null
  const prefix = "data:image/png;base64,"
  if (!dataUrl.startsWith(prefix)) return null
  const b64 = dataUrl.slice(prefix.length)
  if (b64.length === 0 || b64.length > Math.ceil((SIGNATURE_IMAGE_MAX_BYTES * 4) / 3) + 4) return null
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(b64)) return null
  const bytes = Buffer.from(b64, "base64")
  if (bytes.length < 64 || bytes.length > SIGNATURE_IMAGE_MAX_BYTES) return null
  for (let i = 0; i < PNG_MAGIC.length; i++) if (bytes[i] !== PNG_MAGIC[i]) return null
  return bytes
}
