/**
 * Photos du texte des articles générés (lib/seo/articles/images.ts) : combien,
 * dans quelles parties, et où elles s'insèrent (réparties, après un paragraphe).
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
  type ImageSlot,
} from "@/lib/seo/articles/images"

const filler = (n: number, seed = "mot") => Array.from({ length: n }, (_, i) => `${seed}${i}`).join(" ")
const sentence = (label: string, n: number) => `${label} ${filler(n - label.split(" ").length, label.split(" ")[0].toLowerCase())}.`

/** Article : suite de lignes « H2 titre », « H3 titre », « p N » (paragraphe de N mots), « ul N » (liste de N puces). */
function article(spec: string[]): string {
  let id = 0
  return spec
    .map((line) => {
      const [kind, ...rest] = line.split(" ")
      if (kind === "H2") return `## ${rest.join(" ")}`
      if (kind === "H3") return `### ${rest.join(" ")}`
      if (kind === "ul") return Array.from({ length: Number(rest[0]) }, (_, i) => `- puce ${i} ${filler(6, `u${id}`)}`).join("\n")
      if (kind === "p") return `Paragraphe ${++id} ${filler(Number(rest[0]) - 2, `p${id}x`)}`
      if (kind === "pc") return `Voici les éléments à prévoir ${filler(Number(rest[0]) - 6, `c${id}x`)} :`
      return line
    })
    .join("\n\n")
}

/** Même forme que les articles générés par Claude : chaque « H2 » commence par des « H3 », FAQ et conclusion à la fin. */
const H3_STYLE = article([
  "Introduction en quelques lignes pour poser le sujet de cet article et annoncer ce que le lecteur va y trouver ici.",
  "H2 Avant et après : ce que change un devis bien fait",
  "H3 Le devis griffonné : ce qui arrive",
  "p 80", "p 40", "ul 3", "p 90",
  "H3 Le devis structuré : moins de discussions",
  "p 85", "p 95",
  "H3 Ce que vous gagnez : du temps",
  "ul 3",
  "H2 Quand le devis est-il obligatoire chez un particulier ?",
  "H3 Dépannage, réparation, entretien",
  "p 120", "p 40",
  "H3 Le « Bon pour accord » : le devis signé vaut contrat",
  "p 90", "p 30",
  "H3 Chez un professionnel",
  "p 70", "p 100", "p 60",
  "H2 Comment faire un devis : les 7 étapes",
  "H3 Étape 1 : faire la visite",
  "p 30", "pc 40", "ul 4", "p 50",
  "H3 Étape 2 : indiquer vos coordonnées",
  "p 50", "ul 4", "p 40",
  "H3 Étape 3 : décrire les travaux",
  "p 70", "ul 2", "p 90",
  "H3 Étape 4 : chiffrer séparément",
  "p 60", "ul 3", "p 80",
  "H3 Étape 5 : appliquer la TVA",
  "p 110", "p 50", "ul 3", "p 50",
  "H2 Exemple de devis, ligne par ligne",
  "p 80",
  "H3 Tableau électrique, circuits et prises",
  "p 90", "p 70", "p 40",
  "H3 Les lignes à ne pas regrouper",
  "p 50", "ul 5", "p 60",
  "H2 Du devis signé à la facture sans ressaisie",
  "H3 Pourquoi retaper un devis fait perdre du temps",
  "p 100",
  "H3 Numérotation continue et mentions obligatoires",
  "p 100", "p 110",
  "H2 Questions fréquentes",
  "H3 Combien de temps un devis est-il valable ?",
  "p 60",
  "H3 Faut-il un acompte ?",
  "p 60",
  "H2 Conclusion",
  "p 60",
])

const wordsOf = (s: string) => plainBlockText(s).split(/\s+/).filter(Boolean).length

