/**
 * Jeton d'invitation du comptable (côté serveur uniquement : node:crypto).
 *
 * 32 octets aléatoires (256 bits) en base64url, 43 caractères. La base ne garde
 * que l'empreinte SHA-256 (`token_hash`) ; renvoyer l'invitation tire un
 * nouveau jeton (l'ancien lien cesse aussitôt de fonctionner), l'accepter ou
 * l'annuler efface l'empreinte.
 *
 * Le jeton ne passe jamais dans l'adresse d'une page : le lien de l'email
 * pointe vers une route (/api/invitation-comptable/<jeton>) qui le range dans
 * un cookie HttpOnly puis redirige vers /invitation-comptable. Les outils de
 * mesure d'audience, qui lisent l'adresse des pages, ne le voient donc pas.
 */
import { createHash, randomBytes } from "node:crypto"

const TOKEN_SHAPE = /^[A-Za-z0-9_-]{43}$/

export function isInviteTokenShape(value: unknown): value is string {
  return typeof value === "string" && TOKEN_SHAPE.test(value)
}

export function hashInviteToken(token: string): string {
  return createHash("sha256").update(token).digest("hex")
}

/** Nouveau jeton et son empreinte. */
export function newInviteToken(): { token: string; hash: string } {
  const token = randomBytes(32).toString("base64url")
  return { token, hash: hashInviteToken(token) }
}

/** Lien de l'email d'invitation. */
export function inviteUrl(token: string, baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://qonforme.fr"): string {
  return `${baseUrl.replace(/\/+$/, "")}/api/invitation-comptable/${token}`
}
