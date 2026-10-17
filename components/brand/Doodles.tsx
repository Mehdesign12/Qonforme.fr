import { isValidElement, type ReactElement } from "react"
import type { LucideIcon } from "lucide-react"
import { cn } from "@/lib/utils"

/**
 * Pictogrammes de marque autour des titres (accueil, pages publiques, pages
 * d'accès) : le décor des couvertures d'articles (lib/blog-images/cover/layout.ts,
 * piste « A · Clair sobre ») : trait fin de même épaisseur quelle que soit la
 * taille, un ou deux pictogrammes en bleu plein (le sujet), les autres en bleu
 * pâle, tous un peu inclinés. Jamais de fond derrière une icône.
 *
 * Purement décoratif : aria-hidden, aucun clic, aucune animation, jeton
 * --q-accent (thème sombre compris). Ni backdrop-filter ni will-change (règle
 * iOS de CLAUDE.md). Chaque cadrage n'apparaît qu'à partir de la largeur où les
 * icônes ne touchent jamais le texte ; le téléphone reste sobre.
 *
 * À placer comme premier enfant d'un bloc `relative`. Les cadrages « colonne »
 * se calent sur la colonne de 1 200 px du contenu (gouttières de 24 px), les
 * cadrages « bloc » sur le bloc lui-même.
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
  /** Cadre : colonne de 1 200 px du contenu, ou le bloc entier. */
  frame: string
  slots: Slot[]
}

const COLUMN = "inset-x-6 mx-auto max-w-[1200px]"

/** Seuils d'affichage possibles (classes complètes, pour que Tailwind les retrouve). */
const FROM = { 1100: "min-[1100px]:block", 1180: "min-[1180px]:block", 1280: "min-[1280px]:block" } as const

export type DoodleLayout =
  | "right" | "right-short" | "sides" | "sides-short" | "hero" | "frame"
  | "page" | "page-right" | "article" | "auth" | "auth-column"

const LAYOUTS: Record<DoodleLayout, Layout> = {
  /** Accueil, titre à gauche : un groupe en haut à droite, dans la bande du titre. */
  right: {
    show: "min-[1100px]:block",
    frame: cn(COLUMN, "top-[clamp(88px,9vw,120px)]"),
    slots: [
      { top: 0, right: 80, size: 104, rotate: 8, accent: true },
      { top: 26, right: 232, size: 72, rotate: -12, wide: true },
      { top: 48, right: -18, size: 80, rotate: -4 },
    ],
  },
  /** Accueil, titre à gauche sur une seule ligne : même groupe, remonté pour ne pas toucher le contenu juste dessous. */
  "right-short": {
    show: "min-[1100px]:block",
    frame: cn(COLUMN, "top-[clamp(88px,9vw,120px)]"),
    slots: [
      { top: -40, right: 80, size: 104, rotate: 8, accent: true },
      { top: -18, right: 232, size: 72, rotate: -12, wide: true },
      { top: 4, right: -18, size: 80, rotate: -4 },
    ],
  },
  /** Accueil, titre centré : deux icônes de chaque côté, dans la bande du titre (gauche, gauche, droite, droite). */
  sides: {
    show: "min-[1180px]:block",
    frame: cn(COLUMN, "top-[clamp(88px,9vw,120px)]"),
    slots: [
      { top: 8, left: -4, size: 112, rotate: -8, accent: true },
      { top: 150, left: 74, size: 80, rotate: 12, wide: true },
      { top: 0, right: -4, size: 104, rotate: 10 },
      { top: 142, right: 70, size: 88, rotate: -14, accent: true, wide: true },
    ],
  },
  /**
   * Titre centré suivi de près par des cartes pleine largeur (variante B de
   * l'accueil, /design) : une icône de chaque côté du titre, rien en dessous.
   */
  "sides-short": {
    show: "min-[1180px]:block",
    frame: cn(COLUMN, "top-[clamp(80px,9vw,120px)]"),
    slots: [
      { top: -10, left: -4, size: 100, rotate: -8, accent: true },
      { top: -18, right: -4, size: 92, rotate: 10 },
    ],
  },
  /** Héros de l'accueil : trois icônes de chaque côté du titre, depuis le haut du héros (gauche ×3, droite ×3). */
  hero: {
    show: "min-[1280px]:block",
    frame: cn(COLUMN, "top-0"),
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
    frame: cn(COLUMN, "inset-y-0"),
    slots: [
      { top: 28, left: 12, size: 100, rotate: -8, accent: true },
      { bottom: 28, left: 120, size: 88, rotate: 10 },
      { top: 40, right: 40, size: 96, rotate: 12 },
      { bottom: 24, right: 110, size: 104, rotate: -10, accent: true },
    ],
  },
  /**
   * En-tête centré d'une page publique (guides, modèles, outils, tarifs, blog),
   * depuis le haut de l'en-tête, sous la barre flottante (gauche, gauche, droite, droite).
   */
  page: {
    show: "min-[1180px]:block",
    frame: cn(COLUMN, "top-0"),
    slots: [
      { top: 150, left: -4, size: 108, rotate: -8, accent: true },
      { top: 300, left: 76, size: 78, rotate: 12, wide: true },
      { top: 138, right: -4, size: 100, rotate: 10 },
      { top: 286, right: 66, size: 86, rotate: -14, accent: true, wide: true },
    ],
  },
  /** En-tête d'une page de détail, titre à gauche (guide, modèle, terme) : un groupe à droite du titre. */
  "page-right": {
    show: "min-[1180px]:block",
    frame: cn(COLUMN, "top-0"),
    slots: [
      { top: 150, right: 84, size: 104, rotate: 8, accent: true },
      { top: 178, right: 236, size: 72, rotate: -12, wide: true },
      { top: 204, right: -14, size: 80, rotate: -4 },
      { top: 262, right: 150, size: 64, rotate: 6, wide: true },
    ],
  },
  /**
   * En-tête d'un article du blog (colonne de lecture centrée, partage à gauche,
   * sommaire à droite sous le titre) : une icône de chaque côté, dans la bande du
   * titre, au-dessus du partage et du sommaire. À poser très discrètement
   * (`className="opacity-60"`) : la couverture porte déjà les mêmes icônes.
   */
  article: {
    show: "min-[1180px]:block",
    frame: cn(COLUMN, "top-0"),
    slots: [
      { top: 150, right: 4, size: 84, rotate: 10, accent: true },
      { top: 244, right: 100, size: 58, rotate: -12, wide: true },
      { top: 176, left: 6, size: 66, rotate: -8 },
    ],
  },
  /** Page d'accès sur une seule colonne (mot de passe, étapes d'inscription) : de chaque côté du formulaire. */
  auth: {
    show: "min-[1100px]:block",
    frame: cn(COLUMN, "top-0"),
    slots: [
      { top: 120, left: 8, size: 104, rotate: -8, accent: true },
      { top: 300, left: 110, size: 76, rotate: 12 },
      { top: 104, right: 16, size: 96, rotate: 10 },
      { top: 280, right: 96, size: 84, rotate: -14, accent: true },
    ],
  },
  /**
   * Colonne du formulaire à côté d'un panneau (connexion, inscription) : dans les
   * coins de la colonne. À 1 280 px, le formulaire de 400 px laisse environ 112 px
   * de chaque côté : icônes de 72 px au plus, à 20 px au moins du formulaire.
   */
  "auth-column": {
    show: "min-[1280px]:block",
    frame: "inset-0",
    slots: [
      { top: 96, right: 20, size: 72, rotate: 10, accent: true },
      { top: 200, right: 44, size: 52, rotate: -12 },
      { bottom: 56, left: 18, size: 72, rotate: -8 },
      { bottom: 150, left: 40, size: 52, rotate: 6, accent: true },
    ],
  },
}

