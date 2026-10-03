"use client"

/**
 * Paramètres › Accès comptable : l'artisan invite son comptable (une ou
 * plusieurs personnes), voit les accès en cours et les invitations en
 * attente, la dernière consultation, le journal des consultations et des
 * exports, et retire un accès à tout moment.
 *
 * Application : /api/accountant-access (lecture, invitation), /[id]/resend,
 * DELETE /[id]. Tant que la migration n'est pas appliquée (`available: false`),
 * la page le dit et renvoie vers les exports comptables.
 * Démo (`mode="demo"`) : mêmes écrans, données de lib/demo/accountant.ts,
 * rien n'est envoyé.
 */
import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { toast } from "sonner"
import {
  Check, Download, Eye, FileArchive, FileSpreadsheet, FileText, History, Loader2, Mail, RefreshCw, Send,
  ShieldCheck, UserCheck, UserMinus, UserPlus, X, type LucideIcon,
} from "lucide-react"
import { PageHeader, StatusPill, initialsOf } from "@/components/app/kit"
import type { ShellMode } from "@/components/layout/nav"
import { settingsHref } from "@/components/settings/sections"
import { Field, FieldGrid, SettingsCard } from "@/components/settings/ui"
import { dateTime, dayOf, periodText } from "@/components/accountant/format"
import { INVITE_TTL_DAYS, MAX_LIVE_ACCESSES } from "@/lib/accountant/rules"
import type { AccessOverview, AccessView, EventAction, EventView } from "@/lib/accountant/types"

const SEES = [
  "Vos factures émises et vos avoirs, avec leur statut de paiement",
  "Les totaux et la TVA facturée de la période de son choix",
  "Le FEC, l'export des ventes (CSV) et les PDF de la période",
]
const NEVER = [
  "Vos brouillons, vos devis et vos clients",
  "Aucune modification, aucun envoi, aucune relance",
]

function signupToast(text: string) {
  toast(text, { action: { label: "S'inscrire", onClick: () => { window.location.href = "/signup" } } })
}

