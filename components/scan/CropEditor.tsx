"use client"

/**
 * Recadrage d'une photo de document : un cadre à quatre coins qu'on déplace au
 * doigt ou à la souris (ou aux flèches du clavier), le reste s'assombrit. Le
 * cadre est exprimé en fractions de l'image (lib/scan/geometry.ts).
 */
import { useRef } from "react"
import { cn } from "@/lib/utils"
import { dragCorner, moveCrop, type Corner, type Crop } from "@/lib/scan/geometry"

const CORNERS: { id: Corner; label: string; style: (c: Crop) => React.CSSProperties }[] = [
  { id: "nw", label: "coin haut gauche", style: (c) => ({ left: `${c.x * 100}%`, top: `${c.y * 100}%` }) },
  { id: "ne", label: "coin haut droit", style: (c) => ({ left: `${(c.x + c.w) * 100}%`, top: `${c.y * 100}%` }) },
  { id: "sw", label: "coin bas gauche", style: (c) => ({ left: `${c.x * 100}%`, top: `${(c.y + c.h) * 100}%` }) },
  { id: "se", label: "coin bas droit", style: (c) => ({ left: `${(c.x + c.w) * 100}%`, top: `${(c.y + c.h) * 100}%` }) },
]

const KEY_STEP = 0.01

/** `imageClassName` borne l'image elle-même (sa hauteur maximale) : le cadre suit la taille réellement affichée. */
export function CropEditor({ src, crop, onCrop, imageClassName }: { src: string; crop: Crop; onCrop: (c: Crop) => void; imageClassName?: string }) {
  const boxRef = useRef<HTMLDivElement>(null)
  const dragRef = useRef<{ kind: "corner"; corner: Corner } | { kind: "move"; x: number; y: number } | null>(null)

  const point = (e: React.PointerEvent) => {
    const r = boxRef.current?.getBoundingClientRect()
    if (!r || r.width === 0 || r.height === 0) return null
    return { px: (e.clientX - r.left) / r.width, py: (e.clientY - r.top) / r.height }
  }

  const onMove = (e: React.PointerEvent) => {
    const d = dragRef.current
    const p = point(e)
    if (!d || !p) return
    if (d.kind === "corner") onCrop(dragCorner(crop, d.corner, p.px, p.py))
    else {
      onCrop(moveCrop(crop, p.px - d.x, p.py - d.y))
      dragRef.current = { kind: "move", x: p.px, y: p.py }
    }
  }

  const end = (e: React.PointerEvent) => {
    dragRef.current = null
    try { (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId) } catch { /* déjà relâché */ }
  }

  const nudge = (corner: Corner, e: React.KeyboardEvent) => {
    const dx = e.key === "ArrowLeft" ? -KEY_STEP : e.key === "ArrowRight" ? KEY_STEP : 0
    const dy = e.key === "ArrowUp" ? -KEY_STEP : e.key === "ArrowDown" ? KEY_STEP : 0
    if (!dx && !dy) return
    e.preventDefault()
    const x = corner === "nw" || corner === "sw" ? crop.x : crop.x + crop.w
    const y = corner === "nw" || corner === "ne" ? crop.y : crop.y + crop.h
    onCrop(dragCorner(crop, corner, x + dx, y + dy))
  }

  return (
    <div ref={boxRef} className="relative inline-block max-w-full touch-none select-none">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt="Photo du document à recadrer" draggable={false} className={cn("block h-auto w-auto max-w-full", imageClassName)} />
      {/* Le reste de l'image s'assombrit : quatre bandes autour du cadre, jamais plus grandes que l'image */}
      <i className="pointer-events-none absolute inset-x-0 top-0 bg-black/55" style={{ height: `${crop.y * 100}%` }} aria-hidden />
      <i className="pointer-events-none absolute inset-x-0 bottom-0 bg-black/55" style={{ height: `${(1 - crop.y - crop.h) * 100}%` }} aria-hidden />
      <i className="pointer-events-none absolute left-0 bg-black/55" style={{ top: `${crop.y * 100}%`, height: `${crop.h * 100}%`, width: `${crop.x * 100}%` }} aria-hidden />
      <i className="pointer-events-none absolute right-0 bg-black/55" style={{ top: `${crop.y * 100}%`, height: `${crop.h * 100}%`, width: `${(1 - crop.x - crop.w) * 100}%` }} aria-hidden />
      <div
        className="absolute cursor-move border-2 border-[#60A5FA]"
        style={{ left: `${crop.x * 100}%`, top: `${crop.y * 100}%`, width: `${crop.w * 100}%`, height: `${crop.h * 100}%` }}
        onPointerDown={(e) => {
          const p = point(e)
          if (!p) return
          dragRef.current = { kind: "move", x: p.px, y: p.py }
          e.currentTarget.setPointerCapture(e.pointerId)
        }}
        onPointerMove={onMove}
        onPointerUp={end}
        onPointerCancel={end}
      />
      {CORNERS.map((c) => (
        <button
          key={c.id}
          type="button"
          aria-label={`Déplacer le ${c.label}`}
          className="absolute grid size-11 -translate-x-1/2 -translate-y-1/2 touch-none place-items-center"
          style={c.style(crop)}
          onPointerDown={(e) => { dragRef.current = { kind: "corner", corner: c.id }; e.currentTarget.setPointerCapture(e.pointerId) }}
          onPointerMove={onMove}
          onPointerUp={end}
          onPointerCancel={end}
          onKeyDown={(e) => nudge(c.id, e)}
        >
          <i className="size-[18px] rounded-full border-[3px] border-[#2563EB] bg-white" aria-hidden />
        </button>
      ))}
    </div>
  )
}
