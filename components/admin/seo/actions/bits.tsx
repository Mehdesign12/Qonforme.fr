/**
 * Petites briques des Actions SEO (sans hook : pages serveur et client) :
 * pastille de gravité, étiquette de source, durée estimée, évolution chiffrée.
 * Chaque pastille porte un texte, jamais la couleur seule.
 */
import { ArrowDown, ArrowUp, CircleAlert, Clock, Minus, TriangleAlert } from "lucide-react"
import { StatusPill } from "@/components/app/kit"
import { cn } from "@/lib/utils"
import { FINDING_SOURCE_LABELS, PAGE_TYPE_LABELS, SEVERITY, type FindingSeverity, type FindingSource, type PageType } from "@/lib/seo/types"
import type { Delta } from "@/lib/seo/format"

const SEVERITY_ICON: Record<FindingSeverity, React.ReactNode> = {
  high: <TriangleAlert strokeWidth={2.25} aria-hidden />,
  medium: <CircleAlert strokeWidth={2.25} aria-hidden />,
  low: <Minus strokeWidth={2.25} aria-hidden />,
}

export function SeverityPill({ severity, className }: { severity: FindingSeverity; className?: string }) {
  const def = SEVERITY[severity] ?? SEVERITY.medium
  return (
    <StatusPill tone={def.tone} icon={SEVERITY_ICON[severity]} className={className}>
      <span className="sr-only">Gravité : </span>
      {def.label}
    </StatusPill>
  )
}

export function SourceTag({ source, className }: { source: FindingSource; className?: string }) {
  return (
    <span className={cn("q-tag whitespace-nowrap", className)}>
      <span className="sr-only">Source : </span>
      {FINDING_SOURCE_LABELS[source] ?? source}
    </span>
  )
}

export function PageTypeTag({ type, className }: { type: PageType | null | undefined; className?: string }) {
  if (!type) return null
  return <span className={cn("q-tag whitespace-nowrap", className)}>{PAGE_TYPE_LABELS[type] ?? type}</span>
}

export function Duration({ minutes, long, className }: { minutes: number | null | undefined; long?: boolean; className?: string }) {
  if (!minutes) return null
  return (
    <span className={cn("inline-flex items-center gap-1.5 whitespace-nowrap text-[13px] tabular-nums text-[var(--q-text-3)]", className)}>
      <Clock className="size-3.5 shrink-0" aria-hidden />
      <span className={long ? undefined : "sr-only"}>Durée estimée : </span>
      {minutes}&nbsp;min
    </span>
  )
}

/** Évolution (« +102 % », « 2,3 places de mieux ») avec icône ; « — » sans comparaison. */
export function DeltaText({ delta, suffix }: { delta: Delta; suffix?: string }) {
  const tone =
    delta.trend === "up" ? "text-[var(--q-ok)]" : delta.trend === "down" ? "text-[var(--q-danger)]" : "text-[var(--q-text-4)]"
  return (
    <span className="flex flex-wrap items-center gap-1.5 text-[13px] text-[var(--q-text-4)]">
      <span className={cn("inline-flex items-center gap-0.5 font-semibold", tone)}>
        {delta.trend === "up" && <ArrowUp className="size-3.5" aria-hidden />}
        {delta.trend === "down" && <ArrowDown className="size-3.5" aria-hidden />}
        {delta.text}
      </span>
      {suffix}
    </span>
  )
}
