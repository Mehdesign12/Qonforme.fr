/**
 * Accès serveur aux documents scannés : formule du compte (donc quota), espace
 * utilisé, adresses signées des pages. Les fichiers vivent dans le compartiment
 * privé « scanned-documents », sous <user_id>/<document_id>/<page>.webp : seul
 * leur propriétaire les lit (politiques de 20261021_scanned_documents.sql), et
 * jamais par une adresse publique.
 */
import type { SupabaseClient } from "@supabase/supabase-js"
import { canIssueInvoices } from "@/lib/stripe/access"
import { isPlanId, type PlanId } from "@/lib/stripe/plans"
import { isMissingSchemaError } from "@/lib/supabase/schema-guard"
import { quotaOf, type ScanUsage } from "@/lib/scan/documents"

export const SCAN_BUCKET = "scanned-documents"
/** Durée de validité d'une adresse signée. */
export const SIGNED_URL_SECONDS = 3600

export class ScanReadError extends Error {}

/**
 * Formule du compte pour le quota. Une lecture en échec n'est jamais prise pour
 * « pas de formule » (règle de CLAUDE.md) : elle lève, la route répond 503.
 */
export async function loadPlanKey(supabase: SupabaseClient, userId: string): Promise<"free" | PlanId> {
  const { data, error } = await supabase.from("subscriptions").select("plan, status").eq("user_id", userId).maybeSingle()
  if (error) throw new ScanReadError(error.message)
  if (data && canIssueInvoices(data.status as string) && isPlanId(data.plan)) return data.plan
  return "free"
}

/** Espace utilisé ; `null` si la migration n'est pas appliquée. */
export async function loadUsage(supabase: SupabaseClient, userId: string): Promise<{ documents: number; bytes: number } | null> {
  const docs = await supabase.from("scanned_documents").select("id", { count: "exact", head: true }).eq("user_id", userId)
  if (docs.error) {
    if (isMissingSchemaError(docs.error)) return null
    throw new ScanReadError(docs.error.message)
  }
  const pages = await supabase.from("scanned_document_pages").select("bytes").eq("user_id", userId).limit(60_000)
  if (pages.error) {
    if (isMissingSchemaError(pages.error)) return null
    throw new ScanReadError(pages.error.message)
  }
  const bytes = (pages.data ?? []).reduce((sum, p) => sum + (Number((p as { bytes: number }).bytes) || 0), 0)
  return { documents: docs.count ?? 0, bytes }
}

export function usageOf(plan: "free" | PlanId, used: { documents: number; bytes: number }): ScanUsage {
  return { ...used, plan, quota: quotaOf(plan) }
}

/** Adresses signées de plusieurs fichiers : un fichier sans adresse reste simplement absent. */
export async function signedUrls(supabase: SupabaseClient, paths: string[]): Promise<Map<string, string>> {
  const out = new Map<string, string>()
  if (paths.length === 0) return out
  try {
    const { data } = await supabase.storage.from(SCAN_BUCKET).createSignedUrls(paths, SIGNED_URL_SECONDS)
    for (const item of data ?? []) if (item.signedUrl && item.path) out.set(item.path, item.signedUrl)
  } catch (err) {
    console.error("[scan] adresses signées :", err instanceof Error ? err.message : err)
  }
  return out
}

export function pagePath(userId: string, documentId: string, position: number): string {
  return `${userId}/${documentId}/${position}.webp`
}
