/**
 * Retrouver et remplacer un passage du Markdown (lib/blog-editor/passages.ts) :
 * refus du contrôle (« Aller au passage », « Corriger avec l'IA ») et
 * intégration d'un mot-clé.
 */
import { describe, expect, it } from "vitest"
import { applyPassageEdits, contextAround, excerptInText, locateInMarkdown, passageUnits, textHasExcerpt } from "@/lib/blog-editor/passages"

const ARTICLE = [
  "Une facture impayée se relance dans l'ordre.",
  "## Étape 2 : Fixer à l'avance vos règles de paiement",
  "Pour rédiger vos [conditions de paiement](/outils/generateur-conditions-paiement) sans rien oublier, un générateur gratuit est disponible. Il évite les oublis.",
  "Une deuxième phrase sur\nplusieurs lignes du même paragraphe.",
  "### Ce qu'il faut prévoir",
  "- la date ou le délai de paiement ;\n- le **taux** des pénalités de retard ;\n- l'indemnité forfaitaire de recouvrement,\n  pour un client professionnel.",
  "> Une citation qui ne se remplace pas.",
  "| a | b |\n| - | - |\n| 1 | 2 |",
  "Dernier paragraphe.",
].join("\n\n")

describe("passageUnits", () => {
  it("paragraphes, titres sans leurs « # », puces sans leur tiret (lignes de suite comprises)", () => {
    const units = passageUnits(ARTICLE)
    const kinds = units.map((u) => u.kind)
    expect(kinds).toEqual(["paragraph", "heading", "paragraph", "paragraph", "heading", "list-item", "list-item", "list-item", "other", "other", "paragraph"])
    expect(units[1].text).toBe("Étape 2 : Fixer à l'avance vos règles de paiement")
    expect(ARTICLE.slice(units[1].start, units[1].end)).toBe(units[1].text)
    expect(units[6].text).toBe("le **taux** des pénalités de retard ;")
    expect(units[7].text).toBe("l'indemnité forfaitaire de recouvrement,\n  pour un client professionnel.")
  })
})

describe("locateInMarkdown", () => {
  it("retrouve le passage d'un extrait écrit en Markdown (lien, gras, guillemets ignorés)", () => {
    const excerpt = "Pour rédiger vos [conditions de paiement](/outils/generateur-conditions-paiement) sans rien oublier, un générateur gratuit est disponible."
    const unit = locateInMarkdown(ARTICLE, excerpt)
    expect(unit?.kind).toBe("paragraph")
    expect(unit?.text.startsWith("Pour rédiger vos")).toBe(true)
    expect(locateInMarkdown(ARTICLE, "le « taux » des pénalités de retard")?.kind).toBe("list-item")
  })

  it("retrouve un passage dont l'extrait est coupé en fin de mot ou ne tient qu'au début", () => {
    const cut = "Pour rédiger vos conditions de paiement sans rien oublier, un générateur gratuit est dispon"
    expect(locateInMarkdown(ARTICLE, cut)?.text).toContain("générateur gratuit")
    // Extrait qui déborde sur le paragraphe suivant : le début suffit
    const overflow = "Pour rédiger vos conditions de paiement sans rien oublier, un générateur gratuit est disponible. Il évite les oublis. Une phrase que l'article n'a pas"
    expect(locateInMarkdown(ARTICLE, overflow)?.text).toContain("Il évite les oublis")
  })

  it("extrait d'un contrôle d'audit, entouré de « … » quand il est coupé", () => {
    expect(locateInMarkdown(ARTICLE, "…sans rien oublier, un générateur gratuit est disponible. Il évite les oublis…")?.text).toContain("générateur gratuit")
    expect(locateInMarkdown(ARTICLE, "…Dernier paragraphe...")?.kind).toBe("paragraph")
  })

  it("introuvable : texte déjà corrigé, extrait trop court ou vide", () => {
    expect(locateInMarkdown(ARTICLE, "Une phrase qui n'existe pas dans cet article du tout")).toBeNull()
    expect(locateInMarkdown(ARTICLE, "")).toBeNull()
    expect(locateInMarkdown(ARTICLE, "court")).toBeNull()
  })

  it("une citation ou un tableau se retrouvent (pour montrer l'endroit) sans être remplaçables", () => {
    expect(locateInMarkdown(ARTICLE, "Une citation qui ne se remplace pas.")?.kind).toBe("other")
  })

  it("excerptInText : l'extrait entier doit y être (le début seul ne suffit pas : le passage est corrigé)", () => {
    const refused = "Pour rédiger vos [conditions](/x) sans rien oublier, un générateur gratuit est disponible."
    expect(excerptInText("Intro. Pour rédiger vos conditions sans rien oublier, un générateur gratuit est disponible. Fin.", refused)).toBe(true)
    expect(excerptInText("Intro. Pour rédiger vos conditions sans rien oublier, un modèle à télécharger est disponible. Fin.", refused)).toBe(false)
    // Mais ce début suffit pour retrouver le paragraphe à corriger
    expect(textHasExcerpt("Pour rédiger vos conditions sans rien oublier, un modèle à télécharger est disponible.", refused)).toBe(true)
    // Extrait de contrôle d'audit coupé : « … » ignorés
    expect(excerptInText("avant le taux des pénalités de retard après", "…le taux des pénalités de retard…")).toBe(true)
    expect(excerptInText("rien", "")).toBe(false)
  })

  it("textHasExcerpt compare sans syntaxe ni casse", () => {
    expect(textHasExcerpt("Le **Taux** des pénalités de retard.", "le taux des pénalités de retard")).toBe(true)
    expect(textHasExcerpt("Rien de tel ici, vraiment rien.", "le taux des pénalités de retard")).toBe(false)
  })
})

