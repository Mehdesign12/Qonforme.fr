/**
 * Signature en ligne dans la démo : mêmes composants que l'application
 * (SignaturePanel, PublicSignView), données fictives tirées de lib/demo/data.ts.
 *
 * - D-2026-035 (particulier, taux réduits) : lien consulté, en attente ;
 * - D-2026-034 (syndic, plus de 5 000 € TTC) : lien envoyé, code par email ;
 * - D-2026-033 : signé en ligne ; D-2026-032 : refusé en ligne ;
 * - BC-2026-006 : confirmé en ligne ; BC-2026-005 : en attente, code par email ;
 * - D-2026-026 (particulier) : signé, rétractation encore possible.
 * Acompte de démonstration : 30 % du TTC, virement sur l'IBAN fictif de la démo.
 * Page du client : /signer/demo/<numéro> (et les états expire, remplace,
 * desactive, retracte, introuvable).
 */
import { DEMO_COMPANY, demoPurchaseOrder, demoQuote, type DemoPurchaseOrder, type DemoQuote } from "@/lib/demo/data"
import { publicDeposit, transferAccount } from "@/lib/signature/deposit"
import {
  depositReference, maskEmail, needsReducedVatCertification, parisDay, planDeposit, reducedVatCertificationText, withdrawalDeadline,
} from "@/lib/signature/rules"
import type { ClientKind, PanelDeposit, SignatureDocType, SignaturePanelData, SignaturePanelLink } from "@/lib/signature/types"
import type { PublicDeposit, PublicPageState, PublicSignViewData } from "@/lib/signature/view"

/** Acompte réglé dans la démo (Paramètres › Modèles de documents). */
export const DEMO_DEPOSIT_PERCENT = 30
const DEMO_BANK = { name: DEMO_COMPANY.name, iban: DEMO_COMPANY.iban, bic: null, bank_account_holder: DEMO_COMPANY.name }

const demoPanelDeposit = (type: SignatureDocType, number: string, totalTtc: number, signedAt: string, timing: "now" | "later" = "now"): PanelDeposit => ({
  amount: Math.round(totalTtc * DEMO_DEPOSIT_PERCENT) / 100,
  percent: DEMO_DEPOSIT_PERCENT,
  reference: depositReference(type, number),
  timing,
  request_on: timing === "later" ? "2026-10-09" : null,
  requested_at: timing === "now" ? signedAt : null,
})

const SHA = "3f9a1c0e7b2d4f6a8c1e3b5d7f9a0c2e4b6d8f0a1c3e5b7d9f1a3c5e7b9d0f2a"

/**
 * Particulier ou professionnel. L'application le déduit du SIREN de la fiche
 * client (clientKindOf) ; la démo suit le type de ses clients fictifs, dont
 * certains professionnels n'ont pas de SIREN renseigné.
 */
function demoKind(client: { kind: "pro" | "particulier" | "public" }): ClientKind {
  return client.kind === "particulier" ? "consumer" : "business"
}

export function demoPublicHref(id: string): string {
  return `/signer/demo/${id.toLowerCase()}`
}

const baseLink = (id: string, over: Partial<SignaturePanelLink>): SignaturePanelLink => ({
  id: `demo-${id}`,
  mode: "sign",
  state: "sent",
  version: 1,
  url: demoPublicHref(id),
  expires_at: "2026-10-28T22:59:59Z",
  created_at: "2026-09-28T07:10:00Z",
  sent_at: "2026-09-28T07:12:00Z",
  sent_to: null,
  view_count: 0,
  first_viewed_at: null,
  last_viewed_at: null,
  code_required: false,
  client_kind: "consumer",
  signer_name: null,
  signer_email: null,
  signer_role: null,
  signer_company: null,
  client_order_number: null,
  signature_method: null,
  signature_context: null,
  signed_at: null,
  signer_ip: null,
  document_sha256: null,
  consents: null,
  refused_at: null,
  refusal_reason: null,
  refusal_message: null,
  events: [],
  ...over,
})

