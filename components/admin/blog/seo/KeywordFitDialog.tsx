"use client"

/**
 * Fenêtre « Intégrer avec l'IA » : le modèle propose de retoucher quelques
 * passages de l'article pour y faire figurer un mot-clé (secondaire « Absent »,
 * mot-clé du sous-titre, mot-clé de l'introduction), POST
 * /api/admin/blog/integrate-keyword.
 *
 * Chaque proposition montre le passage avant et après, les mots changés
 * surlignés, les points à vérifier ; elle se coche ou se décoche. « Appliquer »
 * remplace les passages cochés d'un coup (`onApply`, un seul pas d'annulation
 * dans l'éditeur) : rien n'est remplacé avant, rien n'est enregistré par la
 * fenêtre. « Autres passages » relance en écartant ceux déjà vus.
 *
 * La fenêtre ne garde rien en mémoire entre deux ouvertures ; la réponse
 * tardive d'une demande abandonnée est ignorée.
 */
import { useCallback, useEffect, useRef, useState } from "react"
import { toast } from "sonner"
import { Check, Loader2, RefreshCw, Sparkles, TriangleAlert } from "lucide-react"
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog"
import { cn } from "@/lib/utils"
import { api } from "@/components/admin/seo/articles/api"
import { diffWords, type DiffPart } from "@/lib/blog-editor/word-diff"
import type { IntegrateMode, IntegrateProposal, IntegrateRequest, IntegrateResponse } from "@/lib/seo/articles/editor-types"

export interface KeywordFitRequest {
  mode: IntegrateMode
  keyword: string
}

export interface KeywordFitArticle {
  markdown: string
  title: string
  mainKeyword: string | null
}

export interface KeywordFitDialogProps {
  /** Ce qu'il faut placer ; null : fenêtre fermée. */
  request: KeywordFitRequest | null
  /** Texte de l'article au moment de la demande. */
  getArticle: () => KeywordFitArticle
  /** Remplace les passages dans l'éditeur ; rend ce qui a été fait. */
  onApply: (edits: { excerpt: string; text: string }[]) => { applied: number; missed: string[] }
  onClose: () => void
}

type Phase = { kind: "loading" } | { kind: "ready"; proposals: IntegrateProposal[]; note: string | null } | { kind: "error"; message: string }

const TITLES: Record<IntegrateMode, (keyword: string) => string> = {
  secondary: (k) => `Intégrer « ${k} » dans le texte`,
  heading: (k) => `Mettre « ${k} » dans un sous-titre`,
  intro: (k) => `Mettre « ${k} » dans l'introduction`,
}

const DESCRIPTIONS: Record<IntegrateMode, string> = {
  secondary: "L'IA cherche les passages du développement où ce mot-clé se lit naturellement et ne retouche que ceux-là. Relisez, cochez, puis appliquez.",
  heading: "L'IA retouche un seul sous-titre pour qu'il reprenne le mot-clé, sans changer le sujet de sa section.",
  intro: "L'IA retouche le premier paragraphe pour que le lecteur sache dès les premières lignes de quoi parle l'article.",
}

function Words({ parts, tone }: { parts: DiffPart[]; tone: "before" | "after" }) {
  return (
    <>
      {parts.map((p, i) => (
        <span
          key={i}
          className={cn(
            p.changed && tone === "before" && "rounded-[3px] bg-[var(--q-danger-bg)] text-[var(--q-danger)] line-through decoration-[var(--q-danger)]/50",
            p.changed && tone === "after" && "rounded-[3px] bg-[var(--q-ok-bg)] font-medium text-[var(--q-ok)]",
          )}
        >
          {p.text}
          {i < parts.length - 1 ? " " : ""}
        </span>
      ))}
    </>
  )
}

