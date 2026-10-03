/**
 * Signature en ligne dans la démo : mêmes composants que l'application
 * (SignaturePanel, PublicSignView), données fictives tirées de lib/demo/data.ts.
 *
 * - D-2026-035 (particulier, taux réduits) : lien consulté, en attente ;
 * - D-2026-034 (syndic, plus de 5 000 € TTC) : lien envoyé, code par email ;
 * - D-2026-033 : signé en ligne ; D-2026-032 : refusé en ligne ;
 * - BC-2026-006 : confirmé en ligne ; BC-2026-005 : en attente, code par email.
 * Page du client : /signer/demo/<numéro> (et les états expire, remplace,
 * desactive, introuvable).
 */
import { DEMO_COMPANY, demoPurchaseOrder, demoQuote, type DemoPurchaseOrder, type DemoQuote } from "@/lib/demo/data"
import {
  maskEmail, needsReducedVatCertification, reducedVatCertificationText, withdrawalDeadline,
} from "@/lib/signature/rules"
import type { ClientKind, SignatureDocType, SignaturePanelData, SignaturePanelLink } from "@/lib/signature/types"
import type { PublicPageState, PublicSignViewData } from "@/lib/signature/view"

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
  const key = doc ? (type === "quote" ? (doc as DemoQuote).quote_number : (doc as DemoPurchaseOrder).po_number).toLowerCase() : id
  return {
    available: true,
    access: true,
    enabled: true,
    client_kind: doc ? demoKind(doc.client) : "consumer",
    client_email: doc?.client.email ?? null,
    link: LINKS[key] ?? null,
  }
}

/* ------------------------------------------------------------------ */
/* Page du client                                                      */
/* ------------------------------------------------------------------ */

const STATE_KEYS: Record<string, { doc: string; state: PublicPageState }> = {
  expire: { doc: "d-2026-031", state: "expired" },
  remplace: { doc: "d-2026-034", state: "superseded" },
  desactive: { doc: "d-2026-034", state: "disabled" },
  introuvable: { doc: "", state: "not_found" },
}

export const DEMO_PUBLIC_KEYS = ["d-2026-035", "d-2026-034", "bc-2026-005", "d-2026-033", "d-2026-032", ...Object.keys(STATE_KEYS)]

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
      reducedVat: false, reducedVatText: null, closedMessage: null, signed: null, refused: null, withdrawalDeadline: null, pdfUrl: null, demo: true,
    }
  }

  const link = LINKS[docKey]
  const kind: ClientKind = demoKind(source.client)
  const business = kind === "business"
  const state: PublicPageState = forced?.state
    ?? (link?.state === "signed" ? "signed" : link?.state === "refused" ? "refused" : "sign")
  const reducedVat = needsReducedVatCertification(source.lines)
  const signedAt = link?.signed_at ?? null

  return {
    id: k,
    state,
    mode: "sign",
    clientKind: kind,
    onSite: onSite && state === "sign",
    doc: {
      type: q ? "quote" : "purchase_order",
      number: q ? q.quote_number : p!.po_number,
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
    withdrawalDeadline: signedAt && kind === "consumer" ? withdrawalDeadline(new Date(signedAt)) : null,
    pdfUrl: null,
    demo: true,
  }
}
