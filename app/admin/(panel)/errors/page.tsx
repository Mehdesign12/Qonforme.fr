import { createAdminClient } from '@/lib/supabase/server'
import { AlertTriangle, CheckCircle, Link as LinkIcon } from 'lucide-react'
import Link from 'next/link'
import { ErrorActions } from '@/components/admin/ErrorActions'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Admin — Erreurs système' }

const ERROR_TYPES = [
  'webhook_stripe',
  'payment_failed',
  'invoice_create',
  'invoice_send',
  'invoice_pdf',
  'auth_signup',
  'company_create',
  'subscription_check',
]

function TypeBadge({ type }: { type: string }) {
  const isRed    = type === 'webhook_stripe' || type === 'payment_failed'
  const isOrange = type.startsWith('invoice_')

  const className = isRed
    ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
    : isOrange
    ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400'
    : 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'

  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${className}`}>
      <AlertTriangle className="w-3 h-3" />
      {type}
    </span>
  )
}

interface SearchParams { type?: string; resolved?: string }

async function getErrors(typeFilter: string, resolvedFilter: string) {
  const admin = createAdminClient()

  let query = admin
    .from('error_logs')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(200)

  if (typeFilter)             query = query.eq('type', typeFilter)
  if (resolvedFilter === 'no')  query = query.is('resolved_at', null)
  if (resolvedFilter === 'yes') query = query.not('resolved_at', 'is', null)

  const { data } = await query
  return data ?? []
}

export default async function AdminErrorsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>
}) {
  const params         = await searchParams
  const typeFilter     = params.type ?? ''
  const resolvedFilter = params.resolved ?? ''

  const errors = await getErrors(typeFilter, resolvedFilter)

  const totalCount    = errors.length
  const unresolvedCount = errors.filter(e => !e.resolved_at).length
  const resolvedCount   = errors.filter(e => e.resolved_at).length

  return (
    <div className="space-y-5 max-w-[1100px] mx-auto">

      {/* Header */}
      <div>
        <h1 className="text-[22px] font-extrabold text-[#0F172A] dark:text-[#E2E8F0] leading-tight">
          Erreurs système
        </h1>
        <p className="text-[13px] text-slate-400 mt-0.5">
          {unresolvedCount > 0
            ? `${unresolvedCount} erreur(s) non résolue(s)`
            : 'Aucune erreur non résolue'}
        </p>
      </div>

      {/* Cartes stats */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Total',         count: totalCount,      href: '/admin/errors',              icon: '📋' },
          { label: 'Non résolues',  count: unresolvedCount, href: '/admin/errors?resolved=no',  icon: '🔴' },
          { label: 'Résolues',      count: resolvedCount,   href: '/admin/errors?resolved=yes', icon: '✅' },
        ].map(({ label, count, href, icon }) => (
          <a
            key={label}
            href={href}
            className="rounded-xl border border-slate-100 dark:border-[#1E3A5F] p-3 text-center bg-white/95 dark:bg-[#0F1E35] hover:border-[#2563EB] dark:hover:border-[#3B82F6] transition-colors"
          >
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
          {ERROR_TYPES.map(t => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>
        <select
          name="resolved"
          defaultValue={resolvedFilter}
          className="h-9 px-3 text-sm rounded-lg border border-border bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
        >
          <option value="">Toutes</option>
          <option value="no">Non résolues</option>
          <option value="yes">Résolues</option>
        </select>
        <button
          type="submit"
          className="h-9 px-4 text-sm font-medium rounded-lg bg-[#2563EB] text-white hover:bg-[#1d4ed8] transition-colors"
        >
          Filtrer
        </button>
        {(typeFilter || resolvedFilter) && (
          <a
            href="/admin/errors"
            className="h-9 px-4 text-sm font-medium rounded-lg border border-border text-foreground hover:bg-muted flex items-center transition-colors"
          >
            Effacer
          </a>
        )}
      </form>

      {/* Liste */}
      <div className="space-y-3">
        {errors.length === 0 ? (
          <div className="rounded-2xl border border-slate-100 dark:border-[#1E3A5F] bg-white/95 dark:bg-[#0F1E35] px-4 py-10 text-center">
            <CheckCircle className="w-8 h-8 mx-auto mb-2 text-green-500 opacity-60" />
            <p className="text-sm text-slate-400">Aucune erreur trouvée</p>
          </div>
        ) : errors.map((err) => (
          <div
            key={err.id}
            className={`rounded-2xl border bg-white/95 dark:bg-[#0F1E35] overflow-hidden transition-colors ${
              !err.resolved_at
                ? 'border-red-200 dark:border-red-900/50'
                : 'border-slate-100 dark:border-[#1E3A5F]'
            }`}
          >
            {/* Header card */}
            <div className="px-4 py-3 border-b border-slate-50 dark:border-[#1E3A5F] flex flex-wrap items-center gap-2">
              <TypeBadge type={err.type} />
              <span className="text-[11px] text-slate-400 ml-auto">
                {new Date(err.created_at).toLocaleDateString('fr-FR', {
                  day: 'numeric', month: 'short', year: 'numeric',
                  hour: '2-digit', minute: '2-digit',
                })}
              </span>
            </div>

            {/* Contenu */}
            <div className="px-4 py-3 space-y-2">
              <p className="font-semibold text-[#0F172A] dark:text-[#E2E8F0]">{err.message}</p>

              {err.user_id && (
                <p className="text-[12px] text-slate-400">
                  Utilisateur :{' '}
                  <Link
                    href={`/admin/users/${err.user_id}`}
                    className="inline-flex items-center gap-1 font-mono text-[#2563EB] hover:underline"
                  >
                    <LinkIcon className="w-3 h-3" />
                    {err.user_id}
                  </Link>
                </p>
              )}

              {err.context && (
                <pre className="mt-2 p-2 rounded-lg bg-slate-50 dark:bg-[#162032] text-[11px] font-mono text-slate-600 dark:text-slate-300 overflow-x-auto whitespace-pre-wrap break-all">
                  {JSON.stringify(err.context, null, 2)}
                </pre>
              )}
            </div>

            {/* Actions */}
            <div className="px-4 py-2 border-t border-slate-50 dark:border-[#1E3A5F] flex items-center gap-2">
              <ErrorActions id={err.id} resolvedAt={err.resolved_at} />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
