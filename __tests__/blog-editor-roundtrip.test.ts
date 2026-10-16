// @vitest-environment happy-dom
/**
 * Aller-retour de l'éditeur visuel : Markdown → moteur du blog → Tiptap →
 * Markdown (docToMarkdown). Le Markdown réécrit doit s'afficher sur le blog
 * exactement comme l'original (compareRendering), et un second passage doit
 * rendre le même texte (stabilité). Ce qui ne se reproduit pas (HTML brut,
 * liste imbriquée, image hors du blog) doit être signalé, en français.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest"
import { Editor, type JSONContent } from "@tiptap/core"
import { blockInsertPosition, buildExtensions, emptyTable, findTermRanges, HIGHLIGHT_KEY, insertBlock, looksLikeMarkdown, normalizeTableHeader, setHighlightTerms, demotePastedHeadings } from "@/components/admin/blog/editor/extensions"
import { docToMarkdown, markdownHref } from "@/lib/blog-editor/serialize"
import { compareRendering, renderingSignature } from "@/lib/blog-editor/fidelity"
import { isSafeHref, markdownToHtml } from "@/lib/markdown"

const SUPABASE = "https://abcd.supabase.co"
const IMAGE = `${SUPABASE}/storage/v1/object/public/blog-covers/editor/2026/10/chantier-salle-de-bain-mf3k2a.jpg#w=1600&h=900`
let previousUrl: string | undefined

beforeAll(() => {
  previousUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  process.env.NEXT_PUBLIC_SUPABASE_URL = SUPABASE
})
afterAll(() => {
  process.env.NEXT_PUBLIC_SUPABASE_URL = previousUrl
})

const parse = (html: string) => new DOMParser().parseFromString(html, "text/html")

function editorFor(markdown: string): Editor {
  return new Editor({ extensions: buildExtensions(), content: markdownToHtml(markdown) })
}

function roundTrip(markdown: string): string {
  const editor = editorFor(markdown)
  const out = docToMarkdown(editor.getJSON())
  editor.destroy()
  return out
}

/* ------------------------------------------------------------------ */
/* Corpus                                                              */
/* ------------------------------------------------------------------ */

const GUIDE = `Le statut d'**auto-entrepreneur** dans le bâtiment permet d'exercer avec des formalités simplifiées, à condition de respecter les règles de qualification, d'assurance et de facturation.

## Comprendre le statut et ses limites

Le régime de la micro-entreprise calcule les cotisations sur le chiffre d'affaires *réellement encaissé*, selon [economie.gouv.fr](https://www.economie.gouv.fr/entreprises/micro-entreprise).

- **Déduction des charges limitée** : les frais réels ne sont pas déductibles.
- **Plafonds de chiffre d'affaires** : 83 600 € pour les services en 2026.
- **Évolution limitée** : embaucher devient plus complexe.

### Quelle assurance pour un artisan ?

> La garantie décennale est obligatoire pour les travaux de construction.
> Elle couvre la solidité de l'ouvrage pendant dix ans.

1. Déclarez votre activité sur le guichet unique.
2. Souscrivez la décennale **avant** le premier chantier.
3. Envoyez vos premiers devis.

<table><tbody><tr><th>Étape</th><th>Organisme</th></tr><tr><td>Déclaration d'activité</td><td>INPI</td></tr><tr><td>Immatriculation</td><td>CMA, INSEE</td></tr></tbody></table>

## Questions fréquentes

### Faut-il un devis pour un dépannage ?

Oui : depuis le 1er avril 2017, le devis est obligatoire avant tout dépannage chez un particulier, [quel qu'en soit le montant](/guide/devis-obligatoire).`

const MEDIA = `Voici le chantier, étape par étape.

![Salle de bain rénovée avec carrelage gris](${IMAGE} "Chantier terminé en mars")

| Poste | Quantité | Prix HT |
| :--- | :---: | ---: |
| Dépose de l'ancien carrelage | 12 m² | 240,00 € |
| Pose \\| fourniture | 12 m² | **1 080,00 €** |
| Joints *époxy* | 1 | [voir le guide](/guide/tva-travaux) |

---

#### Remarques

Ligne une du paragraphe.
Ligne deux, avec du \`code\` et un ***passage important***.

\`\`\`
TVA = HT × 10 %
TTC = HT + TVA
\`\`\``

