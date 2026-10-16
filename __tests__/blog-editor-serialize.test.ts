/**
 * Sérialiseur de l'éditeur visuel (lib/blog-editor/serialize.ts) : document
 * Tiptap (JSON) → Markdown du blog, cas par nœud et par marque, échappements,
 * listes imbriquées aplaties, espaces de bord. Chaque Markdown produit est
 * aussi passé par le moteur du blog (lib/markdown.ts) pour vérifier ce qu'il
 * affiche réellement.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest"
import type { JSONContent } from "@tiptap/core"
import { docToMarkdown, escapeLineStart, escapeMarkdownText, markdownHref } from "@/lib/blog-editor/serialize"
import { markdownToHtml } from "@/lib/markdown"

const SUPABASE = "https://abcd.supabase.co"
const BUCKET = `${SUPABASE}/storage/v1/object/public/blog-covers/editor/2026/10`
let previousUrl: string | undefined

beforeAll(() => {
  previousUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  process.env.NEXT_PUBLIC_SUPABASE_URL = SUPABASE
})
afterAll(() => {
  process.env.NEXT_PUBLIC_SUPABASE_URL = previousUrl
})

/* ------------------------------------------------------------------ */
/* Constructeurs                                                       */
/* ------------------------------------------------------------------ */

type MarkName = "bold" | "italic" | "code" | { link: string }

function t(text: string, ...marks: MarkName[]): JSONContent {
  return {
    type: "text",
    text,
    ...(marks.length > 0 ? { marks: marks.map((m) => (typeof m === "string" ? { type: m } : { type: "link", attrs: { href: m.link } })) } : {}),
  }
}
const br: JSONContent = { type: "hardBreak" }
const p = (...content: JSONContent[]): JSONContent => ({ type: "paragraph", content })
const h = (level: number, ...content: JSONContent[]): JSONContent => ({ type: "heading", attrs: { level }, content })
const li = (...content: JSONContent[]): JSONContent => ({ type: "listItem", content })
const ul = (...items: JSONContent[]): JSONContent => ({ type: "bulletList", content: items })
const ol = (...items: JSONContent[]): JSONContent => ({ type: "orderedList", attrs: { start: 1 }, content: items })
const quote = (...content: JSONContent[]): JSONContent => ({ type: "blockquote", content })
const code = (text: string, language: string | null = null): JSONContent => ({ type: "codeBlock", attrs: { language }, content: [{ type: "text", text }] })
const hr: JSONContent = { type: "horizontalRule" }
const img = (attrs: Record<string, unknown>): JSONContent => ({ type: "image", attrs: { title: null, width: null, height: null, alt: null, ...attrs } })
const cell = (type: "tableHeader" | "tableCell", content: JSONContent[], align: string | null = null): JSONContent => ({
  type,
  attrs: { colspan: 1, rowspan: 1, colwidth: null, align },
  content: [p(...content)],
})
const th = (content: JSONContent[] | string, align: string | null = null) => cell("tableHeader", typeof content === "string" ? [t(content)] : content, align)
const td = (content: JSONContent[] | string, align: string | null = null) => cell("tableCell", typeof content === "string" ? [t(content)] : content, align)
const tr = (...cells: JSONContent[]): JSONContent => ({ type: "tableRow", content: cells })
const table = (...rows: JSONContent[]): JSONContent => ({ type: "table", content: rows })
const doc = (...content: JSONContent[]): JSONContent => ({ type: "doc", content })

const md = (...blocks: JSONContent[]) => docToMarkdown(doc(...blocks))
/** HTML rendu par le moteur du blog. */
const render = (...blocks: JSONContent[]) => markdownToHtml(md(...blocks))

/* ------------------------------------------------------------------ */
/* Blocs                                                               */
/* ------------------------------------------------------------------ */

