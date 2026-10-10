/**
 * Liste des mots-clés : tableau sur ordinateur (conteneur à défilement
 * horizontal, pages de 15 lignes, Précédent / Suivant), lignes de liste
 * empilées sur téléphone (« Afficher plus »). Composant serveur : chaque
 * mot-clé est un lien vers `?mot-cle=<id>` (panneau) ; la ligne du mot-clé
 * ouvert est signalée (fond, chevron, « (détail ouvert) » pour les lecteurs d'écran).
 */
import Link from "next/link"
import { ChevronDown, ChevronLeft, ChevronRight } from "lucide-react"
import { cn } from "@/lib/utils"
import { KEYWORD_INTENT_LABELS } from "@/lib/seo/types"
import { fmtCount, fmtPosition } from "@/lib/seo/format"
import type { KeywordRow } from "@/lib/seo/keywords/types"
import type { PageLabel } from "@/lib/seo/keywords/page-label"
import { CpcValue, KeywordStatusPill, Missing, QuickWinTag, TargetLabel } from "@/components/admin/seo/keywords/parts"

export interface KeywordListItem {
  row: KeywordRow
  quickWin: boolean
  target: PageLabel | null
  href: string
  /** Mot-clé ouvert dans le panneau de détail. */
  selected: boolean
}

function OpenMark() {
  return <span className="sr-only">{String.fromCharCode(0xa0)}(détail ouvert)</span>
}

function Num({ value, missing, format = fmtCount }: { value: number | null; missing: string; format?: (n: number) => string }) {
  return value === null ? <Missing label={missing} /> : <>{format(value)}</>
}

