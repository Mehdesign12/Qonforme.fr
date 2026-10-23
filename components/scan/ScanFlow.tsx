"use client"

/**
 * Scan d'un document en trois temps : cadrer (appareil photo ou galerie),
 * ajuster (recadrage, filtre, rotation, pages multiples), classer (type,
 * fournisseur, numéro, date, montant, rattachement), puis enregistrer.
 *
 * Plein écran, sans flou ni will-change (iOS). Les pages restent dans le
 * navigateur jusqu'à « Enregistrer » : abandonner n'envoie rien. L'envoi crée le
 * document puis envoie les pages une à une ; si une page échoue, le document
 * est retiré et rien ne reste à moitié.
 */
import { useCallback, useEffect, useRef, useState } from "react"
import { createPortal } from "react-dom"
import { Loader2, Plus, RotateCw, Trash2, X } from "lucide-react"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import { CameraCapture } from "@/components/scan/CameraCapture"
import { CropEditor } from "@/components/scan/CropEditor"
import { ClassifyForm, EMPTY_SCAN_FORM, fieldsFromForm, type ScanFormValues } from "@/components/scan/ClassifyForm"
import { SCAN_FILTER_LABELS, type ScanFilter } from "@/lib/scan/filters"
import { FULL_CROP, type Crop } from "@/lib/scan/geometry"
import { normalizeBlob, renderPage, rotateBlob } from "@/lib/scan/image-client"
import { MAX_PAGES, type ScanDocument } from "@/lib/scan/documents"
import { ScanApiError, type ScanApi } from "@/lib/scan/api"

interface Draft {
  id: string
  blob: Blob
  url: string
  crop: Crop
  filter: ScanFilter
  /** Page finale (recadrée, filtrée), préparée en passant à « Classer ». */
  result?: Blob
  resultUrl?: string
}

type Step = "capture" | "adjust" | "classify"

let seq = 0
const nextId = () => `p${++seq}`

