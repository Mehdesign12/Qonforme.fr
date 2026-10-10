"use client"

/**
 * Fenêtre « Générer un article » (planche Article-generer) : sujet, mot-clé
 * cible, type, angle, longueur, publication ; résumé des modèles par passe ;
 * « Annuler » + « Générer ». Après l'envoi, la même fenêtre suit la rédaction
 * passe par passe (Plan…, Rédaction…, Contrôle…, Image…) ; la fermer n'annule
 * rien : la tâche planifiée termine la rédaction.
 */
import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Info, Loader2, Sparkles, TriangleAlert } from "lucide-react"
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog"
import { StatusPill } from "@/components/app/kit"
import { cn } from "@/lib/utils"
import { ARTICLE_TYPE_LABELS, KEYWORD_STATUS, type ArticleType } from "@/lib/seo/types"
import type { GenerateDialogData } from "@/lib/seo/articles/data"
import { api } from "@/components/admin/seo/articles/api"
import { useJobRunner } from "@/components/admin/seo/articles/job-runner"
import { JobProgress } from "@/components/admin/seo/articles/JobProgress"
import { Field, RadioCards, ScheduleFields, Select, type RadioOption } from "@/components/admin/seo/articles/fields"

const NEW = "__new"
const TYPES: ArticleType[] = ["howto", "guide", "news", "faq"]

type Publication = "draft" | "schedule" | "after_check"

const PUBLICATION_OPTIONS: RadioOption<Publication>[] = [
  { value: "draft", label: "Brouillon à relire", hint: "L'article arrive en brouillon ; rien ne paraît sans votre relecture." },
  { value: "schedule", label: "Planifier", hint: "Un jour et une heure à choisir ; le contrôle passe avant la publication." },
  { value: "after_check", label: "Publier après contrôle", hint: "Publié si le contrôle ne relève rien ; sinon il reste en brouillon." },
]

const nf = (n: number) => n.toLocaleString("fr-FR")

