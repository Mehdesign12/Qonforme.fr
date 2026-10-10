/**
 * Les trois cartes du bas de la Vue d'ensemble (planche « Vue d'ensemble ») :
 * Priorités (constats ouverts), Articles (dernier publié, prochains sujets),
 * Visibilité IA (dernier relevé). Composants serveur ; chaque carte affiche
 * son propre échec de lecture sans bloquer les autres.
 */
import Link from "next/link"
import { CalendarDays, Check, ChevronRight } from "lucide-react"
import { StatusPill } from "@/components/app/kit"
import { fmtDate } from "@/components/admin/ui"
import { FailureState } from "@/components/admin/seo/SeoStates"
import { Val } from "@/components/admin/seo/performance/Value"
import { cn } from "@/lib/utils"
import type { Loaded } from "@/lib/seo/db"
import { fmtCount, fmtRate } from "@/lib/seo/format"
import { ARTICLE_STATUS, ARTICLE_TYPE_LABELS, SEVERITY, type GeoEngine } from "@/lib/seo/types"
import {
  ARTICLE_ORIGIN_LABELS,
  type GeoSnapshot,
  type PriorityItem,
  type RecentArticle,
  type UpcomingTopic,
} from "@/lib/seo/overview"
import { parisDayOf, todayInParis } from "@/lib/utils/paris-date"

function Card({
  id,
  title,
  footer,
  children,
}: {
  id: string
  title: string
  footer: { href: string; label: string }
  children: React.ReactNode
}) {
  return (
    <section aria-labelledby={id} className="q-card flex flex-col overflow-hidden">
      <div className="px-4 pb-2 pt-4 md:px-5">
        <h2 id={id} className="q-h2">{title}</h2>
      </div>
      <div className="flex flex-1 flex-col">{children}</div>
      <div className="flex min-h-12 items-center border-t border-[var(--q-line-soft)] px-4 md:px-5">
        <Link href={footer.href} className="q-link inline-flex min-h-11 items-center gap-1.5 text-sm">
          {footer.label}
          <ChevronRight className="size-4" aria-hidden />
        </Link>
      </div>
    </section>
  )
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="px-4 py-6 text-sm text-[var(--q-text-4)] md:px-5">{children}</p>
}

/** « 21:19 », heure de Paris. */
function timeOf(iso: string): string {
  return new Date(iso).toLocaleTimeString("fr-FR", { timeZone: "Europe/Paris", hour: "2-digit", minute: "2-digit" })
}

/** « à 21:19 » aujourd'hui, « 7 oct. à 21:19 » sinon. */
function whenOf(iso: string, now: Date): string {
  const sameDay = parisDayOf(iso) === todayInParis(now)
  return sameDay ? `à ${timeOf(iso)}` : `${fmtDate(iso, { day: "numeric", month: "short" })} à ${timeOf(iso)}`
}

/* ------------------------------------------------------------------ */
/* Priorités                                                           */
/* ------------------------------------------------------------------ */

export function PrioritiesCard({ data }: { data: Loaded<{ items: PriorityItem[]; total: number }> }) {
  const total = data.ok ? data.data.total : null
  return (
    <Card id="t-prio" title="Priorités" footer={{ href: "/admin/seo/actions", label: total === null ? "Toutes les actions" : `Toutes les actions (${fmtCount(total)})` }}>
      {!data.ok ? (
        <FailureState bare failure={data.failure} what="les actions SEO" retryHref="/admin/seo" />
      ) : data.data.items.length === 0 ? (
        <Empty>Aucune action à faire pour le moment.</Empty>
      ) : (
        <ul className="flex flex-1 flex-col px-4 md:px-5">
          {data.data.items.map((f, i) => {
            const sev = SEVERITY[f.severity] ?? SEVERITY.medium
            return (
              <li key={f.id} className={cn("flex flex-1 items-center gap-3 py-3", i > 0 && "border-t border-[var(--q-line-soft)]")}>
                <div className="flex min-w-0 flex-1 flex-col gap-[7px]">
                  <span className="text-sm font-semibold leading-snug text-[var(--q-ink)]">{f.title}</span>
                  <span className="flex min-w-0 items-center gap-2">
                    <StatusPill tone={sev.tone}>
                      <span className="sr-only">Gravité : </span>
                      {sev.label}
                    </StatusPill>
                    <span className="min-w-0 truncate font-mono text-[13px] text-[var(--q-text-4)]">{f.path}</span>
                  </span>
                </div>
                <Link
                  href={`/admin/seo/actions?constat=${encodeURIComponent(f.id)}`}
                  aria-label={`Voir : ${f.title}, ${f.path}`}
                  className="q-link inline-flex min-h-11 shrink-0 items-center gap-0.5 text-sm"
                >
                  Voir
                  <ChevronRight className="size-4" aria-hidden />
                </Link>
              </li>
            )
          })}
        </ul>
      )}
    </Card>
  )
}

