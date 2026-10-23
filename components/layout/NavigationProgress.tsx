"use client"

/**
 * Fine barre en haut de l'écran dès qu'on touche un lien interne, jusqu'à ce que
 * la nouvelle page soit là : le toucher a visiblement été pris en compte, même
 * quand le serveur met un instant à répondre (sans elle, on retouchait le lien).
 *
 * Transformation et opacité seulement : ni `will-change` ni `backdrop-filter`
 * (règle iOS de CLAUDE.md) ; avec « Réduire les animations », la barre apparaît
 * sans glisser. Aucun traceur : elle ne lit que les liens de la page.
 */
import { useEffect, useRef, useState } from "react"
import { usePathname, useSearchParams } from "next/navigation"
import { cn } from "@/lib/utils"

type Phase = "idle" | "loading" | "done"

/** Au bout de ce délai sans nouvelle page, la barre disparaît d'elle-même. */
const GIVE_UP_MS = 12_000

/** Ce lien ouvre-t-il une autre page de ce site, dans cet onglet ? */
export function isInternalNavigation(a: HTMLAnchorElement, here: Location = window.location): boolean {
  if (a.target && a.target !== "_self") return false
  if (a.hasAttribute("download")) return false
  let url: URL
  try {
    url = new URL(a.href, here.href)
  } catch {
    return false
  }
  if (url.origin !== here.origin) return false
  if (url.pathname === here.pathname && url.search === here.search) return false // même page, ou ancre
  return true
}

export function NavigationProgress() {
  const pathname = usePathname()
  const search = useSearchParams()?.toString() ?? ""
  const where = `${pathname}?${search}`
  const [phase, setPhase] = useState<Phase>("idle")
  const phaseRef = useRef<Phase>("idle")
  const lastWhere = useRef(where)
  phaseRef.current = phase

  // Le toucher d'un lien interne lance la barre
  useEffect(() => {
    let giveUp: ReturnType<typeof setTimeout> | undefined
    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return
      const a = e.target instanceof Element ? e.target.closest<HTMLAnchorElement>("a[href]") : null
      if (!a || !isInternalNavigation(a)) return
      setPhase("loading")
      clearTimeout(giveUp)
      giveUp = setTimeout(() => setPhase("idle"), GIVE_UP_MS)
    }
    // Phase de capture : avant le routeur, qui peut arrêter l'évènement
    document.addEventListener("click", onClick, true)
    return () => {
      document.removeEventListener("click", onClick, true)
      clearTimeout(giveUp)
    }
  }, [])

  // La nouvelle page est arrivée : la barre se remplit, puis disparaît
  useEffect(() => {
    if (lastWhere.current === where) return
    lastWhere.current = where
    if (phaseRef.current !== "loading") return
    setPhase("done")
    const t = setTimeout(() => setPhase("idle"), 260)
    return () => clearTimeout(t)
  }, [where])

  return (
    <div
      aria-hidden
      data-nav-progress={phase}
      className={cn(
        "pointer-events-none fixed inset-x-0 z-[70] h-[2.5px] origin-left bg-[var(--q-accent)] print:hidden",
        "top-[env(safe-area-inset-top)]",
        phase === "idle" && "scale-x-0 opacity-0",
        phase === "loading" && "scale-x-[.82] opacity-100 transition-transform duration-[9000ms] ease-[cubic-bezier(.1,.7,.2,1)] motion-reduce:transition-none",
        phase === "done" && "scale-x-100 opacity-0 transition-[transform,opacity] duration-200 motion-reduce:transition-none",
      )}
    />
  )
}
