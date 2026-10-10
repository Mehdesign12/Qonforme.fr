/**
 * Page Relances de la démo (/demo/relances) : factures et devis fictifs de
 * lib/demo/data.ts, avec leur journal de relances et les réglages d'exemple
 * (DEMO_REMINDER_SETTINGS), à la date fixe de la démo.
 */
import { DEMO_INVOICES, DEMO_QUOTES } from "@/lib/demo/data"
import type { QueueInvoice, QueueQuote } from "@/lib/reminders/queue"

export function demoQueueInvoices(): QueueInvoice[] {
  return DEMO_INVOICES.filter((i) => i.invoice_number).map((i) => ({
    id: i.id,
    invoice_number: i.invoice_number,
    status: i.status,
    issue_date: i.issue_date,
    due_date: i.due_date,
    sent_at: i.sent_at ?? null,
    total_ttc: i.total_ttc,
    client_name: i.client.name,
    client_email: i.client.email,
    reminders: i.reminders ?? [],
  }))
}

export function demoQueueQuotes(): QueueQuote[] {
  return DEMO_QUOTES.filter((q) => q.status === "sent" && !q.converted_invoice_number).map((q) => ({
    id: q.id,
    quote_number: q.quote_number,
    status: q.status,
    issue_date: q.issue_date,
    valid_until: q.valid_until,
    total_ttc: q.total_ttc,
    client_name: q.client.name,
    client_email: q.client.email,
    reminders: [],
  }))
}
