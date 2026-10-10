"use client"

/**
 * Détail d'un constat (planche Actions-detail) : panneau latéral droit ouvert
 * par l'adresse (`?constat=<id>`). Mesures de la page, pourquoi, action
 * recommandée (« Marquer comme fait », « Copier la consigne », « Ignorer » ou
 * « Rouvrir »), proposition rédigée à relire, vérification à 14 jours, historique.
 * Une action reprise du journal des modifications (source « import ») n'a ni
 * consigne, ni réouverture, ni mesure avant/après.
 */
import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { ArrowLeft, CalendarDays, Check, CircleCheck, Copy, ExternalLink, History, RotateCcw, Sparkles } from "lucide-react"
import { toast } from "sonner"
import { StatusPill } from "@/components/app/kit"
import { fmtDate, fmtDateTime } from "@/components/admin/ui"
import { PanelSection, SidePanel } from "@/components/admin/seo/SidePanel"
import { cn } from "@/lib/utils"
import { siteUrl } from "@/lib/seo/site"
import { fmtCount, fmtPosition, fmtRate, fmtRange } from "@/lib/seo/format"
import { FINDING_STATUS_LABELS, type FindingSeverity, type FindingSource, type FindingStatus, type PageType } from "@/lib/seo/types"
import { VERDICTS, windowLine, type Verification } from "@/lib/seo/actions/verdict"
import type { Suggestion } from "@/lib/seo/actions/suggest"
import { Duration, PageTypeTag, SeverityPill, SourceTag } from "@/components/admin/seo/actions/bits"

export interface PanelFinding {
  id: string
  rule: string
  path: string
  pageType: PageType | null
  title: string
  explanation: string | null
  recommendation: string | null
  severity: FindingSeverity
  source: FindingSource
  effortMinutes: number | null
  status: FindingStatus
  verifyAfter: string | null
  resolvedAt: string | null
  currentTitle: string | null
  currentDescription: string | null
  showDescription: boolean
}

export interface PanelMeasures {
  clicks: number
  impressions: number
  ctr: number | null
  position: number | null
}

export interface PanelHistoryItem {
  label: string
  at: string | null
  note?: string
  muted?: boolean
}

type Busy = null | "done" | "ignore" | "reopen" | "suggest"

