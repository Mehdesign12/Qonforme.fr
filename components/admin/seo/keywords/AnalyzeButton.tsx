"use client"

/**
 * « Lancer l'analyse » (ou « Relancer l'analyse ») : POST
 * /api/admin/seo/keywords/analyze. Désactivé (aria-disabled) quand DataForSEO
 * n'est pas configuré, pendant le délai de 30 jours ou pendant une analyse en
 * cours ; la raison est la ligne d'information visible sous l'en-tête, reliée
 * par `describedBy`.
 */
import { useState } from "react"
import { useRouter } from "next/navigation"
import { Loader2, RefreshCw } from "lucide-react"
import { toast } from "sonner"
import { cn } from "@/lib/utils"

export type AnalyzeAvailability = "available" | "cooldown" | "running" | "not_configured"

export function AnalyzeButton({
  availability,
  describedBy,
  label = "Lancer l'analyse",
  className,
}: {
  availability: AnalyzeAvailability
  /** Identifiant de la ligne d'information visible qui explique un bouton désactivé. */
  describedBy?: string
  label?: string
  className?: string
}) {
  const router = useRouter()
  const [running, setRunning] = useState(false)
  const disabled = availability !== "available" || running

  const run = async () => {
    if (disabled) return
    setRunning(true)
    try {
      const res = await fetch("/api/admin/seo/keywords/analyze", { method: "POST" })
      const data = (await res.json().catch(() => ({}))) as { error?: string; message?: string; measured?: number; withVolume?: number }
      if (!res.ok) {
        toast.error(data.error ?? "L'analyse n'a pas pu aboutir.")
      } else if (data.message) {
        toast.success(data.message)
      } else {
        const measured = data.measured ?? 0
        const withVolume = data.withVolume ?? 0
        toast.success(
          `Analyse terminée : ${measured.toLocaleString("fr-FR")} mot${measured > 1 ? "s" : ""}-clé${measured > 1 ? "s" : ""} interrogé${measured > 1 ? "s" : ""}, ${withVolume.toLocaleString("fr-FR")} avec un volume connu.`,
        )
      }
      router.refresh()
    } catch {
      toast.error("Erreur réseau. Réessayez.")
    } finally {
      setRunning(false)
    }
  }

  return (
    <span className={cn("inline-flex", className)}>
      <button
        type="button"
        onClick={run}
        aria-disabled={disabled || undefined}
        aria-busy={running || availability === "running" || undefined}
        aria-describedby={describedBy}
        className="q-btn q-btn-secondary w-full"
      >
        {running || availability === "running" ? <Loader2 className="animate-spin" aria-hidden /> : <RefreshCw aria-hidden />}
        {running || availability === "running" ? "Analyse en cours…" : label}
      </button>
    </span>
  )
}
