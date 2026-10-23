"use client"

/**
 * « Scannez avec votre téléphone » : un QR code d'appairage. Le téléphone qui le
 * lit scanne SANS se connecter (accès limité à l'envoi de documents, 15 minutes,
 * révoqué à la fermeture de cette fenêtre) ; les documents arrivent ici en
 * direct et la fenêtre dit où en est le téléphone. Sans appairage possible
 * (mise à jour de la base pas encore appliquée), le QR code mène à la page
 * Documents, ouverte avec le même compte sur le téléphone.
 */
import { useCallback, useEffect, useRef, useState } from "react"
import { CheckCircle2, Loader2, Smartphone } from "lucide-react"
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog"
import { encodeQr, qrSvgPath } from "@/lib/payment-link/qr"
import type { PairingInfo, PairingStatus, ScanApi } from "@/lib/scan/api"

type Phase = "creating" | "paired" | "fallback" | "error"

const POLL_MS = 2500

function clock(ms: number): string {
  const s = Math.max(0, Math.ceil(ms / 1000))
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`
}

export function ScanQrDialog({
  open, onOpenChange, api, fallbackPath, onReceived,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  api: ScanApi
  /** Chemin du QR code simple (sans appairage). */
  fallbackPath: string
  /** Un document vient d'arriver du téléphone : la liste se rafraîchit. */
  onReceived: () => void
}) {
  const [phase, setPhase] = useState<Phase>("creating")
  const [info, setInfo] = useState<PairingInfo | null>(null)
  const [status, setStatus] = useState<PairingStatus | null>(null)
  const [now, setNow] = useState(() => Date.now())
  const [fallbackUrl, setFallbackUrl] = useState("")
  const seen = useRef(0)
  const infoRef = useRef<PairingInfo | null>(null)
  infoRef.current = info

  const start = useCallback(async () => {
    setPhase("creating")
    setStatus(null)
    seen.current = 0
    if (!api.createPairing) { setPhase("fallback"); return }
    try {
      const created = await api.createPairing()
      setInfo(created)
      setNow(Date.now())
      setPhase("paired")
    } catch (e) {
      setInfo(null)
      // Appairage indisponible (migration) : QR code simple. Autre échec : message et nouvel essai.
      setPhase((e as { code?: string })?.code === "PAIRING_UNAVAILABLE" ? "fallback" : "error")
    }
  }, [api])

  useEffect(() => {
    setFallbackUrl(`${window.location.origin}${fallbackPath}`)
    if (!open) return
    void start()
    return () => {
      const current = infoRef.current
      // Fermer la fenêtre coupe l'accès du téléphone
      if (current && api.revokePairing) void api.revokePairing(current.id).catch(() => {})
      setInfo(null)
    }
  }, [open, start, api, fallbackPath])

  // Décompte, et expiration
  useEffect(() => {
    if (!open || phase !== "paired") return
    const t = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(t)
  }, [open, phase])

  // État du téléphone et documents reçus
  useEffect(() => {
    if (!open || phase !== "paired" || !info || !api.pairingStatus) return
    let live = true
    const poll = async () => {
      try {
        const s = await api.pairingStatus!(info.id)
        if (!live) return
        setStatus(s)
        if (s.documents > seen.current) { seen.current = s.documents; onReceived() }
      } catch { /* coupure passagère : on réessaie au tour suivant */ }
    }
    void poll()
    const t = window.setInterval(poll, POLL_MS)
    return () => { live = false; window.clearInterval(t) }
  }, [open, phase, info, api, onReceived])

  const remaining = info ? new Date(info.expiresAt).getTime() - now : 0
  const expired = phase === "paired" && (remaining <= 0 || status?.state === "expired" || status?.state === "revoked")
  const qrText = phase === "paired" && info && !expired ? info.url : phase === "fallback" ? fallbackUrl : ""
  const qr = qrText ? encodeQr(qrText, { maxVersion: 10 }) : null
  const quiet = 3
  const received = status?.documents ?? 0

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="gap-4 sm:max-w-[560px]">
        <DialogTitle className="q-display text-[24px] leading-tight text-[var(--q-ink)]">
          Scannez avec votre <span className="font-serif italic text-[var(--q-accent)]">téléphone.</span>
        </DialogTitle>
        <DialogDescription className="sr-only">Appairez votre téléphone pour envoyer des documents scannés sur cet ordinateur.</DialogDescription>
        <div className="flex flex-col items-center gap-5 sm:flex-row sm:items-center">
          <div className="grid size-[208px] shrink-0 place-items-center rounded-2xl border border-[var(--q-line)] bg-white p-3">
            {qr ? (
              <svg viewBox={`0 0 ${qr.size + quiet * 2} ${qr.size + quiet * 2}`} className="size-[184px]" role="img" aria-label="QR code à scanner avec le téléphone">
                <path d={qrSvgPath(qr, quiet)} fill="#0F172A" shapeRendering="crispEdges" />
              </svg>
            ) : phase === "creating" ? (
              <Loader2 className="size-7 animate-spin text-[var(--q-text-4)]" aria-label="Création du code" />
            ) : (
              <span className="px-3 text-center text-sm text-[var(--q-text-4)]">{expired ? "Code expiré" : "Code indisponible"}</span>
            )}
          </div>
          <div className="flex min-w-0 flex-col gap-3 text-[14.5px] leading-snug text-[var(--q-text-2)]">
            {phase === "paired" && !expired && (
              <>
                <ol className="flex flex-col gap-2.5">
                  <li><strong className="font-semibold text-[var(--q-ink)]">1.</strong> Ouvrez l&apos;appareil photo du téléphone et visez le code.</li>
                  <li><strong className="font-semibold text-[var(--q-ink)]">2.</strong> Ouvrez le lien : l&apos;appareil photo de Qonforme s&apos;ouvre, sans connexion.</li>
                  <li><strong className="font-semibold text-[var(--q-ink)]">3.</strong> Les documents arrivent ici, dans Documents, dès l&apos;envoi.</li>
                </ol>
                <p role="status" className="flex items-center gap-2 rounded-xl bg-[var(--q-wash)] px-3 py-2.5 font-semibold text-[var(--q-ink)]">
                  {received > 0 ? <CheckCircle2 className="size-4 shrink-0 text-[var(--q-ok)]" aria-hidden /> : <Smartphone className="size-4 shrink-0 text-[var(--q-accent-strong)]" aria-hidden />}
                  {received > 0
                    ? `${received} document${received > 1 ? "s" : ""} reçu${received > 1 ? "s" : ""}`
                    : status?.claimed ? "Téléphone connecté. Prenez le document en photo." : "En attente du téléphone…"}
                </p>
                <p className="text-[12.5px] text-[var(--q-text-4)]">
                  Code valable encore {clock(remaining)}. Ce téléphone n&apos;a accès qu&apos;à l&apos;envoi de documents ; fermer cette fenêtre coupe l&apos;accès.
                </p>
              </>
            )}
            {expired && (
              <>
                <p>Ce code a expiré ou a été fermé. Un nouveau code coupe l&apos;ancien.</p>
                <button type="button" onClick={() => void start()} className="q-btn q-btn-primary h-11 self-start">Nouveau code</button>
              </>
            )}
            {phase === "fallback" && (
              <ol className="flex flex-col gap-2.5">
                <li><strong className="font-semibold text-[var(--q-ink)]">1.</strong> Ouvrez l&apos;appareil photo du téléphone et visez le code.</li>
                <li><strong className="font-semibold text-[var(--q-ink)]">2.</strong> Connectez-vous à Qonforme avec le même compte : le scan s&apos;ouvre.</li>
                <li><strong className="font-semibold text-[var(--q-ink)]">3.</strong> Les pages apparaissent ici, dans Documents, une fois enregistrées.</li>
              </ol>
            )}
            {phase === "error" && (
              <>
                <p>Le code n&apos;a pas pu être créé. Vérifiez votre connexion, puis réessayez.</p>
                <button type="button" onClick={() => void start()} className="q-btn q-btn-secondary h-11 self-start">Réessayer</button>
              </>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
