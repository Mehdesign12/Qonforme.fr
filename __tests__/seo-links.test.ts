import { beforeEach, describe, expect, it, vi } from "vitest"
import { NextRequest } from "next/server"
import { foldPlain, foldWithMap, topicTokens, wordCount } from "@/lib/seo/links/text"
import {
  applyProposals,
  cleanInternalLinks,
  internalLinksOf,
  internalPathOf,
  linkGoal,
  linkStats,
  proposeLinks,
  rankRelated,
  relatedBlock,
  topUpLinks,
  type LinkCandidate,
} from "@/lib/seo/links/engine"
import { articleCandidates, linkTargetsOf, staticLinkCandidates, validLinkPaths } from "@/lib/seo/links/catalog"
import { linkGuideLines } from "@/lib/seo/articles/prompt"
import { markdownToHtml } from "@/lib/markdown"
import { fakeArticlesDb, type FakeArticlesDb } from "./seo-articles-fake-db"
import { POST as autoLinksRoute } from "@/app/api/admin/blog/auto-links/route"
import { GET as linkTargetsRoute } from "@/app/api/admin/blog/link-targets/route"

/* ------------------------------------------------------------------ */
/* Modules simulés                                                     */
/* ------------------------------------------------------------------ */

let db: FakeArticlesDb
let admin = true
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => db.client, createAdminClient: () => db.client }))
vi.mock("@/lib/admin-require", () => ({ isAdminAuthenticated: async () => admin }))

beforeEach(() => {
  db = fakeArticlesDb({ blog_posts: [] })
  admin = true
})

const cand = (over: Partial<LinkCandidate> & { path: string }): LinkCandidate => ({
  title: over.path,
  kind: "guide",
  phrases: [],
  topics: [],
  weight: 5,
  ...over,
})

/* ------------------------------------------------------------------ */
/* Texte                                                               */
/* ------------------------------------------------------------------ */

describe("maillage · texte", () => {
  it("plie sans accents ni casse et garde la correspondance des positions", () => {
    const original = "Les Mentions obligatoires d’un DEVIS — œuvre"
    const f = foldWithMap(original)
    expect(f.text).toBe("les mentions obligatoires d'un devis — oeuvre")
    // Chaque caractère plié renvoie à sa position d'origine
    const at = f.text.indexOf("obligatoires")
    expect(original.slice(f.map[at], f.map[at + "obligatoires".length])).toBe("obligatoires")
    const devis = f.text.indexOf("devis")
    expect(original.slice(f.map[devis], f.map[devis + 5])).toBe("DEVIS")
    expect(f.map[f.text.length]).toBe(original.length)
    expect(foldPlain("  Élève   à  l’école ")).toBe("eleve a l'ecole")
  })

  it("mots significatifs : sans mots vides ni pluriel, accents pliés", () => {
    expect(topicTokens("Les mentions obligatoires d'un devis de plomberie")).toEqual(["mention", "obligatoire", "devis", "plomberie"])
    expect(topicTokens("Comment faire une facture ?")).toEqual(["facture"])
  })

  it("compte les mots lus : liens, titres, listes et code ne comptent pas leur syntaxe", () => {
    const md = "## Titre de section\n\n- un point [guide complet](/guide/x) ici\n\n![photo du chantier](https://x/y.webp)\n\n```\ncode ignoré\n```\n\nDeux mots."
    expect(wordCount(md)).toBe(3 + 5 + 2)
  })

  it("objectif de liens selon la longueur", () => {
    expect(linkGoal(300)).toEqual({ min: 2, goal: 3, max: 4 })
    expect(linkGoal(1200)).toEqual({ min: 3, goal: 5, max: 6 })
    expect(linkGoal(1800)).toEqual({ min: 4, goal: 7, max: 9 })
    expect(linkGoal(5000)).toEqual({ min: 5, goal: 8, max: 10 })
  })
})

/* ------------------------------------------------------------------ */
/* Liens existants                                                     */
/* ------------------------------------------------------------------ */

