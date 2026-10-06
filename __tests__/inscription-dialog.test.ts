import { describe, expect, it } from "vitest"
import {
  candidateToInput, companyAsCandidate, companyErrorField, displayFirstName, fullAddressOf, groupSiren,
  nextView, placeOf, previousStep, sameCompany, sirenFromQuery, stepProgress, vatNumberPreview,
} from "@/components/onboarding/inscription/model"
import { DEMO_CANDIDATES, demoSearch } from "@/components/onboarding/inscription/demo"
import { validateCompanyInput } from "@/lib/onboarding/inscription"
import {
  buildDashboardView, inscriptionTile, inscriptionWindowOpen, type InscriptionFacts,
} from "@/components/dashboard/model"
import { buildNewDemoDashboardView } from "@/components/dashboard/demo-data"

const NBSP = "\u00a0"

describe("fenêtre « Bienvenue » : affichage d'une entreprise", () => {
  it("SIREN groupé par trois, espaces insécables", () => {
    expect(groupSiren("948211375")).toBe(`948${NBSP}211${NBSP}375`)
    expect(groupSiren("948 211 375")).toBe(`948${NBSP}211${NBSP}375`)
    expect(groupSiren("1234")).toBe("1234")
    expect(groupSiren(null)).toBe("")
  })

  it("n° de TVA proposé seulement pour un SIREN valide (sauf démo)", () => {
    expect(vatNumberPreview("732829320")).toBe(`FR44${NBSP}732${NBSP}829${NBSP}320`)
    expect(vatNumberPreview("948211375")).toBeNull() // clé de contrôle fausse
    expect(vatNumberPreview("948211375", true)).toBe(`FR12${NBSP}948${NBSP}211${NBSP}375`)
    expect(vatNumberPreview("")).toBeNull()
    expect(vatNumberPreview(null, true)).toBeNull()
  })

  it("prénom du répertoire en capitales remis en forme", () => {
    expect(displayFirstName("THOMAS")).toBe("Thomas")
    expect(displayFirstName("JEAN-PIERRE")).toBe("Jean-Pierre")
    expect(displayFirstName("ÉLODIE  MARIE")).toBe("Élodie Marie")
    expect(displayFirstName("Thomas")).toBe("Thomas")
    expect(displayFirstName("de la Tour")).toBe("de la Tour")
    expect(displayFirstName(undefined)).toBe("")
  })

  it("ville et adresse complète", () => {
    const c = DEMO_CANDIDATES[0]
    expect(placeOf(c)).toBe("49100 Angers")
    expect(fullAddressOf(c)).toBe("14 rue des Lices, 49100 Angers")
    expect(fullAddressOf(DEMO_CANDIDATES[2])).toBe("72000 Le Mans")
  })
})

describe("fenêtre « Bienvenue » : entreprise choisie", () => {
  it("une entreprise du répertoire passe les contrôles de la route", () => {
    const input = candidateToInput(DEMO_CANDIDATES[1])
    expect(input).toMatchObject({ name: "THOMAS GARNIER", siren: "951384207", legal_form: "ei", company_type: null })
    // SIREN fictif de la démo : la route le refuserait, un vrai passe
    expect(validateCompanyInput({ ...input, siren: "732829320" }).ok).toBe(true)
  })

  it("une fiche sans adresse est refusée (complétée à la main)", () => {
    const r = validateCompanyInput(candidateToInput({ ...DEMO_CANDIDATES[2], siren: "732829320" }))
    expect(r.ok).toBe(false)
    if (!r.ok) expect(companyErrorField(r.error)).toBe("address")
  })

  it("chaque message de contrôle vise son champ", () => {
    const base = { name: "Garnier", address: "14 rue des Lices", zip_code: "49100", city: "Angers", siren: "" }
    const fieldOf = (patch: Record<string, string>) => {
      const r = validateCompanyInput({ ...base, ...patch })
      return r.ok ? "ok" : companyErrorField(r.error)
    }
    expect(fieldOf({})).toBe("ok")
    expect(fieldOf({ name: " " })).toBe("name")
    expect(fieldOf({ name: "x".repeat(200) })).toBe("name")
    expect(fieldOf({ address: "" })).toBe("address")
    expect(fieldOf({ zip_code: "4910" })).toBe("zip_code")
    expect(fieldOf({ city: "" })).toBe("city")
    expect(fieldOf({ siren: "948211375" })).toBe("siren")
    expect(companyErrorField("Requête invalide.")).toBeNull()
  })

  it("entreprise enregistrée reconnue (rien à réécrire)", () => {
    const saved = { name: "Garnier Plâtrerie", siren: "732829320", address: "14 rue des Lices", zip_code: "49100", city: "Angers" }
    const same = { name: "garnier  plâtrerie", siren: "732 829 320", address: "14 rue des Lices", zip_code: "49100", city: "Angers" }
    expect(sameCompany(saved, same)).toBe(true)
    expect(sameCompany(saved, { ...same, city: "Nantes" })).toBe(false)
    expect(sameCompany(null, same)).toBe(false)
    expect(sameCompany({ ...saved, siren: null }, { ...same, siren: null })).toBe(true)
  })

  it("entreprise enregistrée affichée comme une ligne de la liste", () => {
    const c = companyAsCandidate({ name: "Garnier", siren: "732 829 320", address: "1 rue", zip_code: "49100", city: "Angers" })
    expect(c).toMatchObject({ siren: "732829320", name: "Garnier", closed: false })
  })

  it("SIREN saisi dans la recherche repris à la main", () => {
    expect(sirenFromQuery("948 211 375")).toBe("948211375")
    expect(sirenFromQuery("garnier")).toBe("")
    expect(sirenFromQuery("94821137500018")).toBe("")
  })
})

