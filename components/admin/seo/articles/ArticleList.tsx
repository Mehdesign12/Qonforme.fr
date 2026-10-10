"use client"

/**
 * Articles › Articles (planche Articles-liste) : recherche, onglets d'état
 * (Tous · Publiés · Brouillons · Planifiés · À relire, compteurs réels), menu
 * « Source », tableau Titre · Type · Mot-clé · Statut · Source · Date ·
 * Contrôle · actions ; liste empilée sur téléphone. Filtres dans l'adresse
 * (?etat=, ?source=) ; ?generer=1 ouvre la fenêtre « Générer un article ».
 */
import { useMemo, useState } from "react"
import Link from "next/link"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { toast } from "sonner"
import { ArrowDown, ArrowUp, Ellipsis, ExternalLink, FileText, Loader2, PencilLine, Send, ShieldCheck, TriangleAlert, Undo2 } from "lucide-react"
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { EmptyState, SearchField } from "@/components/app/kit"
import { cn } from "@/lib/utils"
import type { ArticleDisplayStatus } from "@/lib/seo/types"
import type { ArticleListItem, GenerateDialogData } from "@/lib/seo/articles/data"
import { ARTICLE_SOURCE_LABELS, type ArticleSource } from "@/lib/seo/articles/status"
import { parisDayTime, shortDay } from "@/lib/seo/articles/schedule"
import { api } from "@/components/admin/seo/articles/api"
import { ArticleStatusPill, Missing, Tag, TypeTag } from "@/components/admin/seo/articles/pills"
import { Select } from "@/components/admin/seo/articles/fields"
import { GenerateDialog } from "@/components/admin/seo/articles/GenerateDialog"

type StateFilter = "tous" | "publies" | "brouillons" | "planifies" | "a-relire"

const STATE_TABS: { value: StateFilter; label: string; match: (s: ArticleDisplayStatus) => boolean }[] = [
  { value: "tous", label: "Tous", match: () => true },
  { value: "publies", label: "Publiés", match: (s) => s === "published" },
  { value: "brouillons", label: "Brouillons", match: (s) => s === "draft" },
  { value: "planifies", label: "Planifiés", match: (s) => s === "scheduled" || s === "generating" },
  { value: "a-relire", label: "À relire", match: (s) => s === "to_review" },
]

const SOURCE_PARAM: Record<ArticleSource, string> = { ai: "ia", manual: "manuel", pushrank: "pushrank" }

const strip = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase()

function DateCell({ iso }: { iso: string | null }) {
  if (!iso) return <Missing label="Non renseignée" />
  const { day, time } = parisDayTime(iso)
  return (
    <>
      <div className="whitespace-nowrap">{shortDay(day, true)}</div>
      <div className="text-xs text-[var(--q-text-4)]">{time}</div>
    </>
  )
}

function ControlCell({ item }: { item: ArticleListItem }) {
  if (item.control.count === 0) {
    return (
      <span className="flex items-start gap-1.5 text-[13px] font-medium leading-snug text-[var(--q-ok)]">
        <ShieldCheck className="mt-px size-4 shrink-0" aria-hidden />
        <span className="whitespace-nowrap">Aucun passage à relire</span>
      </span>
    )
  }
  const n = item.control.count
  return (
    <span className="flex items-start gap-1.5 text-[13px] font-medium leading-snug text-[var(--q-warn)]">
      <TriangleAlert className="mt-px size-4 shrink-0" aria-hidden />
      <span>
        {n} passage{n > 1 ? "s" : ""} à relire
        {item.control.blocking > 0 && <span className="block text-xs font-normal">dont {item.control.blocking} bloquant{item.control.blocking > 1 ? "s" : ""}</span>}
        {/* Motifs en clair : lisibles au téléphone, au clavier et au lecteur d'écran */}
        <span className="block text-xs font-normal text-[var(--q-text-3)]">{item.control.labels.slice(0, 2).join(" ; ")}{item.control.labels.length > 2 ? "…" : ""}</span>
      </span>
    </span>
  )
}

type Pending = { item: ArticleListItem; action: "publish" | "unpublish" } | null

