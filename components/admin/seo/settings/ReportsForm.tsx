"use client"

/**
 * Paramètres › Rapports (planche Parametres-rapports.dc.html) : carte
 * « Résumé hebdomadaire » (Enregistrer primaire) et carte « Aperçu » : le
 * vrai prochain résumé, rendu avec les données actuelles et les sections
 * cochées (même modèle d'email que l'envoi), et « Envoyer un aperçu ».
 */
import { useMemo, useState } from "react"
import { toast } from "sonner"
import { CalendarClock, CircleAlert, History, LoaderCircle, Mail, Send } from "lucide-react"
import type { ReportSettings } from "@/lib/seo/settings"
import { renderSeoDigest } from "@/lib/email/templates/seo-digest"
import { DIGEST_SECTION_KEYS, DIGEST_SECTION_LABELS, type SeoDigest } from "@/lib/seo/reports/types"
import { DIGEST_TIMES, WEEKDAY_NAMES, fmtNextSend, nextDigestSend } from "@/lib/seo/reports/schedule"
import type { DigestAttempt, WeekDigestState } from "@/lib/seo/reports/send"
import { lastAttemptView } from "@/lib/seo/reports/attempt-view"
import { CardFooter, Field, SaveButton, SelectBox, SettingsCard } from "./ui"
import { useSettingsSave, useUnsavedGuard } from "./useSettingsSave"
import { errorFor, sameValue, withoutErrors } from "./validation"

