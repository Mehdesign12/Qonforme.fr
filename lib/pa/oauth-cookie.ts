/**
 * Cookie d'aller-retour du raccordement (état OAuth, vérificateur PKCE, compte,
 * mode), chiffré et limité à 15 minutes et au chemin du retour. Rien de tout
 * cela ne passe dans une adresse visible, sauf l'état (paramètre `state`, qui
 * ne donne accès à rien seul).
 */
import { timingSafeEqual } from "crypto"
import { paKey, seal, unseal } from "@/lib/pa/superpdp/crypto"
import type { PaMode } from "@/lib/pa/superpdp/config"

export const OAUTH_COOKIE = "q_pa_oauth"
export const OAUTH_COOKIE_PATH = "/api/pa/superpdp"
export const OAUTH_COOKIE_MAX_AGE = 15 * 60

export interface OAuthCookie {
  state: string
  verifier: string
  uid: string
  mode: PaMode
  /** Expiration (ms depuis 1970). */
  exp: number
}

export function sealOAuthCookie(c: OAuthCookie, key = paKey("cookie")): string {
  return seal(JSON.stringify(c), key)
}

export function openOAuthCookie(raw: string | null | undefined, key = paKey("cookie"), now = Date.now()): OAuthCookie | null {
  const text = unseal(raw, key)
  if (!text) return null
  try {
    const c = JSON.parse(text) as Partial<OAuthCookie>
    if (typeof c.state !== "string" || typeof c.verifier !== "string" || typeof c.uid !== "string") return null
    if (c.mode !== "test" && c.mode !== "live") return null
    if (typeof c.exp !== "number" || c.exp < now) return null
    return c as OAuthCookie
  } catch {
    return null
  }
}

export function sameState(a: string, b: string | null | undefined): boolean {
  if (!b) return false
  const x = Buffer.from(a)
  const y = Buffer.from(b)
  return x.length === y.length && timingSafeEqual(x, y)
}
