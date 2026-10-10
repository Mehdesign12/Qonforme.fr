/**
 * Chantiers de la démo (formule Artisan), sur les mêmes composants que
 * l'application : la page Chantiers, la fiche d'un chantier et le panneau
 * « Facturation du chantier » des devis.
 *
 * Le chantier en sous-traitance reprend les documents calculés par
 * lib/artisan dans lib/demo/data.ts (devis signé en autoliquidation, acompte,
 * deux situations avec retenue de garantie). Les deux autres rattachent des
 * documents déjà présents dans la démo.
 */
import {
  DEMO_CREDIT_NOTES, DEMO_INVOICES, DEMO_PURCHASE_ORDERS, DEMO_QUOTES, DEMO_SUB_CHANTIER_ID, DEMO_TODAY,
  demoClient, demoQuote,
} from "@/lib/demo/data"
import { chantierSummary, type Chantier, type ChantierDoc, type ChantierSummary } from "@/lib/artisan/chantier"
import { invoiceKindLabel } from "@/lib/artisan/billing"
import { quoteBillingState, type InvoiceForBilling } from "@/lib/artisan/quote-billing"
import type { QuoteBilling } from "@/lib/artisan/build"

const client = (id: string) => {
  const c = demoClient(id)
  return { id: c.id, name: c.name, email: c.email, siren: c.siren ?? null, vat_number: null, city: c.city }
}

export const DEMO_CHANTIERS: Chantier[] = [
  {
    id: DEMO_SUB_CHANTIER_ID,
    client_id: "arvel",
    client: client("arvel"),
    name: "Résidence Le Clos Fleuri",
    address: "ZAC des Hauts de Saint-Aubin, bâtiment B",
    zip_code: "49000",
    city: "Angers",
    start_date: "2026-07-20",
    end_date: "2026-11-27",
    status: "in_progress",
    reception_date: null,
    retention_mode: "retenue",
    retention_rate: 5,
    retention_released_at: null,
    subcontracting: true,
    notes: "Lot plâtrerie en sous-traitance du Groupe Arvel Construction : factures en autoliquidation.",
    created_at: "2026-06-30",
  },
  {
    id: "hall-tilleuls",
    client_id: "sci-tilleuls",
    client: client("sci-tilleuls"),
    name: "Rénovation du hall, SCI Les Tilleuls",
    address: "18 allée des Tilleuls",
    zip_code: "44300",
    city: "Nantes",
    start_date: "2026-09-01",
    end_date: "2026-09-18",
    status: "received",
    reception_date: "2026-09-18",
    retention_mode: "aucune",
    retention_rate: 0,
    retention_released_at: null,
    subcontracting: false,
    notes: null,
    created_at: "2026-08-28",
  },
  {
    id: "combles-lambert",
    client_id: "lambert",
    client: client("lambert"),
    name: "Combles de M. et Mme Lambert",
    address: "28 chemin des Vignes",
    zip_code: "49130",
    city: "Les Ponts-de-Cé",
    start_date: "2026-10-19",
    end_date: null,
    status: "preparation",
    reception_date: null,
    retention_mode: "aucune",
    retention_rate: 0,
    retention_released_at: null,
    subcontracting: false,
    notes: null,
    created_at: "2026-09-28",
  },
]

/** Documents rattachés à chaque chantier (par numéro). */
const MEMBERS: Record<string, { quotes: string[]; invoices: string[]; pos: string[] }> = {
  [DEMO_SUB_CHANTIER_ID]: { quotes: ["D-2026-024"], invoices: ["F-2026-0124", "F-2026-0130", "F-2026-0137"], pos: [] },
  "hall-tilleuls": { quotes: ["D-2026-030"], invoices: ["F-2026-0141"], pos: ["BC-2026-003"] },
  "combles-lambert": { quotes: ["D-2026-035"], invoices: [], pos: [] },
}

export function demoChantier(id: string): Chantier | undefined {
  return DEMO_CHANTIERS.find((c) => c.id === id)
}

