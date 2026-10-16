import { describe, expect, it } from "vitest"
import {
  analyzeOnPage,
  countKeyword,
  findMissingAccents,
  googleTitleOf,
  markdownStats,
  matchKeyword,
  normalizeForMatch,
  scoreTone,
  sortChecks,
  type OnPageInput,
} from "@/lib/seo/articles/onpage"

const LONG_BODY = Array.from({ length: 12 }, (_, i) => `Paragraphe ${i + 1} sur le devis d'un artisan du bâtiment, avec des règles claires et des exemples chiffrés pour chaque chantier de rénovation, du métré à la signature.`).join("\n\n")

function base(over: Partial<OnPageInput> = {}): OnPageInput {
  return {
    title: "Exemple de devis de maçonnerie : modèle gratuit et chiffré",
    seoTitle: "",
    seoDescription: "",
    slug: "exemple-devis-maconnerie",
    excerpt: "Un exemple de devis de maçonnerie complet, avec les mentions obligatoires, la TVA par ligne et un acompte, à recopier ou à générer gratuitement.",
    content: [
      "Un exemple de devis de maçonnerie aide à chiffrer un mur, une dalle ou une ouverture sans rien oublier.",
      "## Les lignes d'un exemple de devis de maçonnerie",
      LONG_BODY,
      "## Les mentions obligatoires",
      "Voir le [guide des mentions](/guide/mentions-obligatoires-devis) et le [modèle de devis](/modele).",
      "## La TVA des travaux",
      "Détails sur [service-public.gouv.fr](https://www.service-public.gouv.fr/particuliers/vosdroits/F31144).",
    ].join("\n\n"),
    keyword: "exemple devis maçonnerie",
    coverUrl: "https://x.supabase.co/storage/v1/object/public/blog-covers/a.jpg",
    coverAlt: "Maçon montant un mur en parpaings",
    lengthMin: 100,
    lengthMax: 2000,
    ...over,
  }
}

const statusOf = (r: ReturnType<typeof analyzeOnPage>, id: string) => r.checks.find((c) => c.id === id)?.status

describe("comparaison du mot-clé", () => {
  it("ignore accents, casse, apostrophes et pluriel", () => {
    expect(normalizeForMatch("Devis d’un Maçon")).toBe("devis d un macon")
    expect(matchKeyword("Les devis des maçons du bâtiment", "devis maçon")).toBe("exact")
    expect(matchKeyword("Exemple de devis de maçonnerie gratuit", "exemple devis maçonnerie")).toBe("exact")
    expect(matchKeyword("exemple devis maconnerie gratuit", "Exemple devis maçonnerie")).toBe("exact")
    expect(matchKeyword("Logiciel pour plombiers", "logiciel plombier")).toBe("exact")
    expect(matchKeyword("Maçonnerie : un exemple de devis", "exemple devis maçonnerie")).toBe("partial")
    expect(matchKeyword("Devis gratuit, puis plus loin dans la phrase un exemple", "exemple devis")).toBe("partial")
    expect(matchKeyword("Un autre sujet", "logiciel plombier")).toBe("none")
  })

  it("compte les occurrences sans chevauchement", () => {
    expect(countKeyword("devis vierge, devis vierge pdf et Devis Vierge", "devis vierge")).toBe(3)
    expect(countKeyword("rien", "devis vierge")).toBe(0)
  })
})

describe("accents", () => {
  it("repère les mots sans accents, en gardant la majuscule", () => {
    const hits = findMissingAccents("Auto entrepreneur batiment : guide du Batiment et de la maconnerie")
    expect(hits).toEqual([
      { word: "batiment", suggestion: "bâtiment", count: 2 },
      { word: "maconnerie", suggestion: "maçonnerie", count: 1 },
    ])
    expect(findMissingAccents("Batiment")[0].suggestion).toBe("Bâtiment")
  })

  it("ignore les adresses et les liens", () => {
    expect(findMissingAccents("Voir [le guide](/guide/batiment) et https://qonforme.fr/batiment")).toEqual([])
    expect(findMissingAccents("Le bâtiment et la maçonnerie")).toEqual([])
  })
})

describe("lecture du Markdown", () => {
  it("compte titres, liens, images et premier paragraphe", () => {
    const s = markdownStats(
      [
        "# Titre 1",
        "Premier paragraphe.",
        "## Section",
        "- liste avec [lien](/guide)",
        "![Un maçon](https://x.supabase.co/storage/v1/object/public/blog-covers/a.jpg)",
        "![](https://x.supabase.co/b.jpg)",
        "[externe](https://exemple.com) et [officiel](https://www.legifrance.gouv.fr/x) et [site](https://qonforme.fr/modele)",
        '<a href="/outils">outil</a>',
      ].join("\n\n"),
    )
    expect(s.h1).toBe(1)
    expect(s.h2).toBe(1)
    expect(s.internalLinks).toBe(3)
    expect(s.externalLinks).toBe(2)
    expect(s.nonOfficialLinks).toEqual(["https://exemple.com"])
    expect(s.images).toBe(2)
    expect(s.imagesWithoutAlt).toBe(1)
    expect(s.firstParagraph).toBe("Premier paragraphe.")
  })

  it("« /\\hôte » et « //hôte » ne sont pas des liens internes : liens externes non officiels", () => {
    const s = markdownStats("[a](/\\evil.example/x) et [b](//evil.example/y) et [c](/guide)")
    expect(s.internalLinks).toBe(1)
    expect(s.nonOfficialLinks).toEqual(["/\\evil.example/x", "//evil.example/y"])
  })
})

