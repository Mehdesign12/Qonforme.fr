/**
 * Masquage des secrets dans un message (résultat d'un test de connexion,
 * erreur d'une tâche planifiée enregistrée dans seo_jobs et cron_logs) :
 * valeurs des variables de toutes les connexions, clé privée du compte de
 * service Google, en-têtes d'autorisation, paramètres « key= » d'une adresse.
 */
import { CONNECTIONS } from "@/lib/seo/connections"
import { readServiceAccount } from "@/lib/seo/google"

/** Valeurs secrètes de toutes les connexions (pour les masquer dans un message). */
function secretValues(): string[] {
  const out: string[] = []
  CONNECTIONS.forEach((c) =>
    c.env.forEach((name) => {
      const v = process.env[name]?.trim()
      if (v && v.length >= 6) out.push(v)
    }),
  )
  const account = readServiceAccount()
  if (account?.private_key) out.push(account.private_key, account.private_key.replace(/\n/g, "\\n"))
  return out.sort((a, b) => b.length - a.length)
}

/** Retire de `message` toute clé, tout mot de passe et tout en-tête d'autorisation ; 300 caractères au plus. */
export function redact(message: string): string {
  let out = message
  secretValues().forEach((secret) => {
    out = out.split(secret).join("•••")
  })
  out = out
    .replace(/(Bearer|Basic)\s+[A-Za-z0-9._~+/=-]+/gi, "$1 •••")
    .replace(/([?&](?:key|api_key|apikey|token)=)[^&\s"']+/gi, "$1•••")
    .replace(/-----BEGIN[^-]*-----[\s\S]*?-----END[^-]*-----/g, "•••")
    .replace(/\b(sk|pplx|re|sk-ant)[-_][A-Za-z0-9_-]{8,}/g, "•••")
  return out.length > 300 ? `${out.slice(0, 299)}…` : out
}
