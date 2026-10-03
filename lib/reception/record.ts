/**
 * Passage d'une facture lue (ou saisie) à l'enregistrement : champs résumés
 * pour la liste, clés de doublon, validation de la saisie manuelle.
 * Fonctions pures, partagées par l'API et la démo.
 */
import { asSiren, clip, isRealDate, round2 } from "@/lib/reception/fields"
import { normalizeText } from "@/lib/reception/text"
import type { ManualEntry, ParsedInvoice, ReceivedFormat } from "@/lib/reception/types"

/** Champs d'une facture reçue, tels qu'enregistrés (table received_invoices). */
export interface ReceivedRecord {
  format: ReceivedFormat
  document_type: string
  invoice_number: string
  issue_date: string
  due_date: string | null
  currency: string
  supplier_name: string
  supplier_siren: string | null
  supplier_vat_number: string | null
  buyer_name: string | null
  buyer_siren: string | null
  total_ht: number
  total_vat: number
  total_ttc: number
  /** Net à payer (BT-115), acomptes déduits. */
  amount_due: number
  /** Facture lue en entier (null pour une saisie manuelle). */
  data: ParsedInvoice | null
  /** Numéro normalisé, pour la recherche de doublons. */
  number_key: string
  /** Fournisseur + numéro + année : unique par compte. */
  dedup_key: string
}

/** Numéro normalisé (casse et espaces). */
export function numberKey(number: string): string {
  return number.trim().replace(/\s+/g, "").toUpperCase()
}

/** Fournisseur : son SIREN, à défaut son nom normalisé. */
export function supplierKey(siren: string | null | undefined, name: string | null | undefined): string {
  const s = asSiren(siren)
  if (s) return `siren:${s}`
  return `nom:${normalizeText(name ?? "").replace(/[^a-z0-9]/g, "")}`
}

/** Clé d'unicité (DGFiP : numéro, fournisseur, année de la facture). */
export function dedupKey(siren: string | null | undefined, name: string | null | undefined, number: string, issueDate: string): string {
  return `${supplierKey(siren, name)}|${numberKey(number)}|${issueDate.slice(0, 4)}`
}

/** Deux fournisseurs sont-ils le même ? Par SIREN quand les deux en ont un, sinon par nom. */
export function sameSupplier(
  a: { siren: string | null | undefined; name: string | null | undefined },
  b: { siren: string | null | undefined; name: string | null | undefined },
): boolean {
  const sa = asSiren(a.siren)
  const sb = asSiren(b.siren)
  if (sa && sb) return sa === sb
  const na = normalizeText(a.name ?? "").replace(/[^a-z0-9]/g, "")
  const nb = normalizeText(b.name ?? "").replace(/[^a-z0-9]/g, "")
  return !!na && na === nb
}

/** Enregistrement d'une facture structurée ; null si une donnée indispensable manque. */
export function recordFromParsed(inv: ParsedInvoice, format: Exclude<ReceivedFormat, "pdf">): ReceivedRecord | null {
  const t = inv.totals
  const ttc = t.grand_total ?? t.due_payable
  if (!inv.number || !inv.issue_date || !inv.seller.name || ttc === null) return null
  const vatSum = inv.vat.length ? round2(inv.vat.reduce((s, v) => s + v.tax, 0)) : null
  const linesSum = inv.lines.length ? round2(inv.lines.reduce((s, l) => s + l.net_amount, 0)) : null
  const tva = t.tax_total ?? vatSum ?? 0
  const ht = t.tax_basis ?? (t.line_total !== null ? round2(t.line_total - (t.allowances ?? 0) + (t.charges ?? 0)) : null) ?? linesSum ?? round2(ttc - tva)
  return {
    format,
    document_type: inv.type_code,
    invoice_number: inv.number,
    issue_date: inv.issue_date,
    due_date: inv.due_date,
    currency: inv.currency,
    supplier_name: inv.seller.name,
    supplier_siren: inv.seller.siren,
    supplier_vat_number: inv.seller.vat_number,
    buyer_name: inv.buyer.name,
    buyer_siren: inv.buyer.siren,
    total_ht: ht,
    total_vat: tva,
    total_ttc: ttc,
    amount_due: t.due_payable ?? ttc,
    data: inv,
    number_key: numberKey(inv.number),
    dedup_key: dedupKey(inv.seller.siren, inv.seller.name, inv.number, inv.issue_date),
  }
}

