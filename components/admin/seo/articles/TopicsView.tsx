"use client"

/**
 * Articles › Sujets (planche Articles-sujets) : recherche, filtre de statut,
 * cases à cocher par ligne et en-tête, tableau Sujet · Mot-clé cible · Type ·
 * Source · Statut · Parution ; barre d'actions groupées (« Planifier » aux
 * créneaux suivants du rythme, « Rédiger un brouillon ») ; modifier, planifier,
 * rédiger, réessayer, archiver un sujet. ?ajouter=1 ouvre « Ajouter un sujet ».
 */
import { useEffect, useMemo, useRef, useState } from "react"
import Link from "next/link"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { toast } from "sonner"
import { Archive, ArchiveRestore, CalendarClock, Clock, Ellipsis, FilePen, Loader2, Lightbulb, PencilLine, RotateCcw, X } from "lucide-react"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { EmptyState, SearchField } from "@/components/app/kit"
import { cn } from "@/lib/utils"
import { TOPIC_SOURCE_LABELS, type TopicStatus } from "@/lib/seo/types"
import type { TopicListItem, TopicsData } from "@/lib/seo/articles/data"
import { canApplyTopicAction } from "@/lib/seo/articles/status"
import { parisDayTime } from "@/lib/seo/articles/schedule"
import { api } from "@/components/admin/seo/articles/api"
import { runJob, type RunnerState } from "@/components/admin/seo/articles/job-runner"
import { Missing, Tag, TopicStatusPill, TypeTag } from "@/components/admin/seo/articles/pills"
import { dayTimeLabel } from "@/components/admin/seo/articles/fields"
import { TopicDialog } from "@/components/admin/seo/articles/TopicDialogs"
import { TopicFormDialog, type TopicFormValue } from "@/components/admin/seo/articles/TopicFormDialog"

type StatusFilter = "tous" | "a-planifier" | "planifies" | "rediges"

const FILTERS: { value: StatusFilter; label: string; match: (s: TopicStatus) => boolean }[] = [
  { value: "tous", label: "Tous", match: () => true },
  { value: "a-planifier", label: "À planifier", match: (s) => s === "unplanned" || s === "failed" },
  { value: "planifies", label: "Planifiés", match: (s) => s === "planned" || s === "generating" },
  { value: "rediges", label: "Rédigés", match: (s) => s === "drafted" || s === "published" },
]

const STEP_TEXT: Record<string, string> = {
  plan: "Plan…",
  write: "Rédaction…",
  check: "Contrôle…",
  fix: "Correction…",
  cover: "Image…",
  save: "Enregistrement…",
  done: "Article prêt",
}

const strip = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase()

/** Une ligne se coche si on peut la planifier ou la rédiger. */
const selectable = (t: TopicListItem) => t.status !== "archived" && (canApplyTopicAction(t.status, "draft") || (canApplyTopicAction(t.status, "schedule") && !t.postId))

function ReleaseCell({ t }: { t: TopicListItem }) {
  if (!t.date) return <Missing label="Pas de date" />
  const { day, time } = parisDayTime(t.date)
  return <span className="whitespace-nowrap tabular-nums">{dayTimeLabel(day, time)}</span>
}

