/**
 * Relevés de la visibilité IA (PLAN-SEO-INTERNE-2026-10.md § 3).
 *
 * - `createRun(kind)` : un relevé (seo_geo_runs) et une réponse « pending » par question
 *   active × moteur allumé ET configuré × répétition ; refusé (409) s'il y en a déjà un
 *   en attente ou en cours.
 * - `processPending` : prend les réponses en attente (verrou lock_until, 3 en parallèle
 *   au plus), interroge le moteur, repère mention, citation et concurrents, enregistre
 *   (2 essais au plus) ; quand plus rien n'attend, calcule le résumé et clôt le relevé.
 *   Chaque appel lancé compte comme un essai, dès la prise de la réponse : un délai
 *   dépassé, ou un appel interrompu, n'est jamais relancé sans fin (ni payé sans fin) ;
 *   tout relevé finit donc par se clore.
 * - `cancelRun` : « Arrêter le relevé » ; les réponses non obtenues sont écartées et le
 *   relevé est clos avec ce qui a déjà été obtenu.
 *
 * Travail par paquets : « Analyse immédiate » appelle /step en boucle tant que l'écran
 * est ouvert ; la tâche planifiée (lib/seo/geo/task.ts) finit le reste.
 */
import { must, SeoDbError, type SeoDb } from "@/lib/seo/db"
import { getSettings } from "@/lib/seo/settings"
import { GEO_ENGINES, type GeoEngine } from "@/lib/seo/types"
import { brandTermsOf, detect } from "@/lib/seo/geo/detect"
import { ENGINE_CLIENTS, isGeoEngine } from "@/lib/seo/geo/engines"
import { ENGINE_TIMEOUT_MS, GeoEngineError, isTimeout } from "@/lib/seo/geo/engines/http"
import { competitorInQuestion } from "@/lib/seo/geo/questions"
import { computeSummary } from "@/lib/seo/geo/summary"
import type { GeoAnswerRow, GeoEngineClient, GeoProgress, GeoRunKind, GeoRunRow, GeoRunStatus } from "@/lib/seo/geo/types"

export const RUN_COLUMNS = "id, kind, status, engines, repetitions, created_at, started_at, finished_at, summary, note"
const ACTIVE: GeoRunStatus[] = ["queued", "running"]
/** Essais par réponse. */
export const MAX_ATTEMPTS = 2
/** Réponses interrogées en parallèle. */
export const CONCURRENCY = 3
/** Temps minimal pour lancer un nouvel appel. */
export const MIN_CALL_BUDGET_MS = 20_000
/** Marge du verrou au-delà du délai d'un appel. */
const LOCK_MARGIN_MS = 60_000
/** Pause avant un nouvel essai après une erreur passagère (plus longue sur une limite de débit). */
export const RETRY_DELAY_MS = 60_000
export const RATE_LIMIT_RETRY_DELAY_MS = 120_000
/** Un relevé encore sans réponses est en cours de création (createRun insère ses réponses juste après). */
const CREATION_GRACE_MS = 5 * 60_000

export class GeoRunConflictError extends Error {
  constructor(readonly runId: string | null) {
    super("Un relevé est déjà en cours : attendez qu'il se termine.")
    this.name = "GeoRunConflictError"
  }
}

/** Aucun moteur à interroger ou aucune question active. */
export class GeoRunUnavailableError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "GeoRunUnavailableError"
  }
}

type Clients = Record<GeoEngine, GeoEngineClient>

/** Relevé en attente ou en cours (au plus un). */
export async function activeRun(db: SeoDb): Promise<GeoRunRow | null> {
  const rows = must(
    await db.from("seo_geo_runs").select(RUN_COLUMNS).in("status", ACTIVE).order("created_at", { ascending: false }).limit(1),
    "les relevés de visibilité IA",
  ) as GeoRunRow[] | null
  return rows?.[0] ?? null
}

/** Moteurs interrogés par un nouveau relevé : allumés dans les réglages et configurés. */
export function runnableEngines(enabled: Record<string, boolean>, clients: Clients = ENGINE_CLIENTS): GeoEngine[] {
  return GEO_ENGINES.filter((e) => enabled[e.key] && clients[e.key].isConfigured()).map((e) => e.key)
}

