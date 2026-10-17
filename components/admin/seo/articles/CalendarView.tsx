"use client"

/**
 * Articles › Calendrier (planches Articles-calendrier et Mobile-articles) :
 * barre du mois (précédent, suivant, statut, aujourd'hui), grille du lundi au
 * dimanche sur ordinateur, agenda par semaine sur téléphone, cartes
 * d'événement (type, titre, statut, heure de Paris), légende des statuts.
 * Un article ouvre sa fenêtre (performances, mots-clés, qualité, actions :
 * ArticleDetailsDialog) ; un sujet ouvre la sienne.
 * ?planifier=1 ouvre « Planifier un sujet ».
 *
 * « + » sur aujourd'hui et chaque jour à venir (jamais dans le passé) : un
 * seul menu pour tout le calendrier (déclencheurs détachés de Base UI, le jour
 * passe en « payload ») : « Écrire un article » (éditeur, publication
 * programmée ce jour-là à l'heure des Préférences), « Planifier un sujet »,
 * « Générer avec l'IA ». Sur ordinateur, le « + » apparaît au survol ou au
 * clavier, toujours sur écran tactile ; une case vide à venir montre en plus,
 * au survol, une zone « Ajouter ». Sur téléphone : « Ajouter un article cette
 * semaine » dans une semaine vide (ou, en plus petit, sous des articles déjà
 * passés), « + » à côté de chaque jour à venir. Le menu compte les articles
 * du jour sans le filtre de statut et se ferme sur un jour devenu passé
 * (page restée ouverte depuis la veille).
 */
import { useMemo, useState } from "react"
import Link from "next/link"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { Menu } from "@base-ui/react/menu"
import { CalendarPlus, ChevronLeft, ChevronRight, Funnel, PenLine, Plus, Sparkles, TriangleAlert } from "lucide-react"
import { cn } from "@/lib/utils"
import type { ArticleDisplayStatus } from "@/lib/seo/types"
import type { CalendarData, CalendarEvent, GenerateOptions, TopicLite } from "@/lib/seo/articles/data"
import { parisDayTime, parisInstant, shortDay, weekLabel, weekdayDay, WEEKDAY_LABELS } from "@/lib/seo/articles/schedule"
import { addDays, todayInParis } from "@/lib/utils/paris-date"
import { DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator } from "@/components/ui/dropdown-menu"
import { ArticleStatusPill, LEGEND, Tag, TypeTag } from "@/components/admin/seo/articles/pills"
import { PlanTopicDialog, TopicDialog } from "@/components/admin/seo/articles/TopicDialogs"
import { GenerateDialog } from "@/components/admin/seo/articles/GenerateDialog"
import { ArticleDetailsDialog, longDay } from "@/components/admin/seo/articles/ArticleDetailsDialog"

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

/** Ouvre la fenêtre d'un article ou d'un sujet. */
interface EventOpeners {
  onTopic: (t: TopicLite) => void
  onPost: (id: string) => void
}

function openEvent(event: CalendarEvent, { onTopic, onPost }: EventOpeners) {
  if (event.kind === "post") onPost(event.id)
  else if (event.topic) onTopic(event.topic)
}

function EventCard({ event, ...openers }: { event: CalendarEvent } & EventOpeners) {
  return (
    <button type="button" onClick={() => openEvent(event, openers)} aria-haspopup="dialog" className={CARD}>
      <EventInner event={event} compact />
    </button>
  )
}

function AgendaCard({ event, ...openers }: { event: CalendarEvent } & EventOpeners) {
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
  const cls =
    "flex w-full flex-col gap-2.5 rounded-2xl border border-[var(--q-line)] bg-[var(--q-surface)] px-4 py-3.5 text-left [box-shadow:var(--q-shadow-card)] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[var(--q-focus)]"
  return (
    <button type="button" onClick={() => openEvent(event, openers)} aria-haspopup="dialog" className={cls}>
      {inner}
    </button>
  )
}

/* ------------------------------------------------------------------ */
/* Ajouter un article un jour donné                                    */
/* ------------------------------------------------------------------ */

const pad = (n: number) => String(n).padStart(2, "0")

