import { describe, expect, it } from "vitest"
import { fixForeignBrandLinks } from "@/lib/blog-brand-links"
import { auditArticle } from "@/lib/blog-audit"
import { markdownToHtml } from "@/lib/markdown"

describe("liens vers un faux domaine de la marque", () => {
  it("les liens vers qonforme.com (avec ou sans www, chemin, barre finale) mènent à /signup, le texte du lien est gardé", () => {
    const cases = [
      "[Essayez Qonforme](https://www.qonforme.com)",
      "[Essayez Qonforme](https://qonforme.com/)",
      "[Essayez Qonforme](https://www.qonforme.com/essai-gratuit)",
      "[Essayez Qonforme](http://QONFORME.COM/Essai)",
      "[Essayez Qonforme]( https://www.qonforme.com/ )",
    ]
    for (const md of cases) expect(fixForeignBrandLinks(md), md).toBe("[Essayez Qonforme](/signup)")
  })

  it("autres extensions collées au nom de la marque", () => {
    expect(fixForeignBrandLinks("[x](https://qonforme.io/a)")).toBe("[x](/signup)")
    expect(fixForeignBrandLinks("[x](https://www.qonforme.eu)")).toBe("[x](/signup)")
  })

  it("le vrai site, les pages officielles, les chemins internes et le texte courant ne bougent pas", () => {
    const md = [
      "[Créer un compte](https://qonforme.fr/signup) et [tarifs](/pricing).",
      "Voir [la fiche](https://entreprendre.service-public.gouv.fr/vosdroits/F31144).",
      "Un domaine comme qonforme.com cité dans le texte reste du texte.",
      "[Autre](https://exemple.com/qonforme.com)",
    ].join("\n")
    expect(fixForeignBrandLinks(md)).toBe(md)
  })

  it("rendu public : le lien devient interne (même onglet) et ne mène plus au site tiers", () => {
    const html = markdownToHtml(fixForeignBrandLinks("Un texte. [Essayez Qonforme gratuitement](https://www.qonforme.com)"), { sameTabInternalLinks: true })
    expect(html).toContain('<a href="/signup">Essayez Qonforme gratuitement</a>')
    expect(html).not.toContain("qonforme.com")
  })

  it("la vérification du blog repère une adresse d'un autre domaine, jamais qonforme.fr", () => {
    const found = auditArticle("Essayez [Qonforme](https://www.qonforme.com) ou rendez-vous sur qonforme.com.")
    expect(found.map((f) => f.rule.id)).toEqual(["domaine-qonforme", "domaine-qonforme"])
    expect(auditArticle("Rendez-vous sur https://qonforme.fr/signup")).toEqual([])
  })
})
