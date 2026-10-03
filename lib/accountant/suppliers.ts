/**
 * Factures fournisseurs d'un dossier, pour le comptable : lues dans la table
 * de réception (`received_invoices`, migration 20261003_received_invoices.sql
 * de la réception des factures fournisseurs), en lecture seule.
 *
 * Tant que cette table (ou l'une des colonnes lues) n'existe pas, la fonction
 * renvoie null et l'espace comptable n'affiche rien des factures fournisseurs.
 */
import type { SupabaseClient } from "@supabase/supabase-js"
import { isMissingSchemaError } from "@/lib/supabase/schema-guard"
import type { DossierSupplierInvoice, Period } from "@/lib/accountant/types"

export const SUPPLIER_TABLE = "received_invoices"
const COLUMNS = "id, user_id, invoice_number, issue_date, supplier_name, total_ht, total_vat, total_ttc, status"
const MAX_ROWS = 2000

/** Statuts du cycle de vie d'une facture reçue (spécifications externes DGFiP v3.2, tableau 8). */
export const SUPPLIER_STATUS_LABELS: Record<string, string> = {
  received: "Reçue",
  made_available: "Mise à disposition",
  in_hand: "Prise en charge",
  approved: "Approuvée",
  partially_approved: "Approuvée en partie",
  disputed: "En litige",
  suspended: "Suspendue",
  completed: "Complétée",
  refused: "Refusée",
  payment_sent: "Paiement transmis",
  cashed: "Encaissée",
  rejected: "Rejetée",
}

const num = (v: unknown): number | null => {
  if (v === null || v === undefined || v === "") return null
  const n = typeof v === "string" ? parseFloat(v) : Number(v)
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : null
}

export async function loadSupplierInvoices(db: SupabaseClient, ownerId: string, period: Period): Promise<DossierSupplierInvoice[] | null> {
  try {
    const { data, error } = await db
      .from(SUPPLIER_TABLE)
      .select(COLUMNS)
      .eq("user_id", ownerId)
      .gte("issue_date", period.from)
      .lte("issue_date", period.to)
      .order("issue_date", { ascending: false })
      .limit(MAX_ROWS)
    if (error) {
      if (!isMissingSchemaError(error)) console.error("[accountant] factures fournisseurs", error)
      return null
    }
    return ((data ?? []) as Record<string, unknown>[])
      .filter((r) => r.user_id === ownerId)
      .map((r) => ({
        id: String(r.id),
        supplierName: (r.supplier_name as string | null) ?? null,
        number: (r.invoice_number as string | null) ?? null,
        issueDate: (r.issue_date as string | null) ?? null,
        status: (r.status as string | null) ?? null,
        totalHt: num(r.total_ht),
        totalVat: num(r.total_vat),
        totalTtc: num(r.total_ttc),
      }))
  } catch (err) {
    console.error("[accountant] factures fournisseurs", err)
    return null
  }
}
