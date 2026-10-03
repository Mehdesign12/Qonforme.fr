"use client"

/**
 * Paramètres › Relances : réglages des relances automatiques du compte
 * (factures impayées et devis sans réponse), avec l'aperçu du message envoyé.
 *
 * Application : lecture et enregistrement par /api/reminder-settings. Tant que
 * la migration 20261003 n'est pas appliquée (`available: false`), la page
 * décrit le fonctionnement actuel (J+30 et J+45) sans rien proposer de régler.
 * Démo (`mode="demo"`) : mêmes écrans, réglages d'exemple, rien n'est enregistré.
 *
 * Les relances partent avec une formule (le cron saute les comptes sans
 * formule) : les réglages s'enregistrent quand même, la page le dit.
 */
import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { toast } from "sonner"
import { Info, Loader2, RefreshCw } from "lucide-react"
import { Switch, StatusPill } from "@/components/app/kit"
import type { ShellMode } from "@/components/layout/nav"
import { settingsHref } from "@/components/settings/sections"
import { DirtyHint, Field, MobileSaveBar, SaveButton, SettingsCard } from "@/components/settings/ui"
import { cn } from "@/lib/utils"
import {
  AFTER_DUE_CHOICES, BEFORE_DUE_CHOICES, DEFAULT_REMINDER_SETTINGS, QUOTE_FOLLOWUP_DAY_CHOICES,
  describeInvoiceSchedule, type ReminderSettings,
} from "@/lib/reminders/settings"
import { buildReminderEmail } from "@/lib/email/templates/reminder"
import { buildQuoteFollowupEmail } from "@/lib/email/templates/quote-followup"
import { addDays, todayInParis } from "@/lib/utils/paris-date"

const FORM_ID = "reminders-form"

type Preview = "before" | "after" | "quote"

const same = (a: ReminderSettings, b: ReminderSettings) => JSON.stringify(a) === JSON.stringify(b)

const plural = (n: number) => `${n} jour${n > 1 ? "s" : ""}`

export interface ReminderSettingsFormProps {
  mode: ShellMode
  /** Formule qui permet d'émettre : les relances automatiques en dépendent. */
  hasPlan: boolean
  /** Pour l'aperçu du message. */
  company: { name: string; iban?: string | null; accentColor?: string | null }
  /** Démo : réglages affichés au départ. */
  demoSettings?: ReminderSettings
}

