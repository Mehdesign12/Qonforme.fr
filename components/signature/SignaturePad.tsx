"use client"

/**
 * Zone de signature tracée (doigt, stylet ou souris). Fond blanc quel que soit
 * le thème, comme une feuille. Rendu : PNG (data URL) transmis à la page.
 *
 * Le tracé n'est pas accessible au clavier : la page propose toujours la
 * signature par nom tapé, au même niveau (DECISIONS § 11, étape 4).
 */
import { useCallback, useEffect, useRef, useState } from "react"
import { Eraser } from "lucide-react"

export function SignaturePad({
  onChange,
  disabled,
  labelledBy,
}: {
  onChange: (dataUrl: string | null) => void
  disabled?: boolean
  labelledBy?: string
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const drawing = useRef(false)
  const last = useRef<{ x: number; y: number } | null>(null)
  const strokes = useRef(0)
  const [empty, setEmpty] = useState(true)

  /* Taille réelle du canevas (écran Retina compris), recalculée au redimensionnement */
  const resize = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const dpr = Math.min(2, window.devicePixelRatio || 1)
    const { width, height } = canvas.getBoundingClientRect()
    if (!width || !height) return
    const prev = strokes.current > 0 ? canvas.toDataURL("image/png") : null
    canvas.width = Math.round(width * dpr)
    canvas.height = Math.round(height * dpr)
    const ctx = canvas.getContext("2d")
    if (!ctx) return
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.lineCap = "round"
    ctx.lineJoin = "round"
    ctx.strokeStyle = "#0F172A"
    ctx.lineWidth = 2.4
    if (prev) {
      const img = new Image()
      img.onload = () => ctx.drawImage(img, 0, 0, width, height)
      img.src = prev
    }
  }, [])

  useEffect(() => {
    resize()
    const ro = new ResizeObserver(() => resize())
    if (canvasRef.current) ro.observe(canvasRef.current)
    return () => ro.disconnect()
  }, [resize])

  const point = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const r = e.currentTarget.getBoundingClientRect()
    return { x: e.clientX - r.left, y: e.clientY - r.top }
  }

  const start = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (disabled) return
    e.currentTarget.setPointerCapture(e.pointerId)
    drawing.current = true
    last.current = point(e)
    const ctx = e.currentTarget.getContext("2d")
    if (ctx && last.current) {
      ctx.beginPath()
      ctx.arc(last.current.x, last.current.y, 1.1, 0, Math.PI * 2)
      ctx.fillStyle = "#0F172A"
      ctx.fill()
    }
  }

  const move = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawing.current || !last.current) return
    const ctx = e.currentTarget.getContext("2d")
    if (!ctx) return
    const p = point(e)
    ctx.beginPath()
    ctx.moveTo(last.current.x, last.current.y)
    ctx.lineTo(p.x, p.y)
    ctx.stroke()
    last.current = p
  }

  const end = () => {
    if (!drawing.current) return
    drawing.current = false
    last.current = null
    strokes.current += 1
    setEmpty(false)
    onChange(canvasRef.current?.toDataURL("image/png") ?? null)
  }

  const clear = () => {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext("2d")
    if (canvas && ctx) {
      ctx.save()
      ctx.setTransform(1, 0, 0, 1, 0, 0)
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      ctx.restore()
    }
    strokes.current = 0
    setEmpty(true)
    onChange(null)
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="relative overflow-hidden rounded-[14px] border border-[var(--q-field)] bg-white">
        <canvas
          ref={canvasRef}
          role="img"
          aria-labelledby={labelledBy}
          aria-label={labelledBy ? undefined : "Zone de signature"}
          onPointerDown={start}
          onPointerMove={move}
          onPointerUp={end}
          onPointerCancel={end}
          onPointerLeave={end}
          className="block h-[180px] w-full cursor-crosshair"
          style={{ touchAction: "none" }}
        />
        {empty && (
          <span className="pointer-events-none absolute inset-0 grid place-items-center px-6 text-center text-[15px] text-[#94A3B8]">
            Signez ici avec le doigt ou la souris
          </span>
        )}
        <span aria-hidden className="pointer-events-none absolute inset-x-6 bottom-9 border-b border-dashed border-[#CBD5E1]" />
      </div>
      <div className="flex items-center justify-between gap-3">
        <span className="text-[13px] text-[var(--q-text-4)]">{empty ? "Aucune signature tracée" : "Signature tracée"}</span>
        <button type="button" onClick={clear} disabled={empty || disabled} className="q-btn q-btn-ghost q-btn-sm min-h-[44px]">
          <Eraser aria-hidden />
          Effacer
        </button>
      </div>
    </div>
  )
}
