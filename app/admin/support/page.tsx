import { createAdminClient } from '@/lib/supabase/server'
import { Bug, MessageSquare, CheckCircle, Mail } from 'lucide-react'
import { SupportActions } from '@/components/admin/SupportActions'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Admin — Support' }

function TypeBadge({ type }: { type: string }) {
  if (type === 'bug_report') return (
    <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400">
      <Bug className="w-3 h-3" /> Bug
    </span>
  )
  return (
    <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
      <MessageSquare className="w-3 h-3" /> Contact
    </span>
  )
}

function StatusPill({ status }: { status: string }) {
  const map: Record<string, { label: string; className: string }> = {
    new:      { label: 'Nouveau',  className: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400' },
    read:     { label: 'Lu',       className: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400' },
    resolved: { label: 'Résolu',   className: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' },
  }
  const s = map[status] ?? { label: status, className: 'bg-slate-100 text-slate-600' }
  return <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ${s.className}`}>{s.label}</span>
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

  const { data } = await query.limit(200)
  return data ?? []
}

export default async function AdminSupportPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>
}) {
  const params       = await searchParams
  const typeFilter   = params.type ?? ''
  const statusFilter = params.status ?? ''

  const messages = await getMessages(typeFilter, statusFilter)

  const newCount      = messages.filter(m => m.status === 'new').length
  const bugCount      = messages.filter(m => m.type === 'bug_report').length
  const contactCount  = messages.filter(m => m.type === 'contact').length

  return (
    <div className="space-y-5 max-w-[1100px] mx-auto">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[22px] font-extrabold text-[#0F172A] dark:text-[#E2E8F0] leading-tight">Support</h1>
          <p className="text-[13px] text-slate-400 mt-0.5">
            {newCount > 0 ? `${newCount} message(s) non lu(s)` : 'Aucun nouveau message'}
          </p>
        </div>
      </div>

      {/* Résumé */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Non lus',  count: messages.filter(m => m.status === 'new').length,      href: '/admin/support?status=new',            icon: '🔴' },
          { label: 'Bug reports', count: bugCount,    href: '/admin/support?type=bug_report',   icon: '🐛' },
          { label: 'Contact',  count: contactCount,   href: '/admin/support?type=contact',       icon: '✉️' },
        ].map(({ label, count, href, icon }) => (
          <a key={label} href={href} className="rounded-xl border border-slate-100 dark:border-[#1E3A5F] p-3 text-center bg-white/95 dark:bg-[#0F1E35] hover:border-[#2563EB] dark:hover:border-[#3B82F6] transition-colors">
            <p className="text-lg">{icon}</p>
            <p className="font-mono text-2xl font-extrabold text-[#0F172A] dark:text-[#E2E8F0]">{count}</p>
            <p className="text-[11px] text-slate-400 mt-0.5">{label}</p>
          </a>
        ))}
      </div>

      {/* Filtres */}
      <form method="GET" className="flex flex-wrap gap-2">
        <select
          name="type"
          defaultValue={typeFilter}
          className="h-9 px-3 text-sm rounded-lg border border-border bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
        >
          <option value="">Tous les types</option>
          <option value="bug_report">Bug reports</option>
          <option value="contact">Messages de contact</option>
        </select>
        <select
          name="status"
          defaultValue={statusFilter}
          className="h-9 px-3 text-sm rounded-lg border border-border bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
        >
          <option value="">Tous les statuts</option>
          <option value="new">Nouveaux</option>
          <option value="read">Lus</option>
          <option value="resolved">Résolus</option>
        </select>
        <button type="submit" className="h-9 px-4 text-sm font-medium rounded-lg bg-[#2563EB] text-white hover:bg-[#1d4ed8] transition-colors">
          Filtrer
        </button>
        {(typeFilter || statusFilter) && (
          <a href="/admin/support" className="h-9 px-4 text-sm font-medium rounded-lg border border-border text-foreground hover:bg-muted flex items-center transition-colors">
            Effacer
          </a>
        )}
      </form>

      {/* Liste */}
      <div className="space-y-3">
        {messages.length === 0 ? (
          <div className="rounded-2xl border border-slate-100 dark:border-[#1E3A5F] bg-white/95 dark:bg-[#0F1E35] px-4 py-10 text-center">
            <CheckCircle className="w-8 h-8 mx-auto mb-2 text-green-500 opacity-60" />
            <p className="text-sm text-slate-400">Aucun message trouvé</p>
          </div>
        ) : messages.map((msg) => (
          <div
            key={msg.id}
            className={`rounded-2xl border bg-white/95 dark:bg-[#0F1E35] overflow-hidden transition-colors ${
              msg.status === 'new'
                ? 'border-yellow-200 dark:border-yellow-800/50'
                : 'border-slate-100 dark:border-[#1E3A5F]'
            }`}
          >
            {/* Header */}
            <div className="px-4 py-3 border-b border-slate-50 dark:border-[#1E3A5F] flex flex-wrap items-center gap-2">
              <TypeBadge type={msg.type} />
              <StatusPill status={msg.status} />
              <span className="text-[11px] text-slate-400 ml-auto">
                {new Date(msg.created_at).toLocaleDateString('fr-FR', {
                  day: 'numeric', month: 'short', year: 'numeric',
                  hour: '2-digit', minute: '2-digit',
                })}
              </span>
            </div>

            {/* Contenu */}
            <div className="px-4 py-3 space-y-2">
              {msg.type === 'bug_report' ? (
                <>
                  <p className="font-semibold text-foreground">{msg.title || '(Sans titre)'}</p>
                  <p className="text-sm text-slate-600 dark:text-slate-300 whitespace-pre-wrap">{msg.description}</p>
                  {msg.page && (
                    <p className="text-[12px] text-slate-400">
                      Page : <span className="font-mono text-foreground">{msg.page}</span>
                    </p>
                  )}
                </>
              ) : (
                <>
                  <div className="flex items-center gap-2">
                    <p className="font-semibold text-foreground">{msg.name}</p>
                    {msg.email && (
                      <a
                        href={`mailto:${msg.email}`}
                        className="inline-flex items-center gap-1 text-[12px] text-[#2563EB] hover:underline"
                      >
                        <Mail className="w-3 h-3" /> {msg.email}
                      </a>
                    )}
                  </div>
                  <p className="text-sm text-slate-600 dark:text-slate-300 whitespace-pre-wrap">{msg.message}</p>
                </>
              )}
            </div>

            {/* Actions */}
            <div className="px-4 py-2 border-t border-slate-50 dark:border-[#1E3A5F] flex items-center gap-2">
              <SupportActions id={msg.id} currentStatus={msg.status} email={msg.email} />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
