/**
 * Photos du texte des articles générés (lib/seo/articles/images.ts) : combien,
 * dans quelles sections, et où elles s'insèrent.
 */
import { describe, expect, it } from "vitest"
import {
  MAX_INLINE_IMAGES,
  countBodyImages,
  imageMarkdown,
  inlineImageCount,
  insertImageAfterParagraph,
  planImageSlots,
  plainBlockText,
} from "@/lib/seo/articles/images"

const filler = (n: number, seed = "mot") => Array.from({ length: n }, (_, i) => `${seed}${i}`).join(" ")

const ARTICLE = [
  "Introduction sur le devis de plomberie, assez longue pour être une vraie introduction d'article.",
  "## Les mentions obligatoires",
  `Un premier paragraphe qui explique les mentions obligatoires d'un devis de plomberie. ${filler(40)}`,
  "- le nom de l'entreprise\n- le numéro de SIREN",
  `Un second paragraphe sur le même sujet. ${filler(40, "autre")}`,
  "## Le chiffrage ligne par ligne",
  `Pour chiffrer chaque ligne, détaillez la quantité et le prix unitaire. ${filler(40)}`,
  "### Les fournitures",
  `Les fournitures se chiffrent séparément. ${filler(40, "four")}`,
  "## La TVA applicable",
  `Le taux de TVA dépend du logement et des travaux réalisés. ${filler(40)}`,
  "## Les délais et l'acompte",
  `Un acompte se demande à la signature du devis, dans la limite prévue. ${filler(40)}`,
  "## La signature",
  `La signature engage les deux parties sur le prix et les délais. ${filler(40)}`,
  "## Questions fréquentes",
  `### Combien de temps un devis est-il valable ?\n${filler(30)}`,
  "## Conclusion",
  `Un devis complet protège l'artisan comme son client. ${filler(40)}`,
].join("\n\n")

describe("nombre de photos", () => {
  it("une par tranche de 400 mots, au plus le plafond, aucune sous 600 mots ni sans plafond", () => {
    expect(inlineImageCount(1500, 4)).toBe(4)
    expect(inlineImageCount(1200, 4)).toBe(3)
    expect(inlineImageCount(2500, 4)).toBe(4)
    expect(inlineImageCount(2500, 6)).toBe(6)
    expect(inlineImageCount(900, 6)).toBe(2)
    expect(inlineImageCount(600, 4)).toBe(2)
    expect(inlineImageCount(599, 4)).toBe(0)
    expect(inlineImageCount(2000, 0)).toBe(0)
    expect(inlineImageCount(2000, -1)).toBe(0)
    // Le plafond des Préférences ne dépasse jamais le maximum du code
    expect(inlineImageCount(9000, 99)).toBe(MAX_INLINE_IMAGES)
  })
})

describe("sections choisies", () => {
  it("ni l'introduction, ni la FAQ, ni la conclusion ; répartition sur l'article ; première section libre", () => {
    const slots = planImageSlots(ARTICLE, 3)
    expect(slots).toHaveLength(3)
    const headings = slots.map((s) => s.heading)
    expect(headings.join(" ")).not.toMatch(/Questions fréquentes|Conclusion/)
    // 5 sections de développement, la première laissée libre (la couverture est au-dessus) : 4 candidates, 3 choisies
    expect(headings).not.toContain("Les mentions obligatoires")
    // Ordre de l'article, une section n'est jamais prise deux fois
    expect(slots.map((s) => s.h2Index)).toEqual(Array.from(new Set(slots.map((s) => s.h2Index))).sort((a, b) => a - b))
  })

  it("autant de sections que de photos : toutes les sections de développement, première comprise", () => {
    const slots = planImageSlots(ARTICLE, 5)
    expect(slots.map((s) => s.heading)).toEqual([
      "Les mentions obligatoires",
      "Le chiffrage ligne par ligne",
      "La TVA applicable",
      "Les délais et l'acompte",
      "La signature",
    ])
  })

  it("plus de photos demandées que de sections : une par section au plus", () => {
    expect(planImageSlots(ARTICLE, 6)).toHaveLength(5)
  })

  it("le passage est le premier paragraphe de la section, avec le contexte autour", () => {
    const slot = planImageSlots(ARTICLE, 5)[1]
    expect(slot.passage.heading).toBe("Le chiffrage ligne par ligne")
    expect(slot.passage.text.startsWith("Pour chiffrer chaque ligne")).toBe(true)
    expect(slot.passage.selected).toBe(false)
    expect(slot.passage.before).toContain("Un second paragraphe sur le même sujet")
    expect(slot.passage.after).toContain("Les fournitures")
    expect(slot.passage.text).not.toContain("**")
  })

  it("une section qui a déjà une image, sans paragraphe assez long ou qui commence par un sous-titre n'en reçoit pas", () => {
    const md = [
      "Intro.",
      "## Déjà illustrée",
      `Un paragraphe assez long pour porter une photo mais déjà suivi d'une image. ${filler(30)}`,
      "![Une photo](https://x.test/a.webp)",
      "## Trop courte",
      "Quelques mots seulement.",
      "## Commence par un sous-titre",
      "### Sous-titre",
      `Un paragraphe assez long mais placé sous un sous-titre. ${filler(30)}`,
      "## Seule section possible",
      `Un paragraphe assez long pour porter une photo dans cette section. ${filler(30)}`,
    ].join("\n\n")
    expect(planImageSlots(md, 3).map((s) => s.heading)).toEqual(["Seule section possible"])
  })

  it("blocs de code ignorés ; texte sans titre ni paragraphe : aucune photo", () => {
    const md = ["Intro.", "```\n## Pas un titre\n```", "Du texte sans aucune section de développement."].join("\n\n")
    expect(planImageSlots(md, 3)).toEqual([])
    expect(planImageSlots("", 3)).toEqual([])
    expect(planImageSlots(ARTICLE, 0)).toEqual([])
  })
})

