/**
 * Exports téléchargés par le comptable, pour une entreprise et une période :
 *   - FEC : le générateur existant (lib/export/fec.ts), mêmes règles que
 *     l'export de l'artisan (Paramètres › Exports comptables) ;
 *   - ventes au format CSV : une ligne par document et par taux de TVA
 *     (lib/accountant/csv.ts) ;
 *   - archive ZIP des PDF de la période : factures émises (PDF Factur-X, comme
 *     à l'envoi) et avoirs (lib/pdf, lib/accountant/zip.ts).
 *
 * Jamais de brouillon : les factures passent par fetchIssuedInvoices.
 * L'appelant a vérifié l'accès (authorizeDossier) ; `ownerId` vient de la
 * ligne d'accès, jamais de la requête.
 */
import type { SupabaseClient } from "@supabase/supabase-js"
import { generateFec, type FecCreditNote, type FecInvoice } from "@/lib/export/fec"
import { generateInvoicePdf } from "@/lib/pdf/invoice"
import { generateCreditNotePdf } from "@/lib/pdf/credit-note"
import type { InvoiceLine } from "@/types"
import { buildSalesCsv, type CsvCreditNote, type CsvInvoice } from "@/lib/accountant/csv"
import { createZip, type ZipEntry } from "@/lib/accountant/zip"
import { ZIP_MAX_DOCUMENTS, paymentState, type VatLine } from "@/lib/accountant/rules"
import {
  COMPANY_PDF_COLUMNS, CREDIT_LIST_COLUMNS, CREDIT_PDF_COLUMNS, INVOICE_LIST_COLUMNS, INVOICE_PDF_COLUMNS,
  fetchCreditNotes, fetchIssuedInvoices,
} from "@/lib/accountant/server"
import type { Period } from "@/lib/accountant/types"

type Db = SupabaseClient
type Raw = Record<string, unknown>

export type ExportFile = { ok: true; filename: string; contentType: string; body: Uint8Array | string; count: number }
export type ExportError = { ok: false; status: number; error: string; code?: string }

const one = <T>(v: T | T[] | null | undefined): T | null => (Array.isArray(v) ? v[0] ?? null : v ?? null)
const num = (v: unknown) => {
  const x = typeof v === "string" ? parseFloat(v) : Number(v)
  return Number.isFinite(x) ? x : 0
}

/** Partie de nom de fichier : SIREN, sinon nom de l'entreprise simplifié. */
function fileStem(company: { siren?: string | null; name?: string | null } | null): string {
  const siren = company?.siren?.replace(/\s/g, "")
  if (siren && /^\d{9}$/.test(siren)) return siren
  const slug = (company?.name ?? "")
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[^A-Za-z0-9]+/g, "-").replace(/^-+|-+$/g, "").toLowerCase().slice(0, 40)
  return slug || "entreprise"
}

const compact = (iso: string) => iso.replace(/-/g, "")

async function companyOf(db: Db, ownerId: string, columns: string): Promise<Raw | null> {
  const { data, error } = await db.from("companies").select(columns).eq("user_id", ownerId).maybeSingle()
  if (error) throw new Error(`[accountant] entreprise : ${error.message}`)
  return (data as Raw | null) ?? null
}

/* ------------------------------------------------------------------ */
/* FEC                                                                 */
/* ------------------------------------------------------------------ */

export async function buildFecExport(db: Db, ownerId: string, period: Period): Promise<ExportFile | ExportError> {
  const company = await companyOf(db, ownerId, "siren, name")
  const siren = (company?.siren as string | undefined)?.replace(/\s/g, "")
  if (!siren) {
    return {
      ok: false, status: 400, code: "SIREN_MISSING",
      error: "Le SIREN de l'entreprise n'est pas renseigné : le FEC ne peut pas être nommé. L'entreprise doit le compléter dans ses paramètres.",
    }
  }
  const [rawInvoices, rawCredits] = await Promise.all([
    fetchIssuedInvoices(db, ownerId, period, INVOICE_LIST_COLUMNS),
    fetchCreditNotes(db, ownerId, period, CREDIT_LIST_COLUMNS),
  ])
  const invoices: FecInvoice[] = rawInvoices.map((r) => ({
    invoice_number: String(r.invoice_number),
    issue_date: String(r.issue_date),
    lines: (r.lines as InvoiceLine[] | null) ?? [],
    subtotal_ht: num(r.subtotal_ht),
    total_vat: num(r.total_vat),
    total_ttc: num(r.total_ttc),
    status: String(r.status),
    client: one(r.client as FecInvoice["client"]),
  }))
  const creditNotes: FecCreditNote[] = rawCredits.map((r) => ({
    credit_note_number: String(r.credit_note_number),
    issue_date: String(r.issue_date),
    lines: (r.lines as InvoiceLine[] | null) ?? [],
    subtotal_ht: num(r.subtotal_ht),
    total_vat: num(r.total_vat),
    total_ttc: num(r.total_ttc),
    client: one(r.client as FecCreditNote["client"]),
  }))
  return {
    ok: true,
    // Nom officiel : SIREN, « FEC », date de clôture (arrêté du 29 juillet 2013, art. A. 47 A-1 du LPF)
    filename: `${siren}FEC${compact(period.to)}.txt`,
    contentType: "text/plain; charset=utf-8",
    body: generateFec({ invoices, creditNotes }),
    count: invoices.length + creditNotes.length,
  }
}