const LINKS: Record<string, SignaturePanelLink> = {
  "d-2026-035": baseLink("d-2026-035", {
    state: "viewed", sent_to: "lambert@example.com", view_count: 2,
    first_viewed_at: "2026-09-28T18:40:00Z", last_viewed_at: "2026-09-30T19:05:00Z",
  }),
  "d-2026-034": baseLink("d-2026-034", {
    state: "sent", sent_to: "syndic@mercier.example.com", code_required: true, client_kind: "business",
    expires_at: "2026-10-26T22:59:59Z", created_at: "2026-09-26T08:00:00Z", sent_at: "2026-09-26T08:02:00Z",
  }),
  "d-2026-033": baseLink("d-2026-033", {
    state: "signed", client_kind: "business", sent_to: "compta@bati-ouest.example.com", view_count: 1,
    created_at: "2026-09-24T07:30:00Z", sent_at: "2026-09-24T07:31:00Z", first_viewed_at: "2026-09-25T08:20:00Z", last_viewed_at: "2026-09-25T08:20:00Z",
    signer_name: "Marc Delorme", signer_email: "m.delorme@bati-ouest.example.com", signer_role: "Conducteur de travaux", signer_company: "Bâti Ouest SAS",
    client_order_number: "CMD-4471", signature_method: "drawn", signature_context: "distance", signed_at: "2026-09-25T08:42:00Z",
    signer_ip: "203.0.113.24", document_sha256: SHA, code_required: true, consents: { accepted_document: true, reduced_vat_certified: true },
    events: [
      { type: "created", created_at: "2026-09-24T07:30:00Z" },
      { type: "sent", created_at: "2026-09-24T07:31:00Z" },
      { type: "viewed", created_at: "2026-09-25T08:20:00Z" },
      { type: "code_sent", created_at: "2026-09-25T08:38:00Z" },
      { type: "code_verified", created_at: "2026-09-25T08:40:00Z" },
      { type: "signed", created_at: "2026-09-25T08:42:00Z" },
      { type: "deposit_requested", created_at: "2026-09-25T08:42:00Z" },
    ],
  }),
  "d-2026-026": baseLink("d-2026-026", {
    state: "signed", client_kind: "consumer", sent_to: "claire.fontaine@example.com", view_count: 2,
    created_at: "2026-09-26T09:00:00Z", sent_at: "2026-09-26T09:01:00Z", first_viewed_at: "2026-09-26T18:10:00Z", last_viewed_at: "2026-09-27T10:02:00Z",
    signer_name: "Claire Fontaine", signer_email: "claire.fontaine@example.com", signature_method: "drawn", signature_context: "distance",
    signed_at: "2026-09-27T10:05:00Z", signer_ip: "198.51.100.42", document_sha256: SHA,
    consents: { accepted_document: true, withdrawal_information_shown: true, early_start_requested: false },
    events: [
      { type: "created", created_at: "2026-09-26T09:00:00Z" },
      { type: "sent", created_at: "2026-09-26T09:01:00Z" },
      { type: "viewed", created_at: "2026-09-26T18:10:00Z" },
      { type: "signed", created_at: "2026-09-27T10:05:00Z" },
    ],
  }),
  "d-2026-032": baseLink("d-2026-032", {
    state: "refused", client_kind: "business", sent_to: "agence@verdier.example.com", view_count: 3,
    refused_at: "2026-09-23T15:10:00Z", refusal_reason: "other_offer", signer_name: "Léa Verdier",
    refusal_message: "Nous avons retenu une solution de cloisons vitrées. Merci pour votre proposition.",
  }),
  "bc-2026-006": baseLink("bc-2026-006", {
    state: "signed", client_kind: "business", sent_to: "compta@bati-ouest.example.com", view_count: 1,
    created_at: "2026-10-01T07:12:00Z", sent_at: "2026-10-01T07:12:00Z", first_viewed_at: "2026-10-01T13:58:00Z", last_viewed_at: "2026-10-01T13:58:00Z",
    signer_name: "Marc Delorme", signer_email: "m.delorme@bati-ouest.example.com", signer_role: "Conducteur de travaux", signer_company: "Bâti Ouest SAS",
    client_order_number: "CMD-4471", signature_method: "typed", signature_context: "distance", signed_at: "2026-10-01T14:05:00Z",
    signer_ip: "203.0.113.24", document_sha256: SHA, code_required: true, consents: { accepted_document: true },
    events: [
      { type: "sent", created_at: "2026-10-01T07:12:00Z" },
      { type: "viewed", created_at: "2026-10-01T13:58:00Z" },
      { type: "code_verified", created_at: "2026-10-01T14:03:00Z" },
      { type: "signed", created_at: "2026-10-01T14:05:00Z" },
    ],
  }),
  "bc-2026-005": baseLink("bc-2026-005", {
    state: "viewed", client_kind: "business", sent_to: "achats@habitat-loire.example.com", code_required: true, view_count: 1,
    created_at: "2026-09-30T08:20:00Z", sent_at: "2026-09-30T08:20:00Z", first_viewed_at: "2026-09-30T12:02:00Z", last_viewed_at: "2026-09-30T12:02:00Z",
    expires_at: "2026-10-30T08:20:00Z",
  }),
}

