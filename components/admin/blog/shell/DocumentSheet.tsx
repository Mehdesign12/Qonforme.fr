"use client"

/**
 * Feuille de l'article dans l'éditeur : une seule carte (rayon 20) qui porte,
 * de haut en bas, la couverture, le titre, le chapeau puis l'éditeur visuel,
 * rendu « intégré » (sans sa propre bordure, ombre ni rayon : aucune carte
 * dans une carte). Le titre et le chapeau s'alignent sur la colonne de texte
 * de l'éditeur (mesure du blog, 68 caractères) ; la couverture déborde un peu
 * de cette colonne, comme sur le blog.
 *
 * - Titre : zone de texte sans bordure, police d'affichage, hauteur au
 *   contenu ; Entrée passe au chapeau (un titre tient sur une ligne logique).
 *   Tailles en « ! » : le filet de sécurité iOS de globals.css ramène toute
 *   zone de texte à 16 px sur téléphone ; ici, on reste au-dessus (30 et
 *   17 px), ce que la règle protège.
 * - Chapeau : 17-18 px, compteur discret (au focus, ou hors de la zone
 *   conseillée de 150 à 220 caractères) et « Proposer » ; Entrée passe au
 *   texte.
 * - Éditeur : chargé côté client seulement (next/dynamic, squelette de même
 *   hauteur) ; la poignée passe par `editorRef` (next/dynamic ne transmet pas
 *   la ref).
 *
 * Chaque bloc porte data-focus-target : la liste de contrôle y envoie le
 * focus et l'entoure un instant d'un anneau (FLASH_RING).
 */
import dynamic from "next/dynamic"
import { useId } from "react"
import { cn } from "@/lib/utils"
import { SUGGEST_FIELDS } from "@/lib/seo/articles/suggest"
import { CoverField } from "@/components/admin/blog/CoverField"
import { EditorSkeleton } from "@/components/admin/blog/editor/EditorSkeleton"
import { charTone } from "@/components/admin/blog/seo/CharMeter"
import { SuggestButton, SuggestionList, type SuggestController } from "@/components/admin/blog/seo/SuggestButton"
import { AutoTextarea, FLASH_RING } from "@/components/admin/blog/shell/parts"
import type { RichEditorHandle } from "@/components/admin/blog/editor/RichEditor"
import type { EditorMode } from "@/components/admin/blog/editor/Toolbar"
import type { PickedImage } from "@/lib/seo/articles/editor-types"
import type { PassageContext } from "@/lib/blog-images/passage"

/**
 * Éditeur intégré à la feuille : ni bordure, ni ombre, ni rayon propres ;
 * barre d'état aux coins de la feuille. La feuille n'a jamais la largeur
 * d'une page entière (colonne de gauche sur ordinateur, marges de la coque
 * sur tablette) : à partir de 768 px, « Visuel / Markdown » passe en icônes
 * (libellés gardés pour les lecteurs d'écran) et les boutons vont à la ligne
 * plutôt que de se cacher hors de la barre. Sur téléphone, la barre garde
 * son défilement horizontal.
 */
const EMBEDDED = cn(
  "!rounded-none !border-0 !bg-transparent !shadow-none [&>div:last-child]:rounded-b-[19px]",
  "md:[&_[data-editor-toolbar]_.q-seg>button>span]:sr-only md:[&_[data-editor-toolbar]_.q-seg>button]:!px-2.5",
  "md:[&_[data-editor-toolbar]_.overflow-x-auto]:flex-wrap md:[&_[data-editor-toolbar]_.overflow-x-auto]:gap-y-1",
)

const RichEditor = dynamic(() => import("@/components/admin/blog/editor/RichEditor").then((m) => m.RichEditorWithRef), {
  ssr: false,
  loading: () => <EditorSkeleton className="!rounded-none !border-0 !shadow-none" />,
})

/** Colonne du texte : même taille de police que .blog-prose, pour que « 68ch » tombe au même endroit. */
const MEASURE = "mx-auto w-full max-w-[68ch] text-[1.0625rem] sm:text-[1.125rem]"

/** Repère de focus des champs sans bordure : un filet d'accent à gauche. */
const FOCUS_BAR =
  "before:pointer-events-none before:absolute before:left-0 before:top-2 before:w-[3px] before:rounded-full before:bg-[var(--q-accent)] before:opacity-0 before:transition-opacity before:duration-150 focus-within:before:opacity-100 motion-reduce:before:transition-none"

const COUNTER_TONE = {
  ok: "text-[var(--q-ok)]",
  warn: "text-[var(--q-warn)]",
  danger: "text-[var(--q-danger)]",
  neutral: "text-[var(--q-text-4)]",
} as const

