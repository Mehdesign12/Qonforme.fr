"use client"

/**
 * Mots-clés secondaires d'un article (panneau Référencement de l'éditeur) :
 * mots-clés suivis proches du principal et recherches qui affichent déjà
 * l'article (secondaryCandidates, lib/seo/articles/secondary.ts), avec leur
 * présence dans le texte (« 3 fois » / « Absent », accents, casse et pluriel
 * ignorés), un bouton œil qui les surligne dans l'éditeur et un bouton qui
 * les copie.
 *
 * Le surlignage est piloté par l'éditeur : `highlighted` (termes surlignés)
 * et `onHighlightChange` (nouvelle liste).
 *
 * Un mot-clé absent du texte porte « Intégrer avec l'IA » (`onIntegrate`) :
 * l'éditeur ouvre la fenêtre qui propose les passages à retoucher.
 *
 * Les mots-clés ajoutés à la main depuis la Proposition IA (`extra`, « Ajouter
 * aux secondaires ») s'affichent avec les autres, marqués « Ajouté », et se
 * retirent (`onRemoveExtra`).
 */
import { useMemo, useState } from "react"
import { toast } from "sonner"
import { Check, Copy, Eye, Search, Sparkles, X } from "lucide-react"
import { cn } from "@/lib/utils"
import { countKeyword, markdownPlainText } from "@/lib/seo/articles/onpage"
import { keywordKey, secondaryCandidates, type SecondaryCandidate } from "@/lib/seo/articles/secondary"
import type { EditorKeyword, PageQuery } from "@/lib/seo/articles/editor-types"

const nf = (n: number) => Math.round(n).toLocaleString("fr-FR")

const iconButton =
  "inline-flex size-8 shrink-0 items-center justify-center rounded-lg text-[var(--q-text-4)] transition-colors duration-100 hover:bg-[var(--q-hover)] hover:text-[var(--q-ink)] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[var(--q-focus)] motion-reduce:transition-none max-md:size-11"

