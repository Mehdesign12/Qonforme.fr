"use client"

/**
 * Fait avancer une rédaction depuis l'écran : une passe par appel à
 * POST /api/admin/seo/articles/jobs/<id>/step, jusqu'à « Article prêt » ou
 * l'échec. Fermer l'écran arrête seulement la boucle : la tâche planifiée
 * termine la rédaction. Une erreur du serveur (passe interrompue) n'arrête pas
 * le suivi : la passe est reprise quand son verrou expire.
 */
import { useCallback, useEffect, useRef, useState } from "react"
import { api } from "@/components/admin/seo/articles/api"

export type RunnerStep = "plan" | "write" | "check" | "fix" | "links" | "images" | "cover" | "save" | "done"

export interface StepResponse {
  jobId: string
  status: "queued" | "running" | "done" | "failed"
  step: RunnerStep
  ran: RunnerStep | null
  label: string
  postId: string | null
  error: string | null
  notices: string[]
  locked?: boolean
  deferred?: boolean
}

export interface RunnerState {
  jobId: string | null
  status: "idle" | "running" | "done" | "failed" | "stopped"
  step: RunnerStep
  /** Passes déjà jouées. */
  done: RunnerStep[]
  postId: string | null
  error: string | null
  notices: string[]
  /** Une autre passe tient la rédaction : l'écran attend qu'elle finisse. */
  waiting?: boolean
}

export const IDLE: RunnerState = { jobId: null, status: "idle", step: "plan", done: [], postId: null, error: null, notices: [] }

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

/** Suivi depuis l'écran : au-delà, la boucle s'arrête (la tâche planifiée prend le relais). */
const FOLLOW_MS = 25 * 60_000
/** Erreurs du serveur ou du réseau d'affilée avant d'arrêter le suivi. */
const MAX_TRANSIENT = 4

/** Erreur passagère : réseau coupé, fonction arrêtée par l'hébergeur (502, 504…), base surchargée. */
const transient = (status: number) => status === 0 || status === 429 || status >= 500

/** Boucle d'une rédaction ; `onUpdate` reçoit chaque état ; `cancelled()` arrête la boucle. `initial` : état déjà lu (reprise). */
export async function runJob(jobId: string, onUpdate: (s: RunnerState) => void, cancelled: () => boolean, initial?: RunnerState): Promise<RunnerState> {
  let state: RunnerState = initial ? { ...initial, jobId, status: "running" } : { ...IDLE, jobId, status: "running" }
  onUpdate(state)
  const started = Date.now()
  let failures = 0
  while (!cancelled() && Date.now() - started < FOLLOW_MS) {
    const res = await api<StepResponse>(`/api/admin/seo/articles/jobs/${jobId}/step`, "POST")
    if (cancelled()) break
    const body = res.data
    if (res.status === 409 && body?.locked) {
      // Une autre passe (la tâche planifiée, ou une passe interrompue dont le verrou n'a pas expiré) : on attend
      failures = 0
      state = { ...state, step: body.step ?? state.step, notices: body.notices ?? state.notices, error: null, waiting: true }
      onUpdate(state)
      await sleep(10_000)
      continue
    }
    if (!res.ok && transient(res.status) && ++failures < MAX_TRANSIENT) {
      // La passe a pu s'interrompre côté serveur : elle sera reprise (et comptée comme un essai)
      state = { ...state, error: "Le serveur n'a pas répondu à temps.", waiting: false }
      onUpdate(state)
      await sleep(15_000)
      continue
    }
    if (!res.ok || !body) {
      state = { ...state, status: "stopped", error: res.error, waiting: false }
      onUpdate(state)
      return state
    }
    failures = 0
    const done = body.ran && !state.done.includes(body.ran) ? [...state.done, body.ran] : state.done
    state = {
      jobId,
      status: body.status === "done" ? "done" : body.status === "failed" ? "failed" : "running",
      step: body.step,
      done,
      postId: body.postId,
      error: body.error,
      notices: body.notices ?? [],
      waiting: false,
    }
    onUpdate(state)
    if (body.status === "done" || body.status === "failed") return state
    // Erreur passagère : la passe est rejouée après une courte pause (3 essais au plus côté serveur)
    if (body.error || body.deferred) await sleep(3000)
  }
  if (cancelled()) return { ...state, status: "stopped" }
  state = { ...state, status: "stopped", waiting: false, error: "Le suivi s'est arrêté : la rédaction continue en arrière-plan et apparaîtra dans Articles une fois prête." }
  onUpdate(state)
  return state
}

/** État d'une rédaction déjà lancée (GET), pour reprendre son suivi là où elle en est. */
export async function readJobState(jobId: string): Promise<RunnerState | null> {
  const res = await api<Omit<StepResponse, "ran">>(`/api/admin/seo/articles/jobs/${jobId}`, "GET")
  if (!res.ok || !res.data) return null
  const b = res.data
  return {
    jobId,
    status: b.status === "done" ? "done" : b.status === "failed" ? "failed" : "running",
    step: b.step,
    done: [],
    postId: b.postId,
    error: b.error,
    notices: b.notices ?? [],
  }
}

/** Rédaction suivie par un composant ; la boucle s'arrête quand le composant disparaît. */
export function useJobRunner() {
  const [state, setState] = useState<RunnerState>(IDLE)
  const alive = useRef(true)
  const token = useRef(0)

  useEffect(() => {
    alive.current = true
    return () => {
      alive.current = false
    }
  }, [])

  const start = useCallback(async (jobId: string) => {
    const mine = ++token.current
    return runJob(
      jobId,
      (s) => {
        if (alive.current && token.current === mine) setState(s)
      },
      () => !alive.current || token.current !== mine,
    )
  }, [])

  /** Reprend le suivi d'une rédaction déjà lancée (sujet « Rédaction en cours »). */
  const resume = useCallback(async (jobId: string) => {
    const mine = ++token.current
    const update = (s: RunnerState) => {
      if (alive.current && token.current === mine) setState(s)
    }
    update({ ...IDLE, jobId, status: "running" })
    const initial = await readJobState(jobId)
    if (!alive.current || token.current !== mine) return initial ?? IDLE
    if (!initial) {
      const failed: RunnerState = { ...IDLE, jobId, status: "stopped", error: "Impossible de lire l'avancement de la rédaction. Réessayez dans un instant." }
      update(failed)
      return failed
    }
    if (initial.status !== "running") {
      update(initial)
      return initial
    }
    return runJob(jobId, update, () => !alive.current || token.current !== mine, initial)
  }, [])

  const stop = useCallback(() => {
    token.current++
  }, [])

  const reset = useCallback(() => {
    token.current++
    setState(IDLE)
  }, [])

  return { state, start, resume, stop, reset }
}
