import Link from "next/link"
import { Check, ChevronRight } from "lucide-react"
import type { ReactNode } from "react"
import { cn } from "@/lib/utils"
import { frSpaces } from "./kit"

interface OutilsHeroProps {
  /** Pictogramme de l'outil, dans la pastille au-dessus du titre. */
  icon?: ReactNode
  /** Texte de la pastille (« Barèmes 2026 », « Données INSEE »…). */
  badge?: string
  /** Première voix du titre (Bricolage Grotesque). */
  title: ReactNode
  /** Seconde voix, à la ligne, en Instrument Serif italique bleu. */
  accent?: ReactNode
  subtitle: ReactNode
  /** Nom de l'outil dans le fil d'Ariane (absent sur le hub). */
  crumb?: string
  /** Engagements vrais sous le chapeau. */
  checks?: string[]
  children?: ReactNode
  className?: string
}

const DEFAULT_CHECKS = ["Gratuit", "Sans inscription", "Rien n'est enregistré"]

/**
 * En-tête partagé du hub et des 12 outils, d'après le héros du canevas
 * « Main » : pastille, titre en deux voix centré, chapeau, engagements cochés.
 * Fond clair avec le halo bleu du canevas (--q-glow), sans dégradé multicolore.
 */
export function OutilsHero({ icon, badge, title, accent, subtitle, crumb, checks = DEFAULT_CHECKS, children, className }: OutilsHeroProps) {
  return (
    <header
      className={cn("relative px-4 pb-8 pt-[104px] sm:px-6 sm:pb-12 sm:pt-[136px]", className)}
      style={{ backgroundImage: "var(--q-glow)" }}
    >
      <div className="mx-auto flex w-full max-w-[880px] flex-col items-center text-center">
        {crumb && (
          <nav aria-label="Fil d'Ariane" className="mb-6">
            <ol className="flex flex-wrap items-center justify-center gap-x-1.5 gap-y-1 text-[13px] text-q-text-4">
              <li>
                <Link href="/outils" className="rounded transition-colors hover:text-q-accent-strong">
                  Outils gratuits
                </Link>
              </li>
              <li aria-hidden>
                <ChevronRight className="h-3.5 w-3.5 text-q-placeholder" />
              </li>
              <li aria-current="page" className="font-medium text-q-text-2">
                {crumb}
              </li>
            </ol>
          </nav>
        )}

        {(icon || badge) && (
          <p className="mb-5 inline-flex h-9 items-center gap-2 rounded-full border border-q-line bg-q-surface py-1 pl-1 pr-3.5 text-[13px] font-medium text-q-text-2 shadow-[var(--q-shadow-card)]">
            {icon && (
              <span className="grid h-7 w-7 place-items-center rounded-full bg-q-wash text-q-accent-strong [&_svg]:h-[15px] [&_svg]:w-[15px]" aria-hidden>
                {icon}
              </span>
            )}
            {badge}
          </p>
        )}

        <h1 className="font-display text-[clamp(34px,5vw,58px)] font-semibold leading-[1.04] tracking-[-0.035em] text-q-ink-strong [text-wrap:balance]">
          {typeof title === "string" ? frSpaces(title) : title}
          {accent && (
            <>
              <br />
              <span className="q-serif">{typeof accent === "string" ? frSpaces(accent) : accent}</span>
            </>
          )}
        </h1>

        <p className="mt-5 max-w-[640px] text-[17px] leading-[1.6] text-q-text-3 sm:text-[18px]">{typeof subtitle === "string" ? frSpaces(subtitle) : subtitle}</p>

        {children}

        {checks.length > 0 && (
          <ul className="mt-6 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-[14px] text-q-text-3">
            {checks.map((c) => (
              <li key={c} className="inline-flex items-center gap-1.5">
                <Check className="h-4 w-4 text-q-accent" strokeWidth={2.25} aria-hidden />
                {c}
              </li>
            ))}
          </ul>
        )}
      </div>
    </header>
  )
}