describe("blocs", () => {
  it("document vide → texte vide", () => {
    expect(docToMarkdown(doc())).toBe("")
    expect(docToMarkdown(doc(p()))).toBe("")
    expect(docToMarkdown({ type: "doc" })).toBe("")
  })

  it("paragraphes séparés par une ligne vide, sans espace final", () => {
    expect(md(p(t("Premier paragraphe.  ")), p(), p(t("Second.")))).toBe("Premier paragraphe.\n\nSecond.")
  })

  it("titres 1 à 4, niveau 5 ramené à 4, titre vide ignoré", () => {
    expect(md(h(1, t("Un")), h(2, t("Deux")), h(3, t("Trois")), h(4, t("Quatre")), h(5, t("Cinq")), h(2))).toBe(
      "# Un\n\n## Deux\n\n### Trois\n\n#### Quatre\n\n#### Cinq",
    )
    expect(render(h(2, t("TVA à 10 % : les règles")))).toBe('<h2 id="tva-a-10-les-regles">TVA à 10 % : les règles</h2>')
  })

  it("saut de ligne : retour à la ligne dans un paragraphe, espace dans un titre", () => {
    expect(md(p(t("ligne un"), br, t("ligne deux")))).toBe("ligne un\nligne deux")
    expect(render(p(t("ligne un"), br, t("ligne deux")))).toBe("<p>ligne un<br />ligne deux</p>")
    expect(md(h(2, t("Titre"), br, t("suite")))).toBe("## Titre suite")
  })

  it("sauts de ligne répétés : un seul paragraphe ; sauts de bord retirés", () => {
    const out = md(p(br, t("a"), br, br, t("b"), br))
    expect(out).toBe("a<br />\nb")
    expect(markdownToHtml(out)).toBe("<p>a<br /><br />b</p>")
  })

  it("listes à puces et numérotées", () => {
    expect(md(ul(li(p(t("un"))), li(p(t("deux")))))).toBe("- un\n- deux")
    expect(md(ol(li(p(t("un"))), li(p(t("deux"))), li(p(t("trois")))))).toBe("1. un\n2. deux\n3. trois")
    expect(render(ol(li(p(t("un"))), li(p(t("deux")))))).toBe("<ol>\n<li>un</li>\n<li>deux</li>\n</ol>")
  })

  it("élément de liste : saut de ligne et second paragraphe en <br />, élément vide ignoré", () => {
    expect(md(ul(li(p(t("a"), br, t("b"))), li(p()), li(p(t("c")), p(t("d")))))).toBe("- a<br />b\n- c<br />d")
    expect(render(ul(li(p(t("a"), br, t("b")))))).toBe("<ul>\n<li>a<br />b</li>\n</ul>")
  })

  it("liste imbriquée aplatie à la suite de son élément", () => {
    const nested = ul(li(p(t("parent")), ul(li(p(t("enfant 1"))), li(p(t("enfant 2"))))), li(p(t("suivant"))))
    expect(md(nested)).toBe("- parent\n- enfant 1\n- enfant 2\n- suivant")
    const mixed = ol(li(p(t("étape")), ul(li(p(t("détail"))))))
    expect(md(mixed)).toBe("1. étape\n2. détail")
  })

  it("deux listes voisines restent deux listes", () => {
    expect(render(ul(li(p(t("a")))), ul(li(p(t("b")))))).toBe("<ul>\n<li>a</li>\n</ul>\n\n<ul>\n<li>b</li>\n</ul>")
  })

  it("citation : « > » sur chaque ligne", () => {
    expect(md(quote(p(t("une"), br, t("deux")), p(t("trois"))))).toBe("> une\n> deux\n> trois")
    expect(render(quote(p(t("une"), br, t("deux"))))).toBe("<blockquote><p>une<br />deux</p></blockquote>")
    expect(md(quote(p()))).toBe("")
  })

  it("bloc de code : langue, ligne vide gardée sans couper le bloc", () => {
    expect(md(code("const a = 1\n\nconst b = 2", "ts"))).toBe("```ts\nconst a = 1\n \nconst b = 2\n```")
    expect(render(code("a\n\nb"))).toBe("<pre><code>a\n \nb</code></pre>")
    expect(md(code("x", "objective-c"))).toBe("```objectivec\nx\n```")
    expect(md(code("   "))).toBe("")
  })

  it("séparateur", () => {
    expect(md(p(t("a")), hr, p(t("b")))).toBe("a\n\n---\n\nb")
    expect(render(hr)).toBe("<hr />")
  })
})

/* ------------------------------------------------------------------ */
/* Images                                                              */
/* ------------------------------------------------------------------ */