/* ------------------------------------------------------------------ */
/* Ventes (CSV)                                                        */
/* ------------------------------------------------------------------ */

export async function buildCsvExport(db: Db, ownerId: string, period: Period, today: string): Promise<ExportFile | ExportError> {
  const [company, rawInvoices, rawCredits] = await Promise.all([
    companyOf(db, ownerId, "siren, name"),
    fetchIssuedInvoices(db, ownerId, period, INVOICE_LIST_COLUMNS),
    fetchCreditNotes(db, ownerId, period, CREDIT_LIST_COLUMNS),
  ])
  const invoices: CsvInvoice[] = rawInvoices.map((r) => ({
    invoice_number: String(r.invoice_number),
    issue_date: String(r.issue_date),
    due_date: (r.due_date as string | null) ?? null,
    payment: paymentState(String(r.status), r.due_date as string | null, today),
    subtotal_ht: num(r.subtotal_ht),
    total_vat: num(r.total_vat),
    total_ttc: num(r.total_ttc),
    lines: (r.lines as VatLine[] | null) ?? null,
    client: one(r.client as CsvInvoice["client"]),
  }))
  const creditNotes: CsvCreditNote[] = rawCredits.map((r) => ({
    credit_note_number: String(r.credit_note_number),
    issue_date: String(r.issue_date),
    original_invoice_number: (one(r.original_invoice as { invoice_number?: string } | null)?.invoice_number as string | undefined) ?? null,
    subtotal_ht: num(r.subtotal_ht),
    total_vat: num(r.total_vat),
    total_ttc: num(r.total_ttc),
    lines: (r.lines as VatLine[] | null) ?? null,
    client: one(r.client as CsvCreditNote["client"]),
  }))
  return {
    ok: true,
    filename: `ventes-${fileStem(company)}-${compact(period.from)}-${compact(period.to)}.csv`,
    contentType: "text/csv; charset=utf-8",
    body: buildSalesCsv({ invoices, creditNotes }),
    count: invoices.length + creditNotes.length,
  }
}

/* ------------------------------------------------------------------ */
/* PDF (ZIP)                                                           */
/* ------------------------------------------------------------------ */

export async function buildPdfZipExport(db: Db, ownerId: string, period: Period): Promise<ExportFile | ExportError> {
  const [company, rawInvoices, rawCredits] = await Promise.all([
    companyOf(db, ownerId, COMPANY_PDF_COLUMNS),
    fetchIssuedInvoices(db, ownerId, period, INVOICE_PDF_COLUMNS),
    fetchCreditNotes(db, ownerId, period, CREDIT_PDF_COLUMNS),
  ])
  const total = rawInvoices.length + rawCredits.length
  if (total === 0) return { ok: false, status: 404, error: "Aucune facture ni aucun avoir sur cette période." }
  if (total > ZIP_MAX_DOCUMENTS) {
    return {
      ok: false, status: 413, code: "TOO_MANY_DOCUMENTS",
      error: `${total} documents sur cette période : l'archive en contient ${ZIP_MAX_DOCUMENTS} au plus. Choisissez une période plus courte, par exemple un trimestre.`,
    }
  }

  // Les PDF se génèrent l'un après l'autre : mémoire bornée, pas de pic de CPU
  const entries: ZipEntry[] = []
  for (const inv of rawInvoices) {
    const pdf = await generateInvoicePdf({
      invoice: { ...(inv as Parameters<typeof generateInvoicePdf>[0]["invoice"]), invoice_number: String(inv.invoice_number) },
      company: company as Parameters<typeof generateInvoicePdf>[0]["company"],
    })
    entries.push({ name: `Facture ${inv.invoice_number}.pdf`, data: pdf, modified: new Date(`${inv.issue_date}T12:00:00Z`) })
  }
  for (const cn of rawCredits) {
    const pdf = await generateCreditNotePdf({
      creditNote: cn as Parameters<typeof generateCreditNotePdf>[0]["creditNote"],
      company: company as Parameters<typeof generateCreditNotePdf>[0]["company"],
    })
    entries.push({ name: `Avoir ${cn.credit_note_number}.pdf`, data: new Uint8Array(pdf), modified: new Date(`${cn.issue_date}T12:00:00Z`) })
  }

  return {
    ok: true,
    filename: `pdf-${fileStem(company)}-${compact(period.from)}-${compact(period.to)}.zip`,
    contentType: "application/zip",
    body: createZip(entries),
    count: total,
  }
}
