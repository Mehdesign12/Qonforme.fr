"use client"

/**
 * Studio d'images de l'éditeur du blog : couverture d'un article ou image du
 * texte, générée par Gemini (modèle d'image des Préférences d'écriture) ou
 * importée (glisser-déposer n'importe où dans la fenêtre, choix d'un fichier,
 * collage ⌘V / Ctrl+V). Un seul travail à la fois : une seconde demande
 * pendant une génération ou un envoi est expliquée, jamais ignorée.
 *
 * Ordinateur : fenêtre de 960 px en deux volets. À gauche, « Générer avec
 * Gemini » (description préremplie d'après le métier du titre, puces de
 * style, format) ou « Importer » ; à droite, l'aperçu au format du blog,
 * l'historique des images de la session, le texte alternatif (obligatoire)
 * et, pour une image du texte, la légende. Téléphone : plein écran, une
 * colonne, aperçu en haut, pied collant au-dessus de la barre d'accueil.
 *
 * - Une génération dure 20 à 40 secondes et chaque image est facturée par
 *   Google : rien n'est relancé tout seul, « Annuler » (ou Échap) interrompt
 *   l'attente, et un clic à côté de la fenêtre ne la ferme jamais (le travail
 *   en cours n'est pas perdu par mégarde).
 * - Le texte alternatif d'une image générée est proposé d'après sa
 *   description, tant que l'admin ne l'a pas réécrit.
 * - « Utiliser cette image » appelle `onPick`, puis `onClose`.
 *
 * Aucun flou d'arrière-plan sur téléphone (règle backdrop-filter de
 * CLAUDE.md : le voile de DialogOverlay ne floute qu'à partir de md), champs
 * à 16 px sur téléphone, couleurs par les jetons --q-* (thème sombre compris).
 */
import { useCallback, useEffect, useId, useRef, useState } from "react"
import {
  Check,
  CircleCheck,
  History,
  ImageIcon,
  ImageOff,
  Info,
  Loader2,
  RotateCcw,
  Sparkles,
  TriangleAlert,
  Upload,
  X,
} from "lucide-react"
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog"
import { cn } from "@/lib/utils"
import { IMAGE_ASPECTS, IMAGE_ASPECT_LABELS, type ImageAspect } from "@/lib/blog-images/policy"
import {
  ALT_MAX,
  ALT_MIN,
  CAPTION_MAX,
  IMAGE_STYLE_CHIPS,
  MAX_IMAGE_DESCRIPTION,
  altFromDescription,
  defaultImageDescription,
  hasStyleChip,
  toggleStyleChip,
  type ImagePurpose,
} from "@/lib/blog-images/prompt"
import type { GeneratedImageResponse, PickedImage, StoredImage } from "@/lib/seo/articles/editor-types"
import { UPLOAD_HINT, dragHasFiles, imageFileFrom, modKey, uploadBlogImage } from "@/components/admin/blog/images/upload-client"

export type StudioTab = "generate" | "import"

interface StudioImage extends StoredImage {
  key: string
  source: "generate" | "import"
  /** Modèle qui a produit l'image (libellé). */
  model?: string
  /** Repli utilisé (« Image par Nano Banana 2 au lieu de… »). */
  notice?: string | null
  /** Description envoyée : base du texte alternatif proposé. */
  description?: string
}

type Busy = null | "generate" | "import"
interface StudioError {
  message: string
  /** « config » : la clé du modèle manque (503) ; la génération ne peut pas marcher. */
  kind: "config" | "other"
}

