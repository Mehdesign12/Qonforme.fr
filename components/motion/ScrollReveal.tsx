"use client"

import { useEffect } from "react"
import { usePathname } from "next/navigation"

/**
 * Apparitions au défilement des pages publiques (accueil, pages de contenu,
 * outils, tarifs), à la descente comme à la remontée (demande du fondateur,
 * 17/10/2026).
 *
 * Tout élément marqué `data-reveal` (variantes dans app/globals.css :
 * "" = monte en fondu, "zoom", "left", "right", "fade", "line", "words") :
 *  - apparaît quand il entre dans l'écran, par le bas comme par le haut ; il
 *    vient du côté d'où il entre (d'en dessous en descendant, d'au-dessus en
 *    remontant) ;
 *  - se cache de nouveau une fois sorti entièrement de l'écran, hors de la vue,
 *    pour rejouer son entrée au prochain passage.
 *
 * Sûr par défaut : sans JavaScript, avec « Réduire les animations » ou avant
 * l'enregistrement, tout est visible. Un élément déjà à l'écran à l'arrivée
 * n'est jamais caché (pas de clignotement, aucun effet sur le LCP) ; seuls les
 * éléments hors de l'écran sont préparés. Opacité et transformations seulement,
 * sans will-change (règle iOS de CLAUDE.md).
 *
 * Monté par l'en-tête public (PublicNav), présent sur toutes ces pages : il
 * reprend à chaque changement de page et suit le contenu ajouté ensuite.
 */

const SELECTOR = "[data-reveal]"

export function ScrollReveal() {
  const pathname = usePathname()

  useEffect(() => {
    if (!("IntersectionObserver" in window)) return
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return

    const registered = new WeakSet<Element>()

    // Entrée : un peu à l'intérieur de l'écran, pour que le mouvement se voie
    const enter = new IntersectionObserver(
      (entries) => {
        for (const e of entries) if (e.isIntersecting) (e.target as HTMLElement).dataset.rv = "in"
      },
      { rootMargin: "-7% 0px -7% 0px" },
    )
    // Sortie : entièrement hors de l'écran ; l'élément se prépare à revenir du même côté
    const leave = new IntersectionObserver((entries) => {
      for (const e of entries) {
        if (e.isIntersecting) continue
        const top = e.rootBounds?.top ?? 0
        ;(e.target as HTMLElement).dataset.rv = e.boundingClientRect.top < top ? "above" : "below"
      }
    })

    const register = () => {
      const vh = window.innerHeight
      document.querySelectorAll<HTMLElement>(SELECTOR).forEach((el) => {
        if (registered.has(el)) return
        registered.add(el)
        const r = el.getBoundingClientRect()
        // Déjà à l'écran : visible tout de suite, sans animation
        if (r.bottom > 0 && r.top < vh) el.dataset.rv = "in"
        enter.observe(el)
        leave.observe(el)
      })
    }

    register()
    // Contenu ajouté après coup (listes chargées, sections dépliées)
    let frame = 0
    const mo = new MutationObserver(() => {
      if (!frame) frame = requestAnimationFrame(() => {
        frame = 0
        register()
      })
    })
    mo.observe(document.body, { childList: true, subtree: true })

    return () => {
      mo.disconnect()
      cancelAnimationFrame(frame)
      enter.disconnect()
      leave.disconnect()
      // Page suivante : aucun élément ne doit rester caché faute d'observateur
      document.querySelectorAll<HTMLElement>(SELECTOR).forEach((el) => { el.dataset.rv = "in" })
    }
  }, [pathname])

  return null
}
