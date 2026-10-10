"use client"

/**
 * Panneau « Gérer le suivi » (planche Visibilite-suivi), ouvert par `?suivi=1` :
 * marque et termes recherchés, moteurs interrogés, questions à suivre, fréquence et
 * coût estimé d'un relevé.
 *
 * Enregistrement, dans l'ordre et en disant ce qui l'a été : réglages « geo », puis
 * termes de marque s'ils ont changé (le reste du ciblage est relu juste avant : un
 * changement fait entre-temps dans Paramètres › Ciblage n'est pas écrasé), par
 * /api/admin/seo/settings/<section>, puis cases des questions par
 * /api/admin/seo/geo/questions/<id>. Ajouter, modifier ou supprimer une question est
 * immédiat (chaque action a sa confirmation). Un moteur sans clé ne peut pas être allumé.
 */
import { useEffect, useId, useMemo, useRef, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Check, Info, Loader2, Pencil, Plus, Trash2, X } from "lucide-react"
import { SidePanel, PanelSection } from "@/components/admin/seo/SidePanel"
import { StatusPill, Switch } from "@/components/app/kit"
import { cn } from "@/lib/utils"
import { enginePill, type GeoEngine } from "@/lib/seo/types"
import type { GeoSettings, TargetingSettings } from "@/lib/seo/settings-schema"
import type { EngineStatus } from "@/lib/seo/geo/engine-status"
import type { GeoQuestionRow } from "@/lib/seo/geo/types"
import { GEO_LANGUAGES, GEO_MARKETS } from "@/lib/seo/geo/engines/context"
import { estimateRunCost, fmtUsd } from "@/lib/seo/geo/cost"
import { MAX_GEO_QUESTIONS, parseBrandTerms, QUESTION_MAX, QUESTION_MIN } from "@/lib/seo/geo/questions"

