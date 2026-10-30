/**
 * OAuth 2.1 « authorization code » de Super PDP (documentation
 * « Authentification ») :
 * - autorisation : https://api.superpdp.tech/oauth2/authorize, sans scope ;
 * - jetons : https://api.superpdp.tech/oauth2/token, identifiants de
 *   l'application en en-tête (Basic) ;
 * - jeton d'accès de 30 minutes ; jeton de rafraîchissement d'un an, qui
 *   CHANGE à chaque usage (rotation imposée par OAuth 2.1) : l'ancien ne sert
 *   plus, le nouveau doit être enregistré avant toute autre chose ;
 * - révocation : RFC 7009, https://api.superpdp.tech/oauth2/revoke.
 * PKCE (S256) est envoyé : OAuth 2.1 le prévoit, un serveur qui ne l'exige pas
 * l'ignore.
 *
 * Pré-remplissage du parcours chez Super PDP (paramètres documentés) :
 * `login_hint`, `superpdp_company_number` + `superpdp_company_number_scheme`,
 * `superpdp_directory_entry_identifier`, `superpdp_send_and_receive=receive`
 * (Qonforme ne fait que recevoir pour l'instant : l'artisan doit accepter la
 * ligne d'annuaire de réception).
 *
 * Module sans base de données : `fetch` est injectable pour les tests.
 */
import { SUPERPDP_AUTHORIZE, SUPERPDP_REVOKE, SUPERPDP_TOKEN, type SuperPdpConfig } from "@/lib/pa/superpdp/config"
import { pkceChallenge } from "@/lib/pa/superpdp/crypto"

export type Fetch = typeof fetch

export interface TokenSet {
  accessToken: string
  refreshToken: string | null
  /** Expiration du jeton d'accès (ISO 8601). */
  expiresAt: string
}

/** Erreur OAuth. `revoked` : autorisation expirée ou retirée (l'artisan doit autoriser à nouveau). */
export class OAuthError extends Error {
  constructor(public kind: "revoked" | "unavailable" | "invalid", message: string) {
    super(message)
    this.name = "OAuthError"
  }
}

export function buildAuthorizeUrl(cfg: SuperPdpConfig, p: {
  state: string
  verifier: string
  email?: string | null
  siren?: string | null
}): string {
  const url = new URL(SUPERPDP_AUTHORIZE)
  url.searchParams.set("response_type", "code")
  url.searchParams.set("client_id", cfg.clientId)
  url.searchParams.set("redirect_uri", cfg.redirectUri)
  url.searchParams.set("state", p.state)
  url.searchParams.set("code_challenge", pkceChallenge(p.verifier))
  url.searchParams.set("code_challenge_method", "S256")
  url.searchParams.set("superpdp_send_and_receive", "receive")
  if (p.email) url.searchParams.set("login_hint", p.email)
  // En bac à sable, les entreprises sont fictives (schéma « sandbox ») : pas de SIREN réel à pré-remplir
  const siren = p.siren?.replace(/\s+/g, "")
  if (cfg.mode === "live" && siren && /^\d{9}$/.test(siren)) {
    url.searchParams.set("superpdp_company_number", siren)
    url.searchParams.set("superpdp_company_number_scheme", "fr_siren")
    url.searchParams.set("superpdp_directory_entry_identifier", siren)
  }
  return url.toString()
}

function basicAuth(cfg: SuperPdpConfig): string {
  return "Basic " + Buffer.from(`${encodeURIComponent(cfg.clientId)}:${encodeURIComponent(cfg.clientSecret)}`).toString("base64")
}

async function tokenRequest(cfg: SuperPdpConfig, body: Record<string, string>, f: Fetch, now: () => number): Promise<TokenSet> {
  let res: Response
  try {
    res = await f(SUPERPDP_TOKEN, {
      method: "POST",
      headers: { Authorization: basicAuth(cfg), "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
      body: new URLSearchParams(body).toString(),
      signal: AbortSignal.timeout(15_000),
      cache: "no-store",
    })
  } catch {
    throw new OAuthError("unavailable", "Super PDP ne répond pas.")
  }
  const json = (await res.json().catch(() => ({}))) as Record<string, unknown>
  if (!res.ok) {
    const code = typeof json.error === "string" ? json.error : ""
    if (code === "invalid_grant") throw new OAuthError("revoked", "Autorisation expirée ou retirée.")
    if (res.status >= 500 || res.status === 429) throw new OAuthError("unavailable", `Super PDP indisponible (${res.status}).`)
    throw new OAuthError("invalid", `Échange refusé par Super PDP (${res.status}${code ? ` ${code}` : ""}).`)
  }
  const access = typeof json.access_token === "string" ? json.access_token : ""
  if (!access) throw new OAuthError("invalid", "Réponse de Super PDP sans jeton d'accès.")
  const expiresIn = typeof json.expires_in === "number" && json.expires_in > 0 ? json.expires_in : 1800
  return {
    accessToken: access,
    refreshToken: typeof json.refresh_token === "string" && json.refresh_token ? json.refresh_token : null,
    expiresAt: new Date(now() + expiresIn * 1000).toISOString(),
  }
}

export function exchangeCode(cfg: SuperPdpConfig, code: string, verifier: string, f: Fetch = fetch, now: () => number = Date.now) {
  return tokenRequest(cfg, { grant_type: "authorization_code", code, redirect_uri: cfg.redirectUri, code_verifier: verifier }, f, now)
}

export function refreshTokens(cfg: SuperPdpConfig, refreshToken: string, f: Fetch = fetch, now: () => number = Date.now) {
  return tokenRequest(cfg, { grant_type: "refresh_token", refresh_token: refreshToken }, f, now)
}

/** Révoque un jeton de rafraîchissement (et les jetons d'accès qui en dépendent). Ne lève jamais. */
export async function revokeToken(cfg: SuperPdpConfig, token: string, f: Fetch = fetch): Promise<boolean> {
  try {
    const res = await f(SUPERPDP_REVOKE, {
      method: "POST",
      headers: { Authorization: basicAuth(cfg), "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ token, token_type_hint: "refresh_token" }).toString(),
      signal: AbortSignal.timeout(10_000),
      cache: "no-store",
    })
    return res.ok
  } catch {
    return false
  }
}