/** Épaisseur du trait à l'écran (px) : fine, la même quelle que soit la taille de l'icône. */
const STROKE_PX = 2.4

/** Un pictogramme : composant Lucide, ou icône déjà rendue (l'icône d'un outil, par exemple). */
export type Picto = LucideIcon | ReactElement

/**
 * Répartit les pictogrammes sur les emplacements : `icons` dans l'ordre des
 * emplacements, ou `accent` sur les emplacements bleus et `soft` sur les pâles
 * (chaque liste prend le relais de l'autre si elle est épuisée).
 */
function fill(slots: Slot[], icons?: readonly Picto[], accent: readonly Picto[] = [], soft: readonly Picto[] = []): (Picto | undefined)[] {
  if (icons) return slots.map((_, i) => icons[i])
  const a = [...accent]
  const s = [...soft]
  return slots.map((slot) => (slot.accent ? a.shift() ?? s.shift() : s.shift() ?? a.shift()))
}

function renderPicto(picto: Picto, size: number) {
  if (isValidElement(picto)) return picto
  const Icon = picto as LucideIcon
  // `size` (et non width/height) : le trait absolu de Lucide se calcule à partir de lui
  return <Icon size={size} strokeWidth={STROKE_PX} absoluteStrokeWidth aria-hidden />
}

export function Doodles({
  layout,
  icons,
  accent,
  soft,
  from,
  className,
}: {
  layout: DoodleLayout
  /** Pictogrammes dans l'ordre des emplacements (accueil). */
  icons?: readonly Picto[]
  /** Ou : le sujet en bleu plein, puis son univers en bleu pâle (lib/blog-images/cover/icons.ts). */
  accent?: readonly Picto[]
  soft?: readonly Picto[]
  /** Seuil d'affichage, à la place de celui du cadrage (contenu plus large que prévu). */
  from?: keyof typeof FROM
  className?: string
}) {
  const { frame, slots } = LAYOUTS[layout]
  const show = from ? FROM[from] : LAYOUTS[layout].show
  const pictos = fill(slots, icons, accent, soft)
  return (
    <div aria-hidden className={cn("pointer-events-none absolute z-0 hidden", show, frame, className)}>
      {slots.map((slot, i) => {
        const Icon = pictos[i]
        if (!Icon) return null
        return (
          <span
            key={i}
            className={cn(
              "absolute block text-q-accent",
              !slot.accent && "opacity-[.42]",
              slot.wide && "max-[1279px]:hidden",
              // Icône déjà rendue : même trait fin, en pixels d'écran
              isValidElement(Icon) && "[&>svg]:size-full [&>svg]:[stroke-width:2.4] [&_svg_*]:[vector-effect:non-scaling-stroke]",
            )}
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
            {renderPicto(Icon, slot.size)}
          </span>
        )
      })}
    </div>
  )
}