/**
 * Jour et heure de publication proposés pour un jour du calendrier : l'heure
 * des Préférences ; aujourd'hui, si elle est passée (ou dans moins de 30
 * minutes), le prochain quart d'heure à 30 minutes au moins ; trop tard
 * aujourd'hui (après 23:45), le lendemain à l'heure des Préférences.
 * « Aujourd'hui » se lit à l'horloge (`now`) quand la page date de la veille.
 */
export function plannedSlot(day: string, today: string, time: string, now: Date): { day: string; time: string; shifted: boolean } {
  const clock = todayInParis(now)
  const current = clock > today ? clock : today
  if (day !== current || parisInstant(day, time).getTime() > now.getTime() + 30 * 60_000) return { day, time, shifted: false }
  const [h, m] = parisDayTime(now).time.split(":").map(Number)
  const minutes = Math.ceil((h * 60 + m + 30) / 15) * 15
  if (minutes > 23 * 60 + 45) return { day: addDays(day, 1), time, shifted: true }
  return { day, time: `${pad(Math.floor(minutes / 60))}:${pad(minutes % 60)}`, shifted: true }
}

/**
 * Jour passé à l'horloge alors que la page l'affichait encore à venir (page
 * restée ouverte depuis la veille) : plus rien à y ajouter.
 */
export function isPastDay(day: string, now: Date): boolean {
  return day < todayInParis(now)
}

/** « 1 article déjà prévu ce jour », « 2 articles déjà prévus ce jour ». */
export function alreadyPlannedLabel(count: number): string | null {
  if (count <= 0) return null
  return count > 1 ? `${count} articles déjà prévus ce jour` : "1 article déjà prévu ce jour"
}

type AddHandle = Menu.Handle<string>

function MenuEntry({ icon, title, hint }: { icon: React.ReactNode; title: string; hint: string }) {
  return (
    <>
      <span aria-hidden className="grid size-8 shrink-0 place-items-center rounded-lg bg-[var(--q-wash)] text-[var(--q-accent-strong)] [&_svg]:!size-4">
        {icon}
      </span>
      <span className="flex min-w-0 flex-col gap-0.5">
        <span className="text-sm font-semibold leading-tight text-[var(--q-ink)]">{title}</span>
        <span className="text-[12px] font-normal leading-snug text-[var(--q-text-4)]">{hint}</span>
      </span>
    </>
  )
}

/** Contenu du menu « + » d'un jour (calculé à l'ouverture : l'heure proposée dépend de l'heure qu'il est). */
function AddMenuContent({
  day,
  today,
  publishTime,
  count,
  canGenerate,
  onWrite,
  onPlan,
  onGenerate,
}: {
  day: string
  today: string
  publishTime: string
  count: number
  canGenerate: boolean
  onWrite: (day: string) => void
  onPlan: (slot: { day: string; time: string }) => void
  onGenerate: (slot: { day: string; time: string }) => void
}) {
  const now = new Date()
  const header = longDay(day, { capitalize: true })
  const menuClass = "w-[min(300px,calc(100vw-2rem))] [box-shadow:var(--q-shadow-pop)]"
  const labelClass = "flex flex-col gap-1 px-2.5 pb-2 pt-1.5 text-[13px] font-semibold text-[var(--q-ink)]"
  // Page ouverte depuis la veille : le jour est passé, rien ne s'y programme plus
  if (isPastDay(day, now)) {
    return (
      <DropdownMenuContent align="end" sideOffset={6} className={menuClass}>
        <DropdownMenuGroup>
          <DropdownMenuLabel className={labelClass}>
            {header}
            <span className="text-[12px] font-normal leading-snug text-[var(--q-text-3)]">Ce jour est passé. Actualisez la page pour voir le calendrier à jour.</span>
          </DropdownMenuLabel>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    )
  }
  const slot = plannedSlot(day, today, publishTime, now)
  const already = alreadyPlannedLabel(count)
  const isToday = day === todayInParis(now)
  // L'éditeur publie à l'heure des Préférences : passée aujourd'hui, l'heure se choisit dans l'éditeur
  const writeHint = slot.shifted ? "Programmé aujourd'hui, heure à choisir dans l'éditeur" : `Programmé à ${publishTime}`
  const when = slot.day === day ? `à ${slot.time}` : `demain à ${slot.time}`
  // Un sujet est rédigé dans les 24 heures qui précèdent sa parution (tâche planifiée) : le jour même, dès le prochain passage
  const planHint = slot.day === day && isToday ? `Parution ${when}, rédigé avant la parution` : `Parution ${when}, rédigé la veille`
  return (
    <DropdownMenuContent align="end" sideOffset={6} className={menuClass}>
      <DropdownMenuGroup>
        <DropdownMenuLabel className={labelClass}>
          {header}
          {already && (
            <span className="flex items-center gap-1.5 text-[12px] font-medium text-[var(--q-warn)]">
              <TriangleAlert className="size-3.5 shrink-0" aria-hidden />
              {already}
            </span>
          )}
        </DropdownMenuLabel>
        <DropdownMenuSeparator className="mx-0 my-1 bg-[var(--q-line-soft)]" />
        <DropdownMenuItem onClick={() => onWrite(slot.day)} className="items-start py-2.5">
          <MenuEntry icon={<PenLine />} title="Écrire un article" hint={slot.day === day ? writeHint : `Programmé demain à ${publishTime}`} />
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => onPlan(slot)} className="items-start py-2.5">
          <MenuEntry icon={<CalendarPlus />} title="Planifier un sujet" hint={planHint} />
        </DropdownMenuItem>
        {canGenerate && (
          <DropdownMenuItem onClick={() => onGenerate(slot)} className="items-start py-2.5">
            <MenuEntry icon={<Sparkles />} title="Générer avec l'IA" hint={`Rédigé maintenant, publié ${when}`} />
          </DropdownMenuItem>
        )}
      </DropdownMenuGroup>
    </DropdownMenuContent>
  )
}