const nf = (n: number) => n.toLocaleString("fr-FR")
const ratioOf = (aspect: ImageAspect) => {
  const [w, h] = aspect.split(":").map(Number)
  return w / h
}
/** Rapport largeur / hauteur affiché, borné pour qu'un panorama ou une image très haute reste lisible. */
const clampRatio = (r: number) => Math.min(2.4, Math.max(0.5, r))
const ALT_PREFIX = /^(image|photo|photographie|illustration)\s+(de|d['’]|du|des)\b/i

let keySeed = 0
const nextKey = () => `img-${Date.now().toString(36)}-${++keySeed}`

export function ImageStudioDialog({
  open,
  onClose,
  purpose,
  title,
  keyword,
  initialAlt,
  initialTab,
  onPick,
}: {
  open: boolean
  onClose: () => void
  purpose: ImagePurpose
  /** Titre de l'article : base de la description proposée. */
  title: string
  keyword: string | null
  /** Texte alternatif déjà saisi (remplacement d'une couverture). */
  initialAlt?: string
  /** Onglet ouvert : « Générer avec Gemini » par défaut. */
  initialTab?: StudioTab
  onPick: (image: PickedImage) => void
}) {
  const ids = useId()
  const cover = purpose === "cover"

  const [tab, setTab] = useState<StudioTab>(initialTab ?? "generate")
  const [description, setDescription] = useState("")
  const [aspect, setAspect] = useState<ImageAspect>("16:9")
  const [busy, setBusy] = useState<Busy>(null)
  const [elapsed, setElapsed] = useState(0)
  const [error, setError] = useState<StudioError | null>(null)
  const [current, setCurrent] = useState<StudioImage | null>(null)
  // Historique gardé tant que l'éditeur est ouvert (fermer la fenêtre ne le vide pas)
  const [history, setHistory] = useState<StudioImage[]>([])
  const [alt, setAlt] = useState("")
  // Vrai tant que le texte alternatif n'a pas été retouché dans la fenêtre (lu après une attente : ref)
  const altAuto = useRef(true)
  const [altTouched, setAltTouched] = useState(false)
  const [caption, setCaption] = useState("")
  const [dragOver, setDragOver] = useState(false)
  const [previewBroken, setPreviewBroken] = useState(false)
  const [live, setLive] = useState("")
  const [mod, setMod] = useState("Ctrl")

  const abortRef = useRef<AbortController | null>(null)
  const busyRef = useRef<Busy>(null)
  busyRef.current = busy
  const fileRef = useRef<HTMLInputElement>(null)
  const altRef = useRef<HTMLInputElement>(null)
  const descriptionRef = useRef<HTMLTextAreaElement>(null)
  const previewRef = useRef<HTMLDivElement>(null)

  const proposed = defaultImageDescription({ title, keyword, purpose })
  const effectiveAspect: ImageAspect = cover ? "16:9" : aspect

  // Chaque ouverture repart d'une page propre ; l'historique reste
  useEffect(() => {
    if (!open) return
    setTab(initialTab ?? "generate")
    setDescription(defaultImageDescription({ title, keyword, purpose }))
    setAspect("16:9")
    setCurrent(null)
    // Texte déjà saisi affiché ; il cède la place à celui de la nouvelle image tant qu'il n'est pas retouché ici
    setAlt(initialAlt ?? "")
    altAuto.current = true
    setAltTouched(false)
    setCaption("")
    setError(null)
    setDragOver(false)
    setPreviewBroken(false)
    setLive("")
    setMod(modKey())
    // Seulement à l'ouverture : le titre peut changer pendant que la fenêtre est fermée
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  // Fermeture ou démontage : plus rien n'attend de réponse
  useEffect(() => {
    if (!open) abortRef.current?.abort()
  }, [open])
  useEffect(() => () => abortRef.current?.abort(), [])

  // Chronomètre de la génération
  useEffect(() => {
    if (busy !== "generate") return
    const start = Date.now()
    setElapsed(0)
    const timer = window.setInterval(() => setElapsed(Math.floor((Date.now() - start) / 1000)), 1000)
    return () => window.clearInterval(timer)
  }, [busy])

  /** Affiche une image ; le texte alternatif suit tant que l'admin ne l'a pas réécrit. */
  const show = useCallback(
    (image: StudioImage) => {
      setCurrent(image)
      setPreviewBroken(false)
      if (altAuto.current) setAlt(image.description ? altFromDescription(image.description) : "")
    },
    [],
  )

  const remember = useCallback((image: StudioImage) => setHistory((h) => [image, ...h.filter((x) => x.url !== image.url)].slice(0, 12)), [])

  /**
   * Téléphone : l'aperçu est en haut de la colonne, au-dessus des réglages ;
   * on le ramène à l'écran au lancement et à l'arrivée de l'image (sinon le
   * reflet puis le résultat restent hors de vue).
   */
  const revealPreview = useCallback(() => {
    const el = previewRef.current
    if (!el || typeof window === "undefined" || typeof el.scrollIntoView !== "function") return
    if (window.matchMedia?.("(min-width: 768px)").matches) return
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches
    el.scrollIntoView({ block: "nearest", behavior: reduce ? "auto" : "smooth" })
  }, [])

  /** Un seul travail à la fois : la demande suivante est expliquée au lieu d'être ignorée. */
  const reportBusy = useCallback(() => {
    setError({
      message:
        busyRef.current === "generate"
          ? "Une image est en cours de génération : attendez-la, ou annulez-la avant d'en importer une."
          : "Une image est en cours d'envoi : attendez la fin de l'envoi.",
      kind: "other",
    })
  }, [])

  async function generate() {
    if (busyRef.current || description.trim().length < 3) return
    const controller = new AbortController()
    abortRef.current = controller
    setBusy("generate")
    setError(null)
    setLive("Génération de l'image en cours.")
    revealPreview()
    const sent = description.trim()
    try {
      const res = await fetch("/api/admin/blog/images/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          description: sent,
          aspect: effectiveAspect,
          purpose,
          ...(title.trim() ? { title: title.trim().slice(0, 200) } : {}),
        }),
        cache: "no-store",
        signal: controller.signal,
      })
      const json = (await res.json().catch(() => null)) as (GeneratedImageResponse & { error?: string; code?: string }) | null
      // Annulée pendant la lecture de la réponse : rien à signaler comme une erreur
      if (controller.signal.aborted) {
        setLive("Génération annulée.")
        return
      }
      if (!res.ok || !json?.url) {
        const message =
          res.status === 401
            ? "Session expirée : reconnectez-vous."
            : (json?.error ?? "La génération de l'image a échoué. Réessayez dans un instant.")
        setError({ message, kind: res.status === 503 && json?.code === "not_configured" ? "config" : "other" })
        setLive("")
        return
      }
      const image: StudioImage = {
        key: nextKey(),
        url: json.url,
        width: json.width,
        height: json.height,
        source: "generate",
        model: json.model,
        notice: json.notice,
        description: sent,
      }
      show(image)
      remember(image)
      setLive("Image prête. Vérifiez le texte alternatif, puis utilisez l'image.")
      revealPreview()
    } catch {
      if (controller.signal.aborted) setLive("Génération annulée.")
      else {
        setError({ message: "Connexion impossible. Vérifiez votre réseau puis réessayez.", kind: "other" })
        setLive("")
      }
    } finally {
      if (abortRef.current === controller) abortRef.current = null
      setBusy(null)
    }
  }

  const importFile = useCallback(
    async (file: File) => {
      if (busyRef.current) {
        reportBusy()
        return
      }
      const controller = new AbortController()
      abortRef.current = controller
      setBusy("import")
      setError(null)
      setLive("Envoi de l'image en cours.")
      revealPreview()
      const res = await uploadBlogImage(file, controller.signal)
      if (abortRef.current === controller) abortRef.current = null
      setBusy(null)
      if (!res.ok) {
        if (controller.signal.aborted) setLive("Envoi annulé.")
        else {
          setError({ message: res.error, kind: "other" })
          setLive("")
        }
        return
      }
      const image: StudioImage = { key: nextKey(), ...res.image, source: "import" }
      show(image)
      remember(image)
      setLive("Image importée. Ajoutez son texte alternatif.")
      // Une image importée n'a pas de description : le texte alternatif est à écrire
      window.setTimeout(() => {
        if (altRef.current && !altRef.current.value.trim()) altRef.current.focus()
      }, 50)
    },
    [show, remember, reportBusy, revealPreview],
  )

  // Coller une image (⌘V / Ctrl+V) n'importe où dans la fenêtre
  useEffect(() => {
    if (!open) return
    const onPaste = (e: ClipboardEvent) => {
      const file = imageFileFrom(e.clipboardData?.items)
      if (!file) return
      e.preventDefault()
      if (!busyRef.current) setTab("import")
      void importFile(file)
    }
    document.addEventListener("paste", onPaste)
    return () => document.removeEventListener("paste", onPaste)
  }, [open, importFile])

  /**
   * Une image glissée n'importe où dans la fenêtre : l'onglet « Importer »
   * s'ouvre sous le pointeur, et un dépôt hors de la zone importe quand même
   * (sans cela, le navigateur ouvrirait le fichier à la place de l'éditeur).
   */
  const windowDrop = {
    onDragEnter: (e: React.DragEvent) => {
      if (!dragHasFiles(e)) return
      e.preventDefault()
      if (!busyRef.current) setTab("import")
    },
    onDragOver: (e: React.DragEvent) => {
      if (!dragHasFiles(e)) return
      e.preventDefault()
      e.dataTransfer.dropEffect = "copy"
    },
    onDrop: (e: React.DragEvent) => {
      // Déjà traité par la zone de dépôt
      if (e.isDefaultPrevented() || !dragHasFiles(e)) return
      e.preventDefault()
      setDragOver(false)
      const file = imageFileFrom(e.dataTransfer.files)
      if (file) void importFile(file)
    },
  }

  function cancelBusy() {
    abortRef.current?.abort()
  }

  function close() {
    abortRef.current?.abort()
    onClose()
  }

  const altLength = alt.trim().length
  const altValid = altLength >= ALT_MIN && alt.length <= ALT_MAX
  const canUse = Boolean(current) && !previewBroken && busy === null && altValid

  function use() {
    if (!current) return
    if (!altValid) {
      setAltTouched(true)
      altRef.current?.focus()
      return
    }
    const picked: PickedImage = {
      url: current.url,
      width: current.width,
      height: current.height,
      alt: alt.trim().replace(/\s+/g, " "),
      ...(!cover && caption.trim() ? { caption: caption.trim().replace(/\s+/g, " ") } : {}),
    }
    onPick(picked)
    onClose()
  }

  /* ---------------------------------------------------------------- */
  /* Aperçu                                                            */
  /* ---------------------------------------------------------------- */

  const imageRatio = current && current.width > 0 && current.height > 0 ? current.width / current.height : null
  // Couverture : toujours affichée en 16:9 sur le blog (recadrage) ; image du texte : son vrai format
  const frameRatio = cover ? 16 / 9 : clampRatio(current && busy === null && imageRatio ? imageRatio : ratioOf(effectiveAspect))
  const cropped = cover && imageRatio !== null && Math.abs(imageRatio - 16 / 9) > 0.04

  /** État résumé dans le pied, à côté de « Utiliser cette image ». */
  const status = ((): { tone: "muted" | "ok" | "warn"; text: string } => {
    if (busy === "generate") return { tone: "muted", text: "Génération en cours… Échap pour l'annuler." }
    if (busy === "import") return { tone: "muted", text: "Envoi de l'image en cours…" }
    if (!current) return { tone: "muted", text: tab === "generate" ? "Générez ou importez une image." : "Importez une image." }
    if (previewBroken) return { tone: "warn", text: "L'aperçu ne s'affiche pas : choisissez une autre image." }
    if (!altValid) return { tone: "warn", text: "Ajoutez un texte alternatif pour continuer." }
    return { tone: "ok", text: "Image prête à être utilisée." }
  })()

  const altError =
    altTouched && current && !altValid
      ? alt.length > ALT_MAX
        ? `${nf(ALT_MAX)} caractères au plus.`
        : `Décrivez l'image en ${nf(ALT_MIN)} caractères au moins.`
      : null

  return (
    <Dialog
      open={open}
      disablePointerDismissal
      onOpenChange={(next, details) => {
        if (next) return
        // Échap pendant une génération ou un envoi : on arrête l'attente, la fenêtre reste ouverte
        if (busyRef.current && details?.reason === "escape-key") {
          cancelBusy()
          return
        }
        close()
      }}
    >
      <DialogContent
        showCloseButton={false}
        {...windowDrop}
        className={cn(
          "flex flex-col gap-0 overflow-hidden p-0",
          // Téléphone : plein écran, sans rayon ni bord
          "max-md:inset-0 max-md:left-0 max-md:top-0 max-md:h-[100dvh] max-md:translate-x-0 max-md:translate-y-0 max-md:rounded-none max-md:border-0",
          "max-w-none sm:max-w-none md:h-[min(780px,calc(100dvh-2rem))] md:max-w-[min(960px,calc(100%-2rem))]",
        )}
      >
        {/* En-tête */}
        <div className="flex shrink-0 flex-col gap-1 border-b border-[var(--q-line-soft)] px-5 pb-4 pr-16 pt-5 md:px-6 md:pr-16">
          <DialogTitle className="flex items-center gap-2 text-base font-semibold tracking-[-0.01em] text-[var(--q-ink)]">
            <span className="grid size-7 place-items-center rounded-lg bg-[var(--q-wash)] text-[var(--q-accent-strong)]" aria-hidden>
              <ImageIcon className="size-4" />
            </span>
            {cover ? "Image de couverture" : "Insérer une image"}
          </DialogTitle>
          <DialogDescription className="text-[13px] text-[var(--q-text-4)]">
            {cover
              ? "Affichée en tête de l'article, dans la liste du blog et lors d'un partage."
              : "Une photo qui illustre le passage : générée par Gemini ou importée."}
          </DialogDescription>
        </div>

        <p className="sr-only" aria-live="polite" role="status">
          {live}
        </p>

        {/* Corps : deux volets sur ordinateur ; une colonne sur téléphone (aperçu, réglages, texte alternatif) */}
        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain md:grid md:grid-cols-[360px_minmax(0,1fr)] md:grid-rows-[minmax(0,1fr)] md:overflow-hidden">
          {/* Réglages */}
          <section
            aria-label={tab === "generate" ? "Générer une image" : "Importer une image"}
            className="order-2 flex flex-col gap-5 border-t border-[var(--q-line-soft)] bg-[var(--q-surface-2)] px-5 py-5 md:order-none md:min-h-0 md:overflow-y-auto md:overscroll-contain md:border-r md:border-t-0 md:px-6"
          >
            <div role="group" aria-label="Source de l'image" className="q-seg flex w-full">
              <button
                type="button"
                aria-pressed={tab === "generate"}
                onClick={() => setTab("generate")}
                className="inline-flex min-h-11 flex-1 items-center justify-center gap-1.5 md:min-h-9"
              >
                <Sparkles className="size-4" aria-hidden />
                Générer avec Gemini
              </button>
              <button
                type="button"
                aria-pressed={tab === "import"}
                onClick={() => setTab("import")}
                className="inline-flex min-h-11 flex-1 items-center justify-center gap-1.5 md:min-h-9"
              >
                <Upload className="size-4" aria-hidden />
                Importer
              </button>
            </div>

            {tab === "generate" ? (
              <form
                className="flex flex-col gap-5 md:flex-1"
                onSubmit={(e) => {
                  e.preventDefault()
                  void generate()
                }}
              >
                <div className="flex flex-col gap-1.5">
                  <div className="flex items-end justify-between gap-2">
                    <label htmlFor={`${ids}-description`} className="q-label">
                      Ce que montre l&apos;image
                    </label>
                    {description.trim() !== proposed && (
                      <button
                        type="button"
                        onClick={() => {
                          setDescription(proposed)
                          descriptionRef.current?.focus()
                        }}
                        className="inline-flex min-h-8 items-center gap-1 rounded-md px-1.5 text-[12px] font-semibold text-[var(--q-accent-strong)] hover:bg-[var(--q-hover)] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[var(--q-focus)] max-md:min-h-11"
                      >
                        <RotateCcw className="size-3.5" aria-hidden />
                        Proposition d&apos;après le titre
                      </button>
                    )}
                  </div>
                  <div className="relative">
                    <textarea
                      ref={descriptionRef}
                      id={`${ids}-description`}
                      rows={5}
                      value={description}
                      maxLength={MAX_IMAGE_DESCRIPTION}
                      onChange={(e) => setDescription(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                          e.preventDefault()
                          void generate()
                        }
                      }}
                      aria-describedby={`${ids}-description-aide`}
                      className="q-input min-h-[136px] resize-y pb-7 text-base leading-relaxed md:text-sm"
                      placeholder="Par exemple : un plombier remplace un chauffe-eau dans une buanderie, lumière naturelle."
                    />
                    <span
                      className={cn(
                        "q-num pointer-events-none absolute bottom-2 right-3 text-[11.5px] tabular-nums",
                        description.length > MAX_IMAGE_DESCRIPTION - 100 ? "text-[var(--q-warn)]" : "text-[var(--q-text-4)]",
                      )}
                      aria-hidden
                    >
                      {nf(description.length)} / {nf(MAX_IMAGE_DESCRIPTION)}
                    </span>
                  </div>
                  <span id={`${ids}-description-aide`} className="q-field-hint">
                    En français : le métier, le lieu, le geste, la lumière. Aucun texte ni logo ne sera dessiné.
                  </span>
                </div>

                <div className="flex flex-col gap-2">
                  <span id={`${ids}-styles`} className="q-label">
                    Style
                  </span>
                  <div role="group" aria-labelledby={`${ids}-styles`} className="flex flex-wrap gap-1.5">
                    {IMAGE_STYLE_CHIPS.map((chip) => {
                      const on = hasStyleChip(description, chip)
                      return (
                        <button
                          key={chip.id}
                          type="button"
                          aria-pressed={on}
                          title={chip.text}
                          onClick={() => setDescription((d) => toggleStyleChip(d, chip))}
                          className={cn(
                            "inline-flex min-h-11 items-center gap-1.5 rounded-full border px-3 text-[13px] font-semibold transition-colors duration-100 motion-reduce:transition-none md:min-h-8",
                            "focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[var(--q-focus)]",
                            on
                              ? "border-[var(--q-accent)] bg-[var(--q-wash)] text-[var(--q-accent-strong)]"
                              : "border-[var(--q-line)] bg-[var(--q-surface)] text-[var(--q-text-2)] hover:border-[var(--q-field)] hover:text-[var(--q-ink)]",
                          )}
                        >
                          {on && <Check className="size-3.5" strokeWidth={2.75} aria-hidden />}
                          {chip.label}
                        </button>
                      )
                    })}
                  </div>
                </div>

                <div className="flex flex-col gap-2">
                  <span id={`${ids}-format`} className="q-label">
                    Format
                  </span>
                  <div role="group" aria-labelledby={`${ids}-format`} className="q-seg flex w-full">
                    {IMAGE_ASPECTS.map((a) => {
                      const ratio = ratioOf(a)
                      return (
                        <button
                          key={a}
                          type="button"
                          aria-pressed={effectiveAspect === a}
                          aria-label={IMAGE_ASPECT_LABELS[a]}
                          disabled={cover && a !== "16:9"}
                          onClick={() => setAspect(a)}
                          className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 disabled:cursor-not-allowed disabled:opacity-45 md:min-h-9"
                        >
                          <span
                            aria-hidden
                            className="inline-block rounded-[3px] border-[1.5px] border-current opacity-70"
                            style={{ width: ratio >= 1 ? 16 : Math.round(16 * ratio), height: ratio >= 1 ? Math.round(16 / ratio) : 16 }}
                          />
                          <span className="q-num tabular-nums">{a}</span>
                        </button>
                      )
                    })}
                  </div>
                  {cover && (
                    <span className="q-field-hint">La couverture est toujours en 16:9 : c&apos;est le format du blog et des partages.</span>
                  )}
                </div>

                {/* Ordinateur : action ancrée en bas du volet, visible sans défiler quelle que soit la hauteur de l'écran
                    (bottom négatif = marge intérieure du volet : le collage se fait au bord, rien ne passe dessous) */}
                <div className="flex flex-col gap-2 md:sticky md:-bottom-5 md:z-[1] md:-mx-6 md:-mb-5 md:mt-auto md:border-t md:border-[var(--q-line-soft)] md:bg-[var(--q-surface-2)] md:px-6 md:pb-5 md:pt-4">
                  <button
                    type="submit"
                    disabled={busy !== null || description.trim().length < 3}
                    className="q-btn q-btn-primary h-11 w-full max-md:h-12 max-md:rounded-[14px] max-md:text-[15px]"
                  >
                    {busy === "generate" ? <Loader2 className="animate-spin motion-reduce:animate-none" aria-hidden /> : <Sparkles aria-hidden />}
                    {busy === "generate" ? "Génération…" : current?.source === "generate" ? "Générer une autre image" : "Générer"}
                    <span className="ml-1 hidden items-center gap-0.5 opacity-80 md:inline-flex" aria-hidden>
                      <kbd className="q-kbd !border-white/30 !bg-white/10 !text-white">{mod}</kbd>
                      <kbd className="q-kbd !border-white/30 !bg-white/10 !text-white">↵</kbd>
                    </span>
                  </button>
                  <p className="flex items-start gap-1.5 text-[12.5px] leading-snug text-[var(--q-text-4)]">
                    <Info className="mt-px size-3.5 shrink-0" aria-hidden />
                    Environ 20 à 40 secondes. Chaque image est facturée par Google.
                  </p>
                </div>
              </form>
            ) : (
              <div className="flex flex-col gap-3">
                <div
                  onDragEnter={(e) => {
                    if (!dragHasFiles(e)) return
                    e.preventDefault()
                    setDragOver(true)
                  }}
                  onDragOver={(e) => {
                    if (!dragHasFiles(e)) return
                    e.preventDefault()
                    e.dataTransfer.dropEffect = "copy"
                    if (!dragOver) setDragOver(true)
                  }}
                  onDragLeave={(e) => {
                    if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setDragOver(false)
                  }}
                  onDrop={(e) => {
                    e.preventDefault()
                    setDragOver(false)
                    const file = imageFileFrom(e.dataTransfer.files)
                    if (file) void importFile(file)
                  }}
                  onClick={(e) => {
                    // Un clic dans la zone ouvre le choix du fichier (le bouton reste la cible au clavier)
                    if (e.target === e.currentTarget && busy === null) fileRef.current?.click()
                  }}
                  className={cn(
                    "flex min-h-[248px] cursor-pointer flex-col items-center justify-center gap-3 rounded-2xl border-[1.5px] border-dashed px-5 py-8 text-center transition-colors duration-150 motion-reduce:transition-none",
                    dragOver
                      ? "border-[var(--q-accent)] bg-[var(--q-wash)]"
                      : "border-[var(--q-field)] bg-[var(--q-surface)] hover:border-[var(--q-accent)]",
                    busy === "import" && "pointer-events-none",
                  )}
                >
                  <span
                    aria-hidden
                    className={cn(
                      "pointer-events-none grid size-12 place-items-center rounded-full transition-colors duration-150 motion-reduce:transition-none",
                      dragOver ? "bg-[var(--q-accent)] text-white" : "bg-[var(--q-wash)] text-[var(--q-accent-strong)]",
                    )}
                  >
                    {busy === "import" ? <Loader2 className="size-5 animate-spin motion-reduce:animate-none" /> : <Upload className="size-5" />}
                  </span>
                  <span className="pointer-events-none text-[15px] font-semibold text-[var(--q-ink)]">
                    {busy === "import" ? "Envoi de l'image…" : dragOver ? "Déposez l'image ici" : "Glissez une image ici"}
                  </span>
                  {busy === "import" ? (
                    <button type="button" onClick={cancelBusy} className="q-btn q-btn-ghost q-btn-sm pointer-events-auto max-md:min-h-11">
                      Annuler l&apos;envoi
                    </button>
                  ) : (
                    <>
                      <span className="pointer-events-none text-[13px] text-[var(--q-text-4)]">ou</span>
                      <button
                        type="button"
                        onClick={() => fileRef.current?.click()}
                        className="q-btn q-btn-secondary q-btn-sm max-md:min-h-11"
                      >
                        Choisir un fichier
                      </button>
                      <span className="pointer-events-none hidden items-center gap-1 text-[12.5px] text-[var(--q-text-4)] md:inline-flex">
                        ou collez-la avec <kbd className="q-kbd">{mod}</kbd>
                        <kbd className="q-kbd">V</kbd>
                      </span>
                    </>
                  )}
                </div>
                <p className="text-center text-[12.5px] text-[var(--q-text-4)]">{UPLOAD_HINT}</p>
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="hidden"
                  tabIndex={-1}
                  onChange={(e) => {
                    const file = e.target.files?.[0]
                    e.target.value = "" // pour pouvoir choisir deux fois le même fichier
                    if (file) void importFile(file)
                  }}
                />
              </div>
            )}
          </section>

          {/* Aperçu et texte alternatif (sur téléphone, l'aperçu passe en tête et le texte alternatif à la fin) */}
          <div className="max-md:contents md:flex md:min-h-0 md:flex-col md:overflow-y-auto md:overscroll-contain">
            <div className="order-1 flex flex-col gap-3 px-5 pb-1 pt-5 md:order-none md:px-6 md:pt-6">
              {error && (
                <div role="alert" className="q-banner q-banner-danger flex-col !items-stretch gap-2 !text-[13px]">
                  <span className="flex items-start gap-2">
                    <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
                    <span className="min-w-0 flex-1">
                      {error.kind === "config" && (
                        <strong className="block font-semibold">La génération d&apos;images n&apos;est pas encore configurée.</strong>
                      )}
                      {error.message}
                      {error.kind === "config" && " En attendant, vous pouvez importer une image."}
                    </span>
                    <button
                      type="button"
                      onClick={() => setError(null)}
                      aria-label="Masquer le message"
                      className="-m-1 grid size-7 shrink-0 place-items-center rounded-md hover:bg-[var(--q-danger-line)] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[var(--q-focus)] max-md:size-11"
                    >
                      <X className="size-4" aria-hidden />
                    </button>
                  </span>
                  {error.kind === "config" && tab === "generate" && (
                    <button type="button" onClick={() => setTab("import")} className="q-btn q-btn-secondary q-btn-sm self-start max-md:min-h-11">
                      <Upload aria-hidden />
                      Importer une image
                    </button>
                  )}
                </div>
              )}

              <div
                ref={previewRef}
                aria-busy={busy !== null || undefined}
                className="relative mx-auto w-full scroll-mt-4 [--studio-h:260px] md:[--studio-h:380px]"
                style={{ aspectRatio: String(frameRatio), maxWidth: `calc(var(--studio-h) * ${frameRatio.toFixed(4)})` }}
              >
                <div className="absolute inset-0 overflow-hidden rounded-2xl border border-[var(--q-line)] bg-[var(--q-sunken)]">
                  {busy === "generate" ? (
                    <div className="q-shimmer absolute inset-0 flex flex-col items-center justify-center gap-3 p-5 text-center">
                      <span className="inline-flex items-center gap-2 rounded-full border border-[var(--q-line)] bg-[var(--q-surface)] px-3.5 py-1.5 text-[13px] font-semibold text-[var(--q-ink)] shadow-[shadow:var(--q-shadow-card)]">
                        <Sparkles className="size-4 text-[var(--q-accent)]" aria-hidden />
                        Gemini compose l&apos;image…
                        <span className="q-num font-medium tabular-nums text-[var(--q-text-4)]" aria-hidden>
                          {nf(elapsed)} s
                        </span>
                      </span>
                      {elapsed >= 45 && (
                        <span className="max-w-[300px] text-[12.5px] text-[var(--q-text-3)]">C&apos;est plus long que d&apos;habitude ; la réponse arrive.</span>
                      )}
                      <button type="button" onClick={cancelBusy} className="q-btn q-btn-secondary q-btn-sm max-md:min-h-11">
                        Annuler
                      </button>
                    </div>
                  ) : current && !previewBroken ? (
                    // Image du stockage du blog : <img> (aperçu immédiat, sans passer par l'optimiseur)
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      key={current.key}
                      src={current.url}
                      alt=""
                      onError={() => setPreviewBroken(true)}
                      className={cn(
                        "size-full animate-in fade-in-0 duration-150 motion-reduce:animate-none",
                        cover ? "object-cover" : "object-contain",
                      )}
                    />
                  ) : current && previewBroken ? (
                    <div className="flex size-full flex-col items-center justify-center gap-2 p-5 text-center">
                      <ImageOff className="size-6 text-[var(--q-text-4)]" aria-hidden />
                      <span className="text-[13px] font-semibold text-[var(--q-ink)]">Aperçu indisponible</span>
                      <span className="max-w-[280px] text-[12.5px] text-[var(--q-text-4)]">L&apos;image ne s&apos;affiche pas. Générez-en une autre ou importez un fichier.</span>
                    </div>
                  ) : (
                    <EmptyPreview tab={tab} uploading={busy === "import"} />
                  )}
                </div>

                {current && busy !== "generate" && !previewBroken && (
                  <span className="absolute left-2.5 top-2.5 inline-flex max-w-[calc(100%-1.25rem)] items-center gap-1.5 truncate rounded-full border border-[var(--q-line)] bg-[var(--q-surface)] px-2.5 py-1 text-[11.5px] font-semibold text-[var(--q-text-2)] shadow-[shadow:var(--q-shadow-card)]">
                    {current.source === "generate" ? (
                      <Sparkles className="size-3.5 shrink-0 text-[var(--q-accent)]" aria-hidden />
                    ) : (
                      <Upload className="size-3.5 shrink-0" aria-hidden />
                    )}
                    {current.source === "generate" ? current.model || "Image générée" : "Importée"}
                    <span className="q-num font-medium tabular-nums text-[var(--q-text-4)]">
                      · {nf(current.width)} × {nf(current.height)}
                    </span>
                  </span>
                )}
              </div>

              {current && !previewBroken && busy === null && (current.notice || cropped) && (
                <ul className="flex flex-col gap-1">
                  {current.notice && (
                    <li className="flex items-start gap-1.5 text-[12.5px] leading-snug text-[var(--q-warn)]">
                      <Info className="mt-px size-3.5 shrink-0" aria-hidden />
                      {current.notice}
                    </li>
                  )}
                  {cropped && (
                    <li className="flex items-start gap-1.5 text-[12.5px] leading-snug text-[var(--q-text-3)]">
                      <Info className="mt-px size-3.5 shrink-0" aria-hidden />
                      Affichée en 16:9 sur le blog : le haut et le bas (ou les côtés) seront recadrés, comme dans l&apos;aperçu.
                    </li>
                  )}
                </ul>
              )}

              {history.length > 0 && (
                <div className="flex flex-col gap-2">
                  <span id={`${ids}-historique`} className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-[var(--q-text-3)]">
                    <History className="size-3.5" aria-hidden />
                    Images de cette session
                  </span>
                  <div role="group" aria-labelledby={`${ids}-historique`} className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:thin]">
                    {history.map((h, i) => {
                      const selected = current?.url === h.url
                      return (
                        <button
                          key={h.key}
                          type="button"
                          aria-pressed={selected}
                          aria-label={`${h.source === "generate" ? "Image générée" : "Image importée"} ${history.length - i}${h.description ? ` : ${h.description.slice(0, 80)}` : ""}`}
                          disabled={busy !== null}
                          onClick={() => show(h)}
                          className={cn(
                            "relative size-14 shrink-0 overflow-hidden rounded-xl border bg-[var(--q-sunken)] transition-[box-shadow,border-color] duration-100 motion-reduce:transition-none disabled:opacity-60 max-md:size-16",
                            "focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[var(--q-focus)]",
                            selected ? "border-[var(--q-accent)] ring-2 ring-[var(--q-accent)]" : "border-[var(--q-line)] hover:border-[var(--q-field)]",
                          )}
                        >
                          <HistoryThumb url={h.url} />
                          {selected && (
                            <span className="absolute bottom-1 right-1 grid size-4 place-items-center rounded-full bg-[var(--q-accent)] text-white" aria-hidden>
                              <Check className="size-3" strokeWidth={3} />
                            </span>
                          )}
                        </button>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Texte alternatif et légende */}
            <div className="order-3 flex flex-col gap-4 px-5 pb-6 pt-4 md:order-none md:px-6">
              <div className="flex flex-col gap-1.5">
                <div className="flex items-end justify-between gap-2">
                  <label htmlFor={`${ids}-alt`} className="q-label">
                    Texte alternatif <span className="font-normal text-[var(--q-text-4)]">(obligatoire)</span>
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
                  onChange={(e) => {
                    setAlt(e.target.value)
                    altAuto.current = e.target.value.trim() === ""
                  }}
                  onBlur={() => setAltTouched(true)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault()
                      if (canUse) use()
                    }
                  }}
                  aria-required
                  aria-invalid={altError ? true : undefined}
                  aria-describedby={`${ids}-alt-aide`}
                  placeholder={current ? "Par exemple : un carreleur pose un carrelage gris dans une salle de bains" : "Disponible une fois l'image choisie"}
                  className="q-input text-base md:text-sm"
                />
                <span id={`${ids}-alt-aide`} className={altError ? "q-field-error" : "q-field-hint"} role={altError ? "alert" : undefined}>
                  {altError ??
                    (ALT_PREFIX.test(alt.trim())
                      ? "Inutile de commencer par « Image de » : décrivez directement la scène."
                      : "Décrit l'image pour Google et les lecteurs d'écran.")}
                </span>
              </div>

              {!cover && (
                <div className="flex flex-col gap-1.5">
                  <div className="flex items-end justify-between gap-2">
                    <label htmlFor={`${ids}-legende`} className="q-label">
                      Légende <span className="font-normal text-[var(--q-text-4)]">(facultatif)</span>
                    </label>
                    <span className="q-num text-[11.5px] tabular-nums text-[var(--q-text-4)]" aria-hidden>
                      {nf(caption.length)} / {nf(CAPTION_MAX)}
                    </span>
                  </div>
                  <input
                    id={`${ids}-legende`}
                    type="text"
                    value={caption}
                    maxLength={CAPTION_MAX}
                    onChange={(e) => setCaption(e.target.value)}
                    aria-describedby={`${ids}-legende-aide`}
                    className="q-input text-base md:text-sm"
                  />
                  <span id={`${ids}-legende-aide`} className="q-field-hint">
                    Affichée en petit sous l&apos;image, dans l&apos;article.
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Pied */}
        <div className="flex shrink-0 flex-col gap-2.5 border-t border-[var(--q-line-soft)] bg-[var(--q-surface)] px-5 pb-[max(12px,env(safe-area-inset-bottom))] pt-3 md:flex-row md:items-center md:gap-3 md:px-6 md:pb-3.5">
          <p
            className={cn(
              "flex min-w-0 flex-1 items-center gap-1.5 text-[12.5px]",
              status.tone === "ok" ? "text-[var(--q-ok)]" : status.tone === "warn" ? "text-[var(--q-warn)]" : "text-[var(--q-text-4)]",
            )}
          >
            {status.tone === "ok" ? (
              <CircleCheck className="size-3.5 shrink-0" aria-hidden />
            ) : status.tone === "warn" ? (
              <TriangleAlert className="size-3.5 shrink-0" aria-hidden />
            ) : (
              <ImageIcon className="size-3.5 shrink-0" aria-hidden />
            )}
            <span className="truncate">{status.text}</span>
          </p>
          <div className="flex gap-2">
            <button type="button" onClick={close} className="q-btn q-btn-ghost max-md:h-12 max-md:flex-1 max-md:rounded-[14px]">
              Annuler
            </button>
            <button
              type="button"
              onClick={use}
              disabled={!canUse}
              className="q-btn q-btn-primary max-md:h-12 max-md:flex-[2] max-md:rounded-[14px] max-md:text-[15px]"
            >
              <Check aria-hidden />
              Utiliser cette image
            </button>
          </div>
        </div>

        {/* Fermer : en dernier dans l'ordre du clavier (le focus d'ouverture va aux réglages), 44 px au doigt */}
        <button
          type="button"
          onClick={close}
          aria-label="Fermer"
          title="Fermer (Échap)"
          className="absolute right-2 top-2 grid size-11 place-items-center rounded-[10px] text-[var(--q-text-3)] transition-colors duration-100 hover:bg-[var(--q-hover)] hover:text-[var(--q-ink)] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[var(--q-focus)] motion-reduce:transition-none md:right-3 md:top-3 md:size-9"
        >
          <X className="size-[18px]" aria-hidden />
        </button>
      </DialogContent>
    </Dialog>
  )
}

/** Aperçu vide : trame pointillée douce, pictogramme et consigne selon l'onglet. */
/** Miniature de l'historique : image introuvable → pictogramme sobre (jamais l'icône cassée du navigateur). */
function HistoryThumb({ url }: { url: string }) {
  const [broken, setBroken] = useState(false)
  if (broken) {
    return (
      <span className="grid size-full place-items-center text-[var(--q-text-4)]" aria-hidden>
        <ImageOff className="size-4" />
      </span>
    )
  }
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={url} alt="" loading="lazy" onError={() => setBroken(true)} className="size-full object-cover" />
}

function EmptyPreview({ tab, uploading }: { tab: StudioTab; uploading: boolean }) {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-[radial-gradient(var(--q-line)_1px,transparent_1px)] p-6 text-center [background-size:16px_16px]">
      <span className="grid size-14 place-items-center rounded-2xl border border-[var(--q-wash-line)] bg-[var(--q-surface)] text-[var(--q-accent-strong)] shadow-[shadow:var(--q-shadow-card)]" aria-hidden>
        {uploading ? <Loader2 className="size-6 animate-spin motion-reduce:animate-none" /> : <ImageIcon className="size-6" strokeWidth={1.75} />}
      </span>
      <span className="text-[14px] font-semibold text-[var(--q-ink)]">{uploading ? "Envoi de l'image…" : "Aperçu de l'image"}</span>
      {!uploading && (
        <span className="max-w-[300px] text-[12.5px] leading-relaxed text-[var(--q-text-4)]">
          {tab === "generate"
            ? "Décrivez la scène, puis « Générer » : l'image s'affiche ici, au format du blog."
            : "Déposez, choisissez ou collez une image : elle s'affiche ici."}
        </span>
      )}
    </div>
  )
}
