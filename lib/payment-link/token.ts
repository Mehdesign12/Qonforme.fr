/**
 * Jeton du lien de paiement (côté serveur uniquement : node:crypto et secret).
 *
 * Le jeton n'est jamais stocké en clair : la base ne garde que son empreinte
 * SHA-256 (`token_hash`), qui sert à retrouver le lien quand un client l'ouvre.
 * Pour que le lien reste le même à chaque envoi, relance ou copie, le jeton est
 * dérivé d'un secret serveur et d'un sel propre à la facture (`nonce`, stocké) :
 *   jeton = base64url(HMAC-SHA256(secret, "payment-link:v1:<facture>:<sel>"))
 * soit 256 bits, 43 caractères. Une fuite de la base ne donne pas les liens
 * (il faut aussi le secret), et désactiver puis recréer un lien change de sel,
 * donc de jeton : l'ancien lien ne revient jamais.
 *
 * Secret : PAYMENT_LINK_SECRET, à défaut la clé service_role de Supabase (déjà
 * présente sur le serveur, jamais envoyée au navigateur). Changer ce secret
 * change tous les liens : ceux déjà envoyés par email cessent de fonctionner.
 */
import { createHash, createHmac, randomBytes } from "node:crypto"

/** 43 caractères base64url : 32 octets d'entropie. */
const TOKEN_SHAPE = /^[A-Za-z0-9_-]{43}$/

/** Vrai si la chaîne a la forme d'un jeton (contrôle avant toute requête en base). */
export function isTokenShape(value: unknown): value is string {
  return typeof value === "string" && TOKEN_SHAPE.test(value)
}

/** Secret de dérivation, ou null s'il n'est pas configuré (la fonction reste alors masquée). */
export function paymentLinkSecret(): string | null {
  const secret = process.env.PAYMENT_LINK_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY
  return secret && secret.length >= 16 ? secret : null
}

/** Nouveau sel aléatoire (128 bits). */
export function newNonce(): string {
  return randomBytes(16).toString("hex")
}

/** Jeton du lien d'une facture pour un sel donné. */
export function deriveToken(secret: string, invoiceId: string, nonce: string): string {
  return createHmac("sha256", secret).update(`payment-link:v1:${invoiceId}:${nonce}`).digest("base64url")
}

/** Empreinte stockée en base (64 caractères hexadécimaux). */
export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex")
}

/** Adresse publique de la page de règlement. */
export function paymentUrl(token: string, baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://qonforme.fr"): string {
  return `${baseUrl.replace(/\/+$/, "")}/regler/${token}`
}
