import { describe, expect, it } from "vitest"
import {
  checkArticle,
  decidePublication,
  findDuplicate,
  isAllowedLink,
  manualPublishBlockers,
  normalizeContent,
  REDACTED,
  redactCompetitors,
  storedReviewIssues,
  parseReview,
  reviewMissingIssue,
  wordCount,
  type CheckIssue,
} from "@/lib/seo/articles/check"
import { articleDate, articleDisplayStatus, articleSource, canApplyTopicAction } from "@/lib/seo/articles/status"
import { parsePlan } from "@/lib/seo/articles/generate"
import { findCompetitorMentions } from "@/lib/seo/competitors"

const competitors = ["tolteck.com", "constructor.co"]
const words = (n: number) => Array.from({ length: n }, (_, i) => `mot${i}`).join(" ")

const issue = (blocking: boolean): CheckIssue => ({ kind: "audit", label: blocking ? "Anciens seuils de franchise de TVA" : "Ancien nom des plateformes agréées (PDP)", blocking, fixable: true })

describe("contrôle d'un article", () => {
  it("repère valeurs périmées, concurrents, titres, liens, FAQ, description et doublon", () => {
    const content = [
      "# Un titre de niveau 1",
      "",
      "La franchise s'arrête à 36 800 € pour les services. Comparé à Tolteck, c'est plus simple.",
      "",
      "## Section A",
      "Texte avec un [lien](https://www.exemple.com/page) et un [lien officiel](https://www.impots.gouv.fr/x).",
      "## Section A",
      "Encore du texte.",
    ].join("\n")
    const issues = checkArticle({
      title: "Facture électronique : ce que l'artisan doit préparer",
      content,
      metaDescription: "Trop courte",
      slug: "facture-electronique-artisan",
      competitors,
      existing: [{ id: "x", title: "Facture électronique : ce que l'artisan doit préparer en 2026", slug: "autre" }],
      lengthMin: 1500,
      lengthMax: 2500,
      faq: { min: 3, max: 5 },
    })
    const kinds = issues.map((i) => i.kind)
    expect(kinds).toEqual(expect.arrayContaining(["audit", "competitor", "length", "h1", "link", "heading", "faq", "meta", "duplicate"]))
    expect(issues.find((i) => i.kind === "audit")!.blocking).toBe(true)
    expect(issues.find((i) => i.kind === "competitor")!.blocking).toBe(true)
    expect(issues.find((i) => i.kind === "competitor")!.detail).toContain("tolteck.com")
    expect(issues.find((i) => i.kind === "link")!.detail).toContain("exemple.com")
    expect(issues.find((i) => i.kind === "link")!.detail).not.toContain("impots.gouv.fr")
    expect(issues.filter((i) => !i.blocking).every((i) => i.kind !== "audit" || i.rule === "pdp")).toBe(true)
  })

  it("« PDP » signale sans retenir", () => {
    const issues = checkArticle({ title: "Plateformes", content: "Choisir sa PDP.", competitors, existing: [] })
    expect(issues).toHaveLength(1)
    expect(issues[0].blocking).toBe(false)
    expect(manualPublishBlockers(issues)).toEqual([])
  })

  it("un article propre ne remonte rien", () => {
    const content = `Introduction.\n\n## Première partie\n\n${words(1600)}\n\n## Questions fréquentes\n\n### Faut-il un devis ?\nOui.\n\n### Quel délai ?\nTrente jours.\n\n### Quelle TVA ?\nSelon les travaux.`
    expect(
      checkArticle({
        title: "Un guide",
        content,
        metaDescription: "d".repeat(130),
        competitors,
        existing: [],
        lengthMin: 1500,
        lengthMax: 2500,
        faq: { min: 3, max: 5 },
      }),
    ).toEqual([])
  })

  it("nettoie le texte du modèle sans rien inventer", () => {
    const raw = "```markdown\n# Mon titre\n\nIntro <script>alert(1)</script> ![image](https://x/y.png)\n\n# Section\n\n[ici](https://www.exemple.com) et [là](https://www.legifrance.gouv.fr/a) et [mal](javascript:alert(1))\n```"
    const { content, autoFixes } = normalizeContent(raw, "Mon titre")
    expect(content.startsWith("Intro")).toBe(true)
    expect(content).not.toContain("<script>")
    expect(content).not.toContain("![image]")
    expect(content).toContain("## Section")
    expect(content).toContain("ici et [là](https://www.legifrance.gouv.fr/a) et mal")
    expect(autoFixes).toEqual(expect.arrayContaining(["Titre répété en tête retiré", "Titre de niveau 1 rétrogradé en section", "2 liens non officiels retirés"]))
  })

  it("compte les mots du texte lisible", () => {
    expect(wordCount("## Titre\n\nUn **mot** et [un lien](https://exemple.fr/a-b-c).")).toBe(6)
  })

  it("repère un doublon par le titre ou l'adresse", () => {
    const existing = [{ id: "a", title: "Relancer une facture impayée sans perdre son client", slug: "relancer-facture-impayee" }]
    expect(findDuplicate({ title: "Relancer une facture impayée sans perdre le client" }, existing)?.id).toBe("a")
    expect(findDuplicate({ title: "Tout autre chose", slug: "relancer-facture-impayee-2" }, existing)?.id).toBe("a")
    expect(findDuplicate({ title: "Relancer une facture impayée sans perdre le client", selfId: "a" }, existing)).toBeNull()
    expect(findDuplicate({ title: "Autoliquidation en sous-traitance" }, existing)).toBeNull()
  })
})

