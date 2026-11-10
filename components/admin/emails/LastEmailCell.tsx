import { CircleAlert, MailCheck } from "lucide-react"
import { StatusPill } from "@/components/app/kit"
import { fmtWhen, trackSummary } from "@/components/admin/emails/track"
import { templateLabel } from "@/lib/email/account-templates"
import type { AccountEmailRow } from "@/lib/admin/account-emails"

/** Un email parti mais refusé par la messagerie (ou jamais parti) : à montrer en rouge, pas en vert. */
export function emailFailed(email: Pick<AccountEmailRow, "status">): boolean {
  return email.status === "failed" || email.status === "bounced" || email.status === "complained"
}

/**
 * Colonne « Dernier email » d'Admin › Utilisateurs. `undefined` : lecture
 * impossible ; `null` : aucun email au journal. Un email parti s'affiche dans un
 * encadré vert (« Email envoyé », date, modèle, suivi) ; un email refusé, en rouge.
 */
export function LastEmailCell({ email }: { email: AccountEmailRow | null | undefined }) {
  if (email === undefined) return <span className="text-[13px] text-[var(--q-placeholder)]">Indisponible</span>
  if (email === null) return <span className="text-[13px] text-[var(--q-text-4)]">Aucun email envoyé</span>
  const t = trackSummary(email)
  const failed = emailFailed(email)
  return (
    <span
      className={
        failed
          ? "flex min-w-[210px] max-w-[270px] flex-col items-start gap-1 rounded-xl border border-[var(--q-danger-line)] bg-[var(--q-danger-bg)] px-3 py-2"
          : "flex min-w-[210px] max-w-[270px] flex-col items-start gap-1 rounded-xl border border-[var(--q-ok-line)] bg-[var(--q-ok-bg)] px-3 py-2"
      }
      title={email.subject}
    >
      <span className={failed ? "flex items-center gap-1.5 text-[13px] font-semibold text-[var(--q-danger)]" : "flex items-center gap-1.5 text-[13px] font-semibold text-[var(--q-ok)]"}>
        {failed ? <CircleAlert className="size-3.5 shrink-0" aria-hidden /> : <MailCheck className="size-3.5 shrink-0" aria-hidden />}
        {failed ? "Email non remis" : "Email envoyé"}
        <span className="font-normal">· {fmtWhen(email.sent_at)}</span>
      </span>
      <span className="text-xs font-medium text-[var(--q-ink)]">{templateLabel(email.template)}</span>
      <StatusPill tone={t.tone} className="!h-5 !text-[11px]">{t.text}</StatusPill>
    </span>
  )
}
