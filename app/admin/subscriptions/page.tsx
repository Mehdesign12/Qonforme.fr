import { createAdminClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { CreditCard, ExternalLink } from 'lucide-react'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Admin — Abonnements' }

function StatusPill({ status }: { status: string }) {
  const map: Record<string, { label: string; className: string }> = {
    active:     { label: 'Actif',     className: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' },
    past_due:   { label: 'En retard', className: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400' },
    canceled:   { label: 'Annulé',    className: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' },
    incomplete: { label: 'Incomplet', className: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400' },
    trialing:   { label: 'Essai',     className: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' },
  }
  const s = map[status] ?? { label: status, className: 'bg-slate-100 text-slate-600' }
  return <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ${s.className}`}>{s.label}</span>
}

interface SearchParams { status?: string; plan?: string }

async function getSubscriptions(statusFilter: string, planFilter: string) {
  const admin = createAdminClient()

  let query = admin
    .from('subscriptions')
    .select('id, user_id, plan, billing_period, status, current_period_end, canceled_at, created_at, stripe_subscription_id, stripe_customer_id')
    .order('created_at', { ascending: false })

  if (statusFilter) query = query.eq('status', statusFilter)
  if (planFilter)   query = query.eq('plan', planFilter)

  const { data: subs } = await query.limit(300)
  if (!subs?.length) return []

  // Enrichir avec emails
  const { data: authData } = await admin.auth.admin.listUsers({ perPage: 1000 })
  const emailMap = new Map((authData?.users ?? []).map(u => [u.id, u.email]))

  // Enrichir avec noms d'entreprise
  const userIds = subs.map(s => s.user_id)
  const { data: companies } = await admin
    .from('companies')
    .select('user_id, name')
    .in('user_id', userIds)
  const companyMap = new Map((companies ?? []).map(c => [c.user_id, c.name]))

  return subs.map(s => ({
    ...s,
    email:       emailMap.get(s.user_id) ?? '—',
    companyName: companyMap.get(s.user_id) ?? '—',
  }))
}

export default async function AdminSubscriptionsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>
}) {
  const params       = await searchParams
  const statusFilter = params.status ?? ''
  const planFilter   = params.plan ?? ''

  const subs = await getSubscriptions(statusFilter, planFilter)

  // Comptages par statut
  const all       = subs.length
  const active    = subs.filter(s => s.status === 'active').length
  const pastDue   = subs.filter(s => s.status === 'past_due').length
  const canceled  = subs.filter(s => s.status === 'canceled').length

  return (
    <div className="space-y-5 max-w-[1200px] mx-auto">

      {/* Header */}
      <div>
        <h1 className="text-[22px] font-extrabold text-[#0F172A] dark:text-[#E2E8F0] leading-tight">Abonnements</h1>
        <p className="text-[13px] text-slate-400 mt-0.5">{subs.length} résultat(s)</p>
      </div>

      {/* Résumé rapide */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Total',      count: all,      href: '/admin/subscriptions',              className: 'bg-white/95 dark:bg-[#0F1E35]' },
          { label: 'Actifs',     count: active,   href: '/admin/subscriptions?status=active', className: 'bg-green-50 dark:bg-green-900/20' },
          { label: 'En retard',  count: pastDue,  href: '/admin/subscriptions?status=past_due', className: 'bg-yellow-50 dark:bg-yellow-900/20' },
          { label: 'Annulés',    count: canceled, href: '/admin/subscriptions?status=canceled', className: 'bg-red-50 dark:bg-red-900/20' },
        ].map(({ label, count, href, className }) => (
          <Link
            key={label}
            href={href}
            className={`rounded-xl border border-slate-100 dark:border-[#1E3A5F] p-3 text-center hover:border-[#2563EB] dark:hover:border-[#3B82F6] transition-colors ${className}`}
          >
            <p className="font-mono text-2xl font-extrabold text-[#0F172A] dark:text-[#E2E8F0]">{count}</p>
            <p className="text-[11px] text-slate-400 mt-0.5">{label}</p>
          </Link>
        ))}
      </div>

      {/* Filtres */}
      <form method="GET" className="flex flex-wrap gap-2">
        <select
          name="status"
          defaultValue={statusFilter}
          className="h-9 px-3 text-sm rounded-lg border border-border bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
        >
          <option value="">Tous les statuts</option>
          <option value="active">Actifs</option>
          <option value="past_due">En retard</option>
          <option value="canceled">Annulés</option>
          <option value="incomplete">Incomplets</option>
          <option value="trialing">En essai</option>
        </select>
        <select
          name="plan"
          defaultValue={planFilter}
          className="h-9 px-3 text-sm rounded-lg border border-border bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
        >
          <option value="">Tous les plans</option>
          <option value="starter">Starter</option>
          <option value="pro">Pro</option>
        </select>
        <button type="submit" className="h-9 px-4 text-sm font-medium rounded-lg bg-[#2563EB] text-white hover:bg-[#1d4ed8] transition-colors">
          Filtrer
        </button>
        {(statusFilter || planFilter) && (
          <a href="/admin/subscriptions" className="h-9 px-4 text-sm font-medium rounded-lg border border-border text-foreground hover:bg-muted flex items-center transition-colors">
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
                <th className="text-left px-4 py-3 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Utilisateur</th>
                <th className="text-left px-4 py-3 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Plan</th>
                <th className="text-left px-4 py-3 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Statut</th>
                <th className="text-left px-4 py-3 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Renouvellement</th>
                <th className="text-left px-4 py-3 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Stripe</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50 dark:divide-[#1E3A5F]">
              {subs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-sm text-slate-400">
                    <CreditCard className="w-8 h-8 mx-auto mb-2 opacity-30" />
                    Aucun abonnement trouvé
                  </td>
                </tr>
              ) : subs.map((s) => (
                <tr key={s.id} className="hover:bg-slate-50/60 dark:hover:bg-[#162032]/40 transition-colors">
                  <td className="px-4 py-3">
                    <p className="font-medium text-foreground">{s.companyName}</p>
                    <p className="text-[11px] text-slate-400">{s.email}</p>
                  </td>
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold bg-[#EFF6FF] dark:bg-[#1E3A5F] text-[#2563EB] dark:text-[#3B82F6] capitalize">
                      {s.plan}
                    </span>
                    <span className="ml-1.5 text-[11px] text-slate-400">
                      {s.billing_period === 'yearly' ? '/ an' : '/ mois'}
                    </span>
                  </td>
                  <td className="px-4 py-3"><StatusPill status={s.status} /></td>
                  <td className="px-4 py-3 text-[12px] text-slate-400">
                    {s.status === 'canceled'
                      ? (s.canceled_at ? `Annulé le ${new Date(s.canceled_at).toLocaleDateString('fr-FR')}` : '—')
                      : s.current_period_end
                        ? new Date(s.current_period_end).toLocaleDateString('fr-FR')
                        : '—'
                    }
                  </td>
                  <td className="px-4 py-3">
                    {s.stripe_subscription_id ? (
                      <a
                        href={`https://dashboard.stripe.com/subscriptions/${s.stripe_subscription_id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-[11px] text-[#2563EB] hover:underline"
                      >
                        Stripe <ExternalLink className="w-3 h-3" />
                      </a>
                    ) : '—'}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link href={`/admin/users/${s.user_id}`} className="text-[12px] font-medium text-[#2563EB] hover:underline">
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
