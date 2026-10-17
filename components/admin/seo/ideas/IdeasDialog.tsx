"use client"

/**
 * Fenêtre « Proposition IA » : des requêtes exactes, pensées comme l'artisan
 * qui tape sa recherche, vérifiées dans Google et mesurées avant d'être
 * montrées (POST /api/admin/seo/ideas), puis adoptées en un clic
 * (POST /api/admin/seo/ideas/adopt).
 *
 * Deux modes :
 * - « topics » (fenêtre « Générer un article », écran Sujets) : choisir une
 *   situation, un métier ou écrire un angle ; chaque idée se transforme en
 *   sujet d'article (et en mot-clé suivi) ou entre seulement dans le suivi ;
 * - « article » (éditeur) : la recherche part du titre et du texte de
 *   l'article ; « Utiliser pour cet article » pose le mot-clé principal.
 *
 * La fenêtre ne garde rien en mémoire entre deux ouvertures. Une réponse
 * tardive d'une recherche abandonnée est ignorée.
 */
import { useCallback, useEffect, useRef, useState } from "react"
import Link from "next/link"
import { toast } from "sonner"
import { ArrowUpRight, Check, Info, Loader2, RotateCcw, Sparkles, TriangleAlert } from "lucide-react"
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog"
import { StatusPill } from "@/components/app/kit"
import { cn } from "@/lib/utils"
import { TRADE_LABELS, type TradeId } from "@/lib/blog-images/trades"
import type { ArticleType } from "@/lib/seo/types"
import { IDEA_SITUATIONS, IDEA_STAGE_LABELS, type AdoptResult, type Idea, type IdeasResponse } from "@/lib/seo/ideas/types"
import { api } from "@/components/admin/seo/articles/api"
import { Field, Select } from "@/components/admin/seo/articles/fields"
import { Tag, TypeTag } from "@/components/admin/seo/articles/pills"
import { DifficultyPill } from "@/components/admin/blog/seo/KeywordPicker"

/** Le début du texte suffit à comprendre l'article ; le serveur plafonne aussi. */
const ARTICLE_CONTENT_MAX = 6_000

const nf = (n: number) => Math.round(n).toLocaleString("fr-FR")

export interface IdeasArticle {
  title: string
  content: string
  keyword: string | null
  articleType?: ArticleType
}

export interface IdeasDialogProps {
  open: boolean
  onClose: () => void
  mode: "topics" | "article"
  /** Mode « article » : l'article dont on cherche la requête exacte. */
  article?: IdeasArticle
  /** Mode « topics » : une idée est devenue un sujet (ou a rejoint le suivi seul). */
  onAdopted?: (result: AdoptResult, idea: Idea) => void
  /** Mode « article » : « Utiliser pour cet article » (le mot-clé est déjà ajouté au suivi). */
  onUse?: (idea: Idea) => void
}

type Phase = "idle" | "loading" | "done" | "error"

interface Adopted {
  topicId: string | null
  topicExisting: boolean
}

const TRADE_OPTIONS = (Object.keys(TRADE_LABELS) as TradeId[]).map((id) => ({ id, label: TRADE_LABELS[id] })).sort((a, b) => a.label.localeCompare(b.label, "fr"))

