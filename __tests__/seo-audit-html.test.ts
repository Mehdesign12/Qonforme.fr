/**
 * Audit du site : lecture d'une page HTML (title, description, H1, canonique,
 * robots, liens internes, mots) et du plan du site, défauts d'une page.
 */
import { describe, expect, it } from "vitest"
import { countWords, internalLinkPath, isNoindex, parseAttributes, parseHtml, textLength } from "@/lib/seo/audit/html"
import { parseSitemap, sitePathsOf } from "@/lib/seo/audit/sitemap"
import { pageIssues } from "@/lib/seo/audit/checks"

const PAGE = `<!DOCTYPE html><html lang="fr"><head>
<meta charset="utf-8">
<title>Modèle de devis et de facture gratuit, prêt à remplir | Qonforme</title>
<meta content="Téléchargez un modèle de devis &amp; de facture aux mentions obligatoires, prêt à remplir en ligne puis à envoyer à vos clients en PDF." name="description"/>
<meta name='robots' content='index, follow, max-image-preview:none'>
<link rel="canonical" href="/modele">
<link rel="icon" href="/favicon.ico">
</head><body>
<svg><title>Icône</title></svg>
<header><a href="/">Accueil</a><a href="https://qonforme.fr/pricing?ref=nav#tarifs">Tarifs</a></header>
<main>
<h1 class="q-h1">Modèle de <em>devis</em> gratuit</h1>
<p>Un devis clair, en trois minutes.</p>
<script>var x = "ceci n'est pas du texte";</script>
<a href="/guide/mentions-obligatoires-devis">Mentions</a>
<a href="/guide/mentions-obligatoires-devis/">Mentions (doublon)</a>
<a href="https://www.qonforme.fr/outils/">Outils</a>
<a href="https://exemple.fr/ailleurs">Ailleurs</a>
<a href="mailto:contact@qonforme.fr">Écrire</a>
<a href="#haut">Haut</a>
<a href="/modele">Cette page</a>
<a href="/_next/static/chunk.js">fichier</a>
<a href="/docs/guide.pdf">PDF</a>
<a href="relative">Relatif</a>
</main>
<footer><h2>Pied</h2></footer>
</body></html>`

describe("lecture d'une page HTML", () => {
  const p = parseHtml(PAGE, "/modele")

  it("relève title, description (entités décodées), robots et canonique absolue", () => {
    expect(p.title).toBe("Modèle de devis et de facture gratuit, prêt à remplir | Qonforme")
    expect(p.description).toBe(
      "Téléchargez un modèle de devis & de facture aux mentions obligatoires, prêt à remplir en ligne puis à envoyer à vos clients en PDF.",
    )
    expect(p.robots).toBe("index, follow, max-image-preview:none")
    expect(p.noindex).toBe(false) // « max-image-preview:none » n'est pas un noindex
    expect(p.canonical).toBe("https://qonforme.fr/modele")
  })

  it("compte les H1 et lit le texte du premier, sans le <title> d'un SVG", () => {
    expect(p.h1Count).toBe(1)
    expect(p.h1).toBe("Modèle de devis gratuit")
  })

  it("garde les liens internes du site, sans doublon, sans la page elle-même ni les fichiers du framework", () => {
    // Un PDF du site reste un lien à vérifier ; /_next/ et les images non.
    expect(p.internalLinks).toEqual(["/", "/docs/guide.pdf", "/guide/mentions-obligatoires-devis", "/outils", "/pricing", "/relative"])
  })

  it("compte les mots du contenu principal (<main>) sans les scripts", () => {
    expect(p.wordCount).toBe(countWords("Modèle de devis gratuit Un devis clair, en trois minutes. Mentions Mentions (doublon) Outils Ailleurs Écrire Haut Cette page fichier PDF Relatif"))
  })

  it("repère le noindex de l'en-tête X-Robots-Tag et de meta googlebot", () => {
    expect(parseHtml("<html><head><title>x</title></head><body></body></html>", "/x", { xRobotsTag: "noindex" }).noindex).toBe(true)
    expect(parseHtml('<head><meta name="googlebot" content="noindex,follow"></head>', "/x").noindex).toBe(true)
    expect(isNoindex("none")).toBe(true)
    expect(isNoindex("index, follow")).toBe(false)
  })

  it("rend des valeurs absentes plutôt que des chaînes vides", () => {
    const empty = parseHtml("<html><head><title>  </title></head><body><h1>A</h1><h1>B</h1></body></html>", "/vide")
    expect(empty.title).toBeNull()
    expect(empty.description).toBeNull()
    expect(empty.canonical).toBeNull()
    expect(empty.h1Count).toBe(2)
  })

  it("lit les attributs entre guillemets simples, doubles ou sans guillemets", () => {
    expect(parseAttributes(`<meta name=description content='a "b"' data-x="1">`)).toEqual({ name: "description", content: 'a "b"', "data-x": "1" })
  })

  it("résout les liens relatifs et écarte ce qui n'est pas une page du site", () => {
    expect(internalLinkPath("../guide", "/modele/devis-travaux")).toBe("/guide")
    expect(internalLinkPath("//evil.example/x", "/")).toBeNull()
    expect(internalLinkPath("javascript:alert(1)", "/")).toBeNull()
    expect(internalLinkPath("/api/og?title=x", "/")).toBeNull()
    expect(internalLinkPath("/logo.png", "/")).toBeNull()
  })

  it("compte les caractères affichés, pas les unités UTF-16", () => {
    expect(textLength("Devis 🧱")).toBe(7)
  })
})