describe("titre affiché par Google", () => {
  it("ajoute « | Qonforme » quand il tient dans 70 caractères", () => {
    expect(googleTitleOf("Exemple de devis de maçonnerie")).toBe("Exemple de devis de maçonnerie | Qonforme")
    const long = "Exemple de devis de maçonnerie pour un mur, une dalle et une ouverture"
    expect(googleTitleOf(long).endsWith("| Qonforme")).toBe(false)
    expect(googleTitleOf(long).length).toBeLessThanOrEqual(70)
  })
})

describe("analyse de la page", () => {
  it("valide un article bien construit", () => {
    const r = analyzeOnPage(base())
    expect(statusOf(r, "keyword")).toBe("ok")
    expect(statusOf(r, "kw-slug")).toBe("ok")
    expect(statusOf(r, "kw-intro")).toBe("ok")
    expect(statusOf(r, "internal-links")).toBe("ok")
    expect(statusOf(r, "cover-alt")).toBe("ok")
    expect(statusOf(r, "accents")).toBe("ok")
    expect(r.descriptionFromExcerpt).toBe(true)
    expect(r.score).toBeGreaterThanOrEqual(70)
    expect(scoreTone(r.score)).not.toBe("danger")
  })

  it("signale l'absence de mot-clé sans casser les autres contrôles", () => {
    const r = analyzeOnPage(base({ keyword: null }))
    expect(statusOf(r, "keyword")).toBe("error")
    expect(statusOf(r, "kw-title")).toBe("warn")
    expect(r.checks.find((c) => c.id === "kw-density")).toBeUndefined()
  })

  it("mesure le titre et la description Google", () => {
    const longTitle = "Exemple de devis de maçonnerie gratuit et complet pour tous les artisans du bâtiment en 2026"
    const r = analyzeOnPage(base({ seoTitle: longTitle, seoDescription: "Trop court." }))
    expect(statusOf(r, "title-length")).toBe("error")
    expect(statusOf(r, "description-length")).toBe("error")
    expect(r.descriptionFromExcerpt).toBe(false)
  })

  it("repère accents manquants, titre en double et liens non officiels", () => {
    const r = analyzeOnPage(
      base({
        title: "Auto entrepreneur batiment : guide pratique",
        content: base().content + "\n\nVoir [ce site](https://exemple.com).",
        otherTitles: [{ id: "2", title: "Auto entrepreneur batiment : guide pratique", slug: "x" }],
      }),
    )
    expect(statusOf(r, "accents")).toBe("warn")
    expect(r.checks.find((c) => c.id === "accents")?.target).toBe("title")
    expect(statusOf(r, "unique-title")).toBe("error")
    expect(statusOf(r, "external-links")).toBe("warn")
  })

  it("exclut l'article lui-même de la recherche de doublons", () => {
    const r = analyzeOnPage(base({ selfId: "1", otherTitles: [{ id: "1", title: base().title, slug: "s" }] }))
    expect(statusOf(r, "unique-title")).toBe("ok")
  })

  it("plafonne le score quand un passage bloque la publication", () => {
    const r = analyzeOnPage(base({ content: base().content + "\n\nLogiciel certifié par l'État. Une PDP transmet la facture." }))
    expect(r.checks.find((c) => c.id === "audit")?.blocking).toBe(true)
    expect(statusOf(r, "pdp")).toBe("warn")
    expect(r.score).toBeLessThanOrEqual(40)
  })

  it("repère un concurrent nommé, adresse comprise", () => {
    const r = analyzeOnPage(base({ slug: "exemple-devis-maconnerie-concurrent", competitors: ["concurrent.fr"] }))
    expect(r.checks.find((c) => c.id === "competitor")?.blocking).toBe(true)
  })

  it("trie les contrôles : à corriger d'abord", () => {
    const sorted = sortChecks(analyzeOnPage(base({ keyword: null, coverUrl: null })).checks)
    expect(sorted[0].status).toBe("error")
    expect(sorted[sorted.length - 1].status).toBe("ok")
  })

  it("compte les mots-clés secondaires", () => {
    const r = analyzeOnPage(base({ secondary: ["mentions obligatoires", "absent ici"] }))
    expect(r.secondary).toEqual([
      { keyword: "mentions obligatoires", count: 1 },
      { keyword: "absent ici", count: 0 },
    ])
  })
})
