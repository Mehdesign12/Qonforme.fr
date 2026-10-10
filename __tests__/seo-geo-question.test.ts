/**
 * Visibilité IA › détail d'une question (défaut confirmé de la relecture) : le relevé
 * importé de PushRank ne porte que sur ses 8 premières questions, il n'est jamais proposé
 * aux questions ajoutées ensuite (« Pas encore relevée ») ; la carte « Que faire »
 * n'affirme que ce qui a été mesuré et renvoie vers la page qu'un mot-clé suivi cible
 * déjà avant de proposer un sujet (pas de doublon avec un guide en ligne).
 * Données reprises de la migration (section 11).
 */
import { beforeAll, describe, expect, it, vi } from "vitest"
import * as React from "react"
import { renderToStaticMarkup } from "react-dom/server"

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: () => {}, replace: () => {}, refresh: () => {} }),
  usePathname: () => "/admin/seo/visibilite-ia",
  useSearchParams: () => new URLSearchParams(""),
}))

import {
  importCovers,
  matchQuestionKeyword,
  notYetQuestionIds,
  questionRunCandidates,
  selectRun,
  shouldSuggestTopic,
  whatToDoOf,
  type GeoKeywordRef,
} from "@/lib/seo/geo/question-view"
import type { GeoAnswerRow, GeoQuestionRow, GeoRunRow } from "@/lib/seo/geo/types"
import type { GeoRunSummary } from "@/lib/seo/types"

/* ------------------------------------------------------------------ */
/* Données de la migration (section 11)                                */
/* ------------------------------------------------------------------ */

const QUESTIONS: GeoQuestionRow[] = [
  "Quel logiciel de devis et de facturation est le plus adapté aux artisans du bâtiment en France ?",
  "Comment gérer des devis et des factures pour plusieurs chantiers au quotidien avec un seul outil ?",
  "Peut-on faire des devis gratuits et illimités avec un logiciel de devis pour artisans du bâtiment ?",
  "Quelles sont les mentions obligatoires à inclure sur une facture d'artisan en France ?",
  "Comment éviter les erreurs de facturation grâce aux mentions obligatoires et aux modèles ?",
  "Comment automatiser l'envoi de relances pour les factures impayées ?",
  "Comment générer un devis en PDF prêt à envoyer à un client ?",
  "Comment créer un modèle de facture et le réutiliser pour chaque nouveau client ?",
  "Quelle plateforme agréée choisir pour la facture électronique quand on est artisan ?",
  "Quel taux de TVA appliquer sur des travaux de rénovation chez un particulier ?",
].map((question, i) => ({
  id: `q-${i + 1}`,
  question,
  position: i + 1,
  active: true,
  created_at: "2026-10-09T08:00:00Z",
  updated_at: "2026-10-09T08:00:00Z",
}))
const q = (n: number) => QUESTIONS[n - 1]

const IMPORT_SUMMARY: GeoRunSummary = {
  questions: 8,
  engines: { chatgpt: { mention_rate: 0, citation_rate: 0, mentions: 0, citations: 0, answers: 10 } },
  overall: { mention_rate: 0, citation_rate: 0 },
  domains: { "qonforme.fr": { mention_rate: null, citation_rate: 0 }, "tolteck.com": { mention_rate: null, citation_rate: 0.06 } },
}

const IMPORT: GeoRunRow = {
  id: "run-import",
  kind: "import",
  status: "done",
  engines: ["chatgpt", "claude", "gemini", "perplexity", "google_ai_overview"],
  repetitions: 1,
  created_at: "2026-09-28T12:00:00Z",
  started_at: "2026-09-28T12:00:00Z",
  finished_at: "2026-09-28T12:00:00Z",
  summary: IMPORT_SUMMARY,
  note: null,
}

const KEYWORDS: GeoKeywordRef[] = [
  { id: "k-1", keyword: "devis modele", status: "covered", target_path: "/modele" },
  { id: "k-2", keyword: "modele devis", status: "covered", target_path: "/modele" },
  { id: "k-3", keyword: "factures mentions obligatoires", status: "covered", target_path: "/guide/mentions-obligatoires-facture" },
  { id: "k-4", keyword: "logiciel devis facturation", status: "targeted", target_path: "/" },
  { id: "k-5", keyword: "modeles factures", status: "candidate", target_path: "/modele" },
  { id: "k-6", keyword: "modele facture", status: "covered", target_path: "/modele" },
  { id: "k-8", keyword: "plateforme agréée e-facture", status: "covered", target_path: "/guide/plateforme-agreee" },
  { id: "k-9", keyword: "comment faire un devis artisan", status: "covered", target_path: "/guide/comment-faire-un-devis" },
  { id: "k-10", keyword: "taux de tva travaux", status: "covered", target_path: "/guide/tva-travaux" },
  { id: "k-11", keyword: "logiciel facturation artisans", status: "candidate", target_path: null },
  { id: "k-14", keyword: "relances automatiques factures", status: "candidate", target_path: null },
]

