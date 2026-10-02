"use client"

import { useEffect, useState } from "react"

interface Heading {
  id: string
  text: string
  level: number
}

interface Props {
  headings: Heading[]
}

/**
 * Sommaire collé au défilement, sur grand écran seulement.
 * Met en avant la section en cours (IntersectionObserver).
 */
export default function TableOfContents({ headings }: Props) {
  const [activeId, setActiveId] = useState("")

  useEffect(() => {
    if (headings.length === 0) return

    const observer = new IntersectionObserver(
      (entries) => {
        // Find the first heading that's intersecting from top
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setActiveId(entry.target.id)
            break
          }
        }
      },
      { rootMargin: "-80px 0px -70% 0px", threshold: 0 }
    )

    const elements = headings
      .map((h) => document.getElementById(h.id))
      .filter(Boolean) as HTMLElement[]

    elements.forEach((el) => observer.observe(el))
    return () => observer.disconnect()
  }, [headings])

  if (headings.length < 3) return null

  return (
    <nav aria-label="Sommaire" className="sticky top-28 hidden max-h-[calc(100vh-9rem)] overflow-y-auto [scrollbar-width:none] xl:block">
      <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.08em] text-q-text-4">
        Sommaire
      </p>
      <ul className="space-y-0.5 border-l border-q-line">
        {headings.map((h) => (
          <li key={h.id}>
            <a
              href={`#${h.id}`}
              aria-current={activeId === h.id ? "location" : undefined}
              onClick={(e) => {
                e.preventDefault()
                document.getElementById(h.id)?.scrollIntoView({ behavior: "smooth", block: "start" })
              }}
              className={`
                -ml-px block border-l py-1.5 text-[13px] leading-snug transition-colors duration-200
                ${h.level === 3 ? "pl-6" : "pl-4"}
                ${activeId === h.id
                  ? "border-q-accent font-semibold text-q-accent-strong"
                  : "border-transparent text-q-text-4 hover:text-q-ink"
                }
              `}
            >
              {h.text}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  )
}
