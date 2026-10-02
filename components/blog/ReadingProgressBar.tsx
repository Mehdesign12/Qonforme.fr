"use client"

import { useEffect, useState } from "react"

/**
 * Fine barre de progression de lecture, fixée en haut de la page.
 * requestAnimationFrame pour rester fluide sur mobile ; accent bleu unique.
 */
export default function ReadingProgressBar() {
  const [progress, setProgress] = useState(0)

  useEffect(() => {
    let ticking = false

    function onScroll() {
      if (ticking) return
      ticking = true
      requestAnimationFrame(() => {
        const scrollTop = window.scrollY
        const docHeight = document.documentElement.scrollHeight - window.innerHeight
        setProgress(docHeight > 0 ? Math.min((scrollTop / docHeight) * 100, 100) : 0)
        ticking = false
      })
    }

    window.addEventListener("scroll", onScroll, { passive: true })
    return () => window.removeEventListener("scroll", onScroll)
  }, [])

  return (
    <div aria-hidden className="pointer-events-none fixed inset-x-0 top-0 z-[101] h-[3px]">
      <div className="h-full bg-q-accent transition-[width] duration-150 ease-out motion-reduce:transition-none" style={{ width: `${progress}%` }} />
    </div>
  )
}
