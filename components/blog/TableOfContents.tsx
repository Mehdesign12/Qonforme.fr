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
 * Sticky table of contents for desktop (hidden on mobile).
 * Highlights the current section using IntersectionObserver.
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
    <nav className="hidden xl:block sticky top-24 max-h-[calc(100vh-8rem)] overflow-y-auto scrollbar-none">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-3">
        Sommaire
      </p>
      <ul className="space-y-1 border-l-2 border-slate-100">
        {headings.map((h) => (
          <li key={h.id}>
            <a
              href={`#${h.id}`}
              onClick={(e) => {
                e.preventDefault()
                document.getElementById(h.id)?.scrollIntoView({ behavior: "smooth", block: "start" })
              }}
              className={`
                block text-[13px] leading-snug py-1 transition-colors duration-200
                ${h.level === 3 ? "pl-6" : "pl-4"}
                ${activeId === h.id
                  ? "text-[#2563EB] font-medium border-l-2 border-[#2563EB] -ml-[2px]"
                  : "text-slate-400 hover:text-slate-600"
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