export function SecondaryKeywords({
  keyword,
  keywords,
  pageQueries,
  title,
  content,
  highlighted,
  onHighlightChange,
  onIntegrate,
  extra = [],
  onRemoveExtra,
  loading = false,
  className,
}: {
  /** Mot-clé principal (null : aucun). */
  keyword: string | null
  keywords: EditorKeyword[]
  pageQueries: PageQuery[]
  /** Titre de l'article et texte en Markdown : présence des mots-clés. */
  title: string
  content: string
  /** Termes surlignés dans l'éditeur. */
  highlighted: string[]
  onHighlightChange: (terms: string[]) => void
  /** « Intégrer avec l'IA » sur un mot-clé absent du texte. */
  onIntegrate?: (keyword: string) => void
  /** Mots-clés ajoutés à la main (Proposition IA › « Ajouter aux secondaires »). */
  extra?: { keyword: string; volume: number | null }[]
  onRemoveExtra?: (keyword: string) => void
  /** Contexte en cours de premier chargement (squelette). */
  loading?: boolean
  className?: string
}) {
  const [copied, setCopied] = useState<string | null>(null)
  const computed = useMemo(() => secondaryCandidates(keyword, keywords, pageQueries), [keyword, keywords, pageQueries])
  // Les mots-clés ajoutés à la main suivent ceux de l'analyse (sans doublon)
  const addedKeys = useMemo(() => new Set(extra.map((e) => keywordKey(e.keyword))), [extra])
  const candidates = useMemo<(SecondaryCandidate & { added?: boolean })[]>(() => {
    const seen = new Set(computed.map((c) => keywordKey(c.keyword)))
    const added = extra.filter((e) => !seen.has(keywordKey(e.keyword))).map((e) => ({ keyword: e.keyword, volume: e.volume, impressions: null, fromPlan: false, fromPage: false, added: true }))
    return [...computed.map((c) => (addedKeys.has(keywordKey(c.keyword)) ? { ...c, added: true } : c)), ...added]
  }, [computed, extra, addedKeys])
  const text = useMemo(() => `${title}\n${markdownPlainText(content)}`, [title, content])
  const counts = useMemo(() => new Map(candidates.map((c) => [c.keyword, countKeyword(text, c.keyword)])), [candidates, text])
  const highlightedKeys = useMemo(() => new Set(highlighted.map(keywordKey)), [highlighted])

  if (!keyword?.trim() && candidates.length === 0) {
    return (
      <p className={cn("flex items-start gap-2 text-[12.5px] leading-snug text-[var(--q-text-4)]", className)}>
        <Search className="mt-px size-3.5 shrink-0" aria-hidden />
        Choisissez d&apos;abord le mot-clé principal : les mots-clés proches s&apos;afficheront ici.
      </p>
    )
  }

  if (loading && candidates.length === 0) {
    return (
      <ul className={cn("m-0 flex list-none flex-col gap-3 p-0", className)} aria-hidden>
        {[0, 1, 2].map((i) => (
          <li key={i} className="flex items-center gap-3">
            <span className="flex flex-1 flex-col gap-1.5">
              <span className={cn("h-3.5 animate-pulse rounded bg-[var(--q-sunken)] motion-reduce:animate-none", i === 1 ? "w-1/2" : "w-3/4")} />
              <span className="h-3 w-1/4 animate-pulse rounded bg-[var(--q-sunken)] motion-reduce:animate-none" />
            </span>
            <span className="h-5 w-12 animate-pulse rounded-full bg-[var(--q-sunken)] motion-reduce:animate-none" />
          </li>
        ))}
      </ul>
    )
  }

  if (candidates.length === 0) {
    return (
      <p className={cn("text-[12.5px] leading-snug text-[var(--q-text-4)]", className)}>
        Aucun mot-clé suivi n&apos;est proche de « {keyword} » pour l&apos;instant. Les recherches qui affichent l&apos;article s&apos;ajouteront ici après sa publication.
      </p>
    )
  }

  const toggle = (term: string) => {
    const key = keywordKey(term)
    onHighlightChange(highlightedKeys.has(key) ? highlighted.filter((h) => keywordKey(h) !== key) : [...highlighted, term])
  }

  const copy = async (term: string) => {
    try {
      await navigator.clipboard.writeText(term)
      setCopied(term)
      toast.success("Mot-clé copié")
      window.setTimeout(() => setCopied((c) => (c === term ? null : c)), 1600)
    } catch {
      toast.error("Copie impossible : sélectionnez le mot-clé à la main.")
    }
  }

  const absent = candidates.filter((c) => (counts.get(c.keyword) ?? 0) === 0).length

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <p className="m-0 text-[12px] leading-snug text-[var(--q-text-4)]">
        {absent > 0
          ? `Glissez-en quelques-uns dans le texte, là où ils sont naturels : ${absent} absent${absent > 1 ? "s" : ""} pour l'instant.`
          : "Tous figurent déjà dans le texte."}
      </p>
      <ul className="m-0 -mx-2 flex list-none flex-col p-0">
        {candidates.map((c) => {
          const count = counts.get(c.keyword) ?? 0
          const on = highlightedKeys.has(keywordKey(c.keyword))
          return (
            <li key={c.keyword} className={cn("flex items-center gap-2 rounded-lg px-2 py-1.5 transition-colors duration-100 motion-reduce:transition-none", on && "bg-[var(--q-warn-bg)]")}>
              <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="text-[13px] font-medium leading-snug text-[var(--q-ink)] [overflow-wrap:anywhere]">{c.keyword}</span>
                <span className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[11.5px] text-[var(--q-text-4)]">
                  {c.volume !== null && <span className="q-num tabular-nums">{nf(c.volume)}/mois</span>}
                  {c.fromPage && c.impressions !== null && (
                    <span className="inline-flex items-center gap-1">
                      <Sparkles className="size-3 text-[var(--q-accent)]" aria-hidden />
                      {nf(c.impressions)} impression{c.impressions > 1 ? "s" : ""} de l&apos;article
                    </span>
                  )}
                  {!c.fromPage && c.volume === null && <span>Volume inconnu</span>}
                  {c.fromPlan && <span className="q-tag !h-[17px] !px-1.5 !text-[10px]">Plan</span>}
                  {c.added && <span className="q-tag !h-[17px] !px-1.5 !text-[10px]">Ajouté</span>}
                </span>
                {onIntegrate && count === 0 && (
                  <button
                    type="button"
                    onClick={() => onIntegrate(c.keyword)}
                    aria-label={`Intégrer « ${c.keyword} » dans le texte avec l'IA`}
                    className="-ml-1.5 mt-0.5 inline-flex h-7 w-fit items-center gap-1.5 rounded-lg px-1.5 text-[12px] font-semibold text-[var(--q-accent-strong)] transition-colors duration-100 hover:bg-[var(--q-wash)] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[var(--q-focus)] motion-reduce:transition-none max-md:h-11 max-md:px-2.5"
                  >
                    <Sparkles className="size-3.5" aria-hidden />
                    Intégrer avec l&apos;IA
                  </button>
                )}
              </span>
              <span
                className={cn(
                  "inline-flex h-[22px] shrink-0 items-center rounded-full px-2 text-[11.5px] font-semibold leading-none",
                  count > 0 ? "bg-[var(--q-ok-bg)] text-[var(--q-ok)]" : "bg-[var(--q-neutral-bg)] text-[var(--q-text-3)]",
                )}
              >
                {count > 0 ? `${nf(count)} fois` : "Absent"}
              </span>
              <button
                type="button"
                onClick={() => toggle(c.keyword)}
                aria-pressed={on}
                // Libellé fixe : l'état est porté par aria-pressed (un libellé qui change embrouille les lecteurs d'écran)
                aria-label={`Surligner « ${c.keyword} » dans le texte`}
                title={on ? "Surligné dans le texte : cliquez pour retirer" : "Surligner dans le texte"}
                className={cn(iconButton, on && "bg-[var(--q-surface)] text-[var(--q-warn)] ring-1 ring-[var(--q-warn-line)] hover:bg-[var(--q-surface)] hover:text-[var(--q-warn)]")}
              >
                <Eye className="size-4" aria-hidden />
              </button>
              <button type="button" onClick={() => copy(c.keyword)} aria-label={`Copier « ${c.keyword} »`} title="Copier" className={iconButton}>
                {copied === c.keyword ? <Check className="size-4 text-[var(--q-ok)]" aria-hidden /> : <Copy className="size-4" aria-hidden />}
              </button>
              {c.added && onRemoveExtra && (
                <button type="button" onClick={() => onRemoveExtra(c.keyword)} aria-label={`Retirer « ${c.keyword} » des secondaires`} title="Retirer des secondaires" className={iconButton}>
                  <X className="size-4" aria-hidden />
                </button>
              )}
            </li>
          )
        })}
      </ul>
    </div>
  )
}