describe("maillage · liens existants", () => {
  it("chemin d'une adresse interne, adresse complète du site comprise", () => {
    expect(internalPathOf("/guide/tva-travaux#taux")).toBe("/guide/tva-travaux")
    expect(internalPathOf("https://qonforme.fr/guide/tva-travaux/")).toBe("/guide/tva-travaux")
    expect(internalPathOf("https://www.qonforme.fr")).toBe("/")
    expect(internalPathOf("https://service-public.gouv.fr/x")).toBeNull()
    expect(internalPathOf("//autre.fr/x")).toBeNull()
    expect(internalPathOf("#ancre")).toBeNull()
    expect(internalPathOf("/")).toBe("/")
  })

  it("compte les liens internes, jamais les images ni les liens externes", () => {
    const md = "Voir [le guide](/guide/a) et [BOFiP](https://bofip.impots.gouv.fr/x), ![alt](/img.png) puis [modèle](https://qonforme.fr/modele/b)."
    expect(internalLinksOf(md).map((l) => l.path)).toEqual(["/guide/a", "/modele/b"])
    expect(linkStats(md)).toMatchObject({ internal: 2, external: 1 })
  })

  it("retire les liens vers une page inconnue, ramène l'adresse complète au chemin, délie les titres", () => {
    const valid = new Set(["/guide/a", "/modele/b"])
    const md = ["## Voir [le guide](/guide/a)", "", "Lire [un texte inventé](/guide/inconnu), [le modèle](https://qonforme.fr/modele/b) et [le guide](/guide/a#x).", "", "```", "[code](/guide/inconnu)", "```"].join("\n")
    const out = cleanInternalLinks(md, valid)
    expect(out.markdown).toContain("## Voir le guide")
    expect(out.markdown).toContain("Lire un texte inventé, [le modèle](/modele/b) et [le guide](/guide/a#x).")
    expect(out.markdown).toContain("[code](/guide/inconnu)")
    expect(out.removed.sort()).toEqual(["/guide/a", "/guide/inconnu"])
    expect(out.fixed).toBe(1)
  })
})

/* ------------------------------------------------------------------ */
/* Propositions                                                        */
/* ------------------------------------------------------------------ */

const DEVIS = cand({ path: "/guide/mentions-obligatoires-devis", title: "Mentions d'un devis", phrases: ["mentions obligatoires d'un devis", "que doit contenir un devis"], topics: ["mention", "obligatoire", "devis"] })
const TVA = cand({ path: "/guide/tva-travaux", title: "TVA des travaux", phrases: [/taux\s+de\s+TVA\s+des\s+travaux/i], topics: ["tva", "travaux", "taux"] })
const GLOSS = cand({ path: "/glossaire/franchise-tva", title: "Franchise de TVA", kind: "glossaire", weight: 2, phrases: ["franchise en base de tva", "franchise de tva"], topics: ["franchise", "tva"] })

const ARTICLE = [
  "Un devis clair rassure le client. Rappelez les mentions obligatoires d'un devis avant la signature.",
  "",
  "## Choisir le bon taux",
  "",
  "Appliquez le taux de TVA des travaux adapté au chantier.",
  "",
  "Pensez aussi à la franchise de TVA si vous y êtes.",
  "",
  "## Les mentions obligatoires d'un devis",
  "",
  "- une ligne avec les mentions obligatoires d'un devis ;",
  "- une autre ligne.",
  "",
  "> Citation : taux de TVA des travaux",
  "",
  "| Taux | Cas |",
  "| --- | --- |",
  "| taux de TVA des travaux | 10 % |",
].join("\n")

