/**
 * Placer un mot-clé dans le texte avec l'IA (lib/seo/articles/integrate.ts) :
 * choix des passages, consigne, lecture de la réponse, contrôle des réécritures.
 */
import { describe, expect, it } from "vitest"
import { buildIntegratePrompt, buildProposals, integrationCandidates, MAX_CANDIDATES, parseIntegrateOutput } from "@/lib/seo/articles/integrate"
import { diffWords } from "@/lib/blog-editor/word-diff"

const filler = (n: number) => Array.from({ length: n }, (_, i) => `mot${i}`).join(" ")

const ARTICLE = [
  "# Comment facturer un chantier de plomberie",
  "Facturer un chantier demande de la méthode : acompte, situations et solde, chaque étape se documente pour éviter les litiges avec le client.",
  "## Préparer le devis",
  `Le devis fixe le prix des travaux et les délais. ${filler(30)}.`,
  "### Les acomptes",
  `L'acompte se calcule sur le montant du devis accepté. ${filler(30)}.`,
  "## Exemple de devis de plomberie",
  `Un exemple de devis de plomberie détaille chaque ligne. ${filler(30)}.`,
  "- première puce courte du devis de plomberie assez longue pour passer le seuil de mots ;",
  "## Questions fréquentes",
  `Faut-il un acompte ? ${filler(40)}.`,
  "## Conclusion",
  `Pour conclure, ${filler(40)}.`,
].join("\n\n")

describe("integrationCandidates", () => {
  it("secondaire : développement seulement, ni introduction, ni FAQ, ni conclusion", () => {
    const c = integrationCandidates(ARTICLE, "facture acompte plomberie", "secondary")
    expect(c.length).toBeGreaterThan(0)
    expect(c.every((x) => !x.text.includes("Faut-il un acompte") && !x.text.startsWith("Pour conclure"))).toBe(true)
    expect(c.every((x) => !x.text.startsWith("Facturer un chantier demande"))).toBe(true)
    expect(c.map((x) => x.index)).toEqual(c.map((_, i) => i + 1))
    expect(c.find((x) => x.text.startsWith("L'acompte se calcule"))?.section).toBe("Les acomptes")
  })

  it("secondaire : les passages qui ont déjà le mot-clé tel quel sont écartés", () => {
    const c = integrationCandidates(ARTICLE, "exemple de devis de plomberie", "secondary")
    expect(c.some((x) => x.text.startsWith("Un exemple de devis de plomberie"))).toBe(false)
    expect(c.some((x) => x.text.startsWith("L'acompte se calcule"))).toBe(true)
  })

  it("secondaire : au plus 8 passages, les plus proches du mot-clé d'abord, rendus dans l'ordre du texte", () => {
    const paragraphs = Array.from({ length: 14 }, (_, i) => `Paragraphe ${i} ${i === 9 ? `chantier puis ${filler(5)} acompte` : ""} ${filler(30)}.`)
    const md = ["## Corps", ...paragraphs].join("\n\n")
    const c = integrationCandidates(md, "acompte chantier", "secondary")
    expect(c).toHaveLength(MAX_CANDIDATES)
    expect(c.some((x) => x.text.startsWith("Paragraphe 9 "))).toBe(true)
    const positions = c.map((x) => md.indexOf(x.text))
    expect(positions).toEqual([...positions].sort((a, b) => a - b))
  })

  it("secondaire : sans recoupement, des passages répartis sur tout l'article", () => {
    const paragraphs = Array.from({ length: 16 }, (_, i) => `Paragraphe ${i} ${filler(30)}.`)
    const md = ["## Corps", ...paragraphs].join("\n\n")
    const c = integrationCandidates(md, "isolation thermique", "secondary")
    expect(c).toHaveLength(MAX_CANDIDATES)
    expect(c[0].text.startsWith("Paragraphe 0 ")).toBe(true)
    expect(c[c.length - 1].text.startsWith("Paragraphe 14 ")).toBe(true)
  })

  it("secondaire : les passages qui nomment un concurrent ne sont jamais proposés", () => {
    const md = ["## Corps", `Voir aussi rival-exemple.fr pour ce sujet. ${filler(30)}.`, `Un autre paragraphe sans rien de particulier. ${filler(30)}.`].join("\n\n")
    const c = integrationCandidates(md, "devis", "secondary", { competitors: ["rival-exemple.fr"] })
    expect(c).toHaveLength(1)
    expect(c[0].text).not.toContain("rival-exemple")
  })

  it("secondaire : un passage déjà vu (avoid) n'est pas reproposé", () => {
    const first = integrationCandidates(ARTICLE, "acompte", "secondary")
    const again = integrationCandidates(ARTICLE, "acompte", "secondary", { avoid: [first[0].text] })
    expect(again.some((x) => x.text === first[0].text)).toBe(false)
  })

  it("sous-titre : les titres 2 et 3 du développement, avec le début de leur texte", () => {
    const c = integrationCandidates(ARTICLE, "facture acompte", "heading")
    expect(c.map((x) => x.text)).toEqual(["Préparer le devis", "Les acomptes", "Exemple de devis de plomberie"])
    expect(c.every((x) => x.kind === "heading")).toBe(true)
    expect(c[0].context).toContain("Le devis fixe le prix")
  })

  it("sous-titre : un titre qui reprend déjà le mot-clé n'est pas retouché", () => {
    const c = integrationCandidates(ARTICLE, "exemple de devis de plomberie", "heading")
    expect(c.map((x) => x.text)).not.toContain("Exemple de devis de plomberie")
  })

  it("introduction : le premier paragraphe, et lui seul", () => {
    const c = integrationCandidates(ARTICLE, "facturer un chantier", "intro")
    expect(c).toHaveLength(1)
    expect(c[0].text.startsWith("Facturer un chantier demande")).toBe(true)
    expect(c[0].section).toBe("Introduction")
  })

  it("rien à proposer : texte vide, mot-clé vide ou texte sans développement", () => {
    expect(integrationCandidates("", "devis", "secondary")).toEqual([])
    expect(integrationCandidates(ARTICLE, "", "secondary")).toEqual([])
    expect(integrationCandidates("Une phrase seule.", "devis", "heading")).toEqual([])
  })
})