/** Chantier d'un devis ou d'une facture de la démo (par numéro). */
export function demoChantierOf(number: string | null | undefined): Chantier | undefined {
  if (!number) return undefined
  const id = Object.keys(MEMBERS).find((k) => MEMBERS[k].quotes.includes(number) || MEMBERS[k].invoices.includes(number) || MEMBERS[k].pos.includes(number))
  return id ? demoChantier(id) : undefined
}

export function demoChantierDocs(id: string): ChantierDoc[] {
  const m = MEMBERS[id]
  if (!m) return []
  const docs: ChantierDoc[] = []
  for (const q of DEMO_QUOTES.filter((x) => m.quotes.includes(x.quote_number))) {
    docs.push({ type: "quote", id: q.id, number: q.quote_number, status: q.status, issue_date: q.issue_date, total_ht: q.subtotal_ht, total_ttc: q.total_ttc })
  }
  for (const i of DEMO_INVOICES.filter((x) => x.invoice_number && m.invoices.includes(x.invoice_number))) {
    docs.push({
      type: "invoice", id: i.id, number: i.invoice_number, status: i.status, issue_date: i.issue_date,
      total_ht: i.subtotal_ht, total_ttc: i.total_ttc, kind: i.invoice_kind ?? "standard",
      kind_label: i.invoice_kind ? invoiceKindLabel(i.invoice_kind, i.billing_context) : null,
      retention_amount: i.retention_amount ?? 0, paid_at: i.paid_at ?? null,
    })
    for (const c of DEMO_CREDIT_NOTES.filter((x) => x.original_invoice_number === i.invoice_number)) {
      docs.push({ type: "credit_note", id: c.id, number: c.credit_note_number, status: "issued", issue_date: c.issue_date, total_ht: c.subtotal_ht, total_ttc: c.total_ttc, original_invoice_id: i.id })
    }
  }
  for (const p of DEMO_PURCHASE_ORDERS.filter((x) => m.pos.includes(x.po_number))) {
    docs.push({ type: "purchase_order", id: p.id, number: p.po_number, status: p.status, issue_date: p.issue_date, total_ht: p.subtotal_ht, total_ttc: p.total_ttc })
  }
  return docs.sort((a, b) => (b.issue_date ?? "").localeCompare(a.issue_date ?? ""))
}

export function demoChantierSummary(id: string): ChantierSummary {
  const c = demoChantier(id)
  return chantierSummary(demoChantierDocs(id), { reception_date: c?.reception_date ?? null, retention_released_at: c?.retention_released_at ?? null }, DEMO_TODAY)
}

/** État de facturation d'un devis de la démo (panneau « Facturation du chantier »). */
export function demoQuoteBilling(quoteNumberOrId: string): QuoteBilling | null {
  const q = demoQuote(quoteNumberOrId)
  if (!q || q.status !== "accepted" || q.converted_invoice_number) return null
  const chantier = demoChantierOf(q.quote_number)
  const invoices: InvoiceForBilling[] = DEMO_INVOICES
    .filter((i) => i.quote_number === q.quote_number && i.invoice_kind)
    .map((i) => ({
      id: i.id, invoice_number: i.invoice_number, status: i.status, issue_date: i.issue_date,
      invoice_kind: i.invoice_kind, billing_context: i.billing_context, lines: i.lines,
      total_ttc: i.total_ttc, retention_amount: i.retention_amount ?? 0,
    }))
  const quote = {
    id: q.id, quote_number: q.quote_number, status: q.status, issue_date: q.issue_date, lines: q.lines,
    total_ttc: q.total_ttc, client_id: q.client_id, chantier_id: chantier?.id ?? null, converted_invoice_id: null,
  }
  return {
    quote,
    invoices,
    state: quoteBillingState(quote, invoices),
    chantier: chantier
      ? { id: chantier.id, name: chantier.name, retention_mode: chantier.retention_mode, retention_rate: chantier.retention_rate, subcontracting: chantier.subcontracting }
      : null,
  }
}
