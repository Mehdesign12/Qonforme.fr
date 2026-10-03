"use client"

/**
 * Import d'une facture reçue : dépôt du fichier, lecture et contrôles en
 * mémoire, aperçu, puis enregistrement. Un PDF sans données structurées se
 * classe avec une saisie minimale.
 *
 * Partagé par l'application (analyse et enregistrement par l'API) et la démo
 * (analyse dans le navigateur avec les mêmes lecteurs, rien n'est enregistré).
 */
import { useCallback, useEffect, useId, useRef, useState } from "react"
import Link from "next/link"
import { FileUp, Info, Loader2, RotateCcw, Save, Sparkles, XCircle } from "lucide-react"
import { cn } from "@/lib/utils"
import { PageHeader, Panel } from "@/components/app/kit"
import { MAX_UPLOAD_BYTES } from "@/lib/reception/bytes"
import { FORMAT_LABELS, type ReceptionCheck } from "@/lib/reception/types"
import type { AnalyzeResponse } from "@/lib/reception/view"
import { ChecksList } from "@/components/reception/ChecksList"
import { ReceivedInvoiceDocument } from "@/components/reception/ReceivedInvoiceDocument"

export interface ManualInput {
  document_type: "380" | "381"
  supplier_name: string
  supplier_siren: string
  number: string
  issue_date: string
  due_date: string
  total_ht: string
  total_vat: string
  total_ttc: string
}

export type SaveResult =
  | { ok: true; id: string }
  | { ok: false; error: string; checks?: ReceptionCheck[]; field?: string }

export interface ImportViewProps {
  backHref: string
  analyze: (file: File) => Promise<AnalyzeResponse & { available?: boolean }>
  save: (file: File, manual: ManualInput | null) => Promise<SaveResult>
  onSaved: (id: string) => void
  duplicateHref: (id: string) => string
  /** Fichiers d'exemple (démo). */
  samples?: { label: string; file: () => File }[]
  /** Mention sous le bouton d'enregistrement (démo). */
  saveHint?: string
}

const EMPTY_MANUAL: ManualInput = {
  document_type: "380", supplier_name: "", supplier_siren: "", number: "", issue_date: "", due_date: "", total_ht: "", total_vat: "", total_ttc: "",
}

const sizeLabel = (n: number) => (n < 1024 * 1024 ? `${Math.max(1, Math.round(n / 1024))} Ko` : `${(n / (1024 * 1024)).toLocaleString("fr-FR", { maximumFractionDigits: 1 })} Mo`)

const toNumber = (v: string) => {
  const s = v.replace(/[\s  €]/g, "").replace(",", ".")
  return /^-?\d+(\.\d{1,2})?$/.test(s) ? Number(s) : null
}

