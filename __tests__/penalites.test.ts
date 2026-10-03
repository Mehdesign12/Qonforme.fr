import { describe, expect, it } from "vitest"
import {
  INDEMNITE_FORFAITAIRE,
  SEMESTRE_REFERENCE,
  TAUX_PENALITES_DEFAUT,
  TAUX_PENALITES_PLANCHER,
  calculerPenalites,
  joursEntre,
  tauxConformeAuPlancher,
} from "@/lib/outils/penalites"
import { SEUILS_FRANCHISE_TVA, situationFranchise } from "@/lib/outils/franchise-tva"
import { ACTIVITES } from "@/lib/outils/charges"

describe("pénalités de retard (Code de commerce, art. L441-10)", () => {
  it("taux par défaut = taux BCE + 10 points, pas BCE × 3", () => {
    expect(TAUX_PENALITES_DEFAUT).toBe(SEMESTRE_REFERENCE.tauxBce + 10)
    // 2ᵉ semestre 2026 : BCE 2,40 % au 1er juillet 2026
    expect(TAUX_PENALITES_DEFAUT).toBe(12.4)
  })

  it("plancher = 3 × le taux d'intérêt légal, pas le taux BCE", () => {
    // 2ᵉ semestre 2026 : taux légal entre professionnels 2,75 % (arrêté du 26 juin 2026)
    expect(TAUX_PENALITES_PLANCHER).toBe(8.25)
  })

  it("sans taux convenu, applique BCE + 10 points", () => {
    const r = calculerPenalites(10_000, 365)
    expect(r.tauxParDefaut).toBe(true)
    expect(r.tauxAnnuel).toBe(12.4)
    expect(r.interetsRetard).toBe(1240)
    expect(r.totalDu).toBe(1240 + INDEMNITE_FORFAITAIRE)
  })

  it("calcule au prorata des jours sur 365", () => {
    // 1 000 € × 12 % × 30 / 365 = 9,86 €
    const r = calculerPenalites(1_000, 30, 12)
    expect(r.interetsRetard).toBe(9.86)
    expect(r.indemniteForfaitaire).toBe(40)
    expect(r.totalDu).toBe(49.86)
  })

  it("signale un taux convenu sous le plancher légal", () => {
    expect(calculerPenalites(1_000, 30, 4).sousLePlancher).toBe(true)
    expect(calculerPenalites(1_000, 30, 8.25).sousLePlancher).toBe(false)
    expect(calculerPenalites(1_000, 30).sousLePlancher).toBe(false)
    expect(tauxConformeAuPlancher(10)).toBe(true)
    expect(tauxConformeAuPlancher(8.2)).toBe(false)
  })

  it("un taux saisi invalide retombe sur le taux par défaut", () => {
    const r = calculerPenalites(1_000, 30, Number.NaN)
    expect(r.tauxParDefaut).toBe(true)
    expect(r.tauxAnnuel).toBe(TAUX_PENALITES_DEFAUT)
  })

  it("compte les jours de retard, jamais négatifs", () => {
    expect(joursEntre("2026-07-01", "2026-07-31")).toBe(30)
    expect(joursEntre("2026-07-31", "2026-07-01")).toBe(0)
  })
})

describe("franchise en base de TVA 2026 (CGI, art. 293 B)", () => {
  const services = SEUILS_FRANCHISE_TVA.find((s) => s.id === "services")!
  const vente = SEUILS_FRANCHISE_TVA.find((s) => s.id === "vente")!

  it("seuils 2026", () => {
    expect([services.seuilBase, services.seuilMajore]).toEqual([37_500, 41_250])
    expect([vente.seuilBase, vente.seuilMajore]).toEqual([85_000, 93_500])
  })

  it("situation selon le chiffre d'affaires de l'année", () => {
    expect(situationFranchise(37_500, "services")).toBe("franchise")
    expect(situationFranchise(40_000, "services")).toBe("fin-au-31-decembre")
    expect(situationFranchise(41_251, "services")).toBe("tva-des-le-depassement")
    expect(situationFranchise(90_000, "vente")).toBe("fin-au-31-decembre")
    expect(situationFranchise(93_501, "vente")).toBe("tva-des-le-depassement")
  })
})

describe("micro-entreprise 2026", () => {
  const taux = Object.fromEntries(ACTIVITES.map((a) => [a.id, a]))

  it("taux de cotisations 2026", () => {
    expect(taux["vente"].tauxCotisations).toBe(12.3)
    expect(taux["prestations-bic"].tauxCotisations).toBe(21.2)
    expect(taux["prestations-bnc"].tauxCotisations).toBe(25.6)
    expect(taux["liberal"].tauxCotisations).toBe(23.2)
  })

  it("plafonds de chiffre d'affaires 2026", () => {
    expect(taux["vente"].plafondCA).toBe(203_100)
    expect(taux["prestations-bic"].plafondCA).toBe(83_600)
    expect(taux["prestations-bnc"].plafondCA).toBe(83_600)
    expect(taux["liberal"].plafondCA).toBe(83_600)
  })
})
