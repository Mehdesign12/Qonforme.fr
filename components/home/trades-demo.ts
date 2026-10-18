/**
 * Calculs purs de la rangée des métiers de l'accueil (TradesStrip.tsx) : la
 * trajectoire de la souris de démonstration, le placement de la carte photo
 * autour du pointeur, le test « le pointeur est sur le lien ». Sans React ni
 * DOM, pour être testés tels quels.
 */

export interface Box {
  left: number
  top: number
  right: number
  bottom: number
}

export interface DemoFrame {
  /** Pointe de la souris, en pixels d'écran. */
  x: number
  y: number
  /** 0 : invisible, 1 : pleine. */
  opacity: number
}

/** Durée de la démonstration : un passage lent sur le premier métier. */
export const DEMO_MS = 6400

/**
 * Étapes de la trajectoire. `fx` et `fy` sont des parts de la largeur et de la
 * hauteur du lien, `dx` et `dy` des décalages en pixels : la souris arrive du bas
 * à gauche, entre sur l'icône (1 700 ms), traverse le mot en 3 s et repart en bas
 * à droite sans jamais aller vite.
 */
const WAYPOINTS = [
  { t: 0, fx: 0, fy: 1, dx: -72, dy: 62, o: 0 },
  { t: 500, fx: 0, fy: 1, dx: -60, dy: 52, o: 1 },
  { t: 1700, fx: 0, fy: 0.68, dx: 20, dy: 0, o: 1 },
  { t: 3400, fx: 0.5, fy: 0.5, dx: 0, dy: 0, o: 1 },
  { t: 5200, fx: 1, fy: 0.62, dx: -12, dy: 0, o: 1 },
  { t: 6400, fx: 1, fy: 1, dx: 40, dy: 48, o: 0 },
] as const

const easeInOutSine = (u: number) => -(Math.cos(Math.PI * u) - 1) / 2

/** Position et opacité de la souris de démonstration à l'instant `t` (ms), autour du lien `box`. */
export function demoFrame(t: number, box: Box): DemoFrame {
  const w = box.right - box.left
  const h = box.bottom - box.top
  const at = (p: (typeof WAYPOINTS)[number]) => ({ x: box.left + w * p.fx + p.dx, y: box.top + h * p.fy + p.dy, o: p.o })
  if (t <= WAYPOINTS[0].t) {
    const p = at(WAYPOINTS[0])
    return { x: p.x, y: p.y, opacity: p.o }
  }
  for (let i = 1; i < WAYPOINTS.length; i++) {
    const to = WAYPOINTS[i]
    if (t <= to.t) {
      const from = WAYPOINTS[i - 1]
      const u = easeInOutSine((t - from.t) / (to.t - from.t))
      const a = at(from)
      const b = at(to)
      return { x: a.x + (b.x - a.x) * u, y: a.y + (b.y - a.y) * u, opacity: a.o + (b.o - a.o) * u }
    }
  }
  const last = at(WAYPOINTS[WAYPOINTS.length - 1])
  return { x: last.x, y: last.y, opacity: last.o }
}

/** Le point (x, y) est-il sur le rectangle, à `pad` pixels près ? */
export function inside(box: Box, x: number, y: number, pad = 3): boolean {
  return x >= box.left - pad && x <= box.right + pad && y >= box.top - pad && y <= box.bottom + pad
}

/** Écart entre le pointeur et la carte. */
const GAP_X = 22
const GAP_Y = 26
/** Marge gardée avec le bord de la fenêtre. */
const EDGE = 8

/**
 * Coin haut gauche de la carte de taille (w, h) pour un pointeur en (cx, cy) :
 * en bas à droite du pointeur, passée à gauche ou au-dessus quand elle sortirait
 * de la fenêtre (vw, vh), sans jamais dépasser le bord haut ou gauche.
 */
export function placeCard(cx: number, cy: number, w: number, h: number, vw: number, vh: number): { x: number; y: number } {
  let x = cx + GAP_X
  let y = cy + GAP_Y
  if (x + w > vw - EDGE) x = cx - GAP_X - w
  if (y + h > vh - EDGE) y = cy - GAP_Y + 8 - h
  return { x: Math.max(EDGE, x), y: Math.max(EDGE, y) }
}
