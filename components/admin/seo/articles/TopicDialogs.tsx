"use client"

/**
 * Fenêtres des sujets planifiés :
 * - « Planifier un sujet » (primaire du calendrier) : un sujet à planifier ou
 *   un nouveau sujet, jour et heure de Paris proposés d'après le rythme, mode
 *   de publication ;
 * - fiche d'un sujet du calendrier : Replanifier, Rédiger maintenant (suivi de
 *   la rédaction), Retirer du calendrier, Réessayer après un échec.
 */
import { useEffect, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { CalendarClock, CircleAlert, FilePen, Loader2, RotateCcw, X } from "lucide-react"
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog"
import { ARTICLE_TYPE_LABELS, PUBLISH_MODE_LABELS, type ArticleType, type PublishMode } from "@/lib/seo/types"
import type { TopicLite } from "@/lib/seo/articles/data"
import { parisDayTime, type Slot } from "@/lib/seo/articles/schedule"
import { api } from "@/components/admin/seo/articles/api"
import { useJobRunner } from "@/components/admin/seo/articles/job-runner"
import { JobProgress } from "@/components/admin/seo/articles/JobProgress"
import { Field, PUBLISH_MODE_HINTS, PUBLISH_MODE_OPTIONS, RadioCards, ScheduleFields, Select, dayTimeLabel } from "@/components/admin/seo/articles/fields"
import { TopicStatusPill, TypeTag } from "@/components/admin/seo/articles/pills"

const NEW = "__new"
const TYPES: ArticleType[] = ["howto", "guide", "news", "faq"]

function DialogShell({
  open,
  onClose,
  title,
  description,
  children,
  footer,
}: {
  open: boolean
  onClose: () => void
  title: string
  description?: React.ReactNode
  children: React.ReactNode
  footer: React.ReactNode
}) {
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="flex max-h-[calc(100dvh-2rem)] flex-col gap-0 overflow-hidden p-0 sm:max-w-[560px]">
        <div className="flex flex-col gap-1 px-6 pb-3 pr-14 pt-5">
          <DialogTitle className="text-base font-semibold tracking-[-0.01em] text-[var(--q-ink)]">{title}</DialogTitle>
          {description && <DialogDescription className="text-[13px] text-[var(--q-text-4)]">{description}</DialogDescription>}
        </div>
        <div className="flex min-h-0 flex-1 flex-col gap-[18px] overflow-y-auto px-6 pb-6 pt-2">{children}</div>
        <div className="flex flex-col-reverse gap-2 border-t border-[var(--q-line-soft)] px-6 py-3.5 sm:flex-row sm:flex-wrap sm:justify-end">{footer}</div>
      </DialogContent>
    </Dialog>
  )
}

/* ------------------------------------------------------------------ */
/* Planifier un sujet                                                  */
/* ------------------------------------------------------------------ */

