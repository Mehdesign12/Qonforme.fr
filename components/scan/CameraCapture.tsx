"use client"

/**
 * Cadrage d'un document : l'appareil photo de l'appareil dans l'application
 * (getUserMedia, caméra arrière), avec repli sur l'appareil photo natif ou la
 * galerie quand l'accès est refusé ou absent. Pas de détection automatique du
 * document : un repère de cadrage guide la prise de vue, et le recadrage se
 * fait à l'étape suivante.
 */
import { useCallback, useEffect, useRef, useState } from "react"
import { Camera, ImagePlus, Loader2, X } from "lucide-react"
import { cn } from "@/lib/utils"

type Phase = "starting" | "live" | "unavailable"

export function CameraCapture({
  pageCount, onPhoto, onFiles, onFinish, onClose,
}: {
  pageCount: number
  onPhoto: (blob: Blob) => void
  onFiles: (files: File[]) => void
  onFinish: () => void
  onClose: () => void
}) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const [phase, setPhase] = useState<Phase>("starting")
  const [flash, setFlash] = useState(false)

  const stop = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
  }, [])

  useEffect(() => {
    let cancelled = false
    if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) { setPhase("unavailable"); return }
    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: { ideal: "environment" }, width: { ideal: 2560 }, height: { ideal: 1440 } }, audio: false })
      .then((stream) => {
        if (cancelled) { stream.getTracks().forEach((t) => t.stop()); return }
        streamRef.current = stream
        const video = videoRef.current
        if (video) {
          video.srcObject = stream
          void video.play().catch(() => {})
        }
        setPhase("live")
      })
      .catch(() => { if (!cancelled) setPhase("unavailable") })
    return () => { cancelled = true; stop() }
  }, [stop])

  const shoot = () => {
    const video = videoRef.current
    if (!video || video.videoWidth === 0) return
    const canvas = document.createElement("canvas")
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    const ctx = canvas.getContext("2d")
    if (!ctx) return
    ctx.drawImage(video, 0, 0)
    setFlash(true)
    window.setTimeout(() => setFlash(false), 120)
    canvas.toBlob((b) => { if (b) onPhoto(b) }, "image/jpeg", 0.92)
  }

  const picked = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? [])
    e.target.value = ""
    if (files.length > 0) onFiles(files)
  }

  const importButton = (
    <label className="grid size-14 cursor-pointer place-items-center rounded-2xl border border-white/30 bg-white/15 text-white focus-within:ring-2 focus-within:ring-white">
      <ImagePlus className="size-6" aria-hidden />
      <span className="sr-only">Importer des photos depuis l&apos;appareil</span>
      <input type="file" accept="image/*" multiple className="sr-only" onChange={picked} />
    </label>
  )

  return (
    <div className="relative flex h-full flex-col bg-[#0B1220] text-white">
      <div className="flex items-center justify-between px-4 pb-2 pt-[max(16px,env(safe-area-inset-top))]">
        <button type="button" onClick={onClose} aria-label="Fermer le scan" className="grid size-11 place-items-center rounded-full bg-white/15">
          <X className="size-5" aria-hidden />
        </button>
        <span className="rounded-full bg-white/15 px-3.5 py-2 text-sm font-semibold">Page {pageCount + 1}</span>
        <span className="size-11" aria-hidden />
      </div>

      <div className="relative min-h-0 flex-1">
        <video ref={videoRef} playsInline muted autoPlay className={cn("absolute inset-0 size-full object-cover", phase !== "live" && "invisible")} />
        {phase === "live" && (
          <>
            {/* Repère de cadrage : quatre coins, rien d'animé */}
            <div className="pointer-events-none absolute inset-x-8 inset-y-6 sm:inset-x-[20%]" aria-hidden>
              {(["left-0 top-0 border-l-4 border-t-4", "right-0 top-0 border-r-4 border-t-4", "bottom-0 left-0 border-b-4 border-l-4", "bottom-0 right-0 border-b-4 border-r-4"]).map((c) => (
                <i key={c} className={cn("absolute size-9 rounded-md border-[#60A5FA]", c)} />
              ))}
            </div>
            <p className="pointer-events-none absolute inset-x-0 bottom-4 text-center text-[13.5px] font-medium text-white/90">
              Posez le document à plat, bien éclairé, et cadrez-le dans le repère.
            </p>
          </>
        )}
        {phase === "starting" && (
          <div className="absolute inset-0 grid place-items-center" role="status"><Loader2 className="size-8 animate-spin text-white/80" aria-label="Ouverture de l'appareil photo" /></div>
        )}
        {phase === "unavailable" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 px-8 text-center">
            <Camera className="size-10 text-white/70" aria-hidden />
            <p className="max-w-xs text-[15px] leading-relaxed text-white/90">
              L&apos;appareil photo ne s&apos;ouvre pas dans cette page (accès refusé ou indisponible). Prenez la photo avec l&apos;appareil de votre téléphone, ou importez-en.
            </p>
            <label className="q-btn q-btn-primary h-12 cursor-pointer px-6 text-base focus-within:ring-2 focus-within:ring-white">
              <Camera aria-hidden />
              Prendre une photo
              <input type="file" accept="image/*" capture="environment" className="sr-only" onChange={picked} />
            </label>
          </div>
        )}
        {flash && <div className="pointer-events-none absolute inset-0 bg-white/70" aria-hidden />}
      </div>

      <div className="flex items-center justify-between gap-3 px-6 pb-[max(24px,env(safe-area-inset-bottom))] pt-5">
        {importButton}
        <button
          type="button" onClick={shoot} disabled={phase !== "live"} aria-label="Prendre la photo"
          className="grid size-[78px] place-items-center rounded-full border-4 border-white disabled:opacity-40"
        >
          <i className="size-[60px] rounded-full bg-white" aria-hidden />
        </button>
        {pageCount > 0 ? (
          <button type="button" onClick={onFinish} className="h-14 min-w-14 rounded-2xl bg-[#2563EB] px-4 text-[15px] font-bold">
            Terminer<span className="block text-[11px] font-medium opacity-90">{pageCount} page{pageCount > 1 ? "s" : ""}</span>
          </button>
        ) : (
          <span className="size-14" aria-hidden />
        )}
      </div>
    </div>
  )
}
