"use client"

/**
 * Scan depuis un téléphone appairé (page /scan-telephone, ouverte par le QR code
 * de l'ordinateur). Même parcours que dans l'application (cadrer, ajuster,
 * classer), sans compte ni menu : les documents partent vers le compte de
 * l'ordinateur, qui les affiche aussitôt dans Documents. Le classement
 * (client, chantier) se termine là-bas.
 */
import { useState } from "react"
import { CheckCircle2, ScanLine } from "lucide-react"
import { ScanFlow } from "@/components/scan/ScanFlow"
import { pairScanApi, type ScanApi } from "@/lib/scan/api"

const NONE: { id: string; name: string }[] = []

export function PhoneScan({ api = pairScanApi }: { api?: ScanApi }) {
  const [open, setOpen] = useState(false)
  const [sent, setSent] = useState(0)

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-6 px-6 py-10 text-center">
      <span className="mx-auto grid size-16 place-items-center text-[var(--q-accent)] q-glyph">
        {sent > 0 ? <CheckCircle2 className="size-9" aria-hidden /> : <ScanLine className="size-9" aria-hidden />}
      </span>
      <div className="flex flex-col gap-2">
        <h1 className="q-h1">
          {sent > 0 ? (
            <>Document <span className="font-serif italic text-[var(--q-accent)]">envoyé.</span></>
          ) : (
            <>Scannez vos <span className="font-serif italic text-[var(--q-accent)]">documents.</span></>
          )}
        </h1>
        <p className="text-[15px] leading-relaxed text-[var(--q-text-3)]">
          {sent > 0
            ? `${sent} document${sent > 1 ? "s" : ""} envoyé${sent > 1 ? "s" : ""} : ${sent > 1 ? "ils apparaissent" : "il apparaît"} déjà sur votre ordinateur, dans Documents. Vous y choisissez le client ou le chantier.`
            : "Prenez en photo un devis reçu, un bon de commande ou un bon de livraison. Il arrive directement sur votre ordinateur."}
        </p>
      </div>
      <button type="button" onClick={() => setOpen(true)} className="q-btn q-btn-primary h-14 w-full text-base">
        <ScanLine aria-hidden />
        {sent > 0 ? "Scanner un autre document" : "Ouvrir l'appareil photo"}
      </button>
      <p className="text-[12.5px] leading-snug text-[var(--q-text-4)]">
        Ce téléphone n&apos;a accès qu&apos;à l&apos;envoi de documents, pendant 15 minutes. Fermez la fenêtre du QR code sur l&apos;ordinateur pour couper l&apos;accès tout de suite.
      </p>

      {open && (
        <ScanFlow
          api={api} clients={NONE} chantiers={NONE}
          onClose={() => setOpen(false)}
          onSaved={() => { setOpen(false); setSent((n) => n + 1) }}
        />
      )}
    </main>
  )
}
