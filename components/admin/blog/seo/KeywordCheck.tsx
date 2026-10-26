"use client"

/**
 * Mesure d'un mot-clé principal saisi à la main (carte du mot-clé choisi, quand
 * il n'est pas encore suivi) : Qonforme n'a alors ni volume ni difficulté pour
 * lui, et le dit. Un clic sur « Mesurer » interroge, à la demande seulement :
 *
 * - la saisie semi-automatique de Google : la phrase existe-t-elle vraiment ?
 * - DataForSEO : recherches par mois, difficulté, CPC (quelques centimes) ;
 *   quand une donnée manque, la raison est écrite (clé absente, service
 *   injoignable, phrase trop rare), jamais un « — » muet.
 *
 * « Suivre ce mot-clé » l'ajoute à l'onglet Mots-clés avec ces mesures
 * (POST /api/admin/seo/ideas/adopt) ; l'éditeur relit alors son contexte et la
 * carte devient celle d'un mot-clé suivi.
 */
import { useEffect, useRef, useState } from "react"
import { Check, Info, Loader2, Radar, RotateCcw, TriangleAlert } from "lucide-react"
import { cn } from "@/lib/utils"
import { api } from "@/components/admin/seo/articles/api"
import { DifficultyPill } from "@/components/admin/blog/seo/difficulty"
import { isKeywordIntent } from "@/lib/seo/keywords/types"
import type { KeywordCheckResponse } from "@/lib/seo/articles/editor-types"
import type { AdoptResult } from "@/lib/seo/ideas/types"

const nf = (n: number) => Math.round(n).toLocaleString("fr-FR")

type Phase = { kind: "idle" } | { kind: "loading" } | { kind: "done"; result: KeywordCheckResponse } | { kind: "error"; message: string }
type Tracking = { kind: "idle" } | { kind: "saving" } | { kind: "done" } | { kind: "error"; message: string }