export function DocumentSheet({
  title,
  excerpt,
  content,
  coverUrl,
  coverAlt,
  keyword,
  onTitleChange,
  onExcerptChange,
  onContentChange,
  onCoverChange,
  onOutline,
  highlightTerms,
  editorRef,
  onRequestImage,
  excerptSuggest,
  editorMode,
}: {
  title: string
  excerpt: string
  content: string
  coverUrl: string
  coverAlt: string
  keyword: string | null
  onTitleChange: (value: string) => void
  onExcerptChange: (value: string) => void
  onContentChange: (markdown: string) => void
  onCoverChange: (next: { url: string; alt: string }) => void
  onOutline: (headings: { level: number; text: string }[]) => void
  highlightTerms: string[]
  editorRef: React.RefObject<RichEditorHandle>
  onRequestImage: (passage?: PassageContext | null) => Promise<PickedImage | null>
  excerptSuggest: SuggestController
  /** Mode de l'éditeur à l'ouverture (repris après la création de l'article). */
  editorMode?: EditorMode
}) {
  const uid = useId()
  const excerptDef = SUGGEST_FIELDS.excerpt
  const excerptLength = excerpt.trim().length
  const excerptTone = charTone(excerptLength, excerptDef.idealMin, excerptDef.idealMax, excerptDef.max)
  const excerptOff = excerptLength > 0 && excerptTone !== "ok"
  const focusEditor = () => editorRef.current?.focus()

  return (
    <article aria-label="Article" className="q-card relative flex min-w-0 flex-col !rounded-[20px]">
      {/* Couverture */}
      <div className="px-3.5 pt-3.5 sm:px-6 sm:pt-6">
        <div data-focus-target="cover" className={cn(FLASH_RING, "rounded-2xl")}>
          <CoverField id="blog-cover" url={coverUrl} alt={coverAlt} onChange={onCoverChange} title={title} keyword={keyword} />
        </div>
      </div>

      {/* Titre et chapeau, sur la colonne du texte */}
      <div className="px-5 pt-6 sm:px-10 sm:pt-8">
        <div className={MEASURE}>
          <div data-focus-target="title" className={cn("relative -mx-3 px-3 py-1", FLASH_RING, FOCUS_BAR, "before:bottom-2")}>
            <AutoTextarea
              id="blog-title"
              value={title}
              onChange={(e) => onTitleChange(e.target.value.replace(/\s*[\r\n]+\s*/g, " "))}
              onKeyDown={(e) => {
                // Entrée qui valide une saisie en cours (accents composés, clavier asiatique) : laissée au champ
                if (e.key === "Enter" && !e.nativeEvent.isComposing) {
                  e.preventDefault()
                  document.getElementById("blog-excerpt")?.focus()
                }
              }}
              aria-label="Titre de l'article"
              placeholder="Titre de l'article"
              maxLength={200}
              spellCheck
              lang="fr"
              className="q-display bg-transparent !text-[30px] font-semibold leading-[1.15] text-[var(--q-ink-strong)] outline-none placeholder:text-[var(--q-placeholder)] md:!text-[37px]"
            />
          </div>

          <div data-focus-target="excerpt" className={cn("group/chapeau relative -mx-3 mt-2 px-3 pb-9 pt-1", FLASH_RING, FOCUS_BAR, "before:bottom-10")}>
            <AutoTextarea
              id="blog-excerpt"
              value={excerpt}
              onChange={(e) => onExcerptChange(e.target.value.replace(/\s*[\r\n]+\s*/g, " "))}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.nativeEvent.isComposing) {
                  e.preventDefault()
                  focusEditor()
                }
              }}
              aria-label="Chapeau de l'article"
              aria-describedby={`${uid}-chapeau`}
              placeholder="Chapeau : une ou deux phrases qui donnent envie de lire (affichées dans la liste du blog)"
              maxLength={400}
              spellCheck
              lang="fr"
              className="bg-transparent !text-[17px] leading-[1.6] text-[var(--q-text-2)] outline-none placeholder:text-[var(--q-placeholder)] md:!text-[18px]"
            />
            <div className="absolute bottom-1.5 right-3 flex items-center gap-1">
              <SuggestButton
                suggest={excerptSuggest}
                label="Proposer"
                className={cn(
                  "transition-opacity duration-150 motion-reduce:transition-none",
                  excerptSuggest.open
                    ? "opacity-100"
                    : "opacity-0 focus-visible:opacity-100 group-focus-within/chapeau:opacity-100 [@media(hover:hover)]:group-hover/chapeau:opacity-100",
                )}
              />
              <span
                id={`${uid}-chapeau`}
                className={cn(
                  "q-num min-w-[64px] text-right text-[12px] font-semibold tabular-nums transition-opacity duration-150 motion-reduce:transition-none",
                  COUNTER_TONE[excerptTone],
                  excerptOff ? "opacity-100" : "opacity-0 group-focus-within/chapeau:opacity-100",
                )}
              >
                {excerptLength.toLocaleString("fr-FR")}
                <span className="font-normal text-[var(--q-text-4)]"> / {excerptDef.idealMax}</span>
                <span className="sr-only">
                  {" "}
                  caractères, {excerptDef.idealMin} à {excerptDef.idealMax} conseillés
                </span>
              </span>
            </div>
          </div>
          <SuggestionList suggest={excerptSuggest} className="mb-5" />
        </div>
      </div>

      {/* Texte */}
      <div data-focus-target="content" className="border-t border-[var(--q-line-soft)]">
        <RichEditor
          editorRef={editorRef}
          value={content}
          onChange={onContentChange}
          onOutline={onOutline}
          highlightTerms={highlightTerms}
          keyword={keyword}
          articleTitle={title}
          onRequestImage={onRequestImage}
          initialMode={editorMode}
          className={EMBEDDED}
        />
      </div>
    </article>
  )
}