const TYPO = `Avant d’écrire : vérifiez le taux de TVA (10 % ou 20 %) — c’est « essentiel ».

Le calcul 5 * 3 * 2 reste du texte, comme [ceci] ou \`ceci\`, et R&D ou a < b.

2026\\. Une phrase qui commence par une année.

Les œuvres d’un maçon… et l’ÉTÉ.`

const MARKS = `Un **gras qui contient un [lien interne](/modele)** et un [lien qui contient du **gras**](https://www.impots.gouv.fr/professionnel).

*Italique*, **gras**, ***les deux***, puis **gras avec *italique* dedans**.

## Titre avec **gras**

- [Premier lien](/guide/mentions-obligatoires-facture)
- Second point *en italique*`

const CORPUS: [string, string][] = [
  ["guide importé (tableau HTML, citation, listes, FAQ)", GUIDE],
  ["image, tableau GFM, séparateur, code", MEDIA],
  ["typographie et caractères de syntaxe", TYPO],
  ["marques imbriquées et liens", MARKS],
]

describe("aller-retour : même rendu sur le blog", () => {
  for (const [label, markdown] of CORPUS) {
    it(label, () => {
      const first = roundTrip(markdown)
      const comparison = compareRendering(markdown, first, parse)
      expect(comparison.reasons).toEqual([])
      expect(comparison.same).toBe(true)
      // Stabilité : le second passage rend le même texte
      expect(roundTrip(first)).toBe(first)
    })
  }

  it("le tableau GFM garde ses alignements et sa barre échappée", () => {
    const out = roundTrip(MEDIA)
    expect(out).toContain("| Poste | Quantité | Prix HT |\n| :--- | :---: | ---: |")
    expect(out).toContain("| Pose \\| fourniture | 12 m² | **1 080,00 €** |")
  })

  it("l'image garde son adresse, ses dimensions, son texte alternatif et sa légende", () => {
    expect(roundTrip(MEDIA)).toContain(`![Salle de bain rénovée avec carrelage gris](${IMAGE} "Chantier terminé en mars")`)
  })

  it("le tableau HTML importé devient un tableau Markdown, au même rendu", () => {
    expect(roundTrip(GUIDE)).toContain("| Étape | Organisme |\n| --- | --- |\n| Déclaration d'activité | INPI |")
  })

  it("Markdown déjà écrit par l'éditeur : inchangé", () => {
    const first = roundTrip(GUIDE)
    expect(roundTrip(first)).toBe(first)
    expect(compareRendering(first, roundTrip(first), parse).same).toBe(true)
  })

  it("texte identique : même rendu sans calcul", () => {
    expect(compareRendering("abc", "abc", parse)).toEqual({ same: true, reasons: [] })
  })

  // Markdown écrit sans ligne vide (à la main ou par un modèle) : défauts d'espacement du moteur, que l'éditeur corrige
  const SPACING: [string, string, string][] = [
    ["texte collé au titre", "## Titre\nTexte collé au titre.\n\nParagraphe suivant.", "## Titre\n\nTexte collé au titre.\n\nParagraphe suivant."],
    ["liste collée au paragraphe", "Les points :\n- un\n- deux", "Les points :\n\n- un\n- deux"],
    ["liste numérotée entre deux lignes", "Intro :\n1. un\n2. deux\nSuite collée", "Intro :\n\n1. un\n2. deux\n\nSuite collée"],
    ["citation collée", "Texte\n> citation collée", "Texte\n\n> citation collée"],
    ["titres et liste sans ligne vide", "## Titre\n- a\n- b\n### Sous\nTexte", "## Titre\n\n- a\n- b\n\n### Sous\n\nTexte"],
  ]
  for (const [label, markdown, expected] of SPACING) {
    it(`sans ligne vide (${label}) : même rendu, blocs séparés`, () => {
      const out = roundTrip(markdown)
      expect(out).toBe(expected)
      expect(compareRendering(markdown, out, parse)).toEqual({ same: true, reasons: [] })
    })
  }

  it("un vrai retour à la ligne au milieu d'un paragraphe compte toujours", () => {
    expect(compareRendering("Ligne une\nLigne deux", "Ligne une Ligne deux", parse).same).toBe(false)
  })
})

