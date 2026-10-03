/**
 * Vue de la page publique du client, construite côté serveur à partir d'un
 * lien déjà vérifié par son jeton (lib/signature/server.ts › loadLinkForToken).
 */
import type { SupabaseClient } from "@supabase/supabase-js"
import {
  canSignDocument, computeLinkState, maskEmail, needsReducedVatCertification, reducedVatCertificationText, refusalLabel,
  withdrawalDeadline,
} from "@/lib/signature/rules"
import { documentFingerprint, loadCompany, loadDocument, type CompanyInfo, type LoadedDoc } from "@/lib/signature/server"
import type { SignatureRow } from "@/lib/signature/types"
import { emptyPublicView, type PublicPageState, type PublicSignViewData } from "@/lib/signature/view"

export { emptyPublicView }

/** Message quand le document n'attend plus de réponse alors que le lien est encore actif. */
function closedMessage(doc: LoadedDoc): string | null {
  if (doc.type === "quote") {
    if (doc.status === "accepted") return "Ce devis a déjà été accepté : l'entreprise a enregistré votre accord."
    if (doc.status === "rejected") return "Ce devis a été classé sans suite par l'entreprise."
  } else {
    if (doc.status === "confirmed") return "Cette commande a déjà été confirmée."
    if (doc.status === "cancelled") return "Ce bon de commande a été annulé par l'entreprise."
  }
  return null
}

/** État de la page pour un lien et son document. */
export function publicState(row: SignatureRow, doc: LoadedDoc | null, now: Date): PublicPageState {
  if (!doc) return "not_found"
  const link = computeLinkState(row, now)
  if (link === "signed" || link === "refused" || link === "disabled" || link === "superseded") return link
  if (link === "expired") return "expired"
  if (row.content_sha256 !== documentFingerprint(doc)) return "superseded"
  if (row.mode === "view") return "view"
  if (doc.status === "draft") return "superseded"
  return canSignDocument(doc.type, doc.status) ? "sign" : "closed"
}

export function toPublicView(row: SignatureRow, doc: LoadedDoc | null, company: CompanyInfo | null, opts: { onSite: boolean; now: Date }): PublicSignViewData {
  const state = publicState(row, doc, opts.now)
  if (!doc || state === "not_found") return emptyPublicView(row.id)

  const business = row.client_kind === "business"
  const clientEmail = doc.client?.email?.trim() || ""
  const reducedVat = needsReducedVatCertification(doc.lines)
  const signedAt = row.signed_at ? new Date(row.signed_at) : null
  // Lien désactivé ou remplacé : il ne donne plus accès au contenu, seulement au numéro et au contact
  const revoked = state === "disabled" || state === "superseded"

  return {
    id: row.id,
    state,
    mode: row.mode,
    clientKind: row.client_kind,
    onSite: opts.onSite && state === "sign",
    doc: {
      type: doc.type,
      number: doc.number,
      issue_date: doc.issue_date,
      valid_until: doc.valid_until,
      delivery_date: doc.delivery_date,
      reference: revoked ? null : doc.reference,
      lines: revoked ? [] : doc.lines,
      subtotal_ht: revoked ? 0 : doc.subtotal_ht,
      total_vat: revoked ? 0 : doc.total_vat,
      total_ttc: revoked ? 0 : doc.total_ttc,
      notes: revoked ? null : doc.notes,
      client: doc.client && !revoked
        ? { name: doc.client.name, address: doc.client.address, zip_code: doc.client.zip_code, city: doc.client.city, siren: doc.client.siren }
        : null,
    },
    company: {
      name: company?.name?.trim() || "L'entreprise",
      address: company?.address ?? null,
      zip_code: company?.zip_code ?? null,
      city: company?.city ?? null,
      siren: company?.siren ?? null,
      siret: company?.siret ?? null,
      vat_number: company?.vat_number ?? null,
      email: company?.email ?? null,
      legal_notice: company?.legal_notice ?? null,
    },
    expires_at: row.expires_at,
    codeRequired: row.code_required,
    codeVerified: !!row.code_verified_at,
    codeTarget: revoked ? null : maskEmail(row.code_sent_to ?? (clientEmail || null)),
    codeToSignerEmail: !clientEmail,
    prefill: revoked ? { name: "", email: "", company: "" } : {
      name: business ? "" : (doc.client?.name ?? ""),
      email: clientEmail,
      company: business ? (doc.client?.name ?? "") : "",
    },
    reducedVat: reducedVat && !revoked,
    reducedVatText: reducedVat && !revoked ? reducedVatCertificationText(doc.lines) : null,
    closedMessage: state === "closed" ? closedMessage(doc) : null,
    signed: row.status === "signed" && signedAt
      ? { name: row.signer_name ?? "", role: row.signer_role, company: row.signer_company, at: row.signed_at!, method: row.signature_method, order_number: row.client_order_number }
      : null,
    refused: row.status === "refused" && row.refused_at ? { at: row.refused_at, reason: refusalLabel(row.refusal_reason) } : null,
    withdrawalDeadline: signedAt && row.client_kind === "consumer" ? withdrawalDeadline(signedAt) : null,
    pdfUrl: revoked ? null : `/api/signature/public/${row.id}/pdf`,
  }
}

/** Charge le document et l'entreprise d'un lien, puis construit la vue. */
export async function buildPublicView(admin: SupabaseClient, row: SignatureRow, opts: { onSite: boolean; now?: Date }): Promise<PublicSignViewData> {
  const [doc, company] = await Promise.all([
    loadDocument(admin, row.document_type, row.document_id, row.user_id),
    loadCompany(admin, row.user_id),
  ])
  return toPublicView(row, doc, company, { onSite: opts.onSite, now: opts.now ?? new Date() })
}
