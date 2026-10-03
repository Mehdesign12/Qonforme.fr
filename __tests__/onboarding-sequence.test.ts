/**
 * Séquence de démarrage (lib/onboarding/sequence.ts) : quel email part quel
 * jour, arrêt dès que l'action est faite, une seule fois chacun, heures
 * d'envoi, écart minimal, désinscription, rappel « plus tard » en attente.
 */
import { describe, expect, it } from "vitest"
import { isSequenceSendingTime, planSequenceEmail, sequenceDay, type SequenceInput } from "@/lib/onboarding/sequence"
import type { AccountFacts } from "@/lib/onboarding/types"

// Lundi 5 octobre 2026, 10 h à Paris (heure d'été : UTC+2)
const ENROLLED = "2026-10-05T08:00:00.000Z"

const facts = (over: Partial<AccountFacts> = {}): AccountFacts => ({
  quotes: 0, firstQuoteSentAt: null, acceptedQuotes: 0,
  invoices: 0, issuedInvoices: 0, draftInvoices: 0, hasPlan: false,
  ...over,
})

const plan = (now: string, over: Partial<SequenceInput> = {}) =>
  planSequenceEmail({
    now: new Date(now),
    enrolledAt: ENROLLED,
    facts: facts(),
    sent: [{ step: "welcome", sent_at: ENROLLED }],
    optedOut: false,
    reminderPending: false,
    lastReminderSentAt: null,
    ...over,
  })

describe("heures d'envoi", () => {
  it("du lundi au samedi, de 9 h à 19 h, heure de Paris", () => {
    expect(isSequenceSendingTime(new Date("2026-10-06T07:00:00Z"))).toBe(true) // mardi 9 h
    expect(isSequenceSendingTime(new Date("2026-10-06T06:59:00Z"))).toBe(false) // mardi 8 h 59
    expect(isSequenceSendingTime(new Date("2026-10-06T17:00:00Z"))).toBe(false) // mardi 19 h
    expect(isSequenceSendingTime(new Date("2026-10-10T08:00:00Z"))).toBe(true) // samedi 10 h
    expect(isSequenceSendingTime(new Date("2026-10-11T08:00:00Z"))).toBe(false) // dimanche
  })

  it("suit l'heure d'hiver : 9 h à Paris = 8 h UTC en novembre", () => {
    expect(isSequenceSendingTime(new Date("2026-11-03T07:30:00Z"))).toBe(false) // 8 h 30
    expect(isSequenceSendingTime(new Date("2026-11-03T08:00:00Z"))).toBe(true) // 9 h
  })

  it("compte les jours en calendrier de Paris", () => {
    expect(sequenceDay(ENROLLED, new Date("2026-10-05T21:59:00Z"))).toBe(0) // 23 h 59 à Paris
    expect(sequenceDay(ENROLLED, new Date("2026-10-05T22:01:00Z"))).toBe(1) // minuit passé
  })
})

describe("aucun devis : J+1 puis J+7", () => {
  it("rien le jour de l'inscription (la bienvenue est partie)", () => {
    expect(plan("2026-10-05T15:00:00Z")).toBeNull()
  })

  it("J+1 : « faites votre premier devis »", () => {
    expect(plan("2026-10-06T08:30:00Z")).toBe("first_quote")
  })

  it("pas en dehors des heures d'envoi ni le dimanche", () => {
    expect(plan("2026-10-06T05:00:00Z")).toBeNull()
    expect(plan("2026-10-11T08:00:00Z", { sent: [] })).toBeNull()
  })

  it("s'arrête dès qu'un devis existe", () => {
    expect(plan("2026-10-06T08:30:00Z", { facts: facts({ quotes: 1 }) })).toBeNull()
    expect(plan("2026-10-12T08:00:00Z", { facts: facts({ quotes: 1 }) })).toBeNull()
  })

  it("une seule fois", () => {
    const sent = [{ step: "welcome" as const, sent_at: ENROLLED }, { step: "first_quote" as const, sent_at: "2026-10-06T08:30:00Z" }]
    expect(plan("2026-10-08T08:30:00Z", { sent })).toBeNull()
  })

  it("J+7 : relance avec l'accès au tableau de bord, puis plus rien", () => {
    const sent = [{ step: "welcome" as const, sent_at: ENROLLED }, { step: "first_quote" as const, sent_at: "2026-10-06T08:30:00Z" }]
    expect(plan("2026-10-11T08:00:00Z", { sent })).toBeNull() // J+6, dimanche
    expect(plan("2026-10-12T08:00:00Z", { sent })).toBe("nudge_7d")
    const after = [...sent, { step: "nudge_7d" as const, sent_at: "2026-10-12T08:00:00Z" }]
    expect(plan("2026-10-14T08:00:00Z", { sent: after })).toBeNull()
  })

  it("cron arrêté pendant la première semaine : à J+7, seulement la relance", () => {
    expect(plan("2026-10-13T08:00:00Z")).toBe("nudge_7d")
  })

  it("rien après 30 jours", () => {
    expect(plan("2026-11-06T09:00:00Z")).toBeNull()
  })

  it("pas pendant qu'un rappel « plus tard » attend, ni moins de 20 h après lui", () => {
    expect(plan("2026-10-06T08:30:00Z", { reminderPending: true })).toBeNull()
    expect(plan("2026-10-06T08:30:00Z", { lastReminderSentAt: "2026-10-06T05:30:00Z" })).toBeNull()
  })
})

