import { createAdminClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { Users } from 'lucide-react'
import { EmptyState, Initials, PageHeader, StatusPill } from '@/components/app/kit'
import { FilterBar, FilterSearch, FilterSelect, LoadError, SubscriptionPill, fmtDate, plural } from '@/components/admin/ui'
import AdminQuickPlanToggle from './AdminQuickPlanToggle'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Admin — Utilisateurs' }

interface SearchParams { q?: string; plan?: string; status?: string }

const LIMIT = 200
const INACTIVE_MS = 30 * 24 * 60 * 60 * 1000

/** Échappe les jokers de LIKE (% _ \) : « 50% » cherche « 50% ». */
function likePattern(term: string): string {
  return `%${term.replace(/[\\%_]/g, (c) => `\\${c}`)}%`
}

async function getUsers(search: string, planFilter: string, statusFilter: string) {
  const admin = createAdminClient()

  // Emails et dernières connexions via l'API Auth Admin (un seul appel)
  const { data: authUsersData, error: authError } = await admin.auth.admin.listUsers({ perPage: 1000 })
  const authUsers = authUsersData?.users ?? []
  const authMap = new Map(
    authUsers.map(u => [u.id, { email: u.email ?? '', lastSignIn: u.last_sign_in_at ?? null }])
  )

  // Entreprises (contiennent user_id + nom)
  let companiesQuery = admin
    .from('companies')
    .select('user_id, name, city, created_at')
    .order('created_at', { ascending: false })

  const byEmail = search.includes('@')
  if (search && byEmail) {
    // Recherche par email : l'email vit dans Auth, pas dans `companies`. Filtrer
    // d'abord les entreprises par nom (comme avant) ne trouvait jamais personne.
    if (authError) return { rows: [], error: 'auth' as const, authError: true, truncated: false }
    const needle = search.toLowerCase()
    const ids = authUsers.filter(u => (u.email ?? '').toLowerCase().includes(needle)).map(u => u.id)
    if (ids.length === 0) return { rows: [], error: null, authError: false, truncated: false }
    companiesQuery = companiesQuery.in('user_id', ids.slice(0, LIMIT))
  } else if (search) {
    companiesQuery = companiesQuery.ilike('name', likePattern(search))
  }

  const { data: companies, error: companiesError } = await companiesQuery.limit(LIMIT)
  if (companiesError) return { rows: [], error: 'companies' as const, authError: !!authError, truncated: false }
  if (!companies?.length) return { rows: [], error: null, authError: !!authError, truncated: false }

  // Abonnements de ces comptes
  const userIds = companies.map(c => c.user_id)
  const { data: subs, error: subsError } = await admin
    .from('subscriptions')
    .select('user_id, plan, status, billing_period, current_period_end')
    .in('user_id', userIds)
  if (subsError) return { rows: [], error: 'subscriptions' as const, authError: !!authError, truncated: false }

  const subMap = new Map((subs ?? []).map(s => [s.user_id, s]))

  let rows = companies.map(c => {
    const sub  = subMap.get(c.user_id)
    const auth = authMap.get(c.user_id)
    return {
      user_id:  c.user_id,
      name:     c.name || 'Entreprise sans nom',
      email:    auth?.email ?? '',
      lastSignIn: auth?.lastSignIn ?? null,
      city:     c.city || '',
      created_at: c.created_at,
      plan:     sub?.plan ?? 'none',
      subStatus: sub?.status ?? 'none',
      billing_period: sub?.billing_period ?? null,
      period_end: sub?.current_period_end ?? null,
    }
  })

  // Filtres post-requête
  if (planFilter)   rows = rows.filter(r => r.plan === planFilter)
  if (statusFilter) rows = rows.filter(r => r.subStatus === statusFilter)

  return { rows, error: null, authError: !!authError, truncated: companies.length === LIMIT }
}

function isInactive(lastSignIn: string | null): boolean {
  return !!lastSignIn && Date.now() - new Date(lastSignIn).getTime() > INACTIVE_MS
}

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>
}) {
  const params = await searchParams
  const q      = (params.q ?? '').trim()
  const plan   = params.plan ?? ''
  const status = params.status ?? ''
  const filtered = !!(q || plan || status)

  const { rows: users, error, authError, truncated } = await getUsers(q, plan, status)

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Utilisateurs"
        subtitle={error ? 'Lecture impossible' : `${plural(users.length, 'compte')}${filtered ? ' correspondant aux filtres' : ''}${truncated ? ` (les ${LIMIT} plus récents)` : ''}`}
      />

      <FilterBar resetHref="/admin/users" active={filtered} label="Filtrer les utilisateurs">
        <FilterSearch defaultValue={q} placeholder="Nom d'entreprise ou email…" label="Rechercher un utilisateur" />
        <FilterSelect
          name="plan"
          label="Formule"
          defaultValue={plan}
          options={[
            { value: '', label: 'Toutes les formules' },
            { value: 'starter', label: 'Essentiel' },
            { value: 'pro', label: 'Artisan' },
            { value: 'none', label: 'Sans formule' },
          ]}
        />
        <FilterSelect
          name="status"
          label="Statut de l'abonnement"
          defaultValue={status}
          options={[
            { value: '', label: 'Tous les statuts' },
            { value: 'active', label: 'Actif' },
            { value: 'past_due', label: 'Paiement en retard' },
            { value: 'canceled', label: 'Résilié' },
            { value: 'incomplete', label: 'Paiement incomplet' },
            { value: 'none', label: 'Sans abonnement' },
          ]}
        />
      </FilterBar>

      {authError && !error && (
        <p role="status" className="q-banner q-banner-warn">
          Emails et dernières connexions indisponibles : l&apos;API d&apos;authentification n&apos;a pas répondu.
        </p>
      )}

      {error ? (
        <LoadError what={error === 'auth' ? 'les emails des comptes' : error === 'subscriptions' ? 'les abonnements' : 'les comptes'} />
      ) : users.length === 0 ? (
        <div className="q-card">
          <EmptyState
            icon={<Users className="size-5" aria-hidden />}
            title={filtered ? 'Aucun compte ne correspond' : 'Aucun compte pour l\'instant'}
            text={filtered ? 'Modifiez la recherche ou effacez les filtres.' : 'Les entreprises inscrites apparaîtront ici.'}
          />
        </div>
      ) : (
        <>
          {/* Tableau (ordinateur) */}
          <section aria-label="Liste des utilisateurs" className="q-card hidden overflow-hidden md:block">
            <div className="overflow-x-auto">
              <table className="q-table min-w-[820px] [&_th]:border-t-0">
                <thead>
                  <tr className="bg-[var(--q-surface-2)]">
                    <th scope="col">Compte</th>
                    <th scope="col">Formule</th>
                    <th scope="col">Abonnement</th>
                    <th scope="col">Inscription</th>
                    <th scope="col">Dernière connexion</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((u) => (
                    <tr key={u.user_id}>
                      <td className="!py-2.5">
                        <Link href={`/admin/users/${u.user_id}`} className="group flex min-w-[220px] max-w-[300px] items-center gap-3 text-[var(--q-ink)]">
                          <Initials name={u.name} className="!size-9 !rounded-[10px]" />
                          <span className="flex min-w-0 flex-col gap-px">
                            <span className="line-clamp-2 font-semibold group-hover:text-[var(--q-accent-strong)]">{u.name}</span>
                            <span className="truncate text-xs text-[var(--q-text-3)]" title={u.email || undefined}>{u.email || 'Email indisponible'}</span>
                            {u.city && <span className="truncate text-xs text-[var(--q-text-4)]">{u.city}</span>}
                          </span>
                        </Link>
                      </td>
                      <td className="!py-2.5">
                        {u.plan === 'starter' || u.plan === 'pro' ? (
                          <AdminQuickPlanToggle userId={u.user_id} currentPlan={u.plan} billingPeriod={u.billing_period} accountName={u.name} />
                        ) : (
                          <span className="text-[var(--q-placeholder)]">—</span>
                        )}
                      </td>
                      <td className="!py-2.5"><SubscriptionPill status={u.subStatus} /></td>
                      <td className="!py-2.5 whitespace-nowrap text-[13px] text-[var(--q-text-3)]">{fmtDate(u.created_at)}</td>
                      <td className="!py-2.5 whitespace-nowrap text-[13px] text-[var(--q-text-3)]">
                        <span className="flex flex-col items-start gap-1">
                          {fmtDate(u.lastSignIn)}
                          {isInactive(u.lastSignIn) && (
                            <StatusPill tone="warn" className="!h-5 !text-[11px]">
                              Inactif<span className="sr-only"> depuis plus de 30 jours</span>
                            </StatusPill>
                          )}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {/* Liste (mobile) — le changement de formule se fait depuis la fiche */}
          <section aria-label="Liste des utilisateurs" className="q-card q-list overflow-hidden !rounded-[18px] md:hidden">
            {users.map((u) => (
              <Link key={u.user_id} href={`/admin/users/${u.user_id}`} className="q-list-row !gap-3 !px-3.5 !py-2.5">
                <Initials name={u.name} className="!size-10 !rounded-xl !text-[13px]" />
                <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="truncate text-[15px] font-semibold">{u.name}</span>
                  <span className="truncate text-[13px] text-[var(--q-text-4)]">{u.email || u.city || 'Inscrit le ' + fmtDate(u.created_at)}</span>
                </span>
                <SubscriptionPill status={u.subStatus} className="shrink-0" />
              </Link>
            ))}
          </section>
        </>
      )}
    </div>
  )
}
