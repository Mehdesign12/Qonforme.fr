/**
 * Visibilité IA (suivi GEO) : types propres au module (PLAN-SEO-INTERNE-2026-10.md § 3).
 *
 * Les libellés partagés (moteurs, états de connexion) vivent dans lib/seo/types.ts ;
 * ce fichier ne porte que les formes de données du relevé.
 */
import type { GeoEngine, GeoRunSummary } from "@/lib/seo/types"

/** Une source citée par un moteur. `domain` : hôte sans « www. » ; vide si inconnu. */
export interface GeoSource {
  url: string
  domain: string
  title: string
}

/** Réponse d'un moteur à une question. */
export interface GeoEngineAnswer {
  /** Texte de la réponse ; null quand le moteur n'a rien répondu (ex. pas d'Aperçu IA pour la requête). */
  answer: string | null
  sources: GeoSource[]
  /** Modèle réellement utilisé (« gemini-2.5-flash »…). */
  model: string
}

export interface GeoAskOptions {
  /** Marché suivi (« France »), réglage geo.market. */
  market: string
  /** Langue des réponses (« français »), réglage geo.language. */
  language: string
  /** Délai maximal de l'appel (ms) ; 90 s par défaut. */
  timeoutMs?: number
}

export interface GeoEngineClient {
  key: GeoEngine
  /** Vrai si les variables d'environnement du moteur sont présentes. */
  isConfigured(): boolean
  ask(question: string, opts: GeoAskOptions): Promise<GeoEngineAnswer>
}

export type GeoRunKind = "monthly" | "immediate" | "import"
export type GeoRunStatus = "queued" | "running" | "done" | "failed" | "cancelled"
export type GeoAnswerStatus = "pending" | "running" | "done" | "failed" | "skipped"

/** Ligne de seo_geo_runs. */
export interface GeoRunRow {
  id: string
  kind: GeoRunKind
  status: GeoRunStatus
  engines: string[]
  repetitions: number
  created_at: string
  started_at: string | null
  finished_at: string | null
  summary: GeoRunSummary | null
  note: string | null
}

/** Ligne de seo_geo_questions. */
export interface GeoQuestionRow {
  id: string
  question: string
  position: number
  active: boolean
  created_at: string
  updated_at: string
}

/** Ligne de seo_geo_answers. */
export interface GeoAnswerRow {
  id: string
  run_id: string
  question_id: string | null
  question: string
  engine: string
  repetition: number
  status: GeoAnswerStatus
  answer: string | null
  sources: GeoSource[] | null
  brand_mentioned: boolean | null
  site_cited: boolean | null
  competitors_mentioned: string[] | null
  competitors_cited: string[] | null
  model: string | null
  attempts: number
  lock_until: string | null
  error: string | null
  created_at: string
  done_at: string | null
}

/** Progression d'un relevé (écran « Analyse en cours : x / y réponses »). */
export interface GeoProgress {
  runId: string
  /** Réponses traitées (obtenues ou en échec définitif). */
  done: number
  total: number
  status: GeoRunStatus
}