export async function createRun(
  db: SeoDb,
  kind: Exclude<GeoRunKind, "import">,
  opts: { now?: Date; clients?: Clients } = {},
): Promise<{ run: GeoRunRow; total: number }> {
  const now = opts.now ?? new Date()
  const current = await activeRun(db)
  if (current) throw new GeoRunConflictError(current.id)

  const geo = (await getSettings(db, "geo")).value
  const engines = runnableEngines(geo.engines, opts.clients)
  if (engines.length === 0) {
    throw new GeoRunUnavailableError(
      "Aucun moteur à interroger : allumez un moteur dont la clé est configurée (Gérer le suivi, Paramètres › Connexions).",
    )
  }
  const active = (must(
    await db.from("seo_geo_questions").select("id, question, position").eq("active", true).order("position", { ascending: true }),
    "les questions suivies",
  ) ?? []) as { id: string; question: string; position: number }[]
  if (active.length === 0) {
    throw new GeoRunUnavailableError("Aucune question active : cochez au moins une question dans « Gérer le suivi ».")
  }
  // Une question qui nomme un concurrent suivi (ajouté après coup dans Paramètres › Ciblage)
  // ne part jamais chez les moteurs : les concurrents restent dans l'admin (usage interne).
  const competitors = (await getSettings(db, "targeting")).value.competitors
  const questions = active.filter((q) => competitorInQuestion(q.question, competitors) === null)
  const skipped = active.length - questions.length
  if (questions.length === 0) {
    throw new GeoRunUnavailableError(
      "Aucune question à poser : les questions actives nomment un concurrent suivi. Reformulez-les dans « Gérer le suivi ».",
    )
  }
  const note =
    skipped > 0
      ? `${skipped} question${skipped > 1 ? "s" : ""} écartée${skipped > 1 ? "s" : ""} : ${skipped > 1 ? "elles nomment" : "elle nomme"} un concurrent suivi.`
      : null

  const inserted = await db
    .from("seo_geo_runs")
    .insert({ kind, status: "queued", engines, repetitions: geo.repetitions, created_at: now.toISOString(), note })
    .select(RUN_COLUMNS)
    .single()
  // Index unique « un seul relevé actif » (section 12 de la migration) : deux créations simultanées
  if (inserted.error && inserted.error.code === "23505") throw new GeoRunConflictError((await activeRun(db))?.id ?? null)
  const run = must(inserted, "la création du relevé") as GeoRunRow

  // Ordre de traitement : répétition, puis question, puis moteur (les appels en parallèle visent des moteurs différents)
  const rows: Record<string, unknown>[] = []
  const base = now.getTime()
  for (let r = 1; r <= geo.repetitions; r++) {
    questions.forEach((q) => {
      engines.forEach((engine) => {
        rows.push({
          run_id: run.id,
          question_id: q.id,
          question: q.question,
          engine,
          repetition: r,
          status: "pending",
          created_at: new Date(base + rows.length).toISOString(),
        })
      })
    })
  }
  const answers = await db.from("seo_geo_answers").insert(rows)
  if (answers.error) {
    // Un relevé sans réponses bloquerait les suivants : il est clos en échec
    await db.from("seo_geo_runs").update({ status: "failed", finished_at: new Date().toISOString(), note: "Création interrompue." }).eq("id", run.id)
    must(answers, "la création des réponses du relevé")
  }
  return { run, total: rows.length }
}

/** Progression d'un relevé ; null s'il n'existe pas. */
export async function runProgress(db: SeoDb, runId: string): Promise<GeoProgress | null> {
  const run = must(
    await db.from("seo_geo_runs").select("id, status").eq("id", runId).maybeSingle(),
    "le relevé",
  ) as { id: string; status: GeoRunStatus } | null
  if (!run) return null
  const rows = (must(await db.from("seo_geo_answers").select("status").eq("run_id", runId), "les réponses du relevé") ?? []) as { status: string }[]
  return {
    runId,
    total: rows.length,
    done: rows.filter((r) => r.status !== "pending" && r.status !== "running").length,
    status: run.status,
  }
}

type Claimed = Pick<GeoAnswerRow, "id" | "run_id" | "question" | "engine" | "repetition" | "attempts" | "status">
const CLAIM_COLUMNS = "id, run_id, question, engine, repetition, attempts, status"

/** Motif d'échec d'une réponse dont les essais ont tous été interrompus (délai, arrêt du serveur). */
export const INTERRUPTED_ERROR = "Délai dépassé : la réponse a été interrompue à chaque essai."

/**
 * Prend jusqu'à `limit` réponses : en attente d'abord (hors pause avant un nouvel essai,
 * `lock_until` à venir), puis « en cours » dont le verrou a expiré. L'essai est compté à
 * la prise ; une réponse interrompue qui a épuisé ses essais passe en échec au lieu
 * d'être reprise. Rend les réponses prises et le nombre de réponses passées en échec.
 */
