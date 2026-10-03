/**
 * Formule Artisan, accès à la base (côté serveur, client Supabase de
 * l'utilisateur : la RLS limite tout à ses propres lignes, et chaque requête
 * filtre en plus sur user_id).
 *
 * Tant que la migration 20261003_artisan_chantiers.sql n'est pas appliquée,
 * tout renvoie « indisponible » (isMissingSchemaError), sans erreur : les
 * écrans le disent, les factures existantes ne changent pas.
 *
 * Les calculs sont dans lib/artisan/billing.ts et quote-billing.ts (purs) ;
 * ici, seulement la lecture, les contrôles et l'écriture des brouillons.
 * Les factures créées naissent toujours brouillon, sans numéro : le numéro
 * est attribué à l'émission, dans la série continue des factures
 * (lib/utils/document-numbering.ts).
 */
import type { SupabaseClient } from "@supabase/supabase-js"
import { isMissingSchemaError } from "@/lib/supabase/schema-guard"
import { insertDraftInvoice } from "@/lib/utils/document-numbering"
import { INITIAL_STATUS } from "@/lib/utils/document-status"
import { artisanEmailExtras } from "./billing"
import { quoteBillingState, type InvoiceForBilling } from "./quote-billing"
import { parseRetentionMode, parseRetentionRate } from "./retention"
import { chantierFromRow, invoiceDoc, type Chantier, type ChantierDoc } from "./chantier"
import type { Preview, QuoteBilling, QuoteRow } from "./build"

export type { QuoteBilling } from "./build"

type Db = SupabaseClient
type DbError = { code?: string | null; message?: string | null } | null

export const ARTISAN_INVOICE_COLUMNS =
  "id, invoice_number, status, issue_date, due_date, invoice_kind, billing_context, lines, subtotal_ht, total_vat, total_ttc, retention_amount, quote_id, chantier_id, paid_at, client_id"

export type Unavailable = { unavailable: true }
export const UNAVAILABLE: Unavailable = { unavailable: true }

/** Erreur à remonter (500), sauf schéma absent (fonction pas encore activée). */
function fail(error: DbError): Unavailable | never {
  if (isMissingSchemaError(error)) return UNAVAILABLE
  throw new Error(error?.message ?? "Erreur de base de données")
}

/* ------------------------------------------------------------------ */
/* Nature d'une facture (routes existantes)                            */
/* ------------------------------------------------------------------ */

/**
 * Nature d'une facture, pour les routes d'émission : une facture de la
 * formule Artisan demande la formule Artisan pour sortir du brouillon.
 * Colonne absente (migration pas appliquée) : « standard », comme avant.
 */
export async function invoiceKindOf(db: Db, invoiceId: string, userId: string): Promise<string> {
  const { data, error } = await db.from("invoices").select("invoice_kind").eq("id", invoiceId).eq("user_id", userId).maybeSingle()
  if (error) {
    if (isMissingSchemaError(error)) return "standard"
    throw new Error(error.message)
  }
  return (data as { invoice_kind?: string } | null)?.invoice_kind ?? "standard"
}

/**
 * Nature et retenue de garantie d'une facture, pour les emails de relance
 * (le cron lit des colonnes fixes, qui n'existent pas avant la migration).
 * Toute erreur : rien, la relance part comme avant.
 */
export async function artisanExtrasFor(db: Db, invoiceId: string): Promise<ReturnType<typeof artisanEmailExtras>> {
  const { data, error } = await db.from("invoices").select("invoice_kind, billing_context").eq("id", invoiceId).maybeSingle()
  if (error || !data) return { docLabel: null, retention: null }
  return artisanEmailExtras(data as { invoice_kind?: unknown; billing_context?: unknown })
}

/** Factures de la formule Artisan liées à un devis ; null si la colonne n'existe pas encore. */
export async function invoicesOfQuote(db: Db, userId: string, quoteId: string): Promise<InvoiceForBilling[] | null> {
  const { data, error } = await db.from("invoices").select(ARTISAN_INVOICE_COLUMNS).eq("user_id", userId).eq("quote_id", quoteId)
  if (error) {
    if (isMissingSchemaError(error)) return null
    throw new Error(error.message)
  }
  return (data ?? []) as InvoiceForBilling[]
}

/* ------------------------------------------------------------------ */
/* Facturation d'un devis                                              */
/* ------------------------------------------------------------------ */

export async function loadQuoteBilling(db: Db, userId: string, quoteId: string): Promise<QuoteBilling | Unavailable | null> {
  const { data: quote, error } = await db.from("quotes").select("*").eq("id", quoteId).eq("user_id", userId).maybeSingle()
  if (error) return fail(error)
  if (!quote) return null
  const invoices = await invoicesOfQuote(db, userId, quoteId)
  if (invoices === null) return UNAVAILABLE
  let chantier: QuoteBilling["chantier"] = null
  const chantierId = (quote as QuoteRow).chantier_id
  if (chantierId) {
    const { data: ch, error: chErr } = await db.from("chantiers").select("id, name, retention_mode, retention_rate, subcontracting").eq("id", chantierId).eq("user_id", userId).maybeSingle()
    if (chErr) return fail(chErr)
    if (ch) {
      const c = ch as Record<string, unknown>
      chantier = {
        id: String(c.id), name: String(c.name ?? ""),
        retention_mode: parseRetentionMode(c.retention_mode),
        retention_rate: parseRetentionRate(c.retention_rate) ?? 0,
        subcontracting: c.subcontracting === true,
      }
    }
  }
  const row = quote as QuoteRow
  return { quote: row, invoices, state: quoteBillingState(row, invoices), chantier }
}