describe("applyPassageEdits", () => {
  it("remplace un paragraphe sans toucher au reste du texte", () => {
    const out = applyPassageEdits(ARTICLE, [
      {
        excerpt: "Pour rédiger vos conditions de paiement sans rien oublier, un générateur gratuit est disponible.",
        text: "Pour rédiger vos [conditions de paiement](/outils/generateur-conditions-paiement) sans rien oublier, utilisez notre générateur de devis. Il évite les oublis.",
      },
    ])
    expect(out.applied).toBe(1)
    expect(out.missed).toEqual([])
    expect(out.markdown).toContain("utilisez notre générateur de devis. Il évite les oublis.")
    expect(out.markdown).not.toContain("un générateur gratuit est disponible")
    expect(out.markdown.replace(/Pour rédiger[^\n]+/, "")).toBe(ARTICLE.replace(/Pour rédiger[^\n]+/, ""))
  })

  it("un titre garde ses « # », une puce son tiret ; une réécriture qui les remet ne les double pas", () => {
    const out = applyPassageEdits(ARTICLE, [
      { excerpt: "Étape 2 : Fixer à l'avance vos règles de paiement", text: "## Étape 2 : fixer vos règles de paiement" },
      { excerpt: "le taux des pénalités de retard", text: "- le **taux** des pénalités de retard prévues ;" },
    ])
    expect(out.markdown).toContain("\n## Étape 2 : fixer vos règles de paiement\n")
    expect(out.markdown).not.toContain("## ## ")
    expect(out.markdown).toContain("- le **taux** des pénalités de retard prévues ;")
    expect(out.markdown).not.toContain("- - ")
  })

  it("plusieurs modifications : positions lues dans le texte d'origine, aucune ne décale les autres", () => {
    const out = applyPassageEdits(ARTICLE, [
      { excerpt: "Dernier paragraphe.", text: "Dernier paragraphe, bien plus long que le précédent, pour décaler tout ce qui suit." },
      { excerpt: "Une facture impayée se relance dans l'ordre.", text: "Une facture impayée se relance en trois temps, dans l'ordre." },
    ])
    expect(out.applied).toBe(2)
    expect(out.markdown.startsWith("Une facture impayée se relance en trois temps")).toBe(true)
    expect(out.markdown.endsWith("pour décaler tout ce qui suit.")).toBe(true)
  })

  it("passage introuvable, non remplaçable ou visé deux fois : signalé, texte intact", () => {
    const out = applyPassageEdits(ARTICLE, [
      { excerpt: "Un passage absent de cet article, ni dans les autres", text: "x" },
      { excerpt: "Une citation qui ne se remplace pas.", text: "y" },
      { excerpt: "Dernier paragraphe.", text: "Premier remplacement." },
      { excerpt: "Dernier paragraphe.", text: "Second remplacement." },
    ])
    expect(out.applied).toBe(1)
    expect(out.missed).toHaveLength(3)
    expect(out.markdown).toContain("Premier remplacement.")
    expect(out.markdown).not.toContain("Second remplacement.")
    expect(out.markdown).toContain("> Une citation qui ne se remplace pas.")
  })

  it("une réécriture ne casse pas la structure : pas de ligne vide dans un paragraphe, une puce reste sur une ligne", () => {
    const out = applyPassageEdits(ARTICLE, [
      { excerpt: "le taux des pénalités de retard", text: "- première partie\n\nseconde partie" },
      { excerpt: "Dernier paragraphe.", text: "Un\n\n\nDeux" },
    ])
    expect(out.markdown).toContain("- première partie seconde partie\n")
    expect(out.markdown).toContain("Un\nDeux")
  })
})

describe("contextAround", () => {
  it("texte brut avant et après, 500 caractères au plus", () => {
    const unit = locateInMarkdown(ARTICLE, "Dernier paragraphe.")!
    const ctx = contextAround(ARTICLE, unit)
    expect(ctx.after).toBe("")
    expect(ctx.before.length).toBeLessThanOrEqual(500)
    expect(ctx.before).toContain("a | b")
  })
})