export function AccountantAccessView({ mode, demoOverview }: { mode: ShellMode; demoOverview?: AccessOverview }) {
  const demo = mode === "demo"
  const [state, setState] = useState<"loading" | "ready" | "unavailable" | "error">(demo ? "ready" : "loading")
  const [data, setData] = useState<AccessOverview>(demoOverview ?? { available: true, accesses: [], events: [] })
  const [email, setEmail] = useState("")
  const [label, setLabel] = useState("")
  const [emailError, setEmailError] = useState<string | null>(null)
  const [sending, setSending] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [confirmId, setConfirmId] = useState<string | null>(null)

  const load = useCallback(() => {
    if (demo) return
    setState((s) => (s === "ready" ? s : "loading"))
    fetch("/api/accountant-access", { cache: "no-store" })
      .then(async (r) => {
        const json = await r.json().catch(() => ({}))
        if (!r.ok) throw new Error(json.error)
        if (!json.available) { setState("unavailable"); return }
        setData(json as AccessOverview)
        setState("ready")
      })
      .catch(() => setState("error"))
  }, [demo])

  useEffect(() => { load() }, [load])

  const invite = async (e: React.FormEvent) => {
    e.preventDefault()
    const value = email.trim()
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value)) { setEmailError("Saisissez une adresse email valide."); return }
    setEmailError(null)
    if (demo) { signupToast("Créez un compte pour inviter votre comptable"); return }
    setSending(true)
    try {
      const res = await fetch("/api/accountant-access", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: value, label: label.trim() || null }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) { toast.error(json.error ?? "L'invitation n'a pas pu partir. Réessayez."); return }
      toast.success(`Invitation envoyée à ${value}`)
      setEmail("")
      setLabel("")
      load()
    } catch {
      toast.error("Erreur réseau. Réessayez.")
    } finally {
      setSending(false)
    }
  }

  const resend = async (a: AccessView) => {
    if (demo) { signupToast("Démo : l'invitation serait renvoyée avec un nouveau lien"); return }
    setBusyId(a.id)
    try {
      const res = await fetch(`/api/accountant-access/${a.id}/resend`, { method: "POST" })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) { toast.error(json.error ?? "L'invitation n'a pas pu être renvoyée."); return }
      toast.success(`Invitation renvoyée à ${a.email}`)
      load()
    } catch {
      toast.error("Erreur réseau. Réessayez.")
    } finally {
      setBusyId(null)
    }
  }

  const revoke = async (a: AccessView) => {
    if (demo) { setConfirmId(null); signupToast("Démo : l'accès serait retiré immédiatement"); return }
    setBusyId(a.id)
    try {
      const res = await fetch(`/api/accountant-access/${a.id}`, { method: "DELETE" })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) { toast.error(json.error ?? "Le retrait a échoué. Réessayez."); return }
      toast.success(a.status === "active" ? "Accès retiré" : "Invitation annulée")
      setConfirmId(null)
      load()
    } catch {
      toast.error("Erreur réseau. Réessayez.")
    } finally {
      setBusyId(null)
    }
  }

  const header = (
    <PageHeader
      title="Accès comptable"
      subtitle="Votre comptable consulte vos factures et télécharge vos exports, sans rien pouvoir modifier"
      backHref={settingsHref("/settings", mode)}
      backLabel="Paramètres"
    />
  )

  if (state === "loading") {
    return (
      <>
        {header}
        <div className="q-card flex items-center justify-center py-16">
          <Loader2 className="size-6 animate-spin text-[var(--q-accent)]" aria-label="Chargement des accès" />
        </div>
      </>
    )
  }

  if (state === "error") {
    return (
      <>
        {header}
        <SettingsCard id="acces" title="Accès comptable">
          <p className="text-[13px] text-[var(--q-text-3)]">Impossible de charger vos accès. Vérifiez votre connexion.</p>
          <button type="button" className="q-btn q-btn-secondary self-start" onClick={load}>
            <RefreshCw aria-hidden />
            Réessayer
          </button>
        </SettingsCard>
      </>
    )
  }

  if (state === "unavailable") {
    return (
      <>
        {header}
        <SettingsCard
          id="acces"
          title="L'accès comptable n'est pas encore activé"
          description="En attendant, téléchargez le fichier des écritures comptables (FEC) de la période et transmettez-le à votre comptable."
        >
          <Link href={settingsHref("/settings/exports", mode)} className="q-btn q-btn-secondary self-start">
            <Download aria-hidden />
            Exports comptables
          </Link>
        </SettingsCard>
      </>
    )
  }

  const full = data.accesses.length >= MAX_LIVE_ACCESSES

  return (
    <>
      {header}

      <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(280px,340px)]">
        <div className="flex min-w-0 flex-col gap-4">
          {/* ── Invitation ── */}
          <SettingsCard
            id="inviter"
            title="Inviter votre comptable"
            description={`Il reçoit un email avec un lien valable ${INVITE_TTL_DAYS} jours. Il crée un compte Qonforme gratuit ou se connecte avec cette adresse, sans entreprise à renseigner.`}
          >
            <form onSubmit={invite} noValidate className="flex flex-col gap-3">
              <FieldGrid>
                <Field label="Adresse email" htmlFor="acces-email" error={emailError}>
                  <input
                    id="acces-email"
                    type="email"
                    inputMode="email"
                    autoComplete="off"
                    placeholder="comptable@cabinet.fr"
                    className="q-input"
                    value={email}
                    aria-invalid={emailError ? true : undefined}
                    onChange={(e) => { setEmail(e.target.value); if (emailError) setEmailError(null) }}
                    disabled={sending || full}
                  />
                </Field>
                <Field label="Nom ou cabinet" htmlFor="acces-label" hint="Facultatif, pour vous y retrouver">
                  <input
                    id="acces-label"
                    type="text"
                    autoComplete="off"
                    maxLength={80}
                    placeholder="Cabinet Martin"
                    className="q-input"
                    value={label}
                    onChange={(e) => setLabel(e.target.value)}
                    disabled={sending || full}
                  />
                </Field>
              </FieldGrid>
              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--q-line-soft)] pt-3">
                <p className="text-[13px] text-[var(--q-text-4)]">
                  {full
                    ? `${MAX_LIVE_ACCESSES} accès au plus : retirez-en un pour en ajouter un autre.`
                    : "L'email part au nom de Qonforme."}
                </p>
                <button type="submit" className="q-btn q-btn-primary w-full sm:w-auto" disabled={sending || full}>
                  {sending ? <Loader2 className="animate-spin" aria-hidden /> : <Send aria-hidden />}
                  {sending ? "Envoi…" : "Envoyer l'invitation"}
                </button>
              </div>
            </form>
          </SettingsCard>

          {/* ── Accès en cours ── */}
          <SettingsCard id="en-cours" title="Accès en cours">
            {data.accesses.length === 0 ? (
              <div className="q-inset flex items-center gap-3 p-3.5">
                <span className="grid size-9 shrink-0 place-items-center rounded-[11px] bg-[var(--q-sunken)] text-[var(--q-text-3)]">
                  <UserPlus className="size-[18px]" strokeWidth={1.75} aria-hidden />
                </span>
                <p className="text-[13px] leading-relaxed text-[var(--q-text-3)]">
                  Personne n&apos;a accès à votre facturation. Invitez votre comptable ci-dessus.
                </p>
              </div>
            ) : (
              <ul className="-mx-5 -mb-5 flex flex-col">
                {data.accesses.map((a) => (
                  <AccessRowItem
                    key={a.id}
                    access={a}
                    busy={busyId === a.id}
                    confirming={confirmId === a.id}
                    onAskRevoke={() => setConfirmId(a.id)}
                    onCancelRevoke={() => setConfirmId(null)}
                    onRevoke={() => revoke(a)}
                    onResend={() => resend(a)}
                  />
                ))}
              </ul>
            )}
          </SettingsCard>

          {/* ── Journal ── */}
          <SettingsCard
            id="journal"
            title="Journal des consultations"
            description="Chaque consultation et chaque téléchargement de votre comptable, horodatés. Conservé un an."
          >
            {data.events.length === 0 ? (
              <p className="text-[13px] text-[var(--q-text-4)]">Aucune activité pour l&apos;instant.</p>
            ) : (
              <ol className="-mx-5 -mb-5 flex flex-col">
                {data.events.map((e) => <EventItem key={e.id} event={e} />)}
              </ol>
            )}
          </SettingsCard>
        </div>

        {/* ── Ce que voit le comptable ── */}
        <aside className="flex flex-col gap-4">
          <SettingsCard id="perimetre" title="Ce que voit votre comptable">
            <ul className="flex flex-col gap-2.5">
              {SEES.map((item) => (
                <li key={item} className="flex items-start gap-2.5 text-sm text-[var(--q-text-2)]">
                  <Check className="mt-0.5 size-4 shrink-0 text-[var(--q-ok)]" strokeWidth={2.5} aria-hidden />
                  {item}
                </li>
              ))}
              {NEVER.map((item) => (
                <li key={item} className="flex items-start gap-2.5 text-sm text-[var(--q-text-3)]">
                  <X className="mt-0.5 size-4 shrink-0 text-[var(--q-text-4)]" strokeWidth={2.5} aria-hidden />
                  {item}
                </li>
              ))}
            </ul>
            <p className="flex items-start gap-2 border-t border-[var(--q-line-soft)] pt-3 text-[13px] leading-relaxed text-[var(--q-text-4)]">
              <ShieldCheck className="mt-0.5 size-4 shrink-0" strokeWidth={1.75} aria-hidden />
              Retirer un accès le coupe immédiatement, sans prévenir la personne.
            </p>
            {demo && (
              <Link href="/demo/comptable" className="q-btn q-btn-secondary">
                <Eye aria-hidden />
                Voir l&apos;espace du comptable
              </Link>
            )}
          </SettingsCard>
        </aside>
      </div>
    </>
  )
}