export function TopicsView({ data, archived }: { data: TopicsData; archived: boolean }) {
  const router = useRouter()
  const pathname = usePathname()
  const params = useSearchParams()
  const filter = (FILTERS.find((f) => f.value === params.get("statut"))?.value ?? "tous") as StatusFilter
  const addOpen = params.get("ajouter") === "1"
  const [query, setQuery] = useState("")
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [busy, setBusy] = useState<string | null>(null)
  const [editing, setEditing] = useState<TopicFormValue | null>(null)
  const [scheduling, setScheduling] = useState<TopicListItem | null>(null)
  const [progress, setProgress] = useState<{ index: number; total: number; title: string; state: RunnerState } | null>(null)
  const cancelled = useRef(false)
  const headerBox = useRef<HTMLInputElement>(null)

  useEffect(() => {
    cancelled.current = false
    return () => {
      cancelled.current = true
    }
  }, [])

  const setParam = (key: string, value: string | null) => {
    const qs = new URLSearchParams(params.toString())
    if (value) qs.set(key, value)
    else qs.delete(key)
    const s = qs.toString()
    router.replace(s ? `${pathname}?${s}` : pathname, { scroll: false })
  }

  const visible = useMemo(() => {
    const f = FILTERS.find((x) => x.value === filter) ?? FILTERS[0]
    const q = strip(query.trim())
    return data.topics.filter((t) => (archived || f.match(t.displayStatus)) && (!q || strip(`${t.title} ${t.keyword ?? ""}`).includes(q)))
  }, [data.topics, filter, query, archived])

  const selectableVisible = visible.filter(selectable)
  const selectedVisible = selectableVisible.filter((t) => selected.has(t.id))
  const allChecked = selectableVisible.length > 0 && selectedVisible.length === selectableVisible.length

  useEffect(() => {
    if (headerBox.current) headerBox.current.indeterminate = selectedVisible.length > 0 && !allChecked
  }, [selectedVisible.length, allChecked])

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(Array.from(prev))
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  const toggleAll = () => setSelected(allChecked ? new Set() : new Set(selectableVisible.map((t) => t.id)))

  /** Suit les rédactions créées, une à une (fermer la page n'arrête que le suivi). */
  async function follow(jobIds: string[], titles: string[]) {
    for (let i = 0; i < jobIds.length && !cancelled.current; i++) {
      const final = await runJob(
        jobIds[i],
        (state) => !cancelled.current && setProgress({ index: i + 1, total: jobIds.length, title: titles[i] ?? "", state }),
        () => cancelled.current,
      )
      router.refresh()
      if (final.status === "failed") toast.error(`« ${titles[i]} » : ${final.error ?? "la rédaction a échoué"}`)
    }
    if (!cancelled.current) {
      setProgress(null)
      toast.success(jobIds.length > 1 ? "Brouillons rédigés" : "Brouillon rédigé")
    }
  }

  async function bulk(action: "schedule" | "draft") {
    const ids = selectedVisible.map((t) => t.id)
    if (ids.length === 0) return
    setBusy(action)
    const res = await api<{ updated: number; skipped: { id: string; reason: string }[]; jobs: string[] }>("/api/admin/seo/topics/bulk", "POST", { ids, action })
    setBusy(null)
    if (!res.ok || !res.data) {
      toast.error(res.error ?? "Action impossible")
      return
    }
    const { updated, skipped, jobs } = res.data
    if (skipped.length > 0) toast.warning(`${skipped.length} sujet${skipped.length > 1 ? "s" : ""} ignoré${skipped.length > 1 ? "s" : ""} : ${skipped[0].reason}`)
    if (updated > 0) toast.success(action === "schedule" ? `${updated} sujet${updated > 1 ? "s" : ""} planifié${updated > 1 ? "s" : ""}` : `Rédaction lancée pour ${updated} sujet${updated > 1 ? "s" : ""}`)
    setSelected(new Set())
    router.refresh()
    if (action === "draft" && jobs.length > 0) {
      const titles = ids.map((id) => data.topics.find((t) => t.id === id)?.title ?? "")
      void follow(jobs, titles.filter((_, i) => !skipped.some((s) => s.id === ids[i])))
    }
  }

  async function rowAction(t: TopicListItem, action: "draft" | "retry" | "unschedule" | "archive" | "restore") {
    setBusy(`${action}:${t.id}`)
    const res = await api<{ jobId: string | null }>(`/api/admin/seo/topics/${t.id}`, "PATCH", { action })
    setBusy(null)
    if (!res.ok) {
      toast.error(res.error ?? "Action impossible")
      return
    }
    const messages = { draft: "Rédaction lancée", retry: "Rédaction relancée", unschedule: "Sujet retiré du calendrier", archive: "Sujet archivé", restore: "Sujet restauré" }
    toast.success(messages[action])
    router.refresh()
    if ((action === "draft" || action === "retry") && res.data?.jobId) void follow([res.data.jobId], [t.title])
  }

  const menu = (t: TopicListItem) => (
    <DropdownMenu>
      <DropdownMenuTrigger className="q-btn q-btn-ghost q-btn-sm q-btn-icon max-md:!size-11" aria-label={`Actions pour « ${t.title} »`} disabled={busy !== null && busy.endsWith(t.id)}>
        {busy?.endsWith(t.id) ? <Loader2 className="size-4 animate-spin motion-reduce:animate-none" aria-hidden /> : <Ellipsis className="size-4" aria-hidden />}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" sideOffset={6} className="w-60">
        {t.postId && (
          <DropdownMenuItem onClick={() => router.push(`/admin/blog/${t.postId}`)}>
            <FilePen aria-hidden />
            Ouvrir l&apos;article
          </DropdownMenuItem>
        )}
        {canApplyTopicAction(t.status, "update") && (
          <DropdownMenuItem onClick={() => setEditing({ id: t.id, title: t.title, keyword: t.keyword, articleType: t.articleType, angle: t.angle, notes: t.notes })}>
            <PencilLine aria-hidden />
            Modifier
          </DropdownMenuItem>
        )}
        {canApplyTopicAction(t.status, "schedule") && t.displayStatus !== "published" && (
          <DropdownMenuItem onClick={() => setScheduling(t)}>
            <CalendarClock aria-hidden />
            {t.scheduledAt ? "Replanifier" : "Planifier"}
          </DropdownMenuItem>
        )}
        {canApplyTopicAction(t.status, "draft") && t.status !== "failed" && (
          <DropdownMenuItem onClick={() => rowAction(t, "draft")}>
            <FilePen aria-hidden />
            Rédiger maintenant
          </DropdownMenuItem>
        )}
        {t.status === "failed" && (
          <DropdownMenuItem onClick={() => rowAction(t, "retry")}>
            <RotateCcw aria-hidden />
            Réessayer
          </DropdownMenuItem>
        )}
        {t.status === "planned" && (
          <DropdownMenuItem onClick={() => rowAction(t, "unschedule")}>
            <X aria-hidden />
            Retirer du calendrier
          </DropdownMenuItem>
        )}
        {canApplyTopicAction(t.status, "archive") && (
          <DropdownMenuItem onClick={() => rowAction(t, "archive")}>
            <Archive aria-hidden />
            Archiver
          </DropdownMenuItem>
        )}
        {t.status === "archived" && (
          <DropdownMenuItem onClick={() => rowAction(t, "restore")}>
            <ArchiveRestore aria-hidden />
            Restaurer
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )

  const checkbox = (t: TopicListItem) =>
    selectable(t) ? (
      <label className="relative grid size-11 place-items-center md:size-auto">
        <span className="sr-only">Sélectionner « {t.title} »</span>
        <input type="checkbox" checked={selected.has(t.id)} onChange={() => toggle(t.id)} className="size-[18px] accent-[var(--q-accent)]" />
      </label>
    ) : (
      <label className="relative grid size-11 place-items-center md:size-auto">
        <span className="sr-only">« {t.title} » : rien à planifier ni à rédiger</span>
        <input type="checkbox" disabled className="size-[18px] accent-[var(--q-accent)]" />
      </label>
    )

  const next = data.nextRelease ? parisDayTime(data.nextRelease) : null

  return (
    <>
      <section aria-labelledby="titre-sujets" className="q-card overflow-hidden">
        <div className="flex flex-wrap items-start justify-between gap-3 px-4 pb-2 pt-4 md:px-5">
          <div className="flex min-w-0 flex-col gap-0.5">
            <h2 id="titre-sujets" className="q-h2">
              {archived ? "Sujets archivés" : "Sujets à traiter"}
            </h2>
            <p className="text-[13px] text-[var(--q-text-4)]">
              Sujets tirés de vos{" "}
              <Link href="/admin/seo/mots-cles" className="q-link">
                mots-clés
              </Link>
              , de vos actions SEO ou de vos saisies.
            </p>
          </div>
          <p className="inline-flex items-center gap-1.5 whitespace-nowrap text-[13px] text-[var(--q-text-4)]">
            <Clock className="size-3.5" aria-hidden />
            {next ? `Prochaine parution : ${dayTimeLabel(next.day, next.time)}` : "Aucune parution planifiée"}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 px-4 pb-4 pt-2 md:px-5">
          <SearchField value={query} onChange={setQuery} placeholder="Rechercher un sujet ou un mot-clé…" aria-label="Rechercher un sujet" className="w-full md:max-w-[380px] md:flex-1" />
          {!archived && (
            <div className="-mx-4 w-[calc(100%+2rem)] overflow-x-auto px-4 [scrollbar-width:none] md:mx-0 md:w-auto md:px-0">
              <div role="group" aria-label="Filtrer par statut" className="q-seg">
                {FILTERS.map((f) => (
                  <button key={f.value} type="button" aria-pressed={filter === f.value} onClick={() => setParam("statut", f.value === "tous" ? null : f.value)} className="max-md:!h-11">
                    {f.label}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {selectedVisible.length > 0 && (
          <section
            aria-label="Actions sur les sujets sélectionnés"
            className="mx-4 mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[var(--q-wash-line)] bg-[var(--q-wash)] py-2 pl-4 pr-2 md:mx-5"
          >
            <div className="flex flex-wrap items-center gap-2">
              <p aria-live="polite" className="text-sm font-semibold text-[var(--q-accent-ink)]">
                {selectedVisible.length} sujet{selectedVisible.length > 1 ? "s" : ""} sélectionné{selectedVisible.length > 1 ? "s" : ""}
              </p>
              <button type="button" onClick={() => setSelected(new Set())} className="q-btn q-btn-ghost q-btn-sm max-md:!h-11">
                <X aria-hidden />
                Tout désélectionner
              </button>
            </div>
            <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
              <button type="button" onClick={() => bulk("schedule")} disabled={busy !== null} className="q-btn q-btn-secondary q-btn-sm max-md:!h-12 max-sm:flex-1">
                {busy === "schedule" ? <Loader2 className="animate-spin motion-reduce:animate-none" aria-hidden /> : <CalendarClock aria-hidden />}
                Planifier
              </button>
              <button type="button" onClick={() => bulk("draft")} disabled={busy !== null} className="q-btn q-btn-ink q-btn-sm max-md:!h-12 max-sm:flex-1">
                {busy === "draft" ? <Loader2 className="animate-spin motion-reduce:animate-none" aria-hidden /> : <FilePen aria-hidden />}
                Rédiger un brouillon
              </button>
            </div>
          </section>
        )}

        {progress && (
          <div role="status" className="mx-4 mb-4 flex flex-wrap items-center gap-2 rounded-xl border border-[var(--q-line)] bg-[var(--q-surface-2)] px-4 py-3 text-[13px] text-[var(--q-text-2)] md:mx-5">
            <Loader2 className="size-4 shrink-0 animate-spin text-[var(--q-accent)] motion-reduce:animate-none" aria-hidden />
            <span className="min-w-0 flex-1">
              Rédaction {progress.total > 1 ? `${progress.index} sur ${progress.total} ` : ""}: « {progress.title} » — {STEP_TEXT[progress.state.step] ?? "…"}
              {progress.state.error ? <span className="block text-[var(--q-warn)]">{progress.state.error}</span> : null}
            </span>
            <span className="text-[var(--q-text-4)]">Vous pouvez quitter la page : la rédaction continue.</span>
          </div>
        )}

        {visible.length === 0 ? (
          <EmptyState
            icon={<Lightbulb className="size-5" aria-hidden />}
            title={data.topics.length === 0 ? (archived ? "Aucun sujet archivé" : "Aucun sujet") : "Aucun sujet ne correspond"}
            text={data.topics.length === 0 && !archived ? "Ajoutez un sujet, ou créez-en un depuis un mot-clé suivi." : "Changez de filtre ou de recherche."}
          />
        ) : (
          <>
            <div className="relative hidden overflow-x-auto md:block">
              <table aria-labelledby="titre-sujets" className="q-table min-w-[1100px] table-fixed">
                <thead>
                  <tr>
                    <th scope="col" className="w-[52px] !pr-1.5">
                      <label className="relative block size-[18px]">
                        <span className="sr-only">
                          Tout sélectionner ({selectedVisible.length} sur {selectableVisible.length} sujets sélectionnables)
                        </span>
                        <input ref={headerBox} type="checkbox" checked={allChecked} onChange={toggleAll} disabled={selectableVisible.length === 0} className="block size-[18px] accent-[var(--q-accent)]" />
                      </label>
                    </th>
                    <th scope="col">Sujet</th>
                    <th scope="col" className="w-[264px]">Mot-clé cible</th>
                    <th scope="col" className="w-[100px]">Type</th>
                    <th scope="col" className="w-[120px]">Source</th>
                    <th scope="col" className="w-[150px]">Statut</th>
                    <th scope="col" className="w-[140px]">Parution</th>
                    <th scope="col" className="w-[66px] text-right">
                      <span className="sr-only">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {visible.map((t) => (
                    <tr key={t.id} className={cn(selected.has(t.id) && "bg-[var(--q-wash)]")}>
                      <td className="!pr-1.5">{checkbox(t)}</td>
                      <td>
                        {t.postId ? (
                          <Link href={`/admin/blog/${t.postId}`} className="line-clamp-2 font-semibold leading-snug text-[var(--q-ink)] hover:text-[var(--q-accent-strong)]">
                            {t.title}
                          </Link>
                        ) : (
                          <span className="line-clamp-2 font-semibold leading-snug text-[var(--q-ink)]">{t.title}</span>
                        )}
                        {t.status === "failed" && t.lastError && <p className="mt-1 line-clamp-2 text-xs text-[var(--q-danger)]">{t.lastError}</p>}
                      </td>
                      <td>{t.keyword ? <span className="font-mono text-[13px] text-[var(--q-text-2)]">{t.keyword}</span> : <Missing />}</td>
                      <td>
                        <TypeTag type={t.articleType} />
                      </td>
                      <td>
                        <Tag>{TOPIC_SOURCE_LABELS[t.source]}</Tag>
                      </td>
                      <td>
                        <TopicStatusPill status={t.displayStatus} />
                      </td>
                      <td>
                        <ReleaseCell t={t} />
                      </td>
                      <td className="text-right">{menu(t)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <ul className="q-list border-t border-[var(--q-line-soft)] md:hidden" aria-label={archived ? "Sujets archivés" : "Sujets à traiter"}>
              {visible.map((t) => (
                <li key={t.id} className={cn("flex items-start gap-1 py-3 pl-1 pr-2", selected.has(t.id) && "bg-[var(--q-wash)]")}>
                  {checkbox(t)}
                  <div className="flex min-w-0 flex-1 flex-col gap-1.5 pt-2.5">
                    <span className="line-clamp-2 text-base font-semibold leading-snug text-[var(--q-ink)]">{t.title}</span>
                    {t.keyword && <span className="font-mono text-[13px] text-[var(--q-text-2)]">{t.keyword}</span>}
                    <span className="flex flex-wrap items-center gap-1.5">
                      <TopicStatusPill status={t.displayStatus} />
                      <TypeTag type={t.articleType} />
                      <Tag>{TOPIC_SOURCE_LABELS[t.source]}</Tag>
                    </span>
                    <span className="text-[13px] text-[var(--q-text-4)]">
                      Parution : <ReleaseCell t={t} />
                    </span>
                    {t.status === "failed" && t.lastError && <span className="text-xs text-[var(--q-danger)]">{t.lastError}</span>}
                  </div>
                  {menu(t)}
                </li>
              ))}
            </ul>
          </>
        )}

        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-t border-[var(--q-line-soft)] px-4 py-3.5 text-[13px] text-[var(--q-text-4)] md:px-5">
          <p>
            {visible.length.toLocaleString("fr-FR")} sujet{visible.length > 1 ? "s" : ""}
          </p>
          {archived ? (
            <Link href="/admin/seo/articles/sujets" className="q-link inline-flex min-h-11 items-center md:min-h-0">
              Retour aux sujets à traiter
            </Link>
          ) : (
            data.archived > 0 && (
              <Link href="/admin/seo/articles/sujets?archives=1" className="q-link inline-flex min-h-11 items-center md:min-h-0">
                Sujets archivés ({data.archived.toLocaleString("fr-FR")})
              </Link>
            )
          )}
        </div>
      </section>

      <TopicFormDialog
        open={addOpen || editing !== null}
        initial={editing}
        onClose={() => {
          setEditing(null)
          if (addOpen) setParam("ajouter", null)
        }}
        keywords={data.keywords}
        angles={data.angles}
      />
      <TopicDialog
        topic={
          scheduling
            ? {
                id: scheduling.id,
                title: scheduling.title,
                keyword: scheduling.keyword,
                articleType: scheduling.articleType,
                angle: scheduling.angle,
                status: scheduling.status,
                scheduledAt: scheduling.scheduledAt,
                publishMode: scheduling.scheduledAt ? scheduling.publishMode : data.defaultMode,
                lastError: scheduling.lastError,
                postId: scheduling.postId,
              }
            : null
        }
        onClose={() => setScheduling(null)}
        slots={data.slots}
        coverImage={data.coverImage}
        initialView="reschedule"
      />
    </>
  )
}
