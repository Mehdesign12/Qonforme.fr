/**
 * Liste des factures : export CSV de la sélection et vues enregistrées.
 * Fonctions pures, partagées par la page réelle et la démo, testées dans
 * __tests__/invoice-list-tools.test.ts.
 *
 * CSV au format des exports comptables (lib/accountant/csv.ts) : point-virgule,
 * CRLF, BOM UTF-8 pour Excel, virgule décimale, dates JJ/MM/AAAA, textes
 * protégés contre l'injection de formules.
 */
import { csvAmount, csvDate, csvField, csvText } from "@/lib/accountant/csv"
import { INVOICE_STATUS_LABELS } from "@/lib/utils/invoice"
import { DRAFT_INVOICE_LABEL } from "@/lib/utils/document-numbering"

export interface ListCsvInvoice {
  invoice_number: string | null
  status: string
  issue_date: string
  due_date: string
  total_ttc: number
  client_name: string | null
  subject: string | null
  is_archived?: boolean
}

/** Factures au plus par archive ZIP de PDF (POST /api/invoices/bulk-pdf). */
export const BULK_PDF_LIMIT = 50

export const LIST_CSV_HEADER = ["Numéro", "Client", "Objet", "Émise le", "Échéance", "Total TTC", "Statut", "Archivée"]

export function invoicesToCsv(rows: ListCsvInvoice[]): string {
  const lines = [LIST_CSV_HEADER, ...rows.map((r) => [
    csvText(r.invoice_number ?? DRAFT_INVOICE_LABEL),
    csvText(r.client_name),
    csvText(r.subject),
    csvDate(r.issue_date),
    csvDate(r.due_date),
    csvAmount(r.total_ttc),
    csvText((INVOICE_STATUS_LABELS as Record<string, string>)[r.status] ?? r.status),
    r.is_archived ? "Oui" : "Non",
  ])]
  return "﻿" + lines.map((cells) => cells.map(csvField).join(";")).join("\r\n") + "\r\n"
}

/* ------------------------------------------------------------------ */
/* Vues enregistrées (sur l'appareil)                                  */
/* ------------------------------------------------------------------ */

export interface SavedInvoiceView {
  name: string
  tab: string
  query: string
}

export const SAVED_VIEWS_KEY = "qonforme:factures:vues"
export const SAVED_VIEWS_MAX = 8

/** Vues relues du stockage : toute entrée malformée est ignorée. */
export function parseSavedViews(raw: string | null, tabs: readonly string[]): SavedInvoiceView[] {
  if (!raw) return []
  try {
    const data = JSON.parse(raw)
    if (!Array.isArray(data)) return []
    return data
      .filter((v): v is SavedInvoiceView =>
        !!v && typeof v.name === "string" && typeof v.tab === "string" && typeof v.query === "string" && tabs.includes(v.tab))
      .map((v) => ({ name: v.name.trim().slice(0, 40), tab: v.tab, query: v.query.slice(0, 80) }))
      .filter((v) => v.name)
      .slice(0, SAVED_VIEWS_MAX)
  } catch {
    return []
  }
}

/** Ajoute (ou remplace, même nom sans tenir compte de la casse) une vue, la plus récente en tête. */
export function upsertView(views: SavedInvoiceView[], view: SavedInvoiceView): SavedInvoiceView[] {
  const name = view.name.trim().slice(0, 40)
  if (!name) return views
  const rest = views.filter((v) => v.name.toLowerCase() !== name.toLowerCase())
  return [{ ...view, name }, ...rest].slice(0, SAVED_VIEWS_MAX)
}