/* ------------------------------------------------------------------ */
/* Une personne                                                        */
/* ------------------------------------------------------------------ */

function AccessRowItem({
  access: a, busy, confirming, onAskRevoke, onCancelRevoke, onRevoke, onResend,
}: {
  access: AccessView
  busy: boolean
  confirming: boolean
  onAskRevoke: () => void
  onCancelRevoke: () => void
  onRevoke: () => void
  onResend: () => void
}) {
  const name = a.label || a.email
  const active = a.status === "active"
  const sub = active
    ? `Accès depuis le ${dayOf(a.acceptedAt)} · ${a.lastSeenAt ? `dernière consultation le ${dateTime(a.lastSeenAt)}` : "pas encore consulté"}`
    : a.status === "pending"
      ? `Invitation du ${dayOf(a.invitedAt)} · lien valable jusqu'au ${dayOf(a.expiresAt)}`
      : `Lien expiré le ${dayOf(a.expiresAt)} · renvoyez l'invitation`

  return (
    <li className="flex flex-col gap-3 border-t border-[var(--q-line-soft)] px-5 py-4">
      <div className="flex items-start gap-3">
        <span className="q-avatar !size-10 shrink-0 !rounded-[12px]" aria-hidden>{initialsOf(name)}</span>
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="min-w-0 truncate text-[15px] font-semibold text-[var(--q-ink)]">{name}</span>
            {active ? (
              <StatusPill tone="ok" icon={<Check strokeWidth={2.75} aria-hidden />}>Accès actif</StatusPill>
            ) : a.status === "pending" ? (
              <StatusPill tone="info" icon={<Mail strokeWidth={2.25} aria-hidden />}>Invitation envoyée</StatusPill>
            ) : (
              <StatusPill tone="warn">Invitation expirée</StatusPill>
            )}
          </span>
          {a.label && <span className="truncate text-[13px] text-[var(--q-text-3)]">{a.email}</span>}
          <span className="text-[13px] leading-relaxed text-[var(--q-text-4)]">{sub}</span>
        </span>
      </div>

      {confirming ? (
        <div className="q-banner q-banner-warn flex-col !items-stretch gap-2.5 sm:flex-row sm:!items-center" role="alert">
          <p className="flex-1 text-[13px] leading-relaxed">
            {active ? `Retirer l'accès de ${name} ? Il ne pourra plus rien consulter ni télécharger.` : "Annuler cette invitation ? Le lien cessera de fonctionner."}
          </p>
          <span className="flex shrink-0 gap-2">
            <button type="button" className="q-btn q-btn-secondary q-btn-sm flex-1" onClick={onCancelRevoke} disabled={busy}>
              {active ? "Garder" : "Non"}
            </button>
            <button type="button" className="q-btn q-btn-danger q-btn-sm flex-1" onClick={onRevoke} disabled={busy}>
              {busy ? <Loader2 className="animate-spin" aria-hidden /> : <UserMinus aria-hidden />}
              {active ? "Retirer l'accès" : "Annuler l'invitation"}
            </button>
          </span>
        </div>
      ) : (
        <div className="flex flex-wrap gap-2 pl-[52px]">
          {!active && (
            <button type="button" className="q-btn q-btn-secondary q-btn-sm" onClick={onResend} disabled={busy}>
              {busy ? <Loader2 className="animate-spin" aria-hidden /> : <RefreshCw aria-hidden />}
              Renvoyer
            </button>
          )}
          <button type="button" className="q-btn q-btn-ghost q-btn-sm text-[var(--q-danger)]" onClick={onAskRevoke} disabled={busy}>
            <UserMinus aria-hidden />
            {active ? "Retirer l'accès" : "Annuler l'invitation"}
          </button>
        </div>
      )}
    </li>
  )
}

