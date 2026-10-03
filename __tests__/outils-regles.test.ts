import { describe, expect, it } from "vitest"
import { analyserFranchise, joursActiviteDepuis, seuilAjuste, situationFranchise } from "@/lib/outils/franchise-tva"
import { HISTORIQUE_SEMESTRES, INDEMNITE_FORFAITAIRE, SEMESTRE_REFERENCE, calculerPenalitesPeriode } from "@/lib/outils/penalites"
import { bilanConformite, criteresPourProfil, factureElectroniqueObligatoire } from "@/lib/outils/conformite"
import { PROFIL_MENTIONS_DEFAUT, bilanMentions, mentionsPourProfil } from "@/lib/outils/mentions-facture"
import { genererNumeros, validerParametresNumero } from "@/lib/outils/numero-facture"
import { calculerRevenuNet, decote, impotBrut, pourcentagesEntiers } from "@/lib/outils/revenu-net"

describe("franchise de TVA : année précédente et année de création", () => {
  it("la fonction historique reste compatible", () => {
    expect(situationFranchise(40_000, "services")).toBe("fin-au-31-decembre")
  })

  it("CA de l'an dernier au-dessus du seuil de base : TVA dès le 1er janvier", () => {
    const r = analyserFranchise({ activite: "services", caAnnee: 10_000, caAnneePrecedente: 38_000 })
    expect(r.situation).toBe("tva-des-le-1er-janvier")
    expect(analyserFranchise({ activite: "services", caAnnee: 10_000, caAnneePrecedente: 37_500 }).situation).toBe("franchise")
    expect(analyserFranchise({ activite: "vente", caAnnee: 10_000, caAnneePrecedente: 85_001 }).situation).toBe("tva-des-le-1er-janvier")
  })

  it("année en cours : seuil de base puis seuil majoré", () => {
    expect(analyserFranchise({ activite: "services", caAnnee: 40_000, caAnneePrecedente: 30_000 }).situation).toBe("fin-au-31-decembre")
    expect(analyserFranchise({ activite: "services", caAnnee: 41_251, caAnneePrecedente: 30_000 }).situation).toBe("tva-des-le-depassement")
    expect(analyserFranchise({ activite: "services", caAnnee: 41_251, caAnneePrecedente: null }).situation).toBe("tva-des-le-depassement")
  })

  it("année de création : seuils au prorata des jours (BOFiP § 290, exemple du 12 juin)", () => {
    expect(joursActiviteDepuis("2025-06-12")).toBe(203)
    expect(seuilAjuste(93_500, 203)).toBe(52_001)
    expect(seuilAjuste(41_250, 203)).toBe(22_942)
    const r = analyserFranchise({ activite: "services", caAnnee: 23_000, caAnneePrecedente: null, joursAnneeCreation: 203 })
    expect([r.seuilMajore, r.situation]).toEqual([22_942, "tva-des-le-depassement"])
    expect(joursActiviteDepuis("2028-01-01")).toBe(365)
  })

  it("l'année suivant la création : CA comparé au seuil de base ajusté (§ 295)", () => {
    // 37 500 × 203 / 365 = 20 856 € : 21 000 € l'an dernier font perdre la franchise au 1er janvier
    const r = analyserFranchise({ activite: "services", caAnnee: 5_000, caAnneePrecedente: 21_000, joursAnneePrecedente: 203 })
    expect([r.seuilBaseAnneePrecedente, r.situation]).toEqual([20_856, "tva-des-le-1er-janvier"])
  })
})