export function ScanFlow({
  api, clients, chantiers, onClose, onSaved,
}: {
  api: ScanApi
  clients: { id: string; name: string }[]
  chantiers: { id: string; name: string }[]
  onClose: () => void
  onSaved: (doc: ScanDocument) => void
}) {
  const [step, setStep] = useState<Step>("capture")
  const [pages, setPages] = useState<Draft[]>([])
  const [current, setCurrent] = useState(0)
  const [busy, setBusy] = useState<null | "prepare" | "rotate" | "save">(null)
  const [progress, setProgress] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [form, setForm] = useState<ScanFormValues>(EMPTY_SCAN_FORM)
  const [confirmClose, setConfirmClose] = useState(false)
  const pagesRef = useRef<Draft[]>([])
  pagesRef.current = pages

  // Fond de page figé pendant le scan ; adresses d'objet libérées à la fermeture
  useEffect(() => {
    const previous = document.body.style.overflow
    document.body.style.overflow = "hidden"
    return () => {
      document.body.style.overflow = previous
      pagesRef.current.forEach((p) => { URL.revokeObjectURL(p.url); if (p.resultUrl) URL.revokeObjectURL(p.resultUrl) })
    }
  }, [])

  const requestClose = useCallback(() => {
    if (busy === "save") return
    if (pagesRef.current.length > 0) setConfirmClose(true)
    else onClose()
  }, [busy, onClose])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") requestClose() }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [requestClose])

  const addBlobs = async (blobs: Blob[]) => {
    const room = MAX_PAGES - pagesRef.current.length
    if (room <= 0) { toast.error(`Un document compte ${MAX_PAGES} pages au plus.`); return }
    const take = blobs.slice(0, room)
    if (take.length < blobs.length) toast(`Seules les ${take.length} premières photos ont été gardées (${MAX_PAGES} pages au plus).`)
    setBusy("prepare")
    const added: Draft[] = []
    try {
      for (const b of take) {
        const n = await normalizeBlob(b)
        added.push({ id: nextId(), blob: n.blob, url: URL.createObjectURL(n.blob), crop: FULL_CROP, filter: "color" })
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Cette image n'a pas pu être lue.")
    } finally {
      setBusy(null)
    }
    if (added.length === 0) return
    const start = pagesRef.current.length
    setPages((prev) => [...prev, ...added])
    setCurrent(start)
    setStep("adjust")
  }

  const patchPage = (i: number, patch: Partial<Draft>) => setPages((prev) => prev.map((p, k) => (k === i ? { ...p, ...patch } : p)))

  const rotate = async () => {
    const page = pages[current]
    if (!page || busy) return
    setBusy("rotate")
    try {
      const r = await rotateBlob(page.blob)
      const url = URL.createObjectURL(r.blob)
      URL.revokeObjectURL(page.url)
      patchPage(current, { blob: r.blob, url, crop: FULL_CROP })
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "La rotation a échoué.")
    } finally {
      setBusy(null)
    }
  }

  const removePage = (i: number) => {
    const page = pages[i]
    if (!page) return
    URL.revokeObjectURL(page.url)
    if (page.resultUrl) URL.revokeObjectURL(page.resultUrl)
    const rest = pages.filter((_, k) => k !== i)
    setPages(rest)
    if (rest.length === 0) { setStep("capture"); setCurrent(0) } else setCurrent(Math.min(i, rest.length - 1))
  }

  const toClassify = async () => {
    if (busy) return
    setBusy("prepare")
    setError(null)
    try {
      const next: Draft[] = []
      for (const p of pages) {
        if (p.resultUrl) URL.revokeObjectURL(p.resultUrl)
        const result = await renderPage(p.blob, { crop: p.crop, filter: p.filter })
        next.push({ ...p, result, resultUrl: URL.createObjectURL(result) })
      }
      setPages(next)
      setStep("classify")
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Les pages n'ont pas pu être préparées.")
    } finally {
      setBusy(null)
    }
  }

  const save = async (status: "classified" | "to_classify") => {
    if (busy) return
    const ready = pages.filter((p) => p.result)
    if (ready.length === 0) return
    setBusy("save")
    setError(null)
    let created: ScanDocument | null = null
    try {
      created = await api.create(fieldsFromForm(form, status))
      for (let i = 0; i < ready.length; i++) {
        setProgress(ready.length > 1 ? `Envoi de la page ${i + 1} sur ${ready.length}…` : "Envoi…")
        await api.uploadPage(created.id, i + 1, ready[i].result as Blob)
      }
      toast.success(status === "classified" ? "Document enregistré." : "Document enregistré, à classer plus tard.")
      onSaved({ ...created, page_count: ready.length })
    } catch (e) {
      // Rien ne reste à moitié : le document sans toutes ses pages est retiré
      if (created) await api.remove(created.id).catch(() => {})
      setError(e instanceof ScanApiError || e instanceof Error ? e.message : "L'enregistrement a échoué. Réessayez.")
      setBusy(null)
      setProgress(null)
    }
  }

  const page = pages[current]
  const dark = step !== "classify"

  // Posé directement dans <body> : dans la coque de l'application, un contexte d'empilement plus bas
  // laissait la barre de navigation du bas passer par-dessus les boutons « Tourner » et « Supprimer ».
  if (typeof document === "undefined") return null
  return createPortal(
    <div role="dialog" aria-modal="true" aria-label="Scanner un document" className={cn("fixed inset-0 z-[70] flex flex-col", dark ? "bg-[#0B1220] text-white" : "bg-[var(--q-bg)] text-[var(--q-ink)]")}>
      {step === "capture" && (
        <CameraCapture
          pageCount={pages.length}
          onPhoto={(b) => void addBlobs([b])}
          onFiles={(files) => void addBlobs(files)}
          onFinish={() => { setCurrent(Math.max(0, pages.length - 1)); setStep("adjust") }}
          onClose={requestClose}
        />
      )}

      {step === "adjust" && page && (
        <div className="flex h-full flex-col">
          <div className="flex items-center justify-between px-4 pb-2 pt-[max(16px,env(safe-area-inset-top))]">
            <button type="button" onClick={() => setStep("capture")} className="h-11 rounded-full px-2 text-[15px] font-semibold">Reprendre</button>
            <h2 className="text-[17px] font-bold">Ajuster{pages.length > 1 ? ` · ${current + 1}/${pages.length}` : ""}</h2>
            <button type="button" onClick={requestClose} aria-label="Fermer le scan" className="grid size-11 place-items-center rounded-full bg-white/15"><X className="size-5" aria-hidden /></button>
          </div>

          <div className="relative flex min-h-0 flex-1 items-center justify-center px-6 py-2">
            <div className="flex max-h-full max-w-full items-center justify-center">
              <CropEditor key={page.id + page.url} src={page.url} crop={page.crop} onCrop={(c) => patchPage(current, { crop: c })} imageClassName={pages.length > 1 ? "max-h-[calc(100dvh-410px)]" : "max-h-[calc(100dvh-340px)]"} />
            </div>
            {busy && <div className="absolute inset-0 grid place-items-center bg-black/30" role="status"><Loader2 className="size-8 animate-spin" aria-label="Traitement en cours" /></div>}
          </div>

          {pages.length > 1 && (
            <div className="flex gap-2 overflow-x-auto px-4 py-2" role="tablist" aria-label="Pages du document">
              {pages.map((p, i) => (
                <button key={p.id} type="button" role="tab" aria-selected={i === current} aria-label={`Page ${i + 1}`} onClick={() => setCurrent(i)}
                  className={cn("relative h-16 w-12 shrink-0 overflow-hidden rounded-lg border-2", i === current ? "border-[#60A5FA]" : "border-transparent opacity-70")}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={p.url} alt="" className="size-full object-cover" />
                </button>
              ))}
            </div>
          )}

          <div className="flex flex-wrap items-center justify-center gap-2 px-4 py-2">
            {(Object.keys(SCAN_FILTER_LABELS) as ScanFilter[]).map((f) => (
              <button key={f} type="button" aria-pressed={page.filter === f} onClick={() => patchPage(current, { filter: f })}
                className={cn("h-11 rounded-full px-4 text-sm font-semibold", page.filter === f ? "bg-white text-[#0F172A]" : "bg-white/15 text-white")}>
                {SCAN_FILTER_LABELS[f]}
              </button>
            ))}
          </div>
          <div className="flex items-center justify-center gap-2 px-4 pb-2">
            <button type="button" onClick={() => void rotate()} disabled={busy !== null} aria-label="Tourner d'un quart de tour" className="flex h-11 items-center gap-2 rounded-full bg-white/15 px-4 text-sm font-semibold disabled:opacity-50"><RotateCw className="size-[18px]" aria-hidden />Tourner</button>
            <button type="button" onClick={() => removePage(current)} aria-label="Supprimer cette page" className="flex h-11 items-center gap-2 rounded-full bg-white/15 px-4 text-sm font-semibold"><Trash2 className="size-[18px]" aria-hidden />Supprimer la page</button>
          </div>

          <div className="flex gap-2.5 px-4 pb-[max(20px,env(safe-area-inset-bottom))] pt-2">
            <button type="button" onClick={() => setStep("capture")} disabled={pages.length >= MAX_PAGES} className="flex h-14 flex-1 items-center justify-center gap-2 rounded-2xl bg-white/15 text-[15.5px] font-bold disabled:opacity-50">
              <Plus className="size-5" aria-hidden />Ajouter une page
            </button>
            <button type="button" onClick={() => void toClassify()} disabled={busy !== null} className="flex h-14 flex-1 items-center justify-center gap-2 rounded-2xl bg-[#2563EB] text-[15.5px] font-bold disabled:opacity-60">
              {busy === "prepare" && <Loader2 className="size-5 animate-spin" aria-hidden />}
              Terminer · {pages.length} page{pages.length > 1 ? "s" : ""}
            </button>
          </div>
        </div>
      )}

      {step === "classify" && (
        <div className="flex h-full flex-col">
          <div className="flex items-center justify-between px-4 pb-1 pt-[max(16px,env(safe-area-inset-top))]">
            <button type="button" onClick={() => setStep("adjust")} disabled={busy === "save"} className="h-11 rounded-full px-2 text-[15px] font-semibold text-[var(--q-accent-strong)] disabled:opacity-50">Retour</button>
            <button type="button" onClick={requestClose} disabled={busy === "save"} aria-label="Fermer le scan" className="grid size-11 place-items-center rounded-full border border-[var(--q-line)] bg-[var(--q-surface)] disabled:opacity-50"><X className="size-5" aria-hidden /></button>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-6">
            <div className="mx-auto flex max-w-xl flex-col gap-4">
              <h2 className="q-h1">Classer le document</h2>
              <div className="flex items-center gap-2.5 overflow-x-auto py-1">
                {pages.map((p) => (
                  <span key={p.id} className="h-[84px] w-16 shrink-0 overflow-hidden rounded-lg border border-[var(--q-line)] bg-[var(--q-surface)]">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={p.resultUrl ?? p.url} alt={`Page ${pages.indexOf(p) + 1}`} className="size-full object-cover" />
                  </span>
                ))}
                {pages.length < MAX_PAGES && (
                  <button type="button" onClick={() => setStep("capture")} disabled={busy === "save"} aria-label="Ajouter une page" className="grid h-[84px] w-16 shrink-0 place-items-center rounded-lg border-[1.5px] border-dashed border-[var(--q-field)] text-[var(--q-text-3)]">
                    <Plus className="size-5" aria-hidden />
                  </button>
                )}
              </div>
              <ClassifyForm values={form} onChange={setForm} clients={clients} chantiers={chantiers} disabled={busy === "save"} />
              <p className="text-[12.5px] leading-snug text-[var(--q-text-4)]">
                Qonforme ne lit pas le texte de la photo : vous saisissez seulement ce que vous voulez retrouver. Tous les champs sont facultatifs.
              </p>
              {error && <p role="alert" className="q-field-error">{error}</p>}
            </div>
          </div>
          <div className="mx-auto flex w-full max-w-xl flex-col gap-1.5 border-t border-[var(--q-line)] bg-[var(--q-bg)] px-4 pb-[max(20px,env(safe-area-inset-bottom))] pt-3">
            <button type="button" onClick={() => void save("classified")} disabled={busy !== null} className="q-btn q-btn-primary h-[54px] w-full text-base">
              {busy === "save" && <Loader2 className="animate-spin" aria-hidden />}
              {busy === "save" ? progress ?? "Enregistrement…" : "Enregistrer"}
            </button>
            <button type="button" onClick={() => void save("to_classify")} disabled={busy !== null} className="min-h-11 rounded-xl text-[14.5px] font-semibold text-[var(--q-accent-strong)] disabled:opacity-50">
              Compléter plus tard
            </button>
          </div>
        </div>
      )}

      {confirmClose && (
        <div className="absolute inset-0 z-10 grid place-items-center bg-black/60 p-6" role="alertdialog" aria-label="Abandonner le scan">
          <div className="w-full max-w-sm rounded-2xl bg-[var(--q-surface)] p-5 text-[var(--q-ink)] shadow-[shadow:var(--q-shadow-pop)]">
            <h3 className="q-display text-[20px] leading-tight">Abandonner le scan&nbsp;?</h3>
            <p className="mt-2 text-sm leading-relaxed text-[var(--q-text-3)]">Les {pages.length} page{pages.length > 1 ? "s" : ""} prise{pages.length > 1 ? "s" : ""} ne seront pas enregistrées.</p>
            <div className="mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button type="button" onClick={() => setConfirmClose(false)} className="q-btn q-btn-secondary h-11">Continuer le scan</button>
              <button type="button" onClick={onClose} className="q-btn q-btn-danger h-11">Abandonner</button>
            </div>
          </div>
        </div>
      )}
    </div>,
    document.body,
  )
}
