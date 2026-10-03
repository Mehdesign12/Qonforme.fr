/**
 * Lien de paiement par virement : accès à la base, côté serveur uniquement
 * (clé service_role). Les tables `invoice_payment_links` et
 * `invoice_payment_declarations` ne s'écrivent que d'ici ; la RLS n'ouvre aux
 * utilisateurs que la lecture de leurs propres lignes.
 *
 * Tant que la migration 20261003_payment_links.sql n'est pas appliquée, tout
 * renvoie « indisponible » sans erreur (isMissingSchemaError) : pas de lien
 * dans les emails, rien sur la fiche, page publique « lien introuvable ».
 */
import type { SupabaseClient } from "@supabase/supabase-js"
import { createAdminClient } from "@/lib/supabase/server"
import { isMissingSchemaError } from "@/lib/supabase/schema-guard"
import { isAllowedLogoUrl } from "@/lib/utils/logo-url"
import { isValidBic, isValidIban, normalizeBic, normalizeIban } from "@/lib/payment-link/iban"
import { buildEpcPayload } from "@/lib/payment-link/epc"
import { encodeQr, qrSvgPath } from "@/lib/payment-link/qr"
import { isPayableStatus, payState, remainingDue } from "@/lib/payment-link/rules"
import { deriveToken, hashToken, isTokenShape, newNonce, paymentLinkSecret, paymentUrl } from "@/lib/payment-link/token"
import type {
  ArtisanDeclaration, PaymentLinkState, PaymentPageData, PublicCompany, PublicInvoice,
} from "@/lib/payment-link/types"
import { DECLARATIONS_TABLE, LINKS_TABLE, UNAVAILABLE_STATE } from "@/lib/payment-link/types"

export { DECLARATIONS_TABLE, LINKS_TABLE }

type Db = SupabaseClient

interface LinkRow {
  id: string
  invoice_id: string
  user_id: string
  token_hash: string
  nonce: string
  created_at: string
  disabled_at: string | null
}

const LINK_COLUMNS = "id, invoice_id, user_id, token_hash, nonce, created_at, disabled_at"

/** Ligne du lien d'une facture ; `missing` si la table n'existe pas encore. */
async function findLink(db: Db, invoiceId: string): Promise<{ row: LinkRow | null; missing: boolean }> {
  const { data, error } = await db.from(LINKS_TABLE).select(LINK_COLUMNS).eq("invoice_id", invoiceId).maybeSingle()
  if (error) {
    if (isMissingSchemaError(error)) return { row: null, missing: true }
    throw error
  }
  return { row: (data as LinkRow | null) ?? null, missing: false }
}

/**
 * Jeton d'un lien existant. Si l'empreinte ne correspond plus (secret serveur
 * changé), elle est recalculée : le lien suit le nouveau secret.
 */
async function tokenOf(db: Db, secret: string, row: LinkRow): Promise<string> {
  const token = deriveToken(secret, row.invoice_id, row.nonce)
  const hash = hashToken(token)
  if (hash !== row.token_hash) {
    await db.from(LINKS_TABLE).update({ token_hash: hash }).eq("id", row.id)
  }
  return token
}

/** Crée le lien d'une facture (sel neuf). En cas de course, relit celui qui vient d'être créé. */
async function createLink(db: Db, secret: string, invoiceId: string, userId: string): Promise<{ row: LinkRow; token: string } | null> {
  const nonce = newNonce()
  const token = deriveToken(secret, invoiceId, nonce)
  const { data, error } = await db
    .from(LINKS_TABLE)
    .insert({ invoice_id: invoiceId, user_id: userId, nonce, token_hash: hashToken(token) })
    .select(LINK_COLUMNS)
    .single()
  if (error) {
    if (isMissingSchemaError(error)) return null
    if (error.code === "23505") {
      const { row } = await findLink(db, invoiceId)
      return row && !row.disabled_at ? { row, token: await tokenOf(db, secret, row) } : null
    }
    throw error
  }
  return { row: data as LinkRow, token }
}

