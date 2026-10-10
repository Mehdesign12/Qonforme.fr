/**
 * Visibilité IA : repérage (marque, site, concurrents, faux positifs), résumé d'un
 * relevé, état des cellules, coût estimé, saisies.
 */
import { describe, expect, it } from "vitest"
import { brandTermsOf, dedupeSources, detect, domainOf, isSiteDomain, mentionsBrand, mentionText, sourceKind } from "@/lib/seo/geo/detect"
import { cellState, computeSummary, type SummaryAnswer } from "@/lib/seo/geo/summary"
import { estimateRunCost, fmtUsd, GEO_COST_PER_CALL_USD } from "@/lib/seo/geo/cost"
import { createQuestionSchema, parseBrandTerms, parseInput, updateQuestionSchema } from "@/lib/seo/geo/questions"
import { plainAnswer, shortQuestion } from "@/lib/seo/geo/labels"
import { SETTINGS_DEFAULTS } from "@/lib/seo/settings"

const COMPETITORS = SETTINGS_DEFAULTS.targeting.competitors
const TERMS = brandTermsOf(SETTINGS_DEFAULTS.targeting.brandTerms)

describe("domaines", () => {
  it("hôte sans www, en minuscules ; vide pour une URL invalide ou non http(s)", () => {
    expect(domainOf("https://www.Qonforme.fr/guide?x=1")).toBe("qonforme.fr")
    expect(domainOf("http://app.tolteck.com")).toBe("app.tolteck.com")
    expect(domainOf("javascript:alert(1)")).toBe("")
    expect(domainOf("pas une url")).toBe("")
  })

  it("site cité : qonforme.fr et ses sous-domaines seulement", () => {
    expect(isSiteDomain("qonforme.fr")).toBe(true)
    expect(isSiteDomain("blog.qonforme.fr")).toBe(true)
    expect(isSiteDomain("qonforme.fr.exemple.com")).toBe(false)
    expect(isSiteDomain("notqonforme.fr")).toBe(false)
    expect(isSiteDomain("qonforme.com")).toBe(false)
  })

  it("écarte les liens non http(s) et les doublons", () => {
    const out = dedupeSources([
      { url: "https://qonforme.fr/a", domain: "", title: "A" },
      { url: "https://qonforme.fr/a", domain: "", title: "A bis" },
      { url: "javascript:alert(1)", domain: "", title: "piège" },
    ])
    expect(out).toEqual([{ url: "https://qonforme.fr/a", domain: "qonforme.fr", title: "A" }])
  })
})

describe("mention de la marque", () => {
  it("« Qonforme » est toujours recherché, sans doublon", () => {
    expect(brandTermsOf([])).toEqual(["Qonforme"])
    expect(brandTermsOf(["qonforme", "qonforme.fr"])).toEqual(["Qonforme", "qonforme.fr"])
  })

  it("mot entier, sans tenir compte de la casse ni des accents", () => {
    expect(mentionsBrand("Essayez QONFORME pour vos devis.", TERMS)).toBe(true)
    expect(mentionsBrand("Rendez-vous sur qonforme.fr.", TERMS)).toBe(true)
    expect(mentionsBrand("(Qonforme)", TERMS)).toBe(true)
    expect(mentionsBrand("Cafe Qönforme", ["Qonforme"])).toBe(true)
  })

  it("pas de faux positif : « conforme », un mot plus long, un autre domaine", () => {
    expect(mentionsBrand("Une facture conforme aux mentions obligatoires.", TERMS)).toBe(false)
    expect(mentionsBrand("Les outils qonformes", TERMS)).toBe(false)
    expect(mentionsBrand("monqonforme", TERMS)).toBe(false)
    expect(mentionsBrand(null, TERMS)).toBe(false)
  })
})

