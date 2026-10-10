/**
 * Signature en ligne : rétractation en ligne, acompte après signature et
 * relance avant expiration (lib/signature/rules.ts, deposit.ts, settings.ts,
 * public.ts, emails de lib/email/templates/signature.ts).
 */
import { describe, expect, it } from "vitest"
import {
  buildDepositRequestEmail, buildSignatureConfirmationEmail, buildSignatureExpiryReminderEmail, buildSignatureNotificationEmail,
  buildWithdrawalAckEmail,
} from "@/lib/email/templates/signature"
import { depositOfRow, publicDeposit, transferAccount } from "@/lib/signature/deposit"
import { toPublicView } from "@/lib/signature/public"
import {
  canWithdraw, computeLinkState, depositReference, expiryReminderDay, planDeposit, planExpiryReminder, validateSignPayload,
  validateWithdrawPayload, withdrawalDeadline,
} from "@/lib/signature/rules"
import { documentFingerprint, signatureExtrasAvailable, type LoadedDoc } from "@/lib/signature/server"
import { settingsFromRow } from "@/lib/signature/settings"
import { DEFAULT_SIGNATURE_SETTINGS, type SignatureRow } from "@/lib/signature/types"

const IBAN = "FR7630006000011234567890189"
const BANK = { name: "Garnier Plâtrerie", iban: IBAN, bic: "AGRIFRPP", bank_account_holder: null }

/* ------------------------------------------------------------------ */
/* Rétractation                                                        */
/* ------------------------------------------------------------------ */

describe("rétractation en ligne", () => {
  const signedAt = "2026-10-03T08:00:00Z" // samedi : délai jusqu'au lundi 19 octobre (le 17 est un samedi)
  const row = { status: "signed" as const, client_kind: "consumer" as const, signed_at: signedAt }

  it("ouverte pour un particulier, jusqu'au dernier jour inclus", () => {
    expect(withdrawalDeadline(new Date(signedAt))).toBe("2026-10-19")
    expect(canWithdraw(row, new Date("2026-10-19T21:30:00Z"))).toBe(true) // 23 h 30 à Paris
    expect(canWithdraw(row, new Date("2026-10-19T22:30:00Z"))).toBe(false) // 0 h 30 le 20, à Paris
  })

  it("fermée pour un professionnel, un lien non signé ou déjà rétracté", () => {
    const now = new Date("2026-10-05T10:00:00Z")
    expect(canWithdraw({ ...row, client_kind: "business" }, now)).toBe(false)
    expect(canWithdraw({ ...row, status: "pending" }, now)).toBe(false)
    expect(canWithdraw({ ...row, status: "withdrawn" }, now)).toBe(false)
    expect(canWithdraw({ ...row, signed_at: null }, now)).toBe(false)
  })

  it("exige un nom et une confirmation explicite", () => {
    expect(validateWithdrawPayload({ name: "N", confirm: true })).toMatchObject({ ok: false, field: "withdraw_name" })
    expect(validateWithdrawPayload({ name: "Nadia Lambert" })).toMatchObject({ ok: false, field: "withdraw_confirm" })
    expect(validateWithdrawPayload({ name: "Nadia Lambert", confirm: "true" })).toMatchObject({ ok: false, field: "withdraw_confirm" })
    expect(validateWithdrawPayload({ name: "  Nadia   Lambert ", confirm: true, message: "  " })).toEqual({
      ok: true, value: { name: "Nadia Lambert", message: null },
    })
  })

  it("un lien rétracté s'affiche « Rétracté »", () => {
    expect(computeLinkState({ status: "withdrawn", expires_at: "2000-01-01T00:00:00Z" }, new Date())).toBe("withdrawn")
  })
})

/* ------------------------------------------------------------------ */
/* Acompte                                                             */
/* ------------------------------------------------------------------ */

