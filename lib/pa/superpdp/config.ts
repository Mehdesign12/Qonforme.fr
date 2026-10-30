/**
 * Configuration de Super PDP, plateforme agréée à laquelle Qonforme se raccorde
 * en « marque grise » : une seule application OAuth (celle de Qonforme), à
 * laquelle chaque artisan rattache son compte par le flux « authorization code »
 * (documentation Super PDP, « Authentification », lue le 30/10/2026).
 *
 * Deux modes, comme Stripe (CLAUDE.md, règle « Paiements ») : un compte d'essai
 * (Admin › Paiements) se raccorde au bac à sable, tous les autres à la
 * production. Mêmes noms de variables, suffixe `_TEST` pour le bac à sable :
 *   SUPERPDP_CLIENT_ID, SUPERPDP_CLIENT_SECRET
 *   SUPERPDP_CLIENT_ID_TEST, SUPERPDP_CLIENT_SECRET_TEST
 * Variables absentes pour un mode : le raccordement n'est pas proposé à ces
 * comptes (la page garde l'import manuel), jamais un raccordement deviné.
 */

export type PaMode = "test" | "live"

export const SUPERPDP_LABEL = "Super PDP"
export const SUPERPDP_SITE = "https://www.superpdp.tech"
export const SUPERPDP_API = "https://api.superpdp.tech"
export const SUPERPDP_AUTHORIZE = `${SUPERPDP_API}/oauth2/authorize`
export const SUPERPDP_TOKEN = `${SUPERPDP_API}/oauth2/token`
export const SUPERPDP_REVOKE = `${SUPERPDP_API}/oauth2/revoke`

/** Chemin de retour, déclaré tel quel dans l'application Super PDP. */
export const CALLBACK_PATH = "/api/pa/superpdp/callback"

export interface SuperPdpConfig {
  mode: PaMode
  clientId: string
  clientSecret: string
  redirectUri: string
}

export function appBaseUrl(): string {
  return (process.env.NEXT_PUBLIC_APP_URL?.trim() || "https://qonforme.fr").replace(/\/+$/, "")
}

/** Identifiants de l'application pour un mode, ou null s'ils ne sont pas configurés. */
export function superPdpConfig(mode: PaMode, env: NodeJS.ProcessEnv = process.env): SuperPdpConfig | null {
  const suffix = mode === "test" ? "_TEST" : ""
  const clientId = env[`SUPERPDP_CLIENT_ID${suffix}`]?.trim()
  const clientSecret = env[`SUPERPDP_CLIENT_SECRET${suffix}`]?.trim()
  if (!clientId || !clientSecret) return null
  return { mode, clientId, clientSecret, redirectUri: `${appBaseUrl()}${CALLBACK_PATH}` }
}
