/**
 * Journal des ventes au format CSV, pour l'expert-comptable ou un tableur :
 * une ligne par facture et par avoir (montants négatifs), TVA ventilée par taux.
 *
 * Format pensé pour Excel en français : séparateur « ; », virgule décimale,
 * UTF-8 avec BOM (accents lisibles), fins de ligne CRLF.
 * Logique pure, testée dans __tests__/sales-journal.test.ts.
 */
import type { FecCreditNote, FecInvoice } from "@/lib/export/fec"
import type { InvoiceLine } from "@/types"

const RATES = [20, 10, 5.5, 0] as const

export const SALES_JOURNAL_HEADER = [
  "Date", "Type", "Numéro", "Client", "SIREN client",
  "Base HT 20 %", "TVA 20 %", "Base HT 10 %", "TVA 10 %", "Base HT 5,5 %", "TVA 5,5 %", "Base HT 0 %",
  "Total HT", "Total TVA", "Total TTC", "Statut",
]

const STATUS_FR: Record<string, string> = {
  sent: "Envoyée", pending: "En attente", received: "Reçue", accepted: "Acceptée", rejected: "Rejetée",
  paid: "Payée", overdue: "En retard", credited: "Avoir émis", cancelled: "Annulée",
}

/** 1234.5 → « 1234,50 » ; jamais de séparateur de milliers (le tableur s'en charge) */
export function csvAmount(n: number): string {
  const v = Math.round((n || 0) * 100) / 100
  return (Object.is(v, -0) ? 0 : v).toFixed(2).replace(".", ",")
}

/** Échappe un champ : guillemets doublés, champ entre guillemets si nécessaire. Neutralise les formules. */
export function csvField(v: string): string {
  let s = String(v ?? "")
  // une cellule commençant par = + - @ serait exécutée comme formule par Excel
  if (/^[=+\-@\t\r]/.test(s)) s = "'" + s
  return /[";\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

/** « 2026-10-14 » → « 14/10/2026 » */
function frDate(iso: string): string {
  const [y, m, d] = iso.slice(0, 10).split("-")
  return `${d}/${m}/${y}`
}

function byRate(lines: InvoiceLine[]) {
  const out: Record<string, { ht: number; tva: number }> = {}
  for (const r of RATES) out[r] = { ht: 0, tva: 0 }
  for (const l of lines ?? []) {
    const key = String(RATES.find((r) => r === Number(l.vat_rate)) ?? 20)
    out[key].ht += Number(l.total_ht) || 0
    out[key].tva += Number(l.total_vat) || 0
  }
  return out
}

function row(date: string, type: string, number: string, client: FecInvoice["client"], lines: InvoiceLine[], ht: number, tva: number, ttc: number, status: string, sign: 1 | -1) {
  const r = byRate(lines)
  return [
    frDate(date), type, number, client?.name ?? "", client?.siren ?? "",
    csvAmount(sign * r["20"].ht), csvAmount(sign * r["20"].tva),
    csvAmount(sign * r["10"].ht), csvAmount(sign * r["10"].tva),
    csvAmount(sign * r["5.5"].ht), csvAmount(sign * r["5.5"].tva),
    csvAmount(sign * r["0"].ht),
    csvAmount(sign * ht), csvAmount(sign * tva), csvAmount(sign * ttc), status,
  ].map((v, i) => (i >= 5 && i <= 14 ? v : csvField(v))).join(";")
}

export function generateSalesJournal({ invoices, creditNotes }: { invoices: FecInvoice[]; creditNotes: FecCreditNote[] }): string {
  const rows = [
    ...invoices.map((i) => ({ date: i.issue_date, n: i.invoice_number, line: row(i.issue_date, "Facture", i.invoice_number, i.client, i.lines, i.subtotal_ht, i.total_vat, i.total_ttc, STATUS_FR[i.status] ?? i.status, 1) })),
    ...creditNotes.map((c) => ({ date: c.issue_date, n: c.credit_note_number, line: row(c.issue_date, "Avoir", c.credit_note_number, c.client, c.lines, c.subtotal_ht, c.total_vat, c.total_ttc, "", -1) })),
  ].sort((a, b) => a.date.localeCompare(b.date) || a.n.localeCompare(b.n))

  return "﻿" + [SALES_JOURNAL_HEADER.map(csvField).join(";"), ...rows.map((r) => r.line)].join("\r\n") + "\r\n"
}
