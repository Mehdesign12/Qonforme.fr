/**
 * Connexions de l'onglet SEO (Paramètres › Connexions) : quelles variables
 * d'environnement sont présentes. Seule la PRÉSENCE est lue ; aucune valeur
 * n'est rendue, journalisée ni envoyée au navigateur.
 *
 * Le test réel de chaque connexion (bouton « Tester ») vit dans
 * lib/seo/connections-test.ts.
 */
import { readServiceAccount } from "@/lib/seo/google"
import type { ConnectionState } from "@/lib/seo/types"

export type ConnectionKey =
  | "search_console"
  | "pagespeed"
  | "gemini"
  | "openai"
  | "perplexity"
  | "anthropic"
  | "dataforseo"
  | "resend"
  | "pushrank"

export interface ConnectionDef {
  key: ConnectionKey
  name: string
  /** À quoi sert la connexion. */
  purpose: string
  /** Variables d'environnement (noms). */
  env: string[]
  /** Facultative : son absence est « Non configurée » (neutre) plutôt que « Clé manquante ». */
  optional?: boolean
  note?: string
}

export const CONNECTIONS: ConnectionDef[] = [
  {
    key: "search_console",
    name: "Google Search Console",
    purpose: "Clics, impressions, positions et requêtes (propriété sc-domain:qonforme.fr)",
    env: ["GOOGLE_SERVICE_ACCOUNT_JSON"],
  },
  {
    key: "pagespeed",
    name: "PageSpeed Insights",
    purpose: "Vitesse des pages sur mobile et ordinateur",
    env: ["PAGESPEED_API_KEY"],
    note: "Sans clé, les mesures restent possibles avec un quota très faible.",
  },
  { key: "gemini", name: "Gemini", purpose: "Rédaction, images de couverture et suivi de Gemini", env: ["GEMINI_API_KEY"] },
  { key: "openai", name: "OpenAI", purpose: "Suivi de ChatGPT dans la visibilité IA", env: ["OPENAI_API_KEY"] },
  { key: "perplexity", name: "Perplexity", purpose: "Suivi de Perplexity dans la visibilité IA", env: ["PERPLEXITY_API_KEY"], optional: true },
  { key: "anthropic", name: "Anthropic", purpose: "Suivi de Claude dans la visibilité IA", env: ["ANTHROPIC_API_KEY"], optional: true },
  {
    key: "dataforseo",
    name: "DataForSEO",
    purpose: "Volumes de recherche des mots-clés et Aperçu IA de Google",
    env: ["DATAFORSEO_LOGIN", "DATAFORSEO_PASSWORD"],
    optional: true,
  },
  { key: "resend", name: "Resend", purpose: "Envoi du résumé hebdomadaire par email", env: ["RESEND_API_KEY"] },
  {
    key: "pushrank",
    name: "Webhook PushRank",
    purpose: "Réception des articles de PushRank",
    env: ["PUSHRANK_WEBHOOK_SECRET"],
    optional: true,
    note: "Sera retiré à la résiliation de PushRank.",
  },
]

function present(name: string): boolean {
  return Boolean(process.env[name]?.trim())
}

/** Vrai si toutes les variables de la connexion sont présentes (et lisibles pour le compte de service). */
export function isConfigured(key: ConnectionKey): boolean {
  const def = CONNECTIONS.find((c) => c.key === key)
  if (!def) return false
  if (key === "search_console") return readServiceAccount() !== null
  return def.env.every(present)
}

/** État de présence (sans appel réseau) : connectée si les variables sont là. */
export function presenceState(key: ConnectionKey): ConnectionState {
  const def = CONNECTIONS.find((c) => c.key === key)
  if (!def) return "not_configured"
  if (isConfigured(key)) return "connected"
  if (key === "search_console" && present("GOOGLE_SERVICE_ACCOUNT_JSON")) return "error"
  return def.optional ? "not_configured" : "missing"
}

export interface ConnectionStatus {
  key: ConnectionKey
  name: string
  purpose: string
  env: string[]
  note?: string
  state: ConnectionState
}

/** Liste des connexions et de leur état de présence (sûr à envoyer au navigateur). */
export function connectionStatuses(): ConnectionStatus[] {
  return CONNECTIONS.map((c) => ({
    key: c.key,
    name: c.name,
    purpose: c.purpose,
    env: c.env,
    note: c.note,
    state: presenceState(c.key),
  }))
}