export function ImportView({ backHref, analyze, save, onSaved, duplicateHref, samples, saveHint }: ImportViewProps) {
  const ids = useId()
  const inputRef = useRef<HTMLInputElement>(null)
  const [file, setFile] = useState<File | null>(null)
  const [dragOver, setDragOver] = useState(false)
  const [busy, setBusy] = useState<"analyze" | "save" | null>(null)
  const [result, setResult] = useState<(AnalyzeResponse & { available?: boolean }) | null>(null)
  const [saveError, setSaveError] = useState<{ error: string; checks?: ReceptionCheck[]; field?: string } | null>(null)
  const [manual, setManual] = useState<ManualInput>(EMPTY_MANUAL)
  const [pdfUrl, setPdfUrl] = useState<string | null>(null)

  // Aperçu local du PDF (saisie manuelle) : URL locale, libérée à chaque changement
  useEffect(() => {
    if (!file || result?.ok !== true || result.kind !== "pdf_only") { setPdfUrl(null); return }
    const url = URL.createObjectURL(file)
    setPdfUrl(url)
    return () => URL.revokeObjectURL(url)
  }, [file, result])

  const pick = useCallback(async (f: File | null | undefined) => {
    if (!f) return
    setFile(f)
    setResult(null)
    setSaveError(null)
    setManual(EMPTY_MANUAL)
    if (f.size > MAX_UPLOAD_BYTES) {
      setResult({ ok: false, error: "Fichier trop lourd : 4 Mo au maximum." })
      return
    }
    setBusy("analyze")
    try {
      setResult(await analyze(f))
    } catch {
      setResult({ ok: false, error: "Le fichier n'a pas pu être lu. Vérifiez votre connexion, puis réessayez." })
    } finally {
      setBusy(null)
    }
  }, [analyze])

  const reset = () => {
    setFile(null); setResult(null); setSaveError(null); setManual(EMPTY_MANUAL)
    if (inputRef.current) inputRef.current.value = ""
  }

  const doSave = async () => {
    if (!file || !result?.ok) return
    setBusy("save")
    setSaveError(null)
    try {
      const res = await save(file, result.kind === "pdf_only" ? manual : null)
      if (res.ok) onSaved(res.id)
      else setSaveError(res)
    } catch {
      setSaveError({ error: "L'enregistrement n'a pas abouti. Vérifiez votre connexion, puis réessayez." })
    } finally {
      setBusy(null)
    }
  }

  const unavailable = result?.ok === true && result.available === false
  const blocking = result?.ok === true && result.kind === "structured" && result.blocking
  const ht = toNumber(manual.total_ht)
  const tva = toNumber(manual.total_vat)
  const ttc = toNumber(manual.total_ttc)
  const sumMismatch = ht !== null && tva !== null && ttc !== null && Math.abs(Math.round((ht + tva) * 100) - Math.round(ttc * 100)) > 1

  const field = (key: keyof ManualInput, label: string, props: React.InputHTMLAttributes<HTMLInputElement> = {}, hint?: string) => (
    <div className="flex min-w-0 flex-col gap-1.5">
      <label htmlFor={`${ids}-${key}`} className="q-label">{label}</label>
      <input
        id={`${ids}-${key}`}
        className="q-input"
        value={manual[key]}
        aria-invalid={saveError?.field === key || undefined}
        onChange={(e) => setManual((m) => ({ ...m, [key]: e.target.value }))}
        {...props}
      />
      {saveError?.field === key ? <p className="q-field-error" role="alert">{saveError.error}</p> : hint ? <p className="q-field-hint">{hint}</p> : null}
    </div>
  )

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Importer une facture"
        subtitle="Factur-X, XML (CII ou UBL 2.1) ou PDF · 4 Mo au maximum"
        backHref={backHref}
        backLabel="Factures reçues"
      />

      <div className="q-banner text-[13px] leading-normal">
        <Info className="mt-0.5 size-4 shrink-0" aria-hidden />
        <p>
          Qonforme lit et contrôle le fichier, puis suit la facture jusqu&apos;au paiement. Cela ne remplace pas la
          réception par une plateforme agréée, obligatoire depuis le 1er septembre 2026 : Qonforme n&apos;y est pas
          encore raccordé.
        </p>
      </div>

      {/* ---- Dépôt ---- */}
      <section
        aria-label="Fichier"
        className={cn(
          "q-card flex flex-col items-center gap-3 border-2 border-dashed p-6 text-center transition-colors sm:p-8",
          dragOver ? "border-[var(--q-accent)] bg-[var(--q-wash)]" : "border-[var(--q-field)]",
        )}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => { e.preventDefault(); setDragOver(false); void pick(e.dataTransfer.files?.[0]) }}
      >
        <span className="q-empty-icon"><FileUp className="size-5" aria-hidden /></span>
        {file ? (
          <div className="flex flex-col gap-0.5">
            <p className="break-all text-base font-semibold text-[var(--q-ink)]">{file.name}</p>
            <p className="text-sm text-[var(--q-text-4)]">{sizeLabel(file.size)}</p>
          </div>
        ) : (
          <div className="flex flex-col gap-1">
            <p className="text-base font-semibold text-[var(--q-ink)]">Déposez la facture de votre fournisseur</p>
            <p className="max-w-md text-sm text-[var(--q-text-4)]">
              Le PDF reçu par email suffit : s&apos;il contient une facture électronique (Factur-X), elle est lue
              automatiquement. Sinon, vous saisissez l&apos;essentiel.
            </p>
          </div>
        )}
        <div className="flex flex-wrap justify-center gap-2">
          <label htmlFor={`${ids}-file`} className="q-btn q-btn-primary cursor-pointer">
            <FileUp aria-hidden />
            {file ? "Choisir un autre fichier" : "Choisir un fichier"}
          </label>
          {samples?.map((s) => (
            <button key={s.label} type="button" className="q-btn q-btn-secondary" onClick={() => void pick(s.file())} disabled={busy !== null}>
              <Sparkles aria-hidden />
              {s.label}
            </button>
          ))}
        </div>
        <input
          ref={inputRef}
          id={`${ids}-file`}
          type="file"
          accept=".pdf,.xml,application/pdf,application/xml,text/xml"
          className="sr-only"
          onChange={(e) => void pick(e.target.files?.[0])}
        />
      </section>

      {busy === "analyze" && (
        <div className="q-card flex items-center gap-3 p-5" role="status">
          <Loader2 className="size-5 shrink-0 text-[var(--q-accent)]" aria-hidden />
          <span className="text-sm text-[var(--q-text-2)]">Lecture du fichier…</span>
        </div>
      )}

      {/* ---- Fichier illisible ---- */}
      {result && !result.ok && (
        <section className="q-card flex flex-col items-start gap-3 p-5" role="alert">
          <div className="flex gap-2.5">
            <XCircle className="mt-0.5 size-[18px] shrink-0 text-[var(--q-danger)]" aria-hidden />
            <div className="flex flex-col gap-0.5">
              <p className="text-sm font-semibold text-[var(--q-danger)]">Ce fichier ne peut pas être importé</p>
              <p className="text-[13px] text-[var(--q-text-3)]">{result.error}</p>
            </div>
          </div>
          <button type="button" className="q-btn q-btn-secondary q-btn-sm" onClick={reset}>
            <RotateCcw aria-hidden />
            Recommencer
          </button>
        </section>
      )}

      {unavailable && (
        <div className="q-banner q-banner-warn text-[13px]">
          <Info className="mt-0.5 size-4 shrink-0" aria-hidden />
          <p>La lecture fonctionne, mais l&apos;enregistrement des factures reçues est en cours de mise en service sur votre compte.</p>
        </div>
      )}

      {/* ---- Facture lue ---- */}
      {result?.ok && result.kind === "structured" && (
        <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
          <div className="order-2 min-w-0 xl:order-1">
            <ReceivedInvoiceDocument invoice={result.invoice} />
          </div>
          <div className="order-1 flex min-w-0 flex-col gap-4 xl:order-2">
            <Panel title="Contrôles" bodyClassName="px-5 pb-5 pt-2">
              <p className="mb-3 text-[13px] text-[var(--q-text-4)]">{FORMAT_LABELS[result.format]} · rien n&apos;est enregistré tant que vous ne validez pas.</p>
              <ChecksList checks={saveError?.checks ?? result.checks} duplicateHref={duplicateHref} />
            </Panel>
            <SaveBar
              disabled={blocking || unavailable || busy !== null}
              busy={busy === "save"}
              onSave={doSave}
              onCancel={reset}
              error={saveError && !saveError.field ? saveError.error : null}
              hint={blocking ? "Corrigez d’abord les points bloquants : demandez au besoin une nouvelle facture au fournisseur." : saveHint}
              label="Enregistrer la facture"
            />
          </div>
        </div>
      )}

      {/* ---- PDF simple : saisie minimale ---- */}
      {result?.ok && result.kind === "pdf_only" && (
        <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <Panel title="Saisie de la facture" bodyClassName="flex flex-col gap-4 px-5 pb-5 pt-2">
            <p className="text-[13px] leading-relaxed text-[var(--q-text-3)]">
              {result.note ?? "Ce PDF ne contient pas de facture électronique."} Recopiez l&apos;essentiel depuis le PDF : il est
              conservé tel quel avec la facture.
            </p>
            <div className="q-seg self-start" role="radiogroup" aria-label="Type de document">
              {(["380", "381"] as const).map((t) => (
                <button key={t} type="button" role="radio" aria-checked={manual.document_type === t} className={manual.document_type === t ? "is-active" : undefined} onClick={() => setManual((m) => ({ ...m, document_type: t }))}>
                  {t === "380" ? "Facture" : "Avoir"}
                </button>
              ))}
            </div>
            <div className="grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(min(220px,100%),1fr))]">
              {field("supplier_name", "Fournisseur", { autoComplete: "organization", maxLength: 200 })}
              {field("supplier_siren", "SIREN du fournisseur (facultatif)", { inputMode: "numeric", maxLength: 11, placeholder: "9 chiffres" })}
              {field("number", "Numéro de facture", { maxLength: 60 })}
              {field("issue_date", "Date de la facture", { type: "date" })}
              {field("due_date", "Échéance (facultative)", { type: "date" })}
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              {field("total_ht", "Total HT", { inputMode: "decimal", placeholder: "0,00" })}
              {field("total_vat", "TVA", { inputMode: "decimal", placeholder: "0,00" })}
              {field("total_ttc", "Total TTC", { inputMode: "decimal", placeholder: "0,00" })}
            </div>
            {sumMismatch && (
              <p className="q-field-hint text-[var(--q-warn)]">HT + TVA ne donne pas le TTC saisi : vérifiez les montants.</p>
            )}
            <SaveBar
              disabled={unavailable || busy !== null}
              busy={busy === "save"}
              onSave={doSave}
              onCancel={reset}
              error={saveError && !saveError.field ? saveError.error : null}
              checks={saveError?.checks}
              duplicateHref={duplicateHref}
              hint={saveHint}
              label="Classer la facture"
            />
          </Panel>
          <section aria-label="PDF reçu" className="hidden min-w-0 xl:block">
            {pdfUrl && <iframe src={pdfUrl} title="PDF reçu" className="h-[80vh] w-full rounded-2xl border border-[var(--q-line)] bg-[var(--q-sunken)]" />}
          </section>
        </div>
      )}

      <p className="text-center text-[13px] text-[var(--q-text-4)]">
        <Link href={backHref} className="q-link">Retour aux factures reçues</Link>
      </p>
    </div>
  )
}

function SaveBar({ disabled, busy, onSave, onCancel, error, hint, label, checks, duplicateHref }: {
  disabled: boolean
  busy: boolean
  onSave: () => void
  onCancel: () => void
  error: string | null
  hint?: string
  label: string
  checks?: ReceptionCheck[]
  duplicateHref?: (id: string) => string
}) {
  return (
    <div className="flex flex-col gap-3">
      {checks && checks.some((c) => c.level === "error") && (
        <ChecksList checks={checks.filter((c) => c.level === "error")} duplicateHref={duplicateHref} />
      )}
      {error && <p className="q-field-error text-sm" role="alert">{error}</p>}
      <div className="flex flex-wrap gap-2">
        <button type="button" className="q-btn q-btn-primary q-btn-lg grow sm:grow-0" onClick={onSave} disabled={disabled} aria-busy={busy || undefined}>
          {busy ? <Loader2 aria-hidden /> : <Save aria-hidden />}
          {busy ? "Enregistrement…" : label}
        </button>
        <button type="button" className="q-btn q-btn-secondary q-btn-lg" onClick={onCancel} disabled={busy}>Annuler</button>
      </div>
      {hint && <p className="q-field-hint leading-relaxed">{hint}</p>}
    </div>
  )
}
