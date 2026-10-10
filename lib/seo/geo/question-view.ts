/**
 * Détail d'une question suivie (planche Visibilite-question) : relevés qui la concernent
 * et carte « Que faire ». Module pur.
 *
 * - Le relevé importé de PushRank (taux seulement) ne porte que sur ses
 *   `summary.questions` premières questions : il n'est jamais proposé à une question
 *   ajoutée ensuite (« Pas encore relevée »).
 * - « Que faire » n'affirme que ce qui a été mesuré, et renvoie vers la page qu'un
 *   mot-clé suivi cible déjà avant de proposer un sujet d'article (pas de doublon).
 */
import { SITE_HOST, toSitePath } from "@/lib/seo/site"
import type { GeoRunSummary, KeywordStatus } from "@/lib/seo/types"
import type { GeoAnswerRow, GeoQuestionRow, GeoRunRow } from "@/lib/seo/geo/types"

/* ------------------------------------------------------------------ */
/* Relevés d'une question                                              */
/* ------------------------------------------------------------------ */

/** Vrai si le relevé importé a porté sur la question de cette position (positions 1 à `summary.questions`). */
export function importCovers(run: Pick<GeoRunRow, "kind" | "status" | "summary">, position: number): boolean {
  if (run.kind !== "import" || run.status !== "done") return false
  const count = run.summary?.questions
  return typeof count === "number" && position >= 1 && position <= count
}

/** Relevés proposés pour une question : ceux qui l'ont interrogée, et l'import s'il l'a couverte. */
export function questionRunCandidates(runs: GeoRunRow[], runIds: string[], question: Pick<GeoQuestionRow, "position">): GeoRunRow[] {
  return runs.filter((r) => r.status !== "cancelled" && (runIds.includes(r.id) || importCovers(r, question.position)))
}

/** Relevé affiché : celui demandé, sinon le dernier mesuré, sinon l'import, sinon le plus récent. */
export function selectRun(candidates: GeoRunRow[], requested?: string | null): GeoRunRow | null {
  return (
    candidates.find((r) => r.id === requested) ??
    candidates.find((r) => r.status === "done" && r.kind !== "import") ??
    candidates.find((r) => r.status === "done") ??
    candidates[0] ??
    null
  )
}

/**
 * Questions que le relevé affiché n'a pas posées (« Pas encore relevée ») : hors des
 * positions couvertes par l'import, ou sans aucune réponse dans un relevé mesuré.
 */
export function notYetQuestionIds(
  run: Pick<GeoRunRow, "kind" | "status" | "summary"> | null,
  questions: Pick<GeoQuestionRow, "id" | "position">[],
  cells: { question_id: string | null }[],
): string[] {
  if (!run) return []
  if (run.kind === "import") return questions.filter((q) => !importCovers(run, q.position)).map((q) => q.id)
  const asked = new Set(cells.map((c) => c.question_id))
  return questions.filter((q) => !asked.has(q.id)).map((q) => q.id)
}

/* ------------------------------------------------------------------ */
/* Page déjà ciblée par un mot-clé suivi                               */
/* ------------------------------------------------------------------ */

export interface GeoKeywordRef {
  id: string
  keyword: string
  status: KeywordStatus
  target_path: string | null
}

/** Mots significatifs : minuscules, sans accents, 3 lettres au moins, sans « s » ni « x » final. */
function tokensOf(text: string): string[] {
  return text
    .toLocaleLowerCase("fr-FR")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length >= 3)
    .map((t) => (t.length > 3 ? t.replace(/[sx]$/, "") : t))
}

/**
 * Mot-clé ciblé ou couvert, avec une page cible, dont tous les mots significatifs (deux
 * au moins) figurent dans la question ; le plus précis d'abord, puis « Couvert ».
 */
export function matchQuestionKeyword(question: string, keywords: GeoKeywordRef[]): GeoKeywordRef | null {
  const words = new Set(tokensOf(question))
  const matches = keywords
    .filter((k) => (k.status === "targeted" || k.status === "covered") && Boolean(k.target_path))
    .map((k) => ({ k, tokens: Array.from(new Set(tokensOf(k.keyword))) }))
    .filter(({ tokens }) => tokens.length >= 2 && tokens.every((t) => words.has(t)))
    .sort(
      (a, b) =>
        b.tokens.length - a.tokens.length ||
        Number(b.k.status === "covered") - Number(a.k.status === "covered") ||
        a.k.keyword.localeCompare(b.k.keyword, "fr"),
    )
  return matches[0]?.k ?? null
}

/* ------------------------------------------------------------------ */
/* Que faire                                                           */
/* ------------------------------------------------------------------ */

export type WhatToDo =
  /** Relevé importé : taux seulement, réponses non conservées. `notCited` : qonforme.fr n'y était cité par aucun moteur. */
  | { kind: "import"; notCited: boolean }
  /** Aucune réponse obtenue pour cette question dans le relevé affiché (ou aucun relevé). */
  | { kind: "none" }
  /** Réponses obtenues, qonforme.fr cité par aucun moteur. */
  | { kind: "not_cited"; asked: number }
  | { kind: "cited"; engines: string[]; asked: number; paths: string[] }

type AnswerLike = Pick<GeoAnswerRow, "status" | "engine" | "site_cited" | "sources">

export function whatToDoOf(opts: { imported: boolean; importSummary: GeoRunSummary | null; answers: AnswerLike[] }): WhatToDo {
  if (opts.imported) return { kind: "import", notCited: opts.importSummary?.domains?.[SITE_HOST]?.citation_rate === 0 }
  const done = opts.answers.filter((a) => a.status === "done")
  if (done.length === 0) return { kind: "none" }
  const asked = Array.from(new Set(done.map((a) => a.engine))).length
  const engines = Array.from(new Set(done.filter((a) => a.site_cited).map((a) => a.engine)))
  if (engines.length === 0) return { kind: "not_cited", asked }
  const paths = Array.from(
    new Set(
      done
        .flatMap((a) => (a.sources ?? []).map((s) => s.url))
        .map((u) => toSitePath(u))
        .filter((p): p is string => Boolean(p)),
    ),
  )
  return { kind: "cited", engines, asked, paths }
}

/**
 * « Créer un sujet » : seulement pour une question mesurée où qonforme.fr n'est cité par
 * aucun moteur, et qu'aucun mot-clé suivi ne rattache déjà à une page. Jamais d'après le
 * relevé importé (aucune réponse conservée).
 */
export function shouldSuggestTopic(what: WhatToDo, keyword: GeoKeywordRef | null): boolean {
  return what.kind === "not_cited" && !keyword
}