describe("images", () => {
  it("image du blog : ligne seule, dimensions dans le fragment, légende", () => {
    const out = md(p(t("Avant.")), img({ src: `${BUCKET}/salle.jpg`, alt: "Salle de bain rénovée", title: "Chantier de mars", width: 1600, height: 900 }), p(t("Après.")))
    expect(out).toBe(`Avant.\n\n![Salle de bain rénovée](${BUCKET}/salle.jpg#w=1600&h=900 "Chantier de mars")\n\nAprès.`)
    expect(markdownToHtml(out)).toContain(
      `<figure><img src="${BUCKET}/salle.jpg" alt="Salle de bain rénovée" width="1600" height="900" loading="lazy" decoding="async" /><figcaption>Chantier de mars</figcaption></figure>`,
    )
  })

  it("sans légende ni dimensions", () => {
    expect(md(img({ src: `${BUCKET}/a.png`, alt: "Plan" }))).toBe(`![Plan](${BUCKET}/a.png)`)
  })

  it("fragment de l'adresse remplacé par les dimensions du nœud", () => {
    expect(md(img({ src: `${BUCKET}/a.png#w=10&h=10`, alt: "x", width: 800, height: 600 }))).toBe(`![x](${BUCKET}/a.png#w=800&h=600)`)
  })

  it("crochets du texte alternatif et guillemets de la légende échappés", () => {
    const out = md(img({ src: `${BUCKET}/a.png`, alt: "Pose [étape 2]\nfinie", title: 'Un "beau" chantier' }))
    expect(out).toBe(`![Pose \\[étape 2\\] finie](${BUCKET}/a.png "Un \\"beau\\" chantier")`)
    const html = markdownToHtml(out)
    expect(html).toContain('alt="Pose [étape 2] finie"')
    expect(html).toContain("<figcaption>Un &quot;beau&quot; chantier</figcaption>")
  })

  it("image sans adresse http(s) : ignorée", () => {
    expect(md(img({ src: "", alt: "x" }))).toBe("")
    expect(md(img({ src: "javascript:alert(1)", alt: "x" }))).toBe("")
    expect(md(img({ src: "/relative.png", alt: "x" }))).toBe("")
  })
})

/* ------------------------------------------------------------------ */
/* Tableaux                                                            */
/* ------------------------------------------------------------------ */

describe("tableaux", () => {
  it("première ligne en en-tête, alignements, colonnes complétées", () => {
    const out = md(table(tr(th("Étape", "left"), th("Délai", "center"), th("Coût", "right")), tr(td("Devis"), td("2 j")), tr(td("Pose"), td("5 j"), td("1 200 €"))))
    expect(out).toBe("| Étape | Délai | Coût |\n| :--- | :---: | ---: |\n| Devis | 2 j |  |\n| Pose | 5 j | 1 200 € |")
    const html = markdownToHtml(out)
    expect(html).toMatch(/^<table><thead><tr><th style="text-align:left">Étape<\/th>/)
    expect(html).not.toContain("\n\n<tbody")
  })

  it("barre verticale échappée, saut de ligne de cellule en espace", () => {
    const out = md(table(tr(th("A"), th("B")), tr(td([t("Pose | finition")]), td([t("ligne 1"), br, t("ligne 2")]))))
    expect(out).toBe("| A | B |\n| --- | --- |\n| Pose \\| finition | ligne 1 ligne 2 |")
    expect(markdownToHtml(out)).toContain("<td>Pose | finition</td><td>ligne 1 ligne 2</td>")
  })

  it("mise en forme et liens dans les cellules", () => {
    const out = md(table(tr(th("Texte"), th("Lien")), tr(td([t("très", "bold"), t(" "), t("utile", "italic")]), td([t("guide", { link: "/guide/tva-travaux" })]))))
    expect(out).toBe("| Texte | Lien |\n| --- | --- |\n| **très** *utile* | [guide](/guide/tva-travaux) |")
    const html = markdownToHtml(out)
    expect(html).toContain("<td><strong>très</strong> <em>utile</em></td>")
    expect(html).toContain('<td><a href="/guide/tva-travaux" target="_blank" rel="noopener noreferrer">guide</a></td>')
  })

  it("tableau vide : ignoré", () => {
    expect(md(table())).toBe("")
  })
})

/* ------------------------------------------------------------------ */
/* Marques                                                             */
/* ------------------------------------------------------------------ */

