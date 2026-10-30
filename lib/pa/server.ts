/**
 * Assemblage de la vue « Facturation électronique » d'un compte, côté serveur.
 */
import type { SupabaseClient } from "@supabase/supabase-js"
import { canIssueInvoices } from "@/lib/stripe/access"
import { getUserStripeMode } from "@/lib/stripe/test-users"
import { superPdpConfig, type PaMode } from "@/lib/pa/superpdp/config"
import { loadConnection, type ConnectionRow } from "@/lib/pa/store"
import { connectionView, type EInvoicingView } from "@/lib/pa/view"
import { RECEIVED_TABLE } from "@/lib/reception/server"

/** Mode Super PDP du compte : celui de Stripe (compte d'essai = bac à sable). null : illisible. */
export async function paModeFor(userId: string): Promise<PaMode | null> {
  return getUserStripeMode(userId)
}

/** Le compte a une formule (Essentiel ou Artisan). Lecture en échec : null (ne rien conclure). */
export async function hasPlan(admin: SupabaseClient, userId: string): Promise<boolean | null> {
  const { data, error } = await admin.from("subscriptions").select("status").eq("user_id", userId).maybeSingle()
  if (error) return null
  return canIssueInvoices((data as { status?: string } | null)?.status)
}

function monthStartParis(now = new Date()): string {
  const [y, m] = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Paris", year: "numeric", month: "2-digit" }).format(now).split("-")
  return `${y}-${m}-01T00:00:00+01:00`
}

export async function loadEInvoicingView(
  admin: SupabaseClient,
  userId: string,
): Promise<{ ok: true; view: EInvoicingView; row: ConnectionRow | null } | { ok: false; status: number; error: string }> {
  const [mode, plan, conn, company] = await Promise.all([
    paModeFor(userId),
    hasPlan(admin, userId),
    loadConnection(admin, userId),
    admin.from("companies").select("name, siren").eq("user_id", userId).maybeSingle(),
  ])
  if (plan === null || (!conn.ok && conn.reason === "error")) {
    return { ok: false, status: 503, error: "Lecture impossible pour le moment. Réessayez dans un instant." }
  }
  const row = conn.ok ? conn.row : null
  const effectiveMode = row?.mode ?? mode
  const available = conn.ok && effectiveMode !== null && superPdpConfig(effectiveMode) !== null

  let received = { total: 0, thisMonth: 0 }
  if (row) {
    const [all, month] = await Promise.all([
      admin.from(RECEIVED_TABLE).select("id", { count: "exact", head: true }).eq("user_id", userId).eq("source", "platform"),
      admin.from(RECEIVED_TABLE).select("id", { count: "exact", head: true }).eq("user_id", userId).eq("source", "platform").gte("received_at", monthStartParis()),
    ])
    received = { total: all.count ?? 0, thisMonth: month.count ?? 0 }
  }

  const c = (company.data ?? null) as { name?: string | null; siren?: string | null } | null
  return {
    ok: true,
    row,
    view: {
      available,
      hasPlan: plan,
      mode: effectiveMode,
      companyName: c?.name ?? null,
      siren: c?.siren && /^\d{9}$/.test(c.siren) ? c.siren : null,
      connection: connectionView(row),
      received,
    },
  }
}