function answer(patch: Partial<GeoAnswerRow>): GeoAnswerRow {
  return {
    id: "a",
    run_id: "run-1",
    question_id: "q-1",
    question: "Q ?",
    engine: "gemini",
    repetition: 1,
    status: "done",
    answer: "Réponse.",
    sources: [],
    brand_mentioned: false,
    site_cited: false,
    competitors_mentioned: [],
    competitors_cited: [],
    model: "m",
    attempts: 1,
    lock_until: null,
    error: null,
    created_at: "2026-10-09T08:00:00Z",
    done_at: "2026-10-09T08:01:00Z",
    ...patch,
  }
}

/* ------------------------------------------------------------------ */
/* Relevé importé : seulement les questions qu'il a couvertes          */
/* ------------------------------------------------------------------ */

describe("relevé importé de PushRank", () => {
  it("couvre les positions 1 à 8, jamais les questions 9 et 10 ajoutées ensuite", () => {
    expect(importCovers(IMPORT, 1)).toBe(true)
    expect(importCovers(IMPORT, 8)).toBe(true)
    expect(importCovers(IMPORT, 9)).toBe(false)
    expect(importCovers(IMPORT, 10)).toBe(false)
    expect(importCovers({ ...IMPORT, summary: { ...IMPORT_SUMMARY, questions: undefined } }, 1)).toBe(false)
    expect(importCovers({ ...IMPORT, kind: "monthly" }, 1)).toBe(false)
  })

  it("question 9 jamais relevée : aucun relevé proposé, donc « Pas encore relevée »", () => {
    const candidates = questionRunCandidates([IMPORT], [], q(9))
    expect(candidates).toEqual([])
    expect(selectRun(candidates, null)).toBeNull()
    // Même en forçant ?releve= sur l'import
    expect(selectRun(candidates, IMPORT.id)).toBeNull()
  })

  it("question 4 couverte : l'import reste proposé ; un relevé mesuré passe avant lui", () => {
    expect(selectRun(questionRunCandidates([IMPORT], [], q(4)), null)?.id).toBe("run-import")
    const measured: GeoRunRow = { ...IMPORT, id: "run-1", kind: "immediate", summary: null, created_at: "2026-10-09T08:00:00Z" }
    const both = questionRunCandidates([measured, IMPORT], ["run-1"], q(4))
    expect(both.map((r) => r.id)).toEqual(["run-1", "run-import"])
    expect(selectRun(both, null)?.id).toBe("run-1")
    expect(selectRun(both, "run-import")?.id).toBe("run-import")
  })

  it("tableau : questions 9 et 10 marquées « Pas encore relevée » sous l'import ; sous un relevé mesuré, celles sans réponse", () => {
    expect(notYetQuestionIds(IMPORT, QUESTIONS, [])).toEqual(["q-9", "q-10"])
    const measured: GeoRunRow = { ...IMPORT, id: "run-1", kind: "immediate" }
    expect(notYetQuestionIds(measured, QUESTIONS.slice(0, 3), [{ question_id: "q-1" }, { question_id: "q-2" }])).toEqual(["q-3"])
    expect(notYetQuestionIds(null, QUESTIONS, [])).toEqual([])
  })
})

/* ------------------------------------------------------------------ */
/* Page déjà ciblée par un mot-clé suivi                               */
/* ------------------------------------------------------------------ */

describe("page ciblée par un mot-clé suivi", () => {
  it("rattache les questions aux guides qui y répondent déjà (pas de sujet en doublon)", () => {
    expect(matchQuestionKeyword(q(1).question, KEYWORDS)?.target_path).toBe("/")
    expect(matchQuestionKeyword(q(4).question, KEYWORDS)?.target_path).toBe("/guide/mentions-obligatoires-facture")
    expect(matchQuestionKeyword(q(8).question, KEYWORDS)?.target_path).toBe("/modele")
    expect(matchQuestionKeyword(q(9).question, KEYWORDS)?.target_path).toBe("/guide/plateforme-agreee")
    expect(matchQuestionKeyword(q(10).question, KEYWORDS)?.target_path).toBe("/guide/tva-travaux")
  })

  it("aucune page : ni candidat, ni mot-clé sans page, ni correspondance partielle", () => {
    expect(matchQuestionKeyword(q(2).question, KEYWORDS)).toBeNull()
    expect(matchQuestionKeyword(q(5).question, KEYWORDS)).toBeNull() // « facturation » n'est pas « facture »
    expect(matchQuestionKeyword(q(6).question, KEYWORDS)).toBeNull() // mot-clé candidat, sans page
    expect(matchQuestionKeyword(q(7).question, KEYWORDS)).toBeNull()
    expect(matchQuestionKeyword("Quel devis ?", [{ id: "k", keyword: "devis", status: "covered", target_path: "/modele" }])).toBeNull()
  })
})

