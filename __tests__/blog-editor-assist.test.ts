/**
 * Assistant de rédaction de l'éditeur (lib/blog-editor/assist.ts) : consigne,
 * nettoyage de la réponse du modèle, points à vérifier.
 */
import { describe, expect, it } from "vitest"
import { assistSchema, assistWarnings, buildAssistPrompt, cleanAssistOutput, decodeForModel, numbersIn } from "@/lib/blog-editor/assist"
import { markdownToHtml } from "@/lib/markdown"

describe("consigne", () => {
  it("passage, contexte, titre, mot-clé et règles", () => {
    const prompt = buildAssistPrompt({
      action: "keyword",
      text: "Le devis doit être &#42;détaillé&#42;.",
      keyword: "devis maçon",
      title: "Faire un devis de maçonnerie",
      before: "x".repeat(800) + " Avant.",
      after: "Après. " + "y".repeat(800),
    })
    expect(prompt).toContain("TITRE DE L'ARTICLE : Faire un devis de maçonnerie")
    expect(prompt).toContain("MOT-CLÉ PRINCIPAL : devis maçon")
    expect(prompt).toContain('PASSAGE À RÉÉCRIRE :\n"""Le devis doit être *détaillé*."""')
    expect(prompt).toContain("« devis maçon » une fois")
    expect(prompt).toContain("N'ajoutez aucun chiffre, aucune date, aucun taux, aucun montant, aucune référence légale")
    expect(prompt).toContain("Vouvoyez le lecteur")
    // 500 caractères de contexte au plus de chaque côté
    const before = prompt.match(/CONTEXTE AVANT LE PASSAGE \(à ne pas réécrire\) :\n"""([^"]*)"""/)
    expect(before?.[1].length).toBeLessThanOrEqual(500)
    expect(before?.[1].endsWith("Avant.")).toBe(true)
    const after = prompt.match(/CONTEXTE APRÈS LE PASSAGE \(à ne pas réécrire\) :\n"""([^"]*)"""/)
    expect(after?.[1].length).toBeLessThanOrEqual(500)
    expect(after?.[1].startsWith("Après.")).toBe(true)
  })

  it("sans contexte ni mot-clé : sections absentes", () => {
    const prompt = buildAssistPrompt({ action: "fix", text: "Un texte sans accent a corriger." })
    expect(prompt).not.toContain("CONTEXTE")
    expect(prompt).not.toContain("MOT-CLÉ")
    expect(prompt).toContain("Corrigez seulement l'orthographe")
  })

  it("schéma : passage requis, 4 000 caractères au plus", () => {
    expect(assistSchema.safeParse({ action: "rephrase", text: "  " }).success).toBe(false)
    expect(assistSchema.safeParse({ action: "rephrase", text: "a".repeat(4001) }).success).toBe(false)
    expect(assistSchema.safeParse({ action: "inconnue", text: "abc" }).success).toBe(false)
    expect(assistSchema.safeParse({ action: "shorten", text: "abc", keyword: null }).success).toBe(true)
  })

  it("entités de l'éditeur redevenues des caractères", () => {
    expect(decodeForModel("&#35; &#42; &#91;x&#93; &lt;div&gt; R&amp;D")).toBe("# * [x] <div> R&D")
  })
})

