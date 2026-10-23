import Link from 'next/link'
import { cn } from '@/lib/utils'

/** Deux vues du support : les conversations (bulle et page Contact) et les signalements de l'application. */
export function SupportTabs({ active, chatUnread }: { active: 'chat' | 'reports'; chatUnread?: number | null }) {
  const tab = (key: 'chat' | 'reports', href: string, label: string, badge?: number | null) => (
    <Link
      href={href}
      aria-current={active === key ? 'page' : undefined}
      className={cn(
        'inline-flex h-9 items-center gap-2 rounded-full border px-4 text-sm font-medium transition-colors',
        active === key ? 'border-[var(--q-ink)] bg-[var(--q-ink)] text-white' : 'border-[var(--q-line)] bg-[var(--q-surface)] text-[var(--q-text-2)] hover:border-[var(--q-field)]',
      )}
    >
      {label}
      {badge ? <span className="rounded-full bg-[var(--q-accent)] px-1.5 text-[11px] font-semibold text-white">{badge}</span> : null}
    </Link>
  )
  return (
    <nav aria-label="Vues du support" className="flex flex-wrap gap-2">
      {tab('chat', '/admin/support/chat', 'Conversations', chatUnread)}
      {tab('reports', '/admin/support', 'Signalements')}
    </nav>
  )
}
