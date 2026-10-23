/**
 * Consentement aux cookies (18/10/2026) : logique pure de `lib/consent.ts`.
 * Le choix relu dans le navigateur n'est jamais cru sur parole : tout ce qui est
 * douteux, périmé ou illisible vaut « pas de choix », donc « pas de traceur ».
 */
import { describe, expect, it } from "vitest"
import { CONSENT_ACCEPTED_MAX_AGE_MS, CONSENT_REFUSED_MAX_AGE_MS, isTrackingPage, parseConsent, serializeConsent } from "@/lib/consent"

const NOW = Date.UTC(2026, 9, 18, 12, 0, 0)

describe("parseConsent", () => {
  it("relit un choix valide", () => {
    expect(parseConsent(serializeConsent("accepted", NOW), NOW)).toBe("accepted")
    expect(parseConsent(serializeConsent("refused", NOW), NOW)).toBe("refused")
  })

  it("ne conclut rien d'une valeur absente ou vide", () => {
    expect(parseConsent(null, NOW)).toBeNull()
    expect(parseConsent(undefined, NOW)).toBeNull()
    expect(parseConsent("", NOW)).toBeNull()
  })

  it("refuse tout ce qui n'est pas un choix lisible", () => {
    for (const raw of [
      "accepted",
      "{",
      "null",
      "[]",
      JSON.stringify({ v: 1, choice: "maybe", at: NOW }),
      JSON.stringify({ v: 1, choice: "accepted" }),
      JSON.stringify({ v: 1, choice: "accepted", at: "hier" }),
      JSON.stringify({ v: 1, choice: "accepted", at: null }),
      JSON.stringify({ v: 2, choice: "accepted", at: NOW }),
      JSON.stringify({ choice: "accepted", at: NOW }),
    ]) {
      expect(parseConsent(raw, NOW), raw).toBeNull()
    }
  })

  it("un refus est redemandé après six mois, pas avant", () => {
    const raw = serializeConsent("refused", NOW)
    expect(parseConsent(raw, NOW + CONSENT_REFUSED_MAX_AGE_MS)).toBe("refused")
    expect(parseConsent(raw, NOW + CONSENT_REFUSED_MAX_AGE_MS + 1)).toBeNull()
  })

  it("un accord n'est pas redemandé avant treize mois : le bandeau ne revient pas", () => {
    const raw = serializeConsent("accepted", NOW)
    expect(parseConsent(raw, NOW + CONSENT_REFUSED_MAX_AGE_MS + 86_400_000)).toBe("accepted")
    expect(parseConsent(raw, NOW + CONSENT_ACCEPTED_MAX_AGE_MS)).toBe("accepted")
    expect(parseConsent(raw, NOW + CONSENT_ACCEPTED_MAX_AGE_MS + 1)).toBeNull()
  })

  it("redemande quand la date enregistrée est dans le futur (horloge déréglée)", () => {
    expect(parseConsent(serializeConsent("accepted", NOW + 3_600_000), NOW)).toBeNull()
  })

  it("les durées de validité : six mois pour un refus, treize mois pour un accord", () => {
    expect(CONSENT_REFUSED_MAX_AGE_MS).toBe(182 * 24 * 3600 * 1000)
    expect(CONSENT_ACCEPTED_MAX_AGE_MS).toBe(395 * 24 * 3600 * 1000)
  })
})

describe("isTrackingPage", () => {
  it("laisse les pages publiques et l'application", () => {
    for (const path of ["/", "/signup", "/login", "/pricing", "/modele", "/blog/un-article", "/demo", "/dashboard", "/sources", "/signature", "/administration"]) {
      expect(isTrackingPage(path), path).toBe(true)
    }
  })

  it("exclut les pages des clients de l'artisan, l'admin et l'invitation du comptable", () => {
    for (const path of ["/regler/abc123", "/demo/regler/d-2026-001", "/s/jeton", "/signer", "/signer/42", "/admin", "/admin/seo", "/invitation-comptable"]) {
      expect(isTrackingPage(path), path).toBe(false)
    }
  })
})
