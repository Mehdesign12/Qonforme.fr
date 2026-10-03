import { createAdminClient } from '@/lib/supabase/server'
import { Bug, Check, Inbox, Mail, MessageSquare } from 'lucide-react'
import { EmptyState, PageHeader, StatusPill, type Tone } from '@/components/app/kit'
import { FilterBar, FilterSelect, LoadError, StatLink, fmtDateTime, fmtInt, plural } from '@/components/admin/ui'
import { SupportActions } from '@/components/admin/SupportActions'
import { cn } from '@/lib/utils'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Admin — Support' }

const STATUS: Record<string, { label: string; tone: Tone }> = {
  new:      { label: 'Nouveau', tone: 'warn' },
  read:     { label: 'Lu',      tone: 'neutral' },
  resolved: { label: 'Résolu',  tone: 'ok' },
}

function TypePill({ type }: { type: string }) {
  return type === 'bug_report' ? (
    <StatusPill tone="danger" icon={<Bug strokeWidth={2.25} aria-hidden />}>Problème signalé</StatusPill>
  ) : (
    <StatusPill tone="info" icon={<MessageSquare strokeWidth={2.25} aria-hidden />}>Message</StatusPill>
  )
}

function MessageStatus({ status }: { status: string }) {
  const s = STATUS[status] ?? { label: status, tone: 'neutral' as Tone }
  return (
    <StatusPill tone={s.tone} icon={status === 'resolved' ? <Check strokeWidth={2.75} aria-hidden /> : undefined}>
      {s.label}
    </StatusPill>
  )
}

interface SearchParams { type?: string; status?: string }

async function getMessages(typeFilter: string, statusFilter: string) {
  const admin = createAdminClient()

  let query = admin
    .from('support_messages')
    .select('*')
    .order('created_at', { ascending: false })

  if (typeFilter)   query = query.eq('type', typeFilter)
  if (statusFilter) query = query.eq('status', statusFilter)

  const { data, error } = await query.limit(200)
  return { messages: data ?? [], error: !!error }
}

/** Compteurs sur toute la table (et non sur la liste filtrée). */
async function getCounts() {
  const admin = createAdminClient()
  const head = () => admin.from('support_messages').select('id', { count: 'exact', head: true })
  const [unread, bugs, contacts] = await Promise.all([
    head().eq('status', 'new'),
    head().eq('type', 'bug_report'),
    head().eq('type', 'contact'),
  ])
  const n = (r: { count: number | null; error: unknown }) => (r.error ? null : r.count ?? 0)
  return { unread: n(unread), bugs: n(bugs), contacts: n(contacts) }
}

export default async function AdminSupportPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>
}) {
  const params       = await searchParams
  const typeFilter   = params.type ?? ''
  const statusFilter = params.status ?? ''
  const filtered     = !!(typeFilter || statusFilter)

  const [{ messages, error }, counts] = await Promise.all([
    getMessages(typeFilter, statusFilter),
    getCounts(),
  ])

  const subtitle = counts.unread === null
    ? 'Compteur indisponible'
    : counts.unread > 0
      ? `${plural(counts.unread, 'message non lu', 'messages non lus')}`
      : 'Aucun message non lu'

  return (
    <div className="flex flex-col gap-5">
      <PageHeader title="Support" subtitle={subtitle} />

      <nav aria-label="Résumé du support" className="grid grid-cols-3 gap-3">
        <StatLink
          label="Non lus"
          value={counts.unread === null ? '—' : fmtInt(counts.unread)}
          href="/admin/support?status=new"
          active={statusFilter === 'new' && !typeFilter}
          tone={counts.unread ? 'warn' : 'default'}
        />
        <StatLink label="Problèmes" value={counts.bugs === null ? '—' : fmtInt(counts.bugs)} href="/admin/support?type=bug_report" active={typeFilter === 'bug_report' && !statusFilter} />
        <StatLink label="Messages" value={counts.contacts === null ? '—' : fmtInt(counts.contacts)} href="/admin/support?type=contact" active={typeFilter === 'contact' && !statusFilter} />
      </nav>

      <FilterBar resetHref="/admin/support" active={filtered} label="Filtrer les messages">
        <FilterSelect
          name="type"
          label="Type"
          defaultValue={typeFilter}
          options={[
            { value: '', label: 'Tous les types' },
            { value: 'bug_report', label: 'Problèmes signalés' },
            { value: 'contact', label: 'Messages de contact' },
          ]}
        />
        <FilterSelect
          name="status"
          label="Statut"
          defaultValue={statusFilter}
          options={[
            { value: '', label: 'Tous les statuts' },
            { value: 'new', label: 'Nouveaux' },
            { value: 'read', label: 'Lus' },
            { value: 'resolved', label: 'Résolus' },
          ]}
        />
      </FilterBar>

      {error ? (
        <LoadError what="les messages du support" />
      ) : messages.length === 0 ? (
        <div className="q-card">
          <EmptyState
            icon={<Inbox className="size-5" aria-hidden />}
            title={filtered ? 'Aucun message ne correspond' : 'Aucun message'}
            text={filtered ? 'Modifiez les filtres ou effacez-les.' : 'Les signalements et messages envoyés depuis l\'application arrivent ici.'}
          />
        </div>
      ) : (
        <ul className="flex flex-col gap-3" aria-label="Messages">
          {messages.map((msg) => (
            <li
              key={msg.id}
              className={cn('q-card overflow-hidden', msg.status === 'new' && '!border-[var(--q-warn-line)]')}
            >
              <div className="flex flex-wrap items-center gap-2 border-b border-[var(--q-line-soft)] px-4 py-3 sm:px-5">
                <TypePill type={msg.type} />
                <MessageStatus status={msg.status} />
                <span className="ml-auto text-xs text-[var(--q-text-4)]">{fmtDateTime(msg.created_at)}</span>
              </div>

              <div className="flex flex-col gap-2 px-4 py-3.5 sm:px-5">
                {msg.type === 'bug_report' ? (
                  <>
                    <p className="font-semibold text-[var(--q-ink)]">{msg.title || 'Sans titre'}</p>
                    <p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-[var(--q-text-2)]">{msg.description}</p>
                    {msg.page && (
                      <p className="break-all text-[13px] text-[var(--q-text-4)]">
                        Page : <span className="font-mono text-[var(--q-text-2)]">{msg.page}</span>
                      </p>
                    )}
                  </>
                ) : (
                  <>
                    <p className="flex flex-wrap items-center gap-x-3 gap-y-1">
                      <span className="font-semibold text-[var(--q-ink)]">{msg.name || 'Nom non renseigné'}</span>
                      {msg.email && (
                        <a href={`mailto:${msg.email}`} className="q-link inline-flex min-w-0 items-center gap-1 break-all text-[13px] !font-medium">
                          <Mail className="size-3.5 shrink-0" aria-hidden /> {msg.email}
                        </a>
                      )}
                    </p>
                    <p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-[var(--q-text-2)]">{msg.message}</p>
                  </>
                )}
              </div>

              <div className="border-t border-[var(--q-line-soft)] bg-[var(--q-surface-2)] px-4 py-2.5 sm:px-5">
                <SupportActions id={msg.id} currentStatus={msg.status} email={msg.email} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