/** Insère toutes les photos prévues ; rend le texte et la position (en mots) de chaque photo. */
function withImages(md: string, slots: ImageSlot[]): { text: string; positions: number[] } {
  let text = md
  slots.forEach((slot, i) => {
    const next = insertImageAfterParagraph(text, slot, imageMarkdown(`Photo ${i + 1}`, `https://x.test/p${i + 1}.webp`))
    expect(next, `créneau ${i + 1}`).not.toBeNull()
    text = next!
  })
  const positions: number[] = []
  let cum = 0
  for (const block of text.split("\n\n")) {
    if (/^!\[/.test(block)) positions.push(cum)
    else cum += wordsOf(block.replace(/^#{1,6}\s+/, ""))
  }
  return { text, positions }
}

describe("nombre de photos", () => {
  it("3 à 4 selon la longueur (une par tranche de 450 mots, au moins 2), jamais sous 600 mots, jamais au-dessus du plafond", () => {
    expect(inlineImageCount(1100, 4)).toBe(2)
    expect(inlineImageCount(1130, 4)).toBe(3)
    expect(inlineImageCount(1500, 4)).toBe(3)
    expect(inlineImageCount(1574, 4)).toBe(3)
    expect(inlineImageCount(1580, 4)).toBe(4)
    expect(inlineImageCount(2500, 4)).toBe(4)
    expect(inlineImageCount(2500, 6)).toBe(6)
    expect(inlineImageCount(2200, 6)).toBe(5)
    expect(inlineImageCount(700, 4)).toBe(2)
    expect(inlineImageCount(600, 4)).toBe(2)
    expect(inlineImageCount(599, 4)).toBe(0)
    expect(inlineImageCount(2000, 2)).toBe(2)
    expect(inlineImageCount(2000, 1)).toBe(1)
    expect(inlineImageCount(2000, 0)).toBe(0)
    expect(inlineImageCount(2000, -1)).toBe(0)
    expect(inlineImageCount(9000, 99)).toBe(MAX_INLINE_IMAGES)
  })
})

describe("places choisies : article dont les titres « H2 » commencent par des « H3 »", () => {
  const total = wordsOf(H3_STYLE)

  it("quatre photos, toutes placées (l'ancienne règle n'en trouvait qu'une)", () => {
    const slots = planImageSlots(H3_STYLE, 4)
    expect(slots).toHaveLength(4)
    expect(countBodyImages(withImages(H3_STYLE, slots).text)).toBe(4)
  })

  it("réparties à intervalles réguliers sur le développement, au moins 250 mots entre deux photos", () => {
    const { positions } = withImages(H3_STYLE, planImageSlots(H3_STYLE, 4))
    expect(positions).toHaveLength(4)
    for (let i = 1; i < positions.length; i++) expect(positions[i] - positions[i - 1], `écart ${i}`).toBeGreaterThanOrEqual(250)
    // Ni collée au début, ni à la fin du développement : environ 1/5, 2/5, 3/5 et 4/5 du texte (la FAQ et la conclusion en sont exclues)
    const first = positions[0]
    const last = positions[positions.length - 1]
    expect(first).toBeGreaterThan(total * 0.08)
    expect(last).toBeLessThan(total * 0.85)
    const gaps = positions.slice(1).map((p, i) => p - positions[i])
    expect(Math.max(...gaps) - Math.min(...gaps)).toBeLessThan(total * 0.25)
  })

  it("jamais dans l'introduction, la FAQ ni la conclusion ; jamais entre un titre et son texte", () => {
    const { text } = withImages(H3_STYLE, planImageSlots(H3_STYLE, 4))
    expect(text.slice(0, text.indexOf("## Avant et après"))).not.toContain("![")
    expect(text.slice(text.indexOf("## Questions fréquentes"))).not.toContain("![")
    expect(text).not.toMatch(/^#{2,3} [^\n]+\n\n!\[/m)
    // Toujours juste après un paragraphe de texte
    for (const m of Array.from(text.matchAll(/([^\n]+)\n\n!\[/g))) expect(m[1]).toMatch(/^Paragraphe \d+ /)
  })

  it("trois photos pour trois : mêmes règles", () => {
    const slots = planImageSlots(H3_STYLE, 3)
    expect(slots).toHaveLength(3)
    const { positions } = withImages(H3_STYLE, slots)
    for (let i = 1; i < positions.length; i++) expect(positions[i] - positions[i - 1]).toBeGreaterThanOrEqual(250)
  })

  it("de préférence le premier paragraphe d'une sous-partie, avec son titre pour passage", () => {
    const slots = planImageSlots(H3_STYLE, 4)
    expect(slots.filter((s) => s.paragraphIndex === 0).length).toBeGreaterThanOrEqual(3)
    for (const slot of slots) {
      expect(slot.passage.heading).toBe(slot.heading)
      expect(slot.passage.text.startsWith("Paragraphe ")).toBe(true)
      expect(slot.passage.selected).toBe(false)
      expect(slot.passage.after.length).toBeGreaterThan(0)
    }
  })

  it("une phrase qui annonce une liste (« … : ») ne reçoit jamais la photo", () => {
    const slots = planImageSlots(H3_STYLE, 4)
    expect(slots.every((s) => !/:\s*$/.test(s.passage.text))).toBe(true)
    const colon = article(["H2 Une partie", "H3 Une sous-partie", "pc 60", "ul 4", "p 400", "H3 Une autre", "p 400", "H3 Encore", "p 400", "H3 Dernière", "p 400"])
    expect(planImageSlots(colon, 3).every((s) => !s.passage.text.startsWith("Voici les éléments"))).toBe(true)
  })
})

describe("autres formes d'article", () => {
  it("titres « H2 » qui commencent par un paragraphe : toujours répartis", () => {
    const md = article([
      "Introduction.",
      ...["A", "B", "C", "D", "E"].flatMap((t) => [`H2 Partie ${t}`, "p 150", "p 150"]),
      "H2 Questions fréquentes",
      "p 60",
    ])
    const { positions } = withImages(md, planImageSlots(md, 4))
    expect(positions).toHaveLength(4)
    for (let i = 1; i < positions.length; i++) expect(positions[i] - positions[i - 1]).toBeGreaterThanOrEqual(250)
  })

  it("jamais collées aux extrémités du développement : 150 mots avant la première, 120 mots après la dernière", () => {
    const md = article([
      "Introduction.",
      ...["A", "B", "C", "D"].flatMap((t) => [`H2 Partie ${t}`, "p 55", "p 430"]),
      "H2 Questions fréquentes",
      "p 60",
    ])
    const slots = planImageSlots(md, 4)
    // Un quatrième créneau tomberait après le premier paragraphe (juste sous la couverture) ou après le dernier (collé à la FAQ) : il n'est pas posé
    expect(slots).toHaveLength(3)
    const { text, positions } = withImages(md, slots)
    expect(positions[0]).toBeGreaterThanOrEqual(150)
    const tail = text.slice(text.lastIndexOf("![")).split("\n\n").slice(1)
    const untilFaq = tail.slice(0, tail.findIndex((b) => b.startsWith("## Questions")))
    expect(untilFaq.reduce((sum, b) => sum + wordsOf(b), 0)).toBeGreaterThanOrEqual(120)
  })

  it("trop peu de places espacées : moins de photos plutôt que deux photos côte à côte", () => {
    const md = article(["H2 Une partie", "H3 Une sous-partie", "p 120", "p 120", "H2 Conclusion", "p 40"])
    const slots = planImageSlots(md, 4)
    expect(slots.length).toBeLessThanOrEqual(1)
  })

  it("rien à illustrer : aucune photo ; blocs de code ignorés ; images déjà là comptées et tenues à distance", () => {
    expect(planImageSlots("", 3)).toEqual([])
    expect(planImageSlots(H3_STYLE, 0)).toEqual([])
    expect(planImageSlots("Intro.\n\n```\n## Pas un titre\n```\n\nDu texte sans aucune partie.", 3)).toEqual([])
    const withOne = insertImageAfterParagraph(H3_STYLE, planImageSlots(H3_STYLE, 4)[1], "![Déjà là](https://x.test/a.webp)")!
    const more = planImageSlots(withOne, 4)
    expect(more).toHaveLength(3)
    const { positions } = withImages(withOne, more)
    for (let i = 1; i < positions.length; i++) expect(positions[i] - positions[i - 1]).toBeGreaterThanOrEqual(150)
  })
})

describe("insertion", () => {
  it("juste après le paragraphe du créneau, texte autour inchangé", () => {
    const slot = planImageSlots(H3_STYLE, 4)[0]
    const image = imageMarkdown("Un plombier rédige un devis", "https://x.test/p.webp#w=1600&h=900")
    const out = insertImageAfterParagraph(H3_STYLE, slot, image)!
    expect(out).toContain(`\n\n${image}\n\n`)
    expect(out.replace(`\n\n${image}`, "")).toBe(H3_STYLE)
  })

  it("les créneaux restent valables après chaque insertion (les titres et paragraphes ne bougent pas)", () => {
    const slots = planImageSlots(H3_STYLE, 4)
    let text = H3_STYLE
    slots.forEach((slot, i) => {
      const next = insertImageAfterParagraph(text, slot, imageMarkdown(`Photo ${i}`, `https://x.test/${i}.webp`))
      expect(next).not.toBeNull()
      text = next!
    })
    expect(countBodyImages(text)).toBe(4)
  })

  it("titre changé, titre ou paragraphe disparu, photo déjà posée à cet endroit : null", () => {
    const slot = planImageSlots(H3_STYLE, 4)[2]
    expect(insertImageAfterParagraph(H3_STYLE.replace(slot.heading, "Un autre titre"), slot, "![a](https://x.test/p.webp)")).toBeNull()
    expect(insertImageAfterParagraph("Rien.", slot, "![a](https://x.test/p.webp)")).toBeNull()
    expect(insertImageAfterParagraph(H3_STYLE, { ...slot, paragraphIndex: 99 }, "![a](https://x.test/p.webp)")).toBeNull()
    const once = insertImageAfterParagraph(H3_STYLE, slot, "![a](https://x.test/p.webp)")!
    expect(insertImageAfterParagraph(once, slot, "![b](https://x.test/q.webp)")).toBeNull()
  })

  it("texte alternatif sans crochets, parenthèses ni retour à la ligne ; texte lisible d'un bloc", () => {
    expect(imageMarkdown("Un [plombier]\n(au travail)", "https://x.test/p.webp")).toBe("![Un plombier au travail](https://x.test/p.webp)")
    expect(imageMarkdown("x".repeat(300), "https://x.test/p.webp").length).toBeLessThan(220)
    expect(plainBlockText("## **Titre** avec [un lien](/guide/x) et `code`")).toBe("Titre avec un lien et code")
    expect(sentence("Un texte", 10).split(" ").length).toBe(10)
  })
})
