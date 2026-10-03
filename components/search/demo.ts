/**
 * Démo : recherche et « À surveiller » calculés sur les données fictives
 * communes (lib/demo/data), avec les mêmes règles que les routes réelles.
 * Chargé à la demande par la palette et la cloche (import dynamique) pour ne
 * pas alourdir l'application réelle.
 */
import {
  DEMO_CLIENTS, DEMO_INVOICES, DEMO_QUOTES, DEMO_TODAY,
  type DemoClient,
} from "@/lib/demo/data"
import {
  OPEN_INVOICE_STATUSES, SEARCH_LIMIT, STALE_DAYS,
  clientMeta, draftItem, isInvoiceOverdue, mergeAttention, normalizeText, overdueItem, quoteItem, shiftDays, transferItem,
  type AttentionData, type ClientHit, type SearchResults,
} from "@/components/search/model"
import { demoOpenDeclarations } from "@/lib/demo/payment-link"

const isOpen = (status: string) => (OPEN_INVOICE_STATUSES as readonly string[]).includes(status)

function demoClientHit(c: DemoClient): ClientHit {
  const open = DEMO_INVOICES.filter((i) => i.client_id === c.id && isOpen(i.status))
  return {
    id: c.id,
    name: c.name,
    meta: clientMeta({ city: c.city, siren: c.siren, openCount: open.length, openAmount: open.reduce((s, i) => s + i.total_ttc, 0) }),
    href: `/demo/clients/${c.id}`,
  }
}

export function demoSearch(query: string): SearchResults {
  const q = normalizeText(query.trim())
  const digits = /^[\d\s]+$/.test(q) ? q.replace(/\s/g, "") : null
  const has = (s: string | null | undefined) => !!s && normalizeText(s).includes(q)

  return {
    invoices: DEMO_INVOICES
      .filter((i) => has(i.invoice_number) || has(i.client.name))
      .slice(0, SEARCH_LIMIT)
      .map((i) => ({ id: i.id, number: i.invoice_number, client: i.client.name, amount: i.total_ttc, status: i.status, href: `/demo/invoices/${i.id}` })),
    quotes: DEMO_QUOTES
      .filter((d) => has(d.quote_number) || has(d.client.name))
      .slice(0, SEARCH_LIMIT)
      .map((d) => ({ id: d.id, number: d.quote_number, client: d.client.name, amount: d.total_ttc, status: d.status, href: `/demo/quotes/${d.id}` })),
    clients: DEMO_CLIENTS
      .filter((c) => has(c.name) || has(c.city) || (!!digits && !!c.siren?.includes(digits)))
      .slice(0, SEARCH_LIMIT)
      .map(demoClientHit),
  }
}

export function demoAttention(): AttentionData {
  const today = DEMO_TODAY
  const cutoff = shiftDays(today, -STALE_DAYS)

  // La démo n'a pas de date de création : la date d'émission en tient lieu.
  const overdue = DEMO_INVOICES
    .filter((i) => isInvoiceOverdue(i.status, i.due_date, today))
    .sort((a, b) => a.due_date.localeCompare(b.due_date))
    .map((i) => overdueItem({ id: i.id, number: i.invoice_number, client: i.client.name, amount: i.total_ttc, dueDate: i.due_date }, today, `/demo/invoices/${i.id}`))
  const quotes = DEMO_QUOTES
    .filter((d) => d.status === "sent" && d.issue_date < cutoff)
    .sort((a, b) => a.issue_date.localeCompare(b.issue_date))
    .map((d) => quoteItem({ id: d.id, number: d.quote_number, client: d.client.name, sentDay: d.issue_date }, today, `/demo/quotes/${d.id}`))
  const drafts = [
    ...DEMO_INVOICES.filter((i) => i.status === "draft" && i.issue_date < cutoff)
      .map((i) => ({ day: i.issue_date, item: draftItem({ id: i.id, kind: "invoice", number: i.invoice_number, client: i.client.name, createdDay: i.issue_date }, today, `/demo/invoices/${i.id}`) })),
    ...DEMO_QUOTES.filter((d) => d.status === "draft" && d.issue_date < cutoff)
      .map((d) => ({ day: d.issue_date, item: draftItem({ id: d.id, kind: "quote", number: d.quote_number, client: d.client.name, createdDay: d.issue_date }, today, `/demo/quotes/${d.id}`) })),
  ].sort((a, b) => a.day.localeCompare(b.day)).map((x) => x.item)

  const transfers = demoOpenDeclarations().map(({ declaration: d, invoice: i }) =>
    transferItem({ id: d.id, number: i.invoice_number, client: i.client.name, amount: d.amount, transferDate: d.transferDate }, `/demo/invoices/${i.id}`))

  const counts = { overdue: overdue.length, quotes: quotes.length, drafts: drafts.length, transfers: transfers.length }
  return {
    items: mergeAttention(overdue, quotes, drafts, transfers),
    counts,
    total: counts.overdue + counts.quotes + counts.drafts + counts.transfers,
  }
}