export function KeywordCheck({ keyword, articleTitle, onTracked, className }: { keyword: string; articleTitle: string; onTracked: () => void; className?: string }) {
  const [phase, setPhase] = useState<Phase>({ kind: "idle" })
  const [tracking, setTracking] = useState<Tracking>({ kind: "idle" })
  const runId = useRef(0)

  // Autre mot-clé : on repart de zéro, et la réponse tardive de l'ancien est ignorée
  useEffect(() => {
    runId.current++
    setPhase({ kind: "idle" })
    setTracking({ kind: "idle" })
  }, [keyword])

  async function measure() {
    const id = ++runId.current
    setPhase({ kind: "loading" })
    setTracking({ kind: "idle" })
    const res = await api<KeywordCheckResponse>("/api/admin/blog/keyword-check", "POST", { keyword })
    if (id !== runId.current) return
    if (!res.ok || !res.data) setPhase({ kind: "error", message: res.error ?? "La mesure n'a pas pu être faite. Réessayez dans un instant." })
    else setPhase({ kind: "done", result: res.data })
  }

  async function track(result: KeywordCheckResponse) {
    if (tracking.kind === "saving") return
    setTracking({ kind: "saving" })
    const title = articleTitle.trim().length >= 5 ? articleTitle.trim().slice(0, 160) : `Article sur ${keyword}`.slice(0, 160)
    const res = await api<AdoptResult>("/api/admin/seo/ideas/adopt", "POST", {
      keyword,
      title,
      articleType: "guide",
      intent: isKeywordIntent(result.metrics.intent) ? result.metrics.intent : null,
      volume: result.metrics.volume,
      difficulty: result.metrics.difficulty === null ? null : Math.round(result.metrics.difficulty),
      cpc: result.metrics.cpc,
      note: "Mot-clé principal saisi à la main dans l'éditeur",
      createTopic: false,
      targeted: true,
    })
    if (!res.ok) {
      setTracking({ kind: "error", message: res.error ?? "Le mot-clé n'a pas pu être suivi." })
      return
    }
    setTracking({ kind: "done" })
    onTracked()
  }

  return (
    <div className={cn("mt-3 flex flex-col gap-2.5 rounded-lg border border-dashed border-[var(--q-line)] bg-[var(--q-surface)] px-3 py-2.5", className)}>
      <p className="m-0 flex items-start gap-1.5 text-[12.5px] leading-snug text-[var(--q-text-3)]">
        <Info className="mt-0.5 size-3.5 shrink-0 text-[var(--q-text-4)]" aria-hidden />
        <span>
          Ce mot-clé est <strong className="font-semibold text-[var(--q-ink)]">utilisé tel quel</strong>. Il n&apos;est pas dans votre suivi : Qonforme n&apos;a donc ni volume, ni difficulté, ni position pour lui.
        </span>
      </p>

      {phase.kind === "idle" && (
        <button type="button" onClick={() => void measure()} className="q-btn q-btn-secondary q-btn-sm self-start max-md:!h-11">
          <Radar aria-hidden />
          Mesurer avec Google et DataForSEO
        </button>
      )}

      <div aria-live="polite" aria-busy={phase.kind === "loading"} className="flex flex-col gap-2 empty:hidden">
        {phase.kind === "loading" && (
          <p className="m-0 flex items-center gap-2 text-[12.5px] text-[var(--q-text-3)]">
            <Loader2 className="size-4 animate-spin motion-reduce:animate-none" aria-hidden />
            Recherche dans Google et dans DataForSEO…
          </p>
        )}
        {phase.kind === "error" && (
          <div role="alert" className="flex flex-wrap items-center gap-2 text-[12.5px] leading-snug text-[var(--q-danger)]">
            <TriangleAlert className="size-3.5 shrink-0" aria-hidden />
            <span className="min-w-0 flex-1">{phase.message}</span>
            <button type="button" onClick={() => void measure()} className="q-btn q-btn-secondary q-btn-sm max-md:!h-11">
              <RotateCcw aria-hidden />
              Réessayer
            </button>
          </div>
        )}
        {phase.kind === "done" && <Result result={phase.result} onRetry={() => void measure()} />}
      </div>

      {phase.kind === "done" && !phase.result.competitor && (
        <div className="flex flex-col gap-1.5">
          {phase.result.tracked ? (
            <p className="m-0 flex items-center gap-1.5 text-[12.5px] font-medium text-[var(--q-ok)]" role="status">
              <Check className="size-4" aria-hidden />
              Déjà dans l&apos;onglet Mots-clés
            </p>
          ) : tracking.kind === "done" ? (
            <p className="m-0 flex items-center gap-1.5 text-[12.5px] font-medium text-[var(--q-ok)]" role="status">
              <Check className="size-4" aria-hidden />
              Mot-clé suivi dans l&apos;onglet Mots-clés
            </p>
          ) : (
            <button type="button" onClick={() => void track(phase.result)} disabled={tracking.kind === "saving"} className="q-btn q-btn-primary q-btn-sm self-start max-md:!h-11">
              {tracking.kind === "saving" ? <Loader2 className="animate-spin motion-reduce:animate-none" aria-hidden /> : <Check aria-hidden />}
              Suivre ce mot-clé
            </button>
          )}
          {tracking.kind === "error" && (
            <p role="alert" className="m-0 flex items-start gap-1.5 text-[12.5px] leading-snug text-[var(--q-danger)]">
              <TriangleAlert className="mt-0.5 size-3.5 shrink-0" aria-hidden />
              {tracking.message}
            </p>
          )}
        </div>
      )}
    </div>
  )
}

