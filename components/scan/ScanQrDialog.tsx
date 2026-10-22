"use client"

/**
 * « Scannez avec votre téléphone » : un QR code vers la page Documents, qui
 * ouvre le scan. Aucun appairage : le téléphone doit être connecté au même
 * compte ; les pages arrivent dans la liste dès qu'elles sont enregistrées.
 */
import { useEffect, useState } from "react"
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog"
import { encodeQr, qrSvgPath } from "@/lib/payment-link/qr"

export function ScanQrDialog({ open, onOpenChange, path }: { open: boolean; onOpenChange: (open: boolean) => void; path: string }) {
  const [url, setUrl] = useState("")
  useEffect(() => { setUrl(`${window.location.origin}${path}`) }, [path])
  const qr = url ? encodeQr(url, { maxVersion: 10 }) : null
  const quiet = 3
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="gap-4 sm:max-w-[560px]">
        <DialogTitle className="q-display text-[24px] leading-tight text-[var(--q-ink)]">
          Scannez avec votre <span className="font-serif italic text-[var(--q-accent)]">téléphone.</span>
        </DialogTitle>
        <DialogDescription className="sr-only">Ouvrez le scan de documents sur votre téléphone.</DialogDescription>
        <div className="flex flex-col items-center gap-5 sm:flex-row sm:items-center">
          <div className="shrink-0 rounded-2xl border border-[var(--q-line)] bg-white p-3">
            {qr ? (
              <svg viewBox={`0 0 ${qr.size + quiet * 2} ${qr.size + quiet * 2}`} className="size-[184px]" role="img" aria-label="QR code vers la page Documents">
                <path d={qrSvgPath(qr, quiet)} fill="#0F172A" shapeRendering="crispEdges" />
              </svg>
            ) : <div className="size-[184px]" />}
          </div>
          <ol className="flex flex-col gap-3 text-[14.5px] leading-snug text-[var(--q-text-2)]">
            <li><strong className="font-semibold text-[var(--q-ink)]">1.</strong> Ouvrez l&apos;appareil photo de votre téléphone et visez le code.</li>
            <li><strong className="font-semibold text-[var(--q-ink)]">2.</strong> Connectez-vous à Qonforme avec le même compte : le scan s&apos;ouvre.</li>
            <li><strong className="font-semibold text-[var(--q-ink)]">3.</strong> Les pages apparaissent ici, dans Documents, une fois enregistrées.</li>
          </ol>
        </div>
      </DialogContent>
    </Dialog>
  )
}
