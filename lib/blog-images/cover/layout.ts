/**
 * Mise en page de la couverture d'un article (piste « A · Clair sobre », choisie
 * par le fondateur le 17/10/2026 sur le canevas
 * https://claude.ai/artifact/1mZMKJLgGUPmeqpaqPGxt3) : fond blanc, logo en haut,
 * titre au centre en deux voix (Bricolage Grotesque, puis Instrument Serif
 * italique en bleu pour la fin du titre), huit icônes au trait fin autour.
 * Aucun dégradé ni halo (refusés par le fondateur).
 *
 * Le moteur de rendu ne mesure pas le texte : les lignes du titre sont
 * coupées ici, avec les largeurs des polices (assets.generated.ts), et la
 * taille des caractères est la plus grande qui tient dans le cadre.
 *
 * Module pur : serveur et tests.
 */
import { ICON_MARKUP, type CoverIconId } from "@/lib/blog-images/cover/icon-markup"
import { SANS_METRICS, SERIF_METRICS, type FontMetrics } from "@/lib/blog-images/cover/assets.generated"

export const COVER_WIDTH = 1600
export const COVER_HEIGHT = 900

export const COVER_COLORS = {
  background: "#FFFFFF",
  ink: "#0F172A",
  blue: "#2563EB",
  /** Bleu pâle des icônes secondaires. */
  soft: "#A9BFE6",
} as const

/** Largeur disponible pour le titre : entre les colonnes d'icônes. */
export const TITLE_MAX_WIDTH = 1000
/** Hauteur maximale du bloc du titre (le logo et les icônes du bas gardent leur place). */
export const TITLE_MAX_HEIGHT = 440
/** Décalage du bloc du titre vers le bas : il se centre sous le logo. */
export const TITLE_OFFSET_TOP = 36
/** Logo : hauteur, position, rapport largeur / hauteur de l'image. */
export const LOGO = { top: 64, height: 46, ratio: 480 / 92 } as const

export interface IconSlot {
  left: number
  top: number
  size: number
  rotate: number
  /** En bleu (le sujet) ; sinon bleu pâle. */
  accent: boolean
}

/** Emplacements de la maquette A (1600 × 900). */
export const ICON_SLOTS: IconSlot[] = [
  { left: 96, top: 168, size: 150, rotate: -8, accent: true },
  { left: 214, top: 452, size: 136, rotate: 12, accent: false },
  { left: 84, top: 676, size: 128, rotate: -6, accent: false },
  { left: 1356, top: 150, size: 150, rotate: 10, accent: false },
  { left: 1262, top: 436, size: 140, rotate: -14, accent: true },
  { left: 1392, top: 672, size: 140, rotate: 0, accent: false },
  { left: 372, top: 758, size: 100, rotate: -6, accent: false },
  { left: 1130, top: 762, size: 96, rotate: 0, accent: false },
]

/** Épaisseur du trait voulue à l'écran (px) : fine, la même quelle que soit la taille de l'icône. */
const STROKE_PX = 3.4

