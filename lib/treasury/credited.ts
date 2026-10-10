import type { SupabaseClient } from "@supabase/supabase-js"

/**
 * Total TTC des avoirs déjà émis, par facture d'origine.
 * Sert à calculer le reste dû (Trésorerie, Relances) : un avoir partiel ne
 * solde pas la facture, il réduit seulement ce que le client doit encore.
 */
export async function creditedByInvoice(
  supabase: SupabaseClient,
  userId: string,
  invoiceIds: string[],
): Promise<{ credited: Record<string, number>; error: string | null }> {
  const credited: Record<string, number> = {}
  if (!invoiceIds.length) return { credited, error: null }
  const { data, error } = await supabase
    .from("credit_notes")
    .select("original_invoice_id, total_ttc")
    .eq("user_id", userId)
    .in("original_invoice_id", invoiceIds)
  if (error) return { credited, error: error.message }
  for (const c of data ?? []) {
    if (!c.original_invoice_id) continue
    credited[c.original_invoice_id] = (credited[c.original_invoice_id] || 0) + (c.total_ttc || 0)
  }
  return { credited, error: null }
}

/** Le client joint par PostgREST arrive en objet ou en tableau selon la relation */
export function joinedOne<T>(v: T | T[] | null | undefined): T | null {
  return Array.isArray(v) ? v[0] ?? null : v ?? null
}