export function ReportsForm({
  initial,
  updatedAt,
  digest,
  digestError,
  baseUrl,
  deliveryProblem,
  lastSentAt,
  lastAttempt,
  weekState,
  maxAttempts,
  nowIso,
}: {
  initial: ReportSettings
  updatedAt: string | null
  /** Données actuelles du résumé (toutes sections), null si leur lecture a échoué. */
  digest: SeoDigest | null
  digestError: string | null
  baseUrl: string
  /** Raison pour laquelle aucun email ne peut partir (ADMIN_EMAIL, RESEND_API_KEY) ; null si tout est prêt. */
  deliveryProblem: string | null
  /** Dernier résumé hebdomadaire envoyé avec succès. */
  lastSentAt: string | null
  /** Dernier essai d'envoi (toutes semaines), quel que soit son état. */
  lastAttempt: DigestAttempt | null
  /** État de la semaine ISO en cours (aucun essai, traitée, nouvel essai prévu, envoi en cours). */
  weekState: WeekDigestState["kind"]
  maxAttempts: number
  nowIso: string
}) {
  const { baseline, errors, setErrors, savingCard, save } = useSettingsSave("reports", initial, updatedAt)
  const [draft, setDraft] = useState<ReportSettings>(initial)
  const [sending, setSending] = useState(false)
  const dirty = !sameValue(draft, baseline)
  useUnsavedGuard(dirty)

  const times = DIGEST_TIMES.includes(draft.time) ? DIGEST_TIMES : DIGEST_TIMES.concat(draft.time).sort()
  const now = new Date(nowIso)
  const next = nextDigestSend(baseline, now, weekState !== "none")
  const nextLabel = !baseline.weeklyDigest
    ? "Résumé désactivé"
    : deliveryProblem
      ? "Aucun : envoi impossible pour le moment"
      : weekState === "retry"
        ? "Nouvel essai au prochain passage (dans 15 minutes au plus)"
        : weekState === "wait"
          ? "Envoi en cours"
          : fmtNextSend(next)
  const last = lastAttemptView(lastAttempt, now, weekState, maxAttempts, lastSentAt)

  const preview = useMemo(
    () => (digest ? renderSeoDigest(digest, { baseUrl, sections: draft.sections, preview: false }) : null),
    [digest, baseUrl, draft.sections],
  )

  function update(patch: Partial<ReportSettings>, fields: string[]) {
    setDraft((d) => ({ ...d, ...patch }))
    setErrors(withoutErrors(errors, fields))
  }

  async function onSave() {
    const saved = await save("reports", draft, "Rapports enregistrés.")
    if (saved) setDraft(saved)
  }

  async function sendPreview() {
    setSending(true)
    try {
      const res = await fetch("/api/admin/seo/reports/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sections: draft.sections }),
      })
      const json = (await res.json().catch(() => ({}))) as { error?: string }
      if (!res.ok) {
        toast.error(json.error ?? "L'aperçu n'a pas pu partir. Réessayez dans un instant.")
        return
      }
      toast.success("Aperçu envoyé à l'adresse de l'administrateur.")
    } catch {
      toast.error("Connexion impossible. Vérifiez le réseau, puis réessayez.")
    } finally {
      setSending(false)
    }
  }

  const noSection = DIGEST_SECTION_KEYS.every((k) => !draft.sections[k])

  return (
    <>
      <SettingsCard
        id="titre-resume"
        title="Résumé hebdomadaire"
        tag={<span className="q-tag">Facultatif</span>}
        subtitle="Un seul email par semaine, au nom de Qonforme."
        bodyClassName="gap-5 pt-2"
        footer={
          <CardFooter className="md:justify-end">
            <SaveButton primary dirty={dirty && !(noSection && draft.weeklyDigest)} saving={savingCard === "reports"} onClick={onSave} />
          </CardFooter>
        }
      >
        <div className="flex items-center justify-between gap-4 rounded-xl border border-[var(--q-line)] bg-[var(--q-surface-2)] px-4 py-3.5">
          <div className="flex min-w-0 flex-col gap-0.5">
            <span id="interrupteur-titre" className="text-sm font-semibold text-[var(--q-ink)]">
              Recevoir le résumé chaque semaine
            </span>
            <span id="interrupteur-aide" className="text-[13px] text-[var(--q-text-4)]">
              Éteignez-le pour ne plus rien recevoir.
            </span>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={draft.weeklyDigest}
            aria-labelledby="interrupteur-titre"
            aria-describedby="interrupteur-aide"
            onClick={() => update({ weeklyDigest: !draft.weeklyDigest }, ["weeklyDigest"])}
            className="q-switch before:absolute before:-inset-2.5 before:content-['']"
          />
        </div>

        <div className="grid gap-4 [grid-template-columns:repeat(auto-fit,minmax(min(100%,160px),220px))]">
          <Field id="rapport-jour" label="Jour" error={errorFor(errors, "weekday")}>
            <SelectBox
              id="rapport-jour"
              value={draft.weekday}
              onChange={(e) => update({ weekday: Number(e.target.value) }, ["weekday"])}
            >
              {[1, 2, 3, 4, 5, 6, 7].map((d) => (
                <option key={d} value={d}>
                  {WEEKDAY_NAMES[d]}
                </option>
              ))}
            </SelectBox>
          </Field>
          <Field id="rapport-heure" label="Heure" hint="Heure de Paris" error={errorFor(errors, "time")}>
            <SelectBox
              id="rapport-heure"
              value={draft.time}
              className="tabular-nums"
              aria-describedby="rapport-heure-aide"
              onChange={(e) => update({ time: e.target.value }, ["time"])}
            >
              {times.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </SelectBox>
          </Field>
        </div>

        {deliveryProblem ? (
          <div role="alert" className="q-banner q-banner-warn">
            <CircleAlert className="mt-0.5 size-[18px] shrink-0" aria-hidden />
            <span>
              {deliveryProblem} Aucun résumé ne peut partir en attendant.
            </span>
          </div>
        ) : (
          <p className="-mt-2 flex items-center gap-2 text-[13px] text-[var(--q-text-4)]">
            <Mail className="size-4 shrink-0" aria-hidden />
            Envoyé à l&apos;adresse de l&apos;administrateur.
          </p>
        )}

        <fieldset className="m-0 min-w-0 border-0 p-0">
          <legend className="q-label pb-2">Contenu du résumé</legend>
          <div className="grid gap-2.5 md:grid-cols-2">
            {DIGEST_SECTION_KEYS.map((key) => {
              const id = `contenu-${key}`
              return (
                <label
                  key={key}
                  htmlFor={id}
                  className="flex cursor-pointer items-start gap-3 rounded-xl border border-[var(--q-line)] bg-[var(--q-surface)] px-3.5 py-3"
                >
                  <input
                    id={id}
                    type="checkbox"
                    className="mt-px size-[18px] shrink-0 cursor-pointer accent-[var(--q-accent)]"
                    checked={draft.sections[key]}
                    onChange={(e) => update({ sections: { ...draft.sections, [key]: e.target.checked } }, ["sections"])}
                  />
                  <span className="flex min-w-0 flex-col gap-0.5">
                    <span className="text-sm font-semibold text-[var(--q-ink)]">{DIGEST_SECTION_LABELS[key].label}</span>
                    <span className="text-[13px] text-[var(--q-text-4)]">{DIGEST_SECTION_LABELS[key].hint}</span>
                  </span>
                </label>
              )
            })}
          </div>
          {noSection && (
            <span role="alert" className="q-field-error mt-2 block">
              Cochez au moins une section : sinon le résumé ne contient rien.
            </span>
          )}
        </fieldset>

        <div className="flex flex-wrap gap-x-10 gap-y-3 rounded-xl border border-[var(--q-line)] bg-[var(--q-surface-2)] px-4 py-3">
          <div className="flex items-center gap-2.5">
            <CalendarClock className="size-[18px] shrink-0 text-[var(--q-text-4)]" aria-hidden />
            <dl className="m-0 flex flex-col">
              <dt className="text-xs text-[var(--q-text-4)]">Prochain envoi</dt>
              <dd className="m-0 text-sm font-semibold tabular-nums text-[var(--q-ink)]">{nextLabel}</dd>
            </dl>
          </div>
          <div className="flex items-center gap-2.5">
            <History className="size-[18px] shrink-0 text-[var(--q-text-4)]" aria-hidden />
            <dl className="m-0 flex flex-col">
              <dt className="text-xs text-[var(--q-text-4)]">Dernier envoi</dt>
              <dd className={`m-0 text-sm font-semibold ${last.tone === "danger" ? "text-[var(--q-danger)]" : "text-[var(--q-ink)]"}`}>
                {last.label}
              </dd>
            </dl>
          </div>
          {last.details.length > 0 && (
            <div
              role={last.tone === "danger" ? "alert" : undefined}
              className={`flex w-full items-start gap-2 text-[13px] ${last.tone === "danger" ? "text-[var(--q-danger)]" : "text-[var(--q-text-3)]"}`}
            >
              <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
              <span className="flex min-w-0 flex-col gap-0.5">
                {last.details.map((line) => (
                  <span key={line} className="break-words">
                    {line}
                  </span>
                ))}
              </span>
            </div>
          )}
        </div>
      </SettingsCard>

      <SettingsCard
        id="titre-apercu"
        title="Aperçu"
        tag={<span className="q-tag">Aperçu avec vos données actuelles</span>}
        subtitle="Envoyez-vous ce résumé pour voir le rendu dans votre messagerie."
        action={
          <button
            type="button"
            onClick={sendPreview}
            disabled={sending || Boolean(deliveryProblem) || noSection}
            title={deliveryProblem ?? undefined}
            className="q-btn q-btn-secondary h-12 w-full rounded-[14px] text-[15px] md:h-10 md:w-auto md:rounded-[10px] md:text-sm"
          >
            {sending ? <LoaderCircle className="animate-spin" aria-hidden /> : <Send aria-hidden />}
            {sending ? "Envoi…" : "Envoyer un aperçu"}
          </button>
        }
        bodyClassName="pt-2"
      >
        {preview ? (
          <div className="flex flex-col gap-3">
            <p className="text-[13px] text-[var(--q-text-4)]">
              Objet&nbsp;: <span className="font-semibold text-[var(--q-ink)]">{preview.subject}</span>
            </p>
            <div className="overflow-hidden rounded-[14px] border border-[var(--q-line)] bg-[#F1F5F9]">
              <iframe
                title="Aperçu du résumé hebdomadaire"
                srcDoc={preview.html}
                sandbox=""
                loading="lazy"
                className="block h-[640px] w-full border-0 md:h-[760px]"
              />
            </div>
            <p className="text-xs text-[var(--q-text-4)]">
              Les liens de l&apos;aperçu sont inactifs dans cette page. Le texte suit les sections cochées, même avant
              d&apos;enregistrer.
            </p>
          </div>
        ) : (
          <div role="alert" className="q-banner q-banner-danger">
            <CircleAlert className="mt-0.5 size-[18px] shrink-0" aria-hidden />
            <span>{digestError ?? "Aperçu indisponible : les données du résumé n'ont pas pu être lues. Réessayez dans un instant."}</span>
          </div>
        )}
      </SettingsCard>
    </>
  )
}
