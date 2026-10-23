/**
 * Appairage du téléphone pour le scan de documents.
 *
 * L'ordinateur (connecté) crée un appairage : un jeton de 256 bits, affiché en
 * QR code, dont seule l'empreinte est stockée. Le téléphone qui le présente
 * (/scan/p/<jeton>) reçoit un cookie HttpOnly de 15 minutes au plus, et peut
 * alors envoyer des documents scannés AU COMPTE de l'appairage — jamais lire,
 * modifier ni supprimer autre chose que les documents de cet appairage. Il n'a
 * pas besoin d'être connecté : le jeton est la preuve, limitée dans le temps,
 * révocable depuis l'ordinateur, et plafonnée à 20 documents.
 *
 * Module serveur (client administrateur) ; la table n'est accessible à aucun
 * utilisateur (20261022_scan_pairings.sql).
 */
import type { SupabaseClient } from "@supabase/supabase-js"
import { generateToken, hashToken, isTokenFormat } from "@/lib/signature/crypto"
import { isMissingSchemaError } from "@/lib/supabase/schema-guard"

export const PAIRING_TTL_MS = 15 * 60_000
export const PAIRING_MAX_DOCUMENTS = 20
export const PAIR_COOKIE = "q_scan_pair"

export interface PairingRow {
  id: string
  user_id: string
  token_hash: string
  created_at: string
  expires_at: string
  claimed_at: string | null
  revoked_at: string | null
}

export type PairingState = "active" | "expired" | "revoked"

export function pairingState(row: Pick<PairingRow, "expires_at" | "revoked_at">, now: Date = new Date()): PairingState {
  if (row.revoked_at) return "revoked"
  return new Date(row.expires_at).getTime() > now.getTime() ? "active" : "expired"
}

const COLUMNS = "id, user_id, token_hash, created_at, expires_at, claimed_at, revoked_at"

/** Crée un appairage et rend son jeton (à afficher une seule fois : seule son empreinte est gardée). */
export async function createPairing(admin: SupabaseClient, userId: string, now: Date = new Date()): Promise<
  { ok: true; id: string; token: string; expiresAt: string } | { ok: false; unavailable: boolean }
> {
  // Un seul code actif à la fois : le précédent est révoqué
  const revoke = await admin.from("scan_pairings").update({ revoked_at: now.toISOString() }).eq("user_id", userId).is("revoked_at", null).gt("expires_at", now.toISOString())
  if (revoke.error) return { ok: false, unavailable: isMissingSchemaError(revoke.error) }
  const token = generateToken()
  const expiresAt = new Date(now.getTime() + PAIRING_TTL_MS).toISOString()
  const { data, error } = await admin
    .from("scan_pairings")
    .insert({ user_id: userId, token_hash: hashToken(token), created_at: now.toISOString(), expires_at: expiresAt })
    .select("id")
    .single()
  if (error || !data) return { ok: false, unavailable: isMissingSchemaError(error) }
  return { ok: true, id: (data as { id: string }).id, token, expiresAt }
}

/** Appairage d'un jeton, quel que soit son état ; null si le jeton est inconnu ou mal formé. */
export async function findPairing(admin: SupabaseClient, token: unknown): Promise<PairingRow | null> {
  if (!isTokenFormat(token)) return null
  const { data, error } = await admin.from("scan_pairings").select(COLUMNS).eq("token_hash", hashToken(token)).maybeSingle()
  if (error || !data) return null
  return data as PairingRow
}

export type PairingAccess =
  | { ok: true; pairing: PairingRow }
  | { ok: false; status: 401 | 410; error: string }

/** Autorisation d'une requête du téléphone : le cookie doit porter un jeton connu, non expiré, non révoqué. */
export async function authorizePairing(admin: SupabaseClient, cookieValue: string | undefined, now: Date = new Date()): Promise<PairingAccess> {
  const row = cookieValue ? await findPairing(admin, cookieValue) : null
  if (!row) return { ok: false, status: 401, error: "Scannez de nouveau le QR code affiché sur votre ordinateur." }
  if (pairingState(row, now) !== "active") return { ok: false, status: 410, error: "Ce code n'est plus valable. Scannez de nouveau le QR code affiché sur votre ordinateur." }
  return { ok: true, pairing: row }
}

/** Le téléphone se connecte : la première ouverture est notée, l'ordinateur l'affiche. */
export async function markClaimed(admin: SupabaseClient, id: string, now: Date = new Date()): Promise<void> {
  await admin.from("scan_pairings").update({ claimed_at: now.toISOString() }).eq("id", id).is("claimed_at", null)
}

/** Nombre de documents reçus par un appairage. */
export async function countPairingDocuments(db: SupabaseClient, pairingId: string): Promise<number> {
  const { count } = await db.from("scanned_documents").select("id", { count: "exact", head: true }).eq("pairing_id", pairingId)
  return count ?? 0
}