/** « + » d'un jour de la grille (coin haut-droit de la case). */
function AddDayButton({ handle, day }: { handle: AddHandle; day: string }) {
  return (
    <Menu.Trigger
      handle={handle}
      payload={day}
      id={`ajout-${day}`}
      aria-label={`Ajouter un article le ${longDay(day)}`}
      title="Ajouter un article"
      className={cn(
        "q-btn q-btn-ghost q-btn-icon absolute right-1 top-1 z-[1] !size-7 !rounded-lg !text-[var(--q-text-3)] hover:!bg-[var(--q-surface)] hover:!text-[var(--q-accent-strong)] hover:shadow-[0_1px_2px_rgba(10,17,34,.08)]",
        // Écran tactile (tablette) : zone de toucher de 44 px autour du bouton de 28 px
        "[@media(hover:none)]:before:absolute [@media(hover:none)]:before:-inset-2 [@media(hover:none)]:before:content-['']",
        "opacity-0 transition-opacity duration-100 motion-reduce:transition-none",
        "focus-visible:opacity-100 group-focus-within:opacity-100 group-hover:opacity-100 data-[popup-open]:opacity-100 data-[popup-open]:!bg-[var(--q-surface)] data-[popup-open]:!text-[var(--q-accent-strong)] [@media(hover:none)]:opacity-100",
      )}
    >
      <Plus aria-hidden />
    </Menu.Trigger>
  )
}

/** Zone « Ajouter » d'une case vide à venir (survol seulement ; le « + » reste le chemin du clavier). */
function AddZone({ handle, day, today = false }: { handle: AddHandle; day: string; today?: boolean }) {
  return (
    <Menu.Trigger
      handle={handle}
      payload={day}
      tabIndex={-1}
      aria-hidden
      className={cn(
        "absolute inset-x-1.5 bottom-1.5 top-9 flex cursor-pointer items-center justify-center gap-1.5 rounded-lg border border-dashed text-[12.5px] font-semibold text-[var(--q-accent-strong)]",
        // Filet pointillé à l'accent atténué ; aujourd'hui, la case est déjà teintée : la zone se détache en blanc
        "border-[color-mix(in_srgb,var(--q-accent)_38%,transparent)]",
        today ? "bg-[var(--q-surface)]" : "bg-[var(--q-wash)]",
        "opacity-0 transition-opacity duration-100 group-hover:opacity-100 data-[popup-open]:opacity-100 motion-reduce:transition-none [@media(hover:none)]:hidden",
      )}
    >
      <Plus className="size-3.5" aria-hidden />
      Ajouter
    </Menu.Trigger>
  )
}