describe("écart minimal de 20 heures", () => {
  it("la bienvenue de la veille au soir compte", () => {
    const enrolledAt = "2026-10-05T19:00:00Z" // lundi 21 h
    const sent = [{ step: "welcome" as const, sent_at: enrolledAt }]
    expect(plan("2026-10-06T07:30:00Z", { enrolledAt, sent })).toBeNull() // 12 h 30 après
    expect(plan("2026-10-06T15:30:00Z", { enrolledAt, sent })).toBe("first_quote") // 20 h 30 après
  })
})

describe("du devis à la facture", () => {
  const sentQuote = facts({ quotes: 1, firstQuoteSentAt: "2026-10-06T10:00:00Z" })

  it("le lendemain du premier devis envoyé", () => {
    expect(plan("2026-10-06T15:00:00Z", { facts: sentQuote })).toBeNull() // même jour
    expect(plan("2026-10-07T08:00:00Z", { facts: sentQuote })).toBe("quote_to_invoice")
  })

  it("s'arrête dès qu'une facture existe", () => {
    expect(plan("2026-10-07T08:00:00Z", { facts: { ...sentQuote, invoices: 1, draftInvoices: 1 } })).not.toBe("quote_to_invoice")
  })

  it("part même quand un rappel « plus tard » attend", () => {
    expect(plan("2026-10-07T08:00:00Z", { facts: sentQuote, reminderPending: true })).toBe("quote_to_invoice")
  })
})

describe("avant la première facture : Essentiel", () => {
  it("une facture en brouillon ou un devis accepté, sans formule", () => {
    expect(plan("2026-10-07T08:00:00Z", { facts: facts({ quotes: 1, invoices: 1, draftInvoices: 1 }) })).toBe("essentiel")
    expect(plan("2026-10-07T08:00:00Z", { facts: facts({ quotes: 1, acceptedQuotes: 1, firstQuoteSentAt: "2026-10-05T12:00:00Z" }) })).toBe("essentiel")
  })

  it("s'arrête avec une formule ou une facture émise", () => {
    expect(plan("2026-10-07T08:00:00Z", { facts: facts({ quotes: 1, invoices: 1, draftInvoices: 1, hasPlan: true }) })).toBeNull()
    expect(plan("2026-10-07T08:00:00Z", { facts: facts({ quotes: 1, invoices: 2, draftInvoices: 1, issuedInvoices: 1 }) })).toBeNull()
  })

  it("une seule fois", () => {
    const sent = [{ step: "essentiel" as const, sent_at: "2026-10-06T08:00:00Z" }]
    expect(plan("2026-10-09T08:00:00Z", { sent, facts: facts({ quotes: 1, invoices: 1, draftInvoices: 1 }) })).toBeNull()
  })
})

describe("désinscription", () => {
  it("rien pour un compte désinscrit", () => {
    expect(plan("2026-10-06T08:30:00Z", { optedOut: true })).toBeNull()
    expect(plan("2026-10-07T08:00:00Z", { optedOut: true, facts: facts({ invoices: 1, draftInvoices: 1 }) })).toBeNull()
  })
})
