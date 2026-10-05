import { describe, expect, it } from "vitest"
import { autoLinkPseo } from "@/lib/blog-autolink"

describe("liens automatiques du blog", () => {
  it("relie la première occurrence du texte vers le guide", () => {
    const html = autoLinkPseo("<p>Voici comment faire un devis clair. Faire un devis prend du temps.</p>")
    expect(html).toContain('<a href="/guide/comment-faire-un-devis"')
    expect(html.match(/comment-faire-un-devis/g)).toHaveLength(1)
  })

  it("ne touche jamais un attribut de balise", () => {
    const html = autoLinkPseo('<p><img src="/a.png" alt="Comment faire un devis"> Le texte suit.</p><p>Il faut rédiger un devis.</p>')
    expect(html).toContain('alt="Comment faire un devis"')
    expect(html).toContain('<a href="/guide/comment-faire-un-devis" class="text-[#2563EB] underline underline-offset-2 hover:text-[#1D4ED8]">rédiger un devis</a>')
  })

  it("ne relie pas un texte déjà dans un lien", () => {
    const html = autoLinkPseo('<p><a href="/x">mentions obligatoires d\'un devis</a></p>')
    expect(html).not.toContain("/guide/mentions-obligatoires-devis")
  })
})

describe("liens automatiques vers les guides facture et TVA (05/10/2026)", () => {
  it("relie « faire une facture » et le taux de TVA des travaux", () => {
    const html = autoLinkPseo("<p>Pour faire une facture conforme, choisissez le taux de TVA des travaux : la TVA à 10 % s'applique en rénovation.</p>")
    expect(html).toContain('href="/guide/premiere-facture"')
    expect(html).toContain('href="/guide/tva-travaux"')
    expect(html.match(/tva-travaux/g)).toHaveLength(1)
  })
})
