"use client"

/**
 * « Ré-analyser le site » (Performance › Audit du site, Actions SEO) : lance
 * l'exploration du plan du site, puis la poursuit paquet par paquet
 * (POST /api/admin/seo/audit/step) tant que la page est ouverte, en affichant
 * « x / y pages ». Si l'écran se ferme, la tâche planifiée finit le reste.
 * Une exploration déjà en cours au chargement : le bouton propose de la continuer.
 */
import { useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { RefreshCw } from "lucide-react"
import { toast } from "sonner"
import { cn } from "@/lib/utils"

interface RunProgress {
  id: string
  status: "running" | "done" | "failed"
  pagesDone: number
  pagesTotal: number
  error: string | null
}

type ApiResponse = { run?: RunProgress | null; findings?: { inserted: number; resolved: number } | null; error?: string; code?: string }

const fmt = (n: number) => n.toLocaleString("fr-FR")

export function ReanalyzeButton({
  running,
  className,
  block,
}: {
  /** Exploration en cours au chargement de la page. */
  running?: { pagesDone: number; pagesTotal: number } | null
  className?: string
  /** Pleine largeur, 48 px (téléphone). */
  block?: boolean
}) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null)
  const alive = useRef(true)
  useEffect(() => {
    alive.current = true
    return () => {
      alive.current = false
    }
  }, [])

  async function post(url: string): Promise<{ ok: boolean; status: number; data: ApiResponse | null }> {
    const res = await fetch(url, { method: "POST" })
    const data = (await res.json().catch(() => null)) as ApiResponse | null
    return { ok: res.ok, status: res.status, data }
  }

  async function analyse() {
    if (busy) return
    setBusy(true)
    try {
      let step = await post("/api/admin/seo/audit")
      for (;;) {
        if (!step.ok) {
          if (step.status === 409) toast(step.data?.error ?? "Une analyse est déjà en cours.")
          else toast.error(step.data?.error ?? "L'analyse du site n'a pas pu avancer. Réessayez dans un instant.")
          break
        }
        const run = step.data?.run
        if (!run) break
        setProgress({ done: run.pagesDone, total: run.pagesTotal })
        if (run.status === "failed") {
          toast.error(run.error ?? "L'analyse du site n'a pas pu aboutir.")
          break
        }
        if (run.status === "done") {
          const f = step.data?.findings
          toast.success(
            `Analyse terminée : ${fmt(run.pagesDone)} pages explorées${f ? `, ${fmt(f.inserted)} nouveau${f.inserted > 1 ? "x" : ""} constat${f.inserted > 1 ? "s" : ""}` : ""}.`,
          )
          break
        }
        router.refresh()
        if (!alive.current) return
        step = await post("/api/admin/seo/audit/step")
      }
    } catch {
      toast.error("Connexion impossible. L'analyse se poursuivra avec la tâche planifiée.")
    } finally {
      if (alive.current) {
        setBusy(false)
        setProgress(null)
        router.refresh()
      }
    }
  }

  const label = busy
    ? progress && progress.total > 0
      ? `Analyse… ${fmt(progress.done)} / ${fmt(progress.total)} pages`
      : "Analyse en cours…"
    : running
      ? "Continuer l'analyse"
      : "Ré-analyser le site"

  // Pendant l'analyse, le bouton n'est pas `disabled` : .q-btn:disabled le passerait à
  // 50 % d'opacité et rendrait illisible l'avancement (« x / y pages »). Le second clic
  // est ignoré par la garde de `analyse`.
  return (
    <button
      type="button"
      onClick={analyse}
      aria-busy={busy}
      className={cn("q-btn q-btn-primary", block && "q-btn-lg w-full", busy && "cursor-progress", className)}
    >
      <RefreshCw className={cn(busy && "animate-spin motion-reduce:animate-none")} aria-hidden />
      <span aria-live="polite">{label}</span>
    </button>
  )
}
