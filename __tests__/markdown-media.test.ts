import { afterEach, beforeEach, describe, expect, it } from "vitest"
import { markdownToHtml } from "@/lib/markdown"

const SUPABASE = "https://proj.supabase.co"
const IMG = `${SUPABASE}/storage/v1/object/public/blog-covers/editor/2026/10/chantier-abc123.jpg`
const env = { ...process.env }

beforeEach(() => {
  process.env.NEXT_PUBLIC_SUPABASE_URL = SUPABASE
})

afterEach(() => {
  process.env = { ...env }
})

/** Blocs de premier niveau (le moteur sépare les blocs par une ligne vide). */
const blocks = (html: string) => html.split("\n\n").map((b) => b.trim()).filter(Boolean)

describe("images du texte", () => {
  it("image du blog seule sur sa ligne : figure, dimensions du fragment, légende, chargement différé", () => {
    const html = markdownToHtml(`![Un carreleur pose un carrelage gris](${IMG}#w=1600&h=900 "Pose d'un grès cérame")`)
    expect(html).toBe(
      `<figure><img src="${IMG}" alt="Un carreleur pose un carrelage gris" width="1600" height="900" loading="lazy" decoding="async" />` +
        "<figcaption>Pose d'un grès cérame</figcaption></figure>",
    )
  })

  it("image générée par IA (editor/ia/) : « Illustration générée par IA » sous elle sur le blog, jamais dans l'éditeur", () => {
    const generated = `${SUPABASE}/storage/v1/object/public/blog-covers/editor/ia/2026/10/macon-abc123.jpg`
    const page = (md: string) => markdownToHtml(md, { aiImageMention: true })
    expect(page(`![Un maçon](${generated}#w=1600&h=900)`)).toContain("<figcaption>Illustration générée par IA</figcaption>")
    expect(page(`![Un maçon](${generated} "Mur en parpaings")`)).toContain("<figcaption>Mur en parpaings · Illustration générée par IA</figcaption>")
    // Image importée : aucune mention ; éditeur (sans l'option) : légende telle quelle
    expect(page(`![Photo](${IMG})`)).not.toContain("figcaption")
    expect(markdownToHtml(`![Un maçon](${generated})`)).not.toContain("figcaption")
  })

  it("sans fragment : ni largeur ni hauteur ; sans légende : pas de figcaption", () => {
    const html = markdownToHtml(`![Photo](${IMG})`)
    expect(html).toBe(`<figure><img src="${IMG}" alt="Photo" loading="lazy" decoding="async" /></figure>`)
    expect(html).not.toContain("figcaption")
    expect(markdownToHtml(`![Photo](${IMG}#w=abc&h=900)`)).not.toContain("width=")
  })

  it("adresse hors du compartiment du blog : rien n'est affiché, le paragraphe reste d'un seul tenant", () => {
    const html = markdownToHtml("Avant\n![Pixel](https://tracker.example.com/p.gif)\nAprès")
    expect(html).toBe("<p>Avant<br />Après</p>")
    for (const url of [
      "http://proj.supabase.co/storage/v1/object/public/blog-covers/a.jpg",
      `${SUPABASE}/storage/v1/object/public/logos/a.jpg`,
      "javascript:alert(1)",
      "/images/locale.jpg",
    ]) {
      const out = markdownToHtml(`![x](${url})`)
      expect(out).not.toContain("<img")
      expect(out).not.toContain("<a")
      expect(out).not.toContain("!")
    }
  })

  it("adresse admise selon le projet passé en option", () => {
    expect(markdownToHtml(`![x](${IMG})`, { supabaseUrl: "https://autre.supabase.co" })).not.toContain("<img")
    expect(markdownToHtml(`![x](${IMG})`, { supabaseUrl: SUPABASE })).toContain("<img")
  })

  it("texte alternatif et légende échappés, jamais réinterprétés (gras, italique, liens)", () => {
    const html = markdownToHtml(`![Tableau <b>"neuf"</b> & *bon* [lien](https://x.fr)](${IMG} "Légende \\"citée\\" <i>x</i> **gras**")`)
    expect(html).toContain('alt="Tableau &lt;b&gt;&quot;neuf&quot;&lt;/b&gt; &amp; *bon* [lien](https://x.fr)"')
    expect(html).toContain("<figcaption>Légende &quot;citée&quot; &lt;i&gt;x&lt;/i&gt; **gras**</figcaption>")
    expect(html).not.toContain("<em>")
    expect(html).not.toContain("<strong>")
    expect(html).not.toContain("<a ")
  })

  it("image au milieu d'un paragraphe : jamais affichée, le texte reste", () => {
    const html = markdownToHtml(`Voici ![une photo](${IMG}) au milieu d'une phrase.`)
    expect(html).toBe("<p>Voici  au milieu d'une phrase.</p>")
    expect(html).not.toContain("<img")
    expect(html).not.toContain("!<a")
  })

  it("image entre deux lignes de texte : trois blocs, la figure jamais dans un <p>", () => {
    const html = markdownToHtml(`Avant l'image.\n![Photo](${IMG})\nAprès l'image.`)
    expect(blocks(html)).toEqual([
      "<p>Avant l'image.</p>",
      `<figure><img src="${IMG}" alt="Photo" loading="lazy" decoding="async" /></figure>`,
      "<p>Après l'image.</p>",
    ])
  })

  it("fin de ligne Windows et crochets échappés dans le texte alternatif", () => {
    const html = markdownToHtml(`Avant\r\n![Plan \\[cuisine\\]](${IMG} "Plan")\r\nAprès`)
    expect(html).toContain('<img src="' + IMG + '" alt="Plan [cuisine]"')
    expect(html).toContain("<figcaption>Plan</figcaption>")
  })

  it("image seule dans une puce ou une citation : la ligne disparaît, sans puce vide ni « > » isolé", () => {
    expect(markdownToHtml(`- ![Photo](${IMG})\n- Deuxième point`)).toBe("<ul>\n<li>Deuxième point</li>\n</ul>")
    const quote = markdownToHtml(`Avant.\n\n> ![Photo](${IMG})\n\nAprès.`)
    expect(quote).not.toContain("&gt;")
    expect(quote).not.toMatch(/<p>>/)
    expect(blocks(quote)).toEqual(["<p>Avant.</p>", "<p>Après.</p>"])
  })

  it("image cliquable [![…](…)](lien) : retirée avec son lien, rien ne reste", () => {
    const html = markdownToHtml(`Avant.\n\n[![Photo](${IMG})](https://exemple.fr)\n\nAprès.`)
    expect(html).not.toContain("[](")
    expect(html).not.toContain("exemple.fr")
    expect(blocks(html)).toEqual(["<p>Avant.</p>", "<p>Après.</p>"])
  })

  it("bloc de code sur une seule ligne : son contenu n'est jamais retiré", () => {
    const html = markdownToHtml(`\`\`\`\n![x](${IMG})\n\`\`\``)
    expect(html).not.toContain("<img")
    expect(html).not.toContain("<figure")
    expect(html).toMatch(/^<pre><code>!.+<\/code><\/pre>$/)
  })

  it("une esperluette dans l'adresse est encodée dans l'attribut", () => {
    const html = markdownToHtml(`![x](${IMG}?v=1&t=2#w=10&h=5)`)
    expect(html).toContain(`src="${IMG}?v=1&amp;t=2"`)
    expect(html).toContain('width="10" height="5"')
  })
})