/** Acomptes libres émis pour un client, pas encore rattachés à un devis. */
export async function freeDepositsOfClient(db: Db, userId: string, clientId: string): Promise<{ id: string; invoice_number: string | null; issue_date: string | null; total_ttc: number; status: string }[]> {
  const { data, error } = await db
    .from("invoices")
    .select("id, invoice_number, issue_date, total_ttc, status")
    .eq("user_id", userId)
    .eq("client_id", clientId)
    .eq("invoice_kind", "deposit")
    .is("quote_id", null)
    .not("status", "in", "(draft,credited,cancelled)")
    .order("issue_date", { ascending: true })
  if (error) {
    if (isMissingSchemaError(error)) return []
    throw new Error(error.message)
  }
  return ((data ?? []) as Record<string, unknown>[]).map((r) => ({
    id: String(r.id), invoice_number: (r.invoice_number as string | null) ?? null, issue_date: (r.issue_date as string | null) ?? null,
    total_ttc: Number(r.total_ttc ?? 0) || 0, status: String(r.status),
  }))
}

/** Crée le brouillon calculé par buildArtisanInvoice (ou buildFreeDeposit). */
export async function insertArtisanDraft(
  db: Db,
  userId: string,
  target: { client_id: string; quote_id: string | null; chantier_id: string | null },
  preview: Preview,
  today: string,
  companyPrefix: string | null | undefined,
) {
  return insertDraftInvoice<Record<string, unknown>>(db, {
    userId,
    companyPrefix,
    today,
    selectClause: `*, client:clients(id, name, email)`,
    row: {
      user_id: userId,
      client_id: target.client_id,
      status: INITIAL_STATUS,
      issue_date: today,
      due_date: preview.due_date,
      lines: preview.lines,
      subtotal_ht: preview.subtotal_ht,
      total_vat: preview.total_vat,
      total_ttc: preview.total_ttc,
      notes: null,
      invoice_kind: preview.kind,
      billing_context: preview.context,
      quote_id: target.quote_id,
      chantier_id: target.chantier_id,
      retention_amount: preview.retention?.mode === "retenue" ? preview.retention.amount : 0,
    },
  })
}

/* ------------------------------------------------------------------ */
/* Chantiers                                                           */
/* ------------------------------------------------------------------ */

export const CHANTIER_COLUMNS =
  "id, client_id, name, address, zip_code, city, start_date, end_date, status, reception_date, retention_mode, retention_rate, retention_released_at, subcontracting, notes, created_at, client:clients(id, name, email, siren, vat_number, city)"

export async function listChantiers(db: Db, userId: string): Promise<Chantier[] | Unavailable> {
  const { data, error } = await db.from("chantiers").select(CHANTIER_COLUMNS).eq("user_id", userId).order("created_at", { ascending: false }).limit(500)
  if (error) return fail(error)
  return (data ?? []).map((r) => chantierFromRow(r as Record<string, unknown>))
}

export async function getChantier(db: Db, userId: string, id: string): Promise<Chantier | Unavailable | null> {
  const { data, error } = await db.from("chantiers").select(CHANTIER_COLUMNS).eq("id", id).eq("user_id", userId).maybeSingle()
  if (error) return fail(error)
  return data ? chantierFromRow(data as Record<string, unknown>) : null
}

