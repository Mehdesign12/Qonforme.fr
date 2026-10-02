"use client"

/**
 * Logo de l'entreprise : import (bouton ou glisser-déposer), remplacement,
 * suppression, aperçu sur un document (planche « Paramètres — Entreprise »).
 *
 * L'envoi passe par l'endpoint existant /api/company/logo, qui range le
 * fichier dans le Storage du projet et enregistre son URL (seule URL acceptée
 * ensuite par la génération des PDF, voir lib/utils/logo-url.ts).
 * En démo, rien n'est envoyé : le logo s'affiche dans l'aperçu, le temps de la visite.
 */
import { useRef, useState } from "react"
import { toast } from "sonner"
import { CheckCircle2, ImageIcon, Loader2, Upload } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { initialsOf } from "@/components/app/kit"
import { cn } from "@/lib/utils"
import type { ShellMode } from "@/components/layout/nav"

const ACCEPT = "image/png,image/jpeg,image/webp,image/svg+xml"

export interface CompanyLogo {
  preview: string | null
  uploading: boolean
  openPicker: () => void
  upload: (file: File) => Promise<void>
  remove: () => Promise<void>
  /** Champ de fichier caché, à rendre une fois dans la page. */
  input: React.ReactNode
}

/** Récupère le jeton de la session active (l'endpoint du logo accepte cookies ou Bearer). */
async function authHeaders(): Promise<Record<string, string>> {
  const supabase = createClient()
  const { data: { session } } = await supabase.auth.getSession()
  return session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}
}

export function useCompanyLogo({
  mode,
  initialUrl,
  onChange,
}: {
  mode: ShellMode
  initialUrl: string | null
  /** Prévenu quand le logo enregistré change (URL publique, ou null après suppression). */
  onChange?: (url: string | null) => void
}): CompanyLogo {
  const demo = mode === "demo"
  const [savedUrl, setSavedUrl] = useState<string | null>(initialUrl)
  const [preview, setPreview] = useState<string | null>(initialUrl)
  const [uploading, setUploading] = useState(false)
  const ref = useRef<HTMLInputElement>(null)

  // L'URL chargée arrive après le premier rendu (lecture de l'entreprise) : on la reprend une fois.
  const [seen, setSeen] = useState(initialUrl)
  if (initialUrl !== seen) {
    setSeen(initialUrl)
    setSavedUrl(initialUrl)
    setPreview(initialUrl)
  }

  const upload = async (file: File) => {
    // Prévisualisation locale immédiate
    const reader = new FileReader()
    reader.onload = (ev) => setPreview(ev.target?.result as string)
    reader.readAsDataURL(file)

    if (demo) {
      toast("Aperçu seulement : créez un compte pour enregistrer votre logo", {
        action: { label: "S'inscrire", onClick: () => { window.location.href = "/signup" } },
      })
      return
    }

    setUploading(true)
    try {
      const fd = new FormData()
      fd.append("file", file)
      const res = await fetch("/api/company/logo", { method: "POST", headers: await authHeaders(), body: fd })
      const json = await res.json()
      if (!res.ok) {
        toast.error(json.error ?? "Le logo n'a pas pu être enregistré")
        setPreview(savedUrl)
        return
      }
      setSavedUrl(json.logo_url)
      onChange?.(json.logo_url)
      toast.success("Logo enregistré")
    } catch {
      toast.error("Erreur lors de l'envoi du logo")
      setPreview(savedUrl)
    } finally {
      setUploading(false)
    }
  }

  const remove = async () => {
    if (demo) {
      setPreview(null)
      return
    }
    if (!confirm("Supprimer le logo ?")) return
    setUploading(true)
    try {
      await fetch("/api/company/logo", { method: "DELETE", headers: await authHeaders() })
      setSavedUrl(null)
      setPreview(null)
      onChange?.(null)
      toast.success("Logo supprimé")
    } catch {
      toast.error("Erreur lors de la suppression")
    } finally {
      setUploading(false)
    }
  }

  const input = (
    <input
      ref={ref}
      type="file"
      accept={ACCEPT}
      className="hidden"
      onChange={(e) => {
        const file = e.target.files?.[0]
        e.target.value = "" // pour pouvoir choisir deux fois le même fichier
        if (file) void upload(file)
      }}
    />
  )

  return { preview, uploading, openPicker: () => ref.current?.click(), upload, remove, input }
}

/* ------------------------------------------------------------------ */
/* Zone d'import (Paramètres › Entreprise)                             */
/* ------------------------------------------------------------------ */

