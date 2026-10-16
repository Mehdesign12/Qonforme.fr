"use client"

/**
 * Propositions d'un champ du panneau Référencement (titre Google,
 * description, adresse, chapeau, titre) : bouton « Proposer » à côté du
 * libellé, liste de trois cartes sous le champ.
 *
 *   const suggest = useSuggest({ field: "seoTitle", getRequest, onUse, disabledReason })
 *   <SuggestButton suggest={suggest} />        // dans l'en-tête du champ
 *   <SuggestionList suggest={suggest} />       // sous le champ
 *
 * - Appel POST /api/admin/blog/suggest (annulé si un autre part ou si le
 *   composant disparaît) ; squelette pendant l'appel, erreur avec
 *   « Réessayer », « Autres propositions » (les cartes déjà vues ne
 *   reviennent pas tant qu'il y en a de nouvelles).
 * - Chaque carte : texte, longueur colorée (zone conseillée du champ),
 *   présence du mot-clé exact, « Utiliser ». Rien n'est enregistré : le
 *   texte passe dans le champ (`onUse`), que l'on relit avant d'enregistrer ;
 *   le focus revient sur « Proposer ». Échap ferme le panneau.
 * - Sans mot-clé (ou sans texte), le bouton explique ce qui manque au lieu
 *   d'appeler le modèle.
 */
import { useCallback, useEffect, useId, useRef, useState } from "react"
import { Check, CornerDownLeft, RefreshCw, Sparkles, TriangleAlert, X } from "lucide-react"
import { cn } from "@/lib/utils"
import { SUGGEST_FIELDS } from "@/lib/seo/articles/suggest"
import { charTone, type CharTone } from "@/components/admin/blog/seo/CharMeter"
import type { SuggestField, SuggestRequest, SuggestResponse, Suggestion } from "@/lib/seo/articles/editor-types"

type Status = "idle" | "loading" | "ready" | "error" | "blocked"

export interface SuggestController {
  field: SuggestField
  status: Status
  suggestions: Suggestion[]
  error: string | null
  /** Panneau ouvert (squelette, erreur ou propositions). */
  open: boolean
  listId: string
  /** Bouton « Proposer » : le focus y revient quand le panneau se ferme. */
  triggerRef: React.RefObject<HTMLButtonElement>
  run: () => void
  close: () => void
  use: (text: string) => void
}

/** Texte de l'article envoyé au modèle (le serveur coupe aussi). */
const CONTENT_MAX = 12_000

export function useSuggest({
  field,
  getRequest,
  onUse,
  disabledReason,
}: {
  field: SuggestField
  /** Contexte du moment (lu au clic) ; `content` est tronqué ici à 12 000 caractères. */
  getRequest: () => Omit<SuggestRequest, "field">
  onUse: (text: string) => void
  /** Ce qui manque pour proposer (« Choisissez d'abord le mot-clé principal. ») ; null : prêt. */
  disabledReason?: string | null
}): SuggestController {
  const listId = useId()
  const [status, setStatus] = useState<Status>("idle")
  const [suggestions, setSuggestions] = useState<Suggestion[]>([])
  const [error, setError] = useState<string | null>(null)
  const controller = useRef<AbortController | null>(null)
  const seen = useRef<Set<string>>(new Set())
  const triggerRef = useRef<HTMLButtonElement>(null)

  useEffect(() => () => controller.current?.abort(), [])

  // Ce qui manquait est là (mot-clé choisi) : le message disparaît
  useEffect(() => {
    if (!disabledReason) setStatus((s) => (s === "blocked" ? "idle" : s))
  }, [disabledReason])

  const run = useCallback(() => {
    if (disabledReason) {
      setStatus("blocked")
      setError(disabledReason)
      return
    }
    controller.current?.abort()
    const ctrl = new AbortController()
    controller.current = ctrl
    setStatus("loading")
    setError(null)
    const base = getRequest()
    const body: SuggestRequest = { ...base, field, content: base.content.slice(0, CONTENT_MAX) }
    void (async () => {
      try {
        const res = await fetch("/api/admin/blog/suggest", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
          cache: "no-store",
          signal: ctrl.signal,
        })
        const json = (await res.json().catch(() => null)) as (SuggestResponse & { error?: string }) | null
        if (ctrl.signal.aborted) return
        if (!res.ok || !json) {
          setStatus("error")
          setError(json?.error ?? (res.status === 401 ? "Session expirée : reconnectez-vous." : "Les propositions sont indisponibles pour le moment. Réessayez dans un instant."))
          return
        }
        // Les propositions déjà vues ne reviennent pas, tant qu'il y en a de nouvelles
        const fresh = json.suggestions.filter((s) => !seen.current.has(s.text))
        const shown = fresh.length > 0 ? fresh : json.suggestions
        shown.forEach((s) => seen.current.add(s.text))
        setSuggestions(shown)
        setStatus("ready")
      } catch {
        if (ctrl.signal.aborted) return
        setStatus("error")
        setError("Connexion impossible. Vérifiez votre réseau puis réessayez.")
      }
    })()
  }, [disabledReason, field, getRequest])

  // Le focus ne se perd pas quand le panneau disparaît
  const refocus = useCallback(() => window.setTimeout(() => triggerRef.current?.focus(), 0), [])

  const close = useCallback(() => {
    const hadFocus = typeof document !== "undefined" && document.getElementById(listId)?.contains(document.activeElement)
    controller.current?.abort()
    setStatus("idle")
    setError(null)
    if (hadFocus) refocus()
  }, [listId, refocus])

  const use = useCallback(
    (text: string) => {
      onUse(text)
      setStatus("idle")
      refocus()
    },
    [onUse, refocus],
  )

  return { field, status, suggestions, error, open: status !== "idle", listId, triggerRef, run, close, use }
}