/* ------------------------------------------------------------------ */
/* Ce que l'éditeur ne reproduit pas                                   */
/* ------------------------------------------------------------------ */

describe("différences signalées", () => {
  it("<div style> brut : signalé", () => {
    const markdown = `Introduction.\n\n<div style="color:red">Encadré rouge</div>\n\nSuite.`
    const comparison = compareRendering(markdown, roundTrip(markdown), parse)
    expect(comparison.same).toBe(false)
    expect(comparison.reasons.join(" ")).toMatch(/HTML brut sans équivalent \(.*<div>.*\)/)
    expect(comparison.reasons.join(" ")).toContain("styles")
  })

  it("<span> et <u> bruts : signalés", () => {
    const markdown = `Un <span class="x">mot</span> et un <u>autre</u>.`
    const comparison = compareRendering(markdown, roundTrip(markdown), parse)
    expect(comparison.same).toBe(false)
    expect(comparison.reasons[0]).toContain("<span>")
    expect(comparison.reasons[0]).toContain("<u>")
  })

  it("bloc de code écrit dans l'éditeur avec une ligne vide : un seul bloc sur le blog", () => {
    const editor = new Editor({ extensions: buildExtensions(), content: "<pre><code>TVA = HT × 10 %\n\nTTC = HT + TVA</code></pre>" })
    const out = docToMarkdown(editor.getJSON())
    editor.destroy()
    // Une espace sur la ligne vide : le moteur ne coupe pas le bloc en paragraphes
    expect(out).toBe("\`\`\`\nTVA = HT × 10 %\n \nTTC = HT + TVA\n\`\`\`")
    expect(markdownToHtml(out)).toBe("<pre><code>TVA = HT × 10 %\n \nTTC = HT + TVA</code></pre>")
    expect(roundTrip(out)).toBe(out)
  })

  it("liste imbriquée (HTML brut) : aplatie, signalée", () => {
    const markdown = `<ul><li>Parent<ul><li>Enfant</li></ul></li><li>Suivant</li></ul>`
    const comparison = compareRendering(markdown, roundTrip(markdown), parse)
    expect(comparison.same).toBe(false)
    expect(comparison.reasons).toContain("liste imbriquée aplatie")
  })

  it("image hors du compartiment du blog (HTML brut) : retirée, signalée", () => {
    const markdown = `Texte.\n\n<img src="https://exemple.fr/photo.jpg" alt="Photo">\n\nSuite.`
    const comparison = compareRendering(markdown, roundTrip(markdown), parse)
    expect(comparison.same).toBe(false)
    expect(comparison.reasons).toContain("image retirée")
  })

  it("tableau HTML sans ligne d'en-tête : reformaté, signalé", () => {
    const markdown = `<table><tr><td>a</td><td>b</td></tr><tr><td>c</td><td>d</td></tr></table>`
    const comparison = compareRendering(markdown, roundTrip(markdown), parse)
    expect(comparison.same).toBe(false)
    expect(comparison.reasons).toContain("tableau reformaté")
  })

  it("titre de niveau 5 (HTML brut) : signalé", () => {
    const markdown = `<h5>Petit titre</h5>\n\nTexte.`
    const comparison = compareRendering(markdown, roundTrip(markdown), parse)
    expect(comparison.same).toBe(false)
    expect(comparison.reasons).toContain("titre modifié")
  })

  it("lien modifié : signalé", () => {
    const comparison = compareRendering("[guide](/guide/a)", "[guide](/guide/b)", parse)
    expect(comparison).toEqual({ same: false, reasons: ["lien modifié"] })
  })

  it("mise en forme différente : extrait cité", () => {
    const comparison = compareRendering("Un **mot** important.", "Un *mot* important.", parse)
    expect(comparison.same).toBe(false)
    expect(comparison.reasons[0]).toMatch(/^mise en forme différente près de « .*mot.* »$/)
  })
})

