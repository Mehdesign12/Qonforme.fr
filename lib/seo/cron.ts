/**
 * Tâches planifiées de l'onglet SEO, appelées par une seule tâche de
 * cron-job.org : GET /api/cron/seo toutes les 15 minutes (CRON_SECRET).
 *
 * Chaque module déclare une tâche (SeoTask) : `isDue` dit si elle doit tourner
 * maintenant (synchronisation quotidienne, relevé mensuel, publication à
 * l'heure…), `run` travaille par paquets jusqu'à `ctx.deadline` puis rend la
 * main ; son curseur (seo_jobs.cursor) permet de reprendre au passage suivant.
 *
 * Un verrou par tâche (seo_jobs.lock_until) empêche deux passages simultanés
 * (cron qui se chevauche, bouton de l'admin pendant un passage du cron).
 * Chaque passage effectif est journalisé dans cron_logs (« seo:<tâche> »),
 * visible dans Santé du système.
 */
import { must, type SeoDb } from "@/lib/seo/db"

export interface SeoJobRow {
  name: string
  status: "idle" | "running" | "ok" | "error"
  started_at: string | null
  finished_at: string | null
  last_ok_at: string | null
  lock_until: string | null
  cursor: Record<string, unknown>
  result: Record<string, unknown> | null
  error: string | null
}

export type SeoTrigger = "cron" | "manual"

export interface SeoTaskContext {
  db: SeoDb
  now: Date
  /** Heure limite (ms depuis l'époque) : finir le paquet en cours et rendre la main avant. */
  deadline: number
  trigger: SeoTrigger
  /** État du passage précédent (curseur, dernier succès). */
  job: SeoJobRow
  /** Enregistre le curseur de reprise sans attendre la fin du passage. */
  saveCursor(cursor: Record<string, unknown>): Promise<void>
  /** Paramètres d'un lancement manuel (ex. { runId } pour un relevé immédiat). */
  params?: Record<string, unknown>
}

export interface SeoTask {
  name: string
  /** Libellé de Santé du système (« SEO · Search Console »). */
  label: string
  /** Vrai si la tâche doit tourner maintenant (lecture légère, sans effet). */
  isDue(input: { db: SeoDb; now: Date; job: SeoJobRow | null }): boolean | Promise<boolean>
  run(ctx: SeoTaskContext): Promise<Record<string, unknown>>
  /** Durée du verrou (ms) : au-delà, un passage bloqué est considéré comme mort. Défaut : 6 min. */
  lockMs?: number
  /** Temps minimal pour démarrer (ms) : sous ce reste, la tâche attend le passage suivant. Défaut : 20 s. */
  minBudgetMs?: number
}

export const DEFAULT_LOCK_MS = 6 * 60_000
const DEFAULT_MIN_BUDGET_MS = 20_000

export async function readJob(db: SeoDb, name: string): Promise<SeoJobRow | null> {
  return must(await db.from("seo_jobs").select("*").eq("name", name).maybeSingle(), "l'état des tâches SEO") as SeoJobRow | null
}

/** Pose le verrou de la tâche ; null si un autre passage le tient. */
export async function acquireJob(db: SeoDb, name: string, lockMs = DEFAULT_LOCK_MS, now = new Date()): Promise<SeoJobRow | null> {
  must(await db.from("seo_jobs").upsert({ name }, { onConflict: "name", ignoreDuplicates: true }), "l'état des tâches SEO")
  const nowIso = now.toISOString()
  const rows = must(
    await db
      .from("seo_jobs")
      .update({ status: "running", started_at: nowIso, lock_until: new Date(now.getTime() + lockMs).toISOString(), error: null })
      .eq("name", name)
      .or(`lock_until.is.null,lock_until.lt."${nowIso}"`)
      .select("*"),
    "le verrou des tâches SEO",
  ) as SeoJobRow[]
  return rows[0] ?? null
}

async function releaseJob(
  db: SeoDb,
  name: string,
  outcome: { ok: true; result: Record<string, unknown> } | { ok: false; error: string },
): Promise<void> {
  const finishedAt = new Date().toISOString()
  const patch = outcome.ok
    ? { status: "ok", finished_at: finishedAt, last_ok_at: finishedAt, lock_until: null, result: outcome.result, error: null }
    : { status: "error", finished_at: finishedAt, lock_until: null, error: outcome.error.slice(0, 1000) }
  const { error } = await db.from("seo_jobs").update(patch).eq("name", name)
  if (error) console.error(`[seo-cron] libération du verrou « ${name} » impossible`, error.message)
}

export interface TaskRunResult {
  task: string
  status: "ok" | "error" | "skipped" | "locked" | "not_due"
  durationMs?: number
  result?: Record<string, unknown>
  error?: string
}