describe("marques", () => {
  it("gras, italique, code", () => {
    expect(md(p(t("du "), t("gras", "bold"), t(", de l'"), t("italique", "italic"), t(" et du "), t("code", "code")))).toBe("du **gras**, de l'*italique* et du `code`")
    expect(render(p(t("du "), t("gras", "bold"), t(" et "), t("code", "code")))).toBe("<p>du <strong>gras</strong> et <code>code</code></p>")
  })

  it("gras et italique ensemble", () => {
    expect(md(p(t("les deux", "bold", "italic")))).toBe("***les deux***")
    expect(render(p(t("les deux", "bold", "italic")))).toBe("<p><strong><em>les deux</em></strong></p>")
  })

  it("italique dans du gras, gras qui continue", () => {
    const out = md(p(t("a ", "bold"), t("b", "bold", "italic"), t(" c", "bold")))
    expect(out).toBe("**a *b* c**")
    expect(markdownToHtml(out)).toBe("<p><strong>a <em>b</em> c</strong></p>")
  })

  it("italique collé à du gras : balises HTML, rendu juste", () => {
    const out = md(p(t("a", "italic"), t("b", "bold")))
    expect(out).toBe("<em>a</em><strong>b</strong>")
    expect(markdownToHtml(out)).toBe("<p><em>a</em><strong>b</strong></p>")
  })

  it("espaces de bord sortis des marques", () => {
    expect(md(p(t("Un"), t(" mot ", "bold"), t("suivant")))).toBe("Un **mot** suivant")
    expect(md(p(t("Un "), t(" lien ", { link: "/blog" }), t("ici")))).toBe("Un  [lien](/blog) ici")
    // Le code garde ses espaces
    expect(md(p(t("x"), t(" a b ", "code")))).toBe("x` a b `")
  })

  it("espace seul marqué : jamais de marque vide", () => {
    expect(md(p(t("a"), t(" ", "bold"), t("b")))).toBe("a b")
    expect(md(p(t("a", "bold"), t(" ", "bold", "italic"), t("b", "bold")))).toBe("**a b**")
  })

  it("lien à l'extérieur, gras à l'intérieur", () => {
    const out = md(p(t("Lire "), t("le guide", "bold", { link: "https://www.service-public.gouv.fr/x" }), t(".")))
    expect(out).toBe("Lire [**le guide**](https://www.service-public.gouv.fr/x).")
    expect(markdownToHtml(out)).toBe('<p>Lire <a href="https://www.service-public.gouv.fr/x" target="_blank" rel="noopener noreferrer"><strong>le guide</strong></a>.</p>')
  })

  it("lien en partie en gras", () => {
    const out = md(p(t("très ", { link: "/guide" }), t("utile", "bold", { link: "/guide" })))
    expect(out).toBe("[très **utile**](/guide)")
    expect(markdownToHtml(out)).toBe('<p><a href="/guide" target="_blank" rel="noopener noreferrer">très <strong>utile</strong></a></p>')
  })

  it("deux liens voisins", () => {
    expect(md(p(t("a", { link: "/a" }), t("b", { link: "/b" })))).toBe("[a](/a)[b](/b)")
  })

  it("adresse refusée par le moteur : texte seul", () => {
    expect(md(p(t("clic", { link: "javascript:alert(1)" })))).toBe("clic")
    expect(md(p(t("clic", { link: "//evil.example" })))).toBe("clic")
    expect(md(p(t("mail", { link: "mailto:a@b.fr" })))).toBe("mail")
  })

  it("adresse : espaces, parenthèses et astérisques encodés", () => {
    expect(markdownHref("/guide/a b(c)*")).toBe("/guide/a%20b%28c%29%2A")
    expect(markdownHref("https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000006")).toBe("https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000006")
    expect(markdownHref(" #faq ")).toBe("#faq")
    expect(markdownHref("ftp://x")).toBeNull()
  })

  it("marques dans un titre et dans une liste", () => {
    expect(md(h(2, t("Le "), t("devis", "bold")))).toBe("## Le **devis**")
    expect(md(ul(li(p(t("Point", "bold"), t(" : explication")))))).toBe("- **Point** : explication")
  })

  it("marques coupées au saut de ligne", () => {
    const out = md(p(t("gras", "bold"), br, t("encore", "bold")))
    expect(out).toBe("**gras**\n**encore**")
    expect(markdownToHtml(out)).toBe("<p><strong>gras</strong><br /><strong>encore</strong></p>")
  })
})

/* ------------------------------------------------------------------ */
/* Échappements                                                        */
/* ------------------------------------------------------------------ */