export function KeywordTable({ items }: { items: KeywordListItem[] }) {
  return (
    <div className="hidden overflow-x-auto md:block">
      <table className="q-table min-w-[1100px] table-fixed" aria-label="Mots-clés suivis">
        <colgroup>
          <col className="w-[240px]" />
          <col className="w-[136px]" />
          <col className="w-[104px]" />
          <col className="w-[84px]" />
          <col className="w-[76px]" />
          <col className="w-[76px]" />
          <col className="w-[64px]" />
          <col className="w-[56px]" />
          <col />
          <col className="w-[124px]" />
        </colgroup>
        <thead>
          <tr>
            <th scope="col">Mot-clé</th>
            <th scope="col">Intention</th>
            <th scope="col" className="!text-right">Volume / mois</th>
            <th scope="col" className="!text-right">Difficulté</th>
            <th scope="col" className="!text-right">CPC</th>
            <th scope="col" className="!text-right">Position</th>
            <th scope="col" className="!text-right">
              <abbr title="Impressions" className="no-underline">Impr.</abbr>
            </th>
            <th scope="col" className="!text-right">Clics</th>
            <th scope="col">Page cible</th>
            <th scope="col">Statut</th>
          </tr>
        </thead>
        <tbody>
          {items.map(({ row: k, quickWin, target, href, selected }) => {
            const ignored = k.status === "ignored"
            return (
              <tr key={k.id} className={selected ? "bg-[var(--q-wash)]" : undefined}>
                <td>
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <Link
                      href={href}
                      scroll={false}
                      aria-current={selected ? "true" : undefined}
                      className={cn(
                        "font-mono text-[13px] font-medium [overflow-wrap:anywhere] hover:text-[var(--q-accent-strong)] hover:underline",
                        ignored ? "text-[var(--q-text-4)]" : "text-[var(--q-ink)]",
                      )}
                    >
                      {k.keyword}
                      {selected && <OpenMark />}
                    </Link>
                    {selected && <ChevronRight className="size-3.5 shrink-0 text-[var(--q-text-4)]" aria-hidden />}
                    {quickWin && <QuickWinTag />}
                  </div>
                </td>
                <td>
                  {k.intent ? (
                    <span className="whitespace-nowrap text-[13px] text-[var(--q-text-3)]">{KEYWORD_INTENT_LABELS[k.intent]}</span>
                  ) : (
                    <Missing label="Intention non précisée" />
                  )}
                </td>
                <td className="q-num whitespace-nowrap">
                  <Num value={k.volume} missing="Volume non connu" />
                </td>
                <td className="q-num whitespace-nowrap">
                  <Num value={k.difficulty} missing="Difficulté non connue" />
                </td>
                <td className="q-num whitespace-nowrap">
                  <CpcValue cpc={k.cpc} currency={k.cpc_currency} />
                </td>
                <td className="q-num whitespace-nowrap">
                  <Num value={k.position} missing="Pas encore de position" format={fmtPosition} />
                </td>
                <td className="q-num whitespace-nowrap">
                  <Num value={k.impressions} missing="Pas d'impressions" />
                </td>
                <td className="q-num whitespace-nowrap">
                  <Num value={k.clicks} missing="Pas de clics" />
                </td>
                <td className="[overflow-wrap:anywhere]">
                  <TargetLabel target={target} />
                </td>
                <td>
                  <KeywordStatusPill status={k.status} />
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

function MobileMeasure({ label, value }: { label: string; value: React.ReactNode | null }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-[var(--q-text-4)]">{label}</dt>
      <dd className={cn("text-[15px] tabular-nums", value === null ? "font-medium text-[var(--q-text-4)]" : "font-semibold text-[var(--q-ink)]")}>
        {value === null ? <Missing label="non disponible" /> : value}
      </dd>
    </div>
  )
}

export function KeywordMobileList({ items }: { items: KeywordListItem[] }) {
  return (
    <ul className="q-list md:hidden">
      {items.map(({ row: k, quickWin, target, href, selected }) => (
        <li key={k.id}>
          <Link
            href={href}
            scroll={false}
            aria-current={selected ? "true" : undefined}
            className={cn("q-list-row !items-center !py-3.5", selected && "bg-[var(--q-wash)]")}
          >
            <div className="flex min-w-0 flex-1 flex-col gap-2">
              <div className="flex items-start justify-between gap-2">
                <span
                  className={cn(
                    "min-w-0 pt-0.5 font-mono text-sm font-medium leading-snug [overflow-wrap:anywhere]",
                    k.status === "ignored" ? "text-[var(--q-text-4)]" : "text-[var(--q-ink)]",
                  )}
                >
                  {k.keyword}
                  {selected && <OpenMark />}
                </span>
                <KeywordStatusPill status={k.status} className="shrink-0" />
              </div>
              {quickWin && (
                <div className="flex">
                  <QuickWinTag />
                </div>
              )}
              <dl className="grid grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,.8fr)] gap-1.5">
                <MobileMeasure label="Volume / mois" value={k.volume === null ? null : fmtCount(k.volume)} />
                <MobileMeasure label="Position" value={k.position === null ? null : fmtPosition(k.position)} />
                <MobileMeasure label="Impr." value={k.impressions === null ? null : fmtCount(k.impressions)} />
                <MobileMeasure label="Clics" value={k.clicks === null ? null : fmtCount(k.clicks)} />
              </dl>
              <p className="text-[13px] leading-snug text-[var(--q-text-3)]">
                <span className="text-[var(--q-text-4)]">Page cible :</span> <TargetLabel target={target} compact />
              </p>
            </div>
            <ChevronRight className="size-4 shrink-0 text-[var(--q-text-4)]" aria-hidden />
          </Link>
        </li>
      ))}
    </ul>
  )
}

function keywordsCount(n: number): string {
  return `${fmtCount(n)} mot${n > 1 ? "s" : ""}-clé${n > 1 ? "s" : ""}`
}

/** Pagination du tableau (ordinateur) : « 1 à 15 sur 63 mots-clés », Précédent / Suivant. */
export function KeywordPagination({
  from,
  to,
  total,
  prevHref,
  nextHref,
  className,
}: {
  from: number
  to: number
  total: number
  prevHref: string | null
  nextHref: string | null
  className?: string
}) {
  const nav = (href: string | null, children: React.ReactNode) =>
    href ? (
      <Link href={href} scroll={false} className="q-btn q-btn-secondary q-btn-sm min-h-11 md:min-h-0">
        {children}
      </Link>
    ) : (
      // Comme sur la planche : un bouton annoncé « désactivé » (aria-disabled n'a pas d'effet sur un élément générique).
      <button type="button" aria-disabled="true" className="q-btn q-btn-secondary q-btn-sm min-h-11 md:min-h-0">
        {children}
      </button>
    )
  return (
    <div className={cn("flex flex-wrap items-center justify-between gap-3 border-t border-[var(--q-line-soft)] px-4 py-3 md:px-5", className)}>
      <p className="flex flex-wrap gap-x-4 gap-y-0.5 text-[13px] text-[var(--q-text-4)]">
        <span className="tabular-nums">
          {total === 0 ? "0 mot-clé" : `${fmtCount(from)} à ${fmtCount(to)} sur ${keywordsCount(total)}`}
        </span>
        <span>«&nbsp;—&nbsp;»&nbsp;: valeur pas encore connue</span>
      </p>
      {(prevHref || nextHref) && (
        <div className="flex items-center gap-2">
          {nav(
            prevHref,
            <>
              <ChevronLeft aria-hidden />
              Précédent
            </>,
          )}
          {nav(
            nextHref,
            <>
              Suivant
              <ChevronRight aria-hidden />
            </>,
          )}
        </div>
      )}
    </div>
  )
}

/** Téléphone : « 8 mots-clés sur 63 » et « Afficher plus » (8 de plus, par l'adresse). */
export function KeywordMobileMore({ shown, total, moreHref, className }: { shown: number; total: number; moreHref: string | null; className?: string }) {
  return (
    <div className={cn("flex min-h-14 items-center justify-between gap-3 border-t border-[var(--q-line-soft)] pl-4 pr-3", className)}>
      <span className="text-[13px] tabular-nums text-[var(--q-text-4)]">
        {shown < total ? `${keywordsCount(shown)} sur ${fmtCount(total)}` : keywordsCount(total)}
      </span>
      {moreHref && (
        <Link href={moreHref} scroll={false} className="inline-flex h-11 items-center gap-1.5 px-1 text-sm font-semibold text-[var(--q-accent-strong)]">
          Afficher plus
          <ChevronDown className="size-4" aria-hidden />
        </Link>
      )}
    </div>
  )
}