describe("fenêtre « Bienvenue » : enchaînement des étapes", () => {
  it("avec le profil légal : entreprise, métier, prénom, puis prêt", () => {
    expect(nextView("company", true)).toBe("trade")
    expect(nextView("trade", true)).toBe("name")
    expect(nextView("name", true)).toBe("done")
    expect(previousStep("company", true)).toBeNull()
    expect(previousStep("name", true)).toBe("trade")
    expect(stepProgress("trade", true)).toEqual({ number: 2, total: 3 })
  })

  it("sans la colonne du profil légal : pas d'étape métier", () => {
    expect(nextView("company", false)).toBe("name")
    expect(previousStep("name", false)).toBe("company")
    expect(stepProgress("name", false)).toEqual({ number: 2, total: 2 })
  })
})

describe("démo : recherche d'entreprise sans réseau", () => {
  it("par nom, sans tenir compte des accents", () => {
    expect(demoSearch("garnier platrerie").map((c) => c.siren)).toEqual(["948211375", "951384207", "512649083"])
    expect(demoSearch("garnier 49").map((c) => c.siren)).toEqual(["948211375", "951384207"])
  })

  it("par numéro", () => {
    expect(demoSearch("951 384").map((c) => c.siren)).toEqual(["951384207"])
    expect(demoSearch("95138420700011").map((c) => c.siren)).toEqual(["951384207"])
  })

  it("rien trouvé : la saisie à la main se montre aussi en démo", () => {
    expect(demoSearch("dupont")).toEqual([])
  })

  it("une entreprise fermée, un entrepreneur individuel avec son prénom", () => {
    expect(DEMO_CANDIDATES.filter((c) => c.closed)).toHaveLength(1)
    expect(DEMO_CANDIDATES.find((c) => c.legal_form === "ei")?.first_name).toBe("Thomas")
  })
})

describe("tableau de bord : fenêtre et tuile « Terminer votre inscription »", () => {
  const facts = (patch: Partial<InscriptionFacts> = {}): InscriptionFacts => ({
    company: false, trade: false, firstName: false, profileAvailable: true,
    wizard: true, windowClosed: false, resume: false, ...patch,
  })

  it("compte sans entreprise : étape 1 sur 3, fenêtre ouverte", () => {
    expect(inscriptionTile(facts())).toEqual({ step: "company", number: 1, total: 3 })
    expect(inscriptionWindowOpen(facts(), true)).toBe(true)
  })

  it("compte sans entreprise, même ancien (sans signup_wizard) : la fenêtre la demande", () => {
    expect(inscriptionTile(facts({ wizard: false }))).toEqual({ step: "company", number: 1, total: 3 })
    expect(inscriptionWindowOpen(facts({ wizard: false }), true)).toBe(true)
  })

  it("fenêtre passée : tuile seule, rouverte par « Reprendre »", () => {
    const closed = facts({ company: true, windowClosed: true })
    expect(inscriptionTile(closed)).toEqual({ step: "trade", number: 2, total: 3 })
    expect(inscriptionWindowOpen(closed, true)).toBe(false)
    expect(inscriptionWindowOpen({ ...closed, resume: true }, true)).toBe(true)
  })

  it("sans profil légal : le prénom est l'étape 2 sur 2", () => {
    expect(inscriptionTile(facts({ company: true, profileAvailable: false }))).toEqual({ step: "name", number: 2, total: 2 })
  })

  it("tout est fait : ni tuile ni fenêtre", () => {
    const done = facts({ company: true, trade: true, firstName: true })
    expect(inscriptionTile(done)).toBeNull()
    expect(inscriptionWindowOpen({ ...done, resume: true }, true)).toBe(false)
  })

  it("compte d'avant l'inscription en deux champs, avec son entreprise : jamais relancé", () => {
    const legacy = facts({ company: true, wizard: false })
    expect(inscriptionTile(legacy)).toBeNull()
    expect(inscriptionWindowOpen(legacy, true)).toBe(false)
  })

  it("entreprise et documents : pas de fenêtre, même sur demande", () => {
    const busy = facts({ company: true, resume: true })
    expect(inscriptionWindowOpen(busy, false)).toBe(false)
    // Sans entreprise, les documents (lecture en échec comprise) n'empêchent pas de la demander
    expect(inscriptionWindowOpen(facts(), false)).toBe(true)
  })

  it("vue d'un compte sans entreprise : calculs sans erreur, tuile transmise", () => {
    const view = buildDashboardView({
      mode: "app", today: "2026-10-06", firstName: "", company: null,
      counts: { invoices: 0, quotes: 0 }, issued: [], open: [], paid: [], drafts: [], recent: [], quotes: [],
      clientsWithoutSiren: null, inscription: { step: "company", number: 1, total: 3 },
    })
    expect(view.isNewAccount).toBe(true)
    expect(view.companyName).toBeNull()
    expect(view.reform).toMatchObject({ sirenOk: false, addressOk: false })
    expect(view.inscription).toEqual({ step: "company", number: 1, total: 3 })
  })

  it("démo d'un compte neuf : même vue, sans données", () => {
    const view = buildNewDemoDashboardView({ step: "company", number: 1, total: 3 })
    expect(view.mode).toBe("demo")
    expect(view.isNewAccount).toBe(true)
    expect(view.inscription?.step).toBe("company")
  })
})
