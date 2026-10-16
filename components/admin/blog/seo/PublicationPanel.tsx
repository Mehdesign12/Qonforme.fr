"use client"

/**
 * Publication d'un article dans l'éditeur : « Brouillon », « Publié » ou
 * « Programmé » (contrôle segmenté), puis ce que chaque choix veut dire.
 *
 * - Brouillon : visible seulement dans l'admin (l'article quitte le blog à
 *   l'enregistrement s'il y était).
 * - Publié : en ligne depuis le …, lien vers l'article ; ou « sera publié à
 *   l'enregistrement ». Le contrôle repasse sur le texte avant toute mise en
 *   ligne, article écrit à la main compris (POST /api/admin/blog et PATCH
 *   /api/admin/blog/<id> : même garde que « Publier maintenant »).
 * - Programmé : jour (aujourd'hui au plus tôt, heure de Paris) et heure
 *   (06:00 à 22:45, par quart d'heure), phrase de confirmation « Sera publié
 *   le jeudi 22 octobre 2026 à 08:00 (heure de Paris). », et ce que le
 *   contrôle retient à l'heure prévue (lib/seo/articles/publish.ts : un
 *   article programmé depuis l'éditeur part en mode « directement »).
 *
 * Le choix ne s'enregistre pas ici : `onChange` rend le mode, le jour et
 * l'heure ; l'éditeur les envoie avec « Enregistrer » (scheduledAtFromParis,
 * lib/seo/articles/editor-input.ts). `footer` accueille ce bouton.
 */
import { useId } from "react"
import { ArrowUpRight, CalendarClock, CircleAlert, Globe, Lock, ShieldCheck } from "lucide-react"
import { cn } from "@/lib/utils"
import { Select } from "@/components/admin/seo/articles/fields"
import { scheduleProblem } from "@/lib/seo/articles/editor-input"
import { parisDayTime } from "@/lib/seo/articles/schedule"
import { addDays, todayInParis } from "@/lib/utils/paris-date"

export type PublicationMode = "draft" | "publish" | "schedule"

export interface PublicationValue {
  mode: PublicationMode
  /** Jour de Paris (AAAA-MM-JJ) ; utile en mode « Programmé ». */
  day: string
  /** Heure de Paris (HH:MM). */
  time: string
}

