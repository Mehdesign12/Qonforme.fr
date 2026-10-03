import { afterEach, describe, expect, it, vi } from "vitest"
import {
  DAYS_BEFORE_ISSUE, NOTE_MAX, parisDay, parisTime, parseAmount, parseDeclaration, payState, remainingDue,
} from "@/lib/payment-link/rules"
import { deriveToken, hashToken, isTokenShape, newNonce, paymentLinkSecret, paymentUrl } from "@/lib/payment-link/token"

describe("montant restant dû", () => {
  it("déduit les avoirs déjà émis, au centime", () => {
    expect(remainingDue(1200, [])).toBe(1200)
    expect(remainingDue(1200, [{ total_ttc: 240 }])).toBe(960)
    expect(remainingDue("1200.10", [{ total_ttc: "0.1" }, { total_ttc: 0.2 }])).toBe(1199.8)
    // Pas d'erreur d'arrondi binaire
    expect(remainingDue(0.3, [{ total_ttc: 0.1 }])).toBe(0.2)
  })

  it("n'est jamais négatif, ignore les montants absents", () => {
    expect(remainingDue(100, [{ total_ttc: 150 }])).toBe(0)
    expect(remainingDue(100, [{ total_ttc: null }])).toBe(100)
  })
})

describe("état de la facture vu par le client", () => {
  it("brouillon : jamais de page", () => {
    expect(payState("draft", 100)).toBe("draft")
  })
  it("émise et non réglée : à régler", () => {
    for (const s of ["sent", "pending", "received", "accepted", "overdue"]) expect(payState(s, 10)).toBe("payable")
  })
  it("réglée, avoir total, rejetée ou annulée", () => {
    expect(payState("paid", 0)).toBe("paid")
    expect(payState("credited", 0)).toBe("credited")
    // Avoirs partiels qui couvrent tout le montant sans statut « credited »
    expect(payState("sent", 0)).toBe("credited")
    expect(payState("rejected", 100)).toBe("closed")
    expect(payState("cancelled", 100)).toBe("closed")
  })
})

describe("déclaration « J'ai effectué le virement »", () => {
  const ctx = { today: "2026-10-03", issueDate: "2026-09-12", remaining: 19584 }

  it("accepte une déclaration complète", () => {
    expect(parseDeclaration({ transfer_date: "2026-10-02", amount: "19 584,00", note: "  Virement fait  " }, ctx))
      .toEqual({ ok: true, value: { transferDate: "2026-10-02", amount: 19584, note: "Virement fait" } })
  })

  it("accepte un paiement partiel et une note absente", () => {
    expect(parseDeclaration({ transfer_date: "2026-10-03", amount: 5000 }, ctx))
      .toEqual({ ok: true, value: { transferDate: "2026-10-03", amount: 5000, note: null } })
  })

  it("refuse une date absente, impossible, future ou trop ancienne", () => {
    expect(parseDeclaration({ amount: 1 }, ctx)).toMatchObject({ ok: false, field: "transfer_date" })
    expect(parseDeclaration({ transfer_date: "2026-02-30", amount: 1 }, ctx)).toMatchObject({ ok: false, field: "transfer_date" })
    expect(parseDeclaration({ transfer_date: "03/10/2026", amount: 1 }, ctx)).toMatchObject({ ok: false, field: "transfer_date" })
    // Un jour d'avance toléré (fuseau du client), pas deux
    expect(parseDeclaration({ transfer_date: "2026-10-04", amount: 1 }, ctx)).toMatchObject({ ok: true })
    expect(parseDeclaration({ transfer_date: "2026-10-05", amount: 1 }, ctx)).toMatchObject({ ok: false, field: "transfer_date" })
    expect(DAYS_BEFORE_ISSUE).toBe(60)
    expect(parseDeclaration({ transfer_date: "2026-07-14", amount: 1 }, ctx)).toMatchObject({ ok: true })
    expect(parseDeclaration({ transfer_date: "2026-07-13", amount: 1 }, ctx)).toMatchObject({ ok: false, field: "transfer_date" })
  })

  it("refuse un montant nul, négatif, mal écrit ou supérieur au reste dû", () => {
    const at = (amount: unknown) => parseDeclaration({ transfer_date: "2026-10-01", amount }, ctx)
    expect(at(0)).toMatchObject({ ok: false, field: "amount" })
    expect(at("-5")).toMatchObject({ ok: false, field: "amount" })
    expect(at("12,345")).toMatchObject({ ok: false, field: "amount" })
    expect(at("1e3")).toMatchObject({ ok: false, field: "amount" })
    expect(at({})).toMatchObject({ ok: false, field: "amount" })
    expect(at(19584.01)).toMatchObject({ ok: false, field: "amount" })
    expect(at("19584")).toMatchObject({ ok: true })
  })

  it("limite la note et retire les caractères de contrôle", () => {
    const at = (note: unknown) => parseDeclaration({ transfer_date: "2026-10-01", amount: 1, note }, ctx)
    expect(at("x".repeat(NOTE_MAX + 1))).toMatchObject({ ok: false, field: "note" })
    expect(at(42)).toMatchObject({ ok: false, field: "note" })
    expect(at("a\u0000b\nc\u0007")).toMatchObject({ ok: true, value: { note: "ab\nc" } })
    expect(at("   ")).toMatchObject({ ok: true, value: { note: null } })
  })

  it("résiste à un corps qui n'est pas un objet", () => {
    expect(parseDeclaration(null, ctx)).toMatchObject({ ok: false })
    expect(parseDeclaration("x", ctx)).toMatchObject({ ok: false })
  })

  it("lit les montants à la française", () => {
    expect(parseAmount("1 234,56 €")).toBe(1234.56)
    expect(parseAmount("1 234,5")).toBe(1234.5)
    expect(parseAmount(12.345)).toBe(12.35)
    expect(parseAmount("abc")).toBeNull()
  })
})

