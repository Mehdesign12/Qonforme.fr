/**
 * Petites briques de l'écran Mots-clés, sans hook : utilisables dans la page
 * serveur comme dans le panneau client.
 */
import { Check, Circle, EyeOff, Target, Zap } from "lucide-react"
import { StatusPill } from "@/components/app/kit"
import { cn } from "@/lib/utils"
import { KEYWORD_STATUS, type KeywordStatus } from "@/lib/seo/types"
import { fmtCpc, NBSP } from "@/lib/seo/format"
import type { CpcCurrency } from "@/lib/seo/keywords/types"
import type { PageLabel } from "@/lib/seo/keywords/page-label"

const STATUS_ICON: Record<KeywordStatus, React.ReactNode> = {
  candidate: <Circle strokeWidth={2.25} aria-hidden />,
  targeted: <Target strokeWidth={2.25} aria-hidden />,
  covered: <Check strokeWidth={2.75} aria-hidden />,
  ignored: <EyeOff strokeWidth={2.25} aria-hidden />,
}

/** Pastille de statut (libellé de lib/seo/types.ts) ; « Ignoré » barré. */
export function KeywordStatusPill({ status, className }: { status: KeywordStatus; className?: string }) {
  const def = KEYWORD_STATUS[status]
  return (
    <StatusPill tone={def.tone} icon={STATUS_ICON[status]} className={className}>
      <span className={cn(status === "ignored" && "line-through")}>{def.label}</span>
    </StatusPill>
  )
}

/** Étiquette « Gain rapide » de la liste. */
export function QuickWinTag({ className }: { className?: string }) {
  return (
    <span className={cn("q-tag gap-1 whitespace-nowrap", className)}>
      <Zap className="size-3" strokeWidth={2.25} aria-hidden />
      Gain rapide
    </span>
  )
}

/** Pastille « Gain rapide » du panneau de détail. */
export function QuickWinPill() {
  return (
    <StatusPill tone="info" icon={<Zap strokeWidth={2.25} aria-hidden />}>
      Gain rapide
    </StatusPill>
  )
}

/** Valeur absente : « — » à l'écran, phrase pour les lecteurs d'écran. */
export function Missing({ label }: { label: string }) {
  return (
    <>
      <span aria-hidden className="text-[var(--q-text-4)]">
        —
      </span>
      <span className="sr-only">{label}</span>
    </>
  )
}

/** CPC en euros (valeurs reprises de PushRank) ou en dollars US (Google Ads via DataForSEO). */
export function fmtKeywordCpc(cpc: number | null, currency: CpcCurrency | null): string {
  if (currency !== "USD") return fmtCpc(cpc)
  if (cpc === null || Number.isNaN(cpc)) return "—"
  return `${cpc.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}${NBSP}$`
}

export function CpcValue({ cpc, currency }: { cpc: number | null; currency: CpcCurrency | null }) {
  if (cpc === null) return <Missing label="CPC non connu" />
  return currency === "USD" ? (
    <span title="Dollars US (Google Ads)">
      {fmtKeywordCpc(cpc, currency)}
      <span className="sr-only"> (dollars US)</span>
    </span>
  ) : (
    <>{fmtKeywordCpc(cpc, currency)}</>
  )
}

/** Page cible : « Guide « … » », « Accueil / » ou le chemin en DM Mono. */
export function TargetLabel({ target, compact }: { target: PageLabel | null; compact?: boolean }) {
  if (!target) return <Missing label="Pas de page cible" />
  if (target.label && target.path === "/") {
    return (
      <span>
        <span className="text-[13px] text-[var(--q-text-3)]">{target.label}</span>{" "}
        <span className={cn("font-mono text-[var(--q-ink)]", compact ? "text-xs" : "text-[13px]")}>/</span>
      </span>
    )
  }
  if (target.label) {
    return (
      <span className="text-[13px] text-[var(--q-text-3)]" title={target.path}>
        {target.label}
      </span>
    )
  }
  return <span className={cn("break-all font-mono text-[var(--q-ink)]", compact ? "text-xs" : "text-[13px]")}>{target.path}</span>
}
