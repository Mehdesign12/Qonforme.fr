"use client"

/**
 * Fait avancer une rédaction depuis l'écran : une passe par appel à
 * POST /api/admin/seo/articles/jobs/<id>/step, jusqu'à « Article prêt » ou
 * l'échec. Fermer l'écran arrête seulement la boucle : la tâche planifiée
 * termine la rédaction.
 */
import { useCallback, useEffect, useRef, useState } from "react"
import { api } from "@/components/admin/seo/articles/api"

export type RunnerStep = "plan" | "write" | "check" | "fix" | "cover" | "save" | "done"

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
}

export const IDLE: RunnerState = { jobId: null, status: "idle", step: "plan", done: [], postId: null, error: null, notices: [] }

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

/** Boucle d'une rédaction ; `onUpdate` reçoit chaque état ; `cancelled()` arrête la boucle. */
export async function runJob(jobId: string, onUpdate: (s: RunnerState) => void, cancelled: () => boolean): Promise<RunnerState> {
  let state: RunnerState = { ...IDLE, jobId, status: "running" }
  onUpdate(state)
  for (let i = 0; i < 40 && !cancelled(); i++) {
    const res = await api<StepResponse>(`/api/admin/seo/articles/jobs/${jobId}/step`, "POST")
    if (cancelled()) break
    const body = res.data
    if (res.status === 409 && body?.locked) {
      // Une autre passe (la tâche planifiée) travaille sur cet article : on attend
      state = { ...state, step: body.step ?? state.step, notices: body.notices ?? state.notices, error: null }
      onUpdate(state)
      await sleep(5000)
      continue
    }
    if (!res.ok || !body) {
      state = { ...state, status: "stopped", error: res.error }
      onUpdate(state)
      return state
    }
    const done = body.ran && !state.done.includes(body.ran) ? [...state.done, body.ran] : state.done
    state = {
      jobId,
      status: body.status === "done" ? "done" : body.status === "failed" ? "failed" : "running",
      step: body.step,
      done,
      postId: body.postId,
      error: body.error,
      notices: body.notices ?? [],
    }
    onUpdate(state)
    if (body.status === "done" || body.status === "failed") return state
    // Erreur passagère : la passe est rejouée après une courte pause (3 essais au plus côté serveur)
    if (body.error || body.deferred) await sleep(3000)
  }
  if (cancelled()) return { ...state, status: "stopped" }
  state = { ...state, status: "stopped", error: "La rédaction continue en arrière-plan ; elle apparaîtra dans Articles une fois prête." }
  onUpdate(state)
  return state
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

  const stop = useCallback(() => {
    token.current++
  }, [])

  const reset = useCallback(() => {
    token.current++
    setState(IDLE)
  }, [])

  return { state, start, stop, reset }
}
