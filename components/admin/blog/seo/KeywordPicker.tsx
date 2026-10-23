"use client"

/**
 * Choix du mot-clé principal d'un article (panneau Référencement de
 * l'éditeur) : liste déroulante accessible (motif « combobox » de l'ARIA :
 * champ, liste, option active annoncée), puis carte du mot-clé choisi.
 *
 * - Options : mots-clés de l'onglet Mots-clés et du plan d'octobre
 *   (SeoContext.keywords), les ciblés et ceux du plan d'abord, puis par
 *   volume ; filtre sans accents ni casse. La phrase tapée est toujours la
 *   première option (« Utiliser « … » »), donc celle que valide Entrée ; un
 *   bouton « Utiliser » reste affiché quand la liste se ferme sans que la
 *   saisie ait été validée.
 * - Carte : volume, difficulté, position dans Google ; orthographe sans
 *   accents signalée (le site s'écrit toujours avec ses accents). Un mot-clé
 *   libre (pas encore suivi) n'a aucune mesure : la carte le dit et propose de
 *   le mesurer (Google, DataForSEO) puis de le suivre (`measure`, KeywordCheck).
 * - Risque de concurrence entre pages (SeoContext.keywordPages) : page du
 *   site qui ressort déjà sur la recherche, autres articles qui la visent,
 *   page confiée à ce mot-clé dans l'onglet Mots-clés ; en bannière ambre,
 *   avec liens (nouvel onglet : l'article en cours n'est pas quitté).
 *
 * Clavier : flèches, Début, Fin, Entrée, Échap (revient à la carte sans rien
 * changer). `inputId` est posé sur le champ, ou sur « Changer » quand un
 * mot-clé est choisi : la liste de contrôle y envoie le focus.
 */
import { useEffect, useId, useMemo, useRef, useState } from "react"
import Link from "next/link"
import { ArrowUpRight, Check, CircleCheck, CornerDownLeft, Loader2, PencilLine, Plus, RefreshCw, Search, Sparkles, Target, TriangleAlert, X } from "lucide-react"
import { cn } from "@/lib/utils"
import { findMissingAccents } from "@/lib/seo/articles/onpage"
import { keywordKey } from "@/lib/seo/articles/secondary"
import { canonicalKeyword, foldAccents, KEYWORD_MAX_LENGTH, looksLikeUrl, normalizeKeyword } from "@/lib/seo/keywords/normalize"
import { KEYWORD_STATUS } from "@/lib/seo/types"
import { DifficultyPill, difficultyOf } from "@/components/admin/blog/seo/difficulty"
import { KeywordCheck } from "@/components/admin/blog/seo/KeywordCheck"
import type { EditorKeyword, KeywordPages } from "@/lib/seo/articles/editor-types"

/**
 * Chemin et sa variante avec ou sans barre finale : même règle que
 * pathVariants (lib/seo/search-console/page.ts), recopiée ici parce que ce
 * module-là lit la base (clé service_role) et ne peut pas entrer dans le
 * code envoyé au navigateur.
 */
function pathVariants(path: string): string[] {
  const clean = path.trim()
  if (!clean || clean === "/") return ["/"]
  const base = clean.replace(/\/+$/, "")
  return [base, `${base}/`]
}

/* ------------------------------------------------------------------ */
/* Formats                                                             */
/* ------------------------------------------------------------------ */

const nf = (n: number) => Math.round(n).toLocaleString("fr-FR")

// Réexportés : la pastille de difficulté vivait ici avant d'être partagée
export { DifficultyPill, difficultyOf }
export type { DifficultyTone } from "@/components/admin/blog/seo/difficulty"