describe("décision de publication selon le mode", () => {
  it("brouillon : jamais publié, toujours à relire", () => {
    expect(decidePublication("draft", [])).toEqual({ publish: false, heldReason: null, reviewStatus: "to_review" })
    expect(decidePublication("draft", [issue(false)]).heldReason).toMatch(/^Passages à relire/)
  })

  it("après contrôle : publié seulement si rien n'est repéré", () => {
    expect(decidePublication("after_check", []).publish).toBe(true)
    const held = decidePublication("after_check", [issue(false)])
    expect(held.publish).toBe(false)
    expect(held.reviewStatus).toBe("to_review")
    expect(held.heldReason).toContain("PDP")
  })

  it("directement : publié sauf valeur périmée ou affirmation interdite", () => {
    expect(decidePublication("direct", [issue(false)]).publish).toBe(true)
    const held = decidePublication("direct", [issue(false), issue(true)])
    expect(held.publish).toBe(false)
    expect(held.heldReason).toContain("Anciens seuils de franchise de TVA")
    expect(held.heldReason).not.toContain("PDP")
  })
})

describe("contrôle factuel par le modèle de relecture", () => {
  const content = "## Franchise\n\nLe seuil de la franchise est de **36 800 €** pour les services, selon l'ancien barème."

  it("garde les problèmes dont la citation existe, dans la bonne gravité", () => {
    const issues = parseReview(
      JSON.stringify({
        problems: [
          { category: "stale_value", excerpt: "Le seuil de la franchise est de 36 800 € pour les services", explanation: "Seuil périmé", fix: "37 500 €" },
          { category: "factual_error", excerpt: "une phrase inventée qui n'existe pas dans l'article", explanation: "x", fix: "y" },
          { category: "inconnue", excerpt: "selon l'ancien barème", explanation: "x", fix: "y" },
          { category: "UNVERIFIABLE_CLAIM", excerpt: "selon l'ancien barème", explanation: "Source absente", fix: "" },
        ],
      }),
      content,
    )
    expect(issues).toHaveLength(2)
    expect(issues[0]).toMatchObject({ kind: "review", rule: "stale_value", blocking: true, fixable: true })
    expect(issues[0].detail).toContain("À écrire : 37 500 €")
    expect(issues[1]).toMatchObject({ rule: "unverifiable_claim", blocking: false })
  })

  it("lit le JSON entouré d'un bloc de code et refuse une réponse illisible", () => {
    expect(parseReview('```json\n{"problems":[]}\n```', content)).toEqual([])
    expect(() => parseReview("pas du json", content)).toThrow(/JSON/)
  })

  it("signale un contrôle factuel impossible sans le bloquer", () => {
    const missing = reviewMissingIssue("Clé GEMINI_API_KEY absente")
    expect(missing).toMatchObject({ kind: "review_missing", blocking: false, fixable: false })
    expect(decidePublication("after_check", [missing]).publish).toBe(false)
    expect(decidePublication("direct", [missing]).publish).toBe(true)
  })
})

