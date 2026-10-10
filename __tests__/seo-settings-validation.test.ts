/**
 * Contrôles faits dans le navigateur par les formulaires de Paramètres
 * (components/admin/seo/settings/validation.ts) : même verdict que les
 * schémas du serveur (lib/seo/settings.ts), messages par champ.
 */
import { describe, expect, it } from "vitest"
import { parseSettings, SETTINGS_DEFAULTS } from "@/lib/seo/settings"
import {
  competitorError,
  countryCodeOf,
  countryName,
  errorFor,
  isKnownCountry,
  linesError,
  linesToList,
  normalizeDomain,
  proofErrors,
  proofUrlError,
  resolveCountry,
  safeExternalUrl,
  sameValue,
  withoutErrors,
} from "@/components/admin/seo/settings/validation"

const serverAcceptsCompetitor = (input: string) => {
  const res = parseSettings("targeting", { ...SETTINGS_DEFAULTS.targeting, competitors: [input] })
  return res.ok ? res.value.competitors[0] : null
}

describe("concurrents", () => {
  const samples = [
    "exemple.fr",
    "https://www.Exemple.fr/page",
    "http://sous.domaine.exemple.co.uk/",
    "WWW.MEDIA-BAT.COM",
    "exemple",
    "exemple .fr",
    "https://",
    "ex_ample.fr",
    "",
  ]

  it("normalise et accepte exactement comme le schéma du serveur", () => {
    samples.forEach((input) => {
      const server = serverAcceptsCompetitor(input)
      const client = competitorError(input, [], 10) === null ? normalizeDomain(input) : null
      expect(client, input).toBe(server)
    })
  })

  it("refuse un doublon et au-delà du maximum", () => {
    expect(competitorError("https://www.exemple.fr", ["exemple.fr"], 10)).toBe("Ce domaine est déjà suivi")
    expect(competitorError("autre.fr", ["a.fr", "b.fr"], 2)).toBe("2 concurrents au maximum")
    expect(competitorError("pas un domaine", [], 10)).toBe("Domaine attendu, par exemple exemple.fr")
  })
})

describe("preuves", () => {
  it("même verdict que le schéma pour l'affirmation, la source et le lien", () => {
    const cases = [
      { claim: "Affirmation", source: "Légifrance", url: "" },
      { claim: "Affirmation", source: "Légifrance", url: "https://www.legifrance.gouv.fr/" },
      { claim: "", source: "Légifrance", url: "" },
      { claim: "Affirmation", source: "  ", url: "" },
      { claim: "Affirmation", source: "Légifrance", url: "pas une adresse" },
      { claim: "a".repeat(301), source: "Légifrance", url: "" },
    ]
    cases.forEach((proof) => {
      const clientOk = Object.keys(proofErrors(proof)).length === 0
      const server = parseSettings("brand", { ...SETTINGS_DEFAULTS.brand, proofs: [proof] })
      expect(clientOk, JSON.stringify(proof)).toBe(server.ok)
    })
  })

  it("n'ouvre que des liens http(s)", () => {
    expect(proofUrlError("javascript:alert(1)")).not.toBeNull()
    expect(safeExternalUrl("javascript:alert(1)")).toBeNull()
    expect(safeExternalUrl("")).toBeNull()
    expect(safeExternalUrl(" https://www.impots.gouv.fr/ ")).toBe("https://www.impots.gouv.fr/")
  })
})