/* ------------------------------------------------------------------ */
/* Journal                                                             */
/* ------------------------------------------------------------------ */

const EVENT_TEXT: Record<EventAction, { icon: LucideIcon; text: (who: string) => string }> = {
  invited: { icon: Mail, text: (who) => `Invitation envoyée à ${who}` },
  reinvited: { icon: Mail, text: (who) => `Invitation renvoyée à ${who}` },
  cancelled: { icon: X, text: (who) => `Invitation de ${who} annulée` },
  accepted: { icon: UserCheck, text: (who) => `${who} a accepté l'invitation` },
  revoked: { icon: UserMinus, text: (who) => `Accès de ${who} retiré` },
  viewed: { icon: Eye, text: (who) => `${who} a consulté vos documents` },
  export_fec: { icon: FileText, text: (who) => `${who} a téléchargé le FEC` },
  export_csv: { icon: FileSpreadsheet, text: (who) => `${who} a téléchargé l'export des ventes` },
  export_pdf_zip: { icon: FileArchive, text: (who) => `${who} a téléchargé les PDF` },
}

function EventItem({ event: e }: { event: EventView }) {
  const def = EVENT_TEXT[e.action] ?? { icon: History, text: (who: string) => who }
  const Icon = def.icon
  const who = e.label || e.email || "Votre comptable"
  const details = [
    e.periodFrom && e.periodTo ? `période ${periodText({ from: e.periodFrom, to: e.periodTo })}` : null,
    e.detail,
  ].filter(Boolean).join(" · ")
  return (
    <li className="flex items-start gap-3 border-t border-[var(--q-line-soft)] px-5 py-3">
      <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-[10px] bg-[var(--q-sunken)] text-[var(--q-text-3)]">
        <Icon className="size-4" strokeWidth={1.75} aria-hidden />
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="text-sm font-medium text-[var(--q-ink)] [overflow-wrap:anywhere]">{def.text(who)}</span>
        <span className="text-[13px] text-[var(--q-text-4)]">
          <time dateTime={e.at}>{dateTime(e.at)}</time>
          {details ? ` · ${details}` : ""}
        </span>
      </span>
    </li>
  )
}