export function LogoDropzone({
  logo,
  disabled,
  disabledReason,
}: {
  logo: CompanyLogo
  disabled?: boolean
  /** Explication affichée quand l'import n'est pas encore possible. */
  disabledReason?: string
}) {
  const [over, setOver] = useState(false)

  if (logo.preview) {
    return (
      <div className="flex flex-col items-center justify-center gap-3.5 rounded-[14px] border border-[var(--q-line)] bg-[var(--q-surface)] px-5 py-6">
        <span className="grid h-20 w-full max-w-[220px] place-items-center rounded-xl bg-white p-2">
          {/* Aperçu local (data: URL) ou fichier du Storage : <img> plutôt que next/image */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={logo.preview} alt="Logo de l'entreprise" className="max-h-full max-w-full object-contain" />
        </span>
        <span className="flex items-center gap-1.5 text-[13px] text-[var(--q-ok)]">
          {logo.uploading
            ? <><Loader2 className="size-3.5 animate-spin" aria-hidden />Envoi en cours…</>
            : <><CheckCircle2 className="size-3.5" aria-hidden />Logo affiché sur vos documents</>}
        </span>
        <span className="flex flex-wrap justify-center gap-2">
          <button type="button" className="q-btn q-btn-secondary !h-9" onClick={logo.openPicker} disabled={logo.uploading || disabled}>
            Remplacer
          </button>
          <button type="button" className="q-btn q-btn-ghost !h-9" onClick={() => void logo.remove()} disabled={logo.uploading || disabled}>
            Retirer
          </button>
        </span>
      </div>
    )
  }

  return (
    <div
      onDragOver={(e) => { if (disabled) return; e.preventDefault(); setOver(true) }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        if (disabled) return
        e.preventDefault()
        setOver(false)
        const file = e.dataTransfer.files?.[0]
        if (file) void logo.upload(file)
      }}
      className={cn(
        "flex flex-col items-center justify-center gap-2.5 rounded-[14px] border-[1.5px] border-dashed px-5 py-7 text-center transition-colors",
        over ? "border-[var(--q-accent)] bg-[var(--q-wash)]" : "border-[var(--q-field)] bg-[var(--q-surface-2)]",
      )}
    >
      {logo.uploading
        ? <Loader2 className="size-6 animate-spin text-[var(--q-accent)]" aria-hidden />
        : <Upload className="size-6 text-[var(--q-text-3)]" strokeWidth={1.75} aria-hidden />}
      <span className="text-[15px] font-semibold text-[var(--q-ink)]">Glissez votre logo ici</span>
      <span className="max-w-[340px] text-[13px] leading-relaxed text-[var(--q-text-4)]">
        {disabled && disabledReason
          ? disabledReason
          : "PNG ou JPG, 2 Mo maximum : c'est le format repris dans vos PDF."}
      </span>
      <button type="button" className="q-btn q-btn-secondary mt-1 !h-9" onClick={logo.openPicker} disabled={logo.uploading || disabled}>
        Choisir un fichier
      </button>
    </div>
  )
}

/** Aperçu du logo sur l'en-tête d'un devis (fond grisé, feuille blanche). */
export function LogoDocPreview({ logo, companyName, number }: { logo: string | null; companyName: string; number: string }) {
  return (
    <div className="flex flex-col gap-2.5 rounded-[14px] bg-[var(--q-sunken)] p-4">
      <span className="text-xs font-semibold text-[var(--q-text-3)]">Aperçu sur un devis</span>
      <div className="q-paper flex flex-col gap-3.5 !rounded-md p-[18px] text-[11px]">
        <div className="flex items-start justify-between gap-3">
          {logo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logo} alt="" className="h-9 max-w-[140px] object-contain object-left" />
          ) : (
            <span className="flex min-w-0 items-center gap-2">
              <span className="grid size-[30px] shrink-0 place-items-center rounded-lg bg-[#0A1122] text-[11px] font-semibold text-white">
                {initialsOf(companyName)}
              </span>
              <strong className="truncate text-[11.5px]">{companyName || "Votre entreprise"}</strong>
            </span>
          )}
          <span className="flex shrink-0 flex-col items-end gap-0.5">
            <strong className="text-[13px]">Devis</strong>
            <span className="font-mono text-[#475569]">{number}</span>
          </span>
        </div>
        <div className="flex flex-col gap-1.5" aria-hidden>
          <span className="h-1.5 w-[70%] rounded-[3px] bg-[#EEF1F5]" />
          <span className="h-1.5 w-full rounded-[3px] bg-[#EEF1F5]" />
          <span className="h-1.5 w-[85%] rounded-[3px] bg-[#EEF1F5]" />
        </div>
      </div>
    </div>
  )
}

/** Version compacte (Paramètres › Modèles) : vignette, remplacer, retirer. */
export function LogoInline({ logo, disabled }: { logo: CompanyLogo; disabled?: boolean }) {
  return (
    <div className="flex items-center gap-3">
      <button
        type="button"
        onClick={logo.openPicker}
        disabled={logo.uploading || disabled}
        aria-label={logo.preview ? "Remplacer le logo" : "Ajouter un logo"}
        className="grid size-14 shrink-0 place-items-center overflow-hidden rounded-xl border border-dashed border-[var(--q-field)] bg-[var(--q-surface-2)] transition-colors hover:border-[var(--q-accent)] disabled:opacity-60"
      >
        {logo.uploading ? (
          <Loader2 className="size-5 animate-spin text-[var(--q-accent)]" aria-hidden />
        ) : logo.preview ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={logo.preview} alt="" className="size-full bg-white object-contain p-1.5" />
        ) : (
          <ImageIcon className="size-5 text-[var(--q-text-4)]" strokeWidth={1.75} aria-hidden />
        )}
      </button>
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="text-[15px] font-semibold text-[var(--q-ink)]">Logo</span>
        <span className="text-[13px] text-[var(--q-text-4)]">PNG ou JPG, 2 Mo maximum.</span>
      </span>
      <span className="flex shrink-0 gap-1">
        <button type="button" className="q-btn q-btn-secondary q-btn-sm" onClick={logo.openPicker} disabled={logo.uploading || disabled}>
          {logo.preview ? "Remplacer" : "Ajouter"}
        </button>
        {logo.preview && (
          <button type="button" className="q-btn q-btn-ghost q-btn-sm" onClick={() => void logo.remove()} disabled={logo.uploading || disabled}>
            Retirer
          </button>
        )}
      </span>
    </div>
  )
}
