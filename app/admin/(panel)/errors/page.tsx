import { createAdminClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { CircleCheck, TriangleAlert } from 'lucide-react'
import { EmptyState, PageHeader, StatusPill, type Tone } from '@/components/app/kit'
import { FilterBar, FilterSelect, LoadError, StatLink, fmtDateTime, fmtInt, plural } from '@/components/admin/ui'
import { ErrorActions } from '@/components/admin/ErrorActions'
import { cn } from '@/lib/utils'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Admin — Erreurs système' }

/** Types enregistrés par lib/logError.ts, avec un libellé lisible. */
const ERROR_TYPES: Record<string, string> = {
  webhook_stripe:     'Webhook Stripe',
  payment_failed:     'Paiement échoué',
  invoice_create:     'Création de facture',
  invoice_send:       'Envoi de facture',
  invoice_pdf:        'PDF de facture',
  auth_signup:        'Inscription',
  company_create:     'Création d\'entreprise',
  subscription_check: 'Vérification d\'abonnement',
}

function TypePill({ type }: { type: string }) {
  const tone: Tone = type === 'webhook_stripe' || type === 'payment_failed' ? 'danger' : type.startsWith('invoice_') ? 'warn' : 'info'
  return (
    <StatusPill tone={tone} icon={<TriangleAlert strokeWidth={2.25} aria-hidden />}>
      {ERROR_TYPES[type] ?? type}
    </StatusPill>
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

  const { data, error } = await query
  return { errors: data ?? [], failed: !!error }
}

/** Compteurs sur toute la table (et non sur la liste filtrée). */
async function getCounts() {
  const admin = createAdminClient()
  const head = () => admin.from('error_logs').select('id', { count: 'exact', head: true })
  const [all, unresolved, resolved] = await Promise.all([
    head(),
    head().is('resolved_at', null),
    head().not('resolved_at', 'is', null),
  ])
  const n = (r: { count: number | null; error: unknown }) => (r.error ? null : r.count ?? 0)
  return { all: n(all), unresolved: n(unresolved), resolved: n(resolved) }
}

export default async function AdminErrorsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>
}) {
  const params         = await searchParams
  const typeFilter     = params.type ?? ''
  const resolvedFilter = params.resolved ?? ''
  const filtered       = !!(typeFilter || resolvedFilter)

  const [{ errors, failed }, counts] = await Promise.all([
    getErrors(typeFilter, resolvedFilter),
    getCounts(),
  ])

  const subtitle = counts.unresolved === null
    ? 'Compteur indisponible'
    : counts.unresolved > 0
      ? plural(counts.unresolved, 'erreur non résolue', 'erreurs non résolues')
      : 'Aucune erreur non résolue'

  return (
    <div className="flex flex-col gap-5">
      <PageHeader title="Erreurs système" subtitle={subtitle} />

      <nav aria-label="Résumé des erreurs" className="grid grid-cols-3 gap-3">
        <StatLink label="Toutes" value={counts.all === null ? '—' : fmtInt(counts.all)} href="/admin/errors" active={!filtered} />
        <StatLink
          label="Non résolues"
          value={counts.unresolved === null ? '—' : fmtInt(counts.unresolved)}
          href="/admin/errors?resolved=no"
          active={resolvedFilter === 'no' && !typeFilter}
          tone={counts.unresolved ? 'danger' : 'default'}
        />
        <StatLink label="Résolues" value={counts.resolved === null ? '—' : fmtInt(counts.resolved)} href="/admin/errors?resolved=yes" active={resolvedFilter === 'yes' && !typeFilter} />
      </nav>

      <FilterBar resetHref="/admin/errors" active={filtered} label="Filtrer les erreurs">
        <FilterSelect
          name="type"
          label="Type d'erreur"
          defaultValue={typeFilter}
          options={[{ value: '', label: 'Tous les types' }, ...Object.entries(ERROR_TYPES).map(([value, label]) => ({ value, label }))]}
        />
        <FilterSelect
          name="resolved"
          label="État"
          defaultValue={resolvedFilter}
          options={[
            { value: '', label: 'Toutes' },
            { value: 'no', label: 'Non résolues' },
            { value: 'yes', label: 'Résolues' },
          ]}
        />
      </FilterBar>

      {failed ? (
        <LoadError what="le journal des erreurs" />
      ) : errors.length === 0 ? (
        <div className="q-card">
          <EmptyState
            icon={<CircleCheck className="size-5" aria-hidden />}
            title={filtered ? 'Aucune erreur ne correspond' : 'Aucune erreur enregistrée'}
            text={filtered ? 'Modifiez les filtres ou effacez-les.' : 'Les erreurs métier enregistrées par l\'application apparaîtront ici.'}
          />
        </div>
      ) : (
        <ul className="flex flex-col gap-3" aria-label="Erreurs">
          {errors.map((err) => (
            <li key={err.id} className={cn('q-card overflow-hidden', !err.resolved_at && '!border-[var(--q-danger-line)]')}>
              <div className="flex flex-wrap items-center gap-2 border-b border-[var(--q-line-soft)] px-4 py-3 sm:px-5">
                <TypePill type={err.type} />
                <span className="ml-auto text-xs text-[var(--q-text-4)]">{fmtDateTime(err.created_at)}</span>
              </div>

              <div className="flex flex-col gap-2 px-4 py-3.5 sm:px-5">
                <p className="break-words font-semibold text-[var(--q-ink)]">{err.message}</p>
                {err.user_id && (
                  <p className="text-[13px] text-[var(--q-text-4)]">
                    Compte :{' '}
                    <Link href={`/admin/users/${err.user_id}`} className="q-link break-all font-mono !font-medium">{err.user_id}</Link>
                  </p>
                )}
                {err.context && (
                  <pre className="max-h-64 overflow-auto whitespace-pre-wrap break-all rounded-xl border border-[var(--q-line)] bg-[var(--q-surface-2)] p-3 font-mono text-xs leading-relaxed text-[var(--q-text-2)]">
                    {JSON.stringify(err.context, null, 2)}
                  </pre>
                )}
              </div>

              <div className="border-t border-[var(--q-line-soft)] bg-[var(--q-surface-2)] px-4 py-2.5 sm:px-5">
                <ErrorActions id={err.id} resolvedAt={err.resolved_at} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