describe("tableaux GFM", () => {
  const TABLE = ["| Poste | Prix HT |", "|---|---|", "| Dépose | 120 € |", "| Pose | 480 € |"].join("\n")

  it("tableau simple : en-tête, corps, une seule ligne de HTML, jamais dans un <p>", () => {
    const html = markdownToHtml(`Le détail :\n\n${TABLE}\n\nFin.`)
    const table = "<table><thead><tr><th>Poste</th><th>Prix HT</th></tr></thead><tbody><tr><td>Dépose</td><td>120 €</td></tr><tr><td>Pose</td><td>480 €</td></tr></tbody></table>"
    expect(blocks(html)).toEqual(["<p>Le détail :</p>", table, "<p>Fin.</p>"])
    expect(table).not.toContain("\n")
  })

  it("tableau collé au paragraphe qui le précède : son propre bloc", () => {
    const html = markdownToHtml(`Le détail :\n${TABLE}`)
    expect(blocks(html)[0]).toBe("<p>Le détail :</p>")
    expect(blocks(html)[1]).toMatch(/^<table>/)
  })

  it("alignements : gauche, centre, droite, aucun", () => {
    const html = markdownToHtml(["| A | B | C | D |", "|:--|:-:|--:|---|", "| 1 | 2 | 3 | 4 |"].join("\n"))
    expect(html).toContain('<th style="text-align:left">A</th><th style="text-align:center">B</th><th style="text-align:right">C</th><th>D</th>')
    expect(html).toContain('<td style="text-align:left">1</td><td style="text-align:center">2</td><td style="text-align:right">3</td><td>4</td>')
  })

  it("barre échappée : barre littérale dans la cellule", () => {
    const html = markdownToHtml(["| Formule | Résultat |", "| --- | --- |", "| a \\| b | ok |"].join("\n"))
    expect(html).toContain("<td>a | b</td><td>ok</td>")
  })

  it("gras, italique, code et liens dans les cellules", () => {
    const html = markdownToHtml(["| Taux | Source |", "|---|---|", "| **10 %** et *5,5 %* | [BOFiP](https://bofip.impots.gouv.fr) `279-0 bis` |"].join("\n"))
    expect(html).toContain("<td><strong>10 %</strong> et <em>5,5 %</em></td>")
    expect(html).toContain('<a href="https://bofip.impots.gouv.fr" target="_blank" rel="noopener noreferrer">BOFiP</a> <code>279-0 bis</code>')
  })

  it("astérisques seuls dans deux cellules : jamais un italique à cheval sur deux cellules", () => {
    const html = markdownToHtml(["| Calcul | Autre |", "|---|---|", "| 5 * 3 | 2 * 4 |"].join("\n"))
    expect(html).toContain("<td>5 &#42; 3</td><td>2 &#42; 4</td>")
    expect(html).not.toContain("<em>")
    // Accent grave seul : pas de <code> qui déborderait sur la cellule voisine
    const code = markdownToHtml(["| a | b |", "|---|---|", "| `x | y` |"].join("\n"))
    expect(code).toContain("<td>&#96;x</td><td>y&#96;</td>")
  })

  it("sans barres de bord, cellules manquantes complétées, sans corps", () => {
    expect(markdownToHtml("a | b\n--- | ---\n1 |")).toBe(
      "<table><thead><tr><th>a</th><th>b</th></tr></thead><tbody><tr><td>1</td><td></td></tr></tbody></table>",
    )
    expect(markdownToHtml("| a | b |\n|---|---|")).toBe("<table><thead><tr><th>a</th><th>b</th></tr></thead></table>")
  })

  it("pas un tableau : nombre de colonnes différent, filet seul, barre dans une phrase", () => {
    expect(markdownToHtml("| a | b |\n|---|")).not.toContain("<table")
    expect(markdownToHtml("Prix | quantité\n---")).not.toContain("<table")
    expect(markdownToHtml("Choisissez A | B selon le chantier.")).toBe("<p>Choisissez A | B selon le chantier.</p>")
  })

  it("le tableau s'arrête à la ligne vide ou à une ligne sans barre", () => {
    const html = markdownToHtml(["| a | b |", "|---|---|", "| 1 | 2 |", "Suite du texte."].join("\n"))
    expect(blocks(html)).toEqual([
      "<table><thead><tr><th>a</th><th>b</th></tr></thead><tbody><tr><td>1</td><td>2</td></tr></tbody></table>",
      "<p>Suite du texte.</p>",
    ])
  })
})