describe("dates à l'heure de Paris", () => {
  it("jour et heure d'un horodatage, quelle que soit la machine", () => {
    expect(parisDay("2026-09-30T22:30:00Z")).toBe("2026-10-01") // minuit passé à Paris (UTC+2)
    expect(parisDay("2026-09-30")).toBe("2026-09-30")
    expect(parisTime("2026-09-30T16:12:00Z")).toBe("18:12")
    expect(parisTime("2026-09-30")).toBe("")
  })
})

describe("jeton du lien de paiement", () => {
  afterEach(() => { vi.unstubAllEnvs() })

  it("43 caractères base64url (256 bits), stable pour une facture et un sel", () => {
    const t = deriveToken("secret-de-test-assez-long", "inv-1", "abc")
    expect(isTokenShape(t)).toBe(true)
    expect(deriveToken("secret-de-test-assez-long", "inv-1", "abc")).toBe(t)
  })

  it("change avec le sel, la facture ou le secret", () => {
    const t = deriveToken("secret-de-test-assez-long", "inv-1", "abc")
    expect(deriveToken("secret-de-test-assez-long", "inv-1", "abd")).not.toBe(t)
    expect(deriveToken("secret-de-test-assez-long", "inv-2", "abc")).not.toBe(t)
    expect(deriveToken("autre-secret-de-test-long", "inv-1", "abc")).not.toBe(t)
  })

  it("seule l'empreinte SHA-256 est stockée", () => {
    const h = hashToken("x")
    expect(h).toMatch(/^[0-9a-f]{64}$/)
    expect(h).toBe("2d711642b726b04401627ca9fbac32f5c8530fb1903cc4db02258717921a4881")
  })

  it("refuse ce qui n'a pas la forme d'un jeton", () => {
    expect(isTokenShape("abc")).toBe(false)
    expect(isTokenShape("a".repeat(43))).toBe(true)
    expect(isTokenShape("a".repeat(42) + "/")).toBe(false)
    expect(isTokenShape("a".repeat(44))).toBe(false)
    expect(isTokenShape(undefined)).toBe(false)
  })

  it("sel aléatoire de 128 bits", () => {
    expect(newNonce()).toMatch(/^[0-9a-f]{32}$/)
    expect(newNonce()).not.toBe(newNonce())
  })

  it("secret : PAYMENT_LINK_SECRET, sinon la clé service_role, sinon rien", () => {
    vi.stubEnv("PAYMENT_LINK_SECRET", "un-secret-dedie-de-32-caracteres!")
    expect(paymentLinkSecret()).toBe("un-secret-dedie-de-32-caracteres!")
    vi.stubEnv("PAYMENT_LINK_SECRET", "")
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "service-role-key-assez-longue")
    expect(paymentLinkSecret()).toBe("service-role-key-assez-longue")
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "")
    expect(paymentLinkSecret()).toBeNull()
  })

  it("adresse publique", () => {
    expect(paymentUrl("T".repeat(43), "https://qonforme.fr/")).toBe(`https://qonforme.fr/regler/${"T".repeat(43)}`)
  })
})