/**
 * Téléphone : « Ajouter un article cette semaine » (premier jour libre à
 * partir d'aujourd'hui). Semaine vide : grand bouton ; semaine dont les
 * articles sont déjà passés : version compacte sous la liste.
 */
function AddWeekButton({ handle, day, compact = false }: { handle: AddHandle; day: string; compact?: boolean }) {
  return (
    <Menu.Trigger
      handle={handle}
      payload={day}
      className={cn(
        "flex w-full items-center gap-3 rounded-2xl border border-dashed border-[var(--q-line)] px-4 text-left transition-colors duration-100 hover:border-[var(--q-accent)] hover:bg-[var(--q-wash)] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[var(--q-focus)] data-[popup-open]:border-[var(--q-accent)] data-[popup-open]:bg-[var(--q-wash)] motion-reduce:transition-none",
        compact ? "min-h-[52px] py-2.5" : "min-h-[64px] py-3",
      )}
    >
      <span aria-hidden className={cn("grid shrink-0 place-items-center rounded-full bg-[var(--q-wash)] text-[var(--q-accent-strong)]", compact ? "size-8" : "size-9")}>
        <Plus className="size-4" />
      </span>
      <span className="flex min-w-0 flex-col gap-0.5">
        <span className={cn("font-semibold leading-tight text-[var(--q-ink)]", compact ? "text-sm" : "text-[15px]")}>Ajouter un article cette semaine</span>
        <span className="text-[13px] text-[var(--q-text-4)]">{compact ? `À partir du ${longDay(day)}` : "Aucun article prévu."}</span>
      </span>
    </Menu.Trigger>
  )
}