describe("statut affiché et source d'un article", () => {
  const base = { is_published: false, review_status: null, scheduled_at: null, held_reason: null }
  it("publié, à relire, planifié, brouillon", () => {
    expect(articleDisplayStatus({ ...base, is_published: true })).toBe("published")
    expect(articleDisplayStatus({ ...base, review_status: "to_review", scheduled_at: "2026-10-12T06:00:00Z" })).toBe("to_review")
    expect(articleDisplayStatus({ ...base, scheduled_at: "2026-10-12T06:00:00Z", held_reason: "Passages repérés" })).toBe("scheduled")
    expect(articleDisplayStatus({ ...base, held_reason: "Retenu" })).toBe("to_review")
    expect(articleDisplayStatus(base)).toBe("draft")
  })

  it("PushRank, génération IA ou manuel", () => {
    expect(articleSource({ source: "pushrank", ai_generated: false })).toBe("pushrank")
    expect(articleSource({ source: "seo", ai_generated: true })).toBe("ai")
    expect(articleSource({ source: null, ai_generated: null })).toBe("manual")
  })

  it("date : publication, date prévue, sinon création", () => {
    expect(articleDate({ is_published: true, published_at: "p", scheduled_at: "s", created_at: "c" })).toBe("p")
    expect(articleDate({ is_published: false, published_at: null, scheduled_at: "s", created_at: "c" })).toBe("s")
    expect(articleDate({ is_published: false, published_at: null, scheduled_at: null, created_at: "c" })).toBe("c")
  })

  it("transitions d'un sujet contrôlées", () => {
    expect(canApplyTopicAction("unplanned", "schedule")).toBe(true)
    expect(canApplyTopicAction("generating", "draft")).toBe(false)
    expect(canApplyTopicAction("generating", "archive")).toBe(false)
    expect(canApplyTopicAction("published", "schedule")).toBe(false)
    expect(canApplyTopicAction("failed", "retry")).toBe(true)
    expect(canApplyTopicAction("drafted", "update")).toBe(false)
  })
})

describe("plan renvoyé par le modèle", () => {
  const valid = {
    title: "Relancer une facture impayée",
    slug: "Relancer une facture impayée !",
    metaDescription: "m".repeat(170),
    outline: [{ h2: "Un", h3: ["a", ""] }, { h2: "Deux", h3: [] }, { h2: "Trois", h3: [] }],
    faq: ["Combien de relances", "Quel délai ?"],
    keywords: ["Relance", "relance", "Facture"],
    sources: [
      { title: "Légifrance", url: "https://www.legifrance.gouv.fr/x" },
      { title: "Autre", url: "https://www.exemple.com/x" },
    ],
  }

  it("normalise l'adresse, la description, la FAQ, les mots-clés et les sources", () => {
    const plan = parsePlan(`\`\`\`json\n${JSON.stringify(valid)}\n\`\`\``, { faq: { min: 1, max: 5 } })
    expect(plan.slug).toBe("relancer-une-facture-impayee")
    expect(plan.metaDescription.length).toBeLessThanOrEqual(155)
    expect(plan.faq).toEqual(["Combien de relances ?", "Quel délai ?"])
    expect(plan.keywords).toEqual(["relance", "facture"])
    expect(plan.sources).toEqual([{ title: "Légifrance", url: "https://www.legifrance.gouv.fr/x" }])
    expect(plan.outline[0].h3).toEqual(["a"])
    expect(parsePlan(JSON.stringify(valid), { faq: null }).faq).toEqual([])
  })

  it("refuse un plan invalide avec un motif en français", () => {
    expect(() => parsePlan(JSON.stringify({ ...valid, title: "t".repeat(71) }), { faq: null })).toThrow("Titre de plus de 70 caractères")
    expect(() => parsePlan(JSON.stringify({ ...valid, outline: [] }), { faq: null })).toThrow("Plan de moins de 3 sections")
    expect(() => parsePlan(JSON.stringify({ ...valid, title: 3 }), { faq: null })).toThrow("Champ « title » absent ou invalide")
    expect(() => parsePlan("{", { faq: null })).toThrow("JSON lisible")
  })
})

