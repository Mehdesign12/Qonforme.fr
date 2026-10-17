"use client"

import { useEffect, useRef, useState } from "react"
import { usePrefersReducedMotion } from "@/components/landing/carousels"

/**
 * Nombre qui se compte quand il entre à l'écran (variante B de l'accueil, /design),
 * à la descente comme à la remontée, comme les apparitions de ScrollReveal.
 *
 * Sûr par défaut : le rendu du serveur, l'absence de JavaScript et « Réduire les
 * animations » affichent la valeur finale. Un nombre déjà à l'écran à l'arrivée
 * n'est jamais remis à zéro ; seul un nombre hors de l'écran se prépare.
 * Les lecteurs d'écran lisent la valeur finale, jamais les étapes du compte.
 */
export function CountUp({
  value,
  decimals = 0,
  prefix = "",
  suffix = "",
  duration = 1400,
  className,
}: {
  value: number
  decimals?: number
  prefix?: string
  suffix?: string
  /** Durée du compte, en millisecondes. */
  duration?: number
  className?: string
}) {
  const ref = useRef<HTMLSpanElement>(null)
  const [shown, setShown] = useState(value)
  // Suivi en direct : « Réduire les animations » activé après le chargement arrête aussi le compte
  const reduced = usePrefersReducedMotion()

  useEffect(() => {
    const el = ref.current
    if (!el || !("IntersectionObserver" in window)) return
    if (reduced || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setShown(value)
      return
    }

    let frame = 0
    const stop = () => {
      if (frame) cancelAnimationFrame(frame)
      frame = 0
    }
    const run = () => {
      stop()
      const start = performance.now()
      const tick = (now: number) => {
        const t = Math.min(1, (now - start) / duration)
        const eased = 1 - Math.pow(1 - t, 3)
        setShown(value * eased)
        if (t < 1) frame = requestAnimationFrame(tick)
        else frame = 0
      }
      frame = requestAnimationFrame(tick)
    }

    // Hors de l'écran à l'arrivée : prêt à compter
    const r = el.getBoundingClientRect()
    let armed = !(r.bottom > 0 && r.top < window.innerHeight)
    if (armed) setShown(0)

    // Entrée : un peu à l'intérieur de l'écran, pour que le compte se voie
    const enter = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting && armed) {
          armed = false
          run()
        }
      },
      { rootMargin: "-6% 0px -6% 0px" },
    )
    // Sortie : entièrement hors de l'écran ; le nombre se prépare pour le prochain passage
    const leave = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) return
      stop()
      armed = true
      setShown(0)
    })
    enter.observe(el)
    leave.observe(el)
    return () => {
      stop()
      enter.disconnect()
      leave.disconnect()
    }
  }, [value, duration, reduced])

  const format = (n: number) =>
    n.toLocaleString("fr-FR", { minimumFractionDigits: decimals, maximumFractionDigits: decimals })

  return (
    <span className={className}>
      <span ref={ref} aria-hidden className="tabular-nums">
        {prefix}
        {format(shown)}
        {suffix}
      </span>
      <span className="sr-only">
        {prefix}
        {format(value)}
        {suffix}
      </span>
    </span>
  )
}