describe("rien de cassé", () => {
  it("HTML brut existant inchangé (tableau des anciens articles, bloc div)", () => {
    const raw = "<table><tbody><tr><td>Acompte</td><td>30 %</td></tr></tbody></table>"
    expect(markdownToHtml(raw)).toBe(raw)
    expect(markdownToHtml('<div class="note">Texte</div>')).toBe('<div class="note">Texte</div>')
  })

  it("titres, listes, citation, liens, séparateur", () => {
    const html = markdownToHtml(
      [
        "## Les mentions obligatoires",
        "",
        "- Numéro de facture",
        "- Date d'émission",
        "",
        "1. Première étape",
        "2. Seconde étape",
        "",
        "> Une citation",
        "",
        "---",
        "",
        "Voir [le guide](/guide/mentions-obligatoires-facture).",
      ].join("\n"),
    )
    expect(html).toContain('<h2 id="les-mentions-obligatoires">Les mentions obligatoires</h2>')
    expect(html).toContain("<ul>\n<li>Numéro de facture</li>\n<li>Date d'émission</li>\n</ul>")
    expect(html).toContain("<ol>\n<li>Première étape</li>\n<li>Seconde étape</li>\n</ol>")
    expect(html).toContain("<blockquote><p>Une citation</p></blockquote>")
    expect(html).toContain("<hr />")
    expect(html).toContain('<a href="/guide/mentions-obligatoires-facture" target="_blank" rel="noopener noreferrer">le guide</a>')
  })

  it("code en ligne : la syntaxe d'une image n'est pas retirée (le code garde son contenu, comme avant les images)", () => {
    // Rendu d'avant les images : le lien du code devient son texte, rien ne disparaît
    expect(markdownToHtml("Utilisez `![alt](url)` dans le texte")).toBe("<p>Utilisez <code>!alt</code> dans le texte</p>")
    expect(markdownToHtml("Le code `![](x)` seul")).toBe("<p>Le code <code>![](x)</code> seul</p>")
    // Hors du code, l'image dans une phrase reste retirée
    expect(markdownToHtml("- `![](b)` puis ![photo](https://x/y.jpg)")).toBe("<ul>\n<li><code>![](b)</code> puis</li>\n</ul>")
    expect(markdownToHtml("| Syntaxe |\n|---|\n| `![](y)` |")).toContain("<td><code>![](y)</code></td>")
  })

  it("bloc de code : ni tableau ni image interprétés", () => {
    const html = markdownToHtml(["```", "| a | b |", "|---|---|", `![x](${IMG})`, "```"].join("\n"))
    expect(html).not.toContain("<table")
    expect(html).not.toContain("<img")
    expect(html).toContain("<pre><code>| a | b |")
  })

  it("liens toujours sûrs", () => {
    const html = markdownToHtml("[a](javascript:alert(1)) [b](https://x.fr)")
    expect(html).not.toContain("javascript:")
    expect(html).toContain('href="https://x.fr"')
  })
})