/* ------------------------------------------------------------------ */
/* Signature de rendu                                                  */
/* ------------------------------------------------------------------ */

describe("ancres des titres", () => {
  const idsOf = (md: string) => Array.from(markdownToHtml(md).matchAll(/<h[23] id="([^"]*)"/g)).map((m) => m[1])

  it("titre avec « [ … ] », « * » ou « ` » littéraux : même identifiant après réécriture, les liens vers lui mènent toujours au titre", () => {
    const md = "Voir [la section](#article-293-b-mis-a-jour).\n\n## Article 293 B [mis à jour]\n\nTexte.\n\n## Les 3 * étapes\n\nTexte.\n\n### Taux [2026]\n\nTexte."
    const out = roundTrip(md)
    expect(idsOf(out)).toEqual(idsOf(md))
    expect(idsOf(out)).toContain("article-293-b-mis-a-jour")
    expect(compareRendering(md, out, parse)).toEqual({ same: true, reasons: [] })
    expect(roundTrip(out)).toBe(out)
  })

  it("ancre d'un titre changée par la réécriture : signalée (ouverture en mode Markdown)", () => {
    const comparison = compareRendering("## Prix *TTC*\n\nTexte.", "## Prix &#42;TTC&#42;\n\nTexte.", parse)
    expect(comparison.same).toBe(false)
    expect(comparison.reasons.join(" ")).toMatch(/ancre de titre modifiée|titre modifié|mise en forme/)
    expect(compareRendering("## Titre\n\nTexte.", "<h2 id=\"autre\">Titre</h2>\n\nTexte.", parse)).toEqual({ same: false, reasons: ["ancre de titre modifiée"] })
  })
})

describe("signature de rendu", () => {
  it("ignore les identifiants des titres, target, rel, thead et tbody", () => {
    const a = renderingSignature('<h2 id="x">Titre</h2><p><a href="/a" target="_blank" rel="noopener">lien</a></p>', parse)
    const b = renderingSignature("<h2>Titre</h2><p><a href=\"/a\">lien</a></p>", parse)
    expect(a.tokens).toEqual(b.tokens)
    const t1 = renderingSignature("<table><thead><tr><th>a</th></tr></thead><tbody><tr><td>b</td></tr></tbody></table>", parse)
    const t2 = renderingSignature("<table><tbody><tr><th>a</th></tr><tr><td>b</td></tr></tbody></table>", parse)
    expect(t1.tokens).toEqual(t2.tokens)
  })

  it("espaces de bord des marques et des blocs sans effet", () => {
    const a = renderingSignature("<p> Un <strong> mot </strong> ici </p>", parse)
    const b = renderingSignature("<p>Un <strong>mot</strong> ici</p>", parse)
    expect(a.tokens).toEqual(b.tokens)
  })

  it("paragraphe dans un élément de liste : sans effet ; deux paragraphes = retour à la ligne", () => {
    expect(renderingSignature("<ul><li><p>a</p></li></ul>", parse).tokens).toEqual(renderingSignature("<ul><li>a</li></ul>", parse).tokens)
    expect(renderingSignature("<ul><li><p>a</p><p>b</p></li></ul>", parse).tokens).toEqual(renderingSignature("<ul><li>a<br>b</li></ul>", parse).tokens)
  })

  it("b et i valent strong et em", () => {
    expect(renderingSignature("<p><b>a</b><i>b</i></p>", parse).tokens).toEqual(renderingSignature("<p><strong>a</strong><em>b</em></p>", parse).tokens)
  })
})

/* ------------------------------------------------------------------ */
/* Extensions                                                          */
/* ------------------------------------------------------------------ */