export function CalendarView({
  data,
  filter,
  generate = null,
}: {
  data: CalendarData
  filter: ArticleDisplayStatus | null
  /**
   * Fenêtre « Générer un article » ; null : ses données n'ont pas pu être lues (entrée masquée).
   * Ses sujets sont ceux du calendrier encore à planifier (pas ceux en échec) : la page ne les envoie qu'une fois.
   */
  generate?: GenerateOptions | null
}) {
  const router = useRouter()
  const pathname = usePathname()
  const params = useSearchParams()
  const planOpen = params.get("planifier") === "1"
  const [topic, setTopic] = useState<TopicLite | null>(null)
  const [postId, setPostId] = useState<string | null>(null)
  // Fenêtres ouvertes depuis le « + » d'un jour : jour et heure proposés
  const [planSlot, setPlanSlot] = useState<{ day: string; time: string } | null>(null)
  const [generateSlot, setGenerateSlot] = useState<{ day: string; time: string } | null>(null)
  // Un seul menu « + » pour tout le calendrier : chaque jour est un déclencheur détaché
  const [addMenu] = useState(() => Menu.createHandle<string>())
  const publishTime = data.publishTime ?? "08:00"
  const openers: EventOpeners = { onTopic: setTopic, onPost: setPostId }
  // Jours déjà occupés, filtre de statut non appliqué (repli : événements affichés)
  const eventsOf = useMemo(() => new Map(data.weeks.flatMap((w) => w.days.map((d) => [d.day, data.dayCounts?.[d.day] ?? d.events.length] as const))), [data.weeks, data.dayCounts])

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
                        "group relative h-[150px] border-[var(--q-line-soft)] p-1.5 align-top",
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
                              <EventCard event={e} {...openers} />
                            </li>
                          ))}
                        </ul>
                      )}
                      {d.day >= data.today && (
                        <>
                          {d.events.length === 0 && <AddZone handle={addMenu} day={d.day} today={d.isToday} />}
                          <AddDayButton handle={addMenu} day={d.day} />
                        </>
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
            // Semaine vide qui n'est pas passée : on peut y ajouter un article (premier jour à partir d'aujourd'hui)
            const upcoming = week.days.filter((d) => d.day >= data.today)
            const addDay = upcoming[0]?.day ?? null
            // Articles tous passés, jours libres à venir : aucun « + » de jour ne serait affiché, d'où le bouton compact
            const freeDay = upcoming.some((d) => d.events.length > 0) ? null : (upcoming.find((d) => d.events.length === 0)?.day ?? null)
            return (
              <section key={week.monday} aria-labelledby={`sem-${week.monday}`} className="flex flex-col gap-2.5">
                <div className="flex items-baseline justify-between gap-2">
                  <h2 id={`sem-${week.monday}`} className="q-h2">
                    {weekLabel(week.monday)}
                  </h2>
                  {week.monday === todayWeek && <span className="whitespace-nowrap text-[13px] font-semibold text-[var(--q-accent-strong)]">Cette semaine</span>}
                </div>
                {days.length === 0 && addDay ? (
                  <AddWeekButton handle={addMenu} day={addDay} />
                ) : days.length === 0 ? (
                  <p className="flex min-h-[52px] items-center rounded-2xl border border-dashed border-[var(--q-line)] px-4 text-sm text-[var(--q-text-4)]">
                    {past ? "Aucun article." : "Aucun article prévu."}
                  </p>
                ) : (
                  <div className="flex flex-col gap-3.5">
                    {days.map((d) => (
                      <div key={d.day} className="flex flex-col gap-2">
                        <div className="flex items-center gap-2">
                          <h3 className="flex min-w-0 flex-1 items-center gap-2.5 text-sm font-semibold text-[var(--q-ink)]">
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
                          {d.day >= data.today && (
                            <Menu.Trigger
                              handle={addMenu}
                              payload={d.day}
                              aria-label={`Ajouter un article le ${longDay(d.day)}`}
                              className="group/add -my-2.5 grid size-11 shrink-0 place-items-center rounded-full focus-visible:outline-none"
                            >
                              <span
                                aria-hidden
                                className="grid size-7 place-items-center rounded-full border border-[var(--q-line)] bg-[var(--q-surface)] text-[var(--q-accent-strong)] shadow-[0_1px_2px_rgba(10,17,34,.06)] group-focus-visible/add:ring-4 group-focus-visible/add:ring-[var(--q-focus)] group-data-[popup-open]/add:border-[var(--q-accent)] group-data-[popup-open]/add:bg-[var(--q-wash)]"
                              >
                                <Plus className="size-3.5" />
                              </span>
                            </Menu.Trigger>
                          )}
                        </div>
                        <ul className="flex flex-col gap-2">
                          {d.events.map((e) => (
                            <li key={e.key}>
                              <AgendaCard event={e} {...openers} />
                            </li>
                          ))}
                        </ul>
                      </div>
                    ))}
                    {freeDay && <AddWeekButton handle={addMenu} day={freeDay} compact />}
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

      <Menu.Root handle={addMenu}>
        {({ payload }: { payload: string | undefined }) =>
          payload ? (
            <AddMenuContent
              day={payload}
              today={data.today}
              publishTime={publishTime}
              count={eventsOf.get(payload) ?? 0}
              canGenerate={generate !== null}
              onWrite={(day) => router.push(`/admin/blog/new?programmer=${day}`)}
              onPlan={setPlanSlot}
              onGenerate={setGenerateSlot}
            />
          ) : null
        }
      </Menu.Root>

      <PlanTopicDialog
        open={planOpen || planSlot !== null}
        onClose={() => {
          setPlanSlot(null)
          if (planOpen) closePlan()
        }}
        topics={data.unplanned}
        slots={data.slots}
        defaultMode={data.defaultMode}
        initialDay={planSlot?.day ?? null}
        initialTime={planSlot?.time ?? null}
      />
      <TopicDialog topic={topic} onClose={() => setTopic(null)} slots={data.slots} coverImage={data.coverImage} inlineImages={data.inlineImages} />
      <ArticleDetailsDialog postId={postId} onClose={() => setPostId(null)} />
      {generate && (
        <GenerateDialog
          open={generateSlot !== null}
          onClose={() => setGenerateSlot(null)}
          data={{ ...generate, topics: data.unplanned.filter((t) => t.status === "unplanned") }}
          initialDay={generateSlot?.day ?? null}
          initialTime={generateSlot?.time ?? null}
        />
      )}
    </>
  )
}