describe("acompte après signature", () => {
  const base = { percent: 30, totalTtc: 1234.5, hasIban: true, clientKind: "consumer" as const, context: "distance" as const, signedAt: new Date("2026-10-03T08:00:00Z") }

  it("rien sans IBAN, à 0 % ou pour un montant nul", () => {
    expect(planDeposit({ ...base, hasIban: false })).toBeNull()
    expect(planDeposit({ ...base, percent: 0 })).toBeNull()
    expect(planDeposit({ ...base, totalTtc: 0 })).toBeNull()
  })

  it("à distance : à régler tout de suite, montant au centime", () => {
    expect(planDeposit(base)).toEqual({ amount: 370.35, percent: 30, timing: "now", requestOn: null })
  })

  it("sur place chez un particulier : demande à J+8, sauf réparation urgente", () => {
    expect(planDeposit({ ...base, context: "in_person" })).toEqual({ amount: 370.35, percent: 30, timing: "later", requestOn: "2026-10-11" })
    expect(planDeposit({ ...base, context: "in_person", urgentRepair: true })?.timing).toBe("now")
    expect(planDeposit({ ...base, context: "in_person", clientKind: "business" })?.timing).toBe("now")
  })

  it("référence du virement", () => {
    expect(depositReference("quote", "D-2026-035")).toBe("Acompte devis D-2026-035")
    expect(depositReference("purchase_order", "BC-2026-005")).toBe("Acompte commande BC-2026-005")
  })

  it("compte du virement : IBAN valide seulement, titulaire par défaut = entreprise", () => {
    expect(transferAccount({ name: "X", iban: "FR76 0000" })).toBeNull()
    expect(transferAccount(BANK)).toEqual({ holder: "Garnier Plâtrerie", iban: IBAN, bic: "AGRIFRPP" })
  })

  it("différé : ni IBAN ni QR avant le jour de la demande, puis tout", () => {
    const panel = depositOfRow({ deposit_amount: "370.35", deposit_percent: "30", deposit_reference: "Acompte devis D-1", deposit_request_on: "2026-10-11", deposit_requested_at: null })
    expect(panel).toMatchObject({ amount: 370.35, timing: "later", request_on: "2026-10-11" })
    const before = publicDeposit(panel, BANK, "2026-10-10")
    expect(before).toMatchObject({ timing: "later", account: null, qr: null })
    const on = publicDeposit(panel, BANK, "2026-10-11")
    expect(on?.timing).toBe("now")
    expect(on?.account?.iban).toBe(IBAN)
    expect(on?.qr?.path.length).toBeGreaterThan(100)
  })

  it("aucun acompte enregistré sur le lien : rien", () => {
    expect(depositOfRow({ deposit_amount: null, deposit_percent: null, deposit_reference: null })).toBeNull()
  })

  it("réparation urgente : retenue seulement pour un particulier signant sur place", () => {
    const ok = (over: Record<string, unknown>, kind: "consumer" | "business") => validateSignPayload({
      signer_name: "Nadia Lambert", signer_email: "nadia@example.com", signer_role: "Gérante", method: "typed", typed_name: "Nadia Lambert",
      consents: { accepted_document: true, durable_medium_by_email: true, urgent_repair_requested: true }, ...over,
    }, { clientKind: kind, reducedVat: false })
    const onSite = ok({ context: "in_person" }, "consumer")
    expect(onSite.ok && onSite.value.consents.urgent_repair_requested).toBe(true)
    const distance = ok({ context: "distance" }, "consumer")
    expect(distance.ok && distance.value.consents.urgent_repair_requested).toBeUndefined()
    const pro = ok({ context: "in_person" }, "business")
    expect(pro.ok && pro.value.consents.urgent_repair_requested).toBeUndefined()
  })
})

/* ------------------------------------------------------------------ */
/* Relance avant expiration                                            */
/* ------------------------------------------------------------------ */

