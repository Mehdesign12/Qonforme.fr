/**
 * Démo : données de lib/demo/data.ts ramenées aux types de client-data.ts,
 * pour que /demo/clients* passe par les mêmes calculs que /clients*.
 * Seuls les champs que l'application réelle connaît sont repris (pas de
 * contact nommé ni d'activité : la fiche client réelle ne les a pas).
 */
import {
  DEMO_CLIENTS, DEMO_CREDIT_NOTES, DEMO_INVOICES, DEMO_QUOTES, DEMO_TODAY,
  type DemoClient,
} from "@/lib/demo/data"
import { sirenToVAT } from "@/lib/utils/invoice"
import type { ClientRecord, MetricCreditNote, MetricInvoice, MetricQuote } from "./client-data"

export const DEMO_YEAR = Number(DEMO_TODAY.slice(0, 4))

export function demoClientRecord(c: DemoClient): ClientRecord {
  return {
    id: c.id,
    name: c.name,
    siren: c.siren ?? null,
    // Numéro de TVA calculé depuis le SIREN fictif, comme à la recherche Sirene
    vat_number: c.siren ? sirenToVAT(c.siren) : null,
    email: c.email,
    phone: c.phone,
    address: c.address,
    zip_code: c.zip_code,
    city: c.city,
    country: "FR",
    is_archived: false,
    created_at: DEMO_TODAY,
  }
}

export const demoClientRecords = (): ClientRecord[] => DEMO_CLIENTS.map(demoClientRecord)

export const demoMetricInvoices = (): MetricInvoice[] =>
  DEMO_INVOICES.map((i) => ({
    id: i.id, client_id: i.client_id, invoice_number: i.invoice_number, status: i.status,
    issue_date: i.issue_date, due_date: i.due_date, total_ttc: i.total_ttc, lines: i.lines,
  }))

export const demoMetricQuotes = (clientId: string): MetricQuote[] =>
  DEMO_QUOTES.filter((q) => q.client_id === clientId).map((q) => ({
    id: q.id, quote_number: q.quote_number, status: q.status, issue_date: q.issue_date,
    total_ttc: q.total_ttc, lines: q.lines,
  }))

export const demoMetricCreditNotes = (): MetricCreditNote[] => {
  const byNumber = new Map(DEMO_INVOICES.map((i) => [i.invoice_number, i.id]))
  return DEMO_CREDIT_NOTES.map((c) => ({
    id: c.id, client_id: c.client.id, credit_note_number: c.credit_note_number,
    original_invoice_id: byNumber.get(c.original_invoice_number) ?? null,
    reason: c.reason, issue_date: c.issue_date, total_ttc: c.total_ttc,
  }))
}
