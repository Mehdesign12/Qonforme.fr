"use client"

/**
 * Section « Emails envoyés » de la fiche utilisateur (admin) : journal des
 * emails du compte, copie exacte de chacun, envoi d'un email personnalisé.
 */
import { useEffect, useMemo, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Mail, Send } from "lucide-react"
import { EmptyState, Panel, StatusPill } from "@/components/app/kit"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"
import { CATEGORY_LABELS, fmtWhen, trackSteps, type TrackableEmail } from "@/components/admin/emails/track"
import { templateLabel, type ManualTemplate } from "@/lib/email/account-templates"

export interface EmailRow extends TrackableEmail {
  id: string
  template: string
  subject: string
  sent_to: string
  sent_by: string | null
}

const FILTERS = [
  { key: "all", label: "Tous" },
  { key: "onboarding", label: "Démarrage" },
  { key: "reprise", label: "Reprise" },
  { key: "manual", label: "À la main" },
] as const

export const MANUAL_CHOICES: { key: ManualTemplate; title: string; desc: string }[] = [
  { key: "manual_company", title: "Trouver son entreprise", desc: "Pour « Bloqué : Entreprise » : SIREN, ou saisie à la main" },
  { key: "manual_first_quote", title: "Faire son premier devis", desc: "Pour « Bloqué : Devis créé » : les trois gestes du devis" },
  { key: "manual_quote_send", title: "Envoyer son devis", desc: "Un devis en brouillon, jamais parti" },
  { key: "manual_free", title: "Email libre", desc: "Votre texte, dans la même mise en page" },
]

/** Copie d'un email, isolée de la page (aucun script, aucun lien suivi). */
function EmailFrame({ html, title }: { html: string; title: string }) {
  return (
    <iframe
      title={title}
      sandbox=""
      srcDoc={html}
      className="h-[60vh] w-full rounded-xl border border-[var(--q-line)] bg-white"
    />
  )
}

function ViewEmailDialog({ row, onClose }: { row: EmailRow | null; onClose: () => void }) {
  const [html, setHtml] = useState<string | null>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    if (!row) return
    setHtml(null)
    setFailed(false)
    let live = true
    fetch(`/api/admin/emails/${row.id}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((d: { html: string | null }) => { if (live) setHtml(d.html ?? "") })
      .catch(() => { if (live) setFailed(true) })
    return () => { live = false }
  }, [row])

  return (
    <Dialog open={!!row} onOpenChange={(open) => { if (!open) onClose() }}>
      <DialogContent className="max-h-[92dvh] gap-4 overflow-y-auto sm:max-w-4xl">
        {row && (
          <>
            <div className="flex flex-col gap-1 pr-8">
              <span className="text-xs text-[var(--q-text-3)]">{templateLabel(row.template)} · envoyé le {fmtWhen(row.sent_at)} à {row.sent_to}</span>
              <DialogTitle className="text-lg font-semibold leading-snug">{row.subject}</DialogTitle>
              <DialogDescription className="sr-only">Copie exacte de l&apos;email envoyé et son suivi.</DialogDescription>
            </div>
            <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_240px]">
              {failed ? (
                <p className="q-banner q-banner-warn">Copie indisponible : la lecture n&apos;a pas abouti.</p>
              ) : html === null ? (
                <div className="h-[60vh] animate-pulse rounded-xl bg-[var(--q-sunken)]" aria-label="Chargement" />
              ) : html === "" ? (
                <p className="text-sm text-[var(--q-text-3)]">Pas de copie gardée pour cet email.</p>
              ) : (
                <EmailFrame html={html} title={`Copie de l'email « ${row.subject} »`} />
              )}
              <aside className="flex flex-col gap-3 text-sm">
                <span className="text-xs font-semibold uppercase tracking-wide text-[var(--q-text-3)]">Suivi</span>
                <ul className="flex flex-col gap-2">
                  {trackSteps(row).map((s) => (
                    <li key={s.label}><StatusPill tone={s.tone}>{s.label}</StatusPill></li>
                  ))}
                </ul>
                {row.error && <p className="text-xs text-[var(--q-danger)]">{row.error}</p>}
                <p className="text-xs leading-relaxed text-[var(--q-text-3)]">
                  Les clics passent par les liens de l&apos;email : fiables. Les ouvertures ne sont pas suivies. Copie gardée 12 mois.
                </p>
              </aside>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}