/** Lance une tâche maintenant (cron ou bouton de l'admin), verrou compris. */
export async function runTask(
  db: SeoDb,
  task: SeoTask,
  opts: { trigger: SeoTrigger; deadline: number; now?: Date; params?: Record<string, unknown>; log?: boolean },
): Promise<TaskRunResult> {
  const now = opts.now ?? new Date()
  const job = await acquireJob(db, task.name, task.lockMs ?? DEFAULT_LOCK_MS, now)
  if (!job) return { task: task.name, status: "locked" }

  const started = Date.now()
  let outcome: TaskRunResult
  try {
    const result = await task.run({
      db,
      now,
      deadline: opts.deadline,
      trigger: opts.trigger,
      job,
      params: opts.params,
      saveCursor: async (cursor) => {
        job.cursor = cursor
        const { error } = await db.from("seo_jobs").update({ cursor }).eq("name", task.name)
        if (error) throw new Error(`Curseur de « ${task.name} » non enregistré : ${error.message}`)
      },
    })
    await releaseJob(db, task.name, { ok: true, result })
    outcome = { task: task.name, status: "ok", durationMs: Date.now() - started, result }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.error(`[seo-cron] ${task.name}`, error)
    await releaseJob(db, task.name, { ok: false, error: message })
    outcome = { task: task.name, status: "error", durationMs: Date.now() - started, error: message }
  }

  if (opts.log !== false) {
    const { error } = await db.from("cron_logs").insert({
      job_name: `seo:${task.name}`,
      status: outcome.status === "ok" ? "ok" : "error",
      results: { trigger: opts.trigger, ...(outcome.result ?? {}), ...(outcome.error ? { error: outcome.error } : {}) },
      duration_ms: outcome.durationMs ?? 0,
    })
    if (error) console.error("[seo-cron] journal cron_logs non écrit", error.message)
  }
  return outcome
}

/**
 * Passage du cron : chaque tâche due tourne à son tour dans le temps restant.
 * Une tâche en erreur n'empêche pas les suivantes.
 */
export async function runDueTasks(
  db: SeoDb,
  tasks: SeoTask[],
  opts: { now?: Date; budgetMs: number; only?: string },
): Promise<TaskRunResult[]> {
  const startedAt = Date.now()
  const deadline = startedAt + opts.budgetMs
  const now = opts.now ?? new Date()
  const results: TaskRunResult[] = []

  for (const task of tasks) {
    if (opts.only && task.name !== opts.only) continue
    const remaining = deadline - Date.now()
    if (remaining < (task.minBudgetMs ?? DEFAULT_MIN_BUDGET_MS)) {
      results.push({ task: task.name, status: "skipped" })
      continue
    }
    try {
      const job = await readJob(db, task.name)
      const due = opts.only ? true : await task.isDue({ db, now, job })
      if (!due) {
        results.push({ task: task.name, status: "not_due" })
        continue
      }
      results.push(await runTask(db, task, { trigger: "cron", deadline, now }))
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      console.error(`[seo-cron] ${task.name} (avant lancement)`, error)
      results.push({ task: task.name, status: "error", error: message })
    }
  }
  return results
}

/* ------------------------------------------------------------------ */
/* Aides aux échéances (heure de Paris)                                */
/* ------------------------------------------------------------------ */

const PARIS_PARTS = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Europe/Paris",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  weekday: "short",
  hourCycle: "h23",
})

const WEEKDAYS: Record<string, number> = { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7 }

/** Date et heure de Paris d'un instant : { day: « 2026-10-09 », minutes: 495 (08:15), weekday: 1 à 7, dayOfMonth }. */
export function parisClock(now: Date): { day: string; minutes: number; weekday: number; dayOfMonth: number } {
  const parts = Object.fromEntries(PARIS_PARTS.formatToParts(now).map((p) => [p.type, p.value]))
  return {
    day: `${parts.year}-${parts.month}-${parts.day}`,
    minutes: Number(parts.hour) * 60 + Number(parts.minute),
    weekday: WEEKDAYS[parts.weekday] ?? 1,
    dayOfMonth: Number(parts.day),
  }
}

/** « 08:00 » → 480. */
export function minutesOf(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number)
  return (h || 0) * 60 + (m || 0)
}

/**
 * Vrai si la tâche quotidienne n'a pas encore réussi aujourd'hui (heure de
 * Paris) et que l'heure `afterMinutes` est passée.
 */
export function isDailyDue(job: SeoJobRow | null, now: Date, afterMinutes = 0): boolean {
  const clock = parisClock(now)
  if (clock.minutes < afterMinutes) return false
  if (!job?.last_ok_at) return true
  return parisClock(new Date(job.last_ok_at)).day !== clock.day
}