describe("texte des mentions", () => {
  it("retire liens Markdown (intitulé compris) et adresses, garde le reste du texte", () => {
    expect(mentionText("Voir ([qonforme.fr](https://qonforme.fr/x?utm_source=openai)).").replace(/\s+/g, " ").trim()).toBe("Voir .")
    expect(mentionText("Lire [le guide](https://qonforme.fr/guide) et https://www.tolteck.com/tarifs ou www.constructor.co/avis.")).not.toMatch(
      /qonforme|tolteck|constructor/,
    )
    expect(mentionText("Qonforme et Tolteck sont cités.")).toBe("Qonforme et Tolteck sont cités.")
  })
})

describe("repérage d'une réponse", () => {
  it("marque, site, concurrents nommés et cités", () => {
    const d = detect(
      {
        answer: "Tolteck et Mediabat sont souvent cités ; Qonforme aussi.",
        sources: [
          { url: "https://www.tolteck.com/prix", domain: "tolteck.com", title: "Prix" },
          { url: "https://app.constructor.co/", domain: "", title: "Constructor" },
          { url: "https://blog.qonforme.fr/x", domain: "blog.qonforme.fr", title: "Blog" },
        ],
      },
      { brandTerms: TERMS, competitors: COMPETITORS },
    )
    expect(d.brand_mentioned).toBe(true)
    expect(d.site_cited).toBe(true)
    expect(d.competitors_mentioned.sort()).toEqual(["mediabat.com", "tolteck.com"])
    expect(d.competitors_cited.sort()).toEqual(["constructor.co", "tolteck.com"])
  })

  it("rien de repéré dans une réponse neutre", () => {
    const d = detect(
      { answer: "Un logiciel doit gérer la TVA par ligne et les relances.", sources: [{ url: "https://www.service-public.gouv.fr/F31808", domain: "", title: "" }] },
      { brandTerms: TERMS, competitors: COMPETITORS },
    )
    expect(d).toEqual({ brand_mentioned: false, site_cited: false, competitors_mentioned: [], competitors_cited: [] })
  })

  it("Aperçu IA absent (réponse nulle) : rien de repéré, sans erreur", () => {
    expect(detect({ answer: null, sources: [] }, { brandTerms: TERMS, competitors: COMPETITORS }).brand_mentioned).toBe(false)
  })

  it("classe les sources : Qonforme, concurrent, autre", () => {
    expect(sourceKind({ url: "https://qonforme.fr/x", domain: "qonforme.fr", title: "" }, COMPETITORS)).toBe("site")
    expect(sourceKind({ url: "https://btp.inprocess.ai/x", domain: "", title: "" }, COMPETITORS)).toBe("competitor")
    expect(sourceKind({ url: "https://inprocess.ai/x", domain: "", title: "" }, COMPETITORS)).toBe("other")
  })
})

