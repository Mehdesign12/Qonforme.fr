import Image from "next/image"
import { cn } from "@/lib/utils"

/**
 * Logotype « Solution compatible – Facturation électronique » de la Direction
 * générale des Finances publiques.
 *
 * Droit d'usage déclaré par le fondateur le 17/10/2026 (label obtenu ; voir
 * DECISIONS-STRATEGIQUES.md § 13). Règles de la charte d'utilisation et de la
 * charte graphique de la DGFiP (30/07/2025), à ne jamais enfreindre :
 *  - logotype reproduit en entier, tel que fourni : jamais déformé, incliné,
 *    recoloré, en transparence, ni avec une ombre ou un autre effet ; il garde
 *    son cartouche blanc et sa zone de protection (le fichier les contient) ;
 *  - jamais sous 12 px de haut pour le cartouche « Solution compatible » (21 px
 *    dans le fichier de 329 px) : l'image ne s'affiche donc jamais sous 192 px
 *    de large ;
 *  - accompagné de la mention « Solution compatible facturation électronique »
 *    (dans le logotype et dans le texte alternatif) ;
 *  - à des fins d'information générale seulement ; droit non permanent, révocable
 *    par l'État, qui peut en exiger le retrait immédiat de tous les supports :
 *    passer SOLUTION_COMPATIBLE à `false` retire le logotype de toutes les pages.
 *
 * Le fichier a un fond blanc : sur le thème sombre ou un fond marine, il reste
 * dans son cartouche blanc, sans cadre ajouté dans sa zone de protection.
 */
export const SOLUTION_COMPATIBLE = true

const LOGO = {
  src: "/brand/solution-compatible-facturation-electronique.webp",
  width: 329,
  height: 153,
  alt: "Solution compatible facturation électronique",
} as const

/** Largeurs d'affichage (px) : toutes au-dessus du minimum de 192 px de la charte. */
const WIDTHS = { sm: 192, md: 216 } as const

export function SolutionCompatible({
  size = "md",
  priority = false,
  className,
}: {
  size?: keyof typeof WIDTHS
  /** Au-dessus de la ligne de flottaison (héros). */
  priority?: boolean
  className?: string
}) {
  if (!SOLUTION_COMPATIBLE) return null
  const width = WIDTHS[size]
  return (
    <span className={cn("inline-block shrink-0 overflow-hidden rounded-[14px] border border-q-line bg-white leading-[0]", className)}>
      <Image
        src={LOGO.src}
        alt={LOGO.alt}
        width={LOGO.width}
        height={LOGO.height}
        sizes={`${width}px`}
        priority={priority}
        loading={priority ? undefined : "lazy"}
        style={{ width, height: "auto" }}
      />
    </span>
  )
}

/**
 * Le logotype et, à côté, ce qu'il dit en une phrase (qui n'invente rien : une
 * solution compatible est raccordée à une plateforme agréée, qui seule transmet
 * les factures). Pour les bandeaux de l'accueil.
 */
export function SolutionCompatibleNote({ className, tone = "light" }: { className?: string; tone?: "light" | "dark" }) {
  if (!SOLUTION_COMPATIBLE) return null
  return (
    <div className={cn("flex flex-col items-center gap-4 text-center sm:flex-row sm:items-center sm:gap-6 sm:text-left", className)}>
      <SolutionCompatible />
      <div className="min-w-0">
        <p className={cn("font-display text-[18px] font-semibold leading-snug tracking-[-0.02em]", tone === "dark" ? "text-white" : "text-q-ink-strong")}>
          Prêt pour la facturation électronique
        </p>
        <p className={cn("mt-1 max-w-[520px] text-[15px] leading-[1.6]", tone === "dark" ? "text-[#AFBDD3]" : "text-q-text-3")}>
          Qonforme est une solution compatible facturation électronique : il est raccordé à une plateforme agréée, qui transmet les factures.
        </p>
      </div>
    </div>
  )
}