describe("pénalités de retard par semestre (C. com., art. L441-10)", () => {
  it("historique vérifié : 1er semestre 2026 BCE 2,15 %, taux légal 2,62 % ; 2ᵉ semestre = référence", () => {
    const s1 = HISTORIQUE_SEMESTRES.find((s) => s.debut === "2026-01-01")!
    expect([s1.tauxBce, s1.tauxInteretLegalPro]).toEqual([2.15, 2.62])
    const dernier = HISTORIQUE_SEMESTRES[HISTORIQUE_SEMESTRES.length - 1]
    expect([dernier.libelle, dernier.tauxBce, dernier.tauxInteretLegalPro]).toEqual([SEMESTRE_REFERENCE.libelle, SEMESTRE_REFERENCE.tauxBce, SEMESTRE_REFERENCE.tauxInteretLegalPro])
  })

  it("une période à cheval sur deux semestres prend le taux de chacun", () => {
    // Échéance 20 juin 2026, paiement 10 juillet 2026 : 10 jours à 12,15 %, 10 jours à 12,40 %
    const r = calculerPenalitesPeriode(10_000, "2026-06-20", "2026-07-10")
    expect(r.joursRetard).toBe(20)
    expect(r.tranches.map((t) => [t.debut, t.fin, t.jours, t.taux, t.connu])).toEqual([
      ["2026-06-21", "2026-06-30", 10, 12.15, true],
      ["2026-07-01", "2026-07-10", 10, 12.4, true],
    ])
    // 10 000 × 12,15 % × 10/365 = 33,29 ; 10 000 × 12,40 % × 10/365 = 33,97
    expect(r.tranches.map((t) => t.interets)).toEqual([33.29, 33.97])
    expect(r.interetsRetard).toBe(67.26)
    expect(r.totalPenalites).toBe(67.26 + INDEMNITE_FORFAITAIRE)
    expect(r.horsHistorique).toBe(false)
  })

  it("un taux convenu s'applique à toute la période ; plancher par semestre", () => {
    const r = calculerPenalitesPeriode(1_000, "2026-06-20", "2026-07-10", 12)
    expect(r.tranches.every((t) => t.taux === 12)).toBe(true)
    expect(r.sousLePlancher).toBe(false)
    // 8 % : sous 3 × 2,75 % = 8,25 % au 2ᵉ semestre 2026
    expect(calculerPenalitesPeriode(1_000, "2026-06-20", "2026-07-10", 8).sousLePlancher).toBe(true)
  })

  it("hors de l'historique connu : signalé, taux du semestre le plus proche", () => {
    const r = calculerPenalitesPeriode(1_000, "2026-12-20", "2027-01-15")
    expect(r.horsHistorique).toBe(true)
    expect(r.tranches[1]).toMatchObject({ semestre: "1er semestre 2027", connu: false, semestreDuTaux: SEMESTRE_REFERENCE.libelle })
    expect(calculerPenalitesPeriode(1_000, "2024-12-01", "2025-01-10").horsHistorique).toBe(true)
  })

  it("aucun jour de retard si payé à l'échéance", () => {
    expect(calculerPenalitesPeriode(1_000, "2026-07-10", "2026-07-10").joursRetard).toBe(0)
  })
})

describe("vérificateur de conformité", () => {
  it("facture électronique selon le calendrier : PME au 1er septembre 2027, grandes entreprises au 1er septembre 2026", () => {
    expect(factureElectroniqueObligatoire({ taille: "pme", client: "pro", dateEmission: "2027-08-31" })).toBe(false)
    expect(factureElectroniqueObligatoire({ taille: "pme", client: "pro", dateEmission: "2027-09-01" })).toBe(true)
    expect(factureElectroniqueObligatoire({ taille: "grande", client: "pro", dateEmission: "2026-09-01" })).toBe(true)
    expect(factureElectroniqueObligatoire({ taille: "grande", client: "autre", dateEmission: "2027-09-01" })).toBe(false)
  })

  it("complet seulement si tous les critères obligatoires applicables sont cochés", () => {
    const criteres = criteresPourProfil({ taille: "pme", client: "pro", dateEmission: "2026-10-03" })
    const obligatoires = criteres.filter((c) => c.statut === "obligatoire")
    // Les critères de la facture électronique ne sont pas encore exigés pour une PME en octobre 2026
    expect(criteres.find((c) => c.id === "fe_format")?.statut).toBe("a-venir")
    const tous = Object.fromEntries(obligatoires.map((c) => [c.id, true]))
    expect(bilanConformite(criteres, tous).niveau).toBe("complet")
    const sauf1 = { ...tous, [obligatoires[0].id]: false }
    const b = bilanConformite(criteres, sauf1)
    expect(b.niveau).toBe("partiel")
    expect(b.pourcentage).toBeLessThan(100)
    expect(b.manquants).toHaveLength(1)
  })

  it("conservation : 6 ans (LPF L102 B) et 10 ans (C. com. L123-22), plus de « 10 ans garantis »", () => {
    const c = criteresPourProfil({ taille: "pme", client: "pro", dateEmission: "2026-10-03" }).find((x) => x.id === "conservation")!
    expect(c.label).toMatch(/6 ans/)
    expect(c.help).toMatch(/L102 B/)
    expect(c.help).toMatch(/L123-22/)
  })
})