/** Données du panneau « Signature en ligne » d'un document de la démo. */
export function demoSignaturePanel(type: SignatureDocType, id: string): SignaturePanelData {
  const doc = type === "quote" ? demoQuote(id) : demoPurchaseOrder(id)
  const number = doc ? (type === "quote" ? (doc as DemoQuote).quote_number : (doc as DemoPurchaseOrder).po_number) : id
  const key = number.toLowerCase()
  const base = LINKS[key] ?? null
  // Liens en attente : relance 3 jours avant l'expiration ; signés (devis) : acompte de 30 %
  const link: SignaturePanelLink | null = base && {
    ...base,
    expiry_reminder_on: base.state === "sent" || base.state === "viewed" ? parisDay(new Date(new Date(base.expires_at).getTime() - 3 * 86_400_000)) : null,
    deposit: base.state === "signed" && type === "quote" && doc && base.signed_at
      ? demoPanelDeposit(type, number, doc.total_ttc, base.signed_at)
      : null,
  }
  return {
    available: true,
    access: true,
    enabled: true,
    client_kind: doc ? demoKind(doc.client) : "consumer",
    client_email: doc?.client.email ?? null,
    link,
  }
}

/** Démo : acompte affiché au client juste après sa signature. */
export function demoDepositAfterSign(data: PublicSignViewData, urgentRepair: boolean): PublicDeposit | null {
  if (!data.doc || data.doc.type !== "quote") return null
  const plan = planDeposit({
    percent: DEMO_DEPOSIT_PERCENT, totalTtc: data.doc.total_ttc, hasIban: !!transferAccount(DEMO_BANK), clientKind: data.clientKind,
    context: data.onSite ? "in_person" : "distance", urgentRepair, signedAt: new Date(),
  })
  if (!plan) return null
  return publicDeposit({
    amount: plan.amount, percent: plan.percent, reference: depositReference("quote", data.doc.number), timing: plan.timing,
    request_on: plan.requestOn, requested_at: null,
  }, DEMO_BANK, parisDay(new Date()))
}

/* ------------------------------------------------------------------ */
/* Page du client                                                      */
/* ------------------------------------------------------------------ */

const STATE_KEYS: Record<string, { doc: string; state: PublicPageState }> = {
  expire: { doc: "d-2026-031", state: "expired" },
  remplace: { doc: "d-2026-034", state: "superseded" },
  desactive: { doc: "d-2026-034", state: "disabled" },
  retracte: { doc: "d-2026-026", state: "withdrawn" },
  introuvable: { doc: "", state: "not_found" },
}

export const DEMO_PUBLIC_KEYS = ["d-2026-035", "d-2026-034", "bc-2026-005", "d-2026-033", "d-2026-032", "d-2026-026", ...Object.keys(STATE_KEYS)]

