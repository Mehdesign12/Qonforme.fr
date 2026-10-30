/**
 * Transmission à Super PDP d'une décision posée par l'artisan sur une facture
 * arrivée par la plateforme (POST /v1.beta/invoice_events). Ne lève jamais : un
 * échec laisse le statut enregistré dans Qonforme, « non transmis ».
 *
 * Sans formule, rien ne part (planche « Abonnement arrêté » : les décisions
 * envoyées au fournisseur sont suspendues).
 */
import type { SupabaseClient } from "@supabase/supabase-js"
import { claimLock, loadConnection, releaseLock, apiFor } from "@/lib/pa/store"
import { hasPlan } from "@/lib/pa/server"
import { recipientEventCode, superPdpInvoiceId } from "@/lib/pa/sync"
import type { Fetch } from "@/lib/pa/superpdp/oauth"

export type TransmitResult =
  | { transmitted: true }
  | { transmitted: false; reason: "not_platform" | "not_connected" | "no_plan" | "busy" | "unavailable" }

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

export async function transmitStatus(
  admin: SupabaseClient,
  p: { userId: string; platformId: string | null; code: string; reasonCode: string | null; reason: string | null },
  opts: { fetch?: Fetch; wait?: (ms: number) => Promise<void> } = {},
): Promise<TransmitResult> {
  const invoiceId = superPdpInvoiceId(p.platformId)
  const statusCode = recipientEventCode(p.code)
  if (!invoiceId || !statusCode) return { transmitted: false, reason: "not_platform" }

  const conn = await loadConnection(admin, p.userId)
  if (!conn.ok || !conn.row || conn.row.status === "expired" || conn.row.status === "refused") return { transmitted: false, reason: "not_connected" }
  const plan = await hasPlan(admin, p.userId)
  if (!plan) return { transmitted: false, reason: "no_plan" }

  const wait = opts.wait ?? sleep
  let locked = false
  for (let i = 0; i < 4 && !locked; i++) {
    locked = await claimLock(admin, p.userId, 30)
    if (!locked) await wait(1500)
  }
  if (!locked) return { transmitted: false, reason: "busy" }
  try {
    const fresh = await loadConnection(admin, p.userId)
    if (!fresh.ok || !fresh.row) return { transmitted: false, reason: "not_connected" }
    const api = await apiFor(admin, fresh.row, opts)
    await api.createEvent({ invoiceId, statusCode, reasonCode: p.reasonCode, note: p.reason })
    return { transmitted: true }
  } catch (err) {
    console.error("[pa] transmission du statut:", err instanceof Error ? err.message : err)
    return { transmitted: false, reason: "unavailable" }
  } finally {
    await releaseLock(admin, p.userId)
  }
}
