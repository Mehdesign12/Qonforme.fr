/**
 * Liste « Pages à améliorer » (planches Actions-seo et Mobile-actions) :
 * chemin et type de page, constat, explication chiffrée, gravité, source,
 * durée estimée. Chaque ligne ouvre le détail (`?constat=<id>`).
 * Tableau en grille sur ordinateur, lignes empilées sur téléphone. Composant serveur.
 */
import Link from "next/link"
import { ChevronRight } from "lucide-react"
import { StatusPill } from "@/components/app/kit"
import { fmtDate } from "@/components/admin/ui"
import { cn } from "@/lib/utils"
import type { FindingSeverity, FindingSource, FindingStatus, PageType } from "@/lib/seo/types"
import { VERDICTS, type Verdict } from "@/lib/seo/actions/verdict"
import { Duration, PageTypeTag, SeverityPill, SourceTag } from "@/components/admin/seo/actions/bits"

export interface FindingListItem {
  id: string
  href: string
  path: string
  pageType: PageType | null
  title: string
  explanation: string | null
  severity: FindingSeverity
  source: FindingSource
  effortMinutes: number | null
  status: FindingStatus
  doneAt: string | null
  ignoredAt: string | null
  verdict: Verdict | null
  hasSuggestion: boolean
}

const GRID = "md:grid md:grid-cols-[minmax(0,1fr)_92px_116px_76px_20px] md:items-center md:gap-x-4"

export function FindingsList({ items, label }: { items: FindingListItem[]; label: string }) {
  return (
    <div>
      <div aria-hidden className={cn("hidden border-b border-[var(--q-line-soft)] px-5 py-2.5 text-xs font-medium text-[var(--q-text-4)]", GRID)}>
        <span>Constat</span>
        <span>Gravité</span>
        <span>Source</span>
        <span>Durée</span>
        <span />
      </div>
      <ul className="m-0 list-none p-0" aria-label={label}>
        {items.map((f, i) => (
          <li key={f.id} className={cn(i > 0 && "border-t border-[var(--q-line-soft)]")}>
            <Link
              href={f.href}
              scroll={false}
              className={cn("flex min-h-[60px] items-center gap-3 px-4 py-4 text-[var(--q-ink)] transition-colors hover:bg-[var(--q-row-hover)] md:px-5", GRID)}
            >
              <div className="flex min-w-0 flex-1 flex-col gap-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="break-all font-mono text-[13px] font-medium">{f.path}</span>
                  <PageTypeTag type={f.pageType} />
                </div>
                <div className="flex flex-col gap-0.5">
                  <span className="text-sm font-semibold leading-snug md:text-[14px]">{f.title}</span>
                  {f.explanation && <span className="text-[13px] leading-snug text-[var(--q-text-4)]">{f.explanation}</span>}
                  {(f.status === "done" || f.status === "ignored") && (
                    <span className="flex flex-wrap items-center gap-2 pt-0.5 text-[13px] text-[var(--q-text-3)]">
                      {f.status === "done" ? `Fait le ${fmtDate(f.doneAt)}` : `Ignoré le ${fmtDate(f.ignoredAt)}`}
                      {f.verdict && <StatusPill tone={VERDICTS[f.verdict].tone}>{VERDICTS[f.verdict].label}</StatusPill>}
                    </span>
                  )}
                </div>
                {/* Téléphone : gravité et durée sous le constat */}
                <div className="flex flex-wrap items-center gap-3 pt-1 md:hidden">
                  <SeverityPill severity={f.severity} />
                  <Duration minutes={f.effortMinutes} />
                </div>
              </div>
              <span className="hidden md:flex">
                <SeverityPill severity={f.severity} />
              </span>
              <span className="hidden md:flex">
                <SourceTag source={f.source} />
              </span>
              <span className="hidden md:flex">
                <Duration minutes={f.effortMinutes} />
              </span>
              <ChevronRight className="size-5 shrink-0 text-[var(--q-text-4)]" strokeWidth={1.75} aria-hidden />
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}
