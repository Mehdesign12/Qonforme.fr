/**
 * Connexion et inscription avec Google (Supabase OAuth, flux PKCE).
 *
 * Le bouton (components/auth/GoogleButton.tsx) envoie vers Google ; Google
 * renvoie à /api/auth/callback, qui échange le code contre la session. Un
 * compte créé par ce chemin est traité comme une inscription en deux champs :
 * mêmes métadonnées (`signup_wizard`), même fenêtre « Bienvenue ».
 *
 * Réglage hors code : fournisseur Google activé dans Supabase (Authentication ›
 * Providers) avec l'identifiant client Google Cloud, et l'adresse
 * `<site>/api/auth/callback` dans les URL de redirection autorisées.
 */
import { isLandingVariant } from "@/lib/auth/signup-input"

/** Un compte créé il y a moins de ce délai (ms) est une inscription qui vient d'avoir lieu. */
export const NEW_ACCOUNT_WINDOW_MS = 2 * 60 * 1000

/** Adresse de retour envoyée à Google ; `next` et `ab` ne sont repris que s'ils sont déjà filtrés. */
export function oauthRedirectTo(origin: string, opts: { next?: string | null; ab?: string | null } = {}): string {
  const url = new URL("/api/auth/callback", origin)
  if (opts.next) url.searchParams.set("next", opts.next)
  if (opts.ab && isLandingVariant(opts.ab)) url.searchParams.set("ab", opts.ab)
  return url.toString()
}

interface OAuthUserLike {
  created_at?: string
  app_metadata?: Record<string, unknown> | null
  user_metadata?: Record<string, unknown> | null
}

/** Compte Google qui vient d'être créé (et pas encore marqué comme inscrit par l'assistant). */
export function isFreshOAuthSignup(user: OAuthUserLike, now: number = Date.now()): boolean {
  if (user.app_metadata?.provider !== "google") return false
  if (user.user_metadata?.signup_wizard === true) return false
  const created = user.created_at ? Date.parse(user.created_at) : NaN
  if (!Number.isFinite(created)) return false
  return now - created >= 0 && now - created <= NEW_ACCOUNT_WINDOW_MS
}

const clean = (v: unknown): string | null => {
  if (typeof v !== "string") return null
  const t = v.trim().slice(0, 60)
  return t || null
}

/**
 * Métadonnées d'un nouveau compte Google : celles d'une inscription en deux
 * champs, plus le prénom et le nom donnés par Google (la fenêtre « Bienvenue »
 * saute alors l'étape du prénom).
 */
export function oauthSignupMetadata(
  user: OAuthUserLike,
  variant?: string | null,
): Record<string, string | boolean> {
  const meta: Record<string, string | boolean> = { signup_wizard: true, signup_provider: "google" }
  const m = user.user_metadata ?? {}
  const first = clean(m.given_name)
  const last = clean(m.family_name)
  if (first) meta.first_name = first
  if (last) meta.last_name = last
  if (variant && isLandingVariant(variant)) meta.landing_variant = variant
  return meta
}