/** Nouveau sel pour un lien désactivé : nouveau jeton, l'ancien lien ne revient jamais. */
async function rotateLink(db: Db, secret: string, row: LinkRow): Promise<{ row: LinkRow; token: string }> {
  const nonce = newNonce()
  const token = deriveToken(secret, row.invoice_id, nonce)
  const { data, error } = await db
    .from(LINKS_TABLE)
    .update({ nonce, token_hash: hashToken(token), disabled_at: null, created_at: new Date().toISOString() })
    .eq("id", row.id)
    .select(LINK_COLUMNS)
    .single()
  if (error) throw error
  return { row: data as LinkRow, token }
}

/* ------------------------------------------------------------------ */
/* Pour les envois et les relances                                     */
/* ------------------------------------------------------------------ */

/**
 * Adresse de la page de règlement d'une facture, ou null (pas d'IBAN valide,
 * lien désactivé par l'artisan, brouillon, migration pas encore appliquée…).
 * Ne lève jamais d'erreur : un envoi ou une relance part sans lien plutôt que
 * de ne pas partir.
 *
 * - `issuing` : la facture est en train d'être émise (route d'envoi), le
 *   brouillon est donc accepté. Tant qu'elle reste brouillon (envoi échoué),
 *   la page publique répond « lien introuvable ».
 * - `create` (vrai par défaut) : crée le lien s'il n'existe pas, pour une
 *   facture émise et non réglée. Un lien désactivé n'est jamais recréé ici.
 */
export async function paymentLinkFor(params: {
  invoiceId: string
  userId: string
  admin?: Db
  create?: boolean
  issuing?: boolean
}): Promise<string | null> {
  const { invoiceId, userId, create = true, issuing = false } = params
  try {
    const secret = paymentLinkSecret()
    if (!secret) return null
    const db = params.admin ?? createAdminClient()

    const { data: invoice } = await db
      .from("invoices").select("id, status").eq("id", invoiceId).eq("user_id", userId).maybeSingle()
    if (!invoice) return null
    if (invoice.status === "draft" && !issuing) return null

    const { data: company } = await db.from("companies").select("iban").eq("user_id", userId).maybeSingle()
    if (!isValidIban(company?.iban)) return null

    const { row, missing } = await findLink(db, invoiceId)
    if (missing) return null
    if (row) return row.disabled_at ? null : paymentUrl(await tokenOf(db, secret, row))

    const mayCreate = create && (issuing || isPayableStatus(invoice.status))
    if (!mayCreate) return null
    const created = await createLink(db, secret, invoiceId, userId)
    return created ? paymentUrl(created.token) : null
  } catch (err) {
    console.error("[payment-link] paymentLinkFor", err)
    return null
  }
}

/* ------------------------------------------------------------------ */
/* Fiche facture (artisan connecté)                                    */
/* ------------------------------------------------------------------ */

function toArtisanDeclaration(r: Record<string, unknown>): ArtisanDeclaration {
  return {
    id: String(r.id),
    transferDate: String(r.transfer_date),
    amount: Number(r.amount),
    note: (r.note as string | null) ?? null,
    declaredAt: String(r.created_at),
    status: r.status as ArtisanDeclaration["status"],
  }
}

/**
 * État du lien pour la fiche facture. L'appelant a déjà vérifié que la facture
 * appartient à `userId` ; tout est relu ici avec la clé service_role.
 */
export async function paymentLinkState(params: { invoiceId: string; userId: string; admin?: Db }): Promise<PaymentLinkState> {
  const secret = paymentLinkSecret()
  if (!secret) return UNAVAILABLE_STATE
  const db = params.admin ?? createAdminClient()

  const { row, missing } = await findLink(db, params.invoiceId)
  if (missing) return UNAVAILABLE_STATE

  const { data: company } = await db.from("companies").select("iban").eq("user_id", params.userId).maybeSingle()
  const iban = !company?.iban?.trim() ? "missing" : isValidIban(company.iban) ? "ok" : "invalid"

  const { data: decl, error: declErr } = await db
    .from(DECLARATIONS_TABLE)
    .select("id, transfer_date, amount, note, created_at, status")
    .eq("invoice_id", params.invoiceId)
    .eq("user_id", params.userId)
    .neq("status", "dismissed")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle()
  if (declErr && !isMissingSchemaError(declErr)) throw declErr

  return {
    available: true,
    iban,
    link: row && !row.disabled_at && iban === "ok"
      ? { url: paymentUrl(await tokenOf(db, secret, row)), createdAt: row.created_at }
      : null,
    disabledAt: row?.disabled_at ?? null,
    declaration: decl ? toArtisanDeclaration(decl) : null,
  }
}

