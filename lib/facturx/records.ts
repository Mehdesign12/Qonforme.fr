/**
 * Passage des enregistrements de la base (facture, avoir, entreprise, client)
 * au modèle Factur-X. Un seul endroit, partagé par le PDF, le XML seul et
 * l'envoi par email, pour que tous déclarent la même facture.
 *
 * Aucun champ nouveau n'est exigé en base : `vat_treatment` (document ou ligne
 * du JSON `lines`) est lu s'il existe, sinon le traitement est déduit.
 */
import { invoiceNumberLabel } from "@/lib/utils/document-numbering"
import type { FxDocument, FxLine, FxParty, FxSeller } from "@/lib/facturx/xml"
import { parseVatTreatment } from "@/lib/facturx/vat"

export interface CompanyRecord {
  name?: string | null
  siren?: string | null
  siret?: string | null
  vat_number?: string | null
  address?: string | null
  zip_code?: string | null
  city?: string | null
  country?: string | null
  iban?: string | null
  legal_notice?: string | null
  email?: string | null
  /** Régime de TVA du profil légal (lib/legal/mentions.ts, withDocumentMentions). */
  vat_regime?: "franchise" | "assujetti" | null
}

export interface ClientRecord {
  name?: string | null
  email?: string | null
  address?: string | null
  zip_code?: string | null
  city?: string | null
  country?: string | null
  siren?: string | null
  vat_number?: string | null
}

export interface LineRecord {
  description?: string | null
  quantity?: number | string | null
  unit?: string | null
  unit_price_ht?: number | string | null
  vat_rate?: number | string | null
  total_ht?: number | string | null
  total_vat?: number | string | null
  vat_treatment?: string | null
}

const num = (v: unknown): number => {
  const n = typeof v === "string" ? parseFloat(v) : Number(v)
  return Number.isFinite(n) ? n : 0
}

export function sellerFromCompany(company: CompanyRecord | null | undefined): FxSeller {
  return {
    name:         company?.name?.trim() ?? "",
    address:      company?.address,
    zip_code:     company?.zip_code,
    city:         company?.city,
    country:      company?.country,
    siren:        company?.siren,
    siret:        company?.siret,
    vat_number:   company?.vat_number,
    iban:         company?.iban,
    legal_notice: company?.legal_notice,
    email:        company?.email,
    vat_regime:   company?.vat_regime ?? null,
  }
}

export function buyerFromClient(client: ClientRecord | null | undefined): FxParty {
  return {
    name:       client?.name?.trim() ?? "",
    address:    client?.address,
    zip_code:   client?.zip_code,
    city:       client?.city,
    country:    client?.country,
    siren:      client?.siren,
    vat_number: client?.vat_number,
    email:      client?.email,
  }
}

export function linesFromRecords(lines: LineRecord[] | null | undefined): FxLine[] {
  return (lines ?? []).map((l) => ({
    description:   l.description ?? "",
    quantity:      num(l.quantity),
    unit:          l.unit ?? null,
    unit_price_ht: num(l.unit_price_ht),
    vat_rate:      num(l.vat_rate),
    total_ht:      num(l.total_ht),
    total_vat:     l.total_vat == null || l.total_vat === "" ? null : num(l.total_vat),
    vat_treatment: parseVatTreatment(l.vat_treatment) ?? null,
  }))
}

export interface InvoiceRecord {
  /** Vide pour un brouillon (numéro attribué à l'émission) ; un brouillon n'a jamais de XML. */
  invoice_number: string | null
  issue_date: string
  due_date?: string | null
  notes?: string | null
  lines?: LineRecord[] | null
  client?: ClientRecord | null
  vat_treatment?: string | null
}

export function invoiceToFacturX(invoice: InvoiceRecord, company: CompanyRecord | null | undefined): FxDocument {
  return {
    kind:          "invoice",
    number:        invoiceNumberLabel(invoice.invoice_number),
    issue_date:    invoice.issue_date,
    due_date:      invoice.due_date ?? null,
    seller:        sellerFromCompany(company),
    buyer:         buyerFromClient(invoice.client),
    lines:         linesFromRecords(invoice.lines),
    notes:         invoice.notes ?? null,
    vat_treatment: parseVatTreatment(invoice.vat_treatment) ?? null,
  }
}

export interface CreditNoteRecord {
  credit_note_number: string
  issue_date: string
  reason?: string | null
  lines?: LineRecord[] | null
  client?: ClientRecord | null
  original_invoice?: { invoice_number?: string | null; issue_date?: string | null } | null
  vat_treatment?: string | null
}

/** Note de l'avoir : son motif, imprimé sur le PDF. */
export function creditNoteMotive(reason: string | null | undefined): string | null {
  return reason?.trim() ? `Motif de l'avoir : ${reason.trim()}` : null
}

export function creditNoteToFacturX(creditNote: CreditNoteRecord, company: CompanyRecord | null | undefined): FxDocument {
  const original = creditNote.original_invoice
  return {
    kind:              "credit_note",
    number:            creditNote.credit_note_number,
    issue_date:        creditNote.issue_date,
    seller:            sellerFromCompany(company),
    buyer:             buyerFromClient(creditNote.client),
    lines:             linesFromRecords(creditNote.lines),
    notes:             creditNoteMotive(creditNote.reason),
    vat_treatment:     parseVatTreatment(creditNote.vat_treatment) ?? null,
    preceding_invoice: original?.invoice_number
      ? { number: original.invoice_number, issue_date: original.issue_date ?? null }
      : null,
  }
}