describe("buildIntegratePrompt", () => {
  const candidates = integrationCandidates(ARTICLE, "facture acompte plomberie", "secondary").slice(0, 2)

  it("numérote les passages, nomme la section et le mot-clé, demande du JSON", () => {
    const prompt = buildIntegratePrompt({ mode: "secondary", keyword: "facture acompte plomberie", title: "Comment facturer", mainKeyword: "facturer un chantier", count: 2, candidates })
    expect(prompt).toContain("MOT-CLÉ À FAIRE FIGURER : facture acompte plomberie")
    expect(prompt).toContain("MOT-CLÉ PRINCIPAL DE L'ARTICLE : facturer un chantier")
    expect(prompt).toContain("[1] (paragraphe, section « ")
    expect(prompt).toContain('"edits"')
    expect(prompt).toContain("2 passages au plus")
  })

  it("le mot-clé principal n'est pas répété quand c'est le mot-clé à placer", () => {
    const prompt = buildIntegratePrompt({ mode: "intro", keyword: "facturer un chantier", mainKeyword: "Facturer un chantier", candidates })
    expect(prompt).not.toContain("MOT-CLÉ PRINCIPAL DE L'ARTICLE")
  })

  it("sous-titre : un seul à réécrire, avec le début de la section", () => {
    const heads = integrationCandidates(ARTICLE, "facture acompte", "heading")
    const prompt = buildIntegratePrompt({ mode: "heading", keyword: "facture acompte", candidates: heads })
    expect(prompt).toContain("UN seul de ces sous-titres")
    expect(prompt).toContain("[1] (sous-titre)")
    expect(prompt).toContain("Début du texte de cette section")
  })
})

describe("parseIntegrateOutput", () => {
  it("lit le JSON, avec ou sans bloc de code, index en chaîne admis", () => {
    expect(parseIntegrateOutput('{"edits":[{"index":2,"text":"Texte."}]}')).toEqual([{ index: 2, text: "Texte." }])
    expect(parseIntegrateOutput('```json\n{"edits":[{"index":"3","text":"Autre."}]}\n```')).toEqual([{ index: 3, text: "Autre." }])
    expect(parseIntegrateOutput('Voici : {"edits":[{"index":1,"text":"A"},{"index":"x","text":"B"},{"index":2},{"text":"C"}]}')).toEqual([{ index: 1, text: "A" }])
  })

  it("liste vide, texte quelconque ou JSON cassé : aucune retouche", () => {
    expect(parseIntegrateOutput('{"edits":[]}')).toEqual([])
    expect(parseIntegrateOutput("Aucun passage ne convient.")).toEqual([])
    expect(parseIntegrateOutput('{"edits":[{"index":1')).toEqual([])
  })
})

