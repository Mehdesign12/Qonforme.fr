"use client"

/**
 * Articles › Calendrier (planches Articles-calendrier et Mobile-articles) :
 * barre du mois (précédent, suivant, statut, aujourd'hui), grille du lundi au
 * dimanche sur ordinateur, agenda par semaine sur téléphone, cartes
 * d'événement (type, titre, statut, heure de Paris), légende des statuts.
 * Un article ouvre sa fiche (/admin/blog/<id>) ; un sujet ouvre sa fenêtre.
 * ?planifier=1 ouvre « Planifier un sujet ».
 */
import { useMemo, useState } from "react"
import Link from "next/link"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { ChevronLeft, ChevronRight, Funnel } from "lucide-react"
import { cn } from "@/lib/utils"
import type { ArticleDisplayStatus } from "@/lib/seo/types"
import type { CalendarData, CalendarEvent, TopicLite } from "@/lib/seo/articles/data"
import { shortDay, weekLabel, weekdayDay, WEEKDAY_LABELS } from "@/lib/seo/articles/schedule"
import { ArticleStatusPill, LEGEND, Tag, TypeTag } from "@/components/admin/seo/articles/pills"
import { PlanTopicDialog, TopicDialog } from "@/components/admin/seo/articles/TopicDialogs"

const FILTERS: { value: ArticleDisplayStatus; label: string }[] = [
  { value: "published", label: "Publié" },
  { value: "scheduled", label: "Planifié" },
  { value: "draft", label: "Brouillon" },
  { value: "to_review", label: "À relire" },
  { value: "failed", label: "Échec" },
]

/** Premier jour affiché ou 1er du mois : avec le mois (« 28 sept. », « 1er oct. ») ; sinon le numéro. */
function dayNumber(day: string, first: boolean): string {
  const d = Number(day.slice(8))
  return d === 1 || first ? shortDay(day) : String(d)
}

function EventInner({ event, compact }: { event: CalendarEvent; compact?: boolean }) {
  return (
    <>
      {(event.type || event.sourceTag) && (
        <span className="flex flex-wrap gap-1">
          <TypeTag type={event.type} />
          {event.sourceTag && <Tag>{event.sourceTag}</Tag>}
        </span>
      )}
      <span className={cn("line-clamp-2 font-semibold leading-snug text-[var(--q-ink)]", compact ? "text-[13px]" : "text-base")}>{event.title}</span>
      <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <ArticleStatusPill status={event.status} />
        <time dateTime={`${event.day}T${event.time}`} className="text-xs font-medium tabular-nums text-[var(--q-text-3)]">
          {event.time}
        </time>
      </span>
    </>
  )
}

const CARD = "flex w-full flex-col gap-1.5 rounded-[10px] border border-[var(--q-line)] bg-[var(--q-surface)] p-[7px] text-left shadow-[0_1px_2px_rgba(10,17,34,.06)] hover:border-[var(--q-accent)] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[var(--q-focus)]"

function EventCard({ event, onTopic }: { event: CalendarEvent; onTopic: (t: TopicLite) => void }) {
  if (event.kind === "post" && event.href) {
    return (
      <Link href={event.href} className={CARD}>
        <EventInner event={event} compact />
      </Link>
    )
  }
  return (
    <button type="button" onClick={() => event.topic && onTopic(event.topic)} className={CARD}>
      <EventInner event={event} compact />
    </button>
  )
}

function AgendaCard({ event, onTopic }: { event: CalendarEvent; onTopic: (t: TopicLite) => void }) {
  const inner = (
    <>
      <span className="flex items-center justify-between gap-2">
        <span className="flex flex-wrap items-center gap-1.5">
          <TypeTag type={event.type} />
          {event.sourceTag && <Tag>{event.sourceTag}</Tag>}
        </span>
        <span className="flex items-center gap-2">
          <ArticleStatusPill status={event.status} />
          <time dateTime={`${event.day}T${event.time}`} className="text-[13px] tabular-nums text-[var(--q-text-4)]">
            {event.time}
          </time>
        </span>
      </span>
      <span className="flex items-start gap-2">
        <span className="line-clamp-2 min-w-0 flex-1 text-base font-semibold leading-snug text-[var(--q-ink)]">{event.title}</span>
        <ChevronRight className="mt-0.5 size-4 shrink-0 text-[var(--q-text-4)]" aria-hidden />
      </span>
      {event.keyword && (
        <span className="text-[13px] text-[var(--q-text-4)]">
          Mot-clé : <span className="font-mono text-[var(--q-text-2)]">{event.keyword}</span>
        </span>
      )}
    </>
  )
  const cls = "flex w-full flex-col gap-2.5 rounded-2xl border border-[var(--q-line)] bg-[var(--q-surface)] px-4 py-3.5 text-left shadow-[var(--q-shadow-card)]"
  if (event.kind === "post" && event.href) {
    return (
      <Link href={event.href} className={cls}>
        {inner}
      </Link>
    )
  }
  return (
    <button type="button" onClick={() => event.topic && onTopic(event.topic)} className={cls}>
      {inner}
    </button>
  )
}