describe("listes et pays", () => {
  it("une ligne par élément, lignes vides ignorées", () => {
    expect(linesToList("Qonforme\n\n  qonforme.fr  \r\n")).toEqual(["Qonforme", "qonforme.fr"])
  })

  it("limite le nombre de lignes et leur longueur, comme le schéma", () => {
    const tooMany = Array.from({ length: 11 }, (_, i) => `Bénéfice ${i + 1}`)
    expect(linesError(tooMany, { max: 10, maxLength: 300, noun: "bénéfices" })).toBe("10 bénéfices au maximum (une ligne par élément)")
    expect(parseSettings("brand", { ...SETTINGS_DEFAULTS.brand, benefits: tooMany }).ok).toBe(false)
    expect(linesError(["court", "x".repeat(81)], { max: 20, maxLength: 80, noun: "termes" })).toBe("Ligne 2 : 80 caractères au plus")
    expect(parseSettings("targeting", { ...SETTINGS_DEFAULTS.targeting, brandTerms: ["court", "x".repeat(81)] }).ok).toBe(false)
    expect(linesError(["Qonforme", "qonforme.fr"], { max: 20, maxLength: 80, noun: "termes" })).toBeNull()
  })

  it("codes pays à deux lettres et noms en français", () => {
    expect(countryCodeOf(" fr ")).toBe("FR")
    expect(countryCodeOf("France")).toBeNull()
    expect(countryName("FR")).toBe("France")
    expect(countryName("BE")).toBe("Belgique")
    expect(isKnownCountry("FR")).toBe(true)
    // Les codes acceptés par le navigateur passent le schéma du serveur
    expect(parseSettings("targeting", { ...SETTINGS_DEFAULTS.targeting, countries: ["FR", "BE"] }).ok).toBe(true)
  })

  it("pays saisi par son nom en français ou son code, jamais un autre pays", () => {
    expect(resolveCountry("Allemagne")).toBe("DE")
    expect(resolveCountry("Suisse")).toBe("CH")
    expect(resolveCountry("  suisse ")).toBe("CH")
    expect(resolveCountry("ÉTATS-UNIS")).toBe("US")
    expect(resolveCountry("etats unis")).toBe("US")
    expect(resolveCountry("Royaume Uni")).toBe("GB")
    expect(resolveCountry("cote d'ivoire")).toBe("CI")
    expect(resolveCountry("Côte d’Ivoire")).toBe("CI")
    expect(resolveCountry("Réunion")).toBe("RE")
    expect(resolveCountry("Vietnam")).toBe("VN")
    expect(resolveCountry("Belgique")).toBe("BE")
    expect(resolveCountry("France")).toBe("FR")
    expect(resolveCountry("Russie")).toBe("RU")
    // Codes à deux lettres, y compris retirés (code actuel)
    expect(resolveCountry("ch")).toBe("CH")
    expect(resolveCountry("de")).toBe("DE")
    expect(resolveCountry("uk")).toBe("GB")
    // Inconnu ou ambigu : null (le formulaire affiche une erreur), jamais l'Albanie ni la Russie
    expect(resolveCountry("Allemagn")).toBeNull()
    expect(resolveCountry("Atlantide")).toBeNull()
    expect(resolveCountry("Congo")).toBeNull()
    expect(resolveCountry("eu")).toBeNull()
    expect(resolveCountry("zz")).toBeNull()
    expect(resolveCountry("")).toBeNull()
    // Le code rendu passe le schéma du serveur
    const codes = ["Allemagne", "Suisse", "uk"].map((n) => resolveCountry(n) as string)
    expect(parseSettings("targeting", { ...SETTINGS_DEFAULTS.targeting, countries: codes }).ok).toBe(true)
  })
})

describe("erreurs du serveur", () => {
  const errors = { name: "Le nom de la marque est obligatoire", "benefits.2": "300 caractères au plus", "proofs.1.url": "Adresse de la source invalide" }

  it("rattache l'erreur d'un élément de liste à son champ", () => {
    expect(errorFor(errors, "name")).toBe("Le nom de la marque est obligatoire")
    expect(errorFor(errors, "benefits", "Ligne")).toBe("Ligne 3 : 300 caractères au plus")
    expect(errorFor(errors, "proofs.1")).toBe("Adresse de la source invalide")
    expect(errorFor(errors, "tone")).toBeNull()
  })

  it("efface les erreurs d'un champ modifié", () => {
    expect(Object.keys(withoutErrors(errors, ["benefits", "proofs"]))).toEqual(["name"])
  })

  it("détecte une modification", () => {
    expect(sameValue({ a: [1, 2] }, { a: [1, 2] })).toBe(true)
    expect(sameValue({ a: [1, 2] }, { a: [2, 1] })).toBe(false)
  })
})