/** Documents de plusieurs chantiers (rattachés, plus les avoirs émis sur leurs factures). */
export async function documentsOfChantiers(db: Db, userId: string, chantierIds: string[]): Promise<Map<string, ChantierDoc[]> | Unavailable> {
  const byChantier = new Map<string, ChantierDoc[]>(chantierIds.map((id) => [id, []]))
  if (chantierIds.length === 0) return byChantier
  const push = (id: unknown, doc: ChantierDoc) => { if (typeof id === "string") byChantier.get(id)?.push(doc) }

  const [quotes, invoices, pos] = await Promise.all([
    db.from("quotes").select("id, quote_number, status, issue_date, subtotal_ht, total_ttc, chantier_id").eq("user_id", userId).in("chantier_id", chantierIds),
    db.from("invoices").select("id, invoice_number, status, issue_date, subtotal_ht, total_ttc, invoice_kind, billing_context, retention_amount, quote_id, paid_at, chantier_id").eq("user_id", userId).in("chantier_id", chantierIds),
    db.from("purchase_orders").select("id, po_number, status, issue_date, subtotal_ht, total_ttc, chantier_id").eq("user_id", userId).in("chantier_id", chantierIds),
  ])
  for (const res of [quotes, invoices, pos]) if (res.error) return fail(res.error)

  for (const r of (quotes.data ?? []) as Record<string, unknown>[]) {
    push(r.chantier_id, { type: "quote", id: String(r.id), number: (r.quote_number as string) ?? null, status: String(r.status), issue_date: (r.issue_date as string) ?? null, total_ht: Number(r.subtotal_ht ?? 0) || 0, total_ttc: Number(r.total_ttc ?? 0) || 0 })
  }
  const invoiceChantier = new Map<string, string>()
  for (const r of (invoices.data ?? []) as Record<string, unknown>[]) {
    const ctx = r.billing_context as { situation?: { number?: number; final?: boolean } } | null
    const kind = String(r.invoice_kind ?? "standard")
    const label = kind === "deposit" ? "Acompte" : kind === "final" ? "Solde"
      : kind === "situation" ? `Situation n° ${ctx?.situation?.number ?? "?"}${ctx?.situation?.final ? " (décompte final)" : ""}` : null
    push(r.chantier_id, invoiceDoc(r, label))
    invoiceChantier.set(String(r.id), String(r.chantier_id))
  }
  for (const r of (pos.data ?? []) as Record<string, unknown>[]) {
    push(r.chantier_id, { type: "purchase_order", id: String(r.id), number: (r.po_number as string) ?? null, status: String(r.status), issue_date: (r.issue_date as string) ?? null, total_ht: Number(r.subtotal_ht ?? 0) || 0, total_ttc: Number(r.total_ttc ?? 0) || 0 })
  }

  // Avoirs : rattachés au chantier, ou émis sur une de ses factures (chacun une seule fois)
  const invoiceIds = Array.from(invoiceChantier.keys())
  const [attached, onInvoices] = await Promise.all([
    db.from("credit_notes").select("id, credit_note_number, issue_date, subtotal_ht, total_ttc, original_invoice_id, chantier_id").eq("user_id", userId).in("chantier_id", chantierIds),
    invoiceIds.length
      ? db.from("credit_notes").select("id, credit_note_number, issue_date, subtotal_ht, total_ttc, original_invoice_id, chantier_id").eq("user_id", userId).in("original_invoice_id", invoiceIds)
      : Promise.resolve({ data: [], error: null }),
  ])
  for (const res of [attached, onInvoices]) if (res.error) return fail(res.error as DbError)
  const seen = new Set<string>()
  for (const r of [...(attached.data ?? []), ...(onInvoices.data ?? [])] as Record<string, unknown>[]) {
    if (seen.has(String(r.id))) continue
    seen.add(String(r.id))
    const target = (r.chantier_id as string | null) ?? invoiceChantier.get(String(r.original_invoice_id)) ?? null
    push(target, {
      type: "credit_note", id: String(r.id), number: (r.credit_note_number as string) ?? null, status: "issued",
      issue_date: (r.issue_date as string) ?? null, total_ht: Number(r.subtotal_ht ?? 0) || 0, total_ttc: Number(r.total_ttc ?? 0) || 0,
      original_invoice_id: (r.original_invoice_id as string | null) ?? null,
    })
  }
  for (const docs of Array.from(byChantier.values())) docs.sort((a, b) => (b.issue_date ?? "").localeCompare(a.issue_date ?? ""))
  return byChantier
}

const ATTACH_TABLES = {
  quote: "quotes",
  invoice: "invoices",
  credit_note: "credit_notes",
  purchase_order: "purchase_orders",
} as const

export type AttachType = keyof typeof ATTACH_TABLES

export function isAttachType(v: unknown): v is AttachType {
  return typeof v === "string" && v in ATTACH_TABLES
}

/**
 * Rattache (ou détache, `chantierId` null) un document à un chantier. Le
 * contenu du document ne change pas : seule la colonne chantier_id est écrite,
 * même pour une facture émise. Un devis entraîne ses factures d'acompte, de
 * situation et de solde.
 */
export async function attachDocument(db: Db, userId: string, type: AttachType, docId: string, chantierId: string | null): Promise<{ ok: true } | { ok: false; status: number; error: string } | Unavailable> {
  const table = ATTACH_TABLES[type]
  const { data, error } = await db.from(table).update({ chantier_id: chantierId }).eq("id", docId).eq("user_id", userId).select("id").maybeSingle()
  if (error) {
    if (isMissingSchemaError(error)) return UNAVAILABLE
    if (error.code === "23503") return { ok: false, status: 404, error: "Chantier introuvable." }
    throw new Error(error.message)
  }
  if (!data) return { ok: false, status: 404, error: "Document introuvable." }
  if (type === "quote") {
    const { error: invErr } = await db.from("invoices").update({ chantier_id: chantierId }).eq("user_id", userId).eq("quote_id", docId)
    if (invErr && !isMissingSchemaError(invErr)) throw new Error(invErr.message)
  }
  return { ok: true }
}

/** Le client appartient-il à l'utilisateur ? (la RLS le garantit, on le vérifie aussi) */
export async function ownsClient(db: Db, userId: string, clientId: string): Promise<boolean> {
  const { data } = await db.from("clients").select("id").eq("id", clientId).eq("user_id", userId).maybeSingle()
  return Boolean(data)
}