function ProposalCard({ proposal, checked, onToggle }: { proposal: IntegrateProposal; checked: boolean; onToggle: () => void }) {
  const diff = diffWords(proposal.before, proposal.after)
  return (
    <li className={cn("rounded-xl border bg-[var(--q-surface)] px-3.5 py-3", checked ? "border-[var(--q-accent-line,var(--q-line))]" : "border-[var(--q-line)] opacity-80")}>
      <label className="flex cursor-pointer items-start gap-3 max-md:min-h-11">
        <input type="checkbox" checked={checked} onChange={onToggle} className="mt-0.5 size-[18px] shrink-0 accent-[var(--q-accent)]" />
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="text-[12px] font-semibold uppercase tracking-[0.06em] text-[var(--q-text-4)]">{proposal.section}</span>
          <span className="text-[12.5px] text-[var(--q-text-4)]">{checked ? "Sera modifié" : "Laissé tel quel"}</span>
        </span>
      </label>
      <div className="mt-2 grid gap-2.5 md:grid-cols-2">
        <div className="min-w-0">
          <p className="m-0 mb-1 text-[11.5px] font-semibold text-[var(--q-text-4)]">Avant</p>
          <p className="m-0 text-[13px] leading-relaxed text-[var(--q-text-2)] [overflow-wrap:anywhere]">
            <Words parts={diff.before} tone="before" />
          </p>
        </div>
        <div className="min-w-0">
          <p className="m-0 mb-1 text-[11.5px] font-semibold text-[var(--q-accent-strong)]">Après</p>
          <p className="m-0 text-[13px] leading-relaxed text-[var(--q-ink)] [overflow-wrap:anywhere]">
            <Words parts={diff.after} tone="after" />
          </p>
        </div>
      </div>
      {proposal.warnings.length > 0 && (
        <ul className="m-0 mt-2.5 flex list-none flex-col gap-1 p-0">
          {proposal.warnings.map((w) => (
            <li key={w} className="flex items-start gap-1.5 text-[12px] leading-snug text-[var(--q-warn)]">
              <TriangleAlert className="mt-0.5 size-3.5 shrink-0" aria-hidden />
              {w}
            </li>
          ))}
        </ul>
      )}
    </li>
  )
}

