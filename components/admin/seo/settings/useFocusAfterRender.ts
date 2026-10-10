"use client"

/**
 * Rend le focus clavier après un rendu : quand l'élément focalisé disparaît
 * (preuve validée, puce retirée), le focus retomberait sur la page entière.
 * `focusAfterRender(() => element)` donne le focus à l'élément choisi dès que
 * le rendu suivant est affiché (élément monté et réactivé).
 */
import { useEffect, useRef } from "react"

type Target = () => HTMLElement | null | undefined

export function useFocusAfterRender(): (target: Target) => void {
  const pending = useRef<Target | null>(null)
  useEffect(() => {
    const target = pending.current
    if (!target) return
    pending.current = null
    target()?.focus()
  })
  return (target: Target) => {
    pending.current = target
  }
}
