/**
 * Envoi d'une facture par la plateforme agréée (Super PDP) : jeton, dépôt du
 * PDF Factur-X, lecture des erreurs. L'enchaînement (réservation, émission du
 * brouillon, PDF, dépôt) est dans la route d'envoi ; ce module en porte les
 * pièces testables.
 *
 * Ordre voulu par la route : réserver l'envoi, obtenir le jeton (sous verrou :
 * un rafraîchissement fait tourner le jeton), et seulement ensuite émettre le
 * brouillon. Un raccordement indisponible n'attribue donc jamais de numéro.
 *
 * Contrôles synchrones de Super PDP relevés en bac à sable le 03/11/2026 :
 * adresse du client absente de l'annuaire (400 « pre-check: receiver address
 * <…> does not exist in peppol directory »), facture déjà déposée (400 « La
 * facture est déjà existante (id N) », même avec un autre identifiant externe).
 */
import type { SupabaseClient } from "@supabase/supabase-js"
import { accessTokenFor, claimLock, ConnectionError, loadConnection, releaseLock } from "@/lib/pa/store"
import { ApiError } from "@/lib/pa/superpdp/api"
import type { Fetch } from "@/lib/pa/superpdp/oauth"

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

export type TokenResult =
  | { ok: true; token: string }
  | { ok: false; reason: "not_connected" | "expired" | "busy" | "unavailable"; error: string }

/**
 * Jeton d'accès du raccordement, obtenu sous verrou puis verrou rendu : le jeton
 * vaut 30 minutes, le dépôt qui suit n'a pas besoin du verrou. La relève des
 * 15 minutes tient le verrou au plus 2 minutes : on attend quelques secondes.
 */
export async function obtainToken(
  admin: SupabaseClient,
  userId: string,
  opts: { fetch?: Fetch; wait?: (ms: number) => Promise<void>; tries?: number } = {},
): Promise<TokenResult> {
  const wait = opts.wait ?? sleep
  let locked = false
  for (let i = 0; i < (opts.tries ?? 5) && !locked; i++) {
    locked = await claimLock(admin, userId, 30)
    if (!locked) await wait(1500)
  }
  if (!locked) return { ok: false, reason: "busy", error: "Votre raccordement est en cours de mise à jour. Réessayez dans un instant." }
  try {
    const conn = await loadConnection(admin, userId)
    if (!conn.ok || !conn.row || conn.row.status !== "active") {
      return { ok: false, reason: "not_connected", error: "Votre raccordement à la plateforme agréée n'est pas actif." }
    }
    return { ok: true, token: await accessTokenFor(admin, conn.row, { fetch: opts.fetch }) }
  } catch (err) {
    if (err instanceof ConnectionError && err.kind === "expired") {
      return { ok: false, reason: "expired", error: "Votre autorisation chez Super PDP a expiré : renouvelez-la dans Facturation électronique." }
    }
    return { ok: false, reason: "unavailable", error: "Super PDP ne répond pas pour le moment. Réessayez dans un instant." }
  } finally {
    await releaseLock(admin, userId)
  }
}

/** Identifiant de la facture déjà déposée, quand Super PDP refuse un doublon. */
export function duplicateIdOf(err: unknown): number | null {
  if (!(err instanceof ApiError) || err.status !== 400) return null
  const m = /d[ée]j[àa] existante \(id (\d+)\)/i.exec(err.message)
  return m ? Number(m[1]) : null
}

/** Phrase pour l'artisan, d'après l'erreur de Super PDP (jamais le message brut seul). */
export function depositErrorText(err: unknown): string {
  if (!(err instanceof ApiError)) return "L'envoi par la plateforme a échoué. Réessayez dans un instant."
  const msg = err.message.replace(/^Super PDP \d+ : /, "")
  if (err.status === 0) return "Super PDP ne répond pas. Réessayez dans un instant."
  if (err.status === 401 || err.status === 403) return "Super PDP refuse l'accès : renouvelez votre autorisation dans Facturation électronique."
  if (/receiver address .* does not exist/i.test(msg)) {
    return "L'adresse de facturation électronique de votre client n'existe pas dans l'annuaire. Vérifiez-la avec lui, ou envoyez la facture par email."
  }
  if (/not supported|format/i.test(msg) && /destination|receiver/i.test(msg)) {
    return "La plateforme de votre client n'accepte pas ce format de facture. Envoyez-la par email."
  }
  if (err.status >= 500) return "Super PDP ne répond pas correctement pour le moment. Réessayez dans un instant."
  return `Super PDP a refusé la facture${msg ? ` : ${msg}` : "."}`
}

/** Identifiant externe d'un dépôt : la facture et sa tentative. */
export const depositExternalId = (invoiceId: string, attempt: number) => `qonforme-${invoiceId}-${attempt}`