export function ArticleList({ items, sources, generate }: { items: ArticleListItem[]; sources: ArticleSource[]; generate: GenerateDialogData }) {
  const router = useRouter()
  const pathname = usePathname()
  const params = useSearchParams()
  const stateFilter = (STATE_TABS.find((t) => t.value === params.get("etat"))?.value ?? "tous") as StateFilter
  const sourceParam = params.get("source")
  const sourceFilter = (Object.keys(SOURCE_PARAM) as ArticleSource[]).find((k) => SOURCE_PARAM[k] === sourceParam) ?? null
  const generateOpen = params.get("generer") === "1"
  const [query, setQuery] = useState("")
  const [ascending, setAscending] = useState(false)
  const [pending, setPending] = useState<Pending>(null)
  const [busy, setBusy] = useState(false)
  const [blockers, setBlockers] = useState<{ label: string; excerpt: string | null; detail: string | null }[] | null>(null)

  const setParam = (key: string, value: string | null) => {
    const qs = new URLSearchParams(params.toString())
    if (value) qs.set(key, value)
    else qs.delete(key)
    const s = qs.toString()
    router.replace(s ? `${pathname}?${s}` : pathname, { scroll: false })
  }

  const counts = useMemo(() => {
    const base = sourceFilter ? items.filter((i) => i.source === sourceFilter) : items
    return Object.fromEntries(STATE_TABS.map((t) => [t.value, base.filter((i) => t.match(i.status)).length])) as Record<StateFilter, number>
  }, [items, sourceFilter])

  const visible = useMemo(() => {
    const tab = STATE_TABS.find((t) => t.value === stateFilter) ?? STATE_TABS[0]
    const q = strip(query.trim())
    const list = items.filter(
      (i) => tab.match(i.status) && (!sourceFilter || i.source === sourceFilter) && (!q || strip(`${i.title} ${i.keyword ?? ""}`).includes(q)),
    )
    return list.sort((a, b) => {
      const da = a.date ?? ""
      const db = b.date ?? ""
      return ascending ? da.localeCompare(db) : db.localeCompare(da)
    })
  }, [items, stateFilter, sourceFilter, query, ascending])

  async function confirm() {
    if (!pending) return
    setBusy(true)
    const res = await api<{ ok: boolean; issues?: { label: string; excerpt: string | null; detail: string | null }[] }>(`/api/admin/seo/articles/posts/${pending.item.id}`, "PATCH", {
      action: pending.action,
    })
    setBusy(false)
    if (!res.ok) {
      if (res.status === 409 && res.data?.issues) {
        setBlockers(res.data.issues)
        return
      }
      toast.error(res.error ?? "Action impossible")
      return
    }
    toast.success(pending.action === "publish" ? "Article publié" : "Article repassé en brouillon")
    setPending(null)
    router.refresh()
  }

  const actions = (item: ArticleListItem) => (
    <DropdownMenu>
      <DropdownMenuTrigger className="q-btn q-btn-ghost q-btn-sm q-btn-icon max-md:!size-11" aria-label={`Actions pour « ${item.title} »`}>
        <Ellipsis className="size-4" aria-hidden />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" sideOffset={6} className="w-56">
        <DropdownMenuItem onClick={() => router.push(`/admin/blog/${item.id}`)}>
          <PencilLine aria-hidden />
          Ouvrir
        </DropdownMenuItem>
        {item.isPublished && (
          <DropdownMenuItem onClick={() => window.open(`/blog/${item.slug}`, "_blank", "noopener,noreferrer")}>
            <ExternalLink aria-hidden />
            Voir sur le site
          </DropdownMenuItem>
        )}
        {!item.isPublished && (
          <DropdownMenuItem onClick={() => setPending({ item, action: "publish" })}>
            <Send aria-hidden />
            Publier maintenant
          </DropdownMenuItem>
        )}
        {item.isPublished && (
          <DropdownMenuItem onClick={() => setPending({ item, action: "unpublish" })}>
            <Undo2 aria-hidden />
            Repasser en brouillon
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )

  return (
    <>
      <section aria-labelledby="titre-liste" className="q-card overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--q-line-soft)] px-4 py-4 md:px-5">
          <h2 id="titre-liste" className="q-h2">
            Articles du blog
          </h2>
          <div className="flex w-full flex-wrap items-center gap-2 lg:w-auto">
            <div className="-mx-4 w-[calc(100%+2rem)] overflow-x-auto px-4 [scrollbar-width:none] md:mx-0 md:w-auto md:px-0">
              <div role="group" aria-label="Filtrer par état" className="q-seg">
                {STATE_TABS.map((t) => (
                  <button key={t.value} type="button" aria-pressed={stateFilter === t.value} onClick={() => setParam("etat", t.value === "tous" ? null : t.value)} className="max-md:!h-11">
                    {t.label}
                    <span className="q-count">{counts[t.value].toLocaleString("fr-FR")}</span>
                  </button>
                ))}
              </div>
            </div>
            <SearchField value={query} onChange={setQuery} placeholder="Rechercher un article…" aria-label="Rechercher un article" className="w-full md:w-[260px]" />
            <div className="w-full md:w-[208px]">
              <Select aria-label="Filtrer par source" value={sourceFilter ? SOURCE_PARAM[sourceFilter] : ""} onChange={(e) => setParam("source", e.target.value || null)}>
                <option value="">Source : toutes</option>
                {sources.map((s) => (
                  <option key={s} value={SOURCE_PARAM[s]}>
                    Source : {ARTICLE_SOURCE_LABELS[s]}
                  </option>
                ))}
              </Select>
            </div>
          </div>
        </div>

        {visible.length === 0 ? (
          <EmptyState
            icon={<FileText className="size-5" aria-hidden />}
            title={items.length === 0 ? "Aucun article" : "Aucun article ne correspond"}
            text={items.length === 0 ? "Générez un premier article à partir d'un sujet ou d'un mot-clé." : "Changez de filtre ou de recherche."}
          />
        ) : (
          <>
            <div className="relative hidden overflow-x-auto md:block">
              <table className="q-table min-w-[1080px] table-fixed">
                <caption className="sr-only">Articles du blog</caption>
                <thead>
                  <tr>
                    <th scope="col">Titre</th>
                    <th scope="col" className="w-[84px]">Type</th>
                    <th scope="col" className="w-[160px]">Mot-clé</th>
                    <th scope="col" className="w-[124px]">Statut</th>
                    <th scope="col" className="w-[128px]">Source</th>
                    <th scope="col" className="w-[108px]" aria-sort={ascending ? "ascending" : "descending"}>
                      <button type="button" onClick={() => setAscending((v) => !v)} className="inline-flex items-center gap-1 text-xs font-semibold text-[var(--q-ink)]">
                        Date
                        {ascending ? <ArrowUp className="size-3.5" aria-hidden /> : <ArrowDown className="size-3.5" aria-hidden />}
                        <span className="sr-only">{ascending ? "(plus anciens d'abord)" : "(plus récents d'abord)"}</span>
                      </button>
                    </th>
                    <th scope="col" className="w-[180px]">Contrôle</th>
                    <th scope="col" className="w-[60px] text-right">
                      <span className="sr-only">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {visible.map((item) => (
                    <tr key={item.id}>
                      <td>
                        <Link href={`/admin/blog/${item.id}`} className="line-clamp-2 font-medium leading-snug text-[var(--q-ink)] hover:text-[var(--q-accent-strong)]">
                          {item.title}
                        </Link>
                        {item.heldReason && item.status === "to_review" && <p className="mt-1 line-clamp-1 text-xs text-[var(--q-warn)]">{item.heldReason}</p>}
                      </td>
                      <td className="text-[13px] text-[var(--q-text-2)]">{item.type ? <TypeTag type={item.type} /> : <Missing />}</td>
                      <td>{item.keyword ? <span className="font-mono text-[13px] leading-snug text-[var(--q-text-2)]">{item.keyword}</span> : <Missing />}</td>
                      <td>
                        <ArticleStatusPill status={item.status} />
                      </td>
                      <td>
                        <Tag>{ARTICLE_SOURCE_LABELS[item.source]}</Tag>
                      </td>
                      <td className="tabular-nums">
                        <DateCell iso={item.date} />
                      </td>
                      <td>
                        <ControlCell item={item} />
                      </td>
                      <td className="text-right">{actions(item)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <ul className="q-list md:hidden" aria-label="Articles du blog">
              {visible.map((item) => (
                <li key={item.id} className="flex items-start gap-2 px-4 py-3.5">
                  <Link href={`/admin/blog/${item.id}`} className="flex min-w-0 flex-1 flex-col gap-2">
                    <span className="flex flex-wrap items-center gap-1.5">
                      <ArticleStatusPill status={item.status} />
                      <TypeTag type={item.type} />
                      <Tag>{ARTICLE_SOURCE_LABELS[item.source]}</Tag>
                    </span>
                    <span className="line-clamp-2 text-base font-semibold leading-snug text-[var(--q-ink)]">{item.title}</span>
                    {item.heldReason && item.status === "to_review" && <span className="text-[13px] text-[var(--q-warn)]">{item.heldReason}</span>}
                    {item.keyword && (
                      <span className="text-[13px] text-[var(--q-text-4)]">
                        Mot-clé : <span className="font-mono text-[var(--q-text-2)]">{item.keyword}</span>
                      </span>
                    )}
                    <span className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] text-[var(--q-text-4)]">
                      {item.date ? `${shortDay(parisDayTime(item.date).day, true)} · ${parisDayTime(item.date).time}` : "Sans date"}
                      <ControlCell item={item} />
                    </span>
                  </Link>
                  {actions(item)}
                </li>
              ))}
            </ul>
          </>
        )}
      </section>

      <Dialog
        open={pending !== null}
        onOpenChange={(o) => {
          if (!o) {
            setPending(null)
            setBlockers(null)
          }
        }}
      >
        <DialogContent showCloseButton={false} className="gap-3 sm:max-w-md">
          <DialogTitle className="text-lg font-semibold leading-tight text-[var(--q-ink)]">
            {pending?.action === "publish" ? "Publier cet article maintenant ?" : "Repasser cet article en brouillon ?"}
          </DialogTitle>
          <DialogDescription className="text-sm text-[var(--q-text-3)]">
            {pending?.action === "publish"
              ? `« ${pending?.item.title} » paraîtra sur le blog et dans le plan du site. Le contrôle automatique repasse d'abord sur le texte.`
              : `« ${pending?.item.title} » quittera le blog ; il reste modifiable dans l'éditeur.`}
          </DialogDescription>
          {blockers && (
            <div role="alert" className="q-banner q-banner-danger !text-[13px]">
              <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
              <div className="flex min-w-0 flex-col gap-1">
                <p className="font-semibold">Publication refusée : {Array.from(new Set(blockers.map((b) => b.label))).join(" ; ")}</p>
                <ul className="list-disc pl-4">
                  {blockers.map((b, i) => (
                    <li key={i}>
                      {b.label}
                      {b.excerpt ? ` : « ${b.excerpt} »` : ""}
                      {b.detail ? <span className="block text-[var(--q-text-2)]">{b.detail}</span> : null}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}
          <div className="mt-2 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button type="button" onClick={() => { setPending(null); setBlockers(null) }} className="q-btn q-btn-ghost">
              {blockers ? "Fermer" : "Annuler"}
            </button>
            {blockers ? (
              <Link href={`/admin/blog/${pending?.item.id}`} className="q-btn q-btn-primary">
                Ouvrir l&apos;article
              </Link>
            ) : (
              <button type="button" onClick={confirm} disabled={busy} className={cn("q-btn", pending?.action === "publish" ? "q-btn-primary" : "q-btn-danger")}>
                {busy && <Loader2 className="animate-spin motion-reduce:animate-none" aria-hidden />}
                {pending?.action === "publish" ? "Publier" : "Repasser en brouillon"}
              </button>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <GenerateDialog open={generateOpen} onClose={() => setParam("generer", null)} data={generate} />
    </>
  )
}