export function CalendarView({ data, filter }: { data: CalendarData; filter: ArticleDisplayStatus | null }) {
  const router = useRouter()
  const pathname = usePathname()
  const params = useSearchParams()
  const planOpen = params.get("planifier") === "1"
  const [topic, setTopic] = useState<TopicLite | null>(null)

  const href = (next: Record<string, string | null>) => {
    const qs = new URLSearchParams(params.toString())
    qs.delete("planifier")
    for (const [k, v] of Object.entries(next)) {
      if (v) qs.set(k, v)
      else qs.delete(k)
    }
    const s = qs.toString()
    return s ? `${pathname}?${s}` : pathname
  }
  const setFilter = (value: string) => router.replace(href({ statut: value || null }), { scroll: false })
  const closePlan = () => router.replace(href({}), { scroll: false })

  const todayWeek = useMemo(() => data.weeks.find((w) => w.days.some((d) => d.isToday))?.monday ?? null, [data.weeks])
  const todayInGrid = todayWeek !== null
  const lastDay = data.weeks[data.weeks.length - 1].days[6].day

  const filterSelect = (mobile: boolean) => (
    <div className={cn("relative", mobile ? "min-w-0 flex-1" : "")}>
      <Funnel className="pointer-events-none absolute left-3 top-1/2 size-[15px] -translate-y-1/2 text-[var(--q-text-4)]" aria-hidden />
      <select
        aria-label="Filtrer par statut"
        value={filter ?? ""}
        onChange={(e) => setFilter(e.target.value)}
        className={cn(
          "q-input appearance-none pl-9 pr-8 font-semibold",
          mobile ? "!h-12" : "!h-[34px] !w-auto !rounded-[9px] text-base md:!text-[13px]",
        )}
      >
        <option value="">Tous les statuts</option>
        {FILTERS.map((f) => (
          <option key={f.value} value={f.value}>
            {f.label}
          </option>
        ))}
      </select>
      <ChevronRight className="pointer-events-none absolute right-2.5 top-1/2 size-3.5 -translate-y-1/2 rotate-90 text-[var(--q-text-4)]" aria-hidden />
    </div>
  )

  const legend = (
    <ul aria-label="Légende des statuts" className="flex flex-wrap items-center gap-2">
      {LEGEND.map((s) => (
        <li key={s}>
          <ArticleStatusPill status={s} />
        </li>
      ))}
    </ul>
  )

  return (
    <>
      {/* Ordinateur : grille du mois */}
      <section aria-labelledby="titre-calendrier" className="q-card hidden overflow-hidden md:block">
        <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="flex gap-1.5">
              <Link href={href({ mois: data.prev })} scroll={false} aria-label="Mois précédent" className="q-btn q-btn-secondary q-btn-sm q-btn-icon">
                <ChevronLeft aria-hidden />
              </Link>
              <Link href={href({ mois: data.next })} scroll={false} aria-label="Mois suivant" className="q-btn q-btn-secondary q-btn-sm q-btn-icon">
                <ChevronRight aria-hidden />
              </Link>
            </div>
            <h2 id="titre-calendrier" aria-live="polite" className="q-h2 tabular-nums">
              {data.label}
            </h2>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {filterSelect(false)}
            <Link href={href({ mois: null })} scroll={false} className="q-btn q-btn-secondary q-btn-sm">
              Aujourd&apos;hui
            </Link>
          </div>
        </div>

        <div className="relative overflow-x-auto border-t border-[var(--q-line-soft)]">
          <table className="w-full min-w-[840px] table-fixed border-separate border-spacing-0">
            <caption className="sr-only">
              Calendrier des articles, {data.label.toLowerCase()} : du {weekdayDay(data.weeks[0].days[0].day)} au {weekdayDay(lastDay)}
            </caption>
            <thead>
              <tr>
                {WEEKDAY_LABELS.map((d, i) => (
                  <th
                    key={d}
                    scope="col"
                    className={cn("border-b border-[var(--q-line-soft)] bg-[var(--q-surface)] px-3 py-2.5 text-left text-xs font-medium text-[var(--q-text-4)]", i < 6 && "border-r")}
                  >
                    {d}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.weeks.map((week, wi) => (
                <tr key={week.monday}>
                  {week.days.map((d, di) => (
                    <td
                      key={d.day}
                      className={cn(
                        "h-[150px] border-[var(--q-line-soft)] p-1.5 align-top",
                        di < 6 && "border-r",
                        wi < data.weeks.length - 1 && "border-b",
                        d.isToday ? "bg-[var(--q-wash)]" : d.inMonth ? "bg-[var(--q-surface)]" : "bg-[var(--q-surface-2)]",
                      )}
                    >
                      {d.isToday ? (
                        <time dateTime={d.day} aria-current="date" className="inline-grid size-6 place-items-center rounded-full bg-[var(--q-accent)] text-[13px] font-semibold tabular-nums text-white">
                          <span className="sr-only">Aujourd&apos;hui, </span>
                          {Number(d.day.slice(8))}
                        </time>
                      ) : (
                        <time
                          dateTime={d.day}
                          className={cn(
                            "inline-flex h-6 min-w-6 items-center justify-center px-1 text-[13px] tabular-nums",
                            !d.inMonth ? "font-medium text-[var(--q-text-4)]" : Number(d.day.slice(8)) === 1 ? "font-semibold text-[var(--q-ink)]" : "font-medium text-[var(--q-text-2)]",
                          )}
                        >
                          {dayNumber(d.day, wi === 0 && di === 0)}
                        </time>
                      )}
                      {d.events.length > 0 && (
                        <ul className="mt-1.5 flex flex-col gap-1.5">
                          {d.events.map((e) => (
                            <li key={e.key}>
                              <EventCard event={e} onTopic={setTopic} />
                            </li>
                          ))}
                        </ul>
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3 border-t border-[var(--q-line-soft)] px-5 py-3.5">
          <div className="flex flex-wrap items-center gap-2">
            <span className="mr-0.5 text-[13px] text-[var(--q-text-4)]">Statuts</span>
            {legend}
          </div>
          <p className="text-[13px] text-[var(--q-text-4)]">
            Heures de Paris.{" "}
            <Link href="/admin/seo/articles/liste" className="q-link">
              Voir les articles
            </Link>
          </p>
        </div>
      </section>

      {/* Téléphone : agenda par semaine */}
      <div className="flex flex-col gap-4 md:hidden">
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between gap-2">
            <Link href={href({ mois: data.prev })} scroll={false} aria-label="Mois précédent" className="q-btn q-btn-secondary q-btn-icon !size-12 !rounded-[14px]">
              <ChevronLeft aria-hidden />
            </Link>
            <div className="min-w-0 flex-1 text-center">
              <p aria-live="polite" className="q-display text-xl font-semibold tracking-[-0.02em] text-[var(--q-ink)]">
                {data.label}
              </p>
              <p className="mt-0.5 text-[13px] text-[var(--q-text-4)]">Agenda · {data.weeks.length} semaines</p>
            </div>
            <Link href={href({ mois: data.next })} scroll={false} aria-label="Mois suivant" className="q-btn q-btn-secondary q-btn-icon !size-12 !rounded-[14px]">
              <ChevronRight aria-hidden />
            </Link>
          </div>
          <div className="flex items-center gap-2">
            {filterSelect(true)}
            <Link href={href({ mois: null })} scroll={false} className="q-btn q-btn-secondary q-btn-lg">
              Aujourd&apos;hui
            </Link>
          </div>
        </div>

        <div className="flex flex-col gap-[22px]">
          {data.weeks.map((week) => {
            const days = week.days.filter((d) => d.events.length > 0)
            const past = todayInGrid ? week.monday < (todayWeek as string) : week.days[6].day < data.today
            return (
              <section key={week.monday} aria-labelledby={`sem-${week.monday}`} className="flex flex-col gap-2.5">
                <div className="flex items-baseline justify-between gap-2">
                  <h2 id={`sem-${week.monday}`} className="q-h2">
                    {weekLabel(week.monday)}
                  </h2>
                  {week.monday === todayWeek && <span className="whitespace-nowrap text-[13px] font-semibold text-[var(--q-accent-strong)]">Cette semaine</span>}
                </div>
                {days.length === 0 ? (
                  <p className="flex min-h-[52px] items-center rounded-2xl border border-dashed border-[var(--q-line)] px-4 text-sm text-[var(--q-text-4)]">
                    {past ? "Aucun article." : "Aucun article prévu."}
                  </p>
                ) : (
                  <div className="flex flex-col gap-3.5">
                    {days.map((d) => (
                      <div key={d.day} className="flex flex-col gap-2">
                        <h3 className="flex items-center gap-2.5 text-sm font-semibold text-[var(--q-ink)]">
                          <span aria-hidden className={cn("size-2.5 shrink-0 rounded-full", d.isToday ? "bg-[var(--q-accent)]" : "bg-[var(--q-field)]")} />
                          <span>
                            {weekdayDay(d.day)}
                            {d.isToday && (
                              <>
                                {" · "}
                                <span className="text-[var(--q-accent-strong)]">Aujourd&apos;hui</span>
                              </>
                            )}
                          </span>
                        </h3>
                        <ul className="flex flex-col gap-2">
                          {d.events.map((e) => (
                            <li key={e.key}>
                              <AgendaCard event={e} onTopic={setTopic} />
                            </li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            )
          })}
        </div>

        <section aria-labelledby="legende" className="q-card">
          <div className="px-4 pb-2 pt-4">
            <h2 id="legende" className="q-h2">
              Légende des statuts
            </h2>
          </div>
          <div className="flex flex-col gap-3 px-4 pb-4">
            {legend}
            <p className="text-[13px] text-[var(--q-text-4)]">Heures affichées à Paris.</p>
          </div>
        </section>
      </div>

      <PlanTopicDialog open={planOpen} onClose={closePlan} topics={data.unplanned} slots={data.slots} defaultMode={data.defaultMode} />
      <TopicDialog topic={topic} onClose={() => setTopic(null)} slots={data.slots} coverImage={data.coverImage} />
    </>
  )
}
