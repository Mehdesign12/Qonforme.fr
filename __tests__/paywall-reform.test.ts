import { describe, expect, it } from "vitest"
import { daysUntilEmission, emissionCountdownText } from "@/lib/billing/reform"

describe("échéance de la facture électronique (mur de paiement B)", () => {
  it("compte les jours à l'heure de Paris", () => {
    expect(daysUntilEmission(new Date("2026-11-10T12:00:00Z"))).toBe(295)
    expect(emissionCountdownText(new Date("2026-11-10T12:00:00Z"))).toMatch(/^Dans 295 jours\./)
    expect(emissionCountdownText(new Date("2027-08-31T12:00:00Z"))).toMatch(/^Demain\./)
    expect(emissionCountdownText(new Date("2027-09-02T12:00:00Z"))).toMatch(/^Obligatoire depuis/)
  })
})
