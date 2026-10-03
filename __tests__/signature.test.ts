import { describe, expect, it } from "vitest"
import { randomBytes } from "crypto"
import fs from "fs"
import path from "path"
import { PDFDocument, PageSizes } from "pdf-lib"
import {
  codeMatches, decodeSignaturePng, decryptToken, deriveKey, encryptToken, generateCode, generateToken, hashCode, hashToken,
  isTokenFormat, sha256Hex, tokenMatches,
} from "@/lib/signature/crypto"
import {
  CODE_MAX_ATTEMPTS, CODE_MAX_SENDS, canCreateLink, canSendCode, canSignDocument, clientKindOf, codeAttemptState,
  computeLinkState, contentFingerprintSource, escapeHtml, frenchHolidays, linkExpiry, maskEmail, needsReducedVatCertification,
  needsVerificationCode, parisEndOfDay, reducedVatCertificationText, refusedStatusFor, signedStatusFor, validateRefusePayload,
  validateSignPayload, withdrawalDeadline, type FingerprintDoc,
} from "@/lib/signature/rules"
import { canTransition } from "@/lib/utils/document-status"
import { buildSignedPdf } from "@/lib/signature/pdf"
import { toPublicView } from "@/lib/signature/public"
import {
  buildSignatureConfirmationEmail, buildSignatureNotificationEmail, buildSignatureRequestEmail,
} from "@/lib/email/templates/signature"
import type { SignatureRow } from "@/lib/signature/types"
import type { LoadedDoc } from "@/lib/signature/server"

const KEY = deriveKey("token", "secret-de-test")
const CODE_KEY = deriveKey("code", "secret-de-test")

/* ------------------------------------------------------------------ */
/* Jetons                                                              */
/* ------------------------------------------------------------------ */

describe("jetons du lien de signature", () => {
  it("génère 256 bits aléatoires en base64url (43 caractères), tous différents", () => {
    const tokens = Array.from({ length: 200 }, generateToken)
    for (const t of tokens) {
      expect(t).toMatch(/^[A-Za-z0-9_-]{43}$/)
      expect(isTokenFormat(t)).toBe(true)
      expect(Buffer.from(t, "base64url")).toHaveLength(32)
    }
    expect(new Set(tokens).size).toBe(tokens.length)
  })

  it("refuse ce qui n'a pas la forme d'un jeton", () => {
    expect(isTokenFormat("")).toBe(false)
    expect(isTokenFormat("abc")).toBe(false)
    expect(isTokenFormat(`${generateToken()}x`)).toBe(false)
    expect(isTokenFormat("a".repeat(42) + "/")).toBe(false)
    expect(isTokenFormat(null)).toBe(false)
  })

  it("ne stocke qu'une empreinte SHA-256, et la compare à temps constant", () => {
    expect(sha256Hex("abc")).toBe("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad")
    const t = generateToken()
    const h = hashToken(t)
    expect(h).toMatch(/^[0-9a-f]{64}$/)
    expect(h).not.toContain(t)
    expect(tokenMatches(t, h)).toBe(true)
    expect(tokenMatches(generateToken(), h)).toBe(false)
    expect(tokenMatches(t, null)).toBe(false)
    expect(tokenMatches("pas-un-jeton", h)).toBe(false)
  })

  it("chiffre la copie du jeton (AES-256-GCM) : relisible avec la clé, illisible sinon", () => {
    const t = generateToken()
    const c = encryptToken(t, KEY)
    expect(c.startsWith("v1.")).toBe(true)
    expect(c).not.toContain(t)
    expect(decryptToken(c, KEY)).toBe(t)
    expect(encryptToken(t, KEY)).not.toBe(c) // IV aléatoire
    expect(decryptToken(c, deriveKey("token", "autre-secret"))).toBeNull()
    const parts = c.split(".")
    parts[3] = Buffer.from("altéré").toString("base64url")
    expect(decryptToken(parts.join("."), KEY)).toBeNull()
    expect(decryptToken(null, KEY)).toBeNull()
  })
})