describe("sécurité du texte rédigé", () => {
  it("aucun HTML ne passe, même reconstitué ; seuls les liens de la liste blanche restent des liens", () => {
    const raw = [
      "Texte <<b>img src=x onerror=alert(1)> et <script>alert(1)</script>.",
      "[Code](https://www.legifrance.gouv.fr/codes/x\" onmouseover=\"alert(1)) [hôte](//evil.example/x) [interne](/guide/tva-travaux) [ancre](#faq) [site](https://qonforme.fr/pricing) [blog](https://exemple.com/a)",
    ].join("\n\n")
    const { content, autoFixes } = normalizeContent(raw, "Titre")
    expect(content).not.toContain("<")
    expect(autoFixes).toContain("HTML neutralisé")
    expect(content).toContain("[interne](/guide/tva-travaux)")
    expect(content).toContain("[ancre](#faq)")
    expect(content).toContain("[site](https://qonforme.fr/pricing)")
    expect(content).not.toContain("](//")
    expect(content).not.toContain("onmouseover=")
    expect(content).not.toContain("exemple.com")
  })

  it("liste blanche des adresses", () => {
    expect(isAllowedLink("https://www.service-public.gouv.fr/particuliers/vosdroits/F31808")).toBe(true)
    expect(isAllowedLink("/guide/mentions-obligatoires-facture")).toBe(true)
    expect(isAllowedLink("#questions")).toBe(true)
    for (const bad of ["//evil.example", "javascript:alert(1)", "http://www.impots.gouv.fr", "/a b", "/a\"b", "https://www.impots.gouv.fr.evil.example/", "#a b"]) {
      expect(isAllowedLink(bad), bad).toBe(false)
    }
  })

  it("concurrents masqués avec la même recherche que findCompetitorMentions (accents, casse, mot entier)", () => {
    const domains = ["tolteck.com", "obat.fr"]
    const text = "Une approbation rapide, pas Obat ni TÔLTECK ; voir tolteck.com."
    const out = redactCompetitors(text, domains)
    expect(out).toBe(`Une approbation rapide, pas ${REDACTED} ni ${REDACTED} ; voir ${REDACTED}.`)
    expect(findCompetitorMentions(out, domains)).toEqual([])
    expect(redactCompetitors("Une approbation sans nom.", domains)).toBe("Une approbation sans nom.")
  })

  it("problèmes du relecteur gardés tant que le passage est dans le texte", () => {
    const audit = {
      version: 1,
      checkedAt: "2026-10-09T08:00:00.000Z",
      blocking: 1,
      issues: [
        { kind: "review", rule: "stale_value", label: "Valeur périmée (contrôle factuel)", excerpt: "seuil de 36 800 euros", blocking: true, fixable: true },
        { kind: "audit", label: "Anciens seuils de franchise de TVA", blocking: true, fixable: true },
      ],
    }
    expect(storedReviewIssues(audit, "Le SEUIL de 36 800 euros reste.").map((i) => i.label)).toEqual(["Valeur périmée (contrôle factuel)"])
    expect(storedReviewIssues(audit, "Le seuil a changé.")).toEqual([])
    expect(storedReviewIssues(null, "texte")).toEqual([])
  })
})
