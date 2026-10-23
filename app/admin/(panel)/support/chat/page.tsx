import Link from 'next/link'
import { Inbox } from 'lucide-react'
import { createAdminClient } from '@/lib/supabase/server'
import { isMissingSchemaError } from '@/lib/supabase/schema-guard'
import { EmptyState, PageHeader, StatusPill, type Tone } from '@/components/app/kit'
import { FilterBar, FilterSelect, LoadError, fmtDateTime } from '@/components/admin/ui'
import { SupportTabs } from '@/components/admin/SupportTabs'
import { CATEGORY_LABELS, SOURCE_LABELS, STATUS_LABELS, isChatStatus } from '@/lib/support-chat/rules'
import { cn } from '@/lib/utils'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Admin — Conversations' }

const TONE: Record<string, Tone> = { open: 'warn', pending: 'info', resolved: 'ok' }
type Row = {
  id: string; email: string; name: string | null; source: keyof typeof SOURCE_LABELS; subject: string | null
  category: keyof typeof CATEGORY_LABELS | null; status: keyof typeof STATUS_LABELS; admin_unread: boolean; last_message_at: string
}

export default async function AdminChatListPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const { status = '' } = await searchParams
  const admin = createAdminClient()
  let query = admin.from('support_conversations')
    .select('id, email, name, source, subject, category, status, admin_unread, last_message_at')
    .order('last_message_at', { ascending: false }).limit(200)
  if (isChatStatus(status)) query = query.eq('status', status)
  const { data, error } = await query
  const notActive = !!error && isMissingSchemaError(error)
  const rows = (data ?? []) as Row[]
  const unread = rows.filter((r) => r.admin_unread).length

  return (
    <div className="flex flex-col gap-5">
      <PageHeader title="Support" subtitle={notActive ? 'Migration 20261023_support_chat.sql à appliquer' : unread ? `${unread} conversation${unread > 1 ? 's' : ''} à lire` : 'Aucune conversation à lire'} />
      <SupportTabs active="chat" chatUnread={unread || null} />
      <FilterBar resetHref="/admin/support/chat" active={!!status} label="Filtrer les conversations">
        <FilterSelect name="status" label="Statut" defaultValue={status} options={[{ value: '', label: 'Tous les statuts' }, { value: 'open', label: 'Ouvertes' }, { value: 'pending', label: 'En attente' }, { value: 'resolved', label: 'Résolues' }]} />
      </FilterBar>
      {notActive ? (
        <LoadError what="les conversations (la migration du chat n'est pas appliquée)" />
      ) : error ? (
        <LoadError what="les conversations" />
      ) : rows.length === 0 ? (
        <div className="q-card"><EmptyState icon={<Inbox className="size-5" aria-hidden />} title="Aucune conversation" text="Les messages écrits depuis la bulle et la page Contact arrivent ici." /></div>
      ) : (
        <ul className="flex flex-col gap-3" aria-label="Conversations">
          {rows.map((r) => (
            <li key={r.id}>
              <Link href={`/admin/support/chat/${r.id}`} className={cn('q-card flex flex-col gap-1.5 px-4 py-3.5 transition-colors hover:border-[var(--q-field)] sm:px-5', r.admin_unread && '!border-[var(--q-warn-line)]')}>
                <span className="flex flex-wrap items-center gap-2">
                  <span className={cn('text-[var(--q-ink)]', r.admin_unread ? 'font-semibold' : 'font-medium')}>{r.name || r.email}</span>
                  <StatusPill tone={TONE[r.status] ?? 'neutral'}>{STATUS_LABELS[r.status] ?? r.status}</StatusPill>
                  <span className="ml-auto text-xs text-[var(--q-text-4)]">{fmtDateTime(r.last_message_at)}</span>
                </span>
                <span className="truncate text-sm text-[var(--q-text-2)]">{r.subject || (r.category ? CATEGORY_LABELS[r.category] : 'Sans objet')}</span>
                <span className="text-[13px] text-[var(--q-text-4)]">{r.name ? `${r.email} · ` : ''}{SOURCE_LABELS[r.source] ?? r.source}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
