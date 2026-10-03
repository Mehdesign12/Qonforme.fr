"use client"

/**
 * Écran « Par quoi voulez-vous commencer ? » (DECISIONS-STRATEGIQUES.md § 8,
 * étape 4 du canevas « Onboarding »), après l'inscription : quatre choix qui
 * donnent chacun un premier résultat, même sans client sous la main, puis
 * « Explorer le tableau de bord ». Jamais bloquant : « Passer au tableau de
 * bord » reste dans l'en-tête (app/demarrer/page.tsx) et dans chaque panneau.
 *
 *   1. Faire un vrai devis            → éditeur de devis
 *   2. M'envoyer un devis d'essai     → panneau, POST /api/onboarding/trial-quote
 *   3. Facturer un chantier terminé   → éditeur de facture (préparation gratuite)
 *   4. Je le ferai plus tard          → panneau, PUT /api/onboarding/reminder
 *
 * Les choix 2 et 4 n'apparaissent qu'une fois la migration
 * 20261003_onboarding_emails.sql appliquée (`available`). Démo
 * (`mode="demo"`) : mêmes écrans, rien n'est envoyé ni enregistré.
 *
 * Champs à 16 px sur mobile (q-input), aucun backdrop-filter (règles iOS de
 * CLAUDE.md) ; heures calculées après le montage (pas d'écart serveur/client).
 */
import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { toast } from "sonner"
import {
  AlarmClock, ArrowLeft, ArrowRight, Check, FileCheck2, FileText, Loader2, Mail, Send,
  type LucideIcon,
} from "lucide-react"
import type { ShellMode } from "@/components/layout/nav"
import { AuthLead, AuthTitle, Serif } from "@/components/auth/AuthHeading"
import { cn } from "@/lib/utils"
import {
  REMINDER_TARGETS, customRange, formatReminderMoment, reminderSlots, resolveReminderAt,
} from "@/lib/onboarding/reminder"
import { TRIAL_QUOTE_DAILY_LIMIT } from "@/lib/onboarding/trial-quote"
import { dashboardHref, startHref } from "@/lib/onboarding/links"
import type { PendingReminder, ReminderSlotKey, ReminderTarget } from "@/lib/onboarding/types"

export type StartPanel = "essai" | "plus-tard"

export interface StartScreenProps {
  mode: ShellMode
  firstName: string
  /** Adresse du compte : destinataire du devis d'essai et du rappel. */
  email: string
  /** Devis d'essai et rappel disponibles (migration appliquée). */
  available: boolean
  initialPanel?: StartPanel | null
  pendingReminder?: PendingReminder | null
}

const hrefFor = startHref

const CARD = cn(
  "group flex h-full w-full flex-col gap-2 rounded-[20px] border border-[var(--q-line)] bg-[var(--q-surface)] p-5 text-left text-[var(--q-ink-strong)]",
  "shadow-[0_1px_2px_rgba(10,17,34,.04),0_12px_32px_-24px_rgba(10,17,34,.18)]",
  "transition-[border-color,box-shadow,transform] duration-200",
  "hover:-translate-y-0.5 hover:border-[var(--q-field)] hover:shadow-[0_2px_4px_rgba(10,17,34,.05),0_22px_44px_-26px_rgba(10,17,34,.32)]",
  "active:scale-[.99] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[3px] focus-visible:outline-[var(--q-accent)]",
  "motion-reduce:transition-none motion-reduce:hover:translate-y-0 motion-reduce:active:scale-100 touch-manipulation",
)

function CardBody({ Icon, title, text }: { Icon: LucideIcon; title: string; text: string }) {
  return (
    <>
      <span className="mb-1.5 flex items-start justify-between">
        <Icon className="size-[26px] shrink-0" strokeWidth={1.25} aria-hidden />
        <ArrowRight
          className="size-[18px] shrink-0 text-[var(--q-placeholder)] transition-[color,transform] duration-200 group-hover:translate-x-[3px] group-hover:text-[var(--q-accent-strong)] motion-reduce:group-hover:translate-x-0"
          strokeWidth={1.25}
          aria-hidden
        />
      </span>
      <span className="text-lg font-semibold tracking-[-0.01em]">{title}</span>
      <span className="text-[15px] leading-normal text-[var(--q-text-3)]">{text}</span>
    </>
  )
}