describe("buildProposals", () => {
  const candidates = integrationCandidates(ARTICLE, "acompte plomberie", "secondary")
  const target = candidates.find((c) => c.text.startsWith("L'acompte se calcule"))!
  const opts = { mode: "secondary" as const, keyword: "acompte plomberie" }

  it("garde une réécriture qui contient le mot-clé tel quel et change le passage", () => {
    const after = target.text.replace("L'acompte se calcule", "L'acompte de plomberie se calcule")
    const { proposals, rejected } = buildProposals(candidates, [{ index: target.index, text: after }], opts)
    expect(rejected).toEqual([])
    expect(proposals).toHaveLength(1)
    expect(proposals[0]).toMatchObject({ id: String(target.index), kind: "paragraph", before: target.text, after })
  })

  it("écarte : mot-clé absent, aucun changement, trop long, trop coupé, trop répété", () => {
    const edits = [
      { index: target.index, text: target.text.replace("L'acompte", "Le versement") },
    ]
    expect(buildProposals(candidates, edits, opts).rejected[0]).toContain("le mot-clé n'y figurait pas tel quel")
    expect(buildProposals(candidates, [{ index: target.index, text: `${target.text} acompte plomberie` }], opts).proposals).toHaveLength(1)
    const same = buildProposals(candidates, [{ index: target.index, text: `${target.text} ` }], { ...opts, keyword: "mot0" })
    expect(same.rejected[0]).toContain("aucun changement")
    expect(buildProposals(candidates, [{ index: target.index, text: `${target.text} acompte plomberie ${filler(200)}` }], opts).rejected[0]).toContain("changeait trop")
    expect(buildProposals(candidates, [{ index: target.index, text: "Acompte plomberie." }], opts).rejected[0]).toContain("changeait trop")
    expect(buildProposals(candidates, [{ index: target.index, text: `${target.text} acompte plomberie, acompte plomberie, acompte plomberie` }], opts).rejected[0]).toContain("répété")
  })

  it("liens ajoutés retirés (avec avertissement), concurrent cité écarté, numéro inconnu ignoré", () => {
    const withLink = target.text.replace("L'acompte", "L'[acompte de plomberie](https://exemple.fr/x)")
    const linked = buildProposals(candidates, [{ index: target.index, text: withLink }], opts)
    expect(linked.proposals[0].after).not.toContain("https://exemple.fr")
    expect(linked.proposals[0].after).toContain("L'acompte de plomberie")
    expect(linked.proposals[0].warnings.join(" ")).toContain("lien")

    const rival = buildProposals(candidates, [{ index: target.index, text: `${target.text} acompte plomberie, vu sur rival-exemple.fr` }], { ...opts, competitors: ["rival-exemple.fr"] })
    expect(rival.proposals).toHaveLength(0)
    expect(rival.rejected[0]).toContain("concurrent")

    expect(buildProposals(candidates, [{ index: 99, text: "x" }], opts)).toEqual({ proposals: [], rejected: [] })
  })

  it("un chiffre qui n'était pas dans le passage est signalé", () => {
    const after = target.text.replace("L'acompte se calcule", "L'acompte de plomberie, souvent 30 %, se calcule")
    const { proposals } = buildProposals(candidates, [{ index: target.index, text: after }], opts)
    expect(proposals[0].warnings.join(" ")).toContain("« 30 »")
  })

  it("limite : 2 passages au plus par défaut, 1 seul sous-titre ou paragraphe d'introduction", () => {
    const two = candidates.filter((c) => c.kind === "paragraph").slice(0, 3)
    const edits = two.map((c) => ({ index: c.index, text: `${c.text} acompte plomberie` }))
    expect(buildProposals(candidates, edits, opts).proposals).toHaveLength(Math.min(2, two.length))
    expect(buildProposals(candidates, edits, { ...opts, count: 3 }).proposals).toHaveLength(Math.min(3, two.length))

    const heads = integrationCandidates(ARTICLE, "facture acompte", "heading")
    const headEdits = heads.map((h) => ({ index: h.index, text: `Facture et acompte : ${h.text}` }))
    expect(buildProposals(heads, headEdits, { mode: "heading", keyword: "facture acompte" }).proposals).toHaveLength(1)
  })

  it("sous-titre : une seule ligne, 100 caractères au plus ; les « # » éventuels sont retirés", () => {
    const heads = integrationCandidates(ARTICLE, "facture acompte", "heading")
    const ok = buildProposals(heads, [{ index: heads[0].index, text: "## Facture et acompte : préparer le devis" }], { mode: "heading", keyword: "facture acompte" })
    expect(ok.proposals[0].after).toBe("Facture et acompte : préparer le devis")
    expect(ok.proposals[0].kind).toBe("heading")
    const long = buildProposals(heads, [{ index: heads[0].index, text: `Facture et acompte ${"très long ".repeat(15)}` }], { mode: "heading", keyword: "facture acompte" })
    expect(long.proposals).toHaveLength(0)
  })
})

describe("diffWords", () => {
  it("surligne les mots retirés avant et ajoutés après, le reste est commun", () => {
    const d = diffWords("L'acompte se calcule sur le devis accepté.", "L'acompte de plomberie se calcule sur le devis accepté.")
    expect(d.before.every((p) => !p.changed)).toBe(true)
    expect(d.after.filter((p) => p.changed).map((p) => p.text)).toEqual(["de plomberie"])
  })

  it("remplacement : un mot sort, un autre entre ; la syntaxe Markdown n'entre pas dans la comparaison", () => {
    const d = diffWords("Le **prix** des travaux", "Le coût des travaux")
    expect(d.before.filter((p) => p.changed).map((p) => p.text)).toEqual(["prix"])
    expect(d.after.filter((p) => p.changed).map((p) => p.text)).toEqual(["coût"])
  })

  it("textes identiques ou vides ; passages énormes comparés sans calcul", () => {
    expect(diffWords("Un texte.", "Un texte.").after.every((p) => !p.changed)).toBe(true)
    expect(diffWords("", "Ajout")).toEqual({ before: [], after: [{ text: "Ajout", changed: true }] })
    const big = Array.from({ length: 600 }, (_, i) => `a${i}`).join(" ")
    expect(diffWords(big, big.replace("a1 ", "b1 ")).after).toHaveLength(1)
  })
})
