import Link from "next/link"
import { ArrowRight } from "lucide-react"

interface OutilsCtaBarProps {
  text: string
  cta?: string
  href?: string
}

/**
 * Barre d'appel collée en bas de l'écran sur mobile (masquée dès 640 px).
 * Fond opaque : aucun backdrop-filter (règle iOS de CLAUDE.md). La coque
 * ToolShell réserve sa hauteur sous le pied de page.
 */
export function OutilsCtaBar({ text, cta = "Créer mon compte", href = "/signup" }: OutilsCtaBarProps) {
  return (
    <div
      className="fixed inset-x-0 bottom-0 z-40 border-t border-q-line bg-q-surface px-4 pt-3 shadow-[0_-10px_30px_-18px_rgba(10,17,34,.35)] sm:hidden"
      style={{ paddingBottom: "max(12px, env(safe-area-inset-bottom))" }}
    >
      <div className="flex items-center gap-3">
        <p className="min-w-0 flex-1 text-[13px] leading-[1.35] text-q-text-3">{text}</p>
        <Link href={href} className="lp-btn-p !h-11 shrink-0 !gap-1.5 !px-4 !text-[15px]">
          {cta}
          <ArrowRight className="lp-btn-arrow h-4 w-4" strokeWidth={2} aria-hidden />
        </Link>
      </div>
    </div>
  )
}