describe("insertion", () => {
  it("juste après le premier paragraphe de la section, avant la liste qui suit", () => {
    const slot = planImageSlots(ARTICLE, 5)[0]
    const out = insertImageAfterParagraph(ARTICLE, slot, imageMarkdown("Un plombier rédige un devis", "https://x.test/p.webp#w=1600&h=900"))!
    const first = out.indexOf("Un premier paragraphe qui explique")
    const image = out.indexOf("![Un plombier rédige un devis]")
    const list = out.indexOf("- le nom de l'entreprise")
    const heading = out.indexOf("## Les mentions obligatoires")
    expect(heading).toBeLessThan(first)
    expect(first).toBeLessThan(image)
    expect(image).toBeLessThan(list)
    // Isolée par des lignes vides, texte autour inchangé
    expect(out).toContain(`${filler(40)}\n\n![Un plombier rédige un devis](https://x.test/p.webp#w=1600&h=900)\n\n- le nom de l'entreprise`)
    expect(out.replace(/\n\n!\[[^\n]+\]\([^)]+\)/, "")).toBe(ARTICLE)
  })

  it("jamais entre un titre et son texte, jamais dans la FAQ ni la conclusion, une section déjà illustrée est refusée", () => {
    let md = ARTICLE
    for (const slot of planImageSlots(ARTICLE, 5)) {
      const next = insertImageAfterParagraph(md, slot, imageMarkdown("Photo", "https://x.test/p.webp"))
      expect(next).not.toBeNull()
      md = next!
    }
    expect(countBodyImages(md)).toBe(5)
    expect(md).not.toMatch(/^## [^\n]+\n\n!\[/m)
    const faq = md.slice(md.indexOf("## Questions fréquentes"))
    expect(faq).not.toContain("![")
    // Deuxième insertion dans la même section : refusée
    expect(insertImageAfterParagraph(md, planImageSlots(ARTICLE, 5)[0], imageMarkdown("Encore", "https://x.test/q.webp"))).toBeNull()
  })

  it("section disparue ou titre changé : null", () => {
    const slot = planImageSlots(ARTICLE, 5)[2]
    expect(insertImageAfterParagraph(ARTICLE.replace("## La TVA applicable", "## Une autre TVA"), slot, "![a](https://x.test/p.webp)")).toBeNull()
    expect(insertImageAfterParagraph("Rien.", slot, "![a](https://x.test/p.webp)")).toBeNull()
  })

  it("texte alternatif sans crochets, parenthèses ni retour à la ligne", () => {
    expect(imageMarkdown("Un [plombier]\n(au travail)", "https://x.test/p.webp")).toBe("![Un plombier au travail](https://x.test/p.webp)")
    expect(imageMarkdown("x".repeat(300), "https://x.test/p.webp").length).toBeLessThan(220)
  })

  it("texte lisible d'un bloc", () => {
    expect(plainBlockText("## **Titre** avec [un lien](/guide/x) et `code`")).toBe("Titre avec un lien et code")
  })
})
