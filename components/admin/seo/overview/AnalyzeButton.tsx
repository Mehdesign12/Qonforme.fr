"use client"

/**
 * « Lancer l'analyse » (Vue d'ensemble) : synchronise Search Console puis
 * recalcule les actions SEO (POST /api/admin/seo/search-console/sync), puis
 * relit la page. Une analyse déjà en cours (cron ou autre onglet) répond 409.
 */
import { useState } from "react"
import { useRouter } from "next/navigation"
import { Loader2, RefreshCw } from "lucide-react"
import { toast } from "sonner"
import { cn } from "@/lib/utils"

interface TaskResult {
  task: string
  status: "ok" | "error" | "skipped" | "locked" | "not_due"
  result?: Record<string, unknown>
  error?: string
}

export function AnalyzeButton({ className }: { className?: string }) {
  const router = useRouter()
  const [pending, setPending] = useState(false)

  const run = async () => {
    setPending(true)
    try {
      const res = await fetch("/api/admin/seo/search-console/sync", { method: "POST" })
      const body = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string; results?: TaskResult[] }
      if (res.status === 409) {
        toast.error("Une analyse est déjà en cours", { description: "Réessayez dans quelques minutes." })
        return
      }
      if (!res.ok) {
        toast.error("L'analyse n'a pas pu aboutir", { description: body.error ?? "Réessayez dans un instant." })
        // L'échec est enregistré (bandeau de la carte Performances) : relire la page
        router.refresh()
        return
      }
      const sc = body.results?.find((r) => r.task === "search-console")
      const findings = body.results?.find((r) => r.task === "findings")
      const parts: string[] = []
      if (sc?.result?.skipped === "not_configured") parts.push("Search Console n'est pas connectée")
      else if (sc?.status === "ok") parts.push("Search Console synchronisée")
      if (findings?.status === "ok") parts.push("actions SEO recalculées")
      else if (findings?.status === "error") parts.push("le calcul des actions a échoué")
      else if (findings?.status === "locked") parts.push("calcul des actions déjà en cours")
      if (body.ok === false) toast.warning("Analyse incomplète", { description: parts.join(" · ") || undefined })
      else toast.success("Analyse terminée", { description: parts.join(" · ") || undefined })
      router.refresh()
    } catch {
      toast.error("Erreur réseau. Réessayez.")
    } finally {
      setPending(false)
    }
  }

  return (
    <button type="button" onClick={run} disabled={pending} aria-busy={pending} className={cn("q-btn q-btn-secondary", className)}>
      {pending ? <Loader2 className="animate-spin" aria-hidden /> : <RefreshCw aria-hidden />}
      {pending ? "Analyse en cours…" : "Lancer l'analyse"}
    </button>
  )
}
