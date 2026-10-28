"use client"

/**
 * En-tête de l'éditeur d'articles (non collant) : retour (sur téléphone et
 * tablette ; la barre supérieure porte le fil d'Ariane sur ordinateur), titre
 * de la page, pastille du statut enregistré, état d'enregistrement ; à droite
 * le menu « … » (voir sur le site, régénérer un article généré, supprimer) et
 * « Enregistrer » avec son raccourci.
 *
 * Téléphone et tablette : retour et boutons sur une ligne, titre entier
 * dessous, puis le statut.
 */
import Link from "next/link"
import { ArrowUpRight, Bot, Check, ChevronLeft, Ellipsis, Loader2, RefreshCw, Save, Trash2 } from "lucide-react"
import { StatusPill } from "@/components/app/kit"
import { ArticleStatusPill } from "@/components/admin/seo/articles/pills"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { cn } from "@/lib/utils"
import { SaveIndicator, type SaveState } from "@/components/admin/blog/shell/parts"
import { useModKey } from "@/components/admin/blog/shell/hooks"
import type { ArticleDisplayStatus } from "@/lib/seo/types"

export function EditorHeader({
  title,
  backHref,
  backLabel,
  status,
  aiGenerated,
  saveState,
  saving,
  idle = false,
  onSave,
  viewHref,
  onRegenerate,
  regenerating = false,
  onDelete,
}: {
  title: string
  backHref: string
  backLabel: string
  /** Statut enregistré ; null pour un article pas encore créé. */
  status: ArticleDisplayStatus | null
  aiGenerated: boolean
  saveState: SaveState
  saving: boolean
  /** Article enregistré, rien n'a changé : « Enregistré » en neutre, inactif (bleu seulement quand il y a quelque chose à enregistrer). */
  idle?: boolean
  onSave: () => void
  /** Adresse publique (article en ligne) ; null sinon. */
  viewHref: string | null
  onRegenerate?: () => void
  regenerating?: boolean
  onDelete?: () => void
}) {
  const mod = useModKey()
  const hasMenu = Boolean(viewHref || onRegenerate || onDelete)

  return (
    // Téléphone et tablette : retour et boutons sur la première ligne, titre entier dessous ;
    // ordinateur (barre supérieure avec le fil d'Ariane) : titre et statut à gauche, boutons à droite
    <header className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-2">
      <Link
        href={backHref}
        className="q-link col-start-1 row-start-1 -ml-1 inline-flex min-h-11 items-center gap-1 justify-self-start px-1 text-[15px] lg:hidden"
      >
        <ChevronLeft className="size-4" strokeWidth={2.25} aria-hidden />
        {backLabel}
      </Link>

      <h1 className="q-h1 col-span-2 row-start-2 min-w-0 max-lg:mt-1 [overflow-wrap:anywhere] lg:col-span-1 lg:row-start-1">{title}</h1>

      <div className="col-start-2 row-start-1 flex items-center gap-2 lg:row-span-2">
        {hasMenu && (
          <DropdownMenu>
            <DropdownMenuTrigger className="q-btn q-btn-secondary q-btn-icon max-md:!size-11" aria-label="Autres actions sur l'article">
              <Ellipsis aria-hidden />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" sideOffset={8} className="w-[236px]">
              {viewHref && (
                <DropdownMenuItem onClick={() => window.open(viewHref, "_blank", "noopener,noreferrer")}>
                  <ArrowUpRight aria-hidden />
                  Voir sur le site
                </DropdownMenuItem>
              )}
              {onRegenerate && (
                <DropdownMenuItem onClick={onRegenerate} disabled={regenerating}>
                  {regenerating ? <Loader2 className="animate-spin motion-reduce:animate-none" aria-hidden /> : <RefreshCw aria-hidden />}
                  {regenerating ? "Rédaction en cours…" : "Régénérer avec l'IA"}
                </DropdownMenuItem>
              )}
              {onDelete && (viewHref || onRegenerate) && <DropdownMenuSeparator className="my-1 h-px bg-[var(--q-line-soft)]" />}
              {onDelete && (
                <DropdownMenuItem variant="destructive" onClick={onDelete}>
                  <Trash2 aria-hidden />
                  Supprimer l&apos;article
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
        <button
          type="button"
          onClick={onSave}
          disabled={saving || idle}
          aria-keyshortcuts={idle ? undefined : "Control+S Meta+S"}
          className={cn("q-btn max-md:h-11", idle ? "q-btn-secondary" : "q-btn-primary")}
        >
          {saving ? <Loader2 className="animate-spin motion-reduce:animate-none" aria-hidden /> : idle ? <Check aria-hidden /> : <Save aria-hidden />}
          {saving ? "Enregistrement…" : idle ? "Enregistré" : "Enregistrer"}
          {mod && !saving && !idle && (
            <kbd className="ml-0.5 hidden rounded-[5px] border border-white/30 px-1.5 py-[3px] font-mono text-[11px] font-medium leading-none text-white/85 md:inline" aria-hidden>
              {mod === "⌘" ? "⌘S" : "Ctrl S"}
            </kbd>
          )}
        </button>
      </div>

      <div className="col-span-2 row-start-3 flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1.5 lg:col-span-1 lg:row-start-2">
        {status && <ArticleStatusPill status={status} post />}
        {aiGenerated && (
          <StatusPill tone="info" icon={<Bot strokeWidth={2.25} aria-hidden />}>
            Généré par l&apos;IA
          </StatusPill>
        )}
        <SaveIndicator state={saveState} />
      </div>
    </header>
  )
}
