"use client"

/**
 * « Analyse immédiate » et suivi d'un relevé en cours : tant que l'écran est ouvert,
 * /api/admin/seo/geo/runs/<id>/step est appelé en boucle (environ 45 s de travail par
 * appel) ; si l'écran est fermé, la tâche planifiée finit le relevé.
 */
import { useCallback, useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Loader2, RefreshCw, Square } from "lucide-react"
import { cn } from "@/lib/utils"

interface StepBody {
  done?: number
  total?: number
  status?: string
  error?: string
}

async function readJson(res: Response): Promise<StepBody & { runId?: string }> {
  return (await res.json().catch(() => ({}))) as StepBody & { runId?: string }
}

/** Bouton primaire « Analyse immédiate ». */
export function ImmediateAnalysisButton({ running, className }: { running: boolean; className?: string }) {
  const router = useRouter()
  const [pending, setPending] = useState(false)

  const start = async () => {
    setPending(true)
    try {
      const res = await fetch("/api/admin/seo/geo/runs", { method: "POST" })
      const body = await readJson(res)
      if (res.status === 201) {
        toast.success("Analyse lancée : les moteurs sont interrogés.")
        router.refresh()
      } else if (res.status === 409) {
        toast.info(body.error ?? "Un relevé est déjà en cours.")
        router.refresh()
      } else {
        toast.error(body.error ?? "L'analyse n'a pas pu démarrer. Réessayez dans un instant.")
      }
    } catch {
      toast.error("Erreur réseau : l'analyse n'a pas démarré. Réessayez.")
    } finally {
      setPending(false)
    }
  }

  const busy = pending || running
  return (
    <button type="button" onClick={start} disabled={busy} aria-busy={busy} className={cn("q-btn q-btn-primary", className)}>
      {busy ? <Loader2 className="animate-spin" aria-hidden /> : <RefreshCw aria-hidden />}
      {running ? "Analyse en cours…" : "Analyse immédiate"}
    </button>
  )
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))
/** Pause entre deux pas qui n'ont rien fait avancer. */
const NO_PROGRESS_PAUSE_MS = 10_000

