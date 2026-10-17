"use client"

/**
 * Image de couverture d'un article, dans l'éditeur du blog.
 *
 * - Vide : zone pointillée (≈ 200 px de haut) « Ajouter une image de
 *   couverture », boutons « Créer la couverture » (la couverture Qonforme :
 *   titre, logo et icônes du sujet, dessinée par le code, sans coût),
 *   « Importer » et « Photo avec Gemini » (studio d'images sur l'onglet
 *   voulu) ; une image glissée dans la zone est envoyée tout de suite.
 * - Remplie : image en 16:9 (comme sur le blog), actions « Recréer » (la
 *   couverture Qonforme avec le titre du moment), « Remplacer » et
 *   « Retirer » en surimpression (au survol ou au clavier sur ordinateur,
 *   toujours visibles sur écran tactile), badge « Image externe » pour une
 *   adresse hors du stockage du blog, tuile « Image introuvable » si elle ne
 *   se charge pas. Une image d'un autre site est signalée sous l'aperçu : le
 *   blog ne l'affichera pas (next/image n'admet que le stockage du projet).
 *   Dessous : texte alternatif (compteur, aide) et « Options avancées » avec
 *   l'adresse.
 *
 * L'adresse est enregistrée sans le fragment des dimensions : la couverture
 * est toujours affichée en 16:9 par next/image (fill). `id` est posé sur le
 * bloc entier : la liste de contrôle (« Image de couverture ») y envoie le
 * focus, qui passe au texte alternatif s'il manque, ou au premier bouton
 * s'il n'y a pas d'image. Un simple clic dans le bloc ne déplace rien et
 * n'allume aucun anneau.
 */
import { useEffect, useId, useRef, useState } from "react"
import { toast } from "sonner"
import { ChevronRight, Globe, ImageOff, ImagePlus, LayoutTemplate, Loader2, RefreshCw, Sparkles, Trash2, TriangleAlert, Upload } from "lucide-react"
import { cn } from "@/lib/utils"
import { isBlogImageUrl, readImageSize } from "@/lib/blog-images/policy"
import { ALT_MAX, ALT_MIN } from "@/lib/blog-images/prompt"
import { ImageStudioDialog, type StudioTab } from "@/components/admin/blog/images/ImageStudioDialog"
import { dragHasFiles, imageFileFrom, uploadBlogImage } from "@/components/admin/blog/images/upload-client"

const nf = (n: number) => n.toLocaleString("fr-FR")

/** Adresse sans le fragment des dimensions (la couverture est toujours affichée en 16:9). */
const coverUrlOf = (url: string) => readImageSize(url.trim()).src

/**
 * Vrai si l'image est servie par le stockage public du projet Supabase (un
 * autre compartiment que celui du blog, par exemple) : le blog l'affiche,
 * puisque next/image n'admet que cet hôte (next.config.mjs, remotePatterns).
 * Une image d'un autre site, elle, n'y apparaîtrait pas du tout.
 */
function onProjectStorage(url: string): boolean {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL
  if (!base) return false
  try {
    const u = new URL(url)
    return u.protocol === "https:" && u.hostname === new URL(base).hostname && u.pathname.startsWith("/storage/v1/object/public/")
  } catch {
    return false
  }
}

/** Délai pendant lequel un focus suit un appui du pointeur (clic dans le bloc, pas la liste de contrôle). */
const POINTER_FOCUS_MS = 400

const overlayButton = cn(
  "inline-flex h-9 items-center gap-1.5 rounded-full border border-[var(--q-line)] bg-[var(--q-surface)] px-3 text-[13px] font-semibold text-[var(--q-ink)] shadow-[shadow:var(--q-shadow-pop)]",
  "transition-colors duration-100 hover:bg-[var(--q-hover)] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[var(--q-focus)] motion-reduce:transition-none",
  "disabled:opacity-60 max-md:h-11 max-md:px-3.5 [@media(pointer:coarse)]:h-11 [&_svg]:size-4",
)