/* ------------------------------------------------------------------ */
/* Bouton                                                              */
/* ------------------------------------------------------------------ */

export function SuggestButton({ suggest, className, label = "Proposer" }: { suggest: SuggestController; className?: string; label?: string }) {
  const loading = suggest.status === "loading"
  return (
    <button
      ref={suggest.triggerRef}
      type="button"
      onClick={() => (suggest.open && !loading ? suggest.close() : suggest.run())}
      aria-expanded={suggest.open}
      aria-controls={suggest.open ? suggest.listId : undefined}
      aria-busy={loading || undefined}
      className={cn(
        "inline-flex h-8 items-center gap-1.5 rounded-lg px-2 text-[12.5px] font-semibold text-[var(--q-accent-strong)] transition-colors duration-100 hover:bg-[var(--q-wash)] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[var(--q-focus)] motion-reduce:transition-none max-md:h-11 max-md:px-2.5",
        className,
      )}
    >
      <Sparkles className={cn("size-3.5", loading && "animate-pulse motion-reduce:animate-none")} aria-hidden />
      {loading ? "Recherche…" : label}
    </button>
  )
}

/* ------------------------------------------------------------------ */
/* Liste                                                               */
/* ------------------------------------------------------------------ */

const TONE_TEXT: Record<CharTone, string> = {
  ok: "text-[var(--q-ok)]",
  warn: "text-[var(--q-warn)]",
  danger: "text-[var(--q-danger)]",
  neutral: "text-[var(--q-text-4)]",
}

