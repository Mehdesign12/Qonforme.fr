import { describe, expect, it } from "vitest"
import { SETTINGS_DEFAULTS } from "@/lib/seo/settings-schema"
import { competitorTerms, findCompetitorMentions } from "@/lib/seo/competitors"
import {
  buildCoverPrompt,
  buildFixPrompt,
  buildPlanPrompt,
  buildReviewPrompt,
  buildSystemPrompt,
  buildWritePrompt,
  EDITORIAL_ANGLES,
  isOfficialUrl,
  nextAngle,
  REFERENCE_FACTS,
  type ArticleBrief,
  type ArticlePlan,
} from "@/lib/seo/articles/prompt"

const ctx = { brand: SETTINGS_DEFAULTS.brand, strategy: SETTINGS_DEFAULTS.strategy, prefs: SETTINGS_DEFAULTS.articles }
const competitors = SETTINGS_DEFAULTS.targeting.competitors

const brief: ArticleBrief = {
  title: "Relancer une facture impayée sans perdre le client",
  keyword: "relances automatiques factures",
  articleType: "howto",
  angle: "erreurs-a-eviter",
  notes: null,
  lengthMin: 1500,
  lengthMax: 2500,
  faq: { min: 3, max: 5 },
}

const plan: ArticlePlan = {
  title: "Relancer une facture impayée sans perdre le client",
  slug: "relancer-facture-impayee",
  metaDescription: "x".repeat(140),
  outline: [
    { h2: "Quand relancer", h3: ["Avant l'échéance"] },
    { h2: "Que dire", h3: [] },
    { h2: "Les pénalités", h3: [] },
  ],
  faq: ["Combien de relances envoyer ?"],
  keywords: ["relance facture"],
  sources: [{ title: "Code de commerce, art. L441-10", url: "https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000045800227" }],
}

describe("consigne du générateur", () => {
  it("reprend le contexte de marque, la stratégie et les faits de référence", () => {
    const system = buildSystemPrompt(ctx)
    expect(system).toContain(ctx.brand.offer)
    expect(system).toContain(ctx.brand.positioning)
    expect(system).toContain(ctx.brand.tone)
    expect(system).toContain(ctx.strategy.niche)
    expect(system).toContain(ctx.brand.benefits[0])
    expect(system).toContain(ctx.brand.proofs[0].claim)
    expect(system).toContain(REFERENCE_FACTS)
    expect(system).toMatch(/37\s500\s€/)
    expect(system).toContain("Vouvoyez toujours le lecteur")
    expect(system).toContain("Ne promettez aucun contact humain")
    expect(system).toContain("jamais « PDP »")
    expect(system).toContain(".gouv.fr")
    // Le relecteur reçoit le même contexte, avec son rôle
    expect(buildSystemPrompt(ctx, "reviewer")).toMatch(/^Vous relisez/)
  })

  it("ne contient jamais un concurrent suivi, quelle que soit la passe", () => {
    const prompts = [
      buildSystemPrompt(ctx),
      buildSystemPrompt(ctx, "reviewer"),
      buildPlanPrompt(brief, { existingTitles: ["Facture d'acompte : mode d'emploi"] }),
      buildWritePrompt(brief, plan, "Qonforme"),
      buildReviewPrompt({ title: plan.title, content: "## Section\n\nTexte.", lengthMin: 1500, lengthMax: 2500, faq: null }),
      buildFixPrompt("## Section\n\nTexte.", [{ problem: "Titres répétés", fix: "Changez-les" }]),
      buildCoverPrompt({ keyword: brief.keyword, title: plan.title, seed: 3 }),
    ]
    for (const p of prompts) {
      expect(findCompetitorMentions(p, competitors)).toEqual([])
      for (const term of competitorTerms(competitors)) expect(p.toLowerCase()).not.toContain(term)
    }
  })

  it("applique les préférences de rédaction : longueur, FAQ, angle, sources", () => {
    const planPrompt = buildPlanPrompt(brief, { existingTitles: ["Un article existant"], previousError: "Titre de plus de 70 caractères" })
    expect(planPrompt).toContain("1500 à 2500 mots")
    expect(planPrompt).toContain("FAQ : 3 à 5 questions")
    expect(planPrompt).toContain(EDITORIAL_ANGLES.find((a) => a.key === "erreurs-a-eviter")!.instruction)
    expect(planPrompt).toContain("- Un article existant")
    expect(planPrompt).toContain("ESSAI PRÉCÉDENT REFUSÉ : Titre de plus de 70 caractères")
    expect(buildPlanPrompt({ ...brief, faq: null }, { existingTitles: [] })).toContain("FAQ : aucune")

    const write = buildWritePrompt(brief, plan, "Qonforme")
    expect(write).toContain("## Quand relancer")
    expect(write).toContain("### Avant l'échéance")
    expect(write).toContain("## Questions fréquentes")
    expect(write).toContain(plan.sources[0].url)
    expect(write).toContain("invite à essayer Qonforme")
    expect(write).toContain("sans contact humain")

    const sansSources = buildSystemPrompt({ ...ctx, prefs: { ...ctx.prefs, officialSources: false } })
    expect(sansSources).not.toContain("Chaque règle légale renvoie à sa source officielle")
  })

  it("alterne les angles : le premier angle absent des dernières rédactions", () => {
    expect(nextAngle([]).key).toBe("guide-pratique")
    expect(nextAngle(["guide-pratique", "checklist"]).key).toBe("erreurs-a-eviter")
    const all = EDITORIAL_ANGLES.map((a) => a.key)
    expect(nextAngle(all).key).toBe(all[all.length - 1])
  })

  it("n'accepte que des sources officielles en https", () => {
    expect(isOfficialUrl("https://www.legifrance.gouv.fr/codes/x")).toBe(true)
    expect(isOfficialUrl("https://bofip.impots.gouv.fr/bofip/1")).toBe(true)
    expect(isOfficialUrl("https://entreprendre.service-public.gouv.fr/vosdroits/F31144")).toBe(true)
    expect(isOfficialUrl("https://www.service-public.fr/professionnels-entreprises")).toBe(true)
    expect(isOfficialUrl("http://www.impots.gouv.fr/")).toBe(false)
    expect(isOfficialUrl("https://gouv.fr.exemple.com/")).toBe(false)
    expect(isOfficialUrl("https://www.exemple.fr/")).toBe(false)
  })

  it("demande une photo d'artisan sans texte ni logo, en 16:9", () => {
    const prompt = buildCoverPrompt({ keyword: "facture peintre", title: "Facture de peintre", seed: 1 })
    expect(prompt).toContain("16:9")
    expect(prompt).toMatch(/painter/)
    expect(prompt).toMatch(/No text/)
    expect(prompt).toMatch(/logos/)
  })
})
