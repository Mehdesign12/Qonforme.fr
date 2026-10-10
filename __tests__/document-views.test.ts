/**
 * Suivi d'ouverture : libellé de la colonne « Suite » des devis envoyés
 * (components/quotes/QuoteListHelpers.ts), d'après les consultations de leur
 * page en ligne.
 */
import { describe, expect, it } from "vitest"
import { quoteNextStep, viewsLabel } from "@/components/quotes/QuoteListHelpers"

const sent = { status: "sent" as const, valid_until: "2026-12-31", converted: false }

describe("suivi d'ouverture des devis", () => {
  it("ouvert une ou plusieurs fois, à l'heure de Paris", () => {
    expect(viewsLabel({ count: 1, last: "2026-10-08T21:30:00Z" })).toBe("Ouvert 1 fois, le 8 oct.")
    expect(viewsLabel({ count: 3, last: "2026-10-08T22:30:00Z" })).toBe("Ouvert 3 fois, dernière le 9 oct.")
    expect(viewsLabel({ count: 0, last: null })).toBe("Pas encore ouvert")
  })

  it("sans lien en ligne : « En attente de réponse » ; l'expiration proche reste prioritaire", () => {
    expect(quoteNextStep(sent, "2026-10-10").text).toBe("En attente de réponse")
    expect(quoteNextStep({ ...sent, views: { count: 2, last: "2026-10-09T10:00:00Z" } }, "2026-10-10").text).toBe("Ouvert 2 fois, dernière le 9 oct.")
    expect(quoteNextStep({ ...sent, valid_until: "2026-10-12", views: { count: 2, last: "2026-10-09T10:00:00Z" } }, "2026-10-10").tone).toBe("warn")
  })
})