/** Bandeau « Analyse en cours : x / y réponses », qui fait avancer le relevé. */
export function RunProgressBanner({ runId, done, total }: { runId: string; done: number; total: number }) {
  const router = useRouter()
  const [progress, setProgress] = useState({ done, total })
  const [error, setError] = useState<string | null>(null)
  const [stopped, setStopped] = useState(false)
  const [attempt, setAttempt] = useState(0)
  // « Arrêter le relevé » : boucle suspendue pendant l'arrêt, confirmation en ligne
  const [halted, setHalted] = useState(false)
  const [confirmStop, setConfirmStop] = useState(false)
  const [cancelling, setCancelling] = useState(false)

  const cancel = async () => {
    setCancelling(true)
    setHalted(true)
    try {
      const res = await fetch(`/api/admin/seo/geo/runs/${runId}/cancel`, { method: "POST" })
      const body = (await res.json().catch(() => ({}))) as { error?: string; cancelled?: boolean }
      if (!res.ok) throw new Error(body.error ?? "Le relevé n'a pas pu être arrêté.")
      toast.success(body.cancelled === false ? "Le relevé était déjà terminé." : "Relevé arrêté : les réponses déjà obtenues sont gardées.")
      router.refresh()
    } catch (e) {
      toast.error(e instanceof Error && e.message ? e.message : "Erreur réseau : le relevé n'a pas été arrêté.")
      setHalted(false)
      setConfirmStop(false)
    } finally {
      setCancelling(false)
    }
  }

  const restart = useCallback(() => {
    setStopped(false)
    setError(null)
    setAttempt((n) => n + 1)
  }, [])

  useEffect(() => {
    if (halted) return
    // Propre à chaque lancement de l'effet : une boucle arrêtée ne repart jamais
    let alive = true
    const controller = new AbortController()
    let failures = 0
    let lastDone = -1

    const loop = async () => {
      while (alive) {
        try {
          const res = await fetch(`/api/admin/seo/geo/runs/${runId}/step`, { method: "POST", signal: controller.signal })
          const body = await readJson(res)
          if (!alive) return
          if (!res.ok) throw new Error(body.error ?? "Le relevé n'a pas pu avancer.")
          failures = 0
          setError(null)
          setProgress({ done: body.done ?? 0, total: body.total ?? 0 })
          if (body.status !== "queued" && body.status !== "running") {
            if (body.status === "done") toast.success("Analyse terminée.")
            else toast.error("Le relevé n'a pas abouti : aucune réponse obtenue.")
            router.refresh()
            return
          }
          // Rien n'a avancé (réponses en pause avant un nouvel essai, ou prises par la tâche
          // planifiée) : pause avant le pas suivant, plutôt que des appels en rafale
          const done = body.done ?? 0
          if (done === lastDone) await sleep(NO_PROGRESS_PAUSE_MS)
          lastDone = done
          if (!alive) return
        } catch (e) {
          if (!alive) return
          failures++
          setError(e instanceof Error && e.message ? e.message : "Erreur réseau.")
          if (failures >= 3) {
            setStopped(true)
            return
          }
          await sleep(5_000)
        }
      }
    }
    void loop()
    return () => {
      alive = false
      controller.abort()
    }
  }, [runId, attempt, router, halted])

  const pct = progress.total > 0 ? Math.round((progress.done / progress.total) * 100) : 0
  return (
    <div role="status" aria-live="polite" className="q-card flex flex-col gap-3 px-4 py-4 md:px-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="flex items-center gap-2 font-semibold text-[var(--q-ink)]">
          {!stopped && <Loader2 className="size-4 animate-spin text-[var(--q-accent)]" aria-hidden />}
          Analyse en cours : {progress.done.toLocaleString("fr-FR")} / {progress.total.toLocaleString("fr-FR")} réponses
        </p>
        <span className="text-sm tabular-nums text-[var(--q-text-4)]">{pct} %</span>
      </div>
      <div className="q-progress" role="progressbar" aria-label="Avancement du relevé" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct}>
        <span style={{ width: `${pct}%` }} />
      </div>
      {confirmStop ? (
        <div role="group" aria-label="Arrêter le relevé" className="flex flex-col gap-2 text-sm text-[var(--q-ink)] sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
          <span>Arrêter le relevé ? Les réponses déjà obtenues sont gardées ; les autres ne seront pas demandées.</span>
          <span className="flex flex-wrap justify-end gap-2">
            <button type="button" autoFocus onClick={() => setConfirmStop(false)} disabled={cancelling} className="q-btn q-btn-secondary q-btn-sm h-11 md:h-[34px]">
              Continuer l&apos;analyse
            </button>
            <button type="button" onClick={cancel} disabled={cancelling} aria-busy={cancelling} className="q-btn q-btn-danger q-btn-sm h-11 md:h-[34px]">
              {cancelling ? <Loader2 className="animate-spin" aria-hidden /> : <Square aria-hidden />}
              Arrêter le relevé
            </button>
          </span>
        </div>
      ) : stopped ? (
        <div role="alert" className="flex flex-wrap items-center justify-between gap-2 text-sm text-[var(--q-danger)]">
          <span>
            L&apos;analyse s&apos;est interrompue{error ? ` : ${error}` : ""}. Elle reprendra au prochain passage de la tâche planifiée.
          </span>
          <span className="flex flex-wrap gap-2">
            <button type="button" onClick={() => setConfirmStop(true)} className="q-btn q-btn-ghost q-btn-sm h-11 md:h-[34px]">
              Arrêter le relevé
            </button>
            <button type="button" onClick={restart} className="q-btn q-btn-secondary q-btn-sm h-11 md:h-[34px]">
              Reprendre
            </button>
          </span>
        </div>
      ) : (
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-[13px] text-[var(--q-text-4)]">
            {error
              ? `Nouvel essai dans un instant (${error}).`
              : "Chaque moteur reçoit chaque question plusieurs fois. Si vous quittez la page, le relevé continue au prochain passage de la tâche planifiée (toutes les 15 minutes)."}
          </p>
          <button type="button" onClick={() => setConfirmStop(true)} className="q-btn q-btn-ghost q-btn-sm h-11 shrink-0 self-start md:h-[34px] sm:self-auto">
            <Square aria-hidden />
            Arrêter le relevé
          </button>
        </div>
      )}
    </div>
  )
}
