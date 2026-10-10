"use client"

/**
 * Détail d'un mot-clé (`?mot-cle=<id>`), panneau latéral droit, dans l'ordre de
 * la planche Mots-cles-detail : mesures (avec leur provenance), position (et la
 * page qui ressort dans Google), page cible, statut, notes enregistrées
 * d'elles-mêmes ; puis l'intention (ajout, modifiable) ; « Créer un sujet
 * d'article » et « Ignorer ce mot-clé ». Écritures : PATCH /api/admin/seo/keywords/<id>.
 */
import { useEffect, useId, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { CircleCheck, ExternalLink, EyeOff, Eye, FileText, Loader2, Plus, Search, Target, ChevronDown } from "lucide-react"
import { toast } from "sonner"
import { SidePanel } from "@/components/admin/seo/SidePanel"
import { SetCrumb } from "@/components/layout/crumb"
import { cn } from "@/lib/utils"
import { KEYWORD_INTENT_LABELS, KEYWORD_STATUS, type KeywordIntent, type KeywordStatus } from "@/lib/seo/types"
import { fmtCount, fmtPosition, fmtRange, fmtRate, ctrOf } from "@/lib/seo/format"
import { siteUrl, toSitePath } from "@/lib/seo/site"
import type { DateRange } from "@/lib/seo/period"
import { KEYWORD_INTENTS, KEYWORD_STATUSES, type KeywordRow } from "@/lib/seo/keywords/types"
import type { PageLabel } from "@/lib/seo/keywords/page-label"
import type { TopPage } from "@/lib/seo/keywords/data"
import { notesNeedResend, notesNeedSave, notesStateWhenBackToSaved, notesToFlush, type NotesState } from "@/lib/seo/keywords/notes"
import { CpcValue, KeywordStatusPill, Missing, QuickWinPill, TargetLabel } from "@/components/admin/seo/keywords/parts"

const NOTES_DELAY_MS = 800

type SaveResult = { ok: true } | { ok: false; error: string }

async function patchKeyword(id: string, body: Record<string, unknown>, keepalive = false): Promise<SaveResult> {
  try {
    const res = await fetch(`/api/admin/seo/keywords/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      keepalive,
    })
    if (res.ok) return { ok: true }
    const data = (await res.json().catch(() => ({}))) as { error?: string }
    return { ok: false, error: data.error ?? "Enregistrement impossible." }
  } catch {
    return { ok: false, error: "Erreur réseau. Réessayez." }
  }
}

export function KeywordPanel({
  keyword: k,
  quickWin,
  target,
  topPage,
  topPageFailed,
  period,
  gscConfigured,
  metricsNote,
  closeHref,
  topicsHref,
}: {
  keyword: KeywordRow
  quickWin: boolean
  target: PageLabel | null
  topPage: TopPage | null
  topPageFailed: boolean
  /** Période des mesures de Search Console ; null : aucune donnée synchronisée. */
  period: DateRange | null
  /** Search Console configurée (sinon : « Connectez Search Console… »). */
  gscConfigured: boolean
  /** Provenance des mesures (lib/seo/keywords/provenance.ts, calculée côté serveur). */
  metricsNote: string
  closeHref: string
  topicsHref: string
}) {
  const router = useRouter()
  const ids = useId()
  const [status, setStatus] = useState<KeywordStatus>(k.status)
  const [intent, setIntent] = useState<KeywordIntent | null>(k.intent)
  const [busy, setBusy] = useState<null | "status" | "intent" | "target" | "ignore" | "topic">(null)

  /* ---------------- Page cible ---------------- */
  const [editingTarget, setEditingTarget] = useState(false)
  const [targetInput, setTargetInput] = useState(k.target_path ?? "")
  const [targetError, setTargetError] = useState<string | null>(null)

  const saveTarget = async (value: string) => {
    const raw = value.trim()
    const path = raw ? toSitePath(raw) : null
    if (raw && !path) {
      setTargetError("Chemin du site attendu, par exemple /modele (une page de qonforme.fr).")
      return
    }
    setBusy("target")
    setTargetError(null)
    const res = await patchKeyword(k.id, { target_path: path })
    setBusy(null)
    if (!res.ok) {
      setTargetError(res.error)
      return
    }
    setEditingTarget(false)
    setTargetInput(path ?? "")
    toast.success(path ? "Page cible enregistrée" : "Page cible retirée")
    router.refresh()
  }

  /* ---------------- Statut, intention ---------------- */
  const saveStatus = async (next: KeywordStatus, kind: "status" | "ignore" = "status") => {
    const previous = status
    setStatus(next)
    setBusy(kind)
    const res = await patchKeyword(k.id, { status: next })
    setBusy(null)
    if (!res.ok) {
      setStatus(previous)
      toast.error(res.error)
      return
    }
    toast.success(
      kind === "ignore"
        ? next === "ignored"
          ? "Mot-clé ignoré"
          : "Mot-clé de nouveau suivi"
        : `Statut : ${KEYWORD_STATUS[next].label}`,
    )
    router.refresh()
  }

  const saveIntent = async (next: KeywordIntent | null) => {
    const previous = intent
    setIntent(next)
    setBusy("intent")
    const res = await patchKeyword(k.id, { intent: next })
    setBusy(null)
    if (!res.ok) {
      setIntent(previous)
      toast.error(res.error)
      return
    }
    toast.success("Intention enregistrée")
    router.refresh()
  }

  /* ---------------- Notes (enregistrées d'elles-mêmes) ---------------- */
  const [notes, setNotes] = useState(k.notes ?? "")
  const [notesState, setNotesState] = useState<NotesState>("idle")
  const [notesError, setNotesError] = useState<string | null>(null)
  /** Relance de l'enregistrement quand la saisie a changé pendant un envoi. */
  const [notesResend, setNotesResend] = useState(0)
  /** Dernière valeur confirmée par le serveur. */
  const savedNotes = useRef(k.notes ?? "")
  /** Saisie actuelle (lue à la fermeture du panneau et à la fin d'un envoi). */
  const latestNotes = useRef(k.notes ?? "")
  /** Valeur en cours d'envoi, null sinon. */
  const sendingNotes = useRef<string | null>(null)

  useEffect(() => {
    latestNotes.current = notes
    if (!notesNeedSave(notes, savedNotes.current)) {
      // Retour à la valeur enregistrée : plus rien à envoyer, y compris à la fermeture.
      setNotesState(notesStateWhenBackToSaved)
      setNotesError(null)
      return
    }
    setNotesState("pending")
    const timer = setTimeout(async () => {
      const value = notes
      sendingNotes.current = value
      setNotesState("saving")
      const res = await patchKeyword(k.id, { notes: value })
      sendingNotes.current = null
      if (res.ok) {
        savedNotes.current = value
        setNotesError(null)
        setNotesState("saved")
        // Saisie modifiée pendant l'envoi (retour à l'ancienne valeur compris) : nouvel envoi.
        if (notesNeedResend(latestNotes.current, value)) setNotesResend((n) => n + 1)
      } else {
        setNotesError(res.error)
        setNotesState("error")
      }
    }, NOTES_DELAY_MS)
    return () => clearTimeout(timer)
  }, [notes, k.id, notesResend])

  // Panneau fermé avant l'enregistrement : la saisie affichée part quand même,
  // sauf si c'est déjà ce que le serveur a (ou ce qui est en cours d'envoi).
  useEffect(() => {
    const id = k.id
    return () => {
      const value = notesToFlush(latestNotes.current, sendingNotes.current, savedNotes.current)
      if (value !== null) void patchKeyword(id, { notes: value }, true)
    }
  }, [k.id])

  /* ---------------- Sujet d'article ---------------- */
  const createTopic = async () => {
    setBusy("topic")
    try {
      const res = await fetch(`/api/admin/seo/keywords/${k.id}/topic`, { method: "POST" })
      const data = (await res.json().catch(() => ({}))) as { error?: string; existing?: boolean }
      if (!res.ok) {
        toast.error(data.error ?? "Le sujet n'a pas pu être créé.")
        setBusy(null)
        return
      }
      toast.success(data.existing ? "Un sujet existe déjà pour ce mot-clé" : "Sujet d'article créé : à planifier dans Articles › Sujets")
      router.push(topicsHref)
    } catch {
      toast.error("Erreur réseau. Réessayez.")
      setBusy(null)
    }
  }

  const ignored = status === "ignored"
  const notesHint =
    notesState === "saving" ? "Enregistrement…" : notesState === "saved" ? "Enregistré" : notesState === "pending" ? "Modifications en attente…" : null

  return (
    <SidePanel
      title={k.keyword}
      titleClassName="font-mono !text-xl !font-medium !tracking-normal break-words [overflow-wrap:anywhere]"
      description={
        <span className="flex flex-wrap items-center gap-2 pt-1">
          <KeywordStatusPill status={status} />
          {quickWin && <QuickWinPill />}
        </span>
      }
      closeHref={closeHref}
      footer={
        <>
          <button
            type="button"
            onClick={() => saveStatus(ignored ? "candidate" : "ignored", "ignore")}
            disabled={busy !== null}
            className="q-btn q-btn-ghost max-md:order-2 max-md:h-12 max-md:w-full md:mr-auto"
          >
            {busy === "ignore" ? <Loader2 className="animate-spin" aria-hidden /> : ignored ? <Eye aria-hidden /> : <EyeOff aria-hidden />}
            {ignored ? "Ne plus ignorer" : "Ignorer ce mot-clé"}
          </button>
          <button
            type="button"
            onClick={createTopic}
            disabled={busy !== null || ignored}
            className="q-btn q-btn-primary max-md:order-1 max-md:h-12 max-md:w-full max-md:rounded-[14px]"
          >
            {busy === "topic" ? <Loader2 className="animate-spin" aria-hidden /> : <Plus aria-hidden />}
            Créer un sujet d&apos;article
          </button>
        </>
      }
    >
      <SetCrumb label={k.keyword} />
      <div className="flex flex-col gap-6">
        {/* Mesures */}
        <section aria-labelledby={`${ids}-mesures`} className="flex flex-col gap-2.5">
          <h3 id={`${ids}-mesures`} className="text-base font-semibold text-[var(--q-ink)]">
            Mesures
          </h3>
          <dl className="grid grid-cols-2 gap-2.5">
            <Measure label="Volume">
              {k.volume === null ? (
                <Missing label="Non connu" />
              ) : (
                <>
                  {fmtCount(k.volume)}
                  <span className="ml-1.5 text-[13px] font-medium tracking-normal text-[var(--q-text-4)]">/ mois</span>
                </>
              )}
            </Measure>
            <Measure label="Difficulté">{k.difficulty === null ? <Missing label="Non connue" /> : k.difficulty}</Measure>
            <Measure label="CPC">
              <CpcValue cpc={k.cpc} currency={k.cpc_currency} />
            </Measure>
            <Measure label="Intention" small>
              {intent ? KEYWORD_INTENT_LABELS[intent] : <Missing label="Non précisée" />}
            </Measure>
          </dl>
          <p className="text-[13px] text-[var(--q-text-4)]">{metricsNote}</p>
        </section>

        {/* Position (et page qui ressort dans Google, calculée à l'affichage) */}
        <section aria-labelledby={`${ids}-position`} className="flex flex-col gap-2.5">
          <h3 id={`${ids}-position`} className="text-base font-semibold text-[var(--q-ink)]">
            Position
          </h3>
          {!period ? (
            <EmptyBox icon={<Target className="size-[18px]" aria-hidden />}>
              {gscConfigured
                ? "Les positions et impressions arrivent après la première synchronisation de Search Console."
                : "Connectez Search Console pour voir vos clics et vos positions (Paramètres › Connexions)."}
            </EmptyBox>
          ) : k.position === null ? (
            <EmptyBox icon={<Target className="size-[18px]" aria-hidden />}>
              Pas encore de position : le mot-clé n&apos;a pas encore d&apos;impressions.
            </EmptyBox>
          ) : (
            <>
              <dl className="grid grid-cols-3 gap-2.5">
                <Measure label="Position">{fmtPosition(k.position)}</Measure>
                <Measure label="Impressions">{fmtCount(k.impressions)}</Measure>
                <Measure label="Clics">{fmtCount(k.clicks)}</Measure>
              </dl>
              <p className="text-[13px] text-[var(--q-text-4)]">
                Search Console, {fmtRange(period.from, period.to)} · taux de clic {fmtRate(ctrOf(k.clicks ?? 0, k.impressions ?? 0))}
              </p>
            </>
          )}
          {period && topPageFailed && (
            <p role="alert" className="text-sm text-[var(--q-danger)]">
              Impossible de lire la page qui ressort dans Google pour le moment.
            </p>
          )}
          {period && topPage && (
            <div className="flex flex-col gap-2 rounded-xl border border-[var(--q-line)] bg-[var(--q-surface)] p-3.5">
              <p id={`${ids}-ressort`} className="text-[13px] font-medium text-[var(--q-text-3)]">
                Page qui ressort dans Google
              </p>
              <div className="flex items-start gap-3">
                <Search className="mt-0.5 size-[18px] shrink-0 text-[var(--q-text-4)]" aria-hidden />
                <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <a
                    href={siteUrl(topPage.page)}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-describedby={`${ids}-ressort`}
                    className="inline-flex items-center gap-1 break-all font-mono text-[13px] font-medium text-[var(--q-ink)] hover:text-[var(--q-accent-strong)]"
                  >
                    {topPage.page}
                    <ExternalLink className="size-3.5 shrink-0" aria-hidden />
                    <span className="sr-only">(ouvre la page dans un nouvel onglet)</span>
                  </a>
                  <span className="text-[13px] text-[var(--q-text-4)]">
                    {fmtCount(topPage.impressions)} impression{topPage.impressions > 1 ? "s" : ""} · {fmtCount(topPage.clicks)} clic
                    {topPage.clicks > 1 ? "s" : ""} · position {fmtPosition(topPage.position)}
                  </span>
                </div>
              </div>
              {topPage.page !== k.target_path && (
                <button
                  type="button"
                  onClick={() => saveTarget(topPage.page)}
                  disabled={busy !== null}
                  className="q-btn q-btn-secondary q-btn-sm max-md:min-h-11 self-start"
                >
                  Choisir comme page cible
                </button>
              )}
            </div>
          )}
        </section>

        {/* Page cible */}
        <section aria-labelledby={`${ids}-cible`} className="flex flex-col gap-2.5">
          <h3 id={`${ids}-cible`} className="text-base font-semibold text-[var(--q-ink)]">
            Page cible
          </h3>
          {!editingTarget ? (
            <div className="flex items-center gap-3 rounded-xl border border-[var(--q-line)] bg-[var(--q-surface)] py-3 pl-3.5 pr-3">
              <FileText className="size-[18px] shrink-0 text-[var(--q-text-4)]" aria-hidden />
              <p className="min-w-0 flex-1 text-sm font-semibold text-[var(--q-ink)]">
                {target ? <TargetLabel target={target} /> : <span className="font-normal text-[var(--q-text-4)]">Aucune page cible</span>}
              </p>
              <button
                type="button"
                onClick={() => {
                  setTargetInput(k.target_path ?? "")
                  setTargetError(null)
                  setEditingTarget(true)
                }}
                aria-label="Changer la page cible"
                className="q-btn q-btn-secondary q-btn-sm max-md:min-h-11 shrink-0"
              >
                Changer
              </button>
            </div>
          ) : (
            <form
              className="flex flex-col gap-2"
              onSubmit={(e) => {
                e.preventDefault()
                void saveTarget(targetInput)
              }}
            >
              <label htmlFor={`${ids}-path`} className="text-[13px] text-[var(--q-text-3)]">
                Chemin de la page cible (vide : aucune)
              </label>
              <input
                id={`${ids}-path`}
                value={targetInput}
                onChange={(e) => setTargetInput(e.target.value)}
                autoFocus
                autoComplete="off"
                inputMode="url"
                placeholder="/guide/mentions-obligatoires-facture"
                aria-invalid={targetError ? true : undefined}
                aria-describedby={targetError ? `${ids}-path-err` : undefined}
                className="q-input font-mono text-base max-md:h-12 md:text-sm"
              />
              {targetError && (
                <p id={`${ids}-path-err`} role="alert" className="q-field-error">
                  {targetError}
                </p>
              )}
              <div className="flex flex-wrap gap-2">
                {/* Secondaire : « Créer un sujet d'article » reste la seule action primaire du panneau. */}
                <button type="submit" disabled={busy !== null} className="q-btn q-btn-secondary q-btn-sm max-md:min-h-11">
                  {busy === "target" && <Loader2 className="animate-spin" aria-hidden />}
                  Enregistrer
                </button>
                <button type="button" onClick={() => setEditingTarget(false)} disabled={busy === "target"} className="q-btn q-btn-ghost q-btn-sm max-md:min-h-11">
                  Annuler
                </button>
              </div>
            </form>
          )}
        </section>

        {/* Statut */}
        <div className="flex flex-col gap-2.5">
          <label htmlFor={`${ids}-status`} className="text-base font-semibold text-[var(--q-ink)]">
            Statut
          </label>
          <div className="relative">
            <CircleCheck className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[var(--q-text-4)]" aria-hidden />
            <select
              id={`${ids}-status`}
              value={status}
              onChange={(e) => saveStatus(e.target.value as KeywordStatus)}
              disabled={busy === "status" || busy === "ignore"}
              className="q-input appearance-none pl-9 pr-9 font-semibold max-md:h-12"
            >
              {KEYWORD_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {KEYWORD_STATUS[s].label}
                </option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-[var(--q-text-4)]" aria-hidden />
          </div>
        </div>

        {/* Notes */}
        <div className="flex flex-col gap-2.5">
          <div className="flex items-baseline justify-between gap-3">
            <label htmlFor={`${ids}-notes`} className="text-base font-semibold text-[var(--q-ink)]">
              Notes
            </label>
            <span aria-live="polite" className={cn("text-[13px]", notesState === "saved" ? "text-[var(--q-ok)]" : "text-[var(--q-text-4)]")}>
              {notesHint}
            </span>
          </div>
          <textarea
            id={`${ids}-notes`}
            rows={4}
            value={notes}
            maxLength={5000}
            onChange={(e) => setNotes(e.target.value)}
            aria-invalid={notesState === "error" ? true : undefined}
            aria-describedby={notesError ? `${ids}-notes-err` : undefined}
            className="q-input min-h-[112px] text-base md:text-sm"
          />
          {notesState === "error" && notesError && (
            <p id={`${ids}-notes-err`} role="alert" className="q-field-error">
              Notes non enregistrées : {notesError}
            </p>
          )}
        </div>

        {/* Intention (ajout à la planche : la mesure « Intention » ci-dessus, modifiable) */}
        <div className="flex flex-col gap-2.5">
          <label htmlFor={`${ids}-intent`} className="text-base font-semibold text-[var(--q-ink)]">
            Intention
          </label>
          <div className="relative">
            <select
              id={`${ids}-intent`}
              value={intent ?? ""}
              onChange={(e) => saveIntent(e.target.value ? (e.target.value as KeywordIntent) : null)}
              disabled={busy === "intent"}
              className="q-input appearance-none pr-9 max-md:h-12"
            >
              <option value="">Non précisée</option>
              {KEYWORD_INTENTS.map((i) => (
                <option key={i} value={i}>
                  {KEYWORD_INTENT_LABELS[i]}
                </option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-[var(--q-text-4)]" aria-hidden />
          </div>
        </div>
      </div>
    </SidePanel>
  )
}

function Measure({ label, children, small }: { label: string; children: React.ReactNode; small?: boolean }) {
  return (
    <div className="relative flex min-w-0 flex-col gap-1 rounded-xl border border-[var(--q-line)] bg-[var(--q-surface-2)] p-3.5">
      <dt className="text-[13px] text-[var(--q-text-3)]">{label}</dt>
      <dd
        className={cn(
          "flex items-baseline font-semibold tabular-nums text-[var(--q-ink)]",
          small ? "text-[15px] leading-[30px]" : "text-2xl leading-[30px] tracking-[-0.025em]",
        )}
      >
        {children}
      </dd>
    </div>
  )
}

function EmptyBox({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-[var(--q-line)] bg-[var(--q-surface-2)] p-3.5">
      <span className="grid size-9 shrink-0 place-items-center rounded-[10px] bg-[var(--q-wash)] text-[var(--q-accent-strong)]">{icon}</span>
      <p className="text-sm text-[var(--q-text-3)]">{children}</p>
    </div>
  )
}