export function SuggestionList({ suggest, className }: { suggest: SuggestController; className?: string }) {
  const def = SUGGEST_FIELDS[suggest.field]
  const firstUse = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)

  // Propositions arrivées : le focus va à la première (seulement s'il était dans le panneau ou sur le bouton)
  useEffect(() => {
    if (suggest.status !== "ready") return
    const activeEl = document.activeElement
    if (activeEl && (panelRef.current?.contains(activeEl) || activeEl.getAttribute("aria-controls") === suggest.listId)) {
      firstUse.current?.focus()
    }
  }, [suggest.status, suggest.listId])

  if (!suggest.open) return null
  const slug = suggest.field === "slug"
  // « Réessayer » et « Autres propositions » disparaissent pendant l'appel : le focus reste dans le
  // panneau (sinon il tomberait sur la page), puis passe à la première proposition
  const rerun = () => {
    panelRef.current?.focus()
    suggest.run()
  }

  return (
    <div
      ref={panelRef}
      id={suggest.listId}
      role="region"
      tabIndex={-1}
      aria-label={`Propositions pour ${def.label}`}
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          e.stopPropagation()
          suggest.close()
        }
      }}
      className={cn("rounded-xl border border-[var(--q-wash-line)] bg-[var(--q-surface-2)] p-2.5 outline-none animate-in fade-in-0 duration-150 motion-reduce:animate-none", className)}
    >
      <div className="flex items-center justify-between gap-2 px-1 pb-2">
        <span className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-[var(--q-text-3)]">
          <Sparkles className="size-3.5 text-[var(--q-accent)]" aria-hidden />
          Propositions
        </span>
        <button
          type="button"
          onClick={suggest.close}
          aria-label="Fermer les propositions"
          className="inline-flex size-7 items-center justify-center rounded-lg text-[var(--q-text-4)] hover:bg-[var(--q-hover)] hover:text-[var(--q-ink)] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[var(--q-focus)] max-md:size-11"
        >
          <X className="size-4" aria-hidden />
        </button>
      </div>

      <div role="status" aria-live="polite" className="sr-only">
        {suggest.status === "loading"
          ? "Recherche de propositions…"
          : suggest.status === "ready"
            ? `${suggest.suggestions.length} proposition${suggest.suggestions.length > 1 ? "s" : ""}`
            : ""}
      </div>

      {suggest.status === "loading" && (
        <ul className="m-0 flex list-none flex-col gap-2 p-0" aria-hidden>
          {[0, 1, 2].map((i) => (
            <li key={i} className="flex flex-col gap-2 rounded-lg border border-[var(--q-line)] bg-[var(--q-surface)] p-3">
              <span className={cn("h-3.5 animate-pulse rounded bg-[var(--q-sunken)] motion-reduce:animate-none", i === 1 ? "w-4/5" : "w-11/12")} />
              {!slug && <span className={cn("h-3.5 animate-pulse rounded bg-[var(--q-sunken)] motion-reduce:animate-none", i === 2 ? "w-1/2" : "w-2/3")} />}
              <span className="mt-1 flex items-center justify-between">
                <span className="h-3 w-20 animate-pulse rounded bg-[var(--q-sunken)] motion-reduce:animate-none" />
                <span className="h-7 w-[74px] animate-pulse rounded-lg bg-[var(--q-sunken)] motion-reduce:animate-none" />
              </span>
            </li>
          ))}
        </ul>
      )}

      {(suggest.status === "error" || suggest.status === "blocked") && suggest.error && (
        <div
          role={suggest.status === "error" ? "alert" : "status"}
          className={cn(
            "flex flex-col gap-2 rounded-lg border px-3 py-2.5 text-[12.5px] leading-snug",
            suggest.status === "error" ? "border-[var(--q-danger-line)] bg-[var(--q-danger-bg)] text-[var(--q-danger)]" : "border-[var(--q-line)] bg-[var(--q-surface)] text-[var(--q-text-3)]",
          )}
        >
          <p className="m-0 flex items-start gap-1.5">
            <TriangleAlert className="mt-px size-3.5 shrink-0" aria-hidden />
            <span>{suggest.error}</span>
          </p>
          {suggest.status === "error" && (
            <button type="button" onClick={rerun} className="q-btn q-btn-secondary q-btn-sm self-start max-md:!h-11">
              <RefreshCw aria-hidden />
              Réessayer
            </button>
          )}
        </div>
      )}

      {suggest.status === "ready" && (
        <>
          <ul className="m-0 flex list-none flex-col gap-2 p-0">
            {suggest.suggestions.map((s, i) => {
              const tone = charTone(s.length, def.idealMin, def.idealMax, def.max)
              return (
                <li key={s.text} className="flex flex-col gap-2 rounded-lg border border-[var(--q-line)] bg-[var(--q-surface)] p-3 shadow-[shadow:var(--q-shadow-card)]">
                  <p className={cn("m-0 leading-snug text-[var(--q-ink)] [overflow-wrap:anywhere]", slug ? "font-mono text-[12.5px]" : "text-[13.5px]")}>
                    {slug ? (
                      <>
                        <span className="text-[var(--q-text-4)]">/blog/</span>
                        {s.text}
                      </>
                    ) : (
                      s.text
                    )}
                  </p>
                  <div className="flex items-center gap-3">
                    <span className="flex min-w-0 flex-1 flex-wrap items-center gap-x-3 gap-y-1">
                      <span className={cn("q-num text-[12px] font-semibold tabular-nums", TONE_TEXT[tone])}>
                        {s.length.toLocaleString("fr-FR")} car.
                        <span className="sr-only"> ({def.idealMin} à {def.idealMax} conseillés)</span>
                      </span>
                      {s.hasKeyword ? (
                        <span className="inline-flex items-center gap-1 text-[12px] font-medium text-[var(--q-ok)]">
                          <Check className="size-3.5" strokeWidth={2.75} aria-hidden />
                          Mot-clé
                        </span>
                      ) : (
                        <span className="text-[12px] text-[var(--q-text-4)]">Sans le mot-clé</span>
                      )}
                    </span>
                    <button
                      ref={i === 0 ? firstUse : undefined}
                      type="button"
                      onClick={() => suggest.use(s.text)}
                      aria-label={`Utiliser : ${s.text}`}
                      className="q-btn q-btn-secondary q-btn-sm shrink-0 !h-8 max-md:!h-11"
                    >
                      <CornerDownLeft aria-hidden />
                      Utiliser
                    </button>
                  </div>
                </li>
              )
            })}
          </ul>
          <div className="mt-2 flex flex-wrap items-center justify-between gap-x-3 gap-y-1 px-1">
            <span className="text-[11.5px] text-[var(--q-text-4)]">Relisez avant d&apos;enregistrer : rien ne part sans vous.</span>
            <button type="button" onClick={rerun} className="q-link inline-flex min-h-8 items-center gap-1 text-[12.5px] max-md:min-h-11">
              <RefreshCw className="size-3.5" aria-hidden />
              Autres propositions
            </button>
          </div>
        </>
      )}
    </div>
  )
}
