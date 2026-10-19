import { HardHat, Ruler, type LucideIcon } from "lucide-react"
import { cn } from "@/lib/utils"

/**
 * Petite composition de marque pour l'application, la démo et l'admin (états
 * vides, fenêtres, écrans d'accueil et de confirmation) : l'icône du sujet au
 * centre en bleu plein, deux outils du bâtiment en bleu pâle de part et d'autre,
 * inclinés comme sur les couvertures d'articles. Jamais de fond derrière une icône.
 *
 * Décoratif (aria-hidden), statique, sans backdrop-filter ni will-change
 * (règle iOS de CLAUDE.md) ; visible sur tous les écrans. Trois icônes
 * seulement : utilisable dans les composants clients sans alourdir la page.
 */

const SIZES = {
  sm: { box: "h-[60px] w-[108px]", main: "size-9", picto: 22 },
  md: { box: "h-[76px] w-[132px]", main: "size-11", picto: 28 },
  lg: { box: "h-[104px] w-[180px]", main: "size-16", picto: 38 },
} as const

export function PictoCluster({
  icon,
  size = "md",
  pictos = [HardHat, Ruler],
  tone = "accent",
  className,
}: {
  /** Icône du sujet (déjà rendue : sa taille est fixée ici). */
  icon: React.ReactNode
  size?: keyof typeof SIZES
  /** Les deux pictogrammes pâles (gauche, droite). */
  pictos?: readonly [LucideIcon, LucideIcon]
  /** Couleur de l'icône du sujet : bleu (défaut), vert (réussi), rouge (erreur), ambre (attention). */
  tone?: "accent" | "ok" | "danger" | "warn"
  className?: string
}) {
  const s = SIZES[size]
  const [Left, Right] = pictos
  return (
    <span aria-hidden className={cn("relative grid shrink-0 place-items-center", s.box, className)}>
      <Left
        size={s.picto}
        strokeWidth={1.6}
        absoluteStrokeWidth
        className="absolute bottom-0 left-0 -rotate-[10deg] text-[var(--q-accent)] opacity-[.42]"
      />
      <Right
        size={s.picto}
        strokeWidth={1.6}
        absoluteStrokeWidth
        className="absolute right-0 top-0 rotate-[14deg] text-[var(--q-accent)] opacity-[.42]"
      />
      <span
        className={cn(
          "grid place-items-center [&>svg]:size-full [&>svg]:[stroke-width:1.5]",
          s.main,
          tone === "accent" && "text-[var(--q-accent-strong)]",
          tone === "ok" && "text-[var(--q-ok)]",
          tone === "danger" && "text-[var(--q-danger)]",
          tone === "warn" && "text-[var(--q-warn)]",
        )}
      >
        {icon}
      </span>
    </span>
  )
}
