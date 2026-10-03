"use client"

/**
 * Paramètres › Relances : conseils de démarrage (séquence d'emails des 30
 * premiers jours) et rappel « plus tard » en attente.
 *
 * Application : GET/PUT /api/onboarding/preferences, DELETE /api/onboarding/reminder.
 * Tant que la migration 20261003_onboarding_emails.sql n'est pas appliquée
 * (`available: false`), la carte ne s'affiche pas : rien de cela n'est envoyé.
 * Démo : mêmes écrans, rien n'est enregistré.
 */
import { useCallback, useEffect, useState } from "react"
import { toast } from "sonner"
import { AlarmClock, Loader2 } from "lucide-react"
import { Switch } from "@/components/app/kit"
import type { ShellMode } from "@/components/layout/nav"
import { SettingsCard } from "@/components/settings/ui"
import { REMINDER_TARGETS, formatReminderMoment } from "@/lib/onboarding/reminder"
import { SEQUENCE_WINDOW_DAYS } from "@/lib/onboarding/sequence"
import type { PendingReminder } from "@/lib/onboarding/types"

export function OnboardingEmailsCard({ mode }: { mode: ShellMode }) {
  const demo = mode === "demo"
  const [state, setState] = useState<"loading" | "ready" | "hidden">(demo ? "ready" : "loading")
  const [enabled, setEnabled] = useState(true)
  const [reminder, setReminder] = useState<PendingReminder | null>(null)
  const [busy, setBusy] = useState<"toggle" | "cancel" | null>(null)
  const [now, setNow] = useState<Date | null>(null)
  useEffect(() => setNow(new Date()), [])

  const load = useCallback(() => {
    if (demo) return
    fetch("/api/onboarding/preferences")
      .then(async (r) => {
        const json = await r.json().catch(() => ({}))
        if (!r.ok || !json.available) { setState("hidden"); return }
        setEnabled(json.enabled !== false)
        setReminder(json.reminder ?? null)
        setState("ready")
      })
      .catch(() => setState("hidden"))
  }, [demo])

  useEffect(() => { load() }, [load])

  const toggle = async (value: boolean) => {
    if (demo) {
      setEnabled(value)
      toast("Démo : rien n'est enregistré.")
      return
    }
    setBusy("toggle")
    try {
      const res = await fetch("/api/onboarding/preferences", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: value }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) { toast.error(json.error ?? "Enregistrement impossible. Réessayez."); return }
      setEnabled(json.enabled)
      toast.success(json.enabled ? "Conseils de démarrage activés" : "Conseils de démarrage désactivés")
    } catch {
      toast.error("Erreur réseau")
    } finally {
      setBusy(null)
    }
  }

  const cancel = async () => {
    setBusy("cancel")
    try {
      const res = await fetch("/api/onboarding/reminder", { method: "DELETE" })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) { toast.error(json.error ?? "Annulation impossible. Réessayez."); return }
      setReminder(null)
      toast.success("Rappel annulé")
    } catch {
      toast.error("Erreur réseau")
    } finally {
      setBusy(null)
    }
  }

  if (state === "hidden") return null
  if (state === "loading") {
    return (
      <div className="q-card flex items-center justify-center py-10">
        <Loader2 className="size-5 animate-spin text-[var(--q-accent)]" aria-label="Chargement des conseils de démarrage" />
      </div>
    )
  }

  return (
    <SettingsCard
      id="demarrage"
      title="Conseils de démarrage"
      description={`Quelques e-mails pendant vos ${SEQUENCE_WINDOW_DAYS} premiers jours : premier devis, passage du devis à la facture, formule Essentiel. Chacun s'arrête dès que c'est fait.`}
    >
      <label className="flex items-center gap-3 border-t border-[var(--q-line-soft)] pt-3">
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="text-[15px] font-semibold text-[var(--q-ink)]">Recevoir les conseils de démarrage</span>
          <span className="text-[13px] leading-relaxed text-[var(--q-text-4)]">
            {enabled ? "Activés. Un lien dans chaque e-mail permet aussi de les arrêter." : "Désactivés : vous n'en recevrez plus."}
          </span>
        </span>
        {busy === "toggle"
          ? <Loader2 className="size-5 animate-spin text-[var(--q-accent)]" aria-label="Enregistrement" />
          : <Switch checked={enabled} onCheckedChange={toggle} label="Recevoir les conseils de démarrage" />}
      </label>

      {reminder && now && (
        <div className="q-inset flex flex-col gap-3 p-3.5 sm:flex-row sm:items-center">
          <span className="grid size-9 shrink-0 place-items-center rounded-[11px] bg-[var(--q-wash)] text-[var(--q-accent-strong)]">
            <AlarmClock className="size-[18px]" strokeWidth={1.75} aria-hidden />
          </span>
          <span className="flex min-w-0 flex-1 flex-col gap-0.5">
            <span className="text-[15px] font-semibold text-[var(--q-ink)]">
              Rappel prévu {formatReminderMoment(new Date(reminder.remindAt), now)}
            </span>
            <span className="text-[13px] text-[var(--q-text-4)]">{REMINDER_TARGETS[reminder.target].label}</span>
          </span>
          <button type="button" className="q-btn q-btn-secondary q-btn-sm shrink-0 self-start sm:self-center" onClick={cancel} disabled={busy !== null}>
            {busy === "cancel" && <Loader2 className="animate-spin" aria-hidden />}
            Annuler le rappel
          </button>
        </div>
      )}

      <p className="text-[13px] leading-relaxed text-[var(--q-text-4)]">
        Les e-mails liés à vos documents (envoi, copies, relances de vos clients) et à la sécurité de votre compte ne
        sont pas concernés.
      </p>
    </SettingsCard>
  )
}
