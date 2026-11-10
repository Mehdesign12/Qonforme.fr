import { StatusPill } from "@/components/app/kit"
import { fmtWhen, trackSummary } from "@/components/admin/emails/track"
import type { AccountEmailRow } from "@/lib/admin/account-emails"

/**
 * Colonne « Dernier email » d'Admin › Utilisateurs. `undefined` : lecture
 * impossible ; `null` : aucun email au journal.
 */
export function LastEmailCell({ email }: { email: AccountEmailRow | null | undefined }) {
  if (email === undefined) return <span className="text-[13px] text-[var(--q-placeholder)]">Indisponible</span>
  if (email === null) return <span className="text-[13px] text-[var(--q-text-4)]">Aucun email</span>
  const t = trackSummary(email)
  return (
    <span className="flex min-w-[200px] max-w-[260px] flex-col items-start gap-1">
      <span className="line-clamp-2 text-[13px] font-semibold text-[var(--q-ink)]" title={email.subject}>{email.subject}</span>
      <span className="flex flex-wrap items-center gap-1.5 text-xs text-[var(--q-text-3)]">
        {fmtWhen(email.sent_at)}
        <StatusPill tone={t.tone} className="!h-5 !text-[11px]">{t.text}</StatusPill>
      </span>
    </span>
  )
}
