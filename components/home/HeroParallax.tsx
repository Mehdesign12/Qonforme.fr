"use client"

import { useEffect, useRef } from "react"

/**
 * Parallaxe du héros : l'artisan monte un peu plus vite que son cadre (arche sur
 * ordinateur, bandeau bleu sur téléphone) pendant que le cadre traverse l'écran.
 *
 * Le décalage va de 0 (cadre sous l'écran) à `max` (cadre sorti par le haut) et ne
 * dépasse jamais la marge de l'image cachée sous le bord du cadre : la coupe du bas de
 * la photo ne se voit jamais. Propriété CSS `translate` seule, posée sur le calque (pas
 * sur l'image), ni `will-change` ni `backdrop-filter` (règle iOS de CLAUDE.md) ; rien
 * avec « Réduire les animations », rien au rendu serveur ni sans JavaScript.
 */

/** Avancée du cadre dans l'écran : 0 quand son haut touche le bas de l'écran, 1 quand son bas touche le haut. */
export function parallaxProgress(top: number, height: number, viewport: number): number {
  const span = viewport + height
  if (!(span > 0)) return 0
  return Math.min(1, Math.max(0, (viewport - top) / span))
}

/** Décalage vers le haut, en pixels entiers ou au dixième près. */
export function parallaxOffset(progress: number, max: number): number {
  return Math.round(Math.min(1, Math.max(0, progress)) * Math.max(0, max) * 10) / 10
}

export function HeroParallax({
  children,
  className,
  max,
  maxMobile,
}: {
  children: React.ReactNode
  className?: string
  /** Décalage maximal sur ordinateur (≥ 1 024 px). */
  max: number
  /** Décalage maximal en dessous. */
  maxMobile: number
}) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const layer = ref.current
    const frameBox = layer?.parentElement
    if (!layer || !frameBox || typeof window.matchMedia !== "function") return
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)")
    const wide = window.matchMedia("(min-width: 1024px)")
    let frame = 0

    const apply = () => {
      frame = 0
      if (reduce.matches) {
        layer.style.translate = ""
        return
      }
      const box = frameBox.getBoundingClientRect()
      const offset = parallaxOffset(parallaxProgress(box.top, box.height, window.innerHeight), wide.matches ? max : maxMobile)
      layer.style.translate = offset ? `0 ${-offset}px` : ""
    }
    const schedule = () => {
      if (!frame) frame = window.requestAnimationFrame(apply)
    }

    apply()
    window.addEventListener("scroll", schedule, { passive: true })
    window.addEventListener("resize", schedule)
    reduce.addEventListener?.("change", schedule)
    wide.addEventListener?.("change", schedule)
    return () => {
      if (frame) window.cancelAnimationFrame(frame)
      window.removeEventListener("scroll", schedule)
      window.removeEventListener("resize", schedule)
      reduce.removeEventListener?.("change", schedule)
      wide.removeEventListener?.("change", schedule)
      layer.style.translate = ""
    }
  }, [max, maxMobile])

  return (
    <div ref={ref} className={className}>
      {children}
    </div>
  )
}
