/**
 * Géométrie du recadrage d'une photo de document. Tout est exprimé en
 * fractions de l'image affichée (0 à 1) : le même recadrage sert à l'écran et à
 * l'image finale, quelle que soit sa définition. Module pur, testable.
 */
export interface Crop { x: number; y: number; w: number; h: number }

/** Côté minimal d'un recadrage : assez grand pour rester lisible et saisissable. */
export const MIN_CROP = 0.12

export const FULL_CROP: Crop = { x: 0, y: 0, w: 1, h: 1 }

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))

/** Ramène un recadrage dans l'image, sans le rendre plus petit que MIN_CROP. */
export function clampCrop(c: Crop): Crop {
  const w = clamp(c.w, MIN_CROP, 1)
  const h = clamp(c.h, MIN_CROP, 1)
  return { x: clamp(c.x, 0, 1 - w), y: clamp(c.y, 0, 1 - h), w, h }
}

export type Corner = "nw" | "ne" | "sw" | "se"

/** Déplace un coin vers (px, py) ; le coin opposé reste fixe. */
export function dragCorner(c: Crop, corner: Corner, px: number, py: number): Crop {
  const right = c.x + c.w
  const bottom = c.y + c.h
  let left = c.x
  let top = c.y
  let r = right
  let b = bottom
  const x = clamp(px, 0, 1)
  const y = clamp(py, 0, 1)
  if (corner === "nw" || corner === "sw") left = Math.min(x, right - MIN_CROP)
  if (corner === "ne" || corner === "se") r = Math.max(x, left + MIN_CROP)
  if (corner === "nw" || corner === "ne") top = Math.min(y, bottom - MIN_CROP)
  if (corner === "sw" || corner === "se") b = Math.max(y, top + MIN_CROP)
  return clampCrop({ x: left, y: top, w: r - left, h: b - top })
}

/** Déplace tout le recadrage de (dx, dy), sans le sortir de l'image. */
export function moveCrop(c: Crop, dx: number, dy: number): Crop {
  return { ...c, x: clamp(c.x + dx, 0, 1 - c.w), y: clamp(c.y + dy, 0, 1 - c.h) }
}

/** Dimensions d'une image réduite pour que son grand côté ne dépasse pas `maxSide` (jamais agrandie). */
export function fitWithin(width: number, height: number, maxSide: number): { width: number; height: number } {
  const longSide = Math.max(width, height)
  if (longSide <= maxSide) return { width: Math.round(width), height: Math.round(height) }
  const k = maxSide / longSide
  return { width: Math.max(1, Math.round(width * k)), height: Math.max(1, Math.round(height * k)) }
}

/** Zone source en pixels pour un recadrage donné d'une image de `width` × `height`. */
export function cropRect(c: Crop, width: number, height: number): { sx: number; sy: number; sw: number; sh: number } {
  const k = clampCrop(c)
  const sx = Math.round(k.x * width)
  const sy = Math.round(k.y * height)
  return { sx, sy, sw: Math.max(1, Math.min(width - sx, Math.round(k.w * width))), sh: Math.max(1, Math.min(height - sy, Math.round(k.h * height))) }
}