describe("relance avant expiration", () => {
  const settings = { expiry_reminder_enabled: true, expiry_reminder_days: 3 }
  // Devis valable jusqu'au 28 octobre : le lien expire à 23 h 59 59 à Paris (21 h 59 59 UTC, heure d'été)
  const link = {
    status: "pending" as const, mode: "sign" as const, expires_at: "2026-10-28T22:59:59Z",
    sent_at: "2026-10-01T08:00:00Z", expiry_reminder_sent_at: null,
  }

  it("jour de la relance : N jours avant le dernier jour du lien", () => {
    expect(expiryReminderDay(link.expires_at, 3)).toBe("2026-10-25")
  })

  it("part à partir du jour prévu, jusqu'au dernier jour du lien", () => {
    expect(planExpiryReminder(link, settings, new Date("2026-10-24T10:00:00Z"))).toBeNull()
    expect(planExpiryReminder(link, settings, new Date("2026-10-25T07:00:00Z"))).toEqual({ daysLeft: 3 })
    expect(planExpiryReminder(link, settings, new Date("2026-10-28T07:00:00Z"))).toEqual({ daysLeft: 0 })
    expect(planExpiryReminder(link, settings, new Date("2026-10-29T07:00:00Z"))).toBeNull()
  })

  it("une seule fois, jamais pour un lien non envoyé, récent, de consultation, signé ou désactivé", () => {
    const day = new Date("2026-10-26T07:00:00Z")
    expect(planExpiryReminder({ ...link, expiry_reminder_sent_at: "2026-10-25T07:00:00Z" }, settings, day)).toBeNull()
    expect(planExpiryReminder({ ...link, sent_at: null }, settings, day)).toBeNull()
    expect(planExpiryReminder({ ...link, sent_at: "2026-10-25T08:00:00Z" }, settings, day)).toBeNull()
    expect(planExpiryReminder({ ...link, sent_at: "2026-10-24T08:00:00Z" }, settings, day)).toEqual({ daysLeft: 2 })
    expect(planExpiryReminder({ ...link, mode: "view" }, settings, day)).toBeNull()
    expect(planExpiryReminder({ ...link, status: "signed" }, settings, day)).toBeNull()
    expect(planExpiryReminder(link, { ...settings, expiry_reminder_enabled: false }, day)).toBeNull()
  })
})

/* ------------------------------------------------------------------ */
/* Réglages                                                            */
/* ------------------------------------------------------------------ */

describe("réglages de la signature", () => {
  it("valeurs par défaut pour les colonnes absentes ou hors bornes", () => {
    expect(settingsFromRow(null)).toEqual(DEFAULT_SIGNATURE_SETTINGS)
    const old = settingsFromRow({ enabled: true, code_mode: "always", code_threshold_ttc: "1000", link_validity_days: 15 })
    expect(old).toMatchObject({ code_mode: "always", code_threshold_ttc: 1000, expiry_reminder_enabled: true, expiry_reminder_days: 3, deposit_percent: 0 })
    expect(settingsFromRow({ expiry_reminder_enabled: false, expiry_reminder_days: 99, deposit_percent: "30" }))
      .toMatchObject({ expiry_reminder_enabled: false, expiry_reminder_days: 3, deposit_percent: 30 })
  })
})

/* ------------------------------------------------------------------ */
/* Vue publique                                                        */
/* ------------------------------------------------------------------ */

