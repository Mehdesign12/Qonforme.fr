"use client"

import Link from "next/link"
import { ArrowRight } from "lucide-react"

interface OutilsCtaBarProps {
  text: string
  cta?: string
}

/**
 * Sticky CTA bar at bottom of screen on mobile — conversion nudge.
 */
export function OutilsCtaBar({ text, cta = "Automatiser →" }: OutilsCtaBarProps) {
  return (
    <div className="fixed bottom-0 inset-x-0 z-50 border-t border-slate-200 bg-white/95 px-4 py-3 sm:hidden" style={{ paddingBottom: "max(12px, env(safe-area-inset-bottom))" }}>
      <div className="flex items-center gap-3">
        <p className="flex-1 text-[12px] leading-tight text-slate-500">{text}</p>
        <Link
          href="/signup"
          className="shrink-0 inline-flex items-center gap-1.5 rounded-full bg-[#2563EB] px-4 py-2 text-[13px] font-semibold text-white"
        >
          {cta} <ArrowRight className="h-3 w-3" />
        </Link>
      </div>
    </div>
  )
}
