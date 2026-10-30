/**
 * Emails du raccordement : réception active (une fois), autorisation expirée
 * (une fois par expiration), nouvelle facture (si demandé) et résumé quotidien
 * (à partir de 18 h, heure de Paris, seulement s'il y a eu de nouvelles
 * factures). Un échec d'envoi ne bloque jamais la relève.
 */
import type { SupabaseClient } from "@supabase/supabase-js"
import { sendEmail } from "@/lib/email/resend"
import { fmtEur } from "@/lib/email/templates/base"
import { buildReceivedDigestEmail, buildReceptionActiveEmail, buildSyncFailureEmail } from "@/lib/email/templates/e-invoicing"
import { RECEIVED_TABLE } from "@/lib/reception/server"
import { updateConnection, type ConnectionRow } from "@/lib/pa/store"
import type { PaStatus } from "@/lib/pa/status"

/** Heure du résumé quotidien (heure de Paris). */
export const DIGEST_HOUR = 18

async function recipient(admin: SupabaseClient, row: ConnectionRow): Promise<{ email: string; firstName: string | null; companyName: string } | null> {
  const company = await admin.from("companies").select("name").eq("user_id", row.user_id).maybeSingle()
  const companyName = ((company.data as { name?: string } | null)?.name ?? "").trim() || "votre entreprise"
  let email = row.notify_email?.trim() || null
  let firstName: string | null = null
  try {
    const { data } = await admin.auth.admin.getUserById(row.user_id)
    email = email || data?.user?.email || null
    const meta = (data?.user?.user_metadata ?? {}) as { first_name?: unknown }
    firstName = typeof meta.first_name === "string" && meta.first_name.trim() ? meta.first_name.trim() : null
  } catch {
    // compte illisible : on n'envoie qu'à l'adresse de notification, si elle existe
  }
  return email ? { email, firstName, companyName } : null
}

async function send(to: string, mail: { subject: string; html: string }): Promise<boolean> {
  try {
    await sendEmail({ to, subject: mail.subject, html: mail.html })
    return true
  } catch (err) {
    console.error("[pa] email:", err instanceof Error ? err.message : err)
    return false
  }
}

export async function notifyStatus(admin: SupabaseClient, row: ConnectionRow, status: PaStatus): Promise<void> {
  if (status === "active" && !row.activation_notified_at) {
    const to = await recipient(admin, row)
    if (to && (await send(to.email, buildReceptionActiveEmail({ firstName: to.firstName, companyName: to.companyName, address: row.electronic_address })))) {
      const at = new Date().toISOString()
      await updateConnection(admin, row.user_id, { activation_notified_at: at })
      row.activation_notified_at = at
    }
  }
  if (status === "expired" && row.notify_failure && !row.failure_notified_at) {
    const to = await recipient(admin, row)
    if (to && (await send(to.email, buildSyncFailureEmail({ companyName: to.companyName })))) {
      const at = new Date().toISOString()
      await updateConnection(admin, row.user_id, { failure_notified_at: at })
      row.failure_notified_at = at
    }
  }
}

async function latestPlatformInvoices(admin: SupabaseClient, userId: string, since: string | null, limit: number) {
  let q = admin
    .from(RECEIVED_TABLE)
    .select("supplier_name, invoice_number, total_ttc")
    .eq("user_id", userId)
    .eq("source", "platform")
    .order("received_at", { ascending: false })
    .limit(limit)
  if (since) q = q.gt("created_at", since)
  const { data } = await q
  return ((data ?? []) as { supplier_name?: string | null; invoice_number?: string | null; total_ttc?: number | null }[]).map((r) => ({
    supplier: r.supplier_name?.trim() || "Fournisseur",
    number: r.invoice_number ?? null,
    amount: typeof r.total_ttc === "number" ? fmtEur(r.total_ttc) : null,
  }))
}

/** « Prévenir à chaque facture reçue » : un email par facture arrivée à cette relève (5 au plus). */
export async function notifyNewInvoices(admin: SupabaseClient, row: ConnectionRow, count: number): Promise<void> {
  if (!row.notify_each || count <= 0) return
  const to = await recipient(admin, row)
  if (!to) return
  const invoices = await latestPlatformInvoices(admin, row.user_id, null, Math.min(count, 5))
  for (const inv of invoices) {
    await send(to.email, buildReceivedDigestEmail({ companyName: to.companyName, count: 1, invoices: [inv], each: true }))
  }
}

export function parisDayAndHour(now: Date): { day: string; hour: number } {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Paris", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", hourCycle: "h23" }).formatToParts(now)
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? ""
  return { day: `${get("year")}-${get("month")}-${get("day")}`, hour: Number(get("hour")) }
}

/** Le résumé du jour est-il dû ? (pur, testé) */
export function digestDue(row: Pick<ConnectionRow, "notify_digest" | "pending_digest_count" | "last_digest_at">, now: Date): boolean {
  if (!row.notify_digest || (row.pending_digest_count ?? 0) <= 0) return false
  const { day, hour } = parisDayAndHour(now)
  if (hour < DIGEST_HOUR) return false
  return !row.last_digest_at || parisDayAndHour(new Date(row.last_digest_at)).day !== day
}

export async function runDigest(admin: SupabaseClient, row: ConnectionRow, now = new Date()): Promise<boolean> {
  if (!digestDue(row, now)) return false
  const to = await recipient(admin, row)
  if (!to) return false
  const count = row.pending_digest_count
  const invoices = await latestPlatformInvoices(admin, row.user_id, row.last_digest_at, Math.min(count, 10))
  const ok = await send(to.email, buildReceivedDigestEmail({ companyName: to.companyName, count, invoices }))
  if (ok) {
    const at = now.toISOString()
    await updateConnection(admin, row.user_id, { last_digest_at: at, pending_digest_count: 0 })
    row.last_digest_at = at
    row.pending_digest_count = 0
  }
  return ok
}