/* ------------------------------------------------------------------ */
/* Expiration et état du lien                                          */
/* ------------------------------------------------------------------ */

describe("expiration du lien", () => {
  it("fin du jour de validité à l'heure de Paris (été et hiver)", () => {
    expect(parisEndOfDay("2026-10-24").toISOString()).toBe("2026-10-24T21:59:59.000Z")
    expect(parisEndOfDay("2026-10-26").toISOString()).toBe("2026-10-26T22:59:59.000Z")
    expect(parisEndOfDay("2027-01-15").toISOString()).toBe("2027-01-15T22:59:59.000Z")
  })

  it("un devis expire avec sa validité, et un devis périmé ne se fait pas signer", () => {
    const now = new Date("2026-10-03T10:00:00Z")
    expect(linkExpiry({ docType: "quote", mode: "sign", validUntil: "2026-10-28", linkValidityDays: 30, now })?.toISOString())
      .toBe("2026-10-28T22:59:59.000Z")
    expect(linkExpiry({ docType: "quote", mode: "sign", validUntil: "2026-10-02", linkValidityDays: 30, now })).toBeNull()
    // Dernier jour de validité : encore signable jusqu'à minuit
    expect(linkExpiry({ docType: "quote", mode: "sign", validUntil: "2026-10-03", linkValidityDays: 30, now })).not.toBeNull()
  })

  it("bon de commande : durée réglée, bornée entre 1 et 365 jours ; consultation : 90 jours", () => {
    const now = new Date("2026-10-03T10:00:00Z")
    expect(linkExpiry({ docType: "purchase_order", mode: "sign", linkValidityDays: 30, now })?.toISOString()).toBe("2026-11-02T10:00:00.000Z")
    expect(linkExpiry({ docType: "purchase_order", mode: "sign", linkValidityDays: 9999, now })?.getTime()).toBe(now.getTime() + 365 * 86_400_000)
    expect(linkExpiry({ docType: "quote", mode: "view", validUntil: "2026-01-01", linkValidityDays: 30, now })?.getTime()).toBe(now.getTime() + 90 * 86_400_000)
  })

  it("calcule l'état affiché du lien", () => {
    const now = new Date("2026-10-03T10:00:00Z")
    const future = "2026-10-20T00:00:00Z"
    expect(computeLinkState({ status: "pending", expires_at: future }, now)).toBe("ready")
    expect(computeLinkState({ status: "pending", expires_at: future, sent_at: "2026-10-01T00:00:00Z" }, now)).toBe("sent")
    expect(computeLinkState({ status: "pending", expires_at: future, sent_at: "2026-10-01T00:00:00Z", view_count: 2 }, now)).toBe("viewed")
    expect(computeLinkState({ status: "pending", expires_at: "2026-10-03T09:59:59Z", view_count: 2 }, now)).toBe("expired")
    expect(computeLinkState({ status: "signed", expires_at: "2020-01-01T00:00:00Z" }, now)).toBe("signed")
    expect(computeLinkState({ status: "refused", expires_at: future }, now)).toBe("refused")
    expect(computeLinkState({ status: "disabled", expires_at: future }, now)).toBe("disabled")
    expect(computeLinkState({ status: "superseded", expires_at: future }, now)).toBe("superseded")
  })
})

/* ------------------------------------------------------------------ */
/* Transitions (lib/utils/document-status.ts)                          */
/* ------------------------------------------------------------------ */