/** Vue de la page du client pour la démo (/signer/demo/<clé>). */
export function demoPublicView(key: string, onSite: boolean): PublicSignViewData | null {
  const k = key.toLowerCase()
  const forced = STATE_KEYS[k]
  const docKey = forced ? forced.doc : k
  const q = docKey.startsWith("d-") ? demoQuote(docKey) : undefined
  const p = docKey.startsWith("bc-") ? demoPurchaseOrder(docKey) : undefined
  const source = q ?? p
  if (!source && forced?.state !== "not_found") return null

  const company = {
    name: DEMO_COMPANY.name,
    address: DEMO_COMPANY.address,
    zip_code: DEMO_COMPANY.zip_code,
    city: DEMO_COMPANY.city,
    siren: DEMO_COMPANY.siren,
    siret: null,
    vat_number: DEMO_COMPANY.vat_number,
    email: DEMO_COMPANY.email,
    legal_notice: "Artisan inscrit au répertoire des métiers. Assurance décennale : exemple fictif pour la démonstration.",
  }
  if (!source) {
    return {
      id: k, state: "not_found", mode: "sign", clientKind: "consumer", onSite: false, doc: null, company: null, expires_at: null,
      codeRequired: false, codeVerified: false, codeTarget: null, codeToSignerEmail: false, prefill: { name: "", email: "", company: "" },
      reducedVat: false, reducedVatText: null, closedMessage: null, signed: null, refused: null, withdrawalDeadline: null,
      withdrawal: { available: false, open: false }, withdrawn: null, urgentRepair: false, depositPlanned: null, deposit: null,
      pdfUrl: null, demo: true,
    }
  }

  const link = LINKS[docKey]
  const kind: ClientKind = demoKind(source.client)
  const business = kind === "business"
  const state: PublicPageState = forced?.state
    ?? (link?.state === "signed" ? "signed" : link?.state === "refused" ? "refused" : "sign")
  const reducedVat = needsReducedVatCertification(source.lines)
  const signedAt = link?.signed_at ?? null
  const number = q ? q.quote_number : p!.po_number
  const consumerSigned = kind === "consumer" && !!signedAt
  // Démo : l'acompte d'un devis, 30 % ; à signer : annoncé ; signé à distance : à régler
  const planned = q && state === "sign"
    ? planDeposit({ percent: DEMO_DEPOSIT_PERCENT, totalTtc: source.total_ttc, hasIban: true, clientKind: kind, context: onSite ? "in_person" : "distance", signedAt: new Date() })
    : null
  const deposit = q && state === "signed" && signedAt
    ? publicDeposit(demoPanelDeposit("quote", number, source.total_ttc, signedAt), DEMO_BANK, parisDay(new Date()))
    : null

  return {
    id: k,
    state,
    mode: "sign",
    clientKind: kind,
    onSite: onSite && state === "sign",
    doc: {
      type: q ? "quote" : "purchase_order",
      number,
      issue_date: source.issue_date,
      valid_until: q ? q.valid_until : null,
      delivery_date: p ? p.delivery_date : null,
      reference: p ? p.reference : null,
      lines: source.lines,
      subtotal_ht: source.subtotal_ht,
      total_vat: source.total_vat,
      total_ttc: source.total_ttc,
      notes: q?.notes ?? null,
      client: { name: source.client.name, address: source.client.address, zip_code: source.client.zip_code, city: source.client.city, siren: source.client.siren ?? null },
    },
    company,
    expires_at: link?.expires_at ?? null,
    codeRequired: source.total_ttc > 5000,
    codeVerified: false,
    codeTarget: maskEmail(source.client.email),
    codeToSignerEmail: false,
    prefill: { name: business ? "" : source.client.contact, email: source.client.email, company: business ? source.client.name : "" },
    reducedVat,
    reducedVatText: reducedVat ? reducedVatCertificationText(source.lines) : null,
    closedMessage: null,
    signed: state === "signed" && link && signedAt
      ? { name: link.signer_name ?? "", role: link.signer_role, company: link.signer_company, at: signedAt, method: link.signature_method, order_number: link.client_order_number }
      : null,
    refused: state === "refused" && link?.refused_at ? { at: link.refused_at, reason: "J'ai retenu une autre proposition" } : null,
    withdrawalDeadline: consumerSigned ? withdrawalDeadline(new Date(signedAt!)) : null,
    // La démo garde la rétractation ouverte quelle que soit la date du jour
    withdrawal: { available: consumerSigned, open: consumerSigned && state === "signed" },
    withdrawn: state === "withdrawn" ? { at: "2026-09-30T17:20:00Z", name: link?.signer_name ?? source.client.contact } : null,
    urgentRepair: false,
    depositPlanned: planned ? { percent: planned.percent, amount: planned.amount } : null,
    deposit,
    pdfUrl: null,
    demo: true,
  }
}