describe("vue publique : rétractation et acompte", () => {
  const doc: LoadedDoc = {
    type: "quote", id: "doc-1", user_id: "user-secret", number: "D-2026-035", status: "accepted", issue_date: "2026-09-28", valid_until: "2099-01-01",
    delivery_date: null, reference: null, lines: [{ description: "Combles", quantity: 1, unit_price_ht: 1000, vat_rate: 20, total_ht: 1000 }],
    subtotal_ht: 1000, total_vat: 200, total_ttc: 1200, notes: null, client_id: "c1",
    client: { id: "c1", name: "Nadia Lambert", email: "lambert@example.com", address: null, zip_code: null, city: null, siren: null, vat_number: null },
    raw: {},
  }
  const signedAt = new Date().toISOString()
  const row = {
    id: "0b3f6a2e-1c1d-4e5f-9a8b-7c6d5e4f3a2b", user_id: "user-secret", document_type: "quote", document_id: "doc-1", document_number: "D-2026-035",
    version: 1, mode: "sign", content_sha256: documentFingerprint(doc), token_hash: "h", token_ciphertext: null, status: "signed",
    client_kind: "consumer", expires_at: "2099-01-01T00:00:00Z", sent_at: null, sent_to: null, first_viewed_at: null, last_viewed_at: null,
    view_count: 0, code_required: false, code_hash: null, code_expires_at: null, code_attempts: 0, code_sent_count: 0, code_last_sent_at: null,
    code_sent_to: null, code_verified_at: null, signer_name: "Nadia Lambert", signer_email: "lambert@example.com", signer_role: null,
    signer_company: null, client_order_number: null, signature_method: "typed", signature_image: null, signature_context: "distance",
    consents: {}, signed_at: signedAt, signer_ip: null, signer_user_agent: null, document_sha256: null, signed_pdf_path: null,
    signed_pdf_sha256: null, refused_at: null, refusal_reason: null, refusal_message: null, disabled_at: null, superseded_at: null,
    superseded_by: null, created_at: signedAt,
  } as SignatureRow
  const withExtras = {
    ...row, withdrawn_at: null, withdrawal_name: null, withdrawal_message: null, expiry_reminder_sent_at: null,
    deposit_amount: 360, deposit_percent: 30, deposit_reference: "Acompte devis D-2026-035", deposit_request_on: null, deposit_requested_at: signedAt,
  } as SignatureRow

  it("sans la migration 20261010 : ni rétractation en ligne ni acompte", () => {
    expect(signatureExtrasAvailable(row)).toBe(false)
    const v = toPublicView(row, doc, null, { onSite: false, now: new Date(), bank: BANK, depositPercent: 30 })
    expect(v.state).toBe("signed")
    expect(v.withdrawal).toEqual({ available: false, open: false })
    expect(v.deposit).toBeNull()
  })

  it("avec la migration : rétractation ouverte et acompte à régler", () => {
    expect(signatureExtrasAvailable(withExtras)).toBe(true)
    const v = toPublicView(withExtras, doc, null, { onSite: false, now: new Date(), bank: BANK })
    expect(v.withdrawal).toEqual({ available: true, open: true })
    expect(v.deposit).toMatchObject({ amount: 360, timing: "now", reference: "Acompte devis D-2026-035" })
    expect(v.deposit?.account?.iban).toBe(IBAN)
    expect(JSON.stringify(v)).not.toContain("user-secret")
  })

  it("rétracté : état propre, plus de formulaire", () => {
    const v = toPublicView({ ...withExtras, status: "withdrawn", withdrawn_at: signedAt, withdrawal_name: "Nadia Lambert" }, doc, null, { onSite: false, now: new Date(), bank: BANK })
    expect(v.state).toBe("withdrawn")
    expect(v.withdrawn).toEqual({ at: signedAt, name: "Nadia Lambert" })
    expect(v.withdrawal.open).toBe(false)
    expect(v.deposit).toBeNull()
  })

  it("à signer : acompte annoncé d'après le réglage, seulement avec un IBAN", () => {
    const pending = { ...withExtras, status: "pending", signed_at: null, deposit_amount: null, deposit_reference: null } as SignatureRow
    const sent = { ...doc, status: "sent" }
    expect(toPublicView(pending, sent, null, { onSite: false, now: new Date(), bank: BANK, depositPercent: 30 }).depositPlanned).toEqual({ percent: 30, amount: 360 })
    expect(toPublicView(pending, sent, null, { onSite: false, now: new Date(), bank: { name: "X", iban: null }, depositPercent: 30 }).depositPlanned).toBeNull()
    expect(toPublicView(pending, sent, null, { onSite: false, now: new Date(), bank: BANK, depositPercent: 0 }).depositPlanned).toBeNull()
  })
})