export function IdeasDialog({ open, onClose, mode, article, onAdopted, onUse }: IdeasDialogProps) {
  const [phase, setPhase] = useState<Phase>("idle")
  const [response, setResponse] = useState<IdeasResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [situation, setSituation] = useState<string | null>(null)
  const [trade, setTrade] = useState("")
  const [focus, setFocus] = useState("")
  const [adopted, setAdopted] = useState<Record<string, Adopted>>({})
  const [adopting, setAdopting] = useState<string | null>(null)
  // Formulaire déplié tant qu'aucune recherche n'a été lancée ; replié en une ligne ensuite
  const [editing, setEditing] = useState(true)
  const requestId = useRef(0)
  const articleRef = useRef(article)
  articleRef.current = article

  const run = useCallback(async () => {
    const id = ++requestId.current
    setPhase("loading")
    setError(null)
    setEditing(false)
    const current = articleRef.current
    const res = await api<IdeasResponse>("/api/admin/seo/ideas", "POST", {
      mode,
      ...(mode === "topics" ? { focus: focus.trim() || undefined, trade: trade || undefined } : { article: current && { ...current, content: current.content.slice(0, ARTICLE_CONTENT_MAX) } }),
    })
    if (id !== requestId.current) return
    if (!res.ok || !res.data) {
      setError(res.error)
      setPhase("error")
      setEditing(true)
      return
    }
    setResponse(res.data)
    setAdopted({})
    setPhase("done")
  }, [mode, focus, trade])

  // À l'ouverture : tout repart de zéro ; dans l'éditeur la recherche part tout de suite
  useEffect(() => {
    if (!open) {
      requestId.current++
      return
    }
    setPhase("idle")
    setResponse(null)
    setError(null)
    setAdopted({})
    setAdopting(null)
    setEditing(true)
    if (mode === "article") void run()
    // run dépend de l'angle saisi : seule l'ouverture relance
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, mode])

  function pickSituation(id: string) {
    const next = situation === id ? null : id
    setSituation(next)
    setFocus(next ? (IDEA_SITUATIONS.find((s) => s.id === next)?.focus ?? "") : "")
  }

  async function adopt(idea: Idea, withTopic: boolean) {
    if (adopting) return
    setAdopting(idea.keyword)
    const res = await api<AdoptResult>("/api/admin/seo/ideas/adopt", "POST", {
      keyword: idea.keyword,
      title: idea.title,
      articleType: idea.articleType,
      intent: idea.intent,
      volume: idea.volume,
      difficulty: idea.difficulty,
      cpc: idea.cpc,
      note: idea.why === "—" ? null : idea.why,
      createTopic: withTopic,
      targeted: mode === "article",
    })
    setAdopting(null)
    if (mode === "article") {
      if (!res.ok) toast.info(`Mot-clé utilisé, mais pas ajouté au suivi : ${res.error ?? "erreur"}`)
      onUse?.(idea)
      onClose()
      return
    }
    if (!res.ok || !res.data) {
      toast.error(res.error ?? "Adoption impossible")
      return
    }
    setAdopted((prev) => ({ ...prev, [idea.keyword]: { topicId: res.data?.topicId ?? null, topicExisting: Boolean(res.data?.topicExisting) } }))
    toast.success(withTopic ? (res.data.topicExisting ? "Un sujet existait déjà pour ce mot-clé" : "Sujet créé") : "Mot-clé ajouté au suivi")
    onAdopted?.(res.data, idea)
  }

  const loading = phase === "loading"

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="flex max-h-[calc(100dvh-2rem)] flex-col gap-0 overflow-hidden p-0 sm:max-w-[680px]">
        <div className="flex flex-col gap-1 px-6 pb-3 pr-14 pt-5">
          <DialogTitle className="flex items-center gap-2 text-base font-semibold tracking-[-0.01em] text-[var(--q-ink)]">
            <Sparkles className="size-4 text-[var(--q-accent)]" aria-hidden />
            Proposition IA
          </DialogTitle>
          <DialogDescription className="text-[13px] text-[var(--q-text-4)]">
            {mode === "article"
              ? "Les recherches exactes que tape la personne pour laquelle cet article est la bonne réponse."
              : "Des recherches exactes, pensées comme l'artisan qui cherche, vérifiées dans Google avant d'être proposées."}
          </DialogDescription>
        </div>

        <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-6 pb-5 pt-1">
          {mode === "topics" && !editing && (
            <div className="flex flex-col gap-2.5 rounded-xl border border-[var(--q-line)] bg-[var(--q-surface-2)] p-3 sm:flex-row sm:items-center sm:py-2.5 sm:pl-3.5 sm:pr-2.5">
              <p className="min-w-0 flex-1 text-[13px] leading-snug text-[var(--q-text-2)] [overflow-wrap:anywhere]">{summaryOf(situation, focus, trade)}</p>
              <div className="flex shrink-0 items-center gap-2 max-sm:[&>*]:flex-1">
                <button type="button" onClick={() => setEditing(true)} disabled={loading} className="q-btn q-btn-ghost q-btn-sm max-md:!h-11">
                  Modifier
                </button>
                <button type="button" onClick={() => void run()} disabled={loading} className="q-btn q-btn-secondary q-btn-sm max-md:!h-11">
                  {loading ? <Loader2 className="animate-spin motion-reduce:animate-none" aria-hidden /> : <RotateCcw aria-hidden />}
                  {loading ? "Recherche en cours…" : "Relancer"}
                </button>
              </div>
            </div>
          )}
          {mode === "topics" && editing && (
            <form
              className="flex flex-col gap-3.5"
              onSubmit={(e) => {
                e.preventDefault()
                if (!loading) void run()
              }}
              noValidate
            >
              <div className="flex flex-col gap-1.5">
                <span id="idees-situation" className="q-label">
                  Qui cherche ?
                </span>
                <div role="group" aria-labelledby="idees-situation" className="flex flex-wrap gap-2">
                  {IDEA_SITUATIONS.map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      aria-pressed={situation === s.id}
                      onClick={() => pickSituation(s.id)}
                      className={cn(
                        "inline-flex min-h-11 items-center rounded-full border px-3.5 text-[13px] font-medium transition-colors md:min-h-8",
                        situation === s.id
                          ? "border-[var(--q-accent)] bg-[var(--q-wash)] text-[var(--q-accent-ink)]"
                          : "border-[var(--q-line)] bg-[var(--q-surface)] text-[var(--q-text-2)] hover:bg-[var(--q-hover)]",
                      )}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-[200px_1fr]">
                <Field label="Métier" htmlFor="idees-metier">
                  <Select id="idees-metier" value={trade} onChange={(e) => setTrade(e.target.value)}>
                    <option value="">Tous les métiers</option>
                    {TRADE_OPTIONS.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.label.charAt(0).toLocaleUpperCase("fr-FR") + t.label.slice(1)}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label="Angle (facultatif)" htmlFor="idees-angle">
                  <input
                    id="idees-angle"
                    className="q-input"
                    value={focus}
                    onChange={(e) => {
                      setFocus(e.target.value)
                      setSituation(null)
                    }}
                    maxLength={300}
                    placeholder="Par exemple : relancer un client qui ne paie pas"
                  />
                </Field>
              </div>
              <div>
                <button type="submit" disabled={loading} className="q-btn q-btn-primary max-sm:q-btn-lg max-sm:w-full">
                  {loading ? <Loader2 className="animate-spin motion-reduce:animate-none" aria-hidden /> : <Sparkles aria-hidden />}
                  {loading ? "Recherche en cours…" : phase === "done" ? "Relancer la recherche" : "Proposer des idées"}
                </button>
              </div>
            </form>
          )}

          {loading && <Loading mode={mode} />}

          {phase === "error" && (
            <div role="alert" className="q-banner q-banner-danger !text-[13px]">
              <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
              <div className="flex min-w-0 flex-1 flex-col gap-2">
                <span>{error}</span>
                <button type="button" onClick={() => void run()} className="q-btn q-btn-secondary q-btn-sm self-start max-md:!h-11">
                  <RotateCcw aria-hidden />
                  Réessayer
                </button>
              </div>
            </div>
          )}

          {phase === "done" && response && (
            <>
              {response.notes.length > 0 && (
                <ul className="m-0 flex list-none flex-col gap-1.5 p-0" aria-label="Remarques">
                  {response.notes.map((n) => (
                    <li key={n} className="flex items-start gap-1.5 text-[12.5px] leading-snug text-[var(--q-text-3)]">
                      <Info className="mt-0.5 size-3.5 shrink-0 text-[var(--q-text-4)]" aria-hidden />
                      {n}
                    </li>
                  ))}
                </ul>
              )}
              {response.ideas.length === 0 ? (
                <div className="flex flex-col items-start gap-3 rounded-xl border border-[var(--q-line)] bg-[var(--q-surface-2)] p-4 text-[13px] text-[var(--q-text-3)]">
                  <p>Aucune idée ne ressort de cette recherche.</p>
                  <button type="button" onClick={() => void run()} className="q-btn q-btn-secondary q-btn-sm max-md:!h-11">
                    <RotateCcw aria-hidden />
                    Relancer
                  </button>
                </div>
              ) : (
                <ul className="m-0 flex list-none flex-col gap-3 p-0" aria-label="Idées proposées">
                  {response.ideas.map((idea) => (
                    <li key={idea.keyword}>
                      <IdeaCard
                        idea={idea}
                        mode={mode}
                        adopted={adopted[idea.keyword] ?? null}
                        busy={adopting === idea.keyword}
                        disabled={adopting !== null}
                        onAdopt={(withTopic) => void adopt(idea, withTopic)}
                      />
                    </li>
                  ))}
                </ul>
              )}
              <p className="text-[12px] leading-snug text-[var(--q-text-4)]">
                Idées par {response.model}. Volumes et difficulté : DataForSEO. Existence de la phrase : saisie semi-automatique de Google.
              </p>
            </>
          )}
        </div>

        <div className="flex justify-end gap-2 border-t border-[var(--q-line-soft)] px-6 py-3.5">
          {mode === "article" && phase === "done" && (
            <button type="button" onClick={() => void run()} className="q-btn q-btn-secondary max-sm:q-btn-lg max-sm:flex-1">
              <RotateCcw aria-hidden />
              Autres idées
            </button>
          )}
          <button type="button" onClick={onClose} className="q-btn q-btn-ghost max-sm:q-btn-lg max-sm:flex-1">
            Fermer
          </button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

/** « Je me fais payer · plombier » : ce qui a été demandé, en une ligne. */
function summaryOf(situation: string | null, focus: string, trade: string): string {
  const label = IDEA_SITUATIONS.find((s) => s.id === situation)?.label
  const angle = label ?? (focus.trim() ? `« ${focus.trim()} »` : "Toutes les situations")
  const job = trade in TRADE_LABELS ? TRADE_LABELS[trade as TradeId] : "tous les métiers"
  return `${angle} · ${job}`
}

/* ------------------------------------------------------------------ */
/* Chargement                                                          */
/* ------------------------------------------------------------------ */

function Loading({ mode }: { mode: "topics" | "article" }) {
  return (
    <div role="status" aria-live="polite" className="flex flex-col gap-3">
      <p className="flex items-center gap-2 text-[13px] text-[var(--q-text-3)]">
        <Loader2 className="size-4 shrink-0 animate-spin text-[var(--q-accent)] motion-reduce:animate-none" aria-hidden />
        {mode === "article" ? "Recherche des requêtes exactes de cet article…" : "Réflexion en cours, puis vérification dans Google. Comptez 20 à 40 secondes."}
      </p>
      <div className="flex flex-col gap-3" aria-hidden>
        {[0, 1, 2].map((i) => (
          <div key={i} className="flex flex-col gap-2.5 rounded-xl border border-[var(--q-line)] p-4">
            <span className={cn("h-4 animate-pulse rounded bg-[var(--q-sunken)] motion-reduce:animate-none", i % 2 ? "w-1/2" : "w-2/3")} />
            <span className="h-3 w-1/3 animate-pulse rounded bg-[var(--q-sunken)] motion-reduce:animate-none" />
            <span className="h-3 w-5/6 animate-pulse rounded bg-[var(--q-sunken)] motion-reduce:animate-none" />
          </div>
        ))}
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Une idée                                                            */
/* ------------------------------------------------------------------ */

function IdeaCard({
  idea,
  mode,
  adopted,
  busy,
  disabled,
  onAdopt,
}: {
  idea: Idea
  mode: "topics" | "article"
  adopted: Adopted | null
  busy: boolean
  disabled: boolean
  onAdopt: (withTopic: boolean) => void
}) {
  const blocking = idea.overlaps.some((o) => o.kind === "article" || o.kind === "ranking")
  return (
    <article className="flex flex-col gap-3 rounded-xl border border-[var(--q-line)] bg-[var(--q-surface)] p-4">
      <div className="flex flex-col gap-1.5">
        <h3 className="text-[15px] font-semibold leading-snug text-[var(--q-ink)] [overflow-wrap:anywhere]">{idea.keyword}</h3>
        <div className="flex flex-wrap items-center gap-1.5">
          {idea.verified ? (
            <StatusPill tone="ok" icon={<Check strokeWidth={2.75} aria-hidden />}>
              Vu dans Google
            </StatusPill>
          ) : (
            <span title="Google n'a pas proposé cette phrase quand on la tape (ou n'a pas répondu)">
              <StatusPill tone="neutral">Non vérifié</StatusPill>
            </span>
          )}
          {idea.volume !== null ? (
            <Tag className="q-num tabular-nums">{nf(idea.volume)}/mois</Tag>
          ) : (
            <span title="Volume non mesuré">
              <Tag>Volume inconnu</Tag>
            </span>
          )}
          <DifficultyPill value={idea.difficulty} />
          <Tag>{IDEA_STAGE_LABELS[idea.stage]}</Tag>
          {mode === "topics" && <TypeTag type={idea.articleType} />}
          {idea.tracked && <Tag>Déjà suivi</Tag>}
        </div>
      </div>

      {mode === "topics" && (
        <p className="text-[13px] leading-snug text-[var(--q-text-2)]">
          <span className="text-[var(--q-text-4)]">Titre de l&apos;article : </span>
          {idea.title}
        </p>
      )}
      {idea.why !== "—" && <p className="text-[13px] leading-snug text-[var(--q-text-3)]">{idea.why}</p>}
      {idea.googleAlso.length > 0 && (
        <p className="text-[12.5px] leading-snug text-[var(--q-text-4)]">
          Google propose aussi : {idea.googleAlso.map((g) => `« ${g} »`).join(", ")}
        </p>
      )}

      {(idea.warnings.length > 0 || idea.overlaps.length > 0) && (
        <ul className="m-0 flex list-none flex-col gap-1.5 p-0">
          {idea.warnings.map((w) => (
            <li key={w} className="flex items-start gap-1.5 text-[12.5px] leading-snug text-[var(--q-warn)]">
              <TriangleAlert className="mt-0.5 size-3.5 shrink-0" aria-hidden />
              {w}
            </li>
          ))}
          {idea.overlaps.map((o) => (
            <li key={`${o.kind}-${o.label}`} className="flex items-start gap-1.5 text-[12.5px] leading-snug text-[var(--q-warn)]">
              <TriangleAlert className="mt-0.5 size-3.5 shrink-0" aria-hidden />
              <span className="min-w-0">
                {o.label}
                {o.detail ? ` — ${o.detail}` : ""}
                {o.path && (
                  <>
                    {" "}
                    <a href={o.path} target="_blank" rel="noopener noreferrer" className="q-link inline-flex items-baseline gap-0.5">
                      Voir
                      <ArrowUpRight className="size-3 self-center" aria-hidden />
                      <span className="sr-only"> (nouvel onglet)</span>
                    </a>
                  </>
                )}
              </span>
            </li>
          ))}
        </ul>
      )}

      <div className="flex flex-wrap items-center gap-2">
        {mode === "article" ? (
          <button type="button" onClick={() => onAdopt(false)} disabled={disabled} className="q-btn q-btn-primary q-btn-sm max-md:!h-11">
            {busy ? <Loader2 className="animate-spin motion-reduce:animate-none" aria-hidden /> : <Check aria-hidden />}
            Utiliser pour cet article
          </button>
        ) : adopted ? (
          <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] font-medium text-[var(--q-ok)]" role="status">
            <Check className="size-4" aria-hidden />
            {adopted.topicId ? (adopted.topicExisting ? "Sujet déjà en place" : "Sujet créé") : "Ajouté au suivi"}
            <Link href={adopted.topicId ? "/admin/seo/articles/sujets" : "/admin/seo/mots-cles"} className="q-link font-normal">
              {adopted.topicId ? "Voir les sujets" : "Voir les mots-clés"}
            </Link>
          </p>
        ) : (
          <>
            <button type="button" onClick={() => onAdopt(true)} disabled={disabled} className={cn("q-btn q-btn-sm max-md:!h-11", blocking ? "q-btn-secondary" : "q-btn-primary")}>
              {busy ? <Loader2 className="animate-spin motion-reduce:animate-none" aria-hidden /> : <Sparkles aria-hidden />}
              {blocking ? "Créer le sujet quand même" : "Créer le sujet"}
            </button>
            {!idea.tracked && (
              <button type="button" onClick={() => onAdopt(false)} disabled={disabled} className="q-btn q-btn-ghost q-btn-sm max-md:!h-11">
                Suivre seulement
              </button>
            )}
          </>
        )}
      </div>
    </article>
  )
}