describe("transitions du document à la signature", () => {
  it("seul un document envoyé se signe", () => {
    expect(canSignDocument("quote", "sent")).toBe(true)
    for (const s of ["draft", "accepted", "rejected"]) expect(canSignDocument("quote", s)).toBe(false)
    expect(canSignDocument("purchase_order", "sent")).toBe(true)
    for (const s of ["draft", "confirmed", "cancelled"]) expect(canSignDocument("purchase_order", s)).toBe(false)
  })

  it("la signature et le refus suivent la liste blanche des statuts", () => {
    expect(signedStatusFor("quote")).toBe("accepted")
    expect(signedStatusFor("purchase_order")).toBe("confirmed")
    expect(canTransition("quote", "sent", signedStatusFor("quote"))).toBe(true)
    expect(canTransition("purchase_order", "sent", signedStatusFor("purchase_order"))).toBe(true)
    expect(refusedStatusFor("quote")).toBe("rejected")
    expect(canTransition("quote", "sent", "rejected")).toBe(true)
    // Un bon de commande refusé garde son statut : l'artisan décide de l'annuler
    expect(refusedStatusFor("purchase_order")).toBeNull()
    // Jamais de retour en arrière depuis un devis signé
    expect(canTransition("quote", "accepted", "rejected")).toBe(false)
  })

  it("un lien de signature naît d'un brouillon (qui part) ou d'un document envoyé", () => {
    expect(canCreateLink("quote", "draft", "sign")).toBe(true)
    expect(canCreateLink("quote", "sent", "sign")).toBe(true)
    expect(canCreateLink("quote", "accepted", "sign")).toBe(false)
    expect(canCreateLink("purchase_order", "cancelled", "sign")).toBe(false)
    expect(canCreateLink("quote", "accepted", "view")).toBe(true)
  })
})

/* ------------------------------------------------------------------ */
/* Code de vérification                                                */
/* ------------------------------------------------------------------ */

describe("code de vérification", () => {
  it("6 chiffres, zéros compris, liés au lien", () => {
    for (let i = 0; i < 100; i++) expect(generateCode()).toMatch(/^\d{6}$/)
    const h = hashCode("lien-a", "012345", CODE_KEY)
    expect(codeMatches("lien-a", "012345", h, CODE_KEY)).toBe(true)
    expect(codeMatches("lien-a", "012346", h, CODE_KEY)).toBe(false)
    expect(codeMatches("lien-b", "012345", h, CODE_KEY)).toBe(false) // un code ne vaut que pour son lien
    expect(codeMatches("lien-a", "12345", h, CODE_KEY)).toBe(false)
    expect(codeMatches("lien-a", 12345, h, CODE_KEY)).toBe(false)
  })

  it("limite les essais et les envois", () => {
    const now = new Date("2026-10-03T10:00:00Z")
    const soon = "2026-10-03T10:05:00Z"
    expect(codeAttemptState({ code_hash: null, code_expires_at: null, code_attempts: 0 }, now)).toBe("none")
    expect(codeAttemptState({ code_hash: "x", code_expires_at: soon, code_attempts: 0 }, now)).toBe("ok")
    expect(codeAttemptState({ code_hash: "x", code_expires_at: soon, code_attempts: CODE_MAX_ATTEMPTS }, now)).toBe("locked")
    expect(codeAttemptState({ code_hash: "x", code_expires_at: "2026-10-03T09:59:00Z", code_attempts: 0 }, now)).toBe("expired")

    expect(canSendCode({ code_sent_count: 0, code_last_sent_at: null }, now)).toEqual({ ok: true })
    expect(canSendCode({ code_sent_count: 1, code_last_sent_at: "2026-10-03T09:59:30Z" }, now)).toEqual({ ok: false, reason: "too_soon", retryIn: 30 })
    expect(canSendCode({ code_sent_count: 1, code_last_sent_at: "2026-10-03T09:58:00Z" }, now)).toEqual({ ok: true })
    expect(canSendCode({ code_sent_count: CODE_MAX_SENDS, code_last_sent_at: "2026-10-01T00:00:00Z" }, now)).toEqual({ ok: false, reason: "limit" })
  })

  it("exigé au-delà du seuil réglé (5 000 € TTC par défaut)", () => {
    const s = { code_mode: "threshold" as const, code_threshold_ttc: 5000 }
    expect(needsVerificationCode(s, 5000)).toBe(false)
    expect(needsVerificationCode(s, 5000.01)).toBe(true)
    expect(needsVerificationCode({ code_mode: "always", code_threshold_ttc: 5000 }, 10)).toBe(true)
    expect(needsVerificationCode({ code_mode: "never", code_threshold_ttc: 5000 }, 1e6)).toBe(false)
  })

  it("masque l'adresse affichée sur la page", () => {
    expect(maskEmail("jean.dupont@exemple.fr")).toBe("je•••@exemple.fr")
    expect(maskEmail("a@b.fr")).toBe("a•••@b.fr")
    expect(maskEmail(null)).toBeNull()
  })
})