/* ------------------------------------------------------------------ */
/* Emails                                                              */
/* ------------------------------------------------------------------ */

describe("emails : rétractation, acompte, relance", () => {
  const deposit = { amount: 360, percent: 30, reference: "Acompte devis D-2026-035", timing: "now" as const, requestOn: null, account: { holder: "Garnier", iban: IBAN, bic: null } }
  const common = {
    docType: "quote" as const, docNumber: "D-2026-035", companyName: "Garnier", companyAddress: null, companyEmail: "contact@garnier.example.com",
    accentColor: "#2563EB", signerName: "Nadia", signedAt: new Date("2026-10-03T08:00:00Z"), totalTtc: 1200, context: "distance" as const,
    earlyStartRequested: false, pageUrl: "https://qonforme.fr/s/abc", clientKind: "consumer" as const, withdrawalDeadline: "2026-10-19",
  }

  it("confirmation : bouton « Changer d'avis » et coordonnées de l'acompte", () => {
    const { html } = buildSignatureConfirmationEmail({ ...common, withdrawUrl: "https://qonforme.fr/s/abc?retractation=1", deposit })
    expect(html).toContain("Changer d'avis")
    expect(html).toContain("https://qonforme.fr/s/abc?retractation=1")
    expect(html).toContain("FR76 3000 6000 0112 3456 7890 189")
    expect(html).toContain("Acompte devis D-2026-035")
    expect(html).toContain("L221-24")
  })

  it("confirmation : acompte différé sans IBAN, réparation urgente signalée", () => {
    const { html } = buildSignatureConfirmationEmail({
      ...common, context: "in_person", urgentRepair: true,
      deposit: { ...deposit, timing: "later", requestOn: "2026-10-11", account: null },
    })
    expect(html).not.toContain("FR76")
    expect(html).toContain("L221-10")
    expect(html).toContain("L221-28")
  })

  it("accusé de réception de la rétractation (support durable) et notification à l'artisan", () => {
    const ack = buildWithdrawalAckEmail({
      docType: "quote", docNumber: "D-2026-035", companyName: "Garnier", accentColor: "#2563EB", name: "<b>Nadia</b>",
      signedAt: new Date("2026-10-03T08:00:00Z"), withdrawnAt: new Date("2026-10-05T08:00:00Z"), message: null,
    })
    expect(ack.html).toContain("L221-21")
    expect(ack.html).not.toContain("<b>Nadia</b>")
    const notice = buildSignatureNotificationEmail({
      outcome: "withdrawn", docType: "quote", docNumber: "D-2026-035", clientName: "Lambert", signerName: "Nadia", signerRole: null,
      at: new Date(), totalTtc: 1200, clientKind: "consumer", context: "distance", message: "<script>x</script>", invoiced: true,
      docUrl: "https://qonforme.fr/quotes/1",
    })
    expect(notice.subject).toContain("se rétracte")
    expect(notice.html).toContain("14 jours")
    expect(notice.html).toContain("avoir")
    expect(notice.html).not.toContain("<script>")
  })

  it("relance avant expiration et demande d'acompte", () => {
    const reminder = buildSignatureExpiryReminderEmail({
      docType: "quote", docNumber: "D-2026-035", companyName: "Garnier & <Fils>", accentColor: "#2563EB", totalTtc: 1200,
      expiresAt: "2026-10-28T22:59:59Z", daysLeft: 1, url: "https://qonforme.fr/s/abc",
    })
    expect(reminder.html).toContain("demain")
    expect(reminder.html).toContain("Consulter et signer")
    expect(reminder.html).not.toContain("<Fils>")
    const request = buildDepositRequestEmail({
      docType: "quote", docNumber: "D-2026-035", companyName: "Garnier", accentColor: "#2563EB", name: "Nadia",
      signedAt: new Date("2026-10-03T08:00:00Z"), deposit,
    })
    expect(request.subject).toContain("Acompte")
    expect(request.html).toContain("FR76 3000 6000 0112 3456 7890 189")
  })
})