describe("échappements", () => {
  it("caractères de syntaxe du moteur en entités", () => {
    expect(escapeMarkdownText("5 * 3 * 2")).toBe("5 &#42; 3 &#42; 2")
    expect(escapeMarkdownText("`code`")).toBe("&#96;code&#96;")
    expect(escapeMarkdownText("[note](x)")).toBe("&#91;note&#93;(x)")
    expect(escapeMarkdownText("<div> et a < b")).toBe("&lt;div> et a < b")
    expect(escapeMarkdownText("R&D, &eacute; et &#42;")).toBe("R&D, &amp;eacute; et &amp;#42;")
  })

  it("le texte s'affiche tel quel sur le blog", () => {
    const html = render(p(t("5 * 3 * 2, `x`, [note](/a), <div>, &eacute;")))
    const text = html.replace(/^<p>|<\/p>$/g, "")
    expect(text).not.toMatch(/<em>|<code>|<a |<div>/)
    expect(text).toBe("5 &#42; 3 &#42; 2, &#96;x&#96;, &#91;note&#93;(/a), &lt;div>, &amp;eacute;")
  })

  it("début de ligne lu comme un bloc : premier caractère en entité", () => {
    expect(escapeLineStart("# pas un titre")).toBe("&#35; pas un titre")
    expect(escapeLineStart("- pas une liste")).toBe("&#45; pas une liste")
    expect(escapeLineStart("---")).toBe("&#45;--")
    expect(escapeLineStart("1. pas une liste")).toBe("1&#46; pas une liste")
    expect(escapeLineStart("2026. Une année")).toBe("2026&#46; Une année")
    expect(escapeLineStart("> pas une citation")).toBe("&gt; pas une citation")
    expect(escapeLineStart("| pas un tableau")).toBe("&#124; pas un tableau")
    expect(escapeLineStart(":--- | ---:")).toBe("&#58;--- | ---:")
    expect(escapeLineStart("1.5 litre")).toBe("1.5 litre")
    expect(escapeLineStart("Texte normal")).toBe("Texte normal")
  })

  it("paragraphes qui ressemblent à des blocs restent des paragraphes", () => {
    const html = render(p(t("# pas un titre")), p(t("- pas une liste")), p(t("1. pas une liste")), p(t("> pas une citation")), p(t("ligne"), br, t("---")))
    expect(html).toBe(
      "<p>&#35; pas un titre</p>\n\n<p>&#45; pas une liste</p>\n\n<p>1&#46; pas une liste</p>\n\n<p>&gt; pas une citation</p>\n\n<p>ligne<br />&#45;--</p>",
    )
  })

  it("tableau imité dans un paragraphe : pas de tableau", () => {
    const html = render(p(t("A | B"), br, t(":--- | ---")))
    expect(html).not.toContain("<table>")
  })

  it("texte d'un code en ligne : entités aussi (le moteur ne l'échappe pas)", () => {
    const out = md(p(t("a*b*c", "code")))
    expect(out).toBe("`a&#42;b&#42;c`")
    expect(markdownToHtml(out)).toBe("<p><code>a&#42;b&#42;c</code></p>")
  })
})

/* ------------------------------------------------------------------ */
/* Blocs imbriqués que le moteur n'affiche qu'au premier niveau        */
/* ------------------------------------------------------------------ */

describe("image, tableau et séparateur imbriqués : sortis, jamais perdus", () => {
  const photo = img({ src: `${BUCKET}/pose.jpg`, alt: "Pose du carrelage", width: 1600, height: 900 })
  const photoMd = `![Pose du carrelage](${BUCKET}/pose.jpg#w=1600&h=900)`

  it("image dans un élément de liste : écrite après la liste", () => {
    const out = md(ul(li(p(t("Dépose")), photo), li(p(t("Pose")))), p(t("Suite.")))
    expect(out).toBe(`- Dépose\n- Pose\n\n${photoMd}\n\nSuite.`)
    expect(markdownToHtml(out)).toContain("<figure>")
  })

  it("image dans une citation : écrite après la citation", () => {
    expect(md(quote(p(t("Avant")), photo))).toBe(`> Avant\n\n${photoMd}`)
  })

  it("image et tableau dans une cellule : écrits après le tableau", () => {
    const inner = table(tr(th("x")), tr(td("y")))
    const cellWithMedia: JSONContent = { type: "tableCell", attrs: { colspan: 1, rowspan: 1, colwidth: null, align: null }, content: [photo, p(t("c")), inner] }
    const out = md(table(tr(th("h")), tr(cellWithMedia)))
    expect(out).toBe(`| h |\n| --- |\n| c |\n\n${photoMd}\n\n| x |\n| --- |\n| y |`)
  })

  it("tableau et séparateur dans une liste : écrits après la liste, dans l'ordre", () => {
    const out = md(ol(li(p(t("Un")), table(tr(th("a")), tr(td("b")))), li(p(t("Deux")), hr)))
    expect(out).toBe("1. Un\n2. Deux\n\n| a |\n| --- |\n| b |\n\n---")
  })

  it("liste dans une citation dans une liste : image sortie au premier niveau", () => {
    expect(md(ul(li(p(t("a")), quote(p(t("q")), photo))))).toBe(`- a<br />q\n\n${photoMd}`)
  })
})
