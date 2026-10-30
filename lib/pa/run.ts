/**
 * Une passe sur un raccordement (bouton « Actualiser l'état » ou « Relever
 * maintenant », et tâche planifiée) : vérification de l'état si besoin,
 * relève si le compte a une formule, emails. Tout se fait sous verrou.
 */
import type { SupabaseClient } from "@supabase/supabase-js"
import { claimLock, checkConnection, ConnectionError, loadConnection, releaseLock, updateConnection } from "@/lib/pa/store"
import { hasPlan } from "@/lib/pa/server"
import { syncConnection, type SyncResult } from "@/lib/pa/sync"
import { isPaStatus, SYNCABLE, type PaStatus } from "@/lib/pa/status"
import { notifyNewInvoices, notifyStatus, runDigest } from "@/lib/pa/notify"
import { ApiError } from "@/lib/pa/superpdp/api"
import type { Fetch } from "@/lib/pa/superpdp/oauth"

/** Un état actif n'est revérifié auprès de la plateforme que toutes les 6 heures (sauf demande). */
const RECHECK_ACTIVE_MS = 6 * 3600_000

export type RunResult =
  | { ok: true; status: PaStatus; sync: SyncResult | null; skippedSync?: "no_plan" | "not_ready" }
  | { ok: false; reason: "busy" | "missing" | "unavailable" | "error"; message?: string }

export async function runConnection(
  admin: SupabaseClient,
  userId: string,
  opts: { sync?: boolean; forceCheck?: boolean; fetch?: Fetch; now?: Date } = {},
): Promise<RunResult> {
  if (!(await claimLock(admin, userId, 120))) return { ok: false, reason: "busy" }
  try {
    const loaded = await loadConnection(admin, userId)
    if (!loaded.ok) return { ok: false, reason: loaded.reason === "missing" ? "missing" : "error", message: loaded.ok ? undefined : loaded.message }
    const row = loaded.row
    if (!row) return { ok: false, reason: "missing" }

    let status: PaStatus = isPaStatus(row.status) ? row.status : "verifying"
    const now = (opts.now ?? new Date()).getTime()
    const stale = !row.last_check_at || now - Date.parse(row.last_check_at) > RECHECK_ACTIVE_MS
    if (status !== "expired" && status !== "refused" && (opts.forceCheck || status !== "active" || stale)) {
      const checked = await checkConnection(admin, row, opts)
      status = checked.status
      if (checked.changed) await notifyStatus(admin, row, status)
    }

    if (!opts.sync) return { ok: true, status, sync: null }
    if (!SYNCABLE.includes(status)) return { ok: true, status, sync: null, skippedSync: "not_ready" }
    const plan = await hasPlan(admin, userId)
    if (!plan) return { ok: true, status, sync: null, skippedSync: "no_plan" }

    const sync = await syncConnection(admin, row, opts)
    if (sync.newInvoices > 0) await notifyNewInvoices(admin, row, sync.newInvoices)
    await runDigest(admin, row, opts.now)
    return { ok: true, status, sync }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    if (err instanceof ConnectionError && err.kind === "expired") {
      const row = (await loadConnection(admin, userId))
      if (row.ok && row.row) await notifyStatus(admin, row.row, "expired")
      return { ok: true, status: "expired", sync: null }
    }
    const unavailable = (err instanceof ConnectionError && err.kind === "unavailable") || (err instanceof ApiError && (err.status === 0 || err.status >= 500 || err.status === 429))
    await updateConnection(admin, userId, { last_sync_error: message.slice(0, 300) })
    console.error("[pa] passe du raccordement:", message)
    return { ok: false, reason: unavailable ? "unavailable" : "error", message }
  } finally {
    await releaseLock(admin, userId)
  }
}

/** Tâche planifiée : une passe sur chaque raccordement, dans le temps imparti. */
export async function runAllConnections(
  admin: SupabaseClient,
  opts: { budgetMs?: number; fetch?: Fetch } = {},
): Promise<{ processed: number; synced: number; errors: number; skipped: number; inactive?: boolean }> {
  const started = Date.now()
  const budget = opts.budgetMs ?? 40_000
  const { data, error } = await admin
    .from("pa_connections")
    .select("user_id, status")
    .not("status", "in", "(refused,expired)")
    .order("last_sync_at", { ascending: true, nullsFirst: true })
    .limit(100)
  if (error) {
    if (/42P01|PGRST205|schema cache|does not exist/i.test(`${error.code ?? ""} ${error.message}`)) return { processed: 0, synced: 0, errors: 0, skipped: 0, inactive: true }
    throw new Error(error.message)
  }
  const out = { processed: 0, synced: 0, errors: 0, skipped: 0 }
  for (const r of (data ?? []) as { user_id: string }[]) {
    if (Date.now() - started > budget) break
    out.processed++
    const res = await runConnection(admin, r.user_id, { sync: true, fetch: opts.fetch })
    if (!res.ok) {
      if (res.reason === "busy") out.skipped++
      else out.errors++
    } else if (res.sync) out.synced++
  }
  return out
}