async function send(url: string, method: string, body?: unknown): Promise<{ ok: boolean; status: number; data: Record<string, unknown> }> {
  try {
    const res = await fetch(url, {
      method,
      headers: body === undefined ? undefined : { "content-type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    })
    const data = (await res.json().catch(() => ({}))) as Record<string, unknown>
    return { ok: res.ok, status: res.status, data }
  } catch {
    return { ok: false, status: 0, data: { error: "Erreur réseau. Vérifiez votre connexion puis réessayez." } }
  }
}

const errorOf = (data: Record<string, unknown>, fallback: string) => (typeof data.error === "string" && data.error) || fallback

export function SuiviPanel({
  closeHref,
  brandName,
  siteUrl,
  geo,
  targeting,
  engines,
  questions,
  notYetIds,
  lastRunLabel,
}: {
  closeHref: string
  brandName: string
  siteUrl: string
  geo: GeoSettings
  targeting: TargetingSettings
  engines: EngineStatus[]
  questions: GeoQuestionRow[]
  /** Questions que le dernier relevé n'a pas posées (« Pas encore relevée »). */
  notYetIds: string[]
  lastRunLabel: string | null
}) {
  const router = useRouter()
  const [market, setMarket] = useState(geo.market)
  const [language, setLanguage] = useState(geo.language)
  const [termsText, setTermsText] = useState(targeting.brandTerms.join("\n"))
  const [enabled, setEnabled] = useState<Record<GeoEngine, boolean>>({ ...geo.engines })
  const [dayOfMonth, setDayOfMonth] = useState(geo.dayOfMonth)
  const [repetitions, setRepetitions] = useState<1 | 3 | 5>(geo.repetitions)
  const [activeById, setActiveById] = useState<Record<string, boolean>>({})
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})

  const isActive = (q: GeoQuestionRow) => activeById[q.id] ?? q.active
  const activeCount = questions.filter(isActive).length
  const terms = useMemo(() => parseBrandTerms(termsText), [termsText])
  // Un moteur sans clé ne peut pas être allumé : affiché et enregistré éteint
  const isOn = (e: EngineStatus) => Boolean(enabled[e.key]) && e.configured
  const queried = engines.filter(isOn).map((e) => e.key)
  const cost = estimateRunCost({ questions: activeCount, engines: queried, repetitions })

  const marketOptions = GEO_MARKETS.some((m) => m.label === market) ? GEO_MARKETS.map((m) => m.label) : [market, ...GEO_MARKETS.map((m) => m.label)]
  const languageOptions = GEO_LANGUAGES.some((l) => l.label === language) ? GEO_LANGUAGES.map((l) => l.label) : [language, ...GEO_LANGUAGES.map((l) => l.label)]

  const fail = (message: string) => {
    setError(message)
    toast.error(message)
  }

  const save = async () => {
    setError(null)
    setFieldErrors({})
    if (terms.error) {
      setFieldErrors({ brandTerms: terms.error })
      setError(terms.error)
      return
    }
    setSaving(true)
    try {
      // 1. Réglages du suivi
      const shownEngines = Object.fromEntries(engines.map((e) => [e.key, isOn(e)])) as Record<GeoEngine, boolean>
      const geoValue: GeoSettings = { ...geo, market, language, engines: { ...geo.engines, ...shownEngines }, dayOfMonth, repetitions }
      const g = await send("/api/admin/seo/settings/geo", "PUT", { value: geoValue })
      if (!g.ok) {
        if (g.data.fieldErrors && typeof g.data.fieldErrors === "object") setFieldErrors(g.data.fieldErrors as Record<string, string>)
        fail(`${errorOf(g.data, "Réglages du suivi non enregistrés.")} Rien n'a été modifié.`)
        return
      }

      // 2. Termes de marque, seulement s'ils ont changé : le reste du ciblage est relu
      //    juste avant, pour ne pas écraser un changement fait dans Paramètres › Ciblage
      if (terms.terms.join("\n") !== targeting.brandTerms.join("\n")) {
        const current = await send("/api/admin/seo/settings/targeting", "GET")
        const value = current.ok && current.data.value && typeof current.data.value === "object" ? (current.data.value as TargetingSettings) : null
        const t = value ? await send("/api/admin/seo/settings/targeting", "PUT", { value: { ...value, brandTerms: terms.terms } }) : current
        if (!t.ok || !value) {
          if (t.data.fieldErrors && typeof t.data.fieldErrors === "object") {
            const errors: Record<string, string> = {}
            Object.entries(t.data.fieldErrors as Record<string, string>).forEach(([k, v]) => {
              errors[k.startsWith("brandTerms") ? "brandTerms" : k] = v
            })
            setFieldErrors(errors)
          }
          fail(`Réglages du suivi enregistrés, mais pas les termes de marque : ${errorOf(t.data, "réessayez.")}`)
          router.refresh()
          return
        }
      }

      // 3. Questions cochées ou décochées
      const changed = questions.filter((q) => activeById[q.id] !== undefined && activeById[q.id] !== q.active)
      const results = await Promise.all(changed.map((q) => send(`/api/admin/seo/geo/questions/${q.id}`, "PATCH", { active: activeById[q.id] })))
      const failed = results.find((r) => !r.ok)
      if (failed) {
        fail(`Réglages du suivi enregistrés, mais pas le choix des questions : ${errorOf(failed.data, "réessayez.")}`)
        router.refresh()
        return
      }
      toast.success("Suivi enregistré.")
      router.push(closeHref, { scroll: false })
      router.refresh()
    } finally {
      setSaving(false)
    }
  }

  return (
    <SidePanel
      wide
      title="Gérer le suivi"
      description="La marque, les moteurs interrogés et les questions posées."
      closeHref={closeHref}
      footer={
        <>
          <Link href={closeHref} scroll={false} className="q-btn q-btn-secondary h-12 flex-1 md:h-10 md:flex-none">
            Annuler
          </Link>
          <button type="button" onClick={save} disabled={saving} aria-busy={saving} className="q-btn q-btn-primary h-12 flex-1 md:h-10 md:flex-none">
            {saving && <Loader2 className="animate-spin" aria-hidden />}
            Enregistrer le suivi
          </button>
        </>
      }
    >
      <div className="flex flex-col gap-6">
        {error && (
          <p role="alert" className="q-banner q-banner-danger text-sm">
            {error}
          </p>
        )}

        <PanelSection title="Marque">
          <p className="text-[13px] text-[var(--q-text-4)]">Ce que le suivi cherche dans les réponses.</p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="geo-brand" className="q-label">Nom de la marque</label>
              <input id="geo-brand" className="q-input" value={brandName} readOnly aria-describedby="geo-brand-hint" />
              <span id="geo-brand-hint" className="q-field-hint">
                Modifiable dans <Link href="/admin/seo/parametres" className="q-link">Paramètres › Contexte de marque</Link>.
              </span>
            </div>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="geo-site" className="q-label">Site web</label>
              <input id="geo-site" className="q-input q-mono" value={siteUrl} readOnly />
            </div>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="geo-market" className="q-label">Marché</label>
              <select
                id="geo-market"
                className="q-input"
                value={market}
                onChange={(e) => setMarket(e.target.value)}
                aria-invalid={Boolean(fieldErrors.market) || undefined}
                aria-describedby={fieldErrors.market ? "geo-market-error" : undefined}
              >
                {marketOptions.map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
              {fieldErrors.market && <span id="geo-market-error" className="q-field-error">{fieldErrors.market}</span>}
            </div>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="geo-language" className="q-label">Langue</label>
              <select
                id="geo-language"
                className="q-input"
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
                aria-invalid={Boolean(fieldErrors.language) || undefined}
                aria-describedby={fieldErrors.language ? "geo-language-error" : undefined}
              >
                {languageOptions.map((l) => (
                  <option key={l} value={l}>{l.charAt(0).toLocaleUpperCase("fr-FR") + l.slice(1)}</option>
                ))}
              </select>
              {fieldErrors.language && <span id="geo-language-error" className="q-field-error">{fieldErrors.language}</span>}
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="geo-terms" className="q-label">Termes de marque</label>
            <textarea
              id="geo-terms"
              className="q-input q-mono"
              rows={3}
              value={termsText}
              onChange={(e) => setTermsText(e.target.value)}
              aria-invalid={Boolean(fieldErrors.brandTerms) || undefined}
              aria-describedby={fieldErrors.brandTerms ? "geo-terms-hint geo-terms-error" : "geo-terms-hint"}
            />
            <span id="geo-terms-hint" className="q-field-hint">
              Une ligne par terme, sans tenir compte des majuscules ni des accents : une réponse qui en contient un compte comme une mention.
              « {brandName} » est toujours recherché.
            </span>
            {fieldErrors.brandTerms && <span id="geo-terms-error" className="q-field-error">{fieldErrors.brandTerms}</span>}
          </div>
        </PanelSection>

        <PanelSection title="Moteurs IA">
          <p className="text-[13px] text-[var(--q-text-4)]">Un moteur sans clé ne peut pas être activé.</p>
          <ul className="q-list overflow-hidden rounded-xl border border-[var(--q-line)]">
            {engines.map((e) => {
              const state = enginePill(e)
              return (
                <li key={e.key} className="flex flex-col gap-1.5 px-3 py-3">
                  <div className="flex items-center gap-3">
                    <span className="q-avatar" aria-hidden>{e.initials}</span>
                    <div className="flex min-w-0 flex-1 flex-col gap-1">
                      <span className="flex flex-wrap items-center gap-2">
                        <span id={`geo-engine-${e.key}`} className="text-sm font-semibold text-[var(--q-ink)]">{e.label}</span>
                        <StatusPill tone={state.tone}>{state.label}</StatusPill>
                      </span>
                      <span className="q-mono break-all text-xs text-[var(--q-text-4)]">{e.env.join(" · ")}</span>
                    </div>
                    <span className="grid min-h-11 min-w-11 place-items-center">
                      <Switch
                        checked={isOn(e)}
                        disabled={!e.configured}
                        onCheckedChange={(v) => setEnabled((prev) => ({ ...prev, [e.key]: v }))}
                        label={`Interroger ${e.label}${e.configured ? "" : ` (${state.label.toLocaleLowerCase("fr-FR")})`}`}
                      />
                    </span>
                  </div>
                </li>
              )
            })}
          </ul>
          <p className="text-[13px] text-[var(--q-text-4)]">
            Recommandé au départ : Gemini et ChatGPT. Les clés se règlent dans{" "}
            <Link href="/admin/seo/parametres/connexions" className="q-link">Paramètres › Connexions</Link>.
          </p>
        </PanelSection>

        <PanelSection title="Questions à suivre">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <p className="text-[13px] text-[var(--q-text-4)]">Posées telles quelles à chaque moteur interrogé.</p>
            <span className="text-[13px] tabular-nums text-[var(--q-text-3)]">
              {activeCount} sélectionnée{activeCount > 1 ? "s" : ""}
            </span>
          </div>
          <QuestionList
            questions={questions}
            notYetIds={notYetIds}
            isActive={isActive}
            onToggle={(id, v) => setActiveById((prev) => ({ ...prev, [id]: v }))}
            onChanged={() => router.refresh()}
          />
        </PanelSection>

        <PanelSection title="Fréquence">
          <p className="text-[13px] text-[var(--q-text-4)]">À quel rythme et combien de fois on interroge.</p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="geo-frequency" className="q-label">Relevé</label>
              <select id="geo-frequency" className="q-input" value="monthly" disabled>
                <option value="monthly">Mensuel</option>
              </select>
              <span className="q-field-hint">« Analyse immédiate » en lance un autre à tout moment.</span>
            </div>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="geo-day" className="q-label">Jour du mois</label>
              <select
                id="geo-day"
                className="q-input"
                value={dayOfMonth}
                onChange={(e) => setDayOfMonth(Number(e.target.value))}
                aria-invalid={Boolean(fieldErrors.dayOfMonth) || undefined}
                aria-describedby={fieldErrors.dayOfMonth ? "geo-day-hint geo-day-error" : "geo-day-hint"}
              >
                {Array.from({ length: 28 }, (_, i) => i + 1).map((d) => (
                  <option key={d} value={d}>{d === 1 ? "1er" : d} du mois</option>
                ))}
              </select>
              <span id="geo-day-hint" className="q-field-hint">À partir de 6 h (heure de Paris).</span>
              {fieldErrors.dayOfMonth && <span id="geo-day-error" className="q-field-error">{fieldErrors.dayOfMonth}</span>}
            </div>
            <div className="flex flex-col gap-1.5 sm:col-span-2">
              <label htmlFor="geo-reps" className="q-label">Répétitions par question</label>
              <select
                id="geo-reps"
                className="q-input"
                value={repetitions}
                onChange={(e) => setRepetitions(Number(e.target.value) as 1 | 3 | 5)}
              >
                <option value={1}>1 répétition</option>
                <option value={3}>3 répétitions</option>
                <option value={5}>5 répétitions</option>
              </select>
              <span className="q-field-hint">
                Une réponse varie d&apos;une fois à l&apos;autre : plusieurs essais donnent une mesure plus stable.
              </span>
            </div>
          </div>
          <div className="q-inset flex items-start gap-2 p-3 text-[13px] text-[var(--q-text-2)]">
            <Info className="mt-0.5 size-4 shrink-0 text-[var(--q-text-4)]" aria-hidden />
            <div className="flex flex-col gap-1">
              <span>
                Au prochain relevé : {activeCount} question{activeCount > 1 ? "s" : ""} × {repetitions} répétition{repetitions > 1 ? "s" : ""} ×{" "}
                {queried.length} moteur{queried.length > 1 ? "s" : ""} interrogé{queried.length > 1 ? "s" : ""} = {cost.calls} requête{cost.calls > 1 ? "s" : ""}.
              </span>
              <span>
                Coût estimé : environ {fmtUsd(cost.usd)} par relevé (tarifs publics des fournisseurs relevés en octobre 2026 ; le coût réel
                dépend de la longueur des réponses).
              </span>
              {lastRunLabel && <span className="text-[var(--q-text-4)]">Dernier relevé : {lastRunLabel}.</span>}
            </div>
          </div>
        </PanelSection>
      </div>
    </SidePanel>
  )
}

/* ------------------------------------------------------------------ */
/* Questions : cases, modification, suppression, ajout                 */
/* ------------------------------------------------------------------ */

function QuestionList({
  questions,
  notYetIds,
  isActive,
  onToggle,
  onChanged,
}: {
  questions: GeoQuestionRow[]
  notYetIds: string[]
  isActive: (q: GeoQuestionRow) => boolean
  onToggle: (id: string, value: boolean) => void
  onChanged: () => void
}) {
  const [editing, setEditing] = useState<string | null>(null)
  const [confirming, setConfirming] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)
  const [busy, setBusy] = useState(false)

  // Clavier : le focus ne se perd jamais quand une ligne change de forme
  const editRefs = useRef<Record<string, HTMLButtonElement | null>>({})
  const deleteRefs = useRef<Record<string, HTMLButtonElement | null>>({})
  const confirmCancelRef = useRef<HTMLButtonElement | null>(null)
  const addRef = useRef<HTMLButtonElement | null>(null)
  const focusNext = useRef<(() => HTMLElement | null | undefined) | null>(null)
  useEffect(() => {
    const target = focusNext.current
    if (!target) return
    focusNext.current = null
    target()?.focus()
  })
  const focusAfter = (target: () => HTMLElement | null | undefined) => {
    focusNext.current = target
  }

  const remove = async (q: GeoQuestionRow) => {
    setBusy(true)
    const res = await send(`/api/admin/seo/geo/questions/${q.id}`, "DELETE")
    setBusy(false)
    if (!res.ok) {
      toast.error(errorOf(res.data, "La question n'a pas été supprimée."))
      return
    }
    focusAfter(() => addRef.current)
    setConfirming(null)
    toast.success("Question supprimée.")
    onChanged()
  }

  return (
    <div className="flex flex-col gap-3">
      {questions.length === 0 ? (
        <p className="text-sm text-[var(--q-text-4)]">Aucune question suivie pour l&apos;instant.</p>
      ) : (
        <ul className="q-list overflow-hidden rounded-xl border border-[var(--q-line)]">
          {questions.map((q, i) => (
            <li key={q.id} className="px-3 py-2">
              {editing === q.id ? (
                <QuestionEditor
                  initial={q.question}
                  label={`Question ${i + 1}`}
                  submitLabel="Enregistrer"
                  onCancel={() => {
                    focusAfter(() => editRefs.current[q.id])
                    setEditing(null)
                  }}
                  onSubmit={async (text) => {
                    const res = await send(`/api/admin/seo/geo/questions/${q.id}`, "PATCH", { question: text })
                    if (!res.ok) return errorOf(res.data, "La question n'a pas été modifiée.")
                    focusAfter(() => editRefs.current[q.id])
                    setEditing(null)
                    toast.success("Question modifiée.")
                    onChanged()
                    return null
                  }}
                />
              ) : confirming === q.id ? (
                <div role="alert" className="flex flex-col gap-2 py-1">
                  <p className="text-sm text-[var(--q-ink)]">
                    Supprimer « {q.question} » ? Les réponses déjà relevées restent dans l&apos;historique des relevés.
                  </p>
                  <div className="flex flex-wrap justify-end gap-2">
                    <button
                      ref={confirmCancelRef}
                      type="button"
                      className="q-btn q-btn-secondary q-btn-sm h-11 md:h-[34px]"
                      onClick={() => {
                        focusAfter(() => deleteRefs.current[q.id])
                        setConfirming(null)
                      }}
                      disabled={busy}
                    >
                      Annuler
                    </button>
                    <button type="button" className="q-btn q-btn-danger q-btn-sm h-11 md:h-[34px]" onClick={() => remove(q)} disabled={busy} aria-busy={busy}>
                      {busy ? <Loader2 className="animate-spin" aria-hidden /> : <Trash2 aria-hidden />}
                      Supprimer
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex items-start gap-2">
                  <label htmlFor={`geo-q-${q.id}`} className="flex min-h-11 min-w-0 flex-1 cursor-pointer items-start gap-3 py-1.5">
                    <input
                      id={`geo-q-${q.id}`}
                      type="checkbox"
                      className="mt-0.5 size-[18px] shrink-0 accent-[var(--q-accent)]"
                      checked={isActive(q)}
                      onChange={(e) => onToggle(q.id, e.target.checked)}
                    />
                    <span className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
                      <span className={cn("text-sm", isActive(q) ? "text-[var(--q-ink)]" : "text-[var(--q-text-4)]")}>{q.question}</span>
                      {notYetIds.includes(q.id) && <span className="q-tag whitespace-nowrap">Pas encore relevée</span>}
                    </span>
                  </label>
                  <div className="flex shrink-0 items-center">
                    <button
                      ref={(el) => {
                        editRefs.current[q.id] = el
                      }}
                      type="button"
                      className="q-btn q-btn-ghost q-btn-icon size-11 md:size-[34px]"
                      aria-label={`Modifier la question ${i + 1}`}
                      onClick={() => {
                        setConfirming(null)
                        setEditing(q.id)
                      }}
                    >
                      <Pencil aria-hidden />
                    </button>
                    <button
                      ref={(el) => {
                        deleteRefs.current[q.id] = el
                      }}
                      type="button"
                      className="q-btn q-btn-ghost q-btn-icon size-11 md:size-[34px]"
                      aria-label={`Supprimer la question ${i + 1}`}
                      onClick={() => {
                        focusAfter(() => confirmCancelRef.current)
                        setEditing(null)
                        setConfirming(q.id)
                      }}
                    >
                      <Trash2 aria-hidden />
                    </button>
                  </div>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      {adding ? (
        <div className="rounded-xl border border-[var(--q-line)] px-3 py-3">
          <QuestionEditor
            initial=""
            label="Nouvelle question"
            submitLabel="Ajouter"
            onCancel={() => {
              focusAfter(() => addRef.current)
              setAdding(false)
            }}
            onSubmit={async (text) => {
              const res = await send("/api/admin/seo/geo/questions", "POST", { question: text })
              if (!res.ok) return errorOf(res.data, "La question n'a pas été ajoutée.")
              focusAfter(() => addRef.current)
              setAdding(false)
              toast.success("Question ajoutée.")
              onChanged()
              return null
            }}
          />
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-3">
          <button
            ref={addRef}
            type="button"
            className="q-btn q-btn-secondary h-12 w-full md:h-10 md:w-auto"
            onClick={() => setAdding(true)}
            disabled={questions.length >= MAX_GEO_QUESTIONS}
          >
            <Plus aria-hidden />
            Ajouter une question
          </button>
          {questions.length >= MAX_GEO_QUESTIONS && (
            <span className="text-[13px] text-[var(--q-text-4)]">{MAX_GEO_QUESTIONS} questions au plus.</span>
          )}
        </div>
      )}
    </div>
  )
}

function QuestionEditor({
  initial,
  label,
  submitLabel,
  onCancel,
  onSubmit,
}: {
  initial: string
  label: string
  submitLabel: string
  onCancel: () => void
  /** Rend un message d'erreur, ou null si c'est fait. */
  onSubmit: (text: string) => Promise<string | null>
}) {
  const [text, setText] = useState(initial)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const id = `geo-q-edit-${useId().replace(/:/g, "")}`
  const length = text.replace(/\s+/g, " ").trim().length

  const submit = async () => {
    if (length < QUESTION_MIN || length > QUESTION_MAX) {
      setError(`La question doit faire entre ${QUESTION_MIN} et ${QUESTION_MAX} caractères.`)
      return
    }
    setBusy(true)
    const message = await onSubmit(text)
    setBusy(false)
    setError(message)
  }

  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={id} className="q-label">{label}</label>
      <textarea
        id={id}
        className="q-input"
        rows={3}
        maxLength={QUESTION_MAX + 50}
        value={text}
        autoFocus
        onChange={(e) => setText(e.target.value)}
        aria-invalid={Boolean(error) || undefined}
        aria-describedby={error ? `${id}-hint ${id}-error` : `${id}-hint`}
      />
      <span id={`${id}-hint`} className={cn("q-field-hint tabular-nums", length > QUESTION_MAX && "!text-[var(--q-danger)]")}>
        {length} / {QUESTION_MAX} caractères · posée telle quelle à chaque moteur
      </span>
      {error && (
        <span id={`${id}-error`} role="alert" className="q-field-error">
          {error}
        </span>
      )}
      <div className="flex flex-wrap justify-end gap-2">
        <button type="button" className="q-btn q-btn-secondary q-btn-sm h-11 md:h-[34px]" onClick={onCancel} disabled={busy}>
          <X aria-hidden />
          Annuler
        </button>
        <button type="button" className="q-btn q-btn-secondary q-btn-sm h-11 md:h-[34px]" onClick={submit} disabled={busy} aria-busy={busy}>
          {busy ? <Loader2 className="animate-spin" aria-hidden /> : <Check aria-hidden />}
          {submitLabel}
        </button>
      </div>
    </div>
  )
}