export function PlanTopicDialog({
  open,
  onClose,
  topics,
  slots,
  defaultMode,
}: {
  open: boolean
  onClose: () => void
  topics: TopicLite[]
  slots: Slot[]
  defaultMode: PublishMode
}) {
  const router = useRouter()
  const [choice, setChoice] = useState<string>(topics[0]?.id ?? NEW)
  const [title, setTitle] = useState("")
  const [keyword, setKeyword] = useState("")
  const [type, setType] = useState<ArticleType>("guide")
  const [when, setWhen] = useState({ day: slots[0]?.day ?? "", time: slots[0]?.time ?? "08:00" })
  const [mode, setMode] = useState<PublishMode>(defaultMode)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})

  useEffect(() => {
    if (!open) return
    setChoice(topics[0]?.id ?? NEW)
    setWhen({ day: slots[0]?.day ?? "", time: slots[0]?.time ?? "08:00" })
    setMode(defaultMode)
    setError(null)
    setFieldErrors({})
    // Réinitialise à chaque ouverture
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  async function submit() {
    setBusy(true)
    setError(null)
    setFieldErrors({})
    const res =
      choice === NEW
        ? await api("/api/admin/seo/topics", "POST", {
            title: title.trim(),
            keyword: keyword.trim() || null,
            articleType: type,
            schedule: { day: when.day, time: when.time, publishMode: mode },
          })
        : await api(`/api/admin/seo/topics/${choice}`, "PATCH", { action: "schedule", day: when.day, time: when.time, publishMode: mode })
    setBusy(false)
    if (!res.ok) {
      setError(res.error)
      setFieldErrors(res.fieldErrors ?? {})
      return
    }
    toast.success(`Sujet planifié le ${dayTimeLabel(when.day, when.time)}`)
    onClose()
    router.refresh()
  }

  return (
    <DialogShell
      open={open}
      onClose={onClose}
      title="Planifier un sujet"
      description="Choisissez le sujet, le jour et l'heure de parution (heure de Paris) ; l'article est rédigé la veille."
      footer={
        <>
          <button type="button" onClick={onClose} className="q-btn q-btn-ghost max-sm:q-btn-lg">
            Annuler
          </button>
          <button type="button" onClick={submit} disabled={busy} className="q-btn q-btn-primary max-sm:q-btn-lg">
            {busy ? <Loader2 className="animate-spin motion-reduce:animate-none" aria-hidden /> : <CalendarClock aria-hidden />}
            Planifier
          </button>
        </>
      }
    >
      <Field label="Sujet" htmlFor="plan-sujet">
        <Select id="plan-sujet" value={choice} onChange={(e) => setChoice(e.target.value)}>
          {topics.map((t) => (
            <option key={t.id} value={t.id}>
              {t.title}
            </option>
          ))}
          <option value={NEW}>Saisir un sujet</option>
        </Select>
      </Field>
      {choice === NEW && (
        <>
          <Field label="Nouveau sujet" htmlFor="plan-titre" error={fieldErrors.title}>
            <input id="plan-titre" className="q-input" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={160} aria-invalid={Boolean(fieldErrors.title)} />
          </Field>
          <Field label="Mot-clé cible" htmlFor="plan-motcle" error={fieldErrors.keyword}>
            <input id="plan-motcle" className="q-input font-mono" value={keyword} onChange={(e) => setKeyword(e.target.value)} maxLength={120} />
          </Field>
          <div className="flex flex-col gap-1.5">
            <span id="plan-type" className="q-label">
              Type
            </span>
            <div role="group" aria-labelledby="plan-type" className="q-seg flex w-full">
              {TYPES.map((t) => (
                <button key={t} type="button" aria-pressed={type === t} onClick={() => setType(t)} className="min-h-11 flex-1 md:min-h-8">
                  {ARTICLE_TYPE_LABELS[t]}
                </button>
              ))}
            </div>
          </div>
        </>
      )}
      <ScheduleFields idPrefix="plan-quand" day={when.day} time={when.time} onChange={setWhen} slots={slots} error={fieldErrors.day ?? fieldErrors.time ?? fieldErrors["schedule.day"]} />
      <RadioCards name="plan-mode" legend="Publication" value={mode} options={PUBLISH_MODE_OPTIONS} onChange={setMode} />
      {error && (
        <p role="alert" className="q-field-error !text-[13px]">
          {error}
        </p>
      )}
    </DialogShell>
  )
}

/* ------------------------------------------------------------------ */
/* Fiche d'un sujet du calendrier                                      */
/* ------------------------------------------------------------------ */

export function TopicDialog({
  topic,
  onClose,
  slots,
  coverImage,
  initialView = "info",
}: {
  topic: TopicLite | null
  onClose: () => void
  slots: Slot[]
  /** Préférence « image de couverture » : la passe Image n'est montrée que si elle a lieu. */
  coverImage: boolean
  /** « reschedule » : ouvre directement le choix de la date (« Planifier » de l'écran Sujets). */
  initialView?: "info" | "reschedule"
}) {
  const router = useRouter()
  const runner = useJobRunner()
  const [view, setView] = useState<"info" | "reschedule">("info")
  const [when, setWhen] = useState({ day: "", time: "08:00" })
  const [mode, setMode] = useState<PublishMode>("draft")
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [jobStarted, setJobStarted] = useState(false)

  useEffect(() => {
    if (!topic) return
    const at = topic.scheduledAt ? parisDayTime(topic.scheduledAt) : null
    setWhen({ day: at?.day ?? slots[0]?.day ?? "", time: at?.time ?? slots[0]?.time ?? "08:00" })
    setMode(topic.publishMode)
    setView(initialView)
    setError(null)
    setJobStarted(false)
    runner.reset()
    // Réinitialise à chaque sujet ouvert
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [topic?.id])

  function close() {
    runner.stop()
    onClose()
    if (jobStarted) router.refresh()
  }

  async function patch(action: string, body: Record<string, unknown> = {}) {
    if (!topic) return null
    setBusy(action)
    setError(null)
    const res = await api<{ jobId: string | null }>(`/api/admin/seo/topics/${topic.id}`, "PATCH", { action, ...body })
    setBusy(null)
    if (!res.ok) {
      setError(res.error)
      return null
    }
    return res.data
  }

  async function reschedule() {
    const done = await patch("schedule", { day: when.day, time: when.time, publishMode: mode })
    if (!done) return
    toast.success(`Sujet replanifié le ${dayTimeLabel(when.day, when.time)}`)
    onClose()
    router.refresh()
  }

  async function unschedule() {
    const done = await patch("unschedule")
    if (!done) return
    toast.success("Sujet retiré du calendrier")
    onClose()
    router.refresh()
  }

  async function draft(action: "draft" | "retry") {
    const done = await patch(action)
    if (!done?.jobId) return
    setJobStarted(true)
    router.refresh()
    const final = await runner.start(done.jobId)
    if (final.status === "done") toast.success("Article rédigé")
    router.refresh()
  }

  const open = topic !== null
  const at = topic?.scheduledAt ? parisDayTime(topic.scheduledAt) : null
  const failed = topic?.status === "failed"

  if (jobStarted) {
    return (
      <DialogShell
        open={open}
        onClose={close}
        title={topic?.title ?? ""}
        description="Rédaction en cours"
        footer={
          <>
            <button type="button" onClick={close} className="q-btn q-btn-ghost">
              Fermer
            </button>
            {runner.state.status === "done" && runner.state.postId && (
              <Link href={`/admin/blog/${runner.state.postId}`} className="q-btn q-btn-primary">
                Relire l&apos;article
              </Link>
            )}
          </>
        }
      >
        <JobProgress state={runner.state} withCover={coverImage} />
      </DialogShell>
    )
  }

  return (
    <DialogShell
      open={open}
      onClose={close}
      title={topic?.title ?? ""}
      description={at ? `Parution prévue le ${dayTimeLabel(at.day, at.time)} (heure de Paris)` : "Sans date de parution"}
      footer={
        view === "reschedule" ? (
          <>
            <button type="button" onClick={() => (initialView === "reschedule" ? close() : setView("info"))} className="q-btn q-btn-ghost max-sm:q-btn-lg">
              Annuler
            </button>
            <button type="button" onClick={reschedule} disabled={busy !== null} className="q-btn q-btn-primary max-sm:q-btn-lg">
              {busy === "schedule" && <Loader2 className="animate-spin motion-reduce:animate-none" aria-hidden />}
              Enregistrer
            </button>
          </>
        ) : (
          <>
            {topic?.status === "planned" && (
              <button type="button" onClick={unschedule} disabled={busy !== null} className="q-btn q-btn-ghost max-sm:q-btn-lg">
                {busy === "unschedule" ? <Loader2 className="animate-spin motion-reduce:animate-none" aria-hidden /> : <X aria-hidden />}
                Retirer du calendrier
              </button>
            )}
            <button type="button" onClick={() => setView("reschedule")} disabled={busy !== null || topic?.status === "generating"} className="q-btn q-btn-secondary max-sm:q-btn-lg">
              <CalendarClock aria-hidden />
              Replanifier
            </button>
            {failed ? (
              <button type="button" onClick={() => draft("retry")} disabled={busy !== null} className="q-btn q-btn-primary max-sm:q-btn-lg">
                {busy === "retry" ? <Loader2 className="animate-spin motion-reduce:animate-none" aria-hidden /> : <RotateCcw aria-hidden />}
                Réessayer
              </button>
            ) : (
              topic?.status === "planned" && (
                <button type="button" onClick={() => draft("draft")} disabled={busy !== null} className="q-btn q-btn-primary max-sm:q-btn-lg">
                  {busy === "draft" ? <Loader2 className="animate-spin motion-reduce:animate-none" aria-hidden /> : <FilePen aria-hidden />}
                  Rédiger maintenant
                </button>
              )
            )}
          </>
        )
      }
    >
      {topic && view === "info" && (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <TopicStatusPill status={topic.status} />
            <TypeTag type={topic.articleType} />
          </div>
          <dl className="flex flex-col gap-3 text-sm">
            <div className="flex flex-col gap-0.5">
              <dt className="q-label">Mot-clé cible</dt>
              <dd className="font-mono text-[13px] text-[var(--q-text-2)]">{topic.keyword ?? "—"}</dd>
            </div>
            <div className="flex flex-col gap-0.5">
              <dt className="q-label">Publication</dt>
              <dd className="text-[var(--q-text-2)]">
                {PUBLISH_MODE_LABELS[topic.publishMode].label} — {PUBLISH_MODE_HINTS[topic.publishMode]}
              </dd>
            </div>
          </dl>
          {topic.status === "generating" && (
            <p className="text-[13px] text-[var(--q-text-3)]">La rédaction est en cours ; l&apos;article apparaîtra dans Articles une fois prêt.</p>
          )}
          {failed && topic.lastError && (
            <p role="alert" className="flex items-start gap-2 text-[13px] text-[var(--q-danger)]">
              <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
              <span>{topic.lastError}</span>
            </p>
          )}
        </>
      )}
      {topic && view === "reschedule" && (
        <>
          <ScheduleFields idPrefix="replan" day={when.day} time={when.time} onChange={setWhen} slots={slots} />
          <RadioCards name="replan-mode" legend="Publication" value={mode} options={PUBLISH_MODE_OPTIONS} onChange={setMode} />
        </>
      )}
      {error && (
        <p role="alert" className="q-field-error !text-[13px]">
          {error}
        </p>
      )}
    </DialogShell>
  )
}