export function recordFromManual(entry: ManualEntry): ReceivedRecord {
  return {
    format: "pdf",
    document_type: entry.document_type,
    invoice_number: entry.number,
    issue_date: entry.issue_date,
    due_date: entry.due_date,
    currency: "EUR",
    supplier_name: entry.supplier_name,
    supplier_siren: entry.supplier_siren,
    supplier_vat_number: null,
    buyer_name: null,
    buyer_siren: null,
    total_ht: entry.total_ht,
    total_vat: entry.total_vat,
    total_ttc: entry.total_ttc,
    amount_due: entry.total_ttc,
    data: null,
    number_key: numberKey(entry.number),
    dedup_key: dedupKey(entry.supplier_siren, entry.supplier_name, entry.number, entry.issue_date),
  }
}

/** Montant saisi (« 1 234,56 » ou 1234.56) ; null si illisible. */
function amount(value: unknown): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? round2(value) : null
  if (typeof value !== "string") return null
  const v = value.replace(/[\s  €]/g, "").replace(",", ".")
  if (!/^-?\d+(\.\d{1,2})?$/.test(v)) return null
  return round2(Number(v))
}

const MAX_AMOUNT = 100_000_000

/** Valide la saisie manuelle d'un PDF simple (corps JSON non fiable). */
export function parseManualEntry(raw: unknown): { ok: true; entry: ManualEntry } | { ok: false; error: string; field?: string } {
  if (!raw || typeof raw !== "object") return { ok: false, error: "Saisie manquante." }
  const r = raw as Record<string, unknown>
  const str = (k: string) => (typeof r[k] === "string" ? (r[k] as string).trim() : "")

  const supplier = clip(str("supplier_name"), 200)
  if (!supplier) return { ok: false, error: "Indiquez le fournisseur.", field: "supplier_name" }
  const sirenRaw = str("supplier_siren").replace(/\s+/g, "")
  if (sirenRaw && !/^\d{9}$/.test(sirenRaw)) return { ok: false, error: "Le SIREN compte 9 chiffres.", field: "supplier_siren" }
  const number = clip(str("number"), 60)
  if (!number) return { ok: false, error: "Indiquez le numéro de la facture.", field: "number" }
  const issue = str("issue_date")
  if (!isRealDate(issue)) return { ok: false, error: "Indiquez la date de la facture.", field: "issue_date" }
  const due = str("due_date")
  if (due && !isRealDate(due)) return { ok: false, error: "Date d'échéance invalide.", field: "due_date" }

  const ht = amount(r.total_ht)
  const tva = amount(r.total_vat)
  const ttc = amount(r.total_ttc)
  if (ht === null) return { ok: false, error: "Indiquez le montant HT.", field: "total_ht" }
  if (tva === null) return { ok: false, error: "Indiquez le montant de TVA (0 s'il n'y en a pas).", field: "total_vat" }
  if (ttc === null) return { ok: false, error: "Indiquez le montant TTC.", field: "total_ttc" }
  if ([ht, tva, ttc].some((n) => Math.abs(n) > MAX_AMOUNT)) return { ok: false, error: "Montant trop élevé.", field: "total_ttc" }

  return {
    ok: true,
    entry: {
      document_type: r.document_type === "381" ? "381" : "380",
      supplier_name: supplier,
      supplier_siren: sirenRaw || null,
      number,
      issue_date: issue,
      due_date: due || null,
      total_ht: ht,
      total_vat: tva,
      total_ttc: ttc,
    },
  }
}
