import { describe, expect, it } from "vitest"
import {
  FREE_RULE,
  inferArticleType,
  keywordArticleMismatch,
  keywordForm,
  titleDirectives,
} from "@/lib/seo/articles/search-language"
import { buildSuggestPrompt, filterSuggestions, rejectReason } from "@/lib/seo/articles/suggest"
import { analyzeOnPage } from "@/lib/seo/articles/onpage"
import { buildPlanPrompt, buildSystemPrompt } from "@/lib/seo/articles/prompt"
import { SETTINGS_DEFAULTS } from "@/lib/seo/settings-schema"

describe("forme d'une requête", () => {
  it("question, achat de logiciel, modèle ou autre", () => {
    expect(keywordForm("comment facturer un chantier")).toBe("question")
    expect(keywordForm("Peut-on facturer sans numéro de TVA")).toBe("question")
    expect(keywordForm("qu'est-ce qu'une plateforme agréée")).toBe("question")
    expect(keywordForm("logiciel devis facturation")).toBe("buy")
    expect(keywordForm("meilleure application devis artisan")).toBe("buy")
    expect(keywordForm("exemple devis plomberie pdf")).toBe("model")
    expect(keywordForm("devis vierge à imprimer")).toBe("model")
    expect(keywordForm("attestation tva 10 travaux")).toBe("other")
    expect(keywordForm("")).toBe("other")
    expect(keywordForm(null)).toBe("other")
  })

  it("« comment » gagne sur « logiciel » : une question reste une question", () => {
    expect(keywordForm("comment choisir un logiciel de devis")).toBe("question")
  })
})

describe("type d'article déduit", () => {
  it("comment → how-to, autre question → FAQ, règle datée → actualité, sinon guide", () => {
    expect(inferArticleType("comment facturer un chantier", "")).toBe("howto")
    expect(inferArticleType(null, "Comment facturer un chantier : la liste de contrôle")).toBe("howto")
    expect(inferArticleType("peut-on facturer sans tva", "")).toBe("faq")
    expect(inferArticleType(null, "Quel taux de TVA pour des travaux ?")).toBe("faq")
    expect(inferArticleType("facture électronique", "Facture électronique : ce qui change en 2026")).toBe("news")
    expect(inferArticleType("tva travaux", "TVA des travaux : 20 %, 10 % ou 5,5 %")).toBe("guide")
  })
})