describe("plan du site", () => {
  it("lit un urlset (CDATA, entités) et ne garde que les pages de qonforme.fr", () => {
    const xml = `<?xml version="1.0"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
      <url><loc>https://qonforme.fr</loc></url>
      <url><loc><![CDATA[https://qonforme.fr/modele]]></loc></url>
      <url><loc>https://qonforme.fr/blog/a?x=1&amp;y=2</loc></url>
      <url><loc>https://qonforme.fr/modele/</loc></url>
      <url><loc>https://exemple.fr/page</loc></url>
    </urlset>`
    const parsed = parseSitemap(xml)
    expect(parsed.kind).toBe("urlset")
    expect(sitePathsOf(parsed.locs)).toEqual(["/", "/modele", "/blog/a"])
  })

  it("reconnaît un index de plans du site", () => {
    const parsed = parseSitemap(`<sitemapindex><sitemap><loc>https://qonforme.fr/sitemap-1.xml</loc></sitemap></sitemapindex>`)
    expect(parsed).toEqual({ kind: "index", locs: ["https://qonforme.fr/sitemap-1.xml"] })
  })
})

describe("défauts d'une page", () => {
  const base = parseHtml(PAGE, "/modele")

  it("une page saine n'a aucun défaut", () => {
    expect(pageIssues({ path: "/modele", status: 200, html: true, parsed: base })).toEqual([])
  })

  it("title trop long, description hors bornes, H1 multiples, canonique vers une autre page", () => {
    const parsed = {
      ...base,
      title: "x".repeat(71),
      description: "Trop courte.",
      h1Count: 2,
      canonical: "https://qonforme.fr/autre",
    }
    expect(pageIssues({ path: "/modele", status: 200, html: true, parsed })).toEqual([
      "title_too_long",
      "description_short",
      "h1_multiple",
      "canonical_other",
    ])
    expect(pageIssues({ path: "/modele", status: 200, html: true, parsed: { ...base, description: "y".repeat(156) } })).toEqual(["description_long"])
    expect(pageIssues({ path: "/modele", status: 200, html: true, parsed: { ...base, title: "x".repeat(70), description: "y".repeat(155) } })).toEqual([])
  })

  it("erreur, redirection et noindex priment sur les contrôles de contenu", () => {
    expect(pageIssues({ path: "/a", status: null, error: "Pas de réponse en 15 s", parsed: null })).toEqual(["fetch_failed"])
    expect(pageIssues({ path: "/a", status: 404, parsed: null })).toEqual(["http_error"])
    expect(pageIssues({ path: "/a", status: 308, parsed: null })).toEqual(["redirect"])
    expect(pageIssues({ path: "/modele", status: 200, html: true, parsed: { ...base, noindex: true, title: null } })).toEqual(["noindex"])
  })
})