/* ------------------------------------------------------------------ */
/* Articles                                                            */
/* ------------------------------------------------------------------ */

export function ArticlesCard({
  data,
  now = new Date(),
}: {
  data: Loaded<{ lastPublished: RecentArticle | null; upcoming: UpcomingTopic[] }>
  now?: Date
}) {
  return (
    <Card id="t-art" title="Articles" footer={{ href: "/admin/seo/articles", label: "Ouvrir le calendrier" }}>
      {!data.ok ? (
        <FailureState bare failure={data.failure} what="les articles" retryHref="/admin/seo" />
      ) : (
        <div className="flex flex-1 flex-col gap-3.5 px-4 pb-4 pt-1 md:px-5">
          <ArticlePublished article={data.data.lastPublished} now={now} />
          <div className="flex flex-1 flex-col gap-0.5">
            <h3 className="mb-1 text-[13px] font-semibold text-[var(--q-text-3)]">À venir</h3>
            {data.data.upcoming.length === 0 ? (
              <p className="border-t border-[var(--q-line-soft)] pt-2.5 text-sm text-[var(--q-text-4)]">Aucun sujet planifié.</p>
            ) : (
              <ul className="flex flex-1 flex-col">
                {data.data.upcoming.map((t) => (
                  <li key={t.id} className="flex flex-1 flex-col justify-center gap-1.5 border-t border-[var(--q-line-soft)] py-2.5">
                    <span className="text-sm font-medium leading-snug text-[var(--q-ink)]">{t.title}</span>
                    <span className="flex flex-wrap items-center gap-2">
                      {t.scheduledAt && (
                        <span className="inline-flex items-center gap-1.5 text-[13px] tabular-nums text-[var(--q-text-4)]">
                          <CalendarDays className="size-3.5" aria-hidden />
                          {fmtDate(t.scheduledAt, { day: "numeric", month: "short" })} à {timeOf(t.scheduledAt)}
                        </span>
                      )}
                      {t.articleType && <span className="q-tag">{ARTICLE_TYPE_LABELS[t.articleType]}</span>}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </Card>
  )
}

function ArticlePublished({ article, now }: { article: RecentArticle | null; now: Date }) {
  if (!article) {
    return (
      <div className="flex flex-col gap-2">
        <h3 className="text-[13px] font-semibold text-[var(--q-text-3)]">Publié récemment</h3>
        <p className="text-sm text-[var(--q-text-4)]">Aucun article publié pour le moment.</p>
      </div>
    )
  }
  const today = article.publishedAt !== null && parisDayOf(article.publishedAt) === todayInParis(now)
  return (
    <div className="flex flex-col gap-2">
      <h3 className="text-[13px] font-semibold text-[var(--q-text-3)]">{today ? "Publié aujourd'hui" : "Publié récemment"}</h3>
      <div className="q-inset flex flex-col gap-2.5 p-3.5">
        <Link href="/admin/seo/articles/liste" className="text-sm font-semibold leading-snug text-[var(--q-ink)] hover:text-[var(--q-accent-strong)]">
          {article.title}
        </Link>
        <div className="flex flex-wrap items-center gap-2">
          <StatusPill tone={ARTICLE_STATUS.published.tone} icon={<Check strokeWidth={2.75} aria-hidden />}>
            {ARTICLE_STATUS.published.label}
          </StatusPill>
          {article.publishedAt && <span className="text-[13px] tabular-nums text-[var(--q-text-4)]">{whenOf(article.publishedAt, now)}</span>}
          {article.articleType && <span className="q-tag">{ARTICLE_TYPE_LABELS[article.articleType]}</span>}
          <span className="q-tag">
            <span className="sr-only">Source : </span>
            {ARTICLE_ORIGIN_LABELS[article.origin]}
          </span>
        </div>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Visibilité IA                                                       */
/* ------------------------------------------------------------------ */

const ENGINE_INITIALS: Record<GeoEngine, string> = {
  gemini: "GE",
  chatgpt: "CH",
  perplexity: "PE",
  claude: "CL",
  google_ai_overview: "AG",
}

export function VisibilityCard({ data }: { data: Loaded<GeoSnapshot | null> }) {
  return (
    <Card id="t-ia" title="Visibilité IA" footer={{ href: "/admin/seo/visibilite-ia", label: "Voir le détail" }}>
      {!data.ok ? (
        <FailureState bare failure={data.failure} what="les relevés de visibilité IA" retryHref="/admin/seo" />
      ) : !data.data ? (
        <Empty>Aucun relevé pour le moment : le premier relevé mensuel remplira cette carte.</Empty>
      ) : (
        <div className="flex flex-1 flex-col gap-3 px-4 pb-4 pt-1 md:px-5">
          <div className="flex items-end gap-3">
            <span className="q-display text-[44px] leading-none tabular-nums text-[var(--q-ink)]"><Val text={fmtRate(data.data.mentionRate)} missing="taux de mention non disponible" /></span>
            <span className="flex flex-col gap-px pb-[3px] text-[13px] leading-snug text-[var(--q-text-4)]">
              <span className="font-semibold text-[var(--q-text-2)]">
                {data.data.engineCount > 1 ? `Visibilité moyenne des ${data.data.engineCount} moteurs` : "Taux de mention"}
              </span>
              <span>
                Relevé du {fmtDate(data.data.date)}
                {data.data.imported ? " · importé de PushRank" : ""}
              </span>
            </span>
          </div>
          <h3 className="text-[13px] font-semibold text-[var(--q-text-3)]">Mentions par moteur</h3>
          <ul className="flex flex-1 flex-col">
            {data.data.engines.map((e) => (
              <li key={e.key} className="flex min-h-10 flex-1 items-center gap-2.5 border-t border-[var(--q-line-soft)]">
                <span aria-hidden className="q-avatar size-7 text-[11px]">{ENGINE_INITIALS[e.key]}</span>
                <span className="min-w-0 flex-1 text-sm text-[var(--q-ink)]">{e.label}</span>
                <span aria-hidden className="h-1.5 w-16 shrink-0 overflow-hidden rounded-full bg-[var(--q-line-soft)]">
                  <span className="block h-full rounded-full bg-[var(--q-accent)]" style={{ width: `${Math.round((e.rate ?? 0) * 100)}%` }} />
                </span>
                <span className="w-[52px] shrink-0 whitespace-nowrap text-right text-[13px] font-semibold tabular-nums text-[var(--q-ink)]">
                  {e.mentions !== null && e.answers !== null ? (
                    <>
                      {e.mentions}&nbsp;/&nbsp;{e.answers}
                      <span className="sr-only"> mentions</span>
                    </>
                  ) : (
                    <>
                      <span aria-hidden>—</span>
                      <span className="sr-only">{e.noAnswer ? "aucune réponse obtenue dans ce relevé" : "non suivi dans ce relevé"}</span>
                    </>
                  )}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Card>
  )
}