function lengthOptions(min: number, max: number): { min: number; max: number }[] {
  const list = [{ min, max }, { min: 800, max: 1200 }, { min: 1200, max: 1800 }, { min: 1500, max: 2500 }, { min: 2500, max: 3500 }]
  const seen = new Set<string>()
  return list.filter((o) => {
    const key = `${o.min}-${o.max}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

export function GenerateDialog({ open, onClose, data }: { open: boolean; onClose: () => void; data: GenerateDialogData }) {
  const router = useRouter()
  const runner = useJobRunner()
  const firstTopic = data.topics[0]
  const keywordSet = useMemo(() => new Set(data.keywords.map((k) => k.keyword)), [data.keywords])

  const [topicChoice, setTopicChoice] = useState<string>(firstTopic?.id ?? NEW)
  const [title, setTitle] = useState("")
  const [keywordChoice, setKeywordChoice] = useState<string>("")
  const [keywordText, setKeywordText] = useState("")
  const [type, setType] = useState<ArticleType>(firstTopic?.articleType ?? "guide")
  const [angle, setAngle] = useState<string>(firstTopic?.angle ?? "varied")
  const lengths = useMemo(() => lengthOptions(data.lengthMin, data.lengthMax), [data.lengthMin, data.lengthMax])
  const [lengthIndex, setLengthIndex] = useState(0)
  const [publication, setPublication] = useState<Publication>("draft")
  const [when, setWhen] = useState({ day: data.slot?.day ?? "", time: data.slot?.time ?? "08:00" })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [jobId, setJobId] = useState<string | null>(null)
  const [topicId, setTopicId] = useState<string | null>(null)

  // Le mot-clé, le type et l'angle suivent le sujet choisi
  const applyTopic = (id: string) => {
    setTopicChoice(id)
    const topic = data.topics.find((t) => t.id === id)
    if (!topic) {
      setKeywordChoice("")
      setKeywordText("")
      return
    }
    setType(topic.articleType)
    setAngle(topic.angle ?? "varied")
    if (topic.keyword && keywordSet.has(topic.keyword)) {
      setKeywordChoice(topic.keyword)
      setKeywordText("")
    } else if (topic.keyword) {
      setKeywordChoice(NEW)
      setKeywordText(topic.keyword)
    } else {
      setKeywordChoice("")
      setKeywordText("")
    }
  }

  useEffect(() => {
    if (open && firstTopic && !jobId) applyTopic(firstTopic.id)
    // Réinitialise à chaque ouverture
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const keyword = keywordChoice === NEW ? keywordText.trim() : keywordChoice
  const trackedStatus = data.keywords.find((k) => k.keyword === keyword)
  const length = lengths[lengthIndex] ?? lengths[0]
  const running = runner.state.status === "running"
  const finished = runner.state.status === "done"

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (busy || data.blocked) return
    setBusy(true)
    setError(null)
    setFieldErrors({})
    const res = await api<{ jobId: string; topicId: string }>("/api/admin/seo/articles/generate", "POST", {
      ...(topicChoice !== NEW ? { topicId: topicChoice } : { title: title.trim() }),
      keyword: keyword || null,
      articleType: type,
      angle,
      lengthMin: length.min,
      lengthMax: length.max,
      publication,
      ...(publication === "schedule" ? { day: when.day, time: when.time } : {}),
    })
    setBusy(false)
    if (!res.ok || !res.data) {
      setError(res.error)
      setFieldErrors(res.fieldErrors ?? {})
      return
    }
    setJobId(res.data.jobId)
    setTopicId(res.data.topicId)
    router.refresh()
    const final = await runner.start(res.data.jobId)
    if (final.status === "done") {
      toast.success("Article rédigé")
      router.refresh()
    } else if (final.status === "failed") {
      router.refresh()
    }
  }

  async function retry() {
    if (!jobId) return
    if (runner.state.status === "failed" && topicId) {
      const res = await api(`/api/admin/seo/topics/${topicId}`, "PATCH", { action: "retry" })
      if (!res.ok) {
        toast.error(res.error ?? "Relance impossible")
        return
      }
    }
    const final = await runner.start(jobId)
    if (final.status === "done") router.refresh()
  }

  function close() {
    runner.stop()
    if (jobId) router.refresh()
    setJobId(null)
    setTopicId(null)
    setError(null)
    runner.reset()
    onClose()
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && close()}>
      <DialogContent className="flex max-h-[calc(100dvh-2rem)] flex-col gap-0 overflow-hidden p-0 sm:max-w-[560px]">
        <div className="flex flex-col gap-1 px-6 pb-3 pr-14 pt-5">
          <DialogTitle className="text-base font-semibold tracking-[-0.01em] text-[var(--q-ink)]">Générer un article</DialogTitle>
          <DialogDescription className="text-[13px] text-[var(--q-text-4)]">
            Partez d&apos;un mot-clé ou d&apos;un sujet ; l&apos;article arrive en brouillon à relire.
          </DialogDescription>
        </div>

        {jobId ? (
          <>
            <div className="min-h-0 flex-1 overflow-y-auto px-6 pb-6 pt-2">
              <JobProgress state={runner.state} withCover={data.coverImage} />
            </div>
            <div className="flex flex-wrap items-center justify-end gap-2 border-t border-[var(--q-line-soft)] px-6 py-3.5">
              <button type="button" onClick={close} className="q-btn q-btn-ghost">
                Fermer
              </button>
              {(runner.state.status === "failed" || runner.state.status === "stopped") && (
                <button type="button" onClick={retry} className="q-btn q-btn-secondary">
                  {runner.state.status === "failed" ? "Réessayer" : "Reprendre"}
                </button>
              )}
              {finished && runner.state.postId && (
                <Link href={`/admin/blog/${runner.state.postId}`} className="q-btn q-btn-primary">
                  Relire l&apos;article
                </Link>
              )}
              {running && (
                <span className="inline-flex items-center gap-2 text-[13px] text-[var(--q-text-4)]">
                  <Loader2 className="size-4 animate-spin motion-reduce:animate-none" aria-hidden />
                  Rédaction en cours
                </span>
              )}
            </div>
          </>
        ) : (
          <form onSubmit={submit} className="flex min-h-0 flex-1 flex-col" noValidate>
            <div className="flex min-h-0 flex-1 flex-col gap-[18px] overflow-y-auto px-6 pb-6 pt-2">
              {data.blocked && (
                <p role="alert" className="q-banner q-banner-danger !text-[13px]">
                  <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
                  <span>{data.blocked}</span>
                </p>
              )}

              <Field label="Sujet" htmlFor="gen-sujet" hint={topicChoice !== NEW ? "Le mot-clé et le type suivent le sujet choisi." : undefined}>
                <Select id="gen-sujet" value={topicChoice} onChange={(e) => applyTopic(e.target.value)}>
                  {data.topics.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.title}
                    </option>
                  ))}
                  <option value={NEW}>Saisir un autre sujet</option>
                </Select>
              </Field>
              {topicChoice === NEW && (
                <Field label="Nouveau sujet" htmlFor="gen-titre" error={fieldErrors.title}>
                  <input
                    id="gen-titre"
                    className="q-input"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Par exemple : Facturer un acompte sur un chantier"
                    maxLength={160}
                    aria-invalid={Boolean(fieldErrors.title)}
                    required
                  />
                </Field>
              )}

              <Field
                label="Mot-clé cible"
                htmlFor="gen-motcle"
                error={fieldErrors.keyword}
                hint={
                  trackedStatus ? (
                    <span className="flex flex-wrap items-center gap-2">
                      <span>
                        Suivi dans{" "}
                        <Link href="/admin/seo/mots-cles" className="q-link">
                          Mots-clés
                        </Link>
                      </span>
                      <StatusPill tone={KEYWORD_STATUS[trackedStatus.status]?.tone ?? "neutral"}>{trackedStatus.label}</StatusPill>
                    </span>
                  ) : undefined
                }
              >
                <Select
                  id="gen-motcle"
                  value={keywordChoice}
                  onChange={(e) => {
                    setKeywordChoice(e.target.value)
                    if (e.target.value !== NEW) setKeywordText("")
                  }}
                >
                  <option value="">Aucun mot-clé précis</option>
                  {data.keywords.map((k) => (
                    <option key={k.keyword} value={k.keyword}>
                      {k.keyword}
                    </option>
                  ))}
                  <option value={NEW}>Saisir un autre mot-clé</option>
                </Select>
              </Field>
              {keywordChoice === NEW && (
                <Field label="Autre mot-clé" htmlFor="gen-motcle-libre">
                  <input id="gen-motcle-libre" className="q-input font-mono" value={keywordText} onChange={(e) => setKeywordText(e.target.value)} maxLength={120} />
                </Field>
              )}

              <div className="flex flex-col gap-1.5">
                <span id="gen-type" className="q-label">
                  Type
                </span>
                <div role="group" aria-labelledby="gen-type" className="q-seg flex w-full">
                  {TYPES.map((t) => (
                    <button key={t} type="button" aria-pressed={type === t} onClick={() => setType(t)} className="min-h-11 flex-1 md:min-h-8">
                      {ARTICLE_TYPE_LABELS[t]}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field label="Angle" htmlFor="gen-angle">
                  <Select id="gen-angle" value={angle} onChange={(e) => setAngle(e.target.value)}>
                    <option value="varied">Varié (recommandé)</option>
                    {data.angles.map((a) => (
                      <option key={a.key} value={a.key}>
                        {a.label}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label="Longueur" htmlFor="gen-longueur" error={fieldErrors.lengthMax}>
                  <Select id="gen-longueur" value={String(lengthIndex)} onChange={(e) => setLengthIndex(Number(e.target.value))}>
                    {lengths.map((l, i) => (
                      <option key={`${l.min}-${l.max}`} value={i}>
                        {nf(l.min)} à {nf(l.max)} mots
                      </option>
                    ))}
                  </Select>
                </Field>
              </div>

              <RadioCards name="gen-publication" legend="Publication" value={publication} options={PUBLICATION_OPTIONS} onChange={setPublication} />
              {publication === "schedule" && (
                <ScheduleFields
                  idPrefix="gen-quand"
                  day={when.day}
                  time={when.time}
                  onChange={setWhen}
                  slots={data.slot ? [data.slot] : []}
                  error={fieldErrors.day ?? fieldErrors.time}
                />
              )}

              {error && (
                <p role="alert" className="q-field-error !text-[13px]">
                  {error}
                </p>
              )}
            </div>

            <div className="flex items-start gap-2.5 border-t border-[var(--q-line-soft)] bg-[var(--q-surface-2)] px-6 py-3 text-[13px] text-[var(--q-text-3)]">
              <Sparkles className="mt-0.5 size-4 shrink-0 text-[var(--q-accent)]" aria-hidden />
              <span className="min-w-0 flex-1">
                {data.summary} · {data.coverImage ? "image de couverture incluse" : "sans image de couverture"}
                {data.fallbacks.map((f) => (
                  <span key={f} className="mt-1 flex items-start gap-1.5 text-[var(--q-warn)]">
                    <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden />
                    {f}
                  </span>
                ))}
              </span>
              <Link href="/admin/seo/articles/preferences" className="q-link shrink-0 text-[13px]">
                Préférences
              </Link>
            </div>

            <div className={cn("flex flex-col-reverse gap-2 border-t border-[var(--q-line-soft)] px-6 py-3.5 sm:flex-row sm:justify-end")}>
              <button type="button" onClick={close} className="q-btn q-btn-ghost max-sm:q-btn-lg">
                Annuler
              </button>
              <button type="submit" disabled={busy || Boolean(data.blocked)} className="q-btn q-btn-primary max-sm:q-btn-lg">
                {busy ? <Loader2 className="animate-spin motion-reduce:animate-none" aria-hidden /> : <Sparkles aria-hidden />}
                {busy ? "Préparation…" : "Générer"}
              </button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  )
}
