import type { LucideIcon } from "lucide-react"
import { cn } from "@/lib/utils"

/**
 * Icônes au trait fin autour des titres de l'accueil : le même décor que les
 * couvertures des articles (lib/blog-images/cover/layout.ts, piste « A · Clair
 * sobre ») : trait fin de même épaisseur quelle que soit la taille, un ou deux
 * pictogrammes en bleu plein (le sujet), les autres en bleu pâle, tous un peu
 * inclinés.
 *
 * Purement décoratif : aria-hidden, aucun clic, aucune animation, aucune
 * dépendance au thème (jetons --q-accent). Ni backdrop-filter ni will-change
 * (règle iOS de CLAUDE.md). Visible seulement à partir de 1 100 px : plus
 * étroit, les icônes toucheraient le texte, et le téléphone reste sobre.
 *
 * À placer comme premier enfant d'une section `relative`. L'image est cadrée
 * sur la même colonne de 1 200 px que le contenu (gouttières de 24 px).
 */

interface Slot {
  top?: number
  bottom?: number
  left?: number
  right?: number
  size: number
  rotate: number
  /** En bleu plein (le sujet) ; sinon bleu pâle. */
  accent?: boolean
  /** Seulement à partir de 1 280 px (les icônes intérieures, plus près du texte). */
  wide?: boolean
}

interface Layout {
  /** Seuil d'affichage (classe complète, pour que Tailwind la retrouve). */
  show: string
  /** Cadre : même colonne que le contenu de la section. */
  frame: string
  slots: Slot[]
}

export type DoodleLayout = "right" | "right-short" | "sides" | "hero" | "frame"

const LAYOUTS: Record<DoodleLayout, Layout> = {
  /** Titre à gauche : un groupe en haut à droite, dans la bande du titre. */
  right: {
    show: "min-[1100px]:block",
    frame: "top-[clamp(88px,9vw,120px)]",
    slots: [
      { top: 0, right: 80, size: 104, rotate: 8, accent: true },
      { top: 26, right: 232, size: 72, rotate: -12, wide: true },
      { top: 48, right: -18, size: 80, rotate: -4 },
    ],
  },
  /** Titre à gauche sur une seule ligne : même groupe, remonté pour ne pas toucher le contenu juste dessous. */
  "right-short": {
    show: "min-[1100px]:block",
    frame: "top-[clamp(88px,9vw,120px)]",
    slots: [
      { top: -40, right: 80, size: 104, rotate: 8, accent: true },
      { top: -18, right: 232, size: 72, rotate: -12, wide: true },
      { top: 4, right: -18, size: 80, rotate: -4 },
    ],
  },
  /** Titre centré : deux icônes de chaque côté, dans la bande du titre (gauche, gauche, droite, droite). */
  sides: {
    show: "min-[1180px]:block",
    frame: "top-[clamp(88px,9vw,120px)]",
    slots: [
      { top: 8, left: -4, size: 112, rotate: -8, accent: true },
      { top: 150, left: 74, size: 80, rotate: 12, wide: true },
      { top: 0, right: -4, size: 104, rotate: 10 },
      { top: 142, right: 70, size: 88, rotate: -14, accent: true, wide: true },
    ],
  },
  /** Héros : trois icônes de chaque côté du titre, mesurées depuis le haut du héros (gauche ×3, droite ×3). */
  hero: {
    show: "min-[1280px]:block",
    frame: "top-0",
    slots: [
      { top: 148, left: -8, size: 132, rotate: -8, accent: true },
      { top: 330, left: 80, size: 96, rotate: 12 },
      { top: 480, left: 6, size: 80, rotate: -6 },
      { top: 136, right: -8, size: 124, rotate: 10 },
      { top: 316, right: 76, size: 104, rotate: -14, accent: true },
      { top: 476, right: 8, size: 84, rotate: 0 },
    ],
  },
  /** Texte centré entouré de grandes marges verticales : icônes dans le vide du haut et du bas (haut-gauche, bas-gauche, haut-droite, bas-droite). */
  frame: {
    show: "min-[1180px]:block",
    frame: "inset-y-0",
    slots: [
      { top: 28, left: 12, size: 100, rotate: -8, accent: true },
      { bottom: 28, left: 120, size: 88, rotate: 10 },
      { top: 40, right: 40, size: 96, rotate: 12 },
      { bottom: 24, right: 110, size: 104, rotate: -10, accent: true },
    ],
  },
}

/** Épaisseur du trait à l'écran (px) : fine, la même quelle que soit la taille de l'icône. */
const STROKE_PX = 2.4

export function Doodles({ layout, icons }: { layout: DoodleLayout; icons: readonly LucideIcon[] }) {
  const { show, frame, slots } = LAYOUTS[layout]
  return (
    <div aria-hidden className={cn("pointer-events-none absolute inset-x-6 z-0 mx-auto hidden max-w-[1200px]", show, frame)}>
      {slots.map((slot, i) => {
        const Icon = icons[i]
        if (!Icon) return null
        return (
          <span
            key={i}
            className={cn("absolute block text-q-accent", !slot.accent && "opacity-[.42]", slot.wide && "max-[1279px]:hidden")}
            style={{
              top: slot.top,
              bottom: slot.bottom,
              left: slot.left,
              right: slot.right,
              width: slot.size,
              height: slot.size,
              transform: `rotate(${slot.rotate}deg)`,
            }}
          >
            {/* `size` (et non width/height) : le trait absolu de Lucide se calcule à partir de lui */}
            <Icon size={slot.size} strokeWidth={STROKE_PX} absoluteStrokeWidth aria-hidden />
          </span>
        )
      })}
    </div>
  )
}