export function ReminderSettingsForm({ mode, hasPlan, company, demoSettings }: ReminderSettingsFormProps) {
  const demo = mode === "demo"
  const [state, setState] = useState<"loading" | "ready" | "unavailable" | "error">(demo ? "ready" : "loading")
  const [saved, setSaved] = useState<ReminderSettings>(demoSettings ?? DEFAULT_REMINDER_SETTINGS)
  const [form, setForm] = useState<ReminderSettings>(demoSettings ?? DEFAULT_REMINDER_SETTINGS)
  const [saving, setSaving] = useState(false)
  const [preview, setPreview] = useState<Preview>("after")

  const load = useCallback(() => {
    if (demo) return
    setState("loading")
    fetch("/api/reminder-settings")
      .then(async (r) => {
        const json = await r.json().catch(() => ({}))
        if (!r.ok) throw new Error(json.error)
        if (!json.available) { setState("unavailable"); return }
        setSaved(json.settings)
        setForm(json.settings)
        setState("ready")
      })
      .catch(() => setState("error"))
  }, [demo])

  useEffect(() => { load() }, [load])

  const dirty = !same(form, saved)
  const set = <K extends keyof ReminderSettings>(key: K, value: ReminderSettings[K]) => setForm((f) => ({ ...f, [key]: value }))
  const toggleAfter = (day: number) =>
    set("afterDueDays", form.afterDueDays.includes(day)
      ? form.afterDueDays.filter((d) => d !== day)
      : [...form.afterDueDays, day].sort((a, b) => a - b))

  // L'onglet d'aperçu choisi peut disparaître (rappel désactivé)
  const previews = useMemo(() => {
    const list: { key: Preview; label: string }[] = []
    if (form.invoiceRemindersEnabled && form.beforeDueDays) list.push({ key: "before", label: "Avant l'échéance" })
    if (form.invoiceRemindersEnabled && form.afterDueDays.length) list.push({ key: "after", label: "Facture échue" })
    if (form.quoteFollowupEnabled) list.push({ key: "quote", label: "Devis" })
    return list
  }, [form])
  const shown = previews.find((p) => p.key === preview)?.key ?? previews[0]?.key ?? null

  const html = useMemo(() => (shown ? sampleEmail(shown, form, company) : null), [shown, form, company])

  const submit = async (e?: React.FormEvent) => {
    e?.preventDefault()
    if (demo) {
      toast("Créez un compte pour régler vos relances", {
        action: { label: "S'inscrire", onClick: () => { window.location.href = "/signup" } },
      })
      return
    }
    setSaving(true)
    try {
      const res = await fetch("/api/reminder-settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) { toast.error(json.error ?? "L'enregistrement a échoué. Réessayez."); return }
      setSaved(json.settings)
      setForm(json.settings)
      toast.success("Relances enregistrées")
    } catch {
      toast.error("Erreur réseau")
    } finally {
      setSaving(false)
    }
  }

  if (state === "loading") {
    return (
      <div className="q-card flex items-center justify-center py-16">
        <Loader2 className="size-6 animate-spin text-[var(--q-accent)]" aria-label="Chargement des réglages de relance" />
      </div>
    )
  }

  if (state === "error") {
    return (
      <SettingsCard id="relances" title="Relances automatiques">
        <p className="text-[13px] text-[var(--q-text-3)]">Impossible de charger vos réglages de relance.</p>
        <button type="button" className="q-btn q-btn-secondary self-start" onClick={load}>
          <RefreshCw aria-hidden />
          Réessayer
        </button>
      </SettingsCard>
    )
  }

  // Avant la migration : le fonctionnement actuel, sans réglage
  if (state === "unavailable") {
    return (
      <SettingsCard
        id="relances"
        title="Relances automatiques"
        action={hasPlan ? <StatusPill tone="ok">Actives</StatusPill> : <StatusPill tone="info">Avec Essentiel</StatusPill>}
      >
        <p className="text-[13px] leading-relaxed text-[var(--q-text-3)]">
          30 puis 45 jours après l&apos;échéance, Qonforme relance par e-mail le client d&apos;une facture impayée.
          Copie à l&apos;adresse de votre entreprise, si elle est renseignée.
        </p>
      </SettingsCard>
    )
  }

  const schedule = describeInvoiceSchedule(form)

  return (
    <form id={FORM_ID} onSubmit={submit} className="flex flex-col gap-5">
      {!hasPlan && (
        <div className="q-banner" role="status">
          <Info className="mt-0.5 size-4 shrink-0" aria-hidden />
          <p>
            Vos réglages s&apos;enregistrent dès maintenant ; les relances partent avec la formule Essentiel.{" "}
            <Link href={settingsHref("/settings/billing", mode)} className="font-semibold underline">Voir les formules</Link>
          </p>
        </div>
      )}

      {/* ---- Factures impayées ---- */}
      <SettingsCard
        id="relances-factures"
        title="Relances des factures"
        description="Un e-mail courtois au client, avec le montant, l'échéance et vos coordonnées bancaires. Vous êtes en copie."
        action={hasPlan
          ? <StatusPill tone={form.invoiceRemindersEnabled ? "ok" : "neutral"}>{form.invoiceRemindersEnabled ? "Actives" : "Désactivées"}</StatusPill>
          : <StatusPill tone="info">Avec Essentiel</StatusPill>}
      >
        <label className="flex items-center gap-3 border-t border-[var(--q-line-soft)] pt-3">
          <span className="flex min-w-0 flex-1 flex-col gap-0.5">
            <span className="text-[15px] font-semibold text-[var(--q-ink)]">Relancer automatiquement les factures impayées</span>
            <span className="text-[13px] leading-relaxed text-[var(--q-text-4)]">
              {form.invoiceRemindersEnabled && schedule ? `Calendrier : ${schedule}.` : "Aucune relance automatique : vous relancez depuis la fiche de la facture."}
            </span>
          </span>
          <Switch
            checked={form.invoiceRemindersEnabled}
            onCheckedChange={(v) => set("invoiceRemindersEnabled", v)}
            label="Relancer automatiquement les factures impayées"
          />
        </label>

        {form.invoiceRemindersEnabled && (
          <>
            <Field label="Rappel avant l'échéance" htmlFor="before-due" hint="Un rappel amical tant que la facture n'est pas échue.">
              <select
                id="before-due"
                className="q-input sm:max-w-[280px]"
                value={form.beforeDueDays ?? ""}
                onChange={(e) => set("beforeDueDays", e.target.value ? Number(e.target.value) : null)}
              >
                <option value="">Pas de rappel</option>
                {BEFORE_DUE_CHOICES.map((d) => <option key={d} value={d}>{plural(d)} avant</option>)}
              </select>
            </Field>

            <fieldset className="flex flex-col gap-1.5">
              <legend className="q-label mb-1.5">Relances après l&apos;échéance</legend>
              <div className="flex flex-wrap gap-2">
                {AFTER_DUE_CHOICES.map((d) => {
                  const on = form.afterDueDays.includes(d)
                  return (
                    <button
                      key={d}
                      type="button"
                      aria-pressed={on}
                      onClick={() => toggleAfter(d)}
                      className={cn(
                        "inline-flex h-10 min-w-[72px] items-center justify-center rounded-full border px-4 text-sm font-semibold tabular-nums transition-colors",
                        on
                          ? "border-[var(--q-accent)] bg-[var(--q-wash)] text-[var(--q-accent-strong)]"
                          : "border-[var(--q-field)] bg-[var(--q-surface)] text-[var(--q-text-2)] hover:bg-[var(--q-sunken)]",
                      )}
                    >
                      J+{d}
                    </button>
                  )
                })}
              </div>
              <p className="q-field-hint leading-relaxed">
                Jours après la date d&apos;échéance. Par défaut : J+30 et J+45. Les relances d&apos;un client professionnel
                rappellent les pénalités de retard et l&apos;indemnité forfaitaire de 40&nbsp;€.
              </p>
            </fieldset>
          </>
        )}

        <p className="border-t border-[var(--q-line-soft)] pt-3 text-[13px] leading-relaxed text-[var(--q-text-4)]">
          Chaque relance ne part qu&apos;une fois, jamais pour une facture réglée ou annulée par un avoir, et au moins
          trois jours après la précédente. Si un passage est manqué, seule la relance la plus récente part. Une relance
          ne change pas le statut de la facture.
        </p>
      </SettingsCard>

      {/* ---- Devis sans réponse ---- */}
      <SettingsCard
        id="relances-devis"
        title="Relance des devis"
        description="Un rappel au client d'un devis envoyé resté sans réponse, avec le devis en pièce jointe."
        action={hasPlan
          ? <StatusPill tone={form.quoteFollowupEnabled ? "ok" : "neutral"}>{form.quoteFollowupEnabled ? "Active" : "Désactivée"}</StatusPill>
          : <StatusPill tone="info">Avec Essentiel</StatusPill>}
      >
        <label className="flex items-center gap-3 border-t border-[var(--q-line-soft)] pt-3">
          <span className="flex min-w-0 flex-1 flex-col gap-0.5">
            <span className="text-[15px] font-semibold text-[var(--q-ink)]">Relancer les devis restés sans réponse</span>
            <span className="text-[13px] leading-relaxed text-[var(--q-text-4)]">
              {form.quoteFollowupEnabled
                ? `${form.quoteFollowupMax > 1 ? "Deux relances" : "Une relance"}, ${plural(form.quoteFollowupDays)} après l'envoi${form.quoteFollowupMax > 1 ? ` puis ${plural(form.quoteFollowupDays)} plus tard` : ""}.`
                : "Désactivé : vos devis ne sont pas relancés."}
            </span>
          </span>
          <Switch
            checked={form.quoteFollowupEnabled}
            onCheckedChange={(v) => set("quoteFollowupEnabled", v)}
            label="Relancer les devis restés sans réponse"
          />
        </label>

        {form.quoteFollowupEnabled && (
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Après l'envoi du devis" htmlFor="quote-days">
              <select
                id="quote-days"
                className="q-input"
                value={form.quoteFollowupDays}
                onChange={(e) => set("quoteFollowupDays", Number(e.target.value))}
              >
                {QUOTE_FOLLOWUP_DAY_CHOICES.map((d) => <option key={d} value={d}>{plural(d)}</option>)}
              </select>
            </Field>
            <div className="flex min-w-0 flex-col gap-1.5">
              <span className="q-label" id="quote-max-label">Nombre de relances</span>
              <div role="group" aria-labelledby="quote-max-label" className="q-seg self-start">
                {[1, 2].map((n) => (
                  <button key={n} type="button" aria-pressed={form.quoteFollowupMax === n} onClick={() => set("quoteFollowupMax", n)}>
                    {n === 1 ? "Une fois" : "Deux fois"}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        <p className="border-t border-[var(--q-line-soft)] pt-3 text-[13px] leading-relaxed text-[var(--q-text-4)]">
          Jamais après la date de validité du devis, ni pour un devis accepté, refusé ou déjà transformé en facture.
        </p>
      </SettingsCard>

      {/* ---- Aperçu ---- */}
      <SettingsCard id="apercu" title="Aperçu du message" description="L'e-mail tel que votre client le reçoit, sur un exemple.">
        {shown && html ? (
          <>
            {previews.length > 1 && (
              <div role="tablist" aria-label="Message à prévisualiser" className="q-seg self-start max-w-full overflow-x-auto">
                {previews.map((p) => (
                  <button key={p.key} type="button" role="tab" aria-selected={shown === p.key} onClick={() => setPreview(p.key)}>
                    {p.label}
                  </button>
                ))}
              </div>
            )}
            <iframe
              title="Aperçu de l'e-mail de relance"
              srcDoc={html}
              sandbox=""
              className="h-[560px] w-full rounded-xl border border-[var(--q-line)] bg-[#F1F5F9]"
            />
          </>
        ) : (
          <p className="text-[13px] text-[var(--q-text-4)]">Aucune relance automatique n&apos;est activée.</p>
        )}
      </SettingsCard>

      <div className="flex items-center justify-end gap-3">
        {dirty && <DirtyHint className="hidden lg:inline-flex" />}
        <SaveButton form={FORM_ID} saving={saving} disabled={!dirty && !demo} />
      </div>
      <MobileSaveBar show={dirty} form={FORM_ID} saving={saving} />
    </form>
  )
}

/** E-mail d'exemple pour l'aperçu (données fictives, réglages en cours de saisie). */
function sampleEmail(kind: Preview, s: ReminderSettings, company: ReminderSettingsFormProps["company"]): string {
  const today = todayInParis()
  const name = company.name.trim() || "Votre entreprise"
  const accent = company.accentColor || "#2563EB"
  const amounts = { subtotalHt: 1840, totalVat: 368, totalTtc: 2208 }

  if (kind === "quote") {
    const sent = addDays(today, -s.quoteFollowupDays)
    return buildQuoteFollowupEmail({
      quoteNumber: "D-2026-031", issueDate: sent, sentDate: sent, validUntil: addDays(sent, 30),
      ...amounts, companyName: name, accentColor: accent, clientName: "Bâti Ouest SAS",
      followupNumber: 1, hasAttachment: true,
    }).html
  }

  const before = kind === "before"
  const offset = before ? -(s.beforeDueDays ?? 3) : (s.afterDueDays[0] ?? 30)
  const due = addDays(today, -offset)
  return buildReminderEmail({
    reminderNumber: before ? 1 : (s.beforeDueDays ? 2 : 1),
    kind: before ? "before_due" : "after_due",
    daysLate: Math.max(0, offset),
    isLast: !before && s.afterDueDays.length <= 1,
    invoiceNumber: "F-2026-0142", issueDate: addDays(due, -30), dueDate: due,
    ...amounts, companyName: name, companyIban: company.iban || "FR76 0000 0000 0000 0000 0000 000",
    accentColor: accent, clientName: "Bâti Ouest SAS", clientIsProfessional: true,
  }).html
}