/* ------------------------------------------------------------------ */
/* Empreinte                                                           */
/* ------------------------------------------------------------------ */

const DOC: FingerprintDoc = {
  number: "D-2026-035", issue_date: "2026-09-28", valid_until: "2026-10-28", client_id: "c1",
  lines: [{ description: "Isolation des combles", quantity: 85, unit: "m²", unit_price_ht: 36, vat_rate: 5.5, total_ht: 3060 }],
  subtotal_ht: 3060, total_vat: 168.3, total_ttc: 3228.3, notes: null,
}

describe("empreinte du document", () => {
  it("stable quelle que soit l'écriture des nombres (PostgREST renvoie parfois des chaînes)", () => {
    const a = sha256Hex(contentFingerprintSource("quote", DOC))
    const b = sha256Hex(contentFingerprintSource("quote", {
      ...DOC, subtotal_ht: "3060.00", total_ttc: "3228.30",
      lines: [{ ...DOC.lines![0], quantity: "85.000" as unknown as number, total_ht: "3060.00" as unknown as number }],
    }))
    expect(a).toBe(b)
    expect(a).toMatch(/^[0-9a-f]{64}$/)
  })

  it("change dès qu'une ligne, un montant, une date ou le client change", () => {
    const base = sha256Hex(contentFingerprintSource("quote", DOC))
    expect(sha256Hex(contentFingerprintSource("quote", { ...DOC, total_ttc: 3228.31 }))).not.toBe(base)
    expect(sha256Hex(contentFingerprintSource("quote", { ...DOC, valid_until: "2026-10-29" }))).not.toBe(base)
    expect(sha256Hex(contentFingerprintSource("quote", { ...DOC, client_id: "c2" }))).not.toBe(base)
    expect(sha256Hex(contentFingerprintSource("quote", { ...DOC, lines: [{ ...DOC.lines![0], description: "Isolation des rampants" }] }))).not.toBe(base)
    expect(sha256Hex(contentFingerprintSource("purchase_order", DOC))).not.toBe(base)
  })
})

/* ------------------------------------------------------------------ */
/* Règles juridiques                                                   */
/* ------------------------------------------------------------------ */