export type LinkAction = "create" | "disable" | "enable"

/**
 * Crée, désactive ou réactive le lien d'une facture (déjà vérifiée comme
 * appartenant à `userId`, statut fourni par l'appelant). Renvoie un message
 * d'erreur pour l'artisan, ou null.
 */
export async function applyLinkAction(params: {
  invoiceId: string
  userId: string
  status: string
  action: LinkAction
  admin?: Db
}): Promise<string | null> {
  const secret = paymentLinkSecret()
  if (!secret) return "Le lien de paiement n'est pas encore disponible."
  const db = params.admin ?? createAdminClient()
  const { row, missing } = await findLink(db, params.invoiceId)
  if (missing) return "Le lien de paiement n'est pas encore disponible."

  if (params.action === "disable") {
    if (!row || row.disabled_at) return null
    const { error } = await db.from(LINKS_TABLE).update({ disabled_at: new Date().toISOString() }).eq("id", row.id)
    if (error) throw error
    return null
  }

  // Créer ou réactiver : facture émise et non réglée, IBAN valide
  if (params.status === "draft") return "Le lien de paiement se crée à l'envoi de la facture."
  if (!isPayableStatus(params.status)) return "Cette facture n'est plus à régler."
  const { data: company } = await db.from("companies").select("iban").eq("user_id", params.userId).maybeSingle()
  if (!isValidIban(company?.iban)) return "Renseignez un IBAN valide dans Paramètres › Entreprise."

  if (!row) {
    await createLink(db, secret, params.invoiceId, params.userId)
    return null
  }
  if (row.disabled_at) await rotateLink(db, secret, row)
  return null
}

/** L'artisan n'a pas reçu le virement déclaré : la déclaration est écartée, le client peut en refaire une. */
export async function dismissDeclaration(params: { invoiceId: string; userId: string; declarationId: string; admin?: Db }): Promise<void> {
  const db = params.admin ?? createAdminClient()
  const { error } = await db
    .from(DECLARATIONS_TABLE)
    .update({ status: "dismissed", resolved_at: new Date().toISOString() })
    .eq("id", params.declarationId)
    .eq("invoice_id", params.invoiceId)
    .eq("user_id", params.userId)
    .eq("status", "open")
  if (error && !isMissingSchemaError(error)) throw error
}

/* ------------------------------------------------------------------ */
/* Page publique                                                       */
/* ------------------------------------------------------------------ */

/** Contexte interne d'un jeton valide, pour les routes publiques (jamais envoyé au navigateur). */
export interface ResolvedLink {
  linkId: string
  userId: string
  invoice: Record<string, unknown> & { id: string; status: string; invoice_number: string; issue_date: string; total_ttc: number }
  company: Record<string, unknown> | null
  remaining: number
}

function publicCompany(c: Record<string, unknown> | null): PublicCompany {
  const str = (k: string) => {
    const v = c?.[k]
    return typeof v === "string" && v.trim() ? v.trim() : null
  }
  const logo = str("logo_url")
  return {
    name: str("name") ?? "Votre prestataire",
    logoUrl: logo && isAllowedLogoUrl(logo) ? logo : null,
    siren: str("siren"),
    address: str("address"),
    zipCode: str("zip_code"),
    city: str("city"),
    email: str("email"),
  }
}

/**
 * Résout un jeton : état de la page et, pour un jeton valide, le contexte
 * interne. Seules les données de la facture liée au jeton sont lues.
 */