export function StartScreen({ mode, firstName, email, available, initialPanel = null, pendingReminder = null }: StartScreenProps) {
  const [panel, setPanel] = useState<StartPanel | null>(available ? initialPanel : null)
  const [reminder, setReminder] = useState<PendingReminder | null>(pendingReminder)
  const [now, setNow] = useState<Date | null>(null)
  useEffect(() => setNow(new Date()), [])

  const name = firstName.trim()

  if (panel === "essai") {
    return <TrialPanel mode={mode} email={email} onBack={() => setPanel(null)} />
  }
  if (panel === "plus-tard") {
    return (
      <LaterPanel
        mode={mode}
        email={email}
        now={now}
        reminder={reminder}
        onChange={setReminder}
        onBack={() => setPanel(null)}
      />
    )
  }

  return (
    <div className="flex flex-col gap-7">
      <div>
        <AuthTitle>Par quoi <span className="whitespace-nowrap">voulez-vous</span> <Serif>commencer</Serif>&nbsp;?</AuthTitle>
        <AuthLead>
          {name ? `${name}, chaque` : "Chaque"} choix donne un premier résultat, même sans client sous la main. Rien ne part sans vous.
        </AuthLead>
      </div>

      {reminder && now && (
        <div className="q-banner" role="status">
          <AlarmClock className="mt-0.5 size-4 shrink-0" aria-hidden />
          <p>
            Rappel prévu {formatReminderMoment(new Date(reminder.remindAt), now)}&nbsp;: {REMINDER_TARGETS[reminder.target].action}.{" "}
            <button type="button" className="font-semibold underline" onClick={() => setPanel("plus-tard")}>Modifier</button>
          </p>
        </div>
      )}

      <ul className="m-0 grid list-none gap-3 p-0 sm:grid-cols-2" aria-label="Choix de départ">
        <li>
          <Link href={hrefFor(mode, "/quotes/new")} className={CARD}>
            <CardBody Icon={FileCheck2} title="Faire un vrai devis" text="Pour un client, avec vos prestations. Gratuit, sans limite de nombre." />
          </Link>
        </li>
        {available && (
          <li>
            <button type="button" className={CARD} onClick={() => setPanel("essai")}>
              <CardBody Icon={Send} title="M'envoyer un devis d'essai" text="Un exemple à votre nom, envoyé à votre adresse. Sans numéro, hors de vos chiffres." />
            </button>
          </li>
        )}
        <li>
          <Link href={hrefFor(mode, "/invoices/new")} className={CARD}>
            <CardBody Icon={FileText} title="Facturer un chantier terminé" text="La préparation est gratuite. La formule se choisit au moment d'envoyer." />
          </Link>
        </li>
        {available && (
          <li>
            <button type="button" className={CARD} onClick={() => setPanel("plus-tard")}>
              <CardBody Icon={AlarmClock} title="Je le ferai plus tard" text="Un rappel par e-mail au moment de votre choix : ce soir, demain matin, samedi…" />
            </button>
          </li>
        )}
      </ul>

      <div className="flex justify-center">
        <Link href={dashboardHref(mode)} className="q-btn q-btn-ghost q-btn-lg">
          Explorer le tableau de bord
          <ArrowRight aria-hidden />
        </Link>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Panneaux                                                            */
/* ------------------------------------------------------------------ */

function PanelFrame({ title, lead, onBack, children }: { title: React.ReactNode; lead: React.ReactNode; onBack: () => void; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-6">
      <button type="button" onClick={onBack} className="q-btn q-btn-ghost -ml-3 self-start">
        <ArrowLeft aria-hidden />
        Retour aux choix
      </button>
      <div>
        <AuthTitle className="!text-[28px] sm:!text-[34px]">{title}</AuthTitle>
        <AuthLead>{lead}</AuthLead>
      </div>
      <section className="q-card flex flex-col gap-4 p-5 sm:p-6">{children}</section>
    </div>
  )
}

function Recipient({ email, hint }: { email: string; hint: string }) {
  return (
    <div className="q-inset flex items-center gap-3 p-3.5">
      <span className="grid size-9 shrink-0 place-items-center rounded-[11px] bg-[var(--q-wash)] text-[var(--q-accent-strong)]">
        <Mail className="size-[18px]" strokeWidth={1.75} aria-hidden />
      </span>
      <span className="flex min-w-0 flex-col gap-0.5">
        <span className="truncate text-[15px] font-semibold text-[var(--q-ink)]">{email || "Adresse de votre compte"}</span>
        <span className="text-[13px] text-[var(--q-text-4)]">{hint}</span>
      </span>
    </div>
  )
}

function Done({ children, mode }: { children: React.ReactNode; mode: ShellMode }) {
  return (
    <>
      <div className="q-banner q-banner-ok" role="status">
        <Check className="mt-0.5 size-4 shrink-0" aria-hidden />
        <p>{children}</p>
      </div>
      <div className="flex flex-col gap-2 sm:flex-row">
        <Link href={hrefFor(mode, "/quotes/new")} className="q-btn q-btn-primary q-btn-lg">Faire un vrai devis</Link>
        <Link href={dashboardHref(mode)} className="q-btn q-btn-secondary q-btn-lg">Passer au tableau de bord</Link>
      </div>
    </>
  )
}

function TrialPanel({ mode, email, onBack }: { mode: ShellMode; email: string; onBack: () => void }) {
  const [state, setState] = useState<"idle" | "sending" | "sent">("idle")
  const [error, setError] = useState<string | null>(null)

  const send = async () => {
    setError(null)
    if (mode === "demo") {
      toast("Démo : rien n'est envoyé. Créez votre compte pour recevoir votre devis d'essai.")
      setState("sent")
      return
    }
    setState("sending")
    try {
      const res = await fetch("/api/onboarding/trial-quote", { method: "POST" })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(json.error ?? "L'e-mail n'est pas parti. Réessayez.")
        setState("idle")
        return
      }
      setState("sent")
    } catch {
      setError("Erreur réseau. Réessayez.")
      setState("idle")
    }
  }

  return (
    <PanelFrame
      title={<>M&apos;envoyer un devis <Serif>d&apos;essai</Serif></>}
      lead="Un devis d'exemple au nom de votre entreprise, avec son PDF, envoyé sur votre adresse : vous voyez exactement ce que recevront vos clients."
      onBack={onBack}
    >
      <Recipient email={email} hint="Adresse de votre compte" />
      <ul className="m-0 flex list-none flex-col gap-1.5 p-0 text-[14px] leading-relaxed text-[var(--q-text-3)]">
        <li className="flex gap-2"><Check className="mt-1 size-4 shrink-0 text-[var(--q-ok)]" aria-hidden />Mention « Exemple », sans numéro.</li>
        <li className="flex gap-2"><Check className="mt-1 size-4 shrink-0 text-[var(--q-ok)]" aria-hidden />N&apos;apparaît ni dans vos devis, ni dans vos chiffres.</li>
        <li className="flex gap-2"><Check className="mt-1 size-4 shrink-0 text-[var(--q-ok)]" aria-hidden />Gratuit, jusqu&apos;à {TRIAL_QUOTE_DAILY_LIMIT} par jour.</li>
      </ul>

      {state === "sent" ? (
        <Done mode={mode}>
          {mode === "demo"
            ? "Démo : rien n'est parti. Avec votre compte, le devis d'essai arrive sur votre adresse en une minute."
            : `C'est parti : regardez votre boîte de réception (${email}). L'e-mail peut mettre une minute à arriver.`}
        </Done>
      ) : (
        <>
          {error && <p className="q-field-error !text-[14px]" role="alert">{error}</p>}
          <button type="button" className="q-btn q-btn-primary q-btn-lg sm:self-start" onClick={send} disabled={state === "sending"}>
            {state === "sending" ? <Loader2 className="animate-spin" aria-hidden /> : <Send aria-hidden />}
            {state === "sending" ? "Envoi…" : "Envoyer le devis d'essai"}
          </button>
        </>
      )}
    </PanelFrame>
  )
}

function LaterPanel({
  mode, email, now, reminder, onChange, onBack,
}: {
  mode: ShellMode
  email: string
  now: Date | null
  reminder: PendingReminder | null
  onChange: (r: PendingReminder | null) => void
  onBack: () => void
}) {
  const slots = useMemo(() => (now ? reminderSlots(now) : []), [now])
  const range = useMemo(() => (now ? customRange(now) : null), [now])
  const [slot, setSlot] = useState<ReminderSlotKey | null>(null)
  const [custom, setCustom] = useState("")
  const [target, setTarget] = useState<ReminderTarget>("quote")
  const [busy, setBusy] = useState<"save" | "cancel" | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  // Premier créneau proposé, une fois l'heure connue
  useEffect(() => {
    if (!slot && slots.length) setSlot(slots[0].key)
  }, [slot, slots])

  const save = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    if (!slot) { setError("Choisissez un moment."); return }
    if (slot === "custom" && !custom) { setError("Indiquez une date et une heure."); return }

    if (mode === "demo") {
      const resolved = now ? resolveReminderAt({ slot, custom }, now) : null
      if (!resolved || "error" in resolved) { setError(resolved?.error ?? "Choisissez un moment."); return }
      onChange({ target, remindAt: resolved.at.toISOString() })
      setSaved(true)
      toast("Démo : rien n'est programmé. Créez votre compte pour recevoir vos rappels.")
      return
    }
    setBusy("save")
    try {
      const res = await fetch("/api/onboarding/reminder", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slot, custom: slot === "custom" ? custom : undefined, target }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) { setError(json.error ?? "Rappel non enregistré. Réessayez."); return }
      onChange(json.reminder)
      setSaved(true)
    } catch {
      setError("Erreur réseau. Réessayez.")
    } finally {
      setBusy(null)
    }
  }

  const cancel = async () => {
    setError(null)
    if (mode === "demo") { onChange(null); setSaved(false); return }
    setBusy("cancel")
    try {
      const res = await fetch("/api/onboarding/reminder", { method: "DELETE" })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) { setError(json.error ?? "Annulation impossible. Réessayez."); return }
      onChange(null)
      setSaved(false)
      toast.success("Rappel annulé")
    } catch {
      setError("Erreur réseau. Réessayez.")
    } finally {
      setBusy(null)
    }
  }

  const moment = reminder && now ? formatReminderMoment(new Date(reminder.remindAt), now) : null

  return (
    <PanelFrame
      title={<>Je le ferai <Serif>plus tard</Serif></>}
      lead="Choisissez le moment : vous recevez un e-mail avec un lien direct vers l'étape choisie. Rien d'autre ne part."
      onBack={onBack}
    >
      {saved && reminder ? (
        <>
          <Recipient email={email} hint="Le rappel partira à cette adresse" />
          <div className="q-banner q-banner-ok" role="status">
            <Check className="mt-0.5 size-4 shrink-0" aria-hidden />
            <p>
              {mode === "demo" ? "Démo : rappel prévu" : "Rappel prévu"} {moment}&nbsp;: {REMINDER_TARGETS[reminder.target].action}.
            </p>
          </div>
          {error && <p className="q-field-error !text-[14px]" role="alert">{error}</p>}
          <div className="flex flex-col gap-2 sm:flex-row">
            <Link href={dashboardHref(mode)} className="q-btn q-btn-primary q-btn-lg">Passer au tableau de bord</Link>
            <button type="button" className="q-btn q-btn-secondary q-btn-lg" onClick={cancel} disabled={busy !== null}>
              {busy === "cancel" && <Loader2 className="animate-spin" aria-hidden />}
              Annuler le rappel
            </button>
          </div>
        </>
      ) : (
        <form onSubmit={save} className="flex flex-col gap-5" noValidate>
          {reminder && moment && (
            <div className="q-banner" role="status">
              <AlarmClock className="mt-0.5 size-4 shrink-0" aria-hidden />
              <p>
                Un rappel est déjà prévu {moment}. Le nouveau le remplacera, ou{" "}
                <button type="button" className="font-semibold underline" onClick={cancel} disabled={busy !== null}>annulez-le</button>.
              </p>
            </div>
          )}

          <fieldset className="m-0 flex min-w-0 flex-col gap-2 border-0 p-0">
            <legend className="q-label mb-2">Quand&nbsp;? <span className="font-normal text-[var(--q-text-4)]">(heure de Paris)</span></legend>
            {!now && <Loader2 className="size-5 animate-spin text-[var(--q-accent)]" aria-label="Calcul des créneaux" />}
            {slots.map((s) => (
              <SlotOption key={s.key} checked={slot === s.key} onSelect={() => setSlot(s.key)} label={s.label} detail={s.detail} />
            ))}
            {now && (
              <SlotOption checked={slot === "custom"} onSelect={() => setSlot("custom")} label="Autre moment" detail="Dans les 30 prochains jours" />
            )}
            {slot === "custom" && range && (
              <input
                type="datetime-local"
                aria-label="Date et heure du rappel"
                className="q-input !h-12 sm:max-w-[280px]"
                min={range.min}
                max={range.max}
                value={custom}
                onChange={(e) => setCustom(e.target.value)}
              />
            )}
          </fieldset>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="reminder-target" className="q-label">Pour faire quoi&nbsp;?</label>
            <select
              id="reminder-target"
              className="q-input !h-12 sm:max-w-[320px]"
              value={target}
              onChange={(e) => setTarget(e.target.value as ReminderTarget)}
            >
              {(Object.keys(REMINDER_TARGETS) as ReminderTarget[]).map((key) => (
                <option key={key} value={key}>{REMINDER_TARGETS[key].label}</option>
              ))}
            </select>
          </div>

          <Recipient email={email} hint="Le rappel partira à cette adresse" />

          {error && <p className="q-field-error !text-[14px]" role="alert">{error}</p>}
          <div className="flex flex-col gap-2 sm:flex-row">
            <button type="submit" className="q-btn q-btn-primary q-btn-lg" disabled={busy !== null || !now}>
              {busy === "save" ? <Loader2 className="animate-spin" aria-hidden /> : <AlarmClock aria-hidden />}
              Programmer le rappel
            </button>
            <Link href={dashboardHref(mode)} className="q-btn q-btn-ghost q-btn-lg">Passer au tableau de bord</Link>
          </div>
        </form>
      )}
    </PanelFrame>
  )
}

function SlotOption({ checked, onSelect, label, detail }: { checked: boolean; onSelect: () => void; label: string; detail: string }) {
  return (
    <label
      className={cn(
        "flex cursor-pointer items-center gap-3 rounded-[14px] border p-3.5 transition-colors touch-manipulation",
        checked
          ? "border-[var(--q-accent)] bg-[var(--q-wash)]"
          : "border-[var(--q-line)] bg-[var(--q-surface)] hover:border-[var(--q-field)]",
      )}
    >
      <input type="radio" name="reminder-slot" className="size-4 shrink-0 accent-[var(--q-accent)]" checked={checked} onChange={onSelect} />
      <span className="flex min-w-0 flex-col">
        <span className="text-[15px] font-semibold text-[var(--q-ink)]">{label}</span>
        <span className="text-[13px] text-[var(--q-text-4)] first-letter:uppercase">{detail}</span>
      </span>
    </label>
  )
}