export function CoverField({
  url,
  alt,
  onChange,
  title,
  keyword,
  id,
}: {
  url: string
  alt: string
  onChange: (next: { url: string; alt: string }) => void
  title: string
  keyword: string | null
  /** Élément focalisable (liste de contrôle → « Image de couverture »). */
  id?: string
}) {
  const ids = useId()
  const [studio, setStudio] = useState<StudioTab | null>(null)
  const [dragOver, setDragOver] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [broken, setBroken] = useState(false)
  const [altTouched, setAltTouched] = useState(false)
  const [draftUrl, setDraftUrl] = useState(url)
  const [urlError, setUrlError] = useState<string | null>(null)

  const altRef = useRef<HTMLInputElement>(null)
  const firstActionRef = useRef<HTMLButtonElement>(null)
  // Clic dans le bloc : ni renvoi du focus ni anneau (seul un focus envoyé par la liste de contrôle en a)
  const pointerAt = useRef(0)
  const [quietFocus, setQuietFocus] = useState(false)

  const hasCover = url.trim() !== ""
  const external = hasCover && !isBlogImageUrl(url)
  // Image d'un autre site : next/image la refuse, le blog ne l'affichera pas
  const offSite = external && !onProjectStorage(url)
  const altLength = alt.trim().length

  // L'adresse change (studio, dépôt, annulation) : l'aperçu et le champ avancé suivent
  useEffect(() => {
    setBroken(false)
    setDraftUrl(url)
    setUrlError(null)
  }, [url])

  function focusAltSoon() {
    window.setTimeout(() => altRef.current?.focus(), 60)
  }

  async function upload(file: File) {
    if (uploading) return
    setUploading(true)
    setError(null)
    const res = await uploadBlogImage(file)
    setUploading(false)
    if (!res.ok) {
      setError(res.error)
      toast.error(res.error)
      return
    }
    // Nouvelle image : l'ancien texte alternatif ne la décrit plus
    onChange({ url: coverUrlOf(res.image.url), alt: "" })
    setAltTouched(false)
    toast.success(hasCover ? "Couverture remplacée : décrivez-la en une phrase." : "Couverture ajoutée : décrivez-la en une phrase.")
    focusAltSoon()
  }

  /** Couverture Qonforme : le titre du moment, le logo et les icônes du sujet (POST /api/admin/blog/images/cover). */
  async function createCover() {
    if (creating || uploading) return
    const text = title.trim()
    if (text.length < 3) {
      const message = "Écrivez d'abord le titre : il figure sur la couverture."
      setError(message)
      toast.error(message)
      return
    }
    setCreating(true)
    setError(null)
    try {
      const res = await fetch("/api/admin/blog/images/cover", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: text.slice(0, 200), ...(keyword?.trim() ? { keyword: keyword.trim().slice(0, 120) } : {}) }),
        cache: "no-store",
      })
      const json = (await res.json().catch(() => null)) as { url?: string; alt?: string; error?: string } | null
      if (!res.ok || !json?.url) {
        const message = res.status === 401 ? "Session expirée : reconnectez-vous." : (json?.error ?? "La couverture n'a pas pu être créée. Réessayez dans un instant.")
        setError(message)
        toast.error(message)
        return
      }
      // Le texte alternatif est le titre, texte de l'image
      onChange({ url: coverUrlOf(json.url), alt: json.alt ?? text })
      setAltTouched(false)
      toast.success(hasCover ? "Couverture recréée avec le titre actuel" : "Couverture créée : vérifiez le titre sur l'image.")
    } catch {
      const message = "Connexion impossible. Vérifiez votre réseau puis réessayez."
      setError(message)
      toast.error(message)
    } finally {
      setCreating(false)
    }
  }

  function remove() {
    const previous = { url, alt }
    onChange({ url: "", alt: "" })
    setError(null)
    toast("Couverture retirée", { action: { label: "Annuler", onClick: () => onChange(previous) } })
    window.setTimeout(() => firstActionRef.current?.focus(), 60)
  }

  function commitUrl() {
    const value = draftUrl.trim()
    if (value === url.trim()) return
    if (value && !/^https:\/\/[^\s"'<>]+$/i.test(value)) {
      setUrlError("Adresse attendue : https://… (sans espace ni guillemet).")
      return
    }
    setUrlError(null)
    onChange({ url: value ? coverUrlOf(value) : "", alt: value ? alt : "" })
  }

  const dropHandlers = {
    onDragEnter: (e: React.DragEvent) => {
      if (!dragHasFiles(e)) return
      e.preventDefault()
      setDragOver(true)
    },
    onDragOver: (e: React.DragEvent) => {
      if (!dragHasFiles(e)) return
      e.preventDefault()
      e.dataTransfer.dropEffect = "copy"
      if (!dragOver) setDragOver(true)
    },
    onDragLeave: (e: React.DragEvent) => {
      if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setDragOver(false)
    },
    onDrop: (e: React.DragEvent) => {
      if (!dragHasFiles(e)) return
      e.preventDefault()
      setDragOver(false)
      const file = imageFileFrom(e.dataTransfer.files)
      if (file) void upload(file)
    },
  }

  const altWarning = hasCover && altTouched && altLength < ALT_MIN
  const labelId = `${ids}-titre`

  const altField = (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-end justify-between gap-2">
        <label htmlFor={`${ids}-alt`} className="q-label">
          Texte alternatif
        </label>
        <span
          className={cn("q-num text-[11.5px] tabular-nums", alt.length > ALT_MAX ? "text-[var(--q-danger)]" : "text-[var(--q-text-4)]")}
          aria-hidden
        >
          {nf(alt.length)} / {nf(ALT_MAX)}
        </span>
      </div>
      <input
        ref={altRef}
        id={`${ids}-alt`}
        type="text"
        value={alt}
        maxLength={ALT_MAX}
        onChange={(e) => onChange({ url, alt: e.target.value })}
        onBlur={() => setAltTouched(true)}
        aria-describedby={`${ids}-alt-aide`}
        aria-invalid={altWarning ? true : undefined}
        placeholder="Par exemple : un électricien raccorde un tableau électrique neuf"
        className="q-input text-base md:text-sm"
      />
      <span
        id={`${ids}-alt-aide`}
        className={cn("flex items-start gap-1.5 text-[12px]", altWarning ? "text-[var(--q-warn)]" : "text-[var(--q-text-4)]")}
      >
        {altWarning && <TriangleAlert className="mt-px size-3.5 shrink-0" aria-hidden />}
        {altWarning
          ? `Décrivez l'image en une phrase (${nf(ALT_MIN)} caractères au moins) : Google Images et les lecteurs d'écran la lisent.`
          : "Décrit l'image pour Google et les lecteurs d'écran."}
      </span>
    </div>
  )

  const advanced = (
    <details className="group/avance rounded-xl border border-[var(--q-line)] bg-[var(--q-surface)] [&_summary::-webkit-details-marker]:hidden">
      <summary className="flex min-h-11 cursor-pointer list-none items-center gap-1.5 rounded-xl px-3.5 text-[13px] font-semibold text-[var(--q-text-3)] hover:text-[var(--q-ink)] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[var(--q-focus)] md:min-h-10">
        <ChevronRight className="size-4 transition-transform duration-150 group-open/avance:rotate-90 motion-reduce:transition-none" aria-hidden />
        Options avancées
      </summary>
      <div className="flex flex-col gap-1.5 border-t border-[var(--q-line-soft)] px-3.5 pb-3.5 pt-3">
        <label htmlFor={`${ids}-adresse`} className="q-label">
          Adresse de l&apos;image
        </label>
        <input
          id={`${ids}-adresse`}
          type="url"
          inputMode="url"
          spellCheck={false}
          value={draftUrl}
          onChange={(e) => {
            setDraftUrl(e.target.value)
            if (urlError) setUrlError(null)
          }}
          onBlur={commitUrl}
          // Validé à la sortie du champ : l'éditeur le fait valider avant d'enregistrer (Ctrl+S sans quitter le champ)
          data-commit-on-blur=""
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault()
              commitUrl()
            }
          }}
          aria-invalid={urlError ? true : undefined}
          aria-describedby={`${ids}-adresse-aide`}
          placeholder="https://…"
          className="q-input font-mono text-base md:text-[13px]"
        />
        <span id={`${ids}-adresse-aide`} role={urlError ? "alert" : undefined} className={urlError ? "q-field-error" : "q-field-hint"}>
          {urlError ??
            (offSite
              ? "Adresse d'un autre site : le blog n'affiche pas cette image. Importez-la ou générez-en une."
              : external
                ? "Image du stockage du site, hors du dossier du blog : elle s'affiche normalement."
                : "Remplie automatiquement quand vous générez ou importez une image.")}
        </span>
      </div>
    </details>
  )

  return (
    <div
      id={id}
      tabIndex={-1}
      role="group"
      aria-labelledby={labelId}
      onPointerDownCapture={() => {
        pointerAt.current = Date.now()
      }}
      onFocus={(e) => {
        if (e.target !== e.currentTarget) return
        const fromPointer = Date.now() - pointerAt.current < POINTER_FOCUS_MS
        setQuietFocus(fromPointer)
        if (fromPointer) return
        // Focus envoyé par la liste de contrôle : il va là où il y a quelque chose à faire
        if (!hasCover) firstActionRef.current?.focus()
        else if (altLength < ALT_MIN) altRef.current?.focus()
      }}
      onBlur={(e) => {
        if (e.target === e.currentTarget) setQuietFocus(false)
      }}
      className={cn(
        "flex scroll-mt-28 flex-col gap-3 rounded-2xl outline-none",
        !quietFocus && "focus:ring-4 focus:ring-[var(--q-focus)]",
      )}
    >
      <span id={labelId} className="sr-only">
        Image de couverture
      </span>

      {!hasCover ? (
        <div
          {...dropHandlers}
          className={cn(
            "flex min-h-[200px] flex-col items-center justify-center gap-2.5 rounded-2xl border-[1.5px] border-dashed px-5 py-7 text-center transition-colors duration-150 motion-reduce:transition-none",
            dragOver ? "border-[var(--q-accent)] bg-[var(--q-wash)]" : "border-[var(--q-field)] bg-[var(--q-surface-2)]",
          )}
        >
          <span
            aria-hidden
            className={cn(
              "grid size-12 place-items-center rounded-full transition-colors duration-150 motion-reduce:transition-none",
              dragOver ? "bg-[var(--q-accent)] text-white" : "bg-[var(--q-wash)] text-[var(--q-accent-strong)]",
            )}
          >
            {uploading ? <Loader2 className="size-5 animate-spin motion-reduce:animate-none" /> : <ImagePlus className="size-5" />}
          </span>
          {uploading ? (
            <span className="text-[15px] font-semibold text-[var(--q-ink)]" role="status">
              Envoi de l&apos;image…
            </span>
          ) : dragOver ? (
            <span className="text-[15px] font-semibold text-[var(--q-accent-strong)]">Déposez l&apos;image pour l&apos;importer</span>
          ) : (
            <>
              <span className="text-[15px] font-semibold text-[var(--q-ink)]">Ajouter une image de couverture</span>
              <span className="text-[13px] text-[var(--q-text-4)]">Glissez une image ici, ou :</span>
              <span className="mt-1 flex flex-wrap justify-center gap-2">
                <button ref={firstActionRef} type="button" onClick={() => void createCover()} disabled={creating} className="q-btn q-btn-primary q-btn-sm max-md:min-h-11">
                  {creating ? <Loader2 className="animate-spin motion-reduce:animate-none" aria-hidden /> : <LayoutTemplate aria-hidden />}
                  {creating ? "Création…" : "Créer la couverture"}
                </button>
                <button type="button" onClick={() => setStudio("import")} disabled={creating} className="q-btn q-btn-secondary q-btn-sm max-md:min-h-11">
                  <Upload aria-hidden />
                  Importer
                </button>
                <button type="button" onClick={() => setStudio("generate")} disabled={creating} className="q-btn q-btn-secondary q-btn-sm max-md:min-h-11">
                  <Sparkles className="text-[var(--q-accent)]" aria-hidden />
                  Photo avec Gemini
                </button>
              </span>
            </>
          )}
          {error && !uploading && (
            <p role="alert" className="mt-1 flex max-w-[420px] items-start gap-1.5 text-left text-[12.5px] text-[var(--q-danger)]">
              <TriangleAlert className="mt-px size-3.5 shrink-0" aria-hidden />
              {error}
            </p>
          )}
        </div>
      ) : broken ? (
        <div className="flex aspect-video flex-col items-center justify-center gap-2.5 rounded-2xl border border-[var(--q-line)] bg-[var(--q-sunken)] p-6 text-center">
          <span className="grid size-11 place-items-center rounded-full bg-[var(--q-surface)] text-[var(--q-text-4)]" aria-hidden>
            <ImageOff className="size-5" />
          </span>
          <span className="text-[15px] font-semibold text-[var(--q-ink)]">Image introuvable à cette adresse</span>
          <span className="max-w-full truncate font-mono text-[12px] text-[var(--q-text-4)] md:max-w-[420px]" title={url}>
            {url}
          </span>
          <span className="mt-1 flex flex-wrap justify-center gap-2">
            <button ref={firstActionRef} type="button" onClick={() => setStudio("generate")} className="q-btn q-btn-secondary q-btn-sm max-md:min-h-11">
              <RefreshCw aria-hidden />
              Remplacer
            </button>
            <button type="button" onClick={remove} className="q-btn q-btn-ghost q-btn-sm max-md:min-h-11">
              <Trash2 aria-hidden />
              Retirer
            </button>
          </span>
        </div>
      ) : (
        // Aperçu et réglages côte à côte dès 640 px : la couverture ne prend plus tout le premier écran
        <div className="grid gap-4 sm:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] sm:items-start">
          <div {...dropHandlers} className="group relative aspect-video overflow-hidden rounded-2xl border border-[var(--q-line)] bg-[var(--q-sunken)]">
            {/* Aperçu immédiat, y compris pour une adresse externe que next/image refuserait */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={url}
              alt={alt.trim() || ""}
              onError={() => setBroken(true)}
              className="size-full object-cover"
            />

            {external && (
              <span
                className="q-pill q-pill-warn absolute left-3 top-3 border border-[var(--q-warn-line)] shadow-[shadow:var(--q-shadow-card)]"
                title={
                  offSite
                    ? "Image d'un autre site : le blog ne l'affichera pas."
                    : "Cette image n'est pas dans le stockage du blog."
                }
              >
                <Globe aria-hidden />
                Image externe
              </span>
            )}

            <div
              className={cn(
                "absolute right-3 top-3 flex gap-1.5 transition-opacity duration-150 motion-reduce:transition-none",
                "opacity-0 group-focus-within:opacity-100 group-hover:opacity-100 [@media(hover:none)]:opacity-100",
                (uploading || dragOver) && "invisible",
              )}
            >
              <button ref={firstActionRef} type="button" onClick={() => void createCover()} disabled={creating} className={overlayButton}>
                {creating ? <Loader2 className="animate-spin motion-reduce:animate-none" aria-hidden /> : <LayoutTemplate aria-hidden />}
                <span className="max-sm:sr-only">{creating ? "Création…" : "Recréer"}</span>
              </button>
              <button type="button" onClick={() => setStudio("generate")} disabled={creating} className={overlayButton}>
                <RefreshCw aria-hidden />
                <span className="max-sm:sr-only">Remplacer</span>
              </button>
              <button type="button" onClick={remove} className={overlayButton} aria-label="Retirer la couverture">
                <Trash2 aria-hidden />
                <span className="max-sm:sr-only">Retirer</span>
              </button>
            </div>

            {(dragOver || uploading) && (
              <div className="absolute inset-0 grid place-items-center">
                <div className="absolute inset-0 bg-[var(--q-surface)] opacity-90" aria-hidden />
                <div className="absolute inset-2 rounded-xl border-[1.5px] border-dashed border-[var(--q-accent)]" aria-hidden />
                <span className="relative inline-flex items-center gap-2 text-[15px] font-semibold text-[var(--q-accent-strong)]" role={uploading ? "status" : undefined}>
                  {uploading ? <Loader2 className="size-5 animate-spin motion-reduce:animate-none" aria-hidden /> : <Upload className="size-5" aria-hidden />}
                  {uploading ? "Envoi de l'image…" : "Déposez l'image pour remplacer la couverture"}
                </span>
              </div>
            )}
          </div>
          <div className="flex min-w-0 flex-col gap-3">
            <div className="flex flex-col gap-0.5 max-sm:hidden" aria-hidden>
              <span className="text-[14px] font-semibold text-[var(--q-ink)]">Image de couverture</span>
              <span className="text-[12.5px] leading-snug text-[var(--q-text-4)]">Format 16:9, affichée dans la liste du blog et lors d&apos;un partage.</span>
            </div>
            {altField}
            {advanced}
          </div>
        </div>
      )}

      {hasCover && error && !uploading && (
        <p role="alert" className="flex items-start gap-1.5 text-[12.5px] text-[var(--q-danger)]">
          <TriangleAlert className="mt-px size-3.5 shrink-0" aria-hidden />
          {error}
        </p>
      )}

      {offSite && !broken && (
        <div className="q-banner q-banner-warn !items-center !gap-2.5 !px-3.5 !py-2.5 !text-[13px] max-md:flex-col max-md:!items-start">
          <TriangleAlert className="size-4 shrink-0" aria-hidden />
          <span className="min-w-0 flex-1">
            <strong className="font-semibold">Image d&apos;un autre site : le blog ne l&apos;affichera pas.</strong> Seules les images
            importées ou générées ici apparaissent sur le site.
          </span>
          <button type="button" onClick={() => setStudio("import")} className="q-btn q-btn-secondary q-btn-sm shrink-0 max-md:min-h-11">
            <Upload aria-hidden />
            Importer une image
          </button>
        </div>
      )}

      {(!hasCover || broken) && (
        <>
          {hasCover && altField}
          {advanced}
        </>
      )}

      <ImageStudioDialog
        open={studio !== null}
        initialTab={studio ?? "generate"}
        purpose="cover"
        title={title}
        keyword={keyword}
        initialAlt={hasCover ? alt : undefined}
        onPick={(image) => {
          onChange({ url: coverUrlOf(image.url), alt: image.alt })
          setError(null)
          setAltTouched(false)
          toast.success(hasCover ? "Couverture remplacée" : "Couverture ajoutée")
        }}
        onClose={() => setStudio(null)}
      />
    </div>
  )
}