/** Heures proposées : 06:00 à 22:45, par quart d'heure. */
export const PUBLISH_TIMES: string[] = Array.from({ length: (23 - 6) * 4 }, (_, i) => {
  const minutes = 6 * 60 + i * 15
  return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`
})

const LONG_DAY = new Intl.DateTimeFormat("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "UTC" })

/** « jeudi 22 octobre 2026 », « mercredi 1er octobre 2026 ». */
export function longDay(day: string): string {
  const [y, m, d] = day.split("-").map(Number)
  if (!y || !m || !d) return day
  return LONG_DAY.format(new Date(Date.UTC(y, m - 1, d, 12))).replace(/(^|\s)1(\s)/, "$11er$2")
}

/** Jour par défaut d'une programmation : demain (l'heure du jour est peut-être passée). */
export function defaultScheduleDay(now: Date = new Date()): string {
  return addDays(todayInParis(now), 1)
}

const MODES: { value: PublicationMode; label: string }[] = [
  { value: "draft", label: "Brouillon" },
  { value: "publish", label: "Publié" },
  { value: "schedule", label: "Programmé" },
]

function Note({ icon, tone = "muted", children }: { icon: React.ReactNode; tone?: "muted" | "ok" | "warn"; children: React.ReactNode }) {
  return (
    <p
      className={cn(
        "m-0 flex items-start gap-2 text-[12.5px] leading-snug [&>svg]:mt-px [&>svg]:size-4 [&>svg]:shrink-0",
        tone === "ok" ? "text-[var(--q-ok)]" : tone === "warn" ? "text-[var(--q-warn)]" : "text-[var(--q-text-3)]",
      )}
    >
      {icon}
      <span className="min-w-0">{children}</span>
    </p>
  )
}

export function PublicationPanel({
  mode,
  day,
  time,
  onChange,
  isPublished,
  publishedAt,
  slug,
  defaultTime = "08:00",
  footer,
  idPrefix,
  className,
}: {
  mode: PublicationMode
  day: string
  time: string
  onChange: (next: PublicationValue) => void
  /** État enregistré : l'article est en ligne. */
  isPublished: boolean
  publishedAt: string | null
  slug: string
  /** Heure des Préférences (programmation sans heure choisie). */
  defaultTime?: string
  /** Bouton « Enregistrer » (pleine largeur) ou autre action. */
  footer?: React.ReactNode
  idPrefix?: string
  className?: string
}) {
  const uid = useId()
  const prefix = idPrefix ?? uid
  const today = todayInParis()
  const problem = mode === "schedule" ? scheduleProblem(day, time) : null
  // Champ en cause : le jour ou l'heure s'il manque, sinon les deux (date passée, trop lointaine ou inexistante)
  const dayInvalid = problem !== null && (!day || Boolean(time))
  const timeInvalid = problem !== null && Boolean(day)
  const times = time && !PUBLISH_TIMES.includes(time) ? [...PUBLISH_TIMES, time].sort() : PUBLISH_TIMES
  const online = isPublished && publishedAt ? parisDayTime(publishedAt) : null
  const articleUrl = slug.trim() ? `/blog/${slug.trim()}` : null

  const select = (next: PublicationMode) => {
    if (next === "schedule") {
      onChange({ mode: next, day: day && day >= today ? day : defaultScheduleDay(), time: time || defaultTime })
    } else {
      onChange({ mode: next, day, time })
    }
  }

  return (
    <div className={cn("flex flex-col gap-3.5", className)}>
      <div className="q-seg grid w-full grid-cols-3" role="group" aria-label="Publication de l'article">
        {MODES.map((m) => (
          <button key={m.value} type="button" aria-pressed={mode === m.value} onClick={() => select(m.value)} className="max-md:!h-11">
            {m.label}
          </button>
        ))}
      </div>

      {mode === "draft" && (
        <div className="flex flex-col gap-2">
          <Note icon={<Lock aria-hidden />}>Visible seulement ici.</Note>
          {isPublished && <Note icon={<CircleAlert aria-hidden />} tone="warn">L&apos;article quittera le blog à l&apos;enregistrement.</Note>}
        </div>
      )}

      {mode === "publish" &&
        (isPublished ? (
          <div className="flex flex-col gap-2.5">
            <Note icon={<Globe aria-hidden />} tone="ok">
              En ligne depuis le {online ? `${longDay(online.day)} à ${online.time}` : "…"}.
            </Note>
            {articleUrl && (
              <a href={articleUrl} target="_blank" rel="noopener" className="q-link inline-flex min-h-8 items-center gap-1 self-start text-[13px] max-md:min-h-11">
                Voir l&apos;article
                <ArrowUpRight className="size-3.5" aria-hidden />
                <span className="sr-only"> (nouvel onglet)</span>
              </a>
            )}
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            <Note icon={<Globe aria-hidden />}>Sera publié dès l&apos;enregistrement.</Note>
            <Note icon={<ShieldCheck aria-hidden />}>
              Le contrôle relit d&apos;abord le texte : une valeur périmée, une affirmation interdite ou un concurrent nommé bloque la publication.
            </Note>
          </div>
        ))}

      {mode === "schedule" && (
        <div className="flex flex-col gap-3">
          <div className="grid grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)] gap-2.5">
            <div className="flex min-w-0 flex-col gap-1.5">
              <label htmlFor={`${prefix}-jour`} className="q-label">
                Jour
              </label>
              <input
                id={`${prefix}-jour`}
                type="date"
                className="q-input dark:[color-scheme:dark]"
                value={day}
                min={today}
                max={addDays(today, 365)}
                onChange={(e) => onChange({ mode, day: e.target.value, time })}
                aria-invalid={dayInvalid || undefined}
                aria-describedby={`${prefix}-phrase`}
                required
              />
            </div>
            <div className="flex min-w-0 flex-col gap-1.5">
              <label htmlFor={`${prefix}-heure`} className="q-label">
                Heure (Paris)
              </label>
              <Select
                id={`${prefix}-heure`}
                value={time}
                onChange={(e) => onChange({ mode, day, time: e.target.value })}
                aria-describedby={`${prefix}-phrase`}
                aria-invalid={timeInvalid || undefined}
                required
              >
                {!time && <option value="">—</option>}
                {times.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </Select>
            </div>
          </div>

          {problem ? (
            <p id={`${prefix}-phrase`} role="alert" className="m-0 flex items-start gap-2 text-[12.5px] leading-snug text-[var(--q-danger)]">
              <CircleAlert className="mt-px size-4 shrink-0" aria-hidden />
              {problem}
            </p>
          ) : (
            <div id={`${prefix}-phrase`} className="flex items-start gap-2.5 rounded-xl border border-[var(--q-wash-line)] bg-[var(--q-wash)] px-3 py-2.5" aria-live="polite">
              <CalendarClock className="mt-0.5 size-4 shrink-0 text-[var(--q-accent-strong)]" aria-hidden />
              <p className="m-0 text-[13px] leading-snug text-[var(--q-ink)]">
                Sera publié le <strong className="font-semibold">{longDay(day)}</strong> à <strong className="q-num font-semibold tabular-nums">{time}</strong> (heure de Paris).
              </p>
            </div>
          )}

          <Note icon={<ShieldCheck aria-hidden />}>
            À l&apos;heure prévue, le contrôle relit le texte : seuls une valeur périmée, une affirmation interdite ou un concurrent nommé retiennent l&apos;article, qui passe alors « À relire ».
          </Note>
          {isPublished && <Note icon={<CircleAlert aria-hidden />} tone="warn">L&apos;article quittera le blog jusqu&apos;à cette date.</Note>}
        </div>
      )}

      {footer}
    </div>
  )
}
