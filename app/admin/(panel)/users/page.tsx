import { createAdminClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { Users } from 'lucide-react'
import { EmptyState, Initials, PageHeader, StatusPill } from '@/components/app/kit'
import { FilterBar, FilterSearch, FilterSelect, LoadError, SubscriptionPill, fmtDate, plural } from '@/components/admin/ui'
import AdminQuickPlanToggle from './AdminQuickPlanToggle'
import { CreateUserButton } from '@/components/admin/users/PlanAdmin'
import { isGranted } from '@/lib/admin/grant'
import { ProgressCell } from '@/components/admin/ProgressCell'
import { computeProgress, type Progress, type ProgressStatus } from '@/lib/admin/onboarding-progress'
import { fetchProgressCounts } from '@/lib/admin/progress-data'
import { loadLastEmails, type AccountEmailRow } from '@/lib/admin/account-emails'
import { LastEmailCell, emailFailed } from '@/components/admin/emails/LastEmailCell'
import { fmtWhen } from '@/components/admin/emails/track'
import { QuickEmailButton } from '@/components/admin/emails/QuickEmailButton'
import { templateLabel } from '@/lib/email/account-templates'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Admin — Utilisateurs' }

interface SearchParams { q?: string; plan?: string; status?: string; parcours?: string; emails?: string }

const PROGRESS_FILTERS: ProgressStatus[] = ['needs_help', 'in_progress', 'complete']

const LIMIT = 200
const INACTIVE_MS = 30 * 24 * 60 * 60 * 1000
const STALE_EMAIL_MS = 3 * 24 * 60 * 60 * 1000

/** Échappe les jokers de LIKE (% _ \) : « 50% » cherche « 50% ». */
function likePattern(term: string): string {
  return `%${term.replace(/[\\%_]/g, (c) => `\\${c}`)}%`
}

async function getUsers(search: string, planFilter: string, statusFilter: string, progressFilter: string, emailFilter: string) {
  const admin = createAdminClient()

  // Emails et dernières connexions via l'API Auth Admin (un seul appel)
  const { data: authUsersData, error: authError } = await admin.auth.admin.listUsers({ perPage: 1000 })
  const authUsers = authUsersData?.users ?? []
  const authMap = new Map(
    authUsers.map(u => [u.id, { email: u.email ?? '', lastSignIn: u.last_sign_in_at ?? null, createdAt: u.created_at ?? null }])
  )

  // Entreprises (contiennent user_id + nom)
  let companiesQuery = admin
    .from('companies')
    .select('user_id, name, city, created_at, siren')
    .order('created_at', { ascending: false })

  const byEmail = search.includes('@')
  if (search && byEmail) {
    // Recherche par email : l'email vit dans Auth, pas dans `companies`. Filtrer
    // d'abord les entreprises par nom (comme avant) ne trouvait jamais personne.
    if (authError) return { rows: [], error: 'auth' as const, authError: true, truncated: false, progressError: false }
    const needle = search.toLowerCase()
    const ids = authUsers.filter(u => (u.email ?? '').toLowerCase().includes(needle)).map(u => u.id)
    if (ids.length === 0) return { rows: [], error: null, authError: false, truncated: false, progressError: false }
    companiesQuery = companiesQuery.in('user_id', ids.slice(0, LIMIT))
  } else if (search) {
    companiesQuery = companiesQuery.ilike('name', likePattern(search))
  }

  const { data: companyRows, error: companiesError } = await companiesQuery.limit(LIMIT)
  if (companiesError) return { rows: [], error: 'companies' as const, authError: !!authError, truncated: false, progressError: false }

  // Comptes sans entreprise (inscription pas terminée, compte créé depuis l'admin) : listés aussi,
  // sauf pour une recherche par nom d'entreprise (ils n'en ont pas)
  type CompanyRow = { user_id: string; name: string | null; city: string | null; created_at: string; siren: string | null }
  let companies = (companyRows ?? []) as CompanyRow[]
  if (!authError && !(search && !byEmail)) {
    const { data: owners, error: ownersError } = await admin.from('companies').select('user_id').limit(10_000)
    if (!ownersError) {
      const withCompany = new Set((owners ?? []).map(o => o.user_id as string))
      const needle = search.toLowerCase()
      const orphans: CompanyRow[] = authUsers
        .filter(u => !withCompany.has(u.id) && (!byEmail || (u.email ?? '').toLowerCase().includes(needle)))
        .map(u => ({ user_id: u.id, name: null, city: null, created_at: u.created_at ?? new Date(0).toISOString(), siren: null }))
      companies = [...companies, ...orphans]
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        .slice(0, LIMIT)
    }
  }
  if (!companies.length) return { rows: [], error: null, authError: !!authError, truncated: false, progressError: false }

  // Abonnements de ces comptes
  const userIds = companies.map(c => c.user_id)
  const { data: subs, error: subsError } = await admin
    .from('subscriptions')
    .select('*')
    .in('user_id', userIds)
  if (subsError) return { rows: [], error: 'subscriptions' as const, authError: !!authError, truncated: false, progressError: false }

  const subMap = new Map((subs ?? []).map(s => [s.user_id, s]))
  const companyNames = new Set((companyRows ?? []).map(c => c.user_id as string))

  // Parcours (SIREN, devis, factures) : lu en base, sans cookie. Une lecture en échec n'est jamais lue « zéro ».
  const sirenByUser = new Map(companies.map(c => [c.user_id, (c as { siren?: string | null }).siren ?? null]))
  const [counts, lastEmails] = await Promise.all([
    fetchProgressCounts(admin, userIds, sirenByUser),
    loadLastEmails(admin, userIds),
  ])

  let rows = companies.map(c => {
    const sub  = subMap.get(c.user_id)
    const auth = authMap.get(c.user_id)
    return {
      user_id:  c.user_id,
      name:     c.name || (companyNames.has(c.user_id) ? 'Entreprise sans nom' : 'Entreprise non renseignée'),
      email:    auth?.email ?? '',
      lastSignIn: auth?.lastSignIn ?? null,
      city:     c.city || '',
      created_at: c.created_at,
      plan:     sub?.plan ?? 'none',
      subStatus: sub?.status ?? 'none',
      billing_period: sub?.billing_period ?? null,
      period_end: sub?.current_period_end ?? null,
      granted: isGranted(sub),
      progress: (counts && counts.get(c.user_id)
        ? computeProgress(counts.get(c.user_id)!, auth?.createdAt ?? c.created_at)
        : null) as Progress | null,
      lastEmail: (lastEmails ? lastEmails.get(String(c.user_id).toLowerCase()) ?? null : undefined) as AccountEmailRow | null | undefined,
    }
  })

  // Filtres post-requête
  if (planFilter)   rows = rows.filter(r => r.plan === planFilter)
  if (statusFilter) rows = rows.filter(r => r.subStatus === statusFilter)
  // Sans lecture du parcours, le filtre ne peut rien dire : il est ignoré et l'écran le signale
  if (progressFilter && counts) rows = rows.filter(r => r.progress?.status === progressFilter)
  // Bloqués sans email depuis 3 jours : à relancer à la main
  if (emailFilter === 'stale' && counts && lastEmails) {
    rows = rows.filter(r => r.progress?.status === 'needs_help' && (!r.lastEmail || Date.now() - new Date(r.lastEmail.sent_at).getTime() > STALE_EMAIL_MS))
  }

  return { rows, error: null, authError: !!authError, truncated: companies.length === LIMIT, progressError: !counts }
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
  const parcours = PROGRESS_FILTERS.includes(params.parcours as ProgressStatus) ? (params.parcours as string) : ''
  const emails = params.emails === 'stale' ? 'stale' : ''
  const filtered = !!(q || plan || status || parcours || emails)

  const { rows: users, error, authError, truncated, progressError } = await getUsers(q, plan, status, parcours, emails)

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Utilisateurs"
        subtitle={error ? 'Lecture impossible' : `${plural(users.length, 'compte')}${filtered ? ' correspondant aux filtres' : ''}${truncated ? ` (les ${LIMIT} plus récents)` : ''}`}
        actions={<CreateUserButton />}
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
        <FilterSelect
          name="parcours"
          label="Parcours d'inscription"
          defaultValue={parcours}
          options={[
            { value: '', label: 'Tous les parcours' },
            { value: 'needs_help', label: 'Bloqués avant le premier devis' },
            { value: 'in_progress', label: 'En cours' },
            { value: 'complete', label: 'Première facture envoyée' },
          ]}
        />
        <FilterSelect
          name="emails"
          label="Emails"
          defaultValue={emails}
          options={[
            { value: '', label: 'Tous les emails' },
            { value: 'stale', label: 'Bloqués sans email depuis 3 jours' },
          ]}
        />
      </FilterBar>

      {progressError && !error && (
        <p role="status" className="q-banner q-banner-warn">
          Parcours indisponibles : la lecture des devis et des factures n&apos;a pas abouti (le filtre de parcours est ignoré).
        </p>
      )}

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
              <table className="q-table min-w-[1180px] [&_th]:border-t-0">
                <thead>
                  <tr className="bg-[var(--q-surface-2)]">
                    <th scope="col">Compte</th>
                    <th scope="col">Formule</th>
                    <th scope="col">Abonnement</th>
                    <th scope="col">Parcours</th>
                    <th scope="col">Dernier email</th>
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
                          <span className="inline-flex flex-col items-start gap-1">
                            <AdminQuickPlanToggle userId={u.user_id} currentPlan={u.plan} billingPeriod={u.billing_period} accountName={u.name} />
                            {u.granted && <StatusPill tone="neutral" className="!h-5 !text-[11px]">Offerte</StatusPill>}
                          </span>
                        ) : (
                          <span className="text-[var(--q-placeholder)]">—</span>
                        )}
                      </td>
                      <td className="!py-2.5"><SubscriptionPill status={u.subStatus} /></td>
                      <td className="!py-2.5"><ProgressCell progress={u.progress} /></td>
                      <td className="!py-2.5">
                        <span className="flex flex-col items-start gap-2">
                          <LastEmailCell email={u.lastEmail} />
                          {u.progress && u.email && (
                            <QuickEmailButton userId={u.user_id} accountLabel={u.name} done={u.progress.done} lastTemplate={u.lastEmail?.template ?? null} className="!h-7 !text-xs" />
                          )}
                        </span>
                      </td>
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
              <div key={u.user_id} className="flex flex-col">
              <Link href={`/admin/users/${u.user_id}`} className="q-list-row !gap-3 !px-3.5 !py-2.5">
                <Initials name={u.name} className="!size-10 !rounded-xl !text-[13px]" />
                <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="truncate text-[15px] font-semibold">{u.name}</span>
                  <span className="truncate text-[13px] text-[var(--q-text-4)]">{u.email || u.city || 'Inscrit le ' + fmtDate(u.created_at)}</span>
                  {u.progress && (
                    <span className={u.progress.status === 'needs_help' ? 'truncate text-xs font-semibold text-[var(--q-warn)]' : 'truncate text-xs text-[var(--q-text-3)]'}>
                      {u.progress.status === 'complete'
                        ? 'Facture envoyée'
                        : u.progress.status === 'needs_help'
                          ? `Bloqué : ${u.progress.stuckAt}`
                          : `Parcours ${u.progress.completed}/${u.progress.total}`}
                    </span>
                  )}
                  {u.lastEmail && (
                    <span className={emailFailed(u.lastEmail) ? 'truncate text-xs font-semibold text-[var(--q-danger)]' : 'truncate text-xs font-semibold text-[var(--q-ok)]'}>
                      {emailFailed(u.lastEmail) ? 'Email non remis' : '✓ Email envoyé'} · {fmtWhen(u.lastEmail.sent_at)} · {templateLabel(u.lastEmail.template)}
                    </span>
                  )}
                </span>
                <SubscriptionPill status={u.subStatus} className="shrink-0" />
              </Link>
              {u.progress && u.email && (
                <div className="px-3.5 pb-2.5 pl-[66px]">
                  <QuickEmailButton userId={u.user_id} accountLabel={u.name} done={u.progress.done} lastTemplate={u.lastEmail?.template ?? null} className="!h-8 !text-xs" />
                </div>
              )}
              </div>
            ))}
          </section>
        </>
      )}
    </div>
  )
}