/** « 12,4 » (position moyenne). */
const fmtPos = (p: number) => p.toLocaleString("fr-FR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })

/** Ciblés et mots-clés du plan, puis volume décroissant, puis ordre alphabétique. */
export function sortKeywordOptions(list: EditorKeyword[]): EditorKeyword[] {
  const rank = (k: EditorKeyword) => (k.status === "targeted" || k.fromPlan ? 0 : 1)
  return list.slice().sort((a, b) => rank(a) - rank(b) || (b.volume ?? -1) - (a.volume ?? -1) || a.keyword.localeCompare(b.keyword, "fr"))
}

/** Filtre sans accents ni casse : chaque mot saisi doit apparaître. */
export function filterKeywordOptions(list: EditorKeyword[], query: string): EditorKeyword[] {
  const tokens = foldAccents(query).split(/\s+/).filter(Boolean)
  if (tokens.length === 0) return list
  return list.filter((k) => {
    const hay = foldAccents(k.keyword)
    return tokens.every((t) => hay.includes(t))
  })
}

const MAX_OPTIONS = 60

/** Valeur absente : « — » visible, libellé lu par les lecteurs d'écran (même rendu que pills.tsx). */
function Missing({ label }: { label: string }) {
  return (
    <>
      <span aria-hidden className="text-[var(--q-text-4)]">—</span>
      <span className="sr-only">{label}</span>
    </>
  )
}

type Option = { id: string; kind: "keyword"; item: EditorKeyword } | { id: string; kind: "free"; keyword: string }

/* ------------------------------------------------------------------ */
/* Composant                                                           */
/* ------------------------------------------------------------------ */

export interface KeywordPickerProps {
  value: string | null
  onChange: (keyword: string | null) => void
  /** SeoContext.keywords ; null pendant le premier chargement. */
  keywords: EditorKeyword[] | null
  /** SeoContext.keywordPages (pour le mot-clé choisi). */
  keywordPages: KeywordPages | null
  /** Contexte en cours de chargement (useSeoContext). */
  loading?: boolean
  error?: string | null
  onRetry?: () => void
  /** Adresse de l'article (sans « /blog/ ») : sa propre page n'est jamais une concurrente. */
  slug: string
  selfId?: string | null
  /** Posé sur le champ, ou sur « Changer » quand un mot-clé est choisi. */
  inputId?: string
  /** Search Console reliée (sinon la position se lit « — »). */
  gscConnected?: boolean
  /** Ouvre la « Proposition IA » (requêtes exactes pour cet article) ; absent : pas de bouton. */
  onPropose?: () => void
  /** Mesure et suivi d'un mot-clé libre (carte du mot-clé choisi) ; absent : la carte dit seulement qu'il n'est pas suivi. */
  measure?: { articleTitle: string; onTracked: () => void }
  className?: string
}

export function KeywordPicker({
  value,
  onChange,
  keywords,
  keywordPages,
  loading = false,
  error = null,
  onRetry,
  slug,
  selfId,
  inputId,
  gscConnected = true,
  onPropose,
  measure,
  className,
}: KeywordPickerProps) {
  const uid = useId()
  const listId = `${uid}-liste`
  const hintId = `${uid}-aide`
  const inputRef = useRef<HTMLInputElement>(null)
  const changeRef = useRef<HTMLButtonElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  const [editing, setEditing] = useState(!value)
  const [query, setQuery] = useState("")
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)
  const focusNext = useRef<"input" | "change" | null>(null)

  // Mot-clé changé de l'extérieur (brouillon restauré, proposition reprise) : champ s'il est vide, carte sinon
  useEffect(() => {
    if (!value) setEditing(true)
    else if (typeof document !== "undefined" && document.activeElement !== inputRef.current) setEditing(false)
  }, [value])

  useEffect(() => {
    if (focusNext.current === "input" && editing) inputRef.current?.focus()
    if (focusNext.current === "change" && !editing) changeRef.current?.focus()
    focusNext.current = null
  }, [editing])

  const sorted = useMemo(() => sortKeywordOptions(keywords ?? []), [keywords])
  const selected = useMemo(() => (value ? sorted.find((k) => keywordKey(k.keyword) === keywordKey(value)) ?? null : null), [sorted, value])

  const options: Option[] = useMemo(() => {
    const filtered = filterKeywordOptions(sorted, query).slice(0, MAX_OPTIONS)
    const typed = normalizeKeyword(query)
    const typedKey = typed.ok ? keywordKey(typed.keyword) : null
    // La phrase tapée, si elle est déjà suivie, passe en tête
    if (typedKey) filtered.sort((a, b) => Number(keywordKey(b.keyword) === typedKey) - Number(keywordKey(a.keyword) === typedKey))
    const out: Option[] = filtered.map((item, i) => ({ id: `${uid}-o${i}`, kind: "keyword" as const, item }))
    // Sinon elle s'ajoute en première option : Entrée valide ce qui a été tapé, pas la première suggestion
    if (query.trim() && typed.ok && !sorted.some((k) => keywordKey(k.keyword) === typedKey)) {
      out.unshift({ id: `${uid}-libre`, kind: "free", keyword: typed.keyword })
    }
    return out
  }, [sorted, query, uid])

  // L'option qui correspond à la phrase tapée (libre ou déjà suivie) : ce que valident Entrée et « Utiliser »
  const typedChoice: Option | null = useMemo(() => {
    const typed = normalizeKeyword(query)
    const first = options[0]
    if (!query.trim() || !typed.ok || !first) return null
    return first.kind === "free" || keywordKey(first.item.keyword) === keywordKey(typed.keyword) ? first : null
  }, [options, query])

  // Seules une adresse web ou une saisie trop longue sont signalées : « au moins deux caractères »
  // s'afficherait en rouge dès la première lettre tapée
  const typedError = (() => {
    const typed = canonicalKeyword(query)
    if (!typed) return null
    if (looksLikeUrl(typed)) return "Saisissez une requête, ce que l'on tape dans Google, pas une adresse web."
    if (typed.length > KEYWORD_MAX_LENGTH) return `Un mot-clé compte au plus ${KEYWORD_MAX_LENGTH} caractères.`
    return null
  })()

  // L'option active reste visible
  useEffect(() => {
    if (!open) return
    const el = listRef.current?.querySelector<HTMLElement>(`[data-index="${active}"]`)
    el?.scrollIntoView({ block: "nearest" })
  }, [active, open])

  function pick(keyword: string) {
    onChange(keyword)
    setQuery("")
    setOpen(false)
    setActive(0)
    focusNext.current = "change"
    setEditing(false)
  }

  function choose(option: Option | undefined) {
    if (!option) return
    pick(option.kind === "free" ? option.keyword : option.item.keyword)
  }

  function cancel() {
    setQuery("")
    setOpen(false)
    if (value) {
      focusNext.current = "change"
      setEditing(false)
    }
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault()
      if (!open) {
        setOpen(true)
        return
      }
      if (options.length === 0) return
      setActive((a) => (a + (e.key === "ArrowDown" ? 1 : -1) + options.length) % options.length)
    } else if (e.key === "Home" && open && options.length > 0) {
      e.preventDefault()
      setActive(0)
    } else if (e.key === "End" && open && options.length > 0) {
      e.preventDefault()
      setActive(options.length - 1)
    } else if (e.key === "Enter") {
      if (open && options.length > 0) {
        e.preventDefault()
        choose(options[Math.min(active, options.length - 1)])
      } else if (typedChoice) {
        // Liste fermée : Entrée valide la phrase tapée
        e.preventDefault()
        choose(typedChoice)
      }
    } else if (e.key === "Escape") {
      if (open && query) {
        e.preventDefault()
        setQuery("")
        setActive(0)
      } else if (open) {
        e.preventDefault()
        setOpen(false)
      } else if (value) {
        e.preventDefault()
        cancel()
      }
    }
  }

  const firstLoad = keywords === null && loading
  const listVisible = editing && open

  return (
    <div className={cn("flex flex-col gap-3", className)}>
      {editing ? (
        <div
          className="flex flex-col gap-2"
          onBlur={(e) => {
            const next = e.relatedTarget as Node | null
            if (!next || !e.currentTarget.contains(next)) setOpen(false)
          }}
        >
          <div className="q-fw relative flex h-[42px] items-center gap-2 rounded-[10px] border border-[var(--q-field)] bg-[var(--q-surface)] px-3">
            <Search className="size-4 shrink-0 text-[var(--q-text-4)]" aria-hidden />
            <input
              ref={inputRef}
              id={inputId}
              type="text"
              role="combobox"
              aria-expanded={listVisible}
              aria-controls={listId}
              aria-autocomplete="list"
              aria-activedescendant={listVisible ? options[active]?.id : undefined}
              aria-describedby={hintId}
              aria-label="Mot-clé principal : rechercher un mot-clé suivi ou en saisir un"
              placeholder="Rechercher ou saisir un mot-clé"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value)
                setActive(0)
                setOpen(true)
              }}
              onFocus={() => setOpen(true)}
              onClick={() => setOpen(true)}
              onKeyDown={onKeyDown}
              autoComplete="off"
              spellCheck={false}
              maxLength={160}
              className="h-full min-w-0 flex-1 bg-transparent text-base text-[var(--q-ink)] outline-none placeholder:text-[var(--q-placeholder)] md:text-sm"
            />
            {loading && <Loader2 className="size-4 shrink-0 animate-spin text-[var(--q-text-4)] motion-reduce:animate-none" aria-hidden />}
            {value && (
              <button
                type="button"
                onClick={cancel}
                aria-label="Annuler et garder le mot-clé actuel"
                className="-mr-1.5 inline-flex size-8 shrink-0 items-center justify-center rounded-lg text-[var(--q-text-4)] hover:bg-[var(--q-hover)] hover:text-[var(--q-ink)] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[var(--q-focus)] max-md:size-11"
              >
                <X className="size-4" aria-hidden />
              </button>
            )}
          </div>

          <p id={hintId} className={cn("text-[12px] leading-snug", typedError ? "text-[var(--q-danger)]" : "text-[var(--q-text-4)]")}>
            {typedError ??
              (!listVisible && typedChoice
                ? "Pas encore validé : appuyez sur Entrée ou cliquez sur « Utiliser »."
                : listVisible && !firstLoad && !query.trim() && sorted.length > 0
                  ? `${sorted.length} mots-clés suivis ou du plan : ciblés et plan d'abord, puis par volume.`
                  : listVisible && typedChoice?.kind === "free"
                    ? "Entrée valide votre saisie ; les flèches choisissent un mot-clé déjà suivi."
                    : "La recherche que cet article doit faire ressortir dans Google.")}
          </p>

          {!listVisible && typedChoice && (
            <button type="button" onClick={() => choose(typedChoice)} className="q-btn q-btn-primary q-btn-sm self-start max-md:!h-11">
              <Check aria-hidden />
              Utiliser « {typedChoice.kind === "free" ? typedChoice.keyword : typedChoice.item.keyword} »
            </button>
          )}

          {listVisible && (
            <div
              ref={listRef}
              id={listId}
              role="listbox"
              aria-label="Mots-clés proposés"
              className="max-h-[320px] overflow-y-auto overscroll-contain rounded-xl border border-[var(--q-line)] bg-[var(--q-surface)] p-1 shadow-[shadow:var(--q-shadow-pop)] animate-in fade-in-0 duration-100 motion-reduce:animate-none"
            >
              {firstLoad ? (
                <div className="flex flex-col gap-1 p-1.5" aria-hidden>
                  {[0, 1, 2, 3].map((i) => (
                    <span key={i} className="flex flex-col gap-1.5 rounded-lg px-1.5 py-2">
                      <span className={cn("h-3.5 animate-pulse rounded bg-[var(--q-sunken)] motion-reduce:animate-none", i % 2 ? "w-1/2" : "w-3/4")} />
                      <span className="h-3 w-1/3 animate-pulse rounded bg-[var(--q-sunken)] motion-reduce:animate-none" />
                    </span>
                  ))}
                </div>
              ) : options.length === 0 ? (
                <p className="px-3 py-5 text-center text-[13px] text-[var(--q-text-4)]">
                  {keywords && keywords.length === 0 ? "Aucun mot-clé suivi pour l'instant : saisissez celui de l'article." : "Saisissez au moins deux caractères."}
                </p>
              ) : (
                options.map((o, index) => {
                  const isActive = index === active
                  if (o.kind === "free") {
                    return (
                      <div
                        key={o.id}
                        id={o.id}
                        data-index={index}
                        role="option"
                        aria-selected={isActive}
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => choose(o)}
                        onMouseMove={() => setActive(index)}
                        className={cn("flex min-h-11 cursor-pointer items-center gap-2.5 rounded-[9px] px-2.5 py-2", isActive && "bg-[var(--q-hover)]")}
                      >
                        <span className="grid size-7 shrink-0 place-items-center text-[var(--q-accent-strong)] q-glyph" aria-hidden>
                          <Plus className="size-3.5" />
                        </span>
                        <span className="flex min-w-0 flex-1 flex-col">
                          <span className="text-[13px] font-semibold text-[var(--q-ink)] [overflow-wrap:anywhere]">Utiliser « {o.keyword} »</span>
                          <span className="text-[11.5px] text-[var(--q-text-4)]">Votre saisie, telle quelle · pas encore dans l&apos;onglet Mots-clés, vous pourrez la mesurer ensuite</span>
                        </span>
                        {isActive && <CornerDownLeft className="size-3.5 shrink-0 text-[var(--q-text-4)]" aria-hidden />}
                      </div>
                    )
                  }
                  const k = o.item
                  const current = value !== null && keywordKey(k.keyword) === keywordKey(value)
                  return (
                    <div
                      key={o.id}
                      id={o.id}
                      data-index={index}
                      role="option"
                      aria-selected={isActive}
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => choose(o)}
                      onMouseMove={() => setActive(index)}
                      className={cn("flex min-h-11 cursor-pointer items-center gap-2.5 rounded-[9px] px-2.5 py-2", isActive && "bg-[var(--q-hover)]")}
                    >
                      <span className="flex min-w-0 flex-1 flex-col gap-1">
                        <span className="flex min-w-0 items-center gap-1.5">
                          <span className={cn("min-w-0 text-[13px] leading-snug text-[var(--q-ink)] [overflow-wrap:anywhere]", current ? "font-semibold" : "font-medium")}>{k.keyword}</span>
                          {k.fromPlan && <span className="q-tag !h-[18px] shrink-0 !px-1.5 !text-[10.5px]">Plan</span>}
                        </span>
                        <span className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[11.5px] text-[var(--q-text-4)]">
                          <span className="q-num tabular-nums">{k.volume !== null ? `${nf(k.volume)}/mois` : "Volume inconnu"}</span>
                          <DifficultyPill value={k.difficulty} />
                          {k.position !== null && <span className="q-num tabular-nums">Pos. {nf(k.position)}</span>}
                          {k.status === "targeted" && !k.fromPlan && <span>Ciblé</span>}
                        </span>
                      </span>
                      {current ? (
                        <Check className="size-4 shrink-0 text-[var(--q-accent)]" aria-label="Mot-clé actuel" />
                      ) : (
                        isActive && <CornerDownLeft className="size-3.5 shrink-0 text-[var(--q-text-4)]" aria-hidden />
                      )}
                    </div>
                  )
                })
              )}
            </div>
          )}
          <span role="status" className="sr-only">
            {listVisible && !firstLoad ? `${options.length} proposition${options.length > 1 ? "s" : ""}` : ""}
          </span>

          {error && keywords === null && (
            <div role="alert" className="flex flex-wrap items-center gap-2 rounded-lg bg-[var(--q-sunken)] px-3 py-2 text-[12px] text-[var(--q-text-3)]">
              <span className="min-w-0 flex-1">Mots-clés suivis indisponibles : saisissez le mot-clé à la main.</span>
              {onRetry && (
                <button type="button" onClick={onRetry} className="q-link inline-flex min-h-8 items-center gap-1 text-[12px] max-md:min-h-11">
                  <RefreshCw className="size-3.5" aria-hidden />
                  Réessayer
                </button>
              )}
            </div>
          )}
        </div>
      ) : (
        value && (
          <SelectedKeyword
            value={value}
            item={selected}
            loading={firstLoad}
            unavailable={keywords === null && !loading && Boolean(error)}
            onRetry={onRetry}
            gscConnected={gscConnected}
            measure={measure}
            changeRef={changeRef}
            changeId={inputId}
            onChangeClick={() => {
              focusNext.current = "input"
              setEditing(true)
              setOpen(true)
            }}
            onRemove={() => {
              onChange(null)
              focusNext.current = "input"
              setEditing(true)
            }}
          />
        )
      )}

      {onPropose && (
        <button type="button" onClick={onPropose} className="q-btn q-btn-secondary q-btn-sm self-start max-md:!h-11">
          <Sparkles aria-hidden />
          {value ? "Proposer un mot-clé plus exact" : "Proposer un mot-clé exact"}
        </button>
      )}

      {/* Le risque de concurrence est celui du mot-clé choisi : pendant la saisie d'un autre, il serait trompeur */}
      {value && !(editing && query.trim()) && <Cannibalization value={value} pages={keywordPages} loading={loading} slug={slug} selfId={selfId ?? null} />}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Carte du mot-clé choisi                                             */
