import { describe, expect, it } from "vitest"
import {
  buildSuggestPrompt,
  cleanSuggestion,
  filterSuggestions,
  isTitleCase,
  parseSuggestOutput,
  SUGGEST_CONTENT_MAX,
  SUGGEST_FIELDS,
  SUGGEST_REQUESTED,
} from "@/lib/seo/articles/suggest"
import type { SuggestRequest } from "@/lib/seo/articles/editor-types"
import { analyzeOnPage } from "@/lib/seo/articles/onpage"

const KW = "exemple devis maçonnerie"
const ctx = { keyword: KW, competitors: ["concurrent-btp.fr"] }

const base: SuggestRequest = {
  field: "seoTitle",
  keyword: KW,
  title: "Exemple de devis de maçonnerie",
  excerpt: "Un devis de maçonnerie complet, ligne par ligne.",
  content: "## Les lignes du devis\n\nFondations, murs, dalle.",
}

describe("buildSuggestPrompt", () => {
  it("contexte, règles du champ, règles communes et format JSON", () => {
    const p = buildSuggestPrompt({ ...base, secondary: ["devis maçon"], current: "Ancien titre" })
    expect(p).toContain("TITRE GOOGLE")
    expect(p).toContain(`exactement ${SUGGEST_REQUESTED} versions`)
    expect(p).toContain("« exemple devis maçonnerie »")
    expect(p).toContain("« devis maçon »")
    expect(p).toContain("45 à 60 caractères")
    expect(p).toContain("Sans « | Qonforme »")
    expect(p).toContain("Valeur actuelle (ne la reprenez pas telle quelle) : Ancien titre")
    expect(p).toContain("Jamais « PDP »")
    expect(p).toContain("N'inventez aucun chiffre")
    expect(p).toContain("Aucune promesse de contact humain")
    expect(p).toContain("Fondations, murs, dalle.")
    expect(p).toMatch(/\{"suggestions": \[/)
  })

  it("consignes propres à chaque champ", () => {
    expect(buildSuggestPrompt({ ...base, field: "seoDescription" })).toContain("125 à 150 caractères")
    expect(buildSuggestPrompt({ ...base, field: "slug" })).toContain("3 à 6 mots")
    expect(buildSuggestPrompt({ ...base, field: "excerpt" })).toContain("150 à 220 caractères")
    expect(buildSuggestPrompt({ ...base, field: "title" })).toContain("40 à 80 caractères")
  })

  it("chevrons retirés du texte de l'éditeur, texte tronqué", () => {
    const p = buildSuggestPrompt({ ...base, content: `<script>alert(1)</script>${"a".repeat(SUGGEST_CONTENT_MAX + 500)}` })
    expect(p).not.toContain("<script>")
    const article = p.split("<<<\n")[1].split("\n>>>")[0]
    expect(article.length).toBeLessThanOrEqual(SUGGEST_CONTENT_MAX)
  })

  it("texte vide : le modèle s'appuie sur le titre", () => {
    expect(buildSuggestPrompt({ ...base, content: "" })).toContain("texte pas encore écrit")
  })
})

describe("parseSuggestOutput", () => {
  it("JSON, bloc de code, tableau seul ou lignes", () => {
    expect(parseSuggestOutput('{"suggestions":["a","b"]}')).toEqual(["a", "b"])
    expect(parseSuggestOutput('```json\n{"suggestions":["a", 3, "b"]}\n```')).toEqual(["a", "b"])
    expect(parseSuggestOutput('["x","y"]')).toEqual(["x", "y"])
    expect(parseSuggestOutput("1. Premier\n2. Second\n")).toEqual(["1. Premier", "2. Second"])
  })
})

describe("cleanSuggestion", () => {
  it("guillemets, puces, mise en forme, espaces", () => {
    expect(cleanSuggestion("seoTitle", '1. « Exemple de devis de maçonnerie  détaillé »')).toBe("Exemple de devis de maçonnerie détaillé")
    expect(cleanSuggestion("seoTitle", "- **Devis de maçonnerie**")).toBe("Devis de maçonnerie")
    expect(cleanSuggestion("title", '"Un titre."')).toBe("Un titre")
  })

  it("« | Qonforme » retiré du titre Google (le site l'ajoute)", () => {
    expect(cleanSuggestion("seoTitle", "Exemple de devis de maçonnerie | Qonforme")).toBe("Exemple de devis de maçonnerie")
    expect(cleanSuggestion("seoTitle", "Exemple de devis de maçonnerie - Qonforme")).toBe("Exemple de devis de maçonnerie")
  })

  it("point final ajouté à la description et au chapeau", () => {
    expect(cleanSuggestion("seoDescription", "Un modèle prêt à remplir")).toBe("Un modèle prêt à remplir.")
    expect(cleanSuggestion("excerpt", "Une question ?")).toBe("Une question ?")
  })

  it("adresse passée par slugify (sans accents)", () => {
    expect(cleanSuggestion("slug", "Exemple Devis Maçonnerie Détaillé")).toBe("exemple-devis-maconnerie-detaille")
    // Adresse rendue en entier : seule la fin compte
    expect(cleanSuggestion("slug", "/blog/exemple-devis")).toBe("exemple-devis")
    expect(cleanSuggestion("slug", "https://www.qonforme.fr/blog/exemple-devis-macon?x=1#haut")).toBe("exemple-devis-macon")
    expect(cleanSuggestion("slug", "blog-et-devis-de-macon")).toBe("blog-et-devis-de-macon")
  })
})

describe("isTitleCase", () => {
  it("repère la majuscule à chaque mot", () => {
    expect(isTitleCase("Exemple De Devis Pour Maçonnerie Complète")).toBe(true)
    expect(isTitleCase("Exemple de devis de maçonnerie pour la TVA")).toBe(false)
    expect(isTitleCase("Devis Qonforme")).toBe(false)
  })
})

describe("filterSuggestions", () => {
  it("bornes de longueur par champ", () => {
    const short = "Devis maçonnerie"
    const ok = "Exemple de devis de maçonnerie : les lignes à prévoir"
    const long = `Exemple de devis de maçonnerie ${"très ".repeat(12)}détaillé`
    const r = filterSuggestions("seoTitle", [short, ok, long], ctx)
    expect(r.suggestions.map((s) => s.text)).toEqual([ok])
    expect(r.rejected).toBe(2)
    expect(r.suggestions[0]).toMatchObject({ length: ok.length, hasKeyword: true })
    expect(SUGGEST_FIELDS.seoTitle.max).toBe(70)
  })

  it("valeur périmée, « PDP », certification, concurrent, chevrons : refusés", () => {
    const raw = [
      "Exemple de devis de maçonnerie et franchise à 36 800 €",
      "Exemple de devis de maçonnerie envoyé par votre PDP",
      "Exemple de devis de maçonnerie avec un logiciel certifié",
      "Exemple de devis de maçonnerie, moins cher que Concurrent-btp",
      "Exemple de devis de maçonnerie <b>gratuit</b>",
      "Qonforme agréé : exemple de devis de maçonnerie",
      "Exemple de devis de maçonnerie : les lignes à prévoir",
    ]
    const r = filterSuggestions("seoTitle", raw, ctx)
    expect(r.suggestions.map((s) => s.text)).toEqual(["Exemple de devis de maçonnerie : les lignes à prévoir"])
    expect(r.rejected).toBe(6)
  })

  it("point d'exclamation et majuscule à chaque mot refusés pour les titres", () => {
    const r = filterSuggestions("title", ["Le devis de maçonnerie parfait en dix minutes !", "Exemple De Devis Pour Maçonnerie Complète Et Claire"], ctx)
    expect(r.suggestions).toEqual([])
    expect(r.rejected).toBe(2)
  })

  it("dédoublonnage (accents et casse) et valeur actuelle écartée, sans compter comme refus", () => {
    const a = "Exemple de devis de maçonnerie : les lignes à prévoir"
    const r = filterSuggestions("seoTitle", [a, a.toUpperCase().replace("À", "A"), "Exemple de devis de maconnerie : les lignes a prevoir", "Votre devis de maçonnerie expliqué ligne par ligne"], {
      ...ctx,
      current: "Votre devis de maçonnerie expliqué ligne par ligne",
    })
    expect(r.suggestions.map((s) => s.text)).toEqual([a])
    expect(r.rejected).toBe(0)
  })

  it("tri : mot-clé exact d'abord, puis longueur proche de l'idéal ; trois au plus", () => {
    const raw = [
      "Maçonnerie : un exemple de devis complet et commenté", // sans le mot-clé exact (ordre différent)
      "Exemple de devis de maçonnerie", // 30 car. : loin de l'idéal 45-60
      "Exemple de devis de maçonnerie : les lignes à prévoir", // 53 : dans l'idéal
      "Exemple de devis de maçonnerie pour une extension de maison", // 59 : dans l'idéal
      "Exemple de devis de maçonnerie, poste par poste", // 47
    ]
    const r = filterSuggestions("seoTitle", raw, ctx)
    expect(r.suggestions).toHaveLength(3)
    expect(r.suggestions.every((s) => s.hasKeyword)).toBe(true)
    expect(r.suggestions.map((s) => s.text)).toEqual([raw[2], raw[3], raw[4]])
  })

  it("adresse : slugify, mots du mot-clé, jamais celle d'un autre article", () => {
    const r = filterSuggestions("slug", ["Exemple devis maçonnerie", "exemple-devis-maconnerie-maison", "a"], { ...ctx, taken: ["exemple-devis-maconnerie"] })
    expect(r.suggestions.map((s) => s.text)).toEqual(["exemple-devis-maconnerie-maison"])
    expect(r.suggestions[0].hasKeyword).toBe(true)
    expect(r.rejected).toBe(2)
  })

  it("description : bornes 100 à 170", () => {
    const good = "Un exemple de devis de maçonnerie ligne par ligne : fondations, murs, dalle et mentions à ne pas oublier pour vos chantiers."
    const r = filterSuggestions("seoDescription", [good, "Trop court."], ctx)
    expect(r.suggestions.map((s) => s.text)).toEqual([good])
    expect(r.rejected).toBe(1)
  })
})

describe("zone conseillée du compteur", () => {
  /** Statut du contrôle de longueur pour un titre ou une description de `n` caractères. */
  const checkOf = (id: "title-length" | "description-length", n: number) => {
    const text = "a".repeat(n)
    const r = analyzeOnPage({
      title: "Titre",
      seoTitle: id === "title-length" ? text : "",
      seoDescription: id === "description-length" ? text : "",
      slug: "titre",
      excerpt: "",
      content: "Texte.",
      keyword: null,
      coverUrl: null,
      coverAlt: null,
    })
    return r.checks.find((c) => c.id === id)?.status
  }

  it("la même que celle du score : le compteur et la liste de contrôle ne se contredisent jamais", () => {
    for (let n = 1; n <= 80; n++) {
      const def = SUGGEST_FIELDS.seoTitle
      expect(n >= def.idealMin && n <= def.idealMax, `titre de ${n}`).toBe(checkOf("title-length", n) === "ok")
    }
    for (let n = 60; n <= 200; n++) {
      const def = SUGGEST_FIELDS.seoDescription
      expect(n >= def.idealMin && n <= def.idealMax, `description de ${n}`).toBe(checkOf("description-length", n) === "ok")
    }
  })

  it("la consigne demande la longueur visée (tri des propositions)", () => {
    const def = SUGGEST_FIELDS.seoTitle
    expect(buildSuggestPrompt(base)).toContain(`${def.targetMin} à ${def.targetMax} caractères`)
  })
})
