import { createAdminClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { Users, Search } from 'lucide-react'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Admin — Utilisateurs' }

function StatusPill({ status }: { status: string }) {
  const map: Record<string, { label: string; className: string }> = {
    active:     { label: 'Actif',     className: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' },
    past_due:   { label: 'Retard',    className: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400' },
    canceled:   { label: 'Annulé',    className: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' },
    incomplete: { label: 'Incomplet', className: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400' },
    trialing:   { label: 'Essai',     className: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' },
    none:       { label: 'Sans plan', className: 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-500' },
  }
  const s = map[status] ?? map.none
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ${s.className}`}>
      {s.label}
    </span>
  )
}

interface SearchParams { q?: string; plan?: string; status?: string }

async function getUsers(search: string, planFilter: string, statusFilter: string) {
  const admin = createAdminClient()

  // Récupérer toutes les entreprises (contient user_id + nom)
  let companiesQuery = admin
    .from('companies')
    .select('user_id, name, city, created_at')
    .order('created_at', { ascending: false })

  if (search) {
    companiesQuery = companiesQuery.ilike('name', `%${search}%`)
  }

  const { data: companies } = await companiesQuery.limit(200)

  if (!companies?.length) return []

  // Récupérer les abonnements pour ces users
  const userIds = companies.map(c => c.user_id)
  const { data: subs } = await admin
    .from('subscriptions')
    .select('user_id, plan, status, billing_period, current_period_end')
    .in('user_id', userIds)

  // Récupérer les emails via auth admin (batch)
  const { data: authUsersData } = await admin.auth.admin.listUsers({ perPage: 1000 })
  const authMap = new Map(
    (authUsersData?.users ?? []).map(u => [u.id, u.email])
  )

  const subMap = new Map((subs ?? []).map(s => [s.user_id, s]))

  let rows = companies.map(c => {
    const sub  = subMap.get(c.user_id)
    const email = authMap.get(c.user_id) ?? ''
    return {
      user_id:  c.user_id,
      name:     c.name || '—',
      email,
      city:     c.city || '—',
      created_at: c.created_at,
      plan:     sub?.plan ?? 'none',
      subStatus: sub?.status ?? 'none',
      billing_period: sub?.billing_period ?? null,
      period_end: sub?.current_period_end ?? null,
    }
  })

  // Filtres post-requête
  if (search && !companies.length) return []
  if (planFilter)   rows = rows.filter(r => r.plan === planFilter)
  if (statusFilter) rows = rows.filter(r => r.subStatus === statusFilter)

  // Si recherche par email
  if (search && search.includes('@')) {
    rows = rows.filter(r => r.email.toLowerCase().includes(search.toLowerCase()))
  }

  return rows
}

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>
}) {
  const params = await searchParams
  const q      = params.q ?? ''
  const plan   = params.plan ?? ''
  const status = params.status ?? ''

  const users = await getUsers(q, plan, status)

  return (
    <div className="space-y-5 max-w-[1200px] mx-auto">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[22px] font-extrabold text-[#0F172A] dark:text-[#E2E8F0] leading-tight">
            Utilisateurs
          </h1>
          <p className="text-[13px] text-slate-400 mt-0.5">{users.length} résultat(s)</p>
        </div>
      </div>

      {/* Filtres */}
      <form method="GET" className="flex flex-wrap gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            name="q"
            defaultValue={q}
            placeholder="Rechercher par nom ou email…"
            className="w-full h-9 pl-9 pr-3 text-sm rounded-lg border border-border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
        <select
          name="plan"
          defaultValue={plan}
          className="h-9 px-3 text-sm rounded-lg border border-border bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
        >
          <option value="">Tous les plans</option>
          <option value="starter">Starter</option>
          <option value="pro">Pro</option>
          <option value="none">Sans plan</option>
        </select>
        <select
          name="status"
          defaultValue={status}
          className="h-9 px-3 text-sm rounded-lg border border-border bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
        >
          <option value="">Tous les statuts</option>
          <option value="active">Actif</option>
          <option value="past_due">En retard</option>
          <option value="canceled">Annulé</option>
          <option value="none">Sans abonnement</option>
        </select>
        <button
          type="submit"
          className="h-9 px-4 text-sm font-medium rounded-lg bg-[#2563EB] text-white hover:bg-[#1d4ed8] transition-colors"
        >
          Filtrer
        </button>
        {(q || plan || status) && (
          <a href="/admin/users" className="h-9 px-4 text-sm font-medium rounded-lg border border-border text-foreground hover:bg-muted flex items-center transition-colors">
            Effacer
          </a>
        )}
      </form>

      {/* Table */}
      <div className="rounded-2xl border border-slate-100 dark:border-[#1E3A5F] bg-white/95 dark:bg-[#0F1E35] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 dark:border-[#1E3A5F] bg-slate-50/80 dark:bg-[#162032]/60">
                <th className="text-left px-4 py-3 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Entreprise</th>
                <th className="text-left px-4 py-3 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Email</th>
                <th className="text-left px-4 py-3 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Plan</th>
                <th className="text-left px-4 py-3 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Statut</th>
                <th className="text-left px-4 py-3 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Inscription</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50 dark:divide-[#1E3A5F]">
              {users.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-sm text-slate-400">
                    <Users className="w-8 h-8 mx-auto mb-2 opacity-30" />
                    Aucun utilisateur trouvé
                  </td>
                </tr>
              ) : users.map((u) => (
                <tr key={u.user_id} className="hover:bg-slate-50/60 dark:hover:bg-[#162032]/40 transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2.5">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#EFF6FF] dark:bg-[#1E3A5F] text-[#2563EB] dark:text-[#3B82F6] text-xs font-bold">
                        {u.name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <p className="font-medium text-foreground">{u.name}</p>
                        <p className="text-[11px] text-slate-400">{u.city}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-slate-600 dark:text-slate-400">{u.email}</td>
                  <td className="px-4 py-3">
                    {u.plan !== 'none' ? (
                      <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold bg-[#EFF6FF] dark:bg-[#1E3A5F] text-[#2563EB] dark:text-[#3B82F6] capitalize">
                        {u.plan}
                        {u.billing_period && <span className="ml-1 opacity-60">· {u.billing_period === 'yearly' ? 'annuel' : 'mensuel'}</span>}
                      </span>
                    ) : (
                      <span className="text-slate-400 text-xs">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <StatusPill status={u.subStatus} />
                  </td>
                  <td className="px-4 py-3 text-[12px] text-slate-400">
                    {new Date(u.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      href={`/admin/users/${u.user_id}`}
                      className="text-[12px] font-medium text-[#2563EB] hover:underline"
                    >
                      Voir →
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