describe("vérificateur des mentions selon le profil", () => {
  const ids = (p = PROFIL_MENTIONS_DEFAUT) => mentionsPourProfil(p).filter((m) => m.statut === "obligatoire").map((m) => m.id)

  it("micro-entreprise en franchise : 293 B obligatoire, ni n° de TVA ni RCS comptés", () => {
    const o = ids({ ...PROFIL_MENTIONS_DEFAUT, statut: "ei", tva: "franchise" })
    expect(o).toContain("mention_293b")
    expect(o).not.toContain("emetteur_tva")
    expect(o).not.toContain("emetteur_rcs")
    expect(o).not.toContain("ventilation_tva")
  })

  it("société qui facture la TVA : RCS, forme et capital, n° de TVA, ventilation par taux", () => {
    const o = ids({ ...PROFIL_MENTIONS_DEFAUT, statut: "societe", tva: "assujetti" })
    expect(o).toEqual(expect.arrayContaining(["emetteur_rcs", "emetteur_forme", "emetteur_tva", "ventilation_tva"]))
    expect(o).not.toContain("mention_293b")
  })

  it("artisan du bâtiment : assurance obligatoire ; autoliquidation quand elle s'applique", () => {
    expect(ids({ ...PROFIL_MENTIONS_DEFAUT, batiment: true })).toContain("assurance")
    expect(ids({ ...PROFIL_MENTIONS_DEFAUT, batiment: false })).not.toContain("assurance")
    expect(ids({ ...PROFIL_MENTIONS_DEFAUT, tva: "assujetti", autoliquidation: true })).toContain("autoliquidation")
    expect(ids({ ...PROFIL_MENTIONS_DEFAUT, tva: "assujetti", autoliquidation: false })).not.toContain("autoliquidation")
  })

  it("client particulier : pas d'indemnité de 40 €", () => {
    expect(ids({ ...PROFIL_MENTIONS_DEFAUT, client: "particulier" })).not.toContain("indemnite")
  })

  it("100 % seulement quand toutes les obligatoires sont cochées", () => {
    const m = mentionsPourProfil(PROFIL_MENTIONS_DEFAUT)
    const o = m.filter((x) => x.statut === "obligatoire")
    const coches = Object.fromEntries(o.slice(1).map((x) => [x.id, true]))
    expect(bilanMentions(m, coches).pourcentage).toBeLessThan(100)
    expect(bilanMentions(m, { ...coches, [o[0].id]: true }).complet).toBe(true)
  })
})

describe("générateur de numéro de facture", () => {
  const p = { format: "standard" as const, prefixe: "F", annee: "2026", mois: "10", compteur: "1", chiffres: 3 }
  it("numéros valides", () => {
    expect(genererNumeros(p, 3)).toEqual(["F-2026-001", "F-2026-002", "F-2026-003"])
    expect(genererNumeros({ ...p, format: "compact" }, 1)).toEqual(["202610001"])
  })
  it("pas de « -2026-001 », d'année fausse ni de compteur négatif", () => {
    expect(validerParametresNumero({ ...p, prefixe: "" }).prefixe).toBeTruthy()
    expect(genererNumeros({ ...p, prefixe: "" })).toEqual([])
    expect(validerParametresNumero({ ...p, prefixe: "F A" }).prefixe).toBeTruthy()
    expect(validerParametresNumero({ ...p, annee: "26" }).annee).toBeTruthy()
    expect(validerParametresNumero({ ...p, compteur: "-3" }).compteur).toBeTruthy()
    expect(validerParametresNumero({ ...p, compteur: "0" }).compteur).toBeTruthy()
    // Sans préfixe dans le format compact, le préfixe n'est pas exigé
    expect(validerParametresNumero({ ...p, format: "compact", prefixe: "" })).toEqual({})
  })
})

describe("revenu net", () => {
  it("décote d'une personne seule (BOFiP BOI-IR-LIQ-20-20-30-20260407)", () => {
    expect(decote(1_400)).toBe(Math.round(897 - 1_400 * 0.4525))
    expect(decote(1_982)).toBe(0)
    expect(decote(300)).toBe(300)
    // 24 000 € imposables : (24 000 − 11 600) × 11 % = 1 364 € ; décote 897 − 45,25 % × 1 364 = 280 €
    expect(impotBrut(24_000)).toBe(1_364)
    expect(decote(1_364)).toBe(280)
  })

  it("net mensuel au centime", () => {
    const r = calculerRevenuNet(36_000, "prestations-bnc")
    expect(r.netMensuel).toBe(Math.round((r.netAnnuel / 12) * 100) / 100)
    expect(r.impotAnnuel).toBe(r.impotBrut - r.decote)
  })

  it("parts du chiffre d'affaires qui totalisent 100 %", () => {
    expect(pourcentagesEntiers([1, 1, 1])).toEqual([34, 33, 33])
    for (const ca of [12_000, 25_000, 36_000, 50_000, 77_700]) {
      const r = calculerRevenuNet(ca, "prestations-bnc")
      const parts = pourcentagesEntiers([r.netAnnuel, r.charges, r.impotAnnuel])
      expect(parts.reduce((s, v) => s + v, 0)).toBe(100)
    }
  })
})