export async function resolvePaymentToken(token: string): Promise<{ data: PaymentPageData; ctx: ResolvedLink | null }> {
  const notFound = { data: { state: "not_found" } as PaymentPageData, ctx: null }
  if (!isTokenShape(token)) return notFound

  try {
    const db = createAdminClient()
    const { data: link, error } = await db
      .from(LINKS_TABLE)
      .select("id, invoice_id, user_id, disabled_at")
      .eq("token_hash", hashToken(token))
      .maybeSingle()
    if (error) {
      if (isMissingSchemaError(error)) return notFound
      throw error
    }
    if (!link) return notFound

    // retention_amount : formule Artisan (migration 20261003_artisan_chantiers.sql) ;
    // sans la colonne, relecture sans elle
    const INVOICE_COLUMNS = "id, user_id, client_id, invoice_number, status, issue_date, due_date, total_ttc"
    type InvoiceRow = {
      id: string; user_id: string; client_id: string | null; invoice_number: string; status: string
      issue_date: string; due_date: string; total_ttc: number; retention_amount?: number | string | null
    }
    const readInvoice = async (columns: string) => {
      const r = await db.from("invoices").select(columns).eq("id", link.invoice_id).eq("user_id", link.user_id).maybeSingle()
      return { data: r.data as unknown as InvoiceRow | null, error: r.error }
    }
    let { data: invoice, error: invErr } = await readInvoice(`${INVOICE_COLUMNS}, retention_amount`)
    if (invErr && isMissingSchemaError(invErr)) ({ data: invoice, error: invErr } = await readInvoice(INVOICE_COLUMNS))
    if (invErr) throw invErr
    if (!invoice || invoice.status === "draft") return notFound

    const { data: company, error: compErr } = await db.from("companies").select("*").eq("user_id", link.user_id).maybeSingle()
    if (compErr) throw compErr
    const pubCompany = publicCompany(company)
    if (link.disabled_at) return { data: { state: "disabled", company: pubCompany }, ctx: null }

    const { data: credits, error: credErr } = await db
      .from("credit_notes")
      .select("total_ttc")
      .eq("original_invoice_id", invoice.id)
      .eq("user_id", link.user_id)
    if (credErr) throw credErr

    const total = Number(invoice.total_ttc ?? 0)
    const retention = Math.max(0, Number(invoice.retention_amount ?? 0) || 0)
    // Montant demandé à l'échéance : sans la retenue de garantie, payable à sa libération
    const remaining = remainingDue(total, credits ?? [], retention)
    // Plafond d'une déclaration de virement : un client peut aussi verser la retenue
    const payable = remainingDue(total, credits ?? [])
    const pubInvoice: PublicInvoice = {
      number: String(invoice.invoice_number),
      issueDate: String(invoice.issue_date),
      dueDate: String(invoice.due_date),
      totalTtc: total,
      credited: Math.max(0, Math.round((total - payable) * 100) / 100),
      remaining,
      ...(retention > 0 && payable > 0 ? { retention: Math.min(retention, payable) } : {}),
    }
    const ctx: ResolvedLink = { linkId: link.id, userId: link.user_id, invoice, company, remaining: payable }

    const state = payState(invoice.status, remaining)
    if (state === "draft") return notFound
    if (state !== "payable") return { data: { state, company: pubCompany, invoice: pubInvoice }, ctx }

    const iban = normalizeIban(company?.iban as string | null)
    const bic = normalizeBic(company?.bic as string | null)
    const holderRaw = typeof company?.bank_account_holder === "string" ? company.bank_account_holder.trim() : ""
    const account = isValidIban(iban)
      ? { holder: holderRaw || pubCompany.name, iban, bic: isValidBic(bic) ? bic : null }
      : null

    let qr: { path: string; size: number } | null = null
    if (account) {
      const payload = buildEpcPayload({
        name: account.holder, iban: account.iban, bic: account.bic, amount: remaining, remittance: `Facture ${pubInvoice.number}`,
      })
      // Version 13 au plus (EPC069-12, section 2.1)
      const matrix = payload ? encodeQr(payload, { maxVersion: 13 }) : null
      if (matrix) qr = { path: qrSvgPath(matrix), size: matrix.size + 8 }
    }

    const { data: decl, error: declErr } = await db
      .from(DECLARATIONS_TABLE)
      .select("transfer_date, amount, created_at")
      .eq("invoice_id", invoice.id)
      .eq("status", "open")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle()
    if (declErr && !isMissingSchemaError(declErr)) throw declErr

    return {
      data: {
        state: "payable",
        company: pubCompany,
        invoice: pubInvoice,
        account,
        qr,
        declaration: decl ? { transferDate: String(decl.transfer_date), amount: Number(decl.amount), declaredAt: String(decl.created_at) } : null,
      },
      ctx,
    }
  } catch (err) {
    console.error("[payment-link] resolvePaymentToken", err)
    return { data: { state: "unavailable" }, ctx: null }
  }
}