describe("particulier, professionnel, TVA réduite, rétractation", () => {
  it("professionnel si SIREN ou TVA sur la fiche client", () => {
    expect(clientKindOf({ siren: "501234567" })).toBe("business")
    expect(clientKindOf({ vat_number: "FR32948211375" })).toBe("business")
    expect(clientKindOf({ siren: "  " })).toBe("consumer")
    expect(clientKindOf(null)).toBe("consumer")
  })

  it("certification du taux réduit seulement si le document en contient", () => {
    expect(needsReducedVatCertification([{ vat_rate: 20 }])).toBe(false)
    expect(needsReducedVatCertification([{ vat_rate: 20 }, { vat_rate: "10" }])).toBe(true)
    expect(reducedVatCertificationText([{ vat_rate: 10 }])).not.toContain("278-0 bis A")
    expect(reducedVatCertificationText([{ vat_rate: 5.5 }])).toContain("278-0 bis A")
    expect(reducedVatCertificationText([{ vat_rate: 10 }])).toContain("achevés depuis plus de deux ans")
  })

  it("délai de rétractation : 14 jours, prolongé au premier jour ouvrable (art. L221-19)", () => {
    // Signé un samedi : J+14 tombe un samedi → lundi
    expect(withdrawalDeadline(new Date("2026-10-03T10:00:00Z"))).toBe("2026-10-19")
    // J+14 un mardi
    expect(withdrawalDeadline(new Date("2026-10-20T10:00:00Z"))).toBe("2026-11-03")
    // J+14 le 11 novembre (férié) → 12 novembre
    expect(withdrawalDeadline(new Date("2026-10-28T10:00:00Z"))).toBe("2026-11-12")
    // Le jour compte à l'heure de Paris : 23 h 30 à Paris le 20 = 21:30 UTC
    expect(withdrawalDeadline(new Date("2026-10-20T21:30:00Z"))).toBe("2026-11-03")
    expect(frenchHolidays(2026)).toEqual(expect.arrayContaining(["2026-04-06", "2026-05-14", "2026-05-25"]))
  })
})

/* ------------------------------------------------------------------ */
/* Saisies de la page publique                                         */
/* ------------------------------------------------------------------ */

const PNG_1PX = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=="

describe("validation de la signature", () => {
  const base = {
    signer_name: "Nadia Lambert", signer_email: "Lambert@Example.com", method: "typed", typed_name: "Nadia Lambert",
    consents: { accepted_document: true, early_start_requested: true },
  }

  it("particulier : accepte une signature tapée et garde la demande de démarrage anticipé", () => {
    const r = validateSignPayload(base, { clientKind: "consumer", reducedVat: false })
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.value.signer_email).toBe("lambert@example.com")
    expect(r.value.consents).toEqual({ accepted_document: true, withdrawal_information_shown: true, early_start_requested: true })
    expect(r.value.client_order_number).toBeNull()
    expect(r.value.context).toBe("distance")
  })

  it("exige « Bon pour accord », la certification de TVA réduite et un email valide", () => {
    expect(validateSignPayload({ ...base, consents: {} }, { clientKind: "consumer", reducedVat: false })).toMatchObject({ ok: false, field: "accepted_document" })
    expect(validateSignPayload(base, { clientKind: "consumer", reducedVat: true })).toMatchObject({ ok: false, field: "reduced_vat_certified" })
    expect(validateSignPayload({ ...base, consents: { accepted_document: true, reduced_vat_certified: true } }, { clientKind: "consumer", reducedVat: true }).ok).toBe(true)
    expect(validateSignPayload({ ...base, signer_email: "pas-un-email" }, { clientKind: "consumer", reducedVat: false })).toMatchObject({ ok: false, field: "signer_email" })
    expect(validateSignPayload({ ...base, signer_name: " " }, { clientKind: "consumer", reducedVat: false })).toMatchObject({ ok: false, field: "signer_name" })
  })

  it("professionnel : fonction obligatoire, numéro de commande gardé, pas de rétractation", () => {
    const pro = { ...base, signer_company: "Bâti Ouest SAS", client_order_number: "CMD-4471" }
    expect(validateSignPayload(pro, { clientKind: "business", reducedVat: false })).toMatchObject({ ok: false, field: "signer_role" })
    const r = validateSignPayload({ ...pro, signer_role: "Gérant" }, { clientKind: "business", reducedVat: false })
    expect(r.ok && r.value.client_order_number).toBe("CMD-4471")
    expect(r.ok && r.value.consents.withdrawal_information_shown).toBeUndefined()
    expect(r.ok && r.value.consents.early_start_requested).toBeUndefined()
  })

  it("signature tracée : image PNG obligatoire ; sur place chez un particulier : accord pour l'email", () => {
    expect(validateSignPayload({ ...base, method: "drawn" }, { clientKind: "consumer", reducedVat: false })).toMatchObject({ ok: false, field: "signature" })
    expect(validateSignPayload({ ...base, method: "drawn", image: "data:image/jpeg;base64,xx" }, { clientKind: "consumer", reducedVat: false })).toMatchObject({ ok: false, field: "signature" })
    expect(validateSignPayload({ ...base, method: "drawn", image: PNG_1PX }, { clientKind: "consumer", reducedVat: false }).ok).toBe(true)
    expect(validateSignPayload({ ...base, context: "in_person" }, { clientKind: "consumer", reducedVat: false })).toMatchObject({ ok: false, field: "durable_medium_by_email" })
    const r = validateSignPayload({ ...base, context: "in_person", consents: { ...base.consents, durable_medium_by_email: true } }, { clientKind: "consumer", reducedVat: false })
    expect(r.ok && r.value.consents.durable_medium_by_email).toBe(true)
  })

  it("nettoie les saisies et borne leur longueur", () => {
    const r = validateSignPayload({ ...base, signer_name: "  Nadia\u0000  Lambert\n" + "x".repeat(500) }, { clientKind: "consumer", reducedVat: false })
    expect(r.ok && r.value.signer_name.startsWith("Nadia Lambert")).toBe(true)
    expect(r.ok && r.value.signer_name.length).toBe(120)
  })

  it("refus : motif de la liste, message facultatif", () => {
    expect(validateRefusePayload({ reason: "price", message: "Trop cher" })).toEqual({ ok: true, value: { reason: "price", message: "Trop cher", name: null } })
    expect(validateRefusePayload({ reason: "n'importe" })).toMatchObject({ ok: false, field: "reason" })
  })

  it("image : PNG seulement, taille bornée", () => {
    expect(decodeSignaturePng(PNG_1PX)?.subarray(1, 4).toString()).toBe("PNG")
    expect(decodeSignaturePng("data:image/png;base64,AAAA")).toBeNull()
    expect(decodeSignaturePng(`data:image/png;base64,${randomBytes(300_000).toString("base64")}`)).toBeNull()
    expect(decodeSignaturePng("data:image/svg+xml;base64,PHN2Zz4=")).toBeNull()
  })
})