function Result({ result, onRetry }: { result: KeywordCheckResponse; onRetry: () => void }) {
  const { google, metrics } = result
  const measured = metrics.state === "ok" || metrics.state === "tracked"
  return (
    <>
      {result.competitor && (
        <p className="m-0 flex items-start gap-1.5 text-[12.5px] leading-snug text-[var(--q-warn)]">
          <TriangleAlert className="mt-0.5 size-3.5 shrink-0" aria-hidden />
          Ce mot-clé nomme un concurrent suivi (usage interne) : l&apos;IA et le contrôle de publication le refuseront. Choisissez-en un autre.
        </p>
      )}

      <p className={cn("m-0 flex items-start gap-1.5 text-[12.5px] leading-snug", google.verified ? "text-[var(--q-ok)]" : "text-[var(--q-text-3)]")}>
        {google.verified ? <Check className="mt-0.5 size-3.5 shrink-0" aria-hidden /> : <Info className="mt-0.5 size-3.5 shrink-0 text-[var(--q-text-4)]" aria-hidden />}
        <span>
          {google.state === "unreachable"
            ? "Google n'a pas répondu : l'existence de la phrase n'a pas pu être vérifiée."
            : google.verified
              ? "Vu dans Google : la phrase est proposée quand on la tape."
              : "Google ne propose pas cette phrase quand on la tape. Cela ne prouve pas que personne ne la cherche : la saisie semi-automatique ne montre que les phrases fréquentes."}
          {google.also.length > 0 && <span className="text-[var(--q-text-3)]"> Google propose aussi : {google.also.map((a) => `« ${a} »`).join(", ")}.</span>}
        </span>
      </p>

      {measured && (metrics.volume !== null || metrics.difficulty !== null) ? (
        <dl className="m-0 grid grid-cols-3 overflow-hidden rounded-lg border border-[var(--q-line)] bg-[var(--q-surface-2)]">
          <div className="flex min-w-0 flex-col gap-0.5 px-2.5 py-2">
            <dt className="text-[11px] text-[var(--q-text-4)]">Recherches</dt>
            <dd className="q-num m-0 text-[14px] font-semibold tabular-nums text-[var(--q-ink)]">
              {metrics.volume !== null ? (
                <>
                  {nf(metrics.volume)}
                  <span className="text-[11px] font-normal text-[var(--q-text-4)]">/mois</span>
                </>
              ) : (
                "—"
              )}
            </dd>
          </div>
          <div className="flex min-w-0 flex-col gap-0.5 border-l border-[var(--q-line-soft)] px-2.5 py-2">
            <dt className="text-[11px] text-[var(--q-text-4)]">Difficulté</dt>
            <dd className="m-0 text-[14px] font-semibold">{metrics.difficulty !== null ? <DifficultyPill value={metrics.difficulty} className="!h-[22px] !text-[12px]" /> : "—"}</dd>
          </div>
          <div className="flex min-w-0 flex-col gap-0.5 border-l border-[var(--q-line-soft)] px-2.5 py-2">
            <dt className="text-[11px] text-[var(--q-text-4)]">Coût par clic</dt>
            <dd className="q-num m-0 text-[14px] font-semibold tabular-nums text-[var(--q-ink)]">
              {metrics.cpc !== null ? `${metrics.cpc.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} $` : "—"}
            </dd>
          </div>
        </dl>
      ) : null}

      {metrics.message && (
        <p className="m-0 flex items-start gap-1.5 text-[12.5px] leading-snug text-[var(--q-text-3)]">
          <Info className="mt-0.5 size-3.5 shrink-0 text-[var(--q-text-4)]" aria-hidden />
          <span className="min-w-0 flex-1">
            {metrics.message}
            {metrics.state === "unavailable" && (
              <button type="button" onClick={onRetry} className="q-link ml-1.5 inline-flex min-h-6 items-center gap-1 text-[12.5px] max-md:min-h-11">
                <RotateCcw className="size-3" aria-hidden />
                Réessayer
              </button>
            )}
          </span>
        </p>
      )}
      {metrics.state === "tracked" && <p className="m-0 text-[12px] text-[var(--q-text-4)]">Mesures reprises de l&apos;onglet Mots-clés.</p>}
    </>
  )
}