/* ------------------------------------------------------------------ */

function SelectedKeyword({
  value,
  item,
  loading,
  unavailable,
  onRetry,
  gscConnected,
  measure,
  changeRef,
  changeId,
  onChangeClick,
  onRemove,
}: {
  value: string
  item: EditorKeyword | null
  loading: boolean
  /** Mots-clés suivis illisibles : on ne sait pas si celui-ci l'est. */
  unavailable: boolean
  onRetry?: () => void
  gscConnected: boolean
  measure?: { articleTitle: string; onTracked: () => void }
  changeRef: React.RefObject<HTMLButtonElement>
  changeId?: string
  onChangeClick: () => void
  onRemove: () => void
}) {
  const accents = findMissingAccents(value)
  const difficulty = difficultyOf(item?.difficulty ?? null)
  const status = item?.status ? KEYWORD_STATUS[item.status].label : null

  return (
    <div className="rounded-xl border border-[var(--q-line)] bg-[var(--q-surface-2)] p-3.5">
      <div className="flex items-start gap-3">
        <span className="grid size-9 shrink-0 place-items-center text-[var(--q-accent-strong)] q-glyph" aria-hidden>
          <Target className="size-[18px]" />
        </span>
        <div className="min-w-0 flex-1 pt-0.5">
          <p className="text-[15px] font-semibold leading-snug text-[var(--q-ink)] [overflow-wrap:anywhere]">{value}</p>
          <p className="mt-1 flex flex-wrap items-center gap-1.5 text-[12px] text-[var(--q-text-4)]">
            {loading ? (
              <span className="h-3 w-24 animate-pulse rounded bg-[var(--q-sunken)] motion-reduce:animate-none" aria-hidden />
            ) : item ? (
              <>
                {status && <span title="Statut dans l'onglet Mots-clés">Suivi : {status.toLowerCase()}</span>}
                {!status && item.fromPlan && <span>Pas encore suivi</span>}
                {item.fromPlan && <span className="q-tag !h-[18px] !px-1.5 !text-[10.5px]">Plan d&apos;octobre</span>}
              </>
            ) : unavailable ? (
              <>
                <span>Mesures indisponibles pour le moment</span>
                {onRetry && (
                  <button type="button" onClick={onRetry} className="q-link inline-flex min-h-6 items-center gap-1 text-[12px] max-md:min-h-11">
                    <RefreshCw className="size-3" aria-hidden />
                    Réessayer
                  </button>
                )}
              </>
            ) : (
              <span>Mot-clé libre, pas encore suivi</span>
            )}
          </p>
        </div>
        <div className="-mr-1.5 -mt-1 flex shrink-0 items-center">
          <button
            ref={changeRef}
            id={changeId}
            type="button"
            onClick={onChangeClick}
            aria-label={`Changer de mot-clé (actuel : « ${value} »)`}
            title="Changer de mot-clé"
            className="q-btn q-btn-ghost q-btn-sm q-btn-icon max-md:!size-11"
          >
            <PencilLine aria-hidden />
          </button>
          <button
            type="button"
            onClick={onRemove}
            aria-label={`Retirer le mot-clé « ${value} »`}
            title="Retirer le mot-clé"
            className="q-btn q-btn-ghost q-btn-sm q-btn-icon max-md:!size-11"
          >
            <X aria-hidden />
          </button>
        </div>
      </div>

      <dl className="mt-3 grid grid-cols-3 overflow-hidden rounded-lg border border-[var(--q-line)] bg-[var(--q-surface)]">
        <div className="flex min-w-0 flex-col gap-0.5 px-2.5 py-2">
          <dt className="text-[11px] text-[var(--q-text-4)]">Recherches</dt>
          <dd className="q-num m-0 text-[14px] font-semibold tabular-nums text-[var(--q-ink)]">
            {item && item.volume !== null ? (
              <>
                {nf(item.volume)}
                <span className="text-[11px] font-normal text-[var(--q-text-4)]">/mois</span>
              </>
            ) : (
              <Missing label="Volume inconnu" />
            )}
          </dd>
        </div>
        <div className="flex min-w-0 flex-col gap-0.5 border-l border-[var(--q-line-soft)] px-2.5 py-2">
          <dt className="text-[11px] text-[var(--q-text-4)]">Difficulté</dt>
          <dd className="m-0 text-[14px] font-semibold">
            {difficulty ? (
              <span className={cn(difficulty.tone === "ok" ? "text-[var(--q-ok)]" : difficulty.tone === "warn" ? "text-[var(--q-warn)]" : "text-[var(--q-danger)]")}>{difficulty.label}</span>
            ) : (
              <Missing label="Difficulté inconnue" />
            )}
          </dd>
        </div>
        <div className="flex min-w-0 flex-col gap-0.5 border-l border-[var(--q-line-soft)] px-2.5 py-2">
          <dt className="text-[11px] text-[var(--q-text-4)]">Position</dt>
          <dd className="q-num m-0 text-[14px] font-semibold leading-tight tabular-nums text-[var(--q-ink)]">
            {item && item.position !== null ? (
              fmtPos(item.position)
            ) : gscConnected ? (
              <span className="text-[12px] font-medium text-[var(--q-text-4)]">Pas encore classé</span>
            ) : (
              <Missing label="Search Console non reliée" />
            )}
          </dd>
        </div>
      </dl>

      {accents.length > 0 && (
        <p className="mt-2.5 flex items-start gap-1.5 text-[12px] leading-snug text-[var(--q-text-3)]">
          <TriangleAlert className="mt-px size-3.5 shrink-0 text-[var(--q-warn)]" aria-hidden />
          <span>
            Écrivez {accents.slice(0, 3).map((a) => `« ${a.suggestion} »`).join(" et ")} dans l&apos;article, avec {accents.length > 1 ? "leurs accents" : "son accent"} : Google
            rapproche les deux formes, mais le site s&apos;écrit toujours avec les accents.
          </span>
        </p>
      )}

      {measure && !item && !loading && !unavailable && <KeywordCheck keyword={value} articleTitle={measure.articleTitle} onTracked={measure.onTracked} />}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Risque de concurrence entre pages                                   */
/* ------------------------------------------------------------------ */

function siteUrl(path: string): string {
  return `https://qonforme.fr${path.startsWith("/") ? path : `/${path}`}`
}

function Cannibalization({ value, pages, loading, slug, selfId }: { value: string; pages: KeywordPages | null; loading: boolean; slug: string; selfId: string | null }) {
  const current = pages && keywordKey(pages.keyword) === keywordKey(value)
  if (!current) {
    return loading ? (
      <p className="flex items-center gap-1.5 text-[12px] text-[var(--q-text-4)]" role="status">
        <Loader2 className="size-3.5 animate-spin motion-reduce:animate-none" aria-hidden />
        Recherche des pages du site qui visent déjà ce mot-clé…
      </p>
    ) : null
  }

  const self = slug.trim() ? pathVariants(`/blog/${slug.trim()}`) : []
  const isSelf = (path: string | null) => !!path && self.includes(path)
  const topPage = pages.topPage && !isSelf(pages.topPage.page) ? pages.topPage : null
  const target = pages.targetPath && !isSelf(pages.targetPath) && pages.targetPath !== topPage?.page ? pages.targetPath : null
  const posts = pages.posts.filter((p) => p.id !== selfId && !isSelf(`/blog/${p.slug}`))

  if (!topPage && !target && posts.length === 0) {
    return (
      <p className="flex items-start gap-1.5 text-[12px] leading-snug text-[var(--q-text-3)]">
        <CircleCheck className="mt-px size-3.5 shrink-0 text-[var(--q-ok)]" aria-hidden />
        Aucune autre page du site ne vise ce mot-clé.
      </p>
    )
  }

  return (
    <div role="status" className="q-banner q-banner-warn !gap-2.5 !px-3.5 !py-3">
      <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
      <div className="flex min-w-0 flex-1 flex-col gap-2 text-[12.5px] leading-relaxed text-[var(--q-text-2)]">
        <p className="font-semibold text-[var(--q-warn)]">Risque de concurrence entre vos pages</p>
        <ul className="m-0 flex list-none flex-col gap-2 p-0">
          {topPage && (
            <li>
              <ExternalPath path={topPage.page} /> ressort déjà dans Google sur cette recherche
              {topPage.position !== null ? ` (position ${fmtPos(topPage.position)}, ${nf(topPage.impressions)} impressions en 90 jours)` : ""}. Visez une variante plus précise, ou faites un lien vers cette page.
            </li>
          )}
          {target && (
            <li>
              Dans l&apos;onglet{" "}
              <Link href={`/admin/seo/mots-cles?q=${encodeURIComponent(value)}`} target="_blank" rel="noopener" className="q-link">
                Mots-clés
              </Link>
              , ce mot-clé est confié à <ExternalPath path={target} />.
            </li>
          )}
          {posts.length > 0 && (
            <li>
              {posts.length > 1 ? "D'autres articles visent" : "Un autre article vise"} déjà ce mot-clé :{" "}
              {posts.slice(0, 3).map((p, i) => (
                <span key={p.id}>
                  {i > 0 && ", "}
                  <Link href={`/admin/blog/${p.id}`} target="_blank" rel="noopener" className="q-link">
                    {p.title}
                  </Link>
                </span>
              ))}
              {posts.length > 3 ? ` et ${posts.length - 3} autre${posts.length - 3 > 1 ? "s" : ""}` : ""}.
            </li>
          )}
        </ul>
      </div>
    </div>
  )
}

function ExternalPath({ path }: { path: string }) {
  return (
    <a href={siteUrl(path)} target="_blank" rel="noopener noreferrer" className="q-link inline-flex items-baseline gap-0.5 font-mono text-[12px] [overflow-wrap:anywhere]">
      {path}
      <ArrowUpRight className="size-3 shrink-0 self-center" aria-hidden />
      <span className="sr-only"> (nouvel onglet)</span>
    </a>
  )
}
