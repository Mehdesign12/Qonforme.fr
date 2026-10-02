/**
 * Petites briques du tableau de bord (réel et démo).
 */
import { Clock } from "lucide-react"
import { DocStatusPill, StatusPill } from "@/components/app/kit"
import { cn } from "@/lib/utils"

/**
 * « Verre solide » des planches mobiles (.q-solid du canevas) : surface opaque
 * en léger dégradé, sans backdrop-filter (règle iOS de CLAUDE.md).
 */
export const SOLID =
  "border border-[var(--q-line)] bg-[linear-gradient(180deg,var(--q-surface),var(--q-surface-2))] shadow-[var(--q-shadow-float)]"

/** Grille d'indicateurs du canevas : 4 colonnes de 220 px minimum. */
export const KPI_GRID = "grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(min(220px,100%),1fr))]"

/** En-tête de section posé au-dessus d'une liste (mobile). */
export function ListHeading({ id, title, aside }: { id: string; title: string; aside?: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <h2 id={id} className="q-h2">{title}</h2>
      {aside}
    </div>
  )
}

/**
 * Statut d'une facture : « Retard N j » quand l'échéance d'une facture en cours
 * est passée, sinon la pastille du statut (toujours un libellé, jamais la couleur seule).
 */
export function InvoicePill({ status, lateDays, compact }: { status: string; lateDays: number | null; compact?: boolean }) {
  const size = compact ? "!h-5 !gap-1 !px-2 !text-[11px]" : undefined
  if (lateDays && lateDays > 0) {
    return (
      <StatusPill tone="warn" icon={<Clock strokeWidth={2.5} aria-hidden />} className={size}>
        Retard {lateDays}&nbsp;j
      </StatusPill>
    )
  }
  return <DocStatusPill kind="invoice" status={status} className={cn(size)} />
}
