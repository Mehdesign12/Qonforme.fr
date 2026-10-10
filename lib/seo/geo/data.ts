/**
 * Lectures des écrans « Visibilité IA » (pages serveur). Chaque lecture en échec lève
 * SeoDbError (migration absente ou lecture impossible) : jamais une liste vide à la place.
 */
import { must, type SeoDb } from "@/lib/seo/db"
import { RUN_COLUMNS } from "@/lib/seo/geo/runner"
import type { GeoKeywordRef } from "@/lib/seo/geo/question-view"
import type { GeoAnswerRow, GeoQuestionRow, GeoRunRow } from "@/lib/seo/geo/types"

/** Relevés les plus récents d'abord. */
export async function readRuns(db: SeoDb, limit = 36): Promise<GeoRunRow[]> {
  return (must(
    await db.from("seo_geo_runs").select(RUN_COLUMNS).order("created_at", { ascending: false }).limit(limit),
    "les relevés de visibilité IA",
  ) ?? []) as GeoRunRow[]
}

export async function readQuestions(db: SeoDb): Promise<GeoQuestionRow[]> {
  return (must(
    await db.from("seo_geo_questions").select("id, question, position, active, created_at, updated_at").order("position", { ascending: true }),
    "les questions suivies",
  ) ?? []) as GeoQuestionRow[]
}

export type GeoCell = Pick<GeoAnswerRow, "question_id" | "engine" | "repetition" | "status" | "brand_mentioned" | "site_cited" | "error">

/** Réponses d'un relevé, sans leur texte (tableau « Questions suivies »). */
export async function readRunCells(db: SeoDb, runId: string): Promise<GeoCell[]> {
  return (must(
    await db.from("seo_geo_answers").select("question_id, engine, repetition, status, brand_mentioned, site_cited, error").eq("run_id", runId),
    "les réponses du relevé",
  ) ?? []) as GeoCell[]
}

const ANSWER_COLUMNS =
  "id, run_id, question_id, question, engine, repetition, status, answer, sources, brand_mentioned, site_cited, competitors_mentioned, competitors_cited, model, attempts, lock_until, error, created_at, done_at"

/** Réponses complètes d'une question dans un relevé. */
export async function readQuestionAnswers(db: SeoDb, runId: string, questionId: string): Promise<GeoAnswerRow[]> {
  return (must(
    await db.from("seo_geo_answers").select(ANSWER_COLUMNS).eq("run_id", runId).eq("question_id", questionId).order("repetition", { ascending: true }),
    "les réponses de la question",
  ) ?? []) as GeoAnswerRow[]
}

/**
 * Parmi `runIds` (les relevés lus, 36 au plus), ceux qui ont interrogé la question.
 * Au plus 36 relevés × 5 moteurs × 5 répétitions = 900 lignes : sous le plafond de
 * 1 000 lignes d'une réponse de Supabase, donc aucun relevé perdu au hasard.
 */
export async function readQuestionRunIds(db: SeoDb, questionId: string, runIds: string[]): Promise<string[]> {
  if (runIds.length === 0) return []
  const rows = (must(
    await db.from("seo_geo_answers").select("run_id").eq("question_id", questionId).in("run_id", runIds),
    "les relevés de la question",
  ) ?? []) as { run_id: string }[]
  return Array.from(new Set(rows.map((r) => r.run_id)))
}

/**
 * Parmi `questionIds`, celles qu'au moins un des relevés `runIds` a posées (une lecture
 * d'une ligne par question : en pratique zéro à deux questions).
 */
export async function readAskedQuestionIds(db: SeoDb, questionIds: string[], runIds: string[]): Promise<string[]> {
  if (questionIds.length === 0 || runIds.length === 0) return []
  const found = await Promise.all(
    questionIds.map(async (id) => {
      const rows = (must(
        await db.from("seo_geo_answers").select("question_id").eq("question_id", id).in("run_id", runIds).limit(1),
        "les relevés des questions",
      ) ?? []) as { question_id: string }[]
      return rows.length > 0 ? id : null
    }),
  )
  return found.filter((id): id is string => id !== null)
}

export interface GeoTopicRef {
  id: string
  title: string
  status: string
}

/**
 * Sujet d'article déjà créé pour une question, archivé compris (un seul par question :
 * index seo_topics_one_per_geo_question) ; un sujet actif passe avant un archivé.
 */
export async function readTopicForQuestion(db: SeoDb, questionId: string): Promise<GeoTopicRef | null> {
  const rows = (must(
    await db.from("seo_topics").select("id, title, status").eq("geo_question_id", questionId).order("created_at", { ascending: false }).limit(10),
    "les sujets d'articles",
  ) ?? []) as GeoTopicRef[]
  return rows.find((t) => t.status !== "archived") ?? rows[0] ?? null
}

/** Mots-clés ciblés ou couverts qui ont une page cible (« Page ciblée » du détail d'une question). */
export async function readTargetKeywords(db: SeoDb): Promise<GeoKeywordRef[]> {
  const rows = (must(
    await db.from("seo_keywords").select("id, keyword, status, target_path").in("status", ["targeted", "covered"]).limit(1000),
    "les mots-clés suivis",
  ) ?? []) as GeoKeywordRef[]
  return rows.filter((k) => Boolean(k.target_path))
}