export function FindingPanel({
  finding,
  closeHref,
  measures,
  measuresCaption,
  why,
  consigne,
  verification,
  history,
  suggestion,
  suggestible,
  geminiConfigured,
}: {
  finding: PanelFinding
  closeHref: string
  measures: PanelMeasures | null
  measuresCaption: string
  why: string
  consigne: string
  verification: Verification | null
  history: PanelHistoryItem[]
  suggestion: Suggestion | null
  suggestible: boolean
  geminiConfigured: boolean
}) {
  const router = useRouter()
  const [busy, setBusy] = useState<Busy>(null)

  async function act(action: "done" | "ignore" | "reopen") {
    setBusy(action)
    try {
      const res = await fetch(`/api/admin/seo/findings/${finding.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      })
      const data = (await res.json().catch(() => null)) as { error?: string } | null
      if (!res.ok) {
        toast.error(data?.error ?? "Le constat n'a pas pu être mis à jour. Réessayez dans un instant.")
        return
      }
      toast.success(
        action === "done"
          ? "Action marquée comme faite : son effet sera mesuré dans 14 jours."
          : action === "ignore"
            ? "Constat ignoré : il ne reviendra pas avant 30 jours."
            : "Constat rouvert.",
      )
      router.refresh()
    } catch {
      toast.error("Connexion impossible. Réessayez dans un instant.")
    } finally {
      setBusy(null)
    }
  }

  async function suggest() {
    setBusy("suggest")
    try {
      const res = await fetch(`/api/admin/seo/findings/${finding.id}/suggest`, { method: "POST" })
      const data = (await res.json().catch(() => null)) as { error?: string } | null
      if (!res.ok) {
        toast.error(data?.error ?? "La proposition n'a pas pu être rédigée. Réessayez dans un instant.")
        return
      }
      toast.success("Proposition prête : relisez-la avant de l'utiliser.")
      router.refresh()
    } catch {
      toast.error("Connexion impossible. Réessayez dans un instant.")
    } finally {
      setBusy(null)
    }
  }

  function copy(text: string, what: string) {
    if (!navigator.clipboard) {
      toast.error("Copie impossible : sélectionnez le texte à la main.")
      return
    }
    navigator.clipboard.writeText(text).then(
      () => toast.success(`${what} copié${what.endsWith("e") ? "e" : ""}.`),
      () => toast.error("Copie impossible : sélectionnez le texte à la main."),
    )
  }

  const open = finding.status === "open"
  const imported = finding.source === "import"
  const btn = "max-md:h-12 max-md:w-full max-md:rounded-[14px] max-md:text-[15px]"

  return (
    <SidePanel title={finding.title} closeHref={closeHref}>
      <div className="flex flex-col gap-5">
        <Link
          href={closeHref}
          scroll={false}
          className="-ml-2.5 -mt-2 inline-flex h-11 items-center gap-1.5 self-start whitespace-nowrap rounded-[9px] px-2.5 text-[13px] font-semibold text-[var(--q-text-2)] hover:bg-[var(--q-wash)] md:h-[34px]"
        >
          <ArrowLeft className="size-4" strokeWidth={1.75} aria-hidden />
          Actions SEO
        </Link>

        {/* Page, gravité, source, durée */}
        <div className="flex flex-col gap-2.5">
          <div className="flex flex-wrap items-center gap-2">
            <span className="break-all font-mono text-sm text-[var(--q-ink)]">{finding.path}</span>
            <a
              href={siteUrl(finding.path)}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`Ouvrir ${finding.path} sur qonforme.fr dans un nouvel onglet`}
              className="inline-grid size-11 place-items-center rounded-lg text-[var(--q-accent-strong)] hover:bg-[var(--q-wash)] md:size-7"
            >
              <ExternalLink className="size-4" aria-hidden />
            </a>
            <PageTypeTag type={finding.pageType} />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <SeverityPill severity={finding.severity} />
            <SourceTag source={finding.source} />
            <Duration minutes={finding.effortMinutes} long />
            {!open && (
              <StatusPill tone={finding.status === "done" ? "ok" : "neutral"} icon={finding.status === "done" ? <Check strokeWidth={2.75} aria-hidden /> : undefined}>
                {FINDING_STATUS_LABELS[finding.status]}
              </StatusPill>
            )}
          </div>
        </div>

        <PanelSection title="Mesures de la page">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {[
              { label: "Impressions", value: measures ? fmtCount(measures.impressions) : "—" },
              { label: "Clics", value: measures ? fmtCount(measures.clicks) : "—" },
              { label: "CTR", value: measures ? fmtRate(measures.ctr) : "—" },
              { label: "Position", value: measures ? fmtPosition(measures.position) : "—" },
            ].map((m) => (
              <div key={m.label} className="q-inset flex flex-col gap-1 p-3">
                <span className="text-[13px] text-[var(--q-text-4)]">{m.label}</span>
                <span className="font-display text-2xl font-semibold tabular-nums tracking-tight text-[var(--q-ink)]">{m.value}</span>
              </div>
            ))}
          </div>
          <p className="text-xs text-[var(--q-text-4)]">{measuresCaption}</p>
        </PanelSection>

        {why && (
          <PanelSection title="Pourquoi">
            <p className="text-sm leading-relaxed text-[var(--q-text-2)]">{why}</p>
          </PanelSection>
        )}

        <PanelSection title="Action recommandée">
          <div className="q-inset flex flex-col gap-3 p-3.5">
            <p className="text-[15px] font-medium leading-normal text-[var(--q-ink)]">
              {finding.recommendation ?? finding.explanation ?? (imported ? "Action reprise du journal des modifications." : "—")}
            </p>
            {finding.currentTitle && (
              <div className="flex flex-col gap-1.5">
                <span className="text-xs font-semibold text-[var(--q-text-3)]">Title actuel</span>
                <p className="break-words rounded-[10px] border border-[var(--q-line)] bg-[var(--q-surface)] px-3 py-2.5 font-mono text-[13px] leading-normal text-[var(--q-ink)]">
                  {finding.currentTitle}
                </p>
              </div>
            )}
            {finding.showDescription && finding.currentDescription && (
              <div className="flex flex-col gap-1.5">
                <span className="text-xs font-semibold text-[var(--q-text-3)]">Description actuelle</span>
                <p className="break-words rounded-[10px] border border-[var(--q-line)] bg-[var(--q-surface)] px-3 py-2.5 font-mono text-[13px] leading-normal text-[var(--q-ink)]">
                  {finding.currentDescription}
                </p>
              </div>
            )}
          </div>

          {suggestible && (
            <SuggestionBlock
              suggestion={suggestion}
              configured={geminiConfigured}
              busy={busy === "suggest"}
              disabled={busy !== null}
              onSuggest={suggest}
              onCopy={copy}
            />
          )}

          <div className="flex flex-wrap items-center gap-2 pt-1">
            {open && (
              <button type="button" className={cn("q-btn q-btn-primary", btn)} onClick={() => act("done")} disabled={busy !== null} aria-busy={busy === "done"}>
                <Check aria-hidden />
                {busy === "done" ? "Enregistrement…" : "Marquer comme fait"}
              </button>
            )}
            {!imported && (
              <button type="button" className={cn("q-btn q-btn-secondary", btn)} onClick={() => copy(consigne, "Consigne")}>
                <Copy aria-hidden />
                Copier la consigne
              </button>
            )}
            {open && (
              <button type="button" className={cn("q-btn q-btn-ghost", btn)} onClick={() => act("ignore")} disabled={busy !== null} aria-busy={busy === "ignore"}>
                {busy === "ignore" ? "Enregistrement…" : "Ignorer"}
              </button>
            )}
            {!imported && (finding.status === "done" || finding.status === "ignored") && (
              <button type="button" className={cn("q-btn q-btn-ghost", btn)} onClick={() => act("reopen")} disabled={busy !== null} aria-busy={busy === "reopen"}>
                <RotateCcw aria-hidden />
                {busy === "reopen" ? "Enregistrement…" : "Rouvrir"}
              </button>
            )}
          </div>
        </PanelSection>

        <PanelSection title="Vérifier le résultat">
          <VerificationBlock
            status={finding.status}
            imported={imported}
            verifyAfter={finding.verifyAfter}
            resolvedAt={finding.resolvedAt}
            verification={verification}
          />
        </PanelSection>

        <PanelSection title="Historique">
          <ul className="m-0 list-none p-0">
            {history.map((h, i) => (
              <li key={`${h.label}-${i}`} className={cn("flex min-h-11 items-start gap-3 py-2", i > 0 && "border-t border-[var(--q-line-soft)]")}>
                <span
                  className={cn("mt-1.5 size-2 shrink-0 rounded-full", h.muted ? "bg-[var(--q-field)]" : "bg-[var(--q-accent)]")}
                  aria-hidden
                />
                <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className={cn("text-sm", h.muted ? "text-[var(--q-text-3)]" : "text-[var(--q-ink)]")}>{h.label}</span>
                  {h.note && <span className="break-words text-[13px] text-[var(--q-text-4)]">{h.note}</span>}
                </span>
                <span className="whitespace-nowrap pt-0.5 text-[13px] tabular-nums text-[var(--q-text-3)]">{h.at ? fmtDateTime(h.at) : "—"}</span>
              </li>
            ))}
          </ul>
        </PanelSection>
      </div>
    </SidePanel>
  )
}

function SuggestionBlock({
  suggestion,
  configured,
  busy,
  disabled,
  onSuggest,
  onCopy,
}: {
  suggestion: Suggestion | null
  configured: boolean
  busy: boolean
  disabled: boolean
  onSuggest: () => void
  onCopy: (text: string, what: string) => void
}) {
  const button = (
    <button
      type="button"
      className="q-btn q-btn-secondary q-btn-sm max-md:h-11 max-md:w-full"
      onClick={onSuggest}
      disabled={!configured || disabled}
      aria-busy={busy}
      aria-describedby={!configured ? "suggestion-indisponible" : undefined}
    >
      <Sparkles aria-hidden />
      {busy ? "Rédaction en cours…" : suggestion ? "Proposer à nouveau" : "Proposer un title et une description"}
    </button>
  )

  if (!suggestion) {
    return (
      <div className="flex flex-col gap-1.5">
        <div>{button}</div>
        {!configured && (
          <p id="suggestion-indisponible" className="text-[13px] text-[var(--q-text-4)]">
            Indisponible : la clé Gemini (GEMINI_API_KEY) n&apos;est pas configurée. Ajoutez-la dans les variables d&apos;environnement, voir Paramètres › Connexions.
          </p>
        )}
      </div>
    )
  }

  const len = (s: string) => Array.from(s).length
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-[var(--q-warn-line)] bg-[var(--q-warn-bg)] p-3.5">
      <div className="flex flex-wrap items-center gap-2">
        <span className="q-tag">Suggestion IA</span>
        <StatusPill tone="warn">À relire</StatusPill>
        {suggestion.generatedAt && <span className="text-xs text-[var(--q-text-4)]">{fmtDate(suggestion.generatedAt)}</span>}
      </div>
      {[
        { what: "Title", label: `Title proposé (${len(suggestion.title)} caractères)`, text: suggestion.title },
        { what: "Description", label: `Description proposée (${len(suggestion.description)} caractères)`, text: suggestion.description },
      ].map((s) => (
        <div key={s.what} className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-semibold text-[var(--q-text-3)]">{s.label}</span>
            <button
              type="button"
              className="q-btn q-btn-ghost q-btn-sm max-md:h-11"
              onClick={() => onCopy(s.text, s.what)}
              aria-label={`Copier ${s.what === "Title" ? "le title proposé" : "la description proposée"}`}
            >
              <Copy aria-hidden />
              Copier
            </button>
          </div>
          <p className="break-words rounded-[10px] border border-[var(--q-line)] bg-[var(--q-surface)] px-3 py-2.5 text-sm leading-normal text-[var(--q-ink)]">{s.text}</p>
        </div>
      ))}
      <p className="text-xs text-[var(--q-text-3)]">
        Proposition contrôlée (longueurs, vouvoiement, affirmations), à relire avant de l&apos;écrire dans la page.
      </p>
      <div>{button}</div>
    </div>
  )
}

function VerificationBlock({
  status,
  imported,
  verifyAfter,
  resolvedAt,
  verification,
}: {
  status: FindingStatus
  imported: boolean
  verifyAfter: string | null
  resolvedAt: string | null
  verification: Verification | null
}) {
  const icon = <CalendarDays className="mt-0.5 size-5 shrink-0 text-[var(--q-text-4)]" aria-hidden />
  if (status === "resolved") {
    return (
      <div className="flex items-start gap-3">
        <CircleCheck className="mt-0.5 size-5 shrink-0 text-[var(--q-ok)]" aria-hidden />
        <p className="text-sm text-[var(--q-text-2)]">
          Le constat s&apos;est résolu de lui-même{resolvedAt ? ` le ${fmtDate(resolvedAt)}` : ""} : la règle ne s&apos;applique plus à la page.
        </p>
      </div>
    )
  }
  if (status === "ignored") {
    return <p className="text-sm text-[var(--q-text-3)]">Aucune mesure : le constat est ignoré. Il pourra revenir au bout de 30 jours s&apos;il se présente encore.</p>
  }
  if (status === "open") {
    return (
      <div className="flex items-start gap-3">
        {icon}
        <div className="flex min-w-0 flex-col gap-0.5">
          <span className="text-sm font-semibold text-[var(--q-ink)]">Mesure avant/après proposée dans 14&nbsp;jours</span>
          <span className="text-[13px] leading-normal text-[var(--q-text-4)]">
            Impressions, clics, CTR et position de la page, comparés 14&nbsp;jours après que vous avez marqué l&apos;action comme faite.
          </span>
        </div>
      </div>
    )
  }

  const before = verification?.before ?? null
  const after = verification?.after ?? null
  if (after && before && verification?.verdict) {
    const v = VERDICTS[verification.verdict]
    const rows = [
      { label: "Impressions", b: fmtCount(before.impressions), a: fmtCount(after.impressions) },
      { label: "Clics", b: fmtCount(before.clicks), a: fmtCount(after.clicks) },
      { label: "CTR", b: fmtRate(before.ctr), a: fmtRate(after.ctr) },
      { label: "Position", b: fmtPosition(before.position), a: fmtPosition(after.position) },
    ]
    return (
      <div className="flex flex-col gap-3">
        <p className="flex flex-wrap items-center gap-2 text-sm text-[var(--q-ink)]">
          Résultat&nbsp;: <StatusPill tone={v.tone}>{v.label}</StatusPill>
        </p>
        <div className="overflow-x-auto rounded-xl border border-[var(--q-line)]">
          <table className="q-table">
            <caption className="sr-only">Mesures de la page avant et après l&apos;action</caption>
            <thead>
              <tr>
                <th scope="col">Mesure</th>
                <th scope="col" className="!text-right">Avant</th>
                <th scope="col" className="!text-right">Après</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.label}>
                  <th scope="row" className="!border-t-0 !text-[13px] !font-medium !text-[var(--q-text-2)]">{r.label}</th>
                  <td className="text-right tabular-nums">{r.b}</td>
                  <td className="text-right tabular-nums">{r.a}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-[var(--q-text-4)]">
          Avant : {fmtRange(before.from, before.to)} · Après : {fmtRange(after.from, after.to)} (Search Console)
        </p>
      </div>
    )
  }

  // Action reprise du journal, ou faite sans date de mesure : aucune mesure n'est prévue.
  if (imported || !verifyAfter) {
    return (
      <div className="flex items-start gap-3">
        <History className="mt-0.5 size-5 shrink-0 text-[var(--q-text-4)]" aria-hidden />
        <div className="flex min-w-0 flex-col gap-0.5">
          <span className="text-sm font-semibold text-[var(--q-ink)]">Pas de mesure avant/après</span>
          <span className="text-[13px] leading-normal text-[var(--q-text-4)]">
            {imported
              ? "Action reprise du journal des modifications : elle n'a pas de date de mesure, son effet n'est pas comparé."
              : "Cette action n'a pas de date de mesure : son effet n'est pas comparé."}
          </span>
        </div>
      </div>
    )
  }

  const due = Date.parse(verifyAfter) <= Date.now()
  return (
    <div className="flex items-start gap-3">
      {icon}
      <div className="flex min-w-0 flex-col gap-1">
        <span className="text-sm font-semibold text-[var(--q-ink)]">
          {due ? "Mesure en attente des données de Search Console" : `Mesure prévue le ${fmtDate(verifyAfter)}`}
        </span>
        <span className="text-[13px] leading-normal text-[var(--q-text-4)]">
          {due
            ? "Search Console publie ses chiffres avec 2 à 3 jours de décalage : le résultat s'affiche dès qu'il couvre les 14 jours qui suivent l'action."
            : "Impressions, clics, CTR et position de la page sur les 14 jours qui suivent l'action, comparés aux 14 jours d'avant."}
        </span>
        {before && (
          <span className="text-[13px] text-[var(--q-text-3)]">
            Avant ({fmtRange(before.from, before.to)}) : {windowLine(before)}
          </span>
        )}
        {!before && <span className="text-[13px] text-[var(--q-text-4)]">Les mesures « avant » seront relevées au moment de la vérification.</span>}
      </div>
    </div>
  )
}