/* ------------------------------------------------------------------ */
/* Que faire : seulement ce qui a été mesuré                           */
/* ------------------------------------------------------------------ */

describe("carte « Que faire »", () => {
  it("jamais de sujet déduit du relevé importé (réponses non conservées)", () => {
    const what = whatToDoOf({ imported: true, importSummary: IMPORT_SUMMARY, answers: [] })
    expect(what).toEqual({ kind: "import", notCited: true })
    expect(shouldSuggestTopic(what, null)).toBe(false)
  })

  it("mesurée sans citation : sujet proposé seulement si aucune page n'est déjà ciblée", () => {
    const what = whatToDoOf({
      imported: false,
      importSummary: null,
      answers: [answer({ engine: "gemini" }), answer({ engine: "chatgpt" }), answer({ engine: "chatgpt", status: "failed" })],
    })
    expect(what).toEqual({ kind: "not_cited", asked: 2 })
    expect(shouldSuggestTopic(what, null)).toBe(true)
    expect(shouldSuggestTopic(what, KEYWORDS[2])).toBe(false)
  })

  it("aucune réponse obtenue, ou citée : pas de sujet", () => {
    const none = whatToDoOf({ imported: false, importSummary: null, answers: [answer({ status: "failed" })] })
    expect(none).toEqual({ kind: "none" })
    expect(shouldSuggestTopic(none, null)).toBe(false)
    const cited = whatToDoOf({
      imported: false,
      importSummary: null,
      answers: [answer({ site_cited: true, sources: [{ url: "https://qonforme.fr/guide/tva-travaux", domain: "qonforme.fr", title: "" }] }), answer({ engine: "chatgpt" })],
    })
    expect(cited).toEqual({ kind: "cited", engines: ["gemini"], asked: 2, paths: ["/guide/tva-travaux"] })
    expect(shouldSuggestTopic(cited, null)).toBe(false)
  })
})

describe("rendu de la carte « Que faire »", () => {
  let WhatToDoCard: typeof import("@/components/admin/seo/geo/QuestionDetail").WhatToDoCard
  beforeAll(async () => {
    // Le JSX du dépôt est compilé en React.createElement : React doit être global
    ;(globalThis as unknown as { React: typeof React }).React = React
    ;({ WhatToDoCard } = await import("@/components/admin/seo/geo/QuestionDetail"))
  })
  const render = (props: Partial<Parameters<typeof WhatToDoCard>[0]>) =>
    renderToStaticMarkup(
      React.createElement(WhatToDoCard, { questionId: "q-1", answers: [], imported: false, importSummary: null, topic: null, keyword: null, ...props }),
    )

  it("relevé importé : constat mesuré seulement, ni « aucune page ne répond », ni « Créer un sujet »", () => {
    const html = render({ imported: true, importSummary: IMPORT_SUMMARY })
    expect(html).toContain("Aucun moteur n&#x27;y citait qonforme.fr")
    expect(html).not.toMatch(/aucune page/i)
    expect(html).not.toContain("Créer un sujet")
  })

  it("question jamais relevée : invite à lancer une analyse, sans conclusion", () => {
    const html = render({})
    expect(html).toContain("Pas encore de réponse obtenue")
    expect(html).not.toMatch(/aucune page|Créer un sujet|citait/i)
  })

  it("non citée mais page déjà ciblée : « Page ciblée … Voir dans Mots-clés », pas de nouveau sujet", () => {
    const html = render({ answers: [answer({})], keyword: KEYWORDS[3] })
    expect(html).toContain("qonforme.fr n&#x27;est pas cité par le moteur interrogé")
    expect(html).toContain("Page ciblée : Accueil")
    expect(html).toContain("mot-clé « logiciel devis facturation », Ciblé")
    expect(html).toContain('href="/admin/seo/mots-cles?mot-cle=k-4"')
    expect(html).not.toContain("Créer un sujet")
  })

  it("non citée, aucune page ciblée : vérifier les pages existantes avant de créer un sujet", () => {
    const html = render({ answers: [answer({}), answer({ engine: "chatgpt" })] })
    expect(html).toContain("aucun des 2 moteurs interrogés")
    expect(html).toContain("Avant de créer un sujet")
    expect(html).toContain('href="/admin/seo/mots-cles"')
    expect(html).toContain("Créer un sujet")
    expect(html).not.toMatch(/aucune page de qonforme/i)
  })
})