export function KeywordFitDialog({ request, getArticle, onApply, onClose }: KeywordFitDialogProps) {
  const [phase, setPhase] = useState<Phase>({ kind: "loading" })
  const [checked, setChecked] = useState<Set<string>>(new Set())
  const [applyError, setApplyError] = useState<string | null>(null)
  const runId = useRef(0)
  const seen = useRef<string[]>([])

  const load = useCallback(
    async (req: KeywordFitRequest) => {
      const id = ++runId.current
      setPhase({ kind: "loading" })
      setApplyError(null)
      const article = getArticle()
      const body: IntegrateRequest = {
        mode: req.mode,
        keyword: req.keyword,
        markdown: article.markdown,
        title: article.title.trim() || undefined,
        mainKeyword: article.mainKeyword,
        ...(seen.current.length > 0 ? { avoid: seen.current.slice(-12) } : {}),
      }
      const res = await api<IntegrateResponse>("/api/admin/blog/integrate-keyword", "POST", body)
      if (id !== runId.current) return
      if (!res.ok || !res.data) {
        setPhase({ kind: "error", message: res.error ?? "La proposition n'a pas pu être faite. Réessayez dans un instant." })
        return
      }
      const proposals = res.data.proposals
      seen.current = [...seen.current, ...proposals.map((p) => p.before)]
      setChecked(new Set(proposals.map((p) => p.id)))
      setPhase({ kind: "ready", proposals, note: res.data.note })
    },
    [getArticle],
  )

  // Fenêtre ouverte : première demande ; fermée : tout est oublié et une réponse tardive est ignorée
  useEffect(() => {
    if (!request) {
      runId.current++
      seen.current = []
      return
    }
    seen.current = []
    void load(request)
  }, [request, load])

  const toggle = (id: string) =>
    setChecked((current) => {
      const next = new Set(current)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  function apply() {
    if (phase.kind !== "ready") return
    const chosen = phase.proposals.filter((p) => checked.has(p.id))
    if (chosen.length === 0) return
    const result = onApply(chosen.map((p) => ({ excerpt: p.before, text: p.after })))
    if (result.applied === 0) {
      setApplyError("Le texte a changé depuis la proposition : les passages ne sont plus là. Relancez la proposition.")
      return
    }
    toast.success(result.applied > 1 ? `${result.applied} passages modifiés (Ctrl+Z pour annuler)` : "Passage modifié (Ctrl+Z pour annuler)")
    if (result.applied < chosen.length) toast.warning(`${chosen.length - result.applied} passage${chosen.length - result.applied > 1 ? "s" : ""} n'a pas pu être remplacé : le texte a changé.`)
    onClose()
  }

  const count = phase.kind === "ready" ? phase.proposals.filter((p) => checked.has(p.id)).length : 0

  return (
    <Dialog open={request !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="flex max-h-[calc(100dvh-2rem)] flex-col gap-0 overflow-hidden p-0 sm:max-w-[760px]">
        <div className="flex flex-col gap-1 px-6 pb-3 pr-14 pt-5">
          <DialogTitle className="flex items-center gap-2 text-base font-semibold tracking-[-0.01em] text-[var(--q-ink)]">
            <Sparkles className="size-4 shrink-0 text-[var(--q-accent)]" aria-hidden />
            {request ? TITLES[request.mode](request.keyword) : "Intégrer le mot-clé"}
          </DialogTitle>
          <DialogDescription className="text-[13px] text-[var(--q-text-4)]">{request ? DESCRIPTIONS[request.mode] : ""}</DialogDescription>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-6 pb-4" aria-live="polite" aria-busy={phase.kind === "loading"}>
          {phase.kind === "loading" && (
            <p className="m-0 flex items-center gap-2 py-6 text-[13px] text-[var(--q-text-3)]">
              <Loader2 className="size-4 animate-spin motion-reduce:animate-none" aria-hidden />
              Recherche des passages où le mot-clé se lit naturellement…
            </p>
          )}
          {phase.kind === "error" && (
            <p role="alert" className="m-0 flex items-start gap-2 py-4 text-[13px] leading-snug text-[var(--q-danger)]">
              <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
              {phase.message}
            </p>
          )}
          {phase.kind === "ready" && (
            <>
              {phase.proposals.length > 0 ? (
                <ul className="m-0 flex list-none flex-col gap-3 p-0">
                  {phase.proposals.map((p) => (
                    <ProposalCard key={p.id} proposal={p} checked={checked.has(p.id)} onToggle={() => toggle(p.id)} />
                  ))}
                </ul>
              ) : (
                <p className="m-0 py-4 text-[13px] leading-snug text-[var(--q-text-3)]">{phase.note ?? "Aucune proposition."}</p>
              )}
              {phase.proposals.length > 0 && phase.note && <p className="m-0 mt-3 text-[12.5px] leading-snug text-[var(--q-text-4)]">{phase.note}</p>}
            </>
          )}
          {applyError && (
            <p role="alert" className="m-0 mt-3 flex items-start gap-2 text-[13px] leading-snug text-[var(--q-danger)]">
              <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
              {applyError}
            </p>
          )}
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2 border-t border-[var(--q-line)] px-6 py-3.5">
          <button type="button" onClick={onClose} className="q-btn q-btn-ghost max-md:!h-11">
            Fermer
          </button>
          <button type="button" onClick={() => request && void load(request)} disabled={phase.kind === "loading" || !request} className="q-btn q-btn-secondary max-md:!h-11">
            <RefreshCw aria-hidden />
            {phase.kind === "ready" && phase.proposals.length > 0 ? "Autres passages" : "Réessayer"}
          </button>
          {phase.kind === "ready" && phase.proposals.length > 0 && (
            <button type="button" onClick={apply} disabled={count === 0} className="q-btn q-btn-primary max-md:!h-11" data-primary="">
              <Check aria-hidden />
              {count > 1 ? `Appliquer les ${count} modifications` : "Appliquer la modification"}
            </button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