describe("nettoyage de la réponse", () => {
  const original = "Le devis est obligatoire, voir [le guide](/guide/devis-obligatoire)."

  it("bloc de code et guillemets englobants retirés", () => {
    expect(cleanAssistOutput("```markdown\nUn texte réécrit.\n```", original).text).toBe("Un texte réécrit.")
    expect(cleanAssistOutput("« Un texte réécrit. »", original).text).toBe("Un texte réécrit.")
    expect(cleanAssistOutput('"Un texte réécrit."', original).text).toBe("Un texte réécrit.")
  })

  it("phrase d'introduction retirée", () => {
    expect(cleanAssistOutput("Voici le passage réécrit :\n\nUn texte.", original).text).toBe("Un texte.")
  })

  it("liens d'origine gardés, liens ajoutés et images retirés", () => {
    const out = cleanAssistOutput(
      "Le devis est [obligatoire](https://exemple.fr), voir [le guide](/guide/devis-obligatoire). ![photo](https://x/y.jpg)",
      original,
    )
    expect(out.text).toBe("Le devis est obligatoire, voir [le guide](/guide/devis-obligatoire).")
    expect(out.removedLinks).toBe(1)
  })

  it("lien ajouté avec une espace, une tabulation ou un titre dans les parenthèses : retiré aussi (le moteur l'afficherait)", () => {
    const plain = "Consultez le guide officiel avant de facturer."
    for (const link of ["(https://evil.example/x )", "(https://evil.example/x\t)", "( https://evil.example/x )", '(https://evil.example/x "titre")']) {
      const out = cleanAssistOutput(`Consultez [le guide officiel]${link} avant de facturer.`, plain)
      expect(out.text, link).toBe(plain)
      expect(out.removedLinks, link).toBe(1)
      expect(markdownToHtml(out.text), link).not.toContain("<a ")
    }
    // Texte de lien qui reformerait un lien une fois le premier retiré
    const nested = cleanAssistOutput("Voir [[x](/a)](https://evil.example/x).", plain)
    expect(markdownToHtml(nested.text)).not.toContain("evil.example")
    // Lien d'origine réécrit avec une espace de bord : même adresse, gardé
    expect(cleanAssistOutput("Le devis, voir [le guide]( /guide/devis-obligatoire ).", original).removedLinks).toBe(0)
  })

  it("titres retirés si le passage n'en avait pas ; titre 1 rétrogradé sinon", () => {
    expect(cleanAssistOutput("## Titre\n\nTexte.", original).text).toBe("Titre\n\nTexte.")
    expect(cleanAssistOutput("# Titre\n\nTexte.", "## Ancien titre\n\nTexte.").text).toBe("## Titre\n\nTexte.")
  })

  it("HTML neutralisé, balises de l'éditeur gardées", () => {
    expect(cleanAssistOutput('Un <script>alert(1)</script> et <img src=x onerror="y">', original).text).toBe(
      'Un &lt;script>alert(1)&lt;/script> et &lt;img src=x onerror="y">',
    )
    expect(cleanAssistOutput("a<br />b <strong>c</strong>", original).text).toBe("a<br />b <strong>c</strong>")
  })
})

describe("points à vérifier", () => {
  it("nombres absents du passage d'origine", () => {
    const warnings = assistWarnings({
      original: "Le seuil est de 37 500 € en 2026.",
      result: "Le seuil est de 37 500 € en 2026, et de 41 250 € pour le seuil majoré depuis 2025.",
      competitors: [],
    })
    expect(warnings).toContain("Vérifiez : « 41 250 » n'était pas dans le passage.")
    expect(warnings).toContain("Vérifiez : « 2025 » n'était pas dans le passage.")
    expect(warnings.join(" ")).not.toContain("37 500")
  })

  it("séparateur de milliers : espace, espace insécable ou fine, même nombre", () => {
    expect(numbersIn("10\u202F000 €, 2\u00A0500 € et 1 200 €").map((n) => n.key)).toEqual(["10000", "2500", "1200"])
    const warnings = assistWarnings({ original: "Un plafond de 37\u202F500 € par an.", result: "Un plafond annuel de 37 500 €.", competitors: [] })
    expect(warnings).toEqual([])
  })

  it("numéros de liste et adresses de liens ignorés", () => {
    expect(numbersIn("1. Étape\n2. [Lien](https://x.gouv.fr/article/2024)").map((n) => n.key)).toEqual([])
  })

  it("valeur périmée ou « PDP » et concurrent signalés", () => {
    const warnings = assistWarnings({
      original: "Choisissez une plateforme.",
      result: "Choisissez une PDP, comme concurrent.fr le propose.",
      competitors: ["concurrent.fr"],
    })
    expect(warnings.some((w) => w.startsWith("Ancien nom des plateformes agréées (PDP)"))).toBe(true)
    expect(warnings).toContain("Le texte proposé cite un concurrent (concurrent.fr) : retirez-le avant de l'utiliser.")
  })

  it("lien retiré signalé ; aucun avertissement pour une simple reformulation", () => {
    expect(assistWarnings({ original: "a", result: "b", competitors: [], removedLinks: 1 })).toEqual([
      "Un lien ajouté par l'assistant a été retiré : seuls les liens du passage sont gardés.",
    ])
    expect(assistWarnings({ original: "Le devis est obligatoire.", result: "Le devis reste obligatoire.", competitors: [] })).toEqual([])
  })
})