describe("résumé d'un relevé", () => {
  const a = (engine: string, status: string, m: boolean, c: boolean, cm: string[] = [], cc: string[] = [], q = "q1"): SummaryAnswer => ({
    question_id: q,
    engine,
    status,
    brand_mentioned: status === "done" ? m : null,
    site_cited: status === "done" ? c : null,
    competitors_mentioned: cm,
    competitors_cited: cc,
  })

  it("taux par moteur, au total et par domaine, sur les réponses obtenues seulement", () => {
    const s = computeSummary(
      [
        a("gemini", "done", true, false, [], ["tolteck.com"]),
        a("gemini", "done", false, false, ["tolteck.com"], [], "q2"),
        a("gemini", "failed", false, false),
        a("chatgpt", "done", true, true, [], [], "q2"),
        a("chatgpt", "done", false, false),
      ],
      { engines: ["gemini", "chatgpt", "perplexity"], competitors: ["tolteck.com", "mediabat.com"] },
    )
    expect(s.questions).toBe(2)
    expect(s.engines.gemini).toEqual({ mention_rate: 0.5, citation_rate: 0, mentions: 1, citations: 0, answers: 2 })
    expect(s.engines.chatgpt).toEqual({ mention_rate: 0.5, citation_rate: 0.5, mentions: 1, citations: 1, answers: 2 })
    // Moteur interrogé sans aucune réponse obtenue : taux inconnus, pas 0 %
    expect(s.engines.perplexity).toEqual({ mention_rate: null, citation_rate: null, mentions: 0, citations: 0, answers: 0 })
    expect(s.overall).toMatchObject({ mention_rate: 0.5, citation_rate: 0.25, answers: 4 })
    expect(s.domains["qonforme.fr"]).toMatchObject({ mention_rate: 0.5, citation_rate: 0.25 })
    expect(s.domains["tolteck.com"]).toMatchObject({ mention_rate: 0.25, citation_rate: 0.25 })
    expect(s.domains["mediabat.com"]).toMatchObject({ mention_rate: 0, citation_rate: 0 })
  })

  it("état d'une cellule : cité > mentionné > absent ; sans réponse : non mesuré", () => {
    expect(cellState([{ status: "done", brand_mentioned: true, site_cited: false }, { status: "done", brand_mentioned: false, site_cited: true }])).toBe("cited")
    expect(cellState([{ status: "done", brand_mentioned: true, site_cited: false }])).toBe("mentioned")
    expect(cellState([{ status: "done", brand_mentioned: false, site_cited: false }, { status: "failed", brand_mentioned: null, site_cited: null }])).toBe("absent")
    expect(cellState([{ status: "failed", brand_mentioned: null, site_cited: null }])).toBe("unmeasured")
    expect(cellState([])).toBe("unmeasured")
  })
})

describe("coût estimé", () => {
  it("questions × moteurs interrogés × répétitions × coût unitaire", () => {
    const est = estimateRunCost({ questions: 10, engines: ["gemini", "chatgpt"], repetitions: 3 })
    expect(est.calls).toBe(60)
    expect(est.usd).toBeCloseTo(30 * (GEO_COST_PER_CALL_USD.gemini + GEO_COST_PER_CALL_USD.chatgpt))
    expect(fmtUsd(0.57)).toBe("0,57 $")
    expect(fmtUsd(0.001)).toBe("0,01 $")
    expect(estimateRunCost({ questions: 10, engines: [], repetitions: 3 })).toEqual({ calls: 0, usd: 0 })
  })
})

describe("saisies", () => {
  it("question : 10 à 300 caractères, espaces resserrés", () => {
    expect(parseInput(createQuestionSchema, { question: "  Quel   logiciel choisir ?  " })).toEqual({ ok: true, value: { question: "Quel logiciel choisir ?" } })
    expect(parseInput(createQuestionSchema, { question: "Court ?" })).toMatchObject({ ok: false, error: expect.stringMatching(/au moins 10/) })
    expect(parseInput(createQuestionSchema, { question: "x".repeat(301) })).toMatchObject({ ok: false, error: expect.stringMatching(/au plus 300/) })
    expect(parseInput(createQuestionSchema, null).ok).toBe(false)
    expect(parseInput(updateQuestionSchema, {}).ok).toBe(false)
    expect(parseInput(updateQuestionSchema, { active: false })).toEqual({ ok: true, value: { active: false } })
  })

  it("termes de marque : une ligne par terme, sans doublon", () => {
    expect(parseBrandTerms("Qonforme\n\n qonforme.fr \nQONFORME")).toEqual({ terms: ["Qonforme", "qonforme.fr"], error: null })
    expect(parseBrandTerms("x".repeat(81)).error).toMatch(/80/)
  })

  it("texte d'une réponse : Markdown simplifié", () => {
    expect(plainAnswer("## Titre\n**Gras** et [lien](https://qonforme.fr)\n- puce")).toBe("Titre\nGras et lien (https://qonforme.fr)\n• puce")
    expect(shortQuestion("x".repeat(80))).toHaveLength(60)
  })
})