async function claim(
  db: SeoDb,
  opts: { runIds: string[]; limit: number; now: Date; lockUntil: Date },
): Promise<{ claimed: Claimed[]; expired: number }> {
  const nowIso = opts.now.toISOString()
  // Valeur entre guillemets : « . » et « : » sont réservés dans les filtres logiques de PostgREST
  const ready = `lock_until.is.null,lock_until.lt."${nowIso}"`
  const pending = (must(
    await db
      .from("seo_geo_answers")
      .select(CLAIM_COLUMNS)
      .in("run_id", opts.runIds)
      .eq("status", "pending")
      .or(ready)
      .order("created_at", { ascending: true })
      .limit(opts.limit),
    "les réponses en attente",
  ) ?? []) as Claimed[]
  let stale: Claimed[] = []
  if (pending.length < opts.limit) {
    stale = (must(
      await db
        .from("seo_geo_answers")
        .select(CLAIM_COLUMNS)
        .in("run_id", opts.runIds)
        .eq("status", "running")
        .lt("lock_until", nowIso)
        .order("created_at", { ascending: true })
        .limit(opts.limit - pending.length),
      "les réponses interrompues",
    ) ?? []) as Claimed[]
  }

  const claimed: Claimed[] = []
  let expired = 0
  for (const candidate of pending.concat(stale)) {
    const attempts = candidate.attempts ?? 0
    const exhausted = candidate.status === "running" && attempts >= MAX_ATTEMPTS
    let update = db
      .from("seo_geo_answers")
      .update(
        exhausted
          ? { status: "failed", lock_until: null, error: INTERRUPTED_ERROR }
          : { status: "running", lock_until: opts.lockUntil.toISOString(), attempts: attempts + 1 },
      )
      .eq("id", candidate.id)
      .eq("status", candidate.status)
    update = candidate.status === "running" ? update.lt("lock_until", nowIso) : update.or(ready)
    const rows = (must(await update.select("id"), "le verrou d'une réponse") ?? []) as { id: string }[]
    if (rows.length === 0) continue
    if (exhausted) expired++
    else claimed.push(candidate)
  }
  return { claimed, expired }
}

export interface ProcessResult {
  /** Réponses traitées pendant ce passage. */
  processed: number
  done: number
  failed: number
  /** Relevés clos pendant ce passage. */
  finalized: string[]
}

/**
 * Traite les réponses en attente jusqu'à `stopAt` (ms depuis l'époque) : aucun appel
 * n'est lancé s'il reste moins de 20 s, et chaque appel est borné par le temps restant.
 */
export async function processPending(
  db: SeoDb,
  opts: { stopAt: number; runId?: string; clients?: Clients; concurrency?: number },
): Promise<ProcessResult> {
  const clients = opts.clients ?? ENGINE_CLIENTS
  const result: ProcessResult = { processed: 0, done: 0, failed: 0, finalized: [] }

  const runs = (must(
    await (opts.runId
      ? db.from("seo_geo_runs").select("id, status").in("status", ACTIVE).eq("id", opts.runId)
      : db.from("seo_geo_runs").select("id, status").in("status", ACTIVE)),
    "les relevés en cours",
  ) ?? []) as { id: string; status: GeoRunStatus }[]
  if (runs.length === 0) return result
  const runIds = runs.map((r) => r.id)

  const [geo, targeting] = await Promise.all([getSettings(db, "geo"), getSettings(db, "targeting")])
  const brandTerms = brandTermsOf(targeting.value.brandTerms)
  const competitors = targeting.value.competitors
  const started = new Set<string>(runs.filter((r) => r.status === "running").map((r) => r.id))

  for (;;) {
    const left = opts.stopAt - Date.now()
    if (left < MIN_CALL_BUDGET_MS) break
    const now = new Date()
    const { claimed: batch, expired } = await claim(db, {
      runIds,
      limit: opts.concurrency ?? CONCURRENCY,
      now,
      lockUntil: new Date(now.getTime() + Math.min(ENGINE_TIMEOUT_MS, left) + LOCK_MARGIN_MS),
    })
    result.failed += expired
    result.processed += expired
    if (batch.length === 0) {
      if (expired > 0) continue
      break
    }

    // Relevé passé « en cours » à sa première réponse
    const toStart = Array.from(new Set(batch.map((a) => a.run_id))).filter((id) => !started.has(id))
    for (const id of toStart) {
      started.add(id)
      must(
        await db.from("seo_geo_runs").update({ status: "running", started_at: now.toISOString() }).eq("id", id).eq("status", "queued"),
        "le démarrage du relevé",
      )
    }

    const outcomes = await Promise.all(
      batch.map((answer) => handleAnswer(db, answer, { clients, stopAt: opts.stopAt, market: geo.value.market, language: geo.value.language, brandTerms, competitors })),
    )
    outcomes.forEach((o) => {
      result.processed++
      if (o === "done") result.done++
      if (o === "failed") result.failed++
    })
  }

  result.finalized = await finalizeRuns(db, { runIds, competitors })
  return result
}