describe("mot-clé d'achat sur un article d'information", () => {
  it("signalé pour un how-to, une FAQ ou une actualité, jamais pour un guide", () => {
    expect(keywordArticleMismatch("logiciel devis facturation", "howto")).toMatch(/Recherche d'achat de logiciel sur un « comment faire »/)
    expect(keywordArticleMismatch("logiciel devis facturation", "faq")).toMatch(/une FAQ/)
    expect(keywordArticleMismatch("logiciel devis facturation", "news")).toMatch(/une actualité/)
    expect(keywordArticleMismatch("logiciel devis facturation", "guide")).toBeNull()
    expect(keywordArticleMismatch("comment facturer un chantier", "howto")).toBeNull()
    expect(keywordArticleMismatch("logiciel devis facturation", null)).toBeNull()
  })

  it("la liste de contrôle porte la ligne « Mot-clé adapté à l'article »", () => {
    const base = {
      title: "Comment facturer un chantier : la liste de contrôle de l'artisan",
      seoTitle: "",
      seoDescription: "",
      slug: "comment-facturer-un-chantier",
      excerpt: "Du devis signé à la dernière facture, la liste de contrôle pour facturer un chantier sans oubli.",
      content: "Facturer un chantier.\n\n## Les étapes\n\nTexte.",
      coverUrl: null,
      coverAlt: null,
    }
    const bad = analyzeOnPage({ ...base, keyword: "logiciel devis facturation", articleType: "howto" })
    expect(bad.checks.find((c) => c.id === "kw-fit")).toMatchObject({ status: "warn", target: "keyword" })
    const good = analyzeOnPage({ ...base, keyword: "comment facturer un chantier", articleType: "howto" })
    expect(good.checks.find((c) => c.id === "kw-fit")).toBeUndefined()
    const guide = analyzeOnPage({ ...base, keyword: "logiciel devis facturation", articleType: "guide" })
    expect(guide.checks.find((c) => c.id === "kw-fit")).toBeUndefined()
  })
})

describe("consignes de titre", () => {
  it("how-to : « Comment » en premier ; FAQ : la question ; actualité ; guide", () => {
    expect(titleDirectives("howto", "question").join("\n")).toMatch(/« Comment » en premier/)
    expect(titleDirectives("faq", "other").join("\n")).toMatch(/la question telle qu'on la pose/)
    expect(titleDirectives("news", "other").join("\n")).toMatch(/ce qui change/)
    expect(titleDirectives("guide", "other").join("\n")).toMatch(/nomme le sujet avec les mots de la recherche/)
  })

  it("mot-clé d'achat sur un how-to : jamais en préfixe", () => {
    const rules = titleDirectives("howto", "buy").join("\n")
    expect(rules).toMatch(/ne placez PAS le mot-clé en préfixe/)
    expect(titleDirectives("guide", "buy").join("\n")).not.toMatch(/ne placez PAS/)
  })

  it("la consigne des propositions de titre reçoit le type, le langage de la recherche et l'avertissement", () => {
    const prompt = buildSuggestPrompt({
      field: "seoTitle",
      keyword: "logiciel devis facturation",
      articleType: "howto",
      title: "Comment facturer un chantier",
      content: "Texte.",
    })
    expect(prompt).toMatch(/Type d'article : how-to/)
    expect(prompt).toMatch(/LANGAGE DE LA RECHERCHE/)
    expect(prompt).toMatch(/« Comment » en premier/)
    expect(prompt).toMatch(/ATTENTION : Recherche d'achat de logiciel/)
    expect(prompt).toContain(FREE_RULE)
    // La description n'a pas le bloc des titres
    const description = buildSuggestPrompt({ field: "seoDescription", keyword: "comment facturer un chantier", articleType: "howto", title: "t", content: "c" })
    expect(description).not.toMatch(/LANGAGE DE LA RECHERCHE/)
  })

  it("plan de rédaction et consigne système portent les mêmes règles", () => {
    const brief = {
      title: "Facturer un chantier",
      keyword: "comment facturer un chantier",
      articleType: "howto" as const,
      angle: null,
      lengthMin: 800,
      lengthMax: 1200,
      faq: null,
      notes: null,
    }
    const plan = buildPlanPrompt(brief, { existingTitles: [] })
    expect(plan).toMatch(/FORMULATION DU TITRE/)
    expect(plan).toMatch(/« Comment » en premier/)
    expect(plan).not.toMatch(/avec le mot-clé cible si c'est naturel/)
    const system = buildSystemPrompt({ brand: SETTINGS_DEFAULTS.brand, strategy: SETTINGS_DEFAULTS.strategy, prefs: SETTINGS_DEFAULTS.articles })
    expect(system).toContain(FREE_RULE)
  })
})

describe("« gratuit »", () => {
  it("la règle dit ce qui est gratuit et ce qui ne l'est pas", () => {
    expect(FREE_RULE).toMatch(/devis/)
    expect(FREE_RULE).toMatch(/générateur/)
    expect(FREE_RULE).toMatch(/Essentiel/)
    expect(FREE_RULE).toMatch(/jamais que facturer avec Qonforme est gratuit/)
  })

  it("« facture gratuite » reste permis pour le générateur, refusé quand Qonforme est présenté gratuit", () => {
    expect(rejectReason("seoTitle", "Comment faire une facture gratuite : modèle et générateur en ligne", [])).toBeNull()
    expect(rejectReason("seoTitle", "Facturer gratuitement avec Qonforme dès le premier devis", [])).toBe("affirmation")
    expect(rejectReason("title", "Facture gratuite avec Qonforme : mode d'emploi pour artisans", [])).toBe("affirmation")
  })
})

describe("propositions de titre d'un how-to", () => {
  const ctx = { keyword: "logiciel devis facturation", competitors: [], articleType: "howto" as const }

  it("refuse le mot-clé d'achat en préfixe et garde la phrase de la recherche", () => {
    const res = filterSuggestions(
      "seoTitle",
      [
        "Logiciel devis facturation : facturer un chantier sans oubli",
        "Logiciel devis facturation – la liste de contrôle chantier",
        "Comment facturer un chantier : la liste de contrôle complète",
        "Comment facturer un chantier étape par étape, sans oubli",
      ],
      ctx,
    )
    expect(res.suggestions.map((s) => s.text)).toEqual([
      "Comment facturer un chantier : la liste de contrôle complète",
      "Comment facturer un chantier étape par étape, sans oubli",
    ])
    expect(res.rejected).toBe(2)
  })

  it("une question passe avant : « Comment » en tête pour un how-to, « ? » pour une FAQ", () => {
    const how = filterSuggestions(
      "seoTitle",
      ["Facturer un chantier sans oubli : la méthode de l'artisan", "Comment facturer un chantier sans oubli, la méthode de l'artisan"],
      { ...ctx, keyword: "comment facturer un chantier" },
    )
    expect(how.suggestions[0].text).toMatch(/^Comment /)
    const faq = filterSuggestions(
      "seoTitle",
      ["Facturer sans numéro de TVA : ce que dit la règle", "Peut-on facturer sans numéro de TVA : ce que dit la règle ?"],
      { keyword: "peut-on facturer sans numéro de tva", competitors: [], articleType: "faq" },
    )
    expect(faq.suggestions[0].text).toMatch(/\?$/)
  })

  it("un mot-clé qui convient garde son préfixe (guide ou question)", () => {
    expect(rejectReason("seoTitle", "TVA des travaux : 20 %, 10 % ou 5,5 %, comment choisir", [], { keyword: "tva des travaux", articleType: "guide" })).toBeNull()
    expect(rejectReason("seoTitle", "Logiciel devis facturation : comment choisir", [], { keyword: "logiciel devis facturation", articleType: "guide" })).toBeNull()
  })
})