/* ------------------------------------------------------------------ */
/* PDF signé                                                           */
/* ------------------------------------------------------------------ */

describe("PDF signé", () => {
  it("ajoute la page « Bon pour accord » et le dossier de preuve sans toucher au nombre de pages du document", async () => {
    const original = await PDFDocument.create()
    original.addPage(PageSizes.A4)
    original.addPage(PageSizes.A4)
    const bytes = await original.save()
    const signed = await buildSignedPdf({
      original: bytes, docLabel: "Devis", docNumber: "D-2026-035", companyName: "Garnier Plâtrerie", version: 1, totalTtc: 3228.3,
      contentSha256: "a".repeat(64), documentSha256: sha256Hex(bytes),
      signer: { name: "Nadia Lambert", email: "lambert@example.com" }, clientKind: "consumer", method: "drawn",
      imagePng: decodeSignaturePng(PNG_1PX), context: "distance", consents: { accepted_document: true, reduced_vat_certified: true, early_start_requested: false },
      reducedVatText: reducedVatCertificationText([{ vat_rate: 5.5 }]), signedAt: new Date("2026-10-03T08:00:00Z"),
      ip: "203.0.113.24", userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)",
      code: null, events: [{ type: "sent", created_at: "2026-10-01T08:00:00Z" }, { type: "signed", created_at: "2026-10-03T08:00:00Z" }],
    })
    const loaded = await PDFDocument.load(signed)
    expect(loaded.getPageCount()).toBe(3)
  })
})

/* ------------------------------------------------------------------ */
/* Page publique : rien d'autre que le document du lien                */
/* ------------------------------------------------------------------ */