function SendEmailDialog({
  open,
  onClose,
  userId,
  accountLabel,
  suggested,
}: {
  open: boolean
  onClose: () => void
  userId: string
  accountLabel: string
  suggested: ManualTemplate
}) {
  const router = useRouter()
  const [template, setTemplate] = useState<ManualTemplate>(suggested)
  const [note, setNote] = useState("")
  const [freeSubject, setFreeSubject] = useState("")
  const [freeBody, setFreeBody] = useState("")
  const [preview, setPreview] = useState<{ subject: string; html: string; to: string; blocker: string | null } | null>(null)
  const [previewError, setPreviewError] = useState(false)
  const [busy, setBusy] = useState<"test" | "send" | null>(null)
  const seq = useRef(0)

  useEffect(() => { if (open) setTemplate(suggested) }, [open, suggested])

  const payload = useMemo(
    () => ({ template, note: template === "manual_free" ? null : note, freeSubject, freeBody }),
    [template, note, freeSubject, freeBody],
  )

  useEffect(() => {
    if (!open) return
    const id = ++seq.current
    const timer = setTimeout(() => {
      fetch(`/api/admin/users/${userId}/emails`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "preview", ...payload }),
      })
        .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
        .then((d) => { if (id === seq.current) { setPreview(d); setPreviewError(false) } })
        .catch(() => { if (id === seq.current) setPreviewError(true) })
    }, 350)
    return () => clearTimeout(timer)
  }, [open, payload, userId])

  async function run(action: "test" | "send") {
    setBusy(action)
    try {
      const r = await fetch(`/api/admin/users/${userId}/emails`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, ...payload }),
      })
      const d = (await r.json().catch(() => ({}))) as { error?: string; to?: string }
      if (!r.ok) {
        toast.error(d.error ?? "L'email n'est pas parti.")
        return
      }
      if (action === "test") {
        toast.success(`Essai envoyé à ${d.to}`)
      } else {
        toast.success(`Email envoyé à ${d.to}`)
        onClose()
        router.refresh()
      }
    } catch {
      toast.error("Réseau indisponible, réessayez.")
    } finally {
      setBusy(null)
    }
  }

  const free = template === "manual_free"
  const blocker = preview?.blocker ?? null

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose() }}>
      <DialogContent className="max-h-[92dvh] gap-4 overflow-y-auto sm:max-w-5xl">
        <div className="flex flex-col gap-1 pr-8">
          <DialogTitle className="text-lg font-semibold">Envoyer un email à {accountLabel}</DialogTitle>
          <DialogDescription className="text-[13px] text-[var(--q-text-3)]">
            Au nom de Qonforme, avec le lien de désinscription. Le prénom et le devis viennent du compte.
          </DialogDescription>
        </div>

        <div className="grid gap-5 lg:grid-cols-[minmax(0,420px)_minmax(0,1fr)]">
          <div className="flex flex-col gap-4">
            <fieldset className="flex flex-col gap-2">
              <legend className="q-label mb-2">Modèle</legend>
              {MANUAL_CHOICES.map((c) => (
                <label
                  key={c.key}
                  className={cn(
                    "flex cursor-pointer items-start gap-3 rounded-xl border px-3 py-2.5",
                    template === c.key ? "border-[var(--q-accent)] bg-[var(--q-accent-wash,var(--q-sunken))]" : "border-[var(--q-line)]",
                  )}
                >
                  <input type="radio" name="modele" className="mt-1" checked={template === c.key} onChange={() => setTemplate(c.key)} />
                  <span className="flex flex-col gap-0.5">
                    <span className="text-sm font-semibold">
                      {c.title}
                      {c.key === suggested && <span className="ml-2 text-xs font-normal text-[var(--q-accent-strong)]">conseillé</span>}
                    </span>
                    <span className="text-xs text-[var(--q-text-3)]">{c.desc}</span>
                  </span>
                </label>
              ))}
            </fieldset>

            {free ? (
              <>
                <label className="flex flex-col gap-1.5">
                  <span className="q-label">Objet</span>
                  <Input value={freeSubject} maxLength={150} onChange={(e) => setFreeSubject(e.target.value)} />
                </label>
                <label className="flex flex-col gap-1.5">
                  <span className="q-label">Texte</span>
                  <Textarea value={freeBody} rows={7} maxLength={5000} onChange={(e) => setFreeBody(e.target.value)} />
                  <span className="text-xs text-[var(--q-text-3)]">Une ligne vide sépare deux paragraphes. Jamais d&apos;appel ni de rendez-vous promis.</span>
                </label>
              </>
            ) : (
              <label className="flex flex-col gap-1.5">
                <span className="q-label">Phrase ajoutée (facultatif)</span>
                <Textarea value={note} rows={3} maxLength={1000} onChange={(e) => setNote(e.target.value)} />
              </label>
            )}

            {blocker && <p role="status" className="q-banner q-banner-warn">{blocker}</p>}
          </div>

          <div className="flex min-w-0 flex-col gap-2">
            <span className="text-xs font-semibold uppercase tracking-wide text-[var(--q-text-3)]">
              Aperçu{preview ? ` · « ${preview.subject} » à ${preview.to}` : ""}
            </span>
            {previewError ? (
              <p className="q-banner q-banner-warn">Aperçu indisponible, réessayez.</p>
            ) : preview ? (
              <EmailFrame html={preview.html} title="Aperçu de l'email" />
            ) : (
              <div className="h-[60vh] animate-pulse rounded-xl bg-[var(--q-sunken)]" aria-label="Chargement de l'aperçu" />
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[var(--q-line-soft)] pt-4">
          <Button variant="outline" onClick={() => run("test")} disabled={!!busy || !preview}>
            {busy === "test" ? "Envoi…" : "M'envoyer un essai"}
          </Button>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={onClose}>Annuler</Button>
            <Button onClick={() => run("send")} disabled={!!busy || !preview || !!blocker}>
              <Send aria-hidden />
              {busy === "send" ? "Envoi…" : "Envoyer"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

export function AccountEmails({
  userId,
  accountLabel,
  history,
  suggested,
  optedOut,
}: {
  userId: string
  accountLabel: string
  history: { kind: "ok"; rows: EmailRow[] } | { kind: "unavailable" } | { kind: "error" }
  suggested: ManualTemplate
  optedOut: boolean
}) {
  const [filter, setFilter] = useState<(typeof FILTERS)[number]["key"]>("all")
  const [viewing, setViewing] = useState<EmailRow | null>(null)
  const [sending, setSending] = useState(false)

  const rows = history.kind === "ok" ? history.rows : []
  const shown = filter === "all" ? rows : rows.filter((r) => r.category === filter)
  const clicked = rows.filter((r) => r.first_clicked_at).length

  return (
    <Panel
      title="Emails envoyés"
      action={
        history.kind !== "unavailable" && (
          <Button size="sm" onClick={() => setSending(true)} disabled={optedOut}>
            <Send aria-hidden />
            Envoyer un email
          </Button>
        )
      }
    >
      {history.kind === "unavailable" ? (
        <p className="px-5 pb-5 text-sm text-[var(--q-text-3)]">
          Journal des emails pas encore activé : la migration <span className="font-mono">20261110_account_emails.sql</span> n&apos;est pas appliquée.
        </p>
      ) : history.kind === "error" ? (
        <p className="mx-5 mb-5 q-banner q-banner-warn">Emails indisponibles : la lecture n&apos;a pas abouti.</p>
      ) : (
        <>
          <div className="flex flex-wrap items-center justify-between gap-2 px-5 pb-3">
            <span className="text-[13px] text-[var(--q-text-3)]">
              {rows.length} email{rows.length > 1 ? "s" : ""} · {clicked} cliqué{clicked > 1 ? "s" : ""}
              {optedOut && <span className="font-semibold text-[var(--q-warn)]"> · désinscrit des conseils</span>}
            </span>
            <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filtrer les emails">
              {FILTERS.map((f) => (
                <button
                  key={f.key}
                  type="button"
                  aria-pressed={filter === f.key}
                  onClick={() => setFilter(f.key)}
                  className={cn(
                    "h-8 rounded-full border px-3 text-[13px]",
                    filter === f.key
                      ? "border-[var(--q-accent)] font-semibold text-[var(--q-accent-strong)]"
                      : "border-[var(--q-line)] text-[var(--q-text-2)] hover:bg-[var(--q-hover)]",
                  )}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          {shown.length === 0 ? (
            <EmptyState
              icon={<Mail className="size-5" aria-hidden />}
              title={rows.length ? "Aucun email de ce type" : "Aucun email au journal"}
              text={rows.length ? "Changez de filtre." : "Les emails envoyés à ce compte apparaîtront ici."}
            />
          ) : (
            <ul className="q-list border-t border-[var(--q-line-soft)]">
              {shown.map((r) => {
                const cat = CATEGORY_LABELS[r.category] ?? { label: r.category, tone: "neutral" as const }
                return (
                  <li key={r.id} className="flex flex-col gap-2 px-5 py-3 md:grid md:grid-cols-[130px_minmax(0,1fr)_110px_minmax(0,1.1fr)_auto] md:items-center md:gap-3">
                    <span className="text-[13px] text-[var(--q-text-3)]">{fmtWhen(r.sent_at)}</span>
                    <span className="flex min-w-0 flex-col">
                      <span className="truncate text-sm font-semibold text-[var(--q-ink)]">{r.subject}</span>
                      <span className="truncate text-xs text-[var(--q-text-3)]">{templateLabel(r.template)}</span>
                    </span>
                    <span><StatusPill tone={cat.tone} className="!h-6 !text-[11px]">{cat.label}</StatusPill></span>
                    <span className="flex flex-wrap gap-1.5">
                      {trackSteps(r).map((s) => (
                        <StatusPill key={s.label} tone={s.tone} className="!h-6 !text-[11px]">{s.label}</StatusPill>
                      ))}
                    </span>
                    <Button variant="link" size="sm" className="justify-start px-0 md:justify-end" onClick={() => setViewing(r)}>
                      Voir l&apos;email
                    </Button>
                  </li>
                )
              })}
            </ul>
          )}
        </>
      )}

      <ViewEmailDialog row={viewing} onClose={() => setViewing(null)} />
      <SendEmailDialog open={sending} onClose={() => setSending(false)} userId={userId} accountLabel={accountLabel} suggested={suggested} />
    </Panel>
  )
}
