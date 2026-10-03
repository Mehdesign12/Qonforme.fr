/**
 * Contenu d'un dossier pour une période, à partir des documents lus : même
 * calcul pour l'espace comptable réel (lib/accountant/server.ts) et sa démo
 * (lib/demo/accountant.ts). Module pur.
 *
 * Les brouillons et factures annulées sont écartés ici aussi (isIssuedInvoice),
 * en plus du filtre de la requête.
 */
import {
  LIST_MAX_ROWS, addVat, computeTotals, isIssuedInvoice, paymentState, round2, sortedVat, vatGroups, type VatLine,
} from "@/lib/accountant/rules"
import type {
  DossierCreditNote, DossierData, DossierInvoice, DossierSupplierInvoice, Period, VatRow,
} from "@/lib/accountant/types"

export interface DossierInvoiceInput {
  id: string
  invoice_number: string | null
  status: string
  issue_date: string
  due_date: string | null
  subtotal_ht: number | string | null
  total_vat: number | string | null
  total_ttc: number | string | null
  lines: VatLine[] | null
  client_name: string | null
}

export interface DossierCreditInput {
  id: string
  credit_note_number: string
  issue_date: string
  subtotal_ht: number | string | null
  total_vat: number | string | null
  total_ttc: number | string | null
  lines: VatLine[] | null
  reason: string | null
  client_name: string | null
  original_invoice_number: string | null
}

const n = (v: unknown) => {
  const x = typeof v === "string" ? parseFloat(v) : Number(v)
  return Number.isFinite(x) ? round2(x) : 0
}

export function buildDossier(params: {
  company: { name: string | null; siren: string | null; city: string | null } | null
  period: Period
  today: string
  invoices: DossierInvoiceInput[]
  creditNotes: DossierCreditInput[]
  supplierInvoices: DossierSupplierInvoice[] | null
}): DossierData {
  const { period, today } = params
  const inPeriod = (d: string) => d >= period.from && d <= period.to
  const vat = new Map<string, VatRow>()

  const invoices: DossierInvoice[] = params.invoices
    .filter((r) => isIssuedInvoice(r) && inPeriod(r.issue_date))
    .map((r) => {
      addVat(vat, vatGroups(r.lines))
      return {
        id: r.id,
        number: String(r.invoice_number),
        clientName: r.client_name,
        issueDate: r.issue_date,
        dueDate: r.due_date ?? "",
        status: r.status,
        payment: paymentState(r.status, r.due_date, today),
        totalHt: n(r.subtotal_ht),
        totalVat: n(r.total_vat),
        totalTtc: n(r.total_ttc),
      }
    })

  const creditNotes: DossierCreditNote[] = params.creditNotes
    .filter((r) => inPeriod(r.issue_date))
    .map((r) => {
      addVat(vat, vatGroups(r.lines), -1)
      return {
        id: r.id,
        number: r.credit_note_number,
        clientName: r.client_name,
        issueDate: r.issue_date,
        invoiceNumber: r.original_invoice_number,
        reason: r.reason,
        totalHt: n(r.subtotal_ht),
        totalVat: n(r.total_vat),
        totalTtc: n(r.total_ttc),
      }
    })

  // Plus récents d'abord à l'écran
  const desc = <T extends { issueDate: string; number: string }>(a: T, b: T) =>
    b.issueDate.localeCompare(a.issueDate) || b.number.localeCompare(a.number, "fr", { numeric: true })
  invoices.sort(desc)
  creditNotes.sort(desc)

  return {
    company: {
      name: params.company?.name?.trim() || "Entreprise sans nom",
      siren: params.company?.siren ?? null,
      city: params.company?.city ?? null,
    },
    period,
    totals: computeTotals(invoices, creditNotes),
    vat: sortedVat(vat),
    invoices: invoices.slice(0, LIST_MAX_ROWS),
    creditNotes: creditNotes.slice(0, LIST_MAX_ROWS),
    supplierInvoices: params.supplierInvoices?.slice(0, LIST_MAX_ROWS) ?? null,
    truncated: invoices.length > LIST_MAX_ROWS || creditNotes.length > LIST_MAX_ROWS || (params.supplierInvoices?.length ?? 0) > LIST_MAX_ROWS,
  }
}