describe("extensions", () => {
  it("lien non sûr ignoré à la lecture (comme le moteur du blog)", () => {
    const editor = new Editor({ extensions: buildExtensions(), content: '<p><a href="javascript:alert(1)">clic</a> et <a href="/guide">guide</a></p>' })
    expect(docToMarkdown(editor.getJSON())).toBe("clic et [guide](/guide)")
    editor.destroy()
  })

  it("lien « /\\hôte » ou « /<tab>/hôte » (un autre site déguisé en chemin) : refusé partout", () => {
    const editor = new Editor({ extensions: buildExtensions(), content: '<p><a href="/\\evil.example/x">clic</a> et <a href="/guide">guide</a></p>' })
    expect(docToMarkdown(editor.getJSON())).toBe("clic et [guide](/guide)")
    editor.destroy()
    expect(markdownHref("/\\evil.example/x")).toBeNull()
    expect(isSafeHref("/\\evil.example/x")).toBe(false)
    expect(isSafeHref("/\t/evil.example/x")).toBe(false)
    expect(isSafeHref("/guide/devis")).toBe(true)
    const html = markdownToHtml("[a](/\\evil.example/x) [b](/\t/evil.example/y) [c](/guide)")
    expect(html).not.toContain("evil.example/x\"")
    expect(html.match(/<a /g)).toHaveLength(1)
    expect(html).toContain('href="/guide"')
  })

  it("image : figure et légende lues, image seule lue sans légende", () => {
    const src = IMAGE.split("#")[0]
    const editor = new Editor({
      extensions: buildExtensions(),
      content: `<figure><img src="${src}" alt="Alt" width="800" height="600"><figcaption>Légende</figcaption></figure><img src="${src}" alt="Seule" title="infobulle">`,
    })
    const images = (editor.getJSON().content ?? []).filter((n) => n.type === "image")
    expect(images.map((n) => n.attrs)).toEqual([
      { src, alt: "Alt", title: "Légende", width: 800, height: 600 },
      { src, alt: "Seule", title: null, width: null, height: null },
    ])
    editor.destroy()
  })

  it("« # » + espace donne un titre 2, jamais un titre 1", () => {
    const editor = new Editor({ extensions: buildExtensions(), content: "<p></p>" })
    editor.commands.focus("start")
    // Simule la frappe : les règles de saisie passent par handleTextInput
    const { view } = editor
    view.someProp("handleTextInput", (f) => f(view, 1, 1, "#", () => view.state.tr.insertText("#", 1, 1)))
    if (editor.getText() !== "#") editor.commands.insertContent("#")
    const pos = editor.state.selection.from
    view.someProp("handleTextInput", (f) => f(view, pos, pos, " ", () => view.state.tr.insertText(" ", pos, pos)))
    expect(editor.getJSON().content?.[0]).toMatchObject({ type: "heading", attrs: { level: 2 } })
    editor.destroy()
  })

  it("surlignage : sans accents ni casse, en mots entiers", () => {
    expect(findTermRanges("Le Devis Maçon et les devis maçonnerie", ["devis macon"])).toEqual([[3, 14]])
    expect(findTermRanges("L’ÉTÉ, l'été", ["été"])).toEqual([
      [2, 5],
      [9, 12],
    ])
    expect(findTermRanges("œuvre et oeuvre", ["oeuvre"])).toEqual([
      [0, 5],
      [9, 15],
    ])
    expect(findTermRanges("devisdevis", ["devis"])).toEqual([])
    expect(findTermRanges("TVA travaux, tva", ["TVA", "tva travaux"])).toEqual([
      [0, 11],
      [13, 16],
    ])
    expect(findTermRanges("abc", ["", " ", "a"])).toEqual([])
  })

  it("surlignage dans l'éditeur, mis à jour par transaction", () => {
    const editor = new Editor({ extensions: buildExtensions(), content: "<h2>Devis de maçon</h2><p>Un <strong>devis</strong> et un DEVIS.</p>" })
    const count = () => HIGHLIGHT_KEY.getState(editor.state)?.decorations.find().length ?? 0
    expect(count()).toBe(0)
    setHighlightTerms(editor, ["devis"])
    expect(count()).toBe(3)
    editor.commands.insertContentAt(editor.state.doc.content.size - 1, " Encore un devis")
    expect(count()).toBe(4)
    setHighlightTerms(editor, [])
    expect(count()).toBe(0)
    // Le surlignage ne touche ni le texte ni le Markdown
    expect(docToMarkdown(editor.getJSON())).toBe("## Devis de maçon\n\nUn **devis** et un DEVIS. Encore un devis")
    editor.destroy()
  })

  it("surlignage à la frappe : seuls les blocs modifiés sont relus, même résultat qu'un calcul complet", () => {
    const paragraphs = Array.from({ length: 40 }, (_, i) => `<p>Paragraphe ${i} : un devis de maçonnerie et un autre devis.</p>`).join("")
    const editor = new Editor({ extensions: buildExtensions(), content: `<h2>Devis maçon</h2>${paragraphs}<ul><li><p>devis en liste</p></li></ul>` })
    const ranges = () =>
      (HIGHLIGHT_KEY.getState(editor.state)?.decorations.find() ?? []).map((d) => `${d.from}-${d.to}`).sort()
    const full = () => {
      const copy = new Editor({ extensions: buildExtensions(), content: editor.getJSON() })
      setHighlightTerms(copy, ["devis", "devis de maçonnerie"])
      const out = (HIGHLIGHT_KEY.getState(copy.state)?.decorations.find() ?? []).map((d) => `${d.from}-${d.to}`).sort()
      copy.destroy()
      return out
    }
    setHighlightTerms(editor, ["devis", "devis de maçonnerie"])
    expect(ranges()).toEqual(full())
    // Frappe au milieu d'un mot surligné, mot ajouté, coupure et fusion de paragraphes, suppression d'un passage
    editor.commands.insertContentAt(40, "x")
    expect(ranges()).toEqual(full())
    editor.commands.insertContentAt(200, " devis ")
    expect(ranges()).toEqual(full())
    editor.chain().setTextSelection(300).splitBlock().run()
    expect(ranges()).toEqual(full())
    editor.chain().setTextSelection(301).joinBackward().run()
    expect(ranges()).toEqual(full())
    editor.commands.deleteRange({ from: 120, to: 420 })
    expect(ranges()).toEqual(full())
    editor.chain().setTextSelection(10).toggleCodeBlock().run()
    expect(ranges()).toEqual(full())
    editor.destroy()
  })

  it("image demandée dans une liste : insérée après la liste, curseur au paragraphe suivant", () => {
    const editor = new Editor({ extensions: buildExtensions(), content: markdownToHtml("- un\n- deux\n\nFin.") })
    let inside = -1
    editor.state.doc.descendants((node, pos) => {
      if (inside < 0 && node.isText && node.text === "un") inside = pos + 1
    })
    editor.commands.setTextSelection(inside)
    expect(blockInsertPosition(editor.state)).toBe(editor.state.doc.child(0).nodeSize)
    insertBlock(editor, { type: "image", attrs: { src: IMAGE.split("#")[0], alt: "Pose terminée", width: 1600, height: 900, title: null } })
    expect(docToMarkdown(editor.getJSON())).toBe(`- un\n- deux\n\n![Pose terminée](${IMAGE})\n\nFin.`)
    expect(editor.state.selection.$from.parent.textContent).toBe("Fin.")
    editor.destroy()
  })

  it("séparateur en fin d'article depuis une citation : paragraphe créé après", () => {
    const editor = new Editor({ extensions: buildExtensions(), content: markdownToHtml("> Citation") })
    editor.commands.setTextSelection(3)
    insertBlock(editor, { type: "horizontalRule" })
    const types = (editor.getJSON().content ?? []).map((n) => n.type)
    expect(types.slice(0, 3)).toEqual(["blockquote", "horizontalRule", "paragraph"])
    expect(editor.state.selection.$from.parent.type.name).toBe("paragraph")
    expect(docToMarkdown(editor.getJSON())).toBe("> Citation\n\n---")
    editor.destroy()
  })

  it("tableau demandé dans un tableau : inséré après, curseur dans sa première cellule", () => {
    const editor = new Editor({ extensions: buildExtensions(), content: markdownToHtml("| a | b |\n| --- | --- |\n| c | d |") })
    editor.commands.setTextSelection(5)
    insertBlock(editor, emptyTable(2, 2))
    const tables = (editor.getJSON().content ?? []).filter((n) => n.type === "table")
    expect(tables).toHaveLength(2)
    expect(editor.state.selection.$from.node(-1).type.name).toBe("tableHeader")
    expect(editor.state.selection.$from.before(1)).toBe(editor.state.doc.child(0).nodeSize)
    editor.destroy()
  })

  it("image sélectionnée : la suivante s'insère après elle, sans la remplacer", () => {
    const editor = new Editor({ extensions: buildExtensions(), content: markdownToHtml(`Texte.\n\n![Une](${IMAGE})`) })
    let imagePos = -1
    editor.state.doc.descendants((node, pos) => {
      if (node.type.name === "image") imagePos = pos
    })
    editor.commands.setNodeSelection(imagePos)
    insertBlock(editor, { type: "image", attrs: { src: IMAGE.split("#")[0], alt: "Deux", width: 1600, height: 900, title: null } })
    expect(docToMarkdown(editor.getJSON())).toBe(`Texte.\n\n![Une](${IMAGE})\n\n![Deux](${IMAGE})`)
    editor.destroy()
  })

  it("tableau : la première ligne reste l'en-tête après suppression ou ajout", () => {
    const editor = new Editor({ extensions: buildExtensions(), content: markdownToHtml("| a | b |\n| --- | --- |\n| c | d |\n| e | f |") })
    const cellTypes = () => {
      const rows: JSONContent[] = editor.getJSON().content?.[0].content ?? []
      return rows.map((row) => (row.content ?? []).map((cell) => cell.type))
    }
    // Curseur dans l'en-tête, ligne supprimée : « c | d » devient l'en-tête
    editor.commands.setTextSelection(4)
    editor.chain().focus().deleteRow().command(({ tr }) => !!normalizeTableHeader(tr)).run()
    expect(cellTypes()).toEqual([
      ["tableHeader", "tableHeader"],
      ["tableCell", "tableCell"],
    ])
    expect(docToMarkdown(editor.getJSON())).toBe("| c | d |\n| --- | --- |\n| e | f |")
    // Une seule étape à annuler
    editor.commands.undo()
    expect(docToMarkdown(editor.getJSON())).toBe("| a | b |\n| --- | --- |\n| c | d |\n| e | f |")
    editor.destroy()
  })

  it("collage : titres ramenés aux niveaux du blog (1 → 2, 5 et 6 → 4)", () => {
    expect(demotePastedHeadings('<h1 class="x">Titre</h1><h2>A</h2><H5>B</H5><h6>C</h6><header>en-tête</header>')).toBe(
      '<h2 class="x">Titre</h2><h2>A</h2><h4>B</h4><h4>C</h4><header>en-tête</header>',
    )
  })

  it("collage : texte Markdown reconnu", () => {
    expect(looksLikeMarkdown("## Titre\n\nTexte")).toBe(true)
    expect(looksLikeMarkdown("- un\n- deux")).toBe(true)
    expect(looksLikeMarkdown("Un **gras** ici")).toBe(true)
    expect(looksLikeMarkdown("Voir [le guide](/guide/x)")).toBe(true)
    expect(looksLikeMarkdown("| a | b |\n| --- | --- |")).toBe(true)
    expect(looksLikeMarkdown("Un simple texte, sans rien.")).toBe(false)
    expect(looksLikeMarkdown("Tarif - 20 % le samedi")).toBe(false)
  })
})
