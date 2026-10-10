"use client"

/**
 * « Mesurer la page » (barre d'outils, bouton primaire) et « Mesurer » (ligne
 * du tableau des pages suivies) : POST /api/admin/seo/pagespeed, puis relecture
 * de la page. Une mesure dure 20 à 40 s : le bouton le dit pendant l'attente.
 */
import { useState } from "react"
import { useRouter } from "next/navigation"
import { Gauge, Loader2 } from "lucide-react"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import { fmtSeconds } from "@/lib/seo/format"
import { STRATEGY_LABELS, type PageSpeedStrategy } from "@/lib/seo/pagespeed/parse"

export function MeasureButton({
  path,
  strategy,
  variant = "row",
  ariaLabel,
  className,
}: {
  path: string
  strategy: PageSpeedStrategy
  /** primary : bouton de la barre d'outils ; row : petit bouton de ligne. */
  variant?: "primary" | "row"
  ariaLabel?: string
  className?: string
}) {
  const router = useRouter()
  const [pending, setPending] = useState(false)

  const measure = async () => {
    setPending(true)
    try {
      const res = await fetch("/api/admin/seo/pagespeed", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path, strategy }),
      })
      const body = (await res.json().catch(() => ({}))) as { error?: string; measurement?: { lcp_ms?: number | null } }
      if (!res.ok) {
        toast.error("La mesure n'a pas pu aboutir", { description: body.error ?? "Réessayez dans un instant." })
      } else {
        const lcp = body.measurement?.lcp_ms
        toast.success("Mesure enregistrée", {
          description: `${path} · ${STRATEGY_LABELS[strategy]}${lcp !== null && lcp !== undefined ? ` · LCP ${fmtSeconds(lcp)}` : ""}`,
        })
      }
      router.refresh()
    } catch {
      toast.error("Erreur réseau. Réessayez.")
    } finally {
      setPending(false)
    }
  }

  if (variant === "primary") {
    return (
      <button type="button" onClick={measure} disabled={pending} aria-busy={pending} className={cn("q-btn q-btn-primary", className)}>
        {pending ? <Loader2 className="animate-spin" aria-hidden /> : <Gauge aria-hidden />}
        {pending ? "Mesure en cours…" : "Mesurer la page"}
      </button>
    )
  }
  return (
    <button
      type="button"
      onClick={measure}
      disabled={pending}
      aria-busy={pending}
      aria-label={pending ? `Mesure en cours : ${path}` : ariaLabel}
      className={cn("q-btn q-btn-secondary q-btn-sm", className)}
    >
      {pending && <Loader2 className="animate-spin" aria-hidden />}
      {pending ? "Mesure…" : "Mesurer"}
    </button>
  )
}
