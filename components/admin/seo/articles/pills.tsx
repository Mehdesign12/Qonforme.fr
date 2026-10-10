/**
 * Pastilles et étiquettes du module Articles : statut d'un article, statut
 * d'un sujet, type, source. Chaque pastille porte une icône et un libellé
 * (jamais la couleur seule) ; libellés de lib/seo/types.ts.
 * Sans hook : pages serveur et composants client.
 */
import { Archive, Check, Circle, Clock, Loader2, PencilLine, TriangleAlert, X } from "lucide-react"
import { StatusPill } from "@/components/app/kit"
import { cn } from "@/lib/utils"
import { ARTICLE_STATUS, ARTICLE_TYPE_LABELS, TOPIC_STATUS, type ArticleDisplayStatus, type ArticleType, type TopicStatus } from "@/lib/seo/types"

const ARTICLE_ICONS: Record<ArticleDisplayStatus, React.ReactNode> = {
  published: <Check strokeWidth={2.75} aria-hidden />,
  scheduled: <Clock strokeWidth={2.25} aria-hidden />,
  draft: <PencilLine strokeWidth={2.25} aria-hidden />,
  to_review: <TriangleAlert strokeWidth={2.25} aria-hidden />,
  failed: <X strokeWidth={2.75} aria-hidden />,
  generating: <Loader2 strokeWidth={2.25} className="animate-spin motion-reduce:animate-none" aria-hidden />,
}

export function ArticleStatusPill({ status, className }: { status: ArticleDisplayStatus; className?: string }) {
  const def = ARTICLE_STATUS[status]
  return (
    <StatusPill tone={def.tone} icon={ARTICLE_ICONS[status]} className={className}>
      {def.label}
    </StatusPill>
  )
}

const TOPIC_ICONS: Record<TopicStatus, React.ReactNode> = {
  unplanned: <Circle strokeWidth={2.25} aria-hidden />,
  planned: <Clock strokeWidth={2.25} aria-hidden />,
  generating: <Loader2 strokeWidth={2.25} className="animate-spin motion-reduce:animate-none" aria-hidden />,
  drafted: <Check strokeWidth={2.75} aria-hidden />,
  published: <Check strokeWidth={2.75} aria-hidden />,
  failed: <X strokeWidth={2.75} aria-hidden />,
  archived: <Archive strokeWidth={2.25} aria-hidden />,
}

export function TopicStatusPill({ status, className }: { status: TopicStatus; className?: string }) {
  const def = TOPIC_STATUS[status]
  return (
    <StatusPill tone={def.tone} icon={TOPIC_ICONS[status]} className={className}>
      {def.label}
    </StatusPill>
  )
}

export function Tag({ children, className }: { children: React.ReactNode; className?: string }) {
  return <span className={cn("q-tag whitespace-nowrap", className)}>{children}</span>
}

export function TypeTag({ type }: { type: ArticleType | null }) {
  if (!type) return null
  return <Tag>{ARTICLE_TYPE_LABELS[type]}</Tag>
}

/** Légende des statuts (calendrier). */
export const LEGEND: ArticleDisplayStatus[] = ["published", "scheduled", "draft", "to_review", "failed"]

/** Valeur absente : « — » visible, libellé lu par les lecteurs d'écran. */
export function Missing({ label = "Non renseigné" }: { label?: string }) {
  return (
    <>
      <span aria-hidden className="text-[var(--q-text-4)]">—</span>
      <span className="sr-only">{label}</span>
    </>
  )
}