/** Icône en image SVG (adresse « data: »), au trait réglé pour sa taille. */
export function iconDataUri(id: CoverIconId, size: number, color: string): string {
  const strokeWidth = Math.round(((STROKE_PX * 24) / size) * 100) / 100
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="${strokeWidth}" stroke-linecap="round" stroke-linejoin="round">${ICON_MARKUP[id]}</svg>`
  return `data:image/svg+xml;base64,${Buffer.from(svg, "utf8").toString("base64")}`
}

/* ------------------------------------------------------------------ */
/* Titre                                                               */
/* ------------------------------------------------------------------ */

const NBSP = " "

/**
 * Typographie française du titre : espace insécable avant « : ; ? ! % € »,
 * apostrophe courbe, espaces réduits. Les coupures se font aux espaces
 * ordinaires seulement.
 */
export function typesetTitle(title: string): string {
  return title
    .replace(/\s+/g, " ")
    .trim()
    .replace(/'/g, "’")
    .replace(/ ([:;?!%€»])/g, `${NBSP}$1`)
    .replace(/(«) /g, `$1${NBSP}`)
}

/**
 * Coupe un titre en deux voix : la partie en gras (le sujet) et la partie en
 * italique bleu (la fin). Au « : » d'abord, puis à la virgule, au tiret
 * long ; sans séparateur, les derniers mots d'un titre d'au moins quatre mots.
 * Chaque côté garde au moins deux mots, sauf un titre sans séparateur trop
 * court pour être coupé.
 */
export function splitTitle(title: string): { main: string; accent: string } {
  const text = typesetTitle(title)
  const words = (s: string) => s.split(/ +/).filter(Boolean).length
  const colon = text.search(new RegExp(`${NBSP}?: `))
  if (colon > 0) {
    const main = text.slice(0, colon).trimEnd() + `${NBSP}:`
    const accent = text.slice(text.indexOf(": ", colon) + 2).trim()
    if (words(main) >= 1 && words(accent) >= 2) return { main, accent }
  }
  for (const sep of [", ", " — ", " – "]) {
    const at = text.indexOf(sep)
    if (at > 0) {
      const main = text.slice(0, at + (sep === ", " ? 1 : 0)).trim()
      const accent = text.slice(at + sep.length).trim()
      if (words(main) >= 2 && words(accent) >= 2) return { main, accent }
    }
  }
  const list = text.split(/ +/).filter(Boolean)
  if (list.length < 4) return { main: text, accent: "" }
  const tail = Math.min(4, Math.max(2, Math.round(list.length * 0.4)))
  return { main: list.slice(0, list.length - tail).join(" "), accent: list.slice(list.length - tail).join(" ") }
}

/** Largeur d'un texte (px) : largeurs de la police, graisse, approximation sans crénage. */
export function measureText(text: string, metrics: FontMetrics, size: number, letterSpacingEm: number): number {
  let units = 0
  for (const ch of text) units += metrics.widths[ch] ?? metrics.fallback
  return (units / metrics.upm) * size + text.length * letterSpacingEm * size
}

/** Plus petit nombre de lignes, puis lignes les plus égales : null si un mot dépasse ou si `maxLines` ne suffit pas. */
export function wrapBalanced(words: string[], measure: (text: string) => number, maxWidth: number, maxLines: number): string[] | null {
  if (words.length === 0) return []
  if (words.some((w) => measure(w) > maxWidth)) return null
  const greedy = (width: number): string[] => {
    const lines: string[] = []
    let line = ""
    for (const word of words) {
      const next = line ? `${line} ${word}` : word
      if (line && measure(next) > width) {
        lines.push(line)
        line = word
      } else line = next
    }
    if (line) lines.push(line)
    return lines
  }
  const minimal = greedy(maxWidth)
  if (minimal.length > maxLines) return null
  // Rétrécit la largeur cible tant que le nombre de lignes ne change pas : lignes plus égales
  let low = Math.max(...words.map(measure))
  let high = maxWidth
  while (high - low > 4) {
    const mid = (low + high) / 2
    if (greedy(mid).length <= minimal.length) high = mid
    else low = mid
  }
  return greedy(high)
}

export interface TitleLine {
  text: string
  kind: "sans" | "serif"
  size: number
  /** Hauteur de la ligne (px). */
  height: number
  letterSpacing: number
}

export interface TitleLayout {
  lines: TitleLine[]
  /** Hauteur du bloc (px), écart entre les deux voix compris. */
  height: number
  /** Taille des caractères de la voix en gras (px). */
  size: number
  /** Vrai si le titre a dû être raccourci pour tenir. */
  truncated: boolean
}

const SANS_SPACING = -0.03
const SERIF_SPACING = -0.01
const SERIF_RATIO = 1.16
const VOICE_GAP = 12
const SIZES = [100, 96, 92, 88, 84, 80, 76, 72, 68, 64, 60, 56, 52]

function layoutAt(main: string, accent: string, size: number, maxWidth: number): { lines: TitleLine[]; height: number } | null {
  const serifSize = Math.round(size * SERIF_RATIO)
  const maxLines = size <= 64 ? 5 : 4
  const sansWords = main.split(/ +/).filter(Boolean)
  const serifWords = accent.split(/ +/).filter(Boolean)
  const sans = wrapBalanced(sansWords, (t) => measureText(t, SANS_METRICS, size, SANS_SPACING), maxWidth, maxLines)
  const serif = wrapBalanced(serifWords, (t) => measureText(t, SERIF_METRICS, serifSize, SERIF_SPACING), maxWidth, maxLines)
  if (!sans || !serif || sans.length + serif.length > maxLines) return null
  const lines: TitleLine[] = [
    ...sans.map((text): TitleLine => ({ text, kind: "sans", size, height: size, letterSpacing: Math.round(SANS_SPACING * size * 100) / 100 })),
    ...serif.map((text): TitleLine => ({ text, kind: "serif", size: serifSize, height: Math.round(serifSize * 1.02), letterSpacing: Math.round(SERIF_SPACING * serifSize * 100) / 100 })),
  ]
  const height = lines.reduce((sum, l) => sum + l.height, 0) + (sans.length > 0 && serif.length > 0 ? VOICE_GAP : 0)
  return { lines, height }
}

/** Lignes du titre à la plus grande taille qui tient ; un titre trop long est raccourci aux mots entiers (« … »). */
export function layoutTitle(title: string, maxWidth = TITLE_MAX_WIDTH, maxHeight = TITLE_MAX_HEIGHT): TitleLayout {
  let { main, accent } = splitTitle(title)
  if (!main) {
    main = accent
    accent = ""
  }
  const tryFit = (m: string, a: string): TitleLayout | null => {
    for (const size of SIZES) {
      const fit = layoutAt(m, a, size, maxWidth)
      if (fit && fit.height <= maxHeight) return { ...fit, size, truncated: false }
    }
    return null
  }
  const fitted = tryFit(main, accent)
  if (fitted) return fitted
  // Trop long : mots retirés de la fin de la voix en italique, puis de la voix en gras
  const accentWords = accent.split(/ +/).filter(Boolean)
  const mainWords = main.split(/ +/).filter(Boolean)
  while (accentWords.length > 2 || mainWords.length > 2) {
    if (accentWords.length > 2) accentWords.pop()
    else mainWords.pop()
    const clipped = [...accentWords].join(" ")
    const text = accentWords.length > 0 ? `${clipped.replace(/[,;:.…]+$/, "")}…` : clipped
    const fit = tryFit(mainWords.join(" "), accentWords.length > 0 ? text : "")
    if (fit) return { ...fit, truncated: true }
  }
  const last = layoutAt(main, "", SIZES[SIZES.length - 1], maxWidth) ?? { lines: [], height: 0 }
  return { ...last, size: SIZES[SIZES.length - 1], truncated: true }
}