describe("vue publique", () => {
  const row = {
    id: "0b3f6a2e-1c1d-4e5f-9a8b-7c6d5e4f3a2b", user_id: "user-secret", document_type: "quote", document_id: "doc-1", document_number: "D-2026-035",
    version: 1, mode: "sign", content_sha256: "", token_hash: "hash-secret", token_ciphertext: "chiffre-secret", status: "pending",
    client_kind: "consumer", expires_at: "2099-01-01T00:00:00Z", sent_at: null, sent_to: null, first_viewed_at: null, last_viewed_at: null,
    view_count: 0, code_required: false, code_hash: "code-secret", code_expires_at: null, code_attempts: 0, code_sent_count: 0,
    code_last_sent_at: null, code_sent_to: null, code_verified_at: null, signer_name: null, signer_email: null, signer_role: null,
    signer_company: null, client_order_number: null, signature_method: null, signature_image: null, signature_context: null, consents: {},
    signed_at: null, signer_ip: "198.51.100.1", signer_user_agent: null, document_sha256: null, signed_pdf_path: "user-secret/x/signe.pdf",
    signed_pdf_sha256: null, refused_at: null, refusal_reason: null, refusal_message: null, disabled_at: null, superseded_at: null,
    superseded_by: null, created_at: "2026-10-01T00:00:00Z",
  } as SignatureRow
  const doc: LoadedDoc = {
    type: "quote", id: "doc-1", user_id: "user-secret", number: "D-2026-035", status: "sent", issue_date: "2026-09-28", valid_until: "2099-01-01",
    delivery_date: null, reference: null, lines: [{ description: "Combles", quantity: 1, unit_price_ht: 100, vat_rate: 5.5, total_ht: 100 }],
    subtotal_ht: 100, total_vat: 5.5, total_ttc: 105.5, notes: null, client_id: "c1",
    client: { id: "c1", name: "Nadia Lambert", email: "lambert@example.com", address: null, zip_code: null, city: null, siren: null, vat_number: null },
    raw: { user_id: "user-secret" },
  }

  it("à signer quand le contenu n'a pas changé ; remplacé sinon", async () => {
    const { documentFingerprint } = await import("@/lib/signature/server")
    const ok = toPublicView({ ...row, content_sha256: documentFingerprint(doc) }, doc, null, { onSite: false, now: new Date() })
    expect(ok.state).toBe("sign")
    expect(ok.reducedVat).toBe(true)
    const changed = toPublicView({ ...row, content_sha256: "0".repeat(64) }, doc, null, { onSite: false, now: new Date() })
    expect(changed.state).toBe("superseded")
    const accepted = toPublicView({ ...row, content_sha256: documentFingerprint(doc) }, { ...doc, status: "accepted" }, null, { onSite: false, now: new Date() })
    expect(accepted.state).toBe("closed")
    expect(toPublicView(row, null, null, { onSite: false, now: new Date() }).state).toBe("not_found")
  })

  it("lien désactivé ou remplacé : plus aucun contenu du document", async () => {
    const { documentFingerprint } = await import("@/lib/signature/server")
    for (const status of ["disabled", "superseded"] as const) {
      const v = toPublicView({ ...row, status, content_sha256: documentFingerprint(doc) }, doc, null, { onSite: false, now: new Date() })
      expect(v.state).toBe(status)
      expect(v.doc?.lines).toEqual([])
      expect(v.doc?.client).toBeNull()
      expect(v.doc?.total_ttc).toBe(0)
      expect(v.prefill).toEqual({ name: "", email: "", company: "" })
      expect(v.pdfUrl).toBeNull()
      expect(JSON.stringify(v)).not.toContain("Combles")
    }
  })

  it("n'expose ni identifiant d'utilisateur, ni empreinte, ni chemin de stockage, ni adresse IP", async () => {
    const { documentFingerprint } = await import("@/lib/signature/server")
    const json = JSON.stringify(toPublicView({ ...row, content_sha256: documentFingerprint(doc) }, doc, null, { onSite: false, now: new Date() }))
    for (const secret of ["user-secret", "hash-secret", "chiffre-secret", "code-secret", "198.51.100.1", "signe.pdf"]) {
      expect(json).not.toContain(secret)
    }
  })
})