type Outcome = "done" | "failed" | "retry"

async function handleAnswer(
  db: SeoDb,
  answer: Claimed,
  ctx: { clients: Clients; stopAt: number; market: string; language: string; brandTerms: string[]; competitors: string[] },
): Promise<Outcome> {
  // Essai déjà compté à la prise de la réponse (claim)
  const attempts = (answer.attempts ?? 0) + 1
  const write = async (patch: Record<string, unknown>) => {
    must(await db.from("seo_geo_answers").update(patch).eq("id", answer.id).eq("status", "running"), "l'enregistrement d'une réponse")
  }

  if (!isGeoEngine(answer.engine)) {
    await write({ status: "failed", attempts, lock_until: null, error: `Moteur inconnu : ${answer.engine}` })
    return "failed"
  }
  const client = ctx.clients[answer.engine]
  const label = GEO_ENGINES.find((e) => e.key === answer.engine)?.label ?? answer.engine
  // Borné par le temps restant du passage ; un délai dépassé compte comme un essai
  const timeoutMs = Math.min(ENGINE_TIMEOUT_MS, ctx.stopAt - Date.now())

  try {
    if (!client.isConfigured()) {
      throw new GeoEngineError(`${label} : clé manquante au moment du relevé`, "config", { retryable: false })
    }
    const res = await client.ask(answer.question, { market: ctx.market, language: ctx.language, timeoutMs })
    const found = detect(res, { brandTerms: ctx.brandTerms, competitors: ctx.competitors })
    await write({
      status: "done",
      answer: res.answer,
      sources: res.sources,
      model: res.model,
      ...found,
      attempts,
      lock_until: null,
      error: null,
      done_at: new Date().toISOString(),
    })
    return "done"
  } catch (error) {
    // Base injoignable (y compris pour enregistrer une réponse obtenue) : ce n'est pas une
    // panne du moteur. La réponse reste « en cours » et sera reprise à l'expiration de son
    // verrou (l'essai, compté à la prise, borne les reprises), sans faux message de moteur.
    if (error instanceof SeoDbError) throw error
    const timedOut = isTimeout(error)
    const engineError = error instanceof GeoEngineError ? error : null
    if (!engineError && !timedOut) console.error("[seo-geo] erreur inattendue", error instanceof Error ? error.message : error)
    const message = (
      timedOut
        ? `${label} : délai dépassé (pas de réponse en ${Math.round(timeoutMs / 1000)} s)`
        : engineError?.message ?? "Erreur inattendue pendant l'interrogation du moteur"
    ).slice(0, 500)
    const final = !(engineError?.retryable ?? true) || attempts >= MAX_ATTEMPTS
    // Nouvel essai après une pause (pas aussitôt dans le même passage : une limite de débit échouerait de même)
    const delay = engineError?.code === "rate_limit" ? RATE_LIMIT_RETRY_DELAY_MS : RETRY_DELAY_MS
    await write({
      status: final ? "failed" : "pending",
      attempts,
      lock_until: final ? null : new Date(Date.now() + delay).toISOString(),
      error: message,
    })
    return final ? "failed" : "retry"
  }
}

/**
 * Clôt les relevés dont plus aucune réponse n'attend : résumé (taux par moteur, au total,
 * par domaine), « done » si au moins une réponse a été obtenue, « failed » sinon.
 */
