/**
 * Export des ventes au format CSV, pour le comptable : une ligne par facture
 * (ou avoir) et par taux de TVA.
 *
 * Format pensé pour un tableur en français et les imports des logiciels
 * comptables :
 *   - séparateur point-virgule, fins de ligne CRLF, UTF-8 avec BOM (Excel) ;
 *   - montants sans séparateur de milliers, virgule décimale (« 1234,56 ») ;
 *   - avoirs en montants négatifs, avec le numéro de la facture d'origine ;
 *   - dates JJ/MM/AAAA.
 *
 * Injection de formules : un texte qui commence par =, +, -, @, tabulation ou
 * retour chariot est préfixé d'une apostrophe, pour qu'un tableur ne
 * l'exécute pas (OWASP, « CSV Injection »). Les montants, produits ici, n'en
 * ont pas besoin.
 *
 * Module pur : testé dans __tests__/accountant-exports.test.ts.
 */
import { PAYMENT_LABELS, formatRate, round2, vatGroups, type VatLine } from "@/lib/accountant/rules"
import type { PaymentState } from "@/lib/accountant/types"

export interface CsvClient {
  name?: string | null
  siren?: string | null
  vat_number?: string | null
}

export interface CsvInvoice {
  invoice_number: string
  issue_date: string
  due_date?: string | null
  payment: PaymentState
  subtotal_ht: number
  total_vat: number
  total_ttc: number
  vat_treatment?: string | null
  lines: VatLine[] | null
  client: CsvClient | null
}

export interface CsvCreditNote {
  credit_note_number: string
  issue_date: string
  original_invoice_number?: string | null
  subtotal_ht: number
  total_vat: number
  total_ttc: number
  vat_treatment?: string | null
  lines: VatLine[] | null
  client: CsvClient | null
}

export const CSV_HEADER = [
  "Type", "Numéro", "Date", "Échéance", "Client", "SIREN client", "N° TVA client",
  "Facture d'origine", "Taux TVA", "Motif TVA", "Base HT", "TVA", "Total TTC", "Statut de paiement",
]

/** Montant « 1234,56 » (« -1234,56 » pour un avoir). */
export function csvAmount(n: number): string {
  const v = round2(n)
  return (Object.is(v, -0) ? 0 : v).toFixed(2).replace(".", ",")
}

/** « 2026-09-12 » → « 12/09/2026 ». */
export function csvDate(iso: string | null | undefined): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso ?? "")
  return m ? `${m[3]}/${m[2]}/${m[1]}` : ""
}

/** Texte neutralisé : jamais interprété comme une formule par un tableur. */
export function csvText(value: string | null | undefined): string {
  const v = (value ?? "").replace(/\r\n|\r|\n/g, " ")
  return /^[=+\-@\t]/.test(v) ? `'${v}` : v
}

/** Champ échappé : entre guillemets s'il contient un séparateur, un guillemet ou un saut de ligne. */
export function csvField(value: string): string {
  return /[;"\r\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value
}

function rowOf(cells: string[]): string {
  return cells.map(csvField).join(";")
}

interface DocLike {
  type: "Facture" | "Avoir"
  number: string
  date: string
  due: string | null
  client: CsvClient | null
  origin: string | null
  payment: string
  sign: 1 | -1
  lines: VatLine[] | null
  treatment: string | null | undefined
  totals: { ht: number; vat: number; ttc: number }
}

function docRows(d: DocLike): string[] {
  const groups = vatGroups(d.lines, d.treatment)
  const common = (rate: string, motif: string, ht: number, vat: number) => rowOf([
    d.type,
    csvText(d.number),
    csvDate(d.date),
    csvDate(d.due),
    csvText(d.client?.name),
    csvText(d.client?.siren?.replace(/\s/g, "")),
    csvText(d.client?.vat_number?.replace(/\s/g, "")),
    csvText(d.origin),
    rate,
    csvText(motif),
    csvAmount(d.sign * ht),
    csvAmount(d.sign * vat),
    csvAmount(d.sign * (ht + vat)),
    d.payment,
  ])
  // Document sans lignes (ancien format) : une seule ligne avec ses totaux
  if (groups.length === 0) {
    return [common("", "", d.totals.ht, d.totals.vat)]
  }
  return groups.map((g) => common(formatRate(g.rate), g.rate === 0 && g.treatment ? g.label : "", g.base, g.vat))
}

/**
 * Contenu du fichier : en-tête, factures puis avoirs, chacun trié par date
 * puis numéro. Chaîne prête à télécharger (BOM compris).
 */
export function buildSalesCsv({ invoices, creditNotes }: { invoices: CsvInvoice[]; creditNotes: CsvCreditNote[] }): string {
  const byDate = <T extends { issue_date: string }>(key: (x: T) => string) => (a: T, b: T) =>
    a.issue_date.localeCompare(b.issue_date) || key(a).localeCompare(key(b), "fr", { numeric: true })

  const rows: string[] = [rowOf(CSV_HEADER)]
  for (const inv of [...invoices].sort(byDate((i) => i.invoice_number))) {
    rows.push(...docRows({
      type: "Facture",
      number: inv.invoice_number,
      date: inv.issue_date,
      due: inv.due_date ?? null,
      client: inv.client,
      origin: null,
      payment: PAYMENT_LABELS[inv.payment],
      sign: 1,
      lines: inv.lines,
      treatment: inv.vat_treatment,
      totals: { ht: inv.subtotal_ht, vat: inv.total_vat, ttc: inv.total_ttc },
    }))
  }
  for (const cn of [...creditNotes].sort(byDate((c) => c.credit_note_number))) {
    rows.push(...docRows({
      type: "Avoir",
      number: cn.credit_note_number,
      date: cn.issue_date,
      due: null,
      client: cn.client,
      origin: cn.original_invoice_number ?? null,
      payment: "",
      sign: -1,
      lines: cn.lines,
      treatment: cn.vat_treatment,
      totals: { ht: cn.subtotal_ht, vat: cn.total_vat, ttc: cn.total_ttc },
    }))
  }
  return "﻿" + rows.join("\r\n") + "\r\n"
}