describe("maillage · propositions", () => {
  it("pose un lien par page sur un texte qui existe, sans toucher aux titres, citations ni tableaux", () => {
    const proposals = proposeLinks(ARTICLE, [DEVIS, TVA, GLOSS], { target: 5, keyword: "devis plombier" })
    expect(proposals.map((p) => [p.path, p.anchor])).toEqual([
      ["/guide/mentions-obligatoires-devis", "mentions obligatoires d'un devis"],
      ["/guide/tva-travaux", "taux de TVA des travaux"],
      ["/glossaire/franchise-tva", "franchise de TVA"],
    ])
    // Première occurrence du texte (introduction), pas le titre « ## Les mentions… » ni la puce
    expect(proposals[0].line).toBe(0)
    expect(proposals[0].before).toMatch(/Rappelez les $/)
    const out = applyProposals(ARTICLE, proposals)
    expect(out).toContain("Rappelez les [mentions obligatoires d'un devis](/guide/mentions-obligatoires-devis) avant")
    expect(out).toContain("## Les mentions obligatoires d'un devis\n")
    expect(out).toContain("> Citation : taux de TVA des travaux")
    expect(out).toContain("| taux de TVA des travaux | 10 % |")
    // Le reste du texte ne change pas d'un caractère
    expect(out.replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")).toBe(ARTICLE)
  })

  it("ne lie ni la page elle-même, ni une page déjà liée, ni une page qui vise le même mot-clé", () => {
    const md = "Lisez [le guide](/guide/tva-travaux). Le taux de TVA des travaux compte, comme la franchise de TVA et les mentions obligatoires d'un devis."
    const same = cand({ path: "/blog/autre", kind: "article", phrases: ["franchise de TVA"], keyword: "Devis  Plombier" })
    const out = proposeLinks(md, [DEVIS, TVA, GLOSS, same], { target: 6, selfPath: "/guide/mentions-obligatoires-devis", keyword: "devis plombier" })
    expect(out.map((p) => p.path)).toEqual(["/glossaire/franchise-tva"])
  })

  it("jamais le mot-clé principal de l'article comme ancre d'une autre page", () => {
    const md = "Votre franchise de TVA change tout pour vos devis."
    expect(proposeLinks(md, [GLOSS], { target: 3, keyword: "franchise de tva" })).toEqual([])
    expect(proposeLinks(md, [GLOSS], { target: 3, keyword: "devis plombier" })).toHaveLength(1)
  })

  it("s'arrête à l'objectif, liens existants comptés", () => {
    const md = "Voir [un guide](/guide/x). Les mentions obligatoires d'un devis, le taux de TVA des travaux et la franchise de TVA sont à connaître, répartis sur plusieurs phrases très longues pour tenir à distance."
    expect(proposeLinks(md, [DEVIS, TVA, GLOSS], { target: 1 })).toEqual([])
    expect(proposeLinks(md, [DEVIS, TVA, GLOSS], { target: 2 })).toHaveLength(1)
  })

  it("deux liens au plus par paragraphe et à distance l'un de l'autre", () => {
    const close = "Les mentions obligatoires d'un devis et le taux de TVA des travaux se suivent."
    expect(proposeLinks(close, [DEVIS, TVA], { target: 5 })).toHaveLength(1)
    const far = `Les mentions obligatoires d'un devis comptent. ${"Un texte intermédiaire sans lien possible, assez long pour séparer les deux ancres. ".repeat(2)}Puis le taux de TVA des travaux.`
    expect(proposeLinks(far, [DEVIS, TVA], { target: 5 })).toHaveLength(2)
  })

  it("répartit les liens : deux par section, une troisième seulement si le compte n'est pas atteint", () => {
    const section = (n: number) => `## Section ${n}\n\nLes mentions obligatoires d'un devis, puis un long texte de séparation qui évite la proximité entre deux ancres dans le même paragraphe, puis le taux de TVA des travaux, puis la franchise de TVA.`
    const md = [section(1), section(2)].join("\n\n")
    const many = [DEVIS, TVA, GLOSS, cand({ path: "/guide/d", phrases: ["devis obligatoire"] })]
    const proposals = proposeLinks(md, many, { target: 3 })
    expect(proposals).toHaveLength(3)
    const bySection = proposals.reduce<Record<number, number>>((acc, p) => ({ ...acc, [p.section]: (acc[p.section] ?? 0) + 1 }), {})
    expect(Math.max(...Object.values(bySection))).toBeLessThanOrEqual(2)
  })

  it("ne pose rien dans un lien, du code en ligne, une image ni une ancre qui casserait le Markdown", () => {
    const md = "Voir `les mentions obligatoires d'un devis`, ![les mentions obligatoires d'un devis](/i.png), [les mentions obligatoires d'un devis](https://x.fr) et **les mentions obligatoires d'un devis** (gras)."
    const out = proposeLinks(md, [DEVIS], { target: 3 })
    // Seule l'occurrence en gras est du texte libre : le lien se pose dedans, sans casser les marques
    expect(out).toHaveLength(1)
    expect(applyProposals(md, out)).toContain("**les [mentions obligatoires d'un devis](/guide/mentions-obligatoires-devis)**")
  })

  it("pluriels et accents : « Mention obligatoire » se lie dans « mentions obligatoires »", () => {
    const g = cand({ path: "/guide/m", phrases: ["mention obligatoire devis"] })
    const out = proposeLinks("Les Mentions Obligatoires Devis figurent en haut.", [g], { target: 2 })
    expect(out[0]?.anchor).toBe("Mentions Obligatoires Devis")
  })

  it("choisit d'abord la page la plus proche du sujet", () => {
    const a = cand({ path: "/guide/a", phrases: ["facture d'acompte"], topics: ["acompte", "facture"] })
    const b = cand({ path: "/guide/b", phrases: ["facture impayée"], topics: ["impaye", "relance", "facture"] })
    const md = "Une facture d'acompte se règle vite.\n\nUne facture impayée se relance sans attendre."
    const out = proposeLinks(md, [a, b], { target: 4 + 1 - 4, topic: "relance facture impayée" })
    expect(out.map((p) => p.path)).toEqual(["/guide/b"])
  })

  it("une ancre d'un seul mot court est refusée", () => {
    const g = cand({ path: "/glossaire/cgv", phrases: ["cgv"] })
    expect(proposeLinks("Joignez vos CGV au devis.", [g], { target: 2 })).toEqual([])
  })

  it("ne lie pas un texte qui n'existe pas : liste vide", () => {
    expect(proposeLinks("Un texte sans rapport.", [DEVIS, TVA], { target: 5 })).toEqual([])
  })
})

/* ------------------------------------------------------------------ */
/* Pages proches, bloc, complément                                     */
/* ------------------------------------------------------------------ */

describe("maillage · pages proches et complément", () => {
  const pages = [
    cand({ path: "/guide/tva-travaux", title: "TVA des travaux", topics: ["tva", "travaux", "taux"] }),
    cand({ path: "/guide/facture-impayee", title: "Facture impayée", topics: ["facture", "impaye", "relance"] }),
    cand({ path: "/modele/devis-travaux", title: "Modèle de devis travaux", kind: "modele", topics: ["devis", "travaux", "modele"] }),
    cand({ path: "/blog/meme-mot-cle", title: "Même mot-clé", kind: "article", topics: ["tva", "travaux"], keyword: "tva travaux" }),
    cand({ path: "/glossaire/devis", title: "Devis", kind: "glossaire", weight: 2, topics: ["devis"] }),
  ]

  it("classe par proximité, varie les types, écarte la page qui vise le même mot-clé", () => {
    const out = rankRelated("Quel taux de TVA pour des travaux", pages, { limit: 5, keyword: "TVA travaux" })
    expect(out[0].path).toBe("/guide/tva-travaux")
    expect(out.map((c) => c.path)).not.toContain("/blog/meme-mot-cle")
    expect(rankRelated("zzz", pages, { limit: 5 })).toEqual([])
    expect(rankRelated("tva travaux", pages, { limit: 5, exclude: ["/guide/tva-travaux"] }).map((c) => c.path)).not.toContain("/guide/tva-travaux")
    // Pas plus de pages d'un même type que prévu
    const guides = Array.from({ length: 12 }, (_, i) => cand({ path: `/guide/g${i}`, topics: ["tva"] }))
    expect(rankRelated("tva", guides, { limit: 20 }).length).toBe(6)
  })

  it("bloc « Pour aller plus loin » : les pages les plus proches, jamais une page déjà liée ni deux fois le bloc", () => {
    const md = "Texte avec [un lien](/guide/tva-travaux)."
    const block = relatedBlock(md, pages, { count: 2, topic: "tva travaux facture impayée relance", selfPath: "/blog/x" })
    expect(block).toContain("## Pour aller plus loin")
    expect(block).toContain("- [Facture impayée](/guide/facture-impayee)")
    expect(block).not.toContain("/guide/tva-travaux")
    expect(relatedBlock(`${md}\n\n## Pour aller plus loin\n\n- [x](/y)`, pages, { count: 2, topic: "tva" })).toBeNull()
    expect(relatedBlock(md, pages, { count: 0, topic: "tva" })).toBeNull()
  })

  it("complète jusqu'à l'objectif, puis ajoute le bloc seulement sous le minimum", () => {
    const text = `${"Mot ".repeat(520)}Les mentions obligatoires d'un devis sont à connaître.\n\nUn autre paragraphe sur le taux de TVA des travaux, avec ${"du texte ".repeat(30)}fin.`
    const goal = linkGoal(wordCount(text))
    const full = topUpLinks(text, [DEVIS, TVA, GLOSS, ...pages], { topic: "devis tva travaux", allowRelatedBlock: true })
    expect(full.before).toBe(0)
    expect(full.added.map((p) => p.path)).toEqual(["/guide/mentions-obligatoires-devis", "/guide/tva-travaux"])
    // Deux liens sous le minimum de 2 à 4 pour ce texte (goal.min) : le bloc complète si besoin
    expect(full.after).toBe(full.added.length + full.relatedAdded)
    expect(full.goal).toEqual(goal)
    expect(topUpLinks(text, [], { topic: "x", allowRelatedBlock: false })).toMatchObject({ added: [], relatedAdded: 0, after: 0 })
    const withBlock = topUpLinks("Texte court sans expression à lier.", pages, { topic: "tva travaux", allowRelatedBlock: true })
    expect(withBlock.markdown).toContain("## Pour aller plus loin")
    expect(withBlock.relatedAdded).toBeGreaterThan(0)
    expect(topUpLinks("Texte court sans expression à lier.", pages, { topic: "tva travaux" }).relatedAdded).toBe(0)
  })
})

/* ------------------------------------------------------------------ */
/* Catalogue                                                           */
/* ------------------------------------------------------------------ */

describe("maillage · catalogue", () => {
  const all = staticLinkCandidates()
  const byPath = new Map(all.map((c) => [c.path, c]))

  it("couvre les guides, modèles, métiers, installations, glossaire, outils et pages principales, chacun une fois", () => {
    expect(new Set(all.map((c) => c.path)).size).toBe(all.length)
    const kinds = new Set(all.map((c) => c.kind))
    expect(Array.from(kinds).sort()).toEqual(["glossaire", "guide", "installation", "metier", "modele", "outil", "page"])
    expect(byPath.get("/guide/comment-faire-un-devis")?.kind).toBe("guide")
    expect(byPath.get("/outils/calculateur-beton")?.kind).toBe("outil")
    expect(byPath.get("/facturation/plombier")?.phrases).toContain("logiciel de devis pour plombier")
    expect(all[0].path).toBe("/")
  })

  it("les expressions écrites à la main restent liées à leur page", () => {
    const md = ["Pour faire une facture, lisez la suite.", "", "Regardez le taux de TVA des travaux avant de chiffrer.", "", "Choisissez la plateforme agréée de votre choix."].join("\n")
    const out = proposeLinks(md, all, { target: 5 })
    const paths = out.map((p) => p.path)
    expect(paths).toContain("/guide/premiere-facture")
    expect(paths).toContain("/guide/tva-travaux")
    expect(paths).toContain("/guide/plateforme-agreee")
  })

  it("aucune expression n'est un mot court ou générique", () => {
    for (const c of all) {
      for (const p of c.phrases) {
        if (typeof p !== "string") continue
        const words = p.trim().split(/\s+/)
        if (words.length === 1) expect(p.trim().length).toBeGreaterThanOrEqual(7)
        expect(["facture", "devis", "faire un devis", "faire une facture"]).not.toContain(p.trim().toLowerCase())
      }
    }
  })

  it("articles publiés : mot-clé et mots-clés de plus de deux mots comme ancres", () => {
    const list = articleCandidates([
      { slug: "relance-mail", title: "Relance par mail", target_keyword: "relance facture impayée mail", ai_keywords: ["relance", "modèle de relance de facture", "lettre de relance"] },
      { slug: null, title: "Sans adresse" },
      { slug: "x", title: null },
    ])
    expect(list).toHaveLength(1)
    expect(list[0]).toMatchObject({ path: "/blog/relance-mail", kind: "article", keyword: "relance facture impayée mail" })
    // Mot-clé principal, puis les deux premiers mots-clés du modèle quand ils font deux mots ou plus
    expect(list[0].phrases).toEqual(["relance facture impayée mail", "modèle de relance de facture"])
  })

  it("chemins valides et entrées de la fenêtre « Lien »", () => {
    const valid = validLinkPaths(all)
    expect(valid.has("/pricing")).toBe(true)
    expect(valid.has("/guide/tva-travaux")).toBe(true)
    expect(valid.has("/guide/inventé")).toBe(false)
    const targets = linkTargetsOf([...articleCandidates([{ slug: "a", title: "Article A" }]), ...all])
    expect(targets[0]).toEqual({ title: "Article A", path: "/blog/a", kind: "article" })
    expect(targets[1].path).toBe("/")
    expect(new Set(targets.map((t) => t.path)).size).toBe(targets.length)
  })
})

/* ------------------------------------------------------------------ */
/* Consigne du rédacteur                                               */
/* ------------------------------------------------------------------ */

describe("maillage · consigne du rédacteur", () => {
  it("demande un nombre de liens, des pages précises et des ancres naturelles", () => {
    const lines = linkGuideLines({ min: 4, max: 7, pages: [{ path: "/guide/tva-travaux", title: "TVA des travaux", anchors: ["taux de tva des travaux", "tva travaux"] }, { path: "/outils/calculateur-tva", title: "Calculateur de TVA", anchors: [] }] }).join("\n")
    expect(lines).toContain("entre 4 et 7 liens")
    expect(lines).toContain("- /guide/tva-travaux : TVA des travaux (ancres possibles : « taux de tva des travaux », « tva travaux »)")
    expect(lines).toContain("- /outils/calculateur-tva : Calculateur de TVA")
    expect(lines).toMatch(/n'inventez aucune adresse interne/)
    expect(lines).toMatch(/jamais « cliquez ici »/)
    expect(lines).toMatch(/jamais dans un titre/)
  })
})

/* ------------------------------------------------------------------ */
/* Routes                                                              */
/* ------------------------------------------------------------------ */

const req = (body: unknown) => new NextRequest("http://localhost/api/admin/blog/auto-links", { method: "POST", body: JSON.stringify(body) })

describe("POST /api/admin/blog/auto-links", () => {
  const text = `Rappelez les mentions obligatoires d'un devis. ${"Un long paragraphe de remplissage pour tenir la longueur de l'article. ".repeat(40)}\n\nPuis expliquez le taux de TVA des travaux au client.`

  it("401, 400", async () => {
    admin = false
    expect((await autoLinksRoute(req({ markdown: text }))).status).toBe(401)
    admin = true
    expect((await autoLinksRoute(req({}))).status).toBe(400)
    expect((await autoLinksRoute(req({ markdown: "   " }))).status).toBe(400)
    expect((await autoLinksRoute(req({ markdown: text, slug: "Pas Valide" }))).status).toBe(400)
  })

  it("rend les liens à poser, le texte lié et les compteurs", async () => {
    const res = await autoLinksRoute(req({ markdown: text, title: "Devis de plomberie", keyword: "devis plomberie", slug: "devis-de-plomberie" }))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.before).toBe(0)
    expect(body.proposals.map((p: { path: string }) => p.path)).toEqual(["/guide/mentions-obligatoires-devis", "/guide/tva-travaux"])
    expect(body.proposals[0]).toMatchObject({ anchor: "mentions obligatoires d'un devis", before: "Rappelez les ", section: 0 })
    expect(body.markdown).toContain("[mentions obligatoires d'un devis](/guide/mentions-obligatoires-devis)")
    expect(body.after).toBe(2)
    expect(body.goal.min).toBeGreaterThanOrEqual(2)
    expect(res.headers.get("Cache-Control")).toBe("private, no-store")
  })

  it("un article publié qui vise le même mot-clé n'est pas lié ; ses mots-clés servent d'ancres aux autres", async () => {
    db = fakeArticlesDb({
      blog_posts: [
        { id: "p1", slug: "relance-mail", title: "Relance par mail", is_published: true, published_at: "2026-10-01T00:00:00Z", target_keyword: "relance facture impayée mail", ai_keywords: [] },
        { id: "p2", slug: "meme", title: "Même sujet", is_published: true, published_at: "2026-10-02T00:00:00Z", target_keyword: "devis plomberie", ai_keywords: [] },
        { id: "p3", slug: "brouillon", title: "Brouillon", is_published: false, published_at: null, target_keyword: "lettre de relance client", ai_keywords: [] },
      ],
    })
    const md = `${"Texte de remplissage assez long pour l'objectif. ".repeat(30)}\n\nEnvoyez une relance facture impayée mail le lendemain, puis un devis plomberie propre.`
    const body = await (await autoLinksRoute(req({ markdown: md, keyword: "devis plomberie", slug: "x" }))).json()
    const paths = body.proposals.map((p: { path: string }) => p.path)
    expect(paths).toContain("/blog/relance-mail")
    expect(paths).not.toContain("/blog/meme")
    expect(paths).not.toContain("/blog/brouillon")
  })

  it("rien à lier : liste vide et bloc « Pour aller plus loin » proposé", async () => {
    const md = "Un court texte sur la peinture des volets, sans aucune expression connue du site. ".repeat(6)
    const body = await (await autoLinksRoute(req({ markdown: md, title: "Peindre ses volets", keyword: "peinture volets" }))).json()
    expect(body.proposals).toEqual([])
    expect(body.markdown).toBe(md)
    expect(body.relatedBlock === null || body.relatedBlock.startsWith("## Pour aller plus loin")).toBe(true)
  })

  it("lecture des articles en échec : les pages du site restent liées", async () => {
    db.failing.add("blog_posts")
    vi.spyOn(console, "error").mockImplementation(() => {})
    const res = await autoLinksRoute(req({ markdown: text }))
    expect(res.status).toBe(200)
    expect((await res.json()).proposals.length).toBeGreaterThan(0)
  })
})

describe("GET /api/admin/blog/link-targets", () => {
  it("401, puis les articles publiés avant les pages du site, une entrée par chemin", async () => {
    admin = false
    expect((await linkTargetsRoute()).status).toBe(401)
    admin = true
    db = fakeArticlesDb({ blog_posts: [{ id: "p1", slug: "a", title: "Article A", is_published: true, published_at: "2026-10-01T00:00:00Z" }] })
    const body = await (await linkTargetsRoute()).json()
    expect(body.targets[0]).toEqual({ title: "Article A", path: "/blog/a", kind: "article" })
    expect(body.targets.find((t: { path: string }) => t.path === "/guide/tva-travaux")).toMatchObject({ kind: "guide" })
    expect(new Set(body.targets.map((t: { path: string }) => t.path)).size).toBe(body.targets.length)
  })
})

/* ------------------------------------------------------------------ */
/* Page publique                                                       */
/* ------------------------------------------------------------------ */

describe("maillage · page publique", () => {
  it("un lien interne s'ouvre dans le même onglet, un lien externe garde son nouvel onglet ; l'éditeur ne change pas", () => {
    const md = "Voir [le guide](/guide/tva-travaux), [une ancre](#faq) et [BOFiP](https://bofip.impots.gouv.fr/x) ou [//hôte](//autre.fr)."
    const pub = markdownToHtml(md, { sameTabInternalLinks: true })
    expect(pub).toContain('<a href="/guide/tva-travaux">le guide</a>')
    expect(pub).toContain('<a href="#faq">une ancre</a>')
    expect(pub).toContain('<a href="https://bofip.impots.gouv.fr/x" target="_blank" rel="noopener noreferrer">BOFiP</a>')
    expect(markdownToHtml(md)).toContain('<a href="/guide/tva-travaux" target="_blank" rel="noopener noreferrer">le guide</a>')
  })
})