export async function finalizeRuns(db: SeoDb, opts: { runIds: string[]; competitors: string[] }): Promise<string[]> {
  const closed: string[] = []
  for (const runId of opts.runIds) {
    const run = must(
      await db.from("seo_geo_runs").select("id, status, engines, created_at").eq("id", runId).maybeSingle(),
      "le relevé",
    ) as { id: string; status: GeoRunStatus; engines: string[] | null; created_at: string } | null
    if (!run || !ACTIVE.includes(run.status)) continue
    const answers = (must(
      await db
        .from("seo_geo_answers")
        .select("question_id, engine, status, brand_mentioned, site_cited, competitors_mentioned, competitors_cited, error")
        .eq("run_id", runId),
      "les réponses du relevé",
    ) ?? []) as (Parameters<typeof computeSummary>[0][number] & { error: string | null })[]
    if (answers.some((a) => a.status === "pending" || a.status === "running")) continue
    // Relevé tout juste créé par une autre requête, réponses pas encore insérées : jamais clos
    // « sans réponse » pendant sa création ; au-delà du délai, sa création a échoué.
    if (answers.length === 0 && Date.now() - Date.parse(run.created_at) < CREATION_GRACE_MS) continue

    const summary = computeSummary(answers, { engines: run.engines ?? [], competitors: opts.competitors })
    const ok = answers.some((a) => a.status === "done")
    const firstError = answers.find((a) => a.error)?.error ?? null
    const patch: Record<string, unknown> = { status: ok ? "done" : "failed", summary, finished_at: new Date().toISOString() }
    // Relevé réussi : la note posée à la création (questions écartées) est gardée
    if (!ok) patch.note = `Aucune réponse obtenue${firstError ? ` : ${firstError}` : "."}`.slice(0, 500)
    must(
      await db
        .from("seo_geo_runs")
        .update(patch)
        .eq("id", runId)
        .in("status", ACTIVE),
      "la clôture du relevé",
    )
    closed.push(runId)
  }
  return closed
}

/** Motif des réponses écartées par « Arrêter le relevé » (statut « skipped » : ni présence ni absence). */
export const CANCELLED_ERROR = "Relevé arrêté avant cette réponse."

/**
 * « Arrêter le relevé » : les réponses en attente ou en cours passent « skipped » (un appel
 * déjà parti n'enregistrera rien : son écriture vise une réponse « running »), puis le relevé
 * est clos avec ce qui a déjà été obtenu : « done » avec son résumé s'il y a au moins une
 * réponse, « cancelled » sinon. Libère aussitôt la place d'un nouveau relevé.
 * null si le relevé n'existe pas ; `cancelled: false` s'il était déjà clos.
 */
export async function cancelRun(db: SeoDb, runId: string): Promise<{ run: GeoRunRow; cancelled: boolean } | null> {
  const run = must(await db.from("seo_geo_runs").select(RUN_COLUMNS).eq("id", runId).maybeSingle(), "le relevé") as GeoRunRow | null
  if (!run) return null
  if (!ACTIVE.includes(run.status)) return { run, cancelled: false }

  must(
    await db
      .from("seo_geo_answers")
      .update({ status: "skipped", lock_until: null, error: CANCELLED_ERROR })
      .eq("run_id", runId)
      .in("status", ["pending", "running"]),
    "l'arrêt des réponses",
  )
  const competitors = (await getSettings(db, "targeting")).value.competitors
  const answers = (must(
    await db
      .from("seo_geo_answers")
      .select("question_id, engine, status, brand_mentioned, site_cited, competitors_mentioned, competitors_cited")
      .eq("run_id", runId),
    "les réponses du relevé",
  ) ?? []) as Parameters<typeof computeSummary>[0]
  const ok = answers.some((a) => a.status === "done")
  const skipped = answers.filter((a) => a.status === "skipped").length
  const stopNote = `Relevé arrêté avant la fin : ${skipped} réponse${skipped > 1 ? "s" : ""} non obtenue${skipped > 1 ? "s" : ""}.`
  const rows = (must(
    await db
      .from("seo_geo_runs")
      .update({
        status: ok ? "done" : "cancelled",
        summary: ok ? computeSummary(answers, { engines: run.engines ?? [], competitors }) : null,
        finished_at: new Date().toISOString(),
        note: [run.note, stopNote].filter(Boolean).join(" ").slice(0, 500),
      })
      .eq("id", runId)
      .in("status", ACTIVE)
      .select(RUN_COLUMNS),
    "l'arrêt du relevé",
  ) ?? []) as GeoRunRow[]
  if (rows[0]) return { run: rows[0], cancelled: true }
  // Clos entre-temps par un autre passage
  const current = must(await db.from("seo_geo_runs").select(RUN_COLUMNS).eq("id", runId).maybeSingle(), "le relevé") as GeoRunRow | null
  return current ? { run: current, cancelled: false } : null
}