/* ------------------------------------------------------------------ */
/* Emails                                                              */
/* ------------------------------------------------------------------ */

describe("emails de la signature", () => {
  it("échappent toute saisie", () => {
    expect(escapeHtml(`<script>"x"&'y'</script>`)).toBe("&lt;script&gt;&quot;x&quot;&amp;&#39;y&#39;&lt;/script&gt;")
    const { html } = buildSignatureNotificationEmail({
      outcome: "refused", docType: "quote", docNumber: "D-1", clientName: "<img src=x onerror=alert(1)>", signerName: null, signerRole: null,
      at: new Date(), totalTtc: 10, clientKind: "consumer", context: null, reason: "price", message: "<b>non</b>", docUrl: "https://qonforme.fr/quotes/1",
    })
    expect(html).not.toContain("<img src=x")
    expect(html).not.toContain("<b>non</b>")
    expect(html).toContain("Le prix")
  })

  it("confirmation : formulaire de rétractation pour un particulier seulement", () => {
    const common = {
      docType: "quote" as const, docNumber: "D-2026-035", companyName: "Garnier", companyAddress: "14 rue des Lices, 49100 Angers",
      companyEmail: "contact@garnier.example.com", accentColor: "#2563EB", signerName: "Nadia", signedAt: new Date("2026-10-03T08:00:00Z"),
      totalTtc: 100, context: "distance" as const, earlyStartRequested: true, pageUrl: null,
    }
    const consumer = buildSignatureConfirmationEmail({ ...common, clientKind: "consumer", withdrawalDeadline: "2026-10-19" })
    expect(consumer.html).toContain("Formulaire de rétractation")
    expect(consumer.html).toContain("rétractation du contrat portant sur la prestation de services")
    expect(consumer.html).toContain("L221-25")
    const business = buildSignatureConfirmationEmail({ ...common, clientKind: "business", withdrawalDeadline: null })
    expect(business.html).not.toContain("Formulaire de rétractation")
  })

  it("vocabulaire : signature électronique simple, jamais certifiée ni qualifiée", () => {
    const { html } = buildSignatureRequestEmail({
      docType: "purchase_order", docNumber: "BC-1", companyName: "Garnier", accentColor: "#2563EB", subtotalHt: 1, totalVat: 0.2, totalTtc: 1.2,
      expiresAt: "2026-11-01T00:00:00Z", url: "https://qonforme.fr/s/abc", codeRequired: true,
    })
    expect(html).toContain("Signature électronique simple")
    expect(html).toContain("code à 6 chiffres")
    for (const f of ["lib/email/templates/signature.ts", "lib/signature/pdf.ts", "components/signature/PublicSignView.tsx", "components/signature/SignaturePanel.tsx"]) {
      const src = fs.readFileSync(path.join(process.cwd(), f), "utf8")
      expect(src).not.toMatch(/signature (électronique )?(certifiée|qualifiée)/i)
    }
  })
})

/* ------------------------------------------------------------------ */
/* Routes publiques et service worker                                  */
/* ------------------------------------------------------------------ */

describe("page publique et cache", () => {
  it("le middleware laisse passer la page du client, que le service worker ne met jamais en cache", () => {
    const sw = fs.readFileSync(path.join(process.cwd(), "public/sw.js"), "utf8")
    const list = /const CACHEABLE_PAGE_PREFIXES = \[([\s\S]*?)\]/.exec(sw)?.[1] ?? ""
    expect(list).toContain("'/blog'")
    expect(list).not.toMatch(/'\/s'|'\/signer'/)
    const mw = fs.readFileSync(path.join(process.cwd(), "lib/supabase/middleware.ts"), "utf8")
    expect(mw).toContain("'/signer'")
    expect(mw).toContain("'/api/signature/public'")
  })
})
