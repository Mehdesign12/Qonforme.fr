import Link from 'next/link'
import { ArrowRight, CircleAlert } from 'lucide-react'
import { createAdminClient } from '@/lib/supabase/server'
import { PLANS } from '@/lib/stripe/plans'
import { Initials, Kpi, KpiGrid, PageHeader, Panel } from '@/components/app/kit'
import {
  BarChart, LoadError, SubscriptionPill, fmtDate, fmtEuro, fmtInt, periodLabel, planLabel,
  type BarDatum,
} from '@/components/admin/ui'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Admin — Vue d\'ensemble' }

/* ── Data fetching ─────────────────────────────────────────────── */
async function getOverviewData() {
  const admin = createAdminClient()
  const now   = new Date()
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()

  const sixMonthsAgo = new Date()
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6)

  const [
    usersRes,
    newUsersRes,
    subsRes,
    supportRes,
    blogRes,
    recentUsersRes,
    recentSubsRes,
    newSubsRes,
  ] = await Promise.all([
    // Total utilisateurs
    admin.auth.admin.listUsers({ perPage: 1 }),

    // Nouveaux utilisateurs ce mois
    admin
      .from('companies')
      .select('id', { count: 'exact', head: true })
      .gte('created_at', startOfMonth),

    // Abonnements par statut
    admin
      .from('subscriptions')
      .select('status, plan, billing_period'),

    // Messages support non lus
    admin
      .from('support_messages')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'new'),

    // Articles de blog
    admin
      .from('blog_posts')
      .select('id', { count: 'exact', head: true })
      .eq('is_published', true),

    // 5 derniers utilisateurs (via companies pour avoir le nom)
    admin
      .from('companies')
      .select('id, user_id, name, created_at')
      .order('created_at', { ascending: false })
      .limit(5),

    // 5 derniers abonnements
    admin
      .from('subscriptions')
      .select('id, user_id, plan, billing_period, status, created_at')
      .order('created_at', { ascending: false })
      .limit(5),

    // Nouveaux abonnés sur 6 mois (pour le graphique)
    admin
      .from('subscriptions')
      .select('created_at')
      .gte('created_at', sixMonthsAgo.toISOString())
      .order('created_at', { ascending: true }),
  ])

  // Compter les abonnements par statut
  const subs     = subsRes.data ?? []
  const active   = subs.filter(s => s.status === 'active').length
  const pastDue  = subs.filter(s => s.status === 'past_due').length
  const canceled = subs.filter(s => s.status === 'canceled').length
  const starter  = subs.filter(s => s.status === 'active' && s.plan === 'starter').length
  const pro      = subs.filter(s => s.status === 'active' && s.plan === 'pro').length

  // Calcul MRR en € HT, depuis la grille de lib/stripe/plans.ts
  const MRR_MAP: Record<string, Record<string, number>> = {
    starter: { monthly: PLANS.starter.monthlyPrice, yearly: PLANS.starter.yearlyPrice / 12 },
    pro:     { monthly: PLANS.pro.monthlyPrice,     yearly: PLANS.pro.yearlyPrice / 12 },
  }
  const mrr = subs
    .filter(s => s.status === 'active')
    .reduce((sum, s) => {
      const prices = MRR_MAP[s.plan ?? '']
      if (!prices) return sum
      return sum + (s.billing_period === 'yearly' ? prices.yearly : prices.monthly)
    }, 0)
  const arr = mrr * 12
  const churnRate = (active + canceled) > 0 ? (canceled / (active + canceled)) * 100 : 0

  // Nouveaux abonnés par mois (6 derniers mois, mois en cours compris)
  const months: BarDatum[] = []
  const indexByKey: Record<string, number> = {}
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const key = `${d.getFullYear()}-${d.getMonth()}`
    indexByKey[key] = months.length
    months.push({
      key,
      short: d.toLocaleDateString('fr-FR', { month: 'short' }),
      long: d.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' }),
      value: 0,
      current: i === 0,
    })
  }
  for (const sub of newSubsRes.data ?? []) {
    const d = new Date(sub.created_at)
    const idx = indexByKey[`${d.getFullYear()}-${d.getMonth()}`]
    if (idx !== undefined) months[idx].value++
  }

  // listUsers() interroge l'API Auth Admin, un sous-système à part — si elle
  // échoue (réseau, API down), ne pas confondre avec "0 utilisateur" réel.
  const totalUsers = (usersRes.data as { users: unknown[]; total?: number } | null)?.total
    ?? (usersRes.data as { users: unknown[] } | null)?.users?.length
    ?? 0

  // Enrichir les derniers abonnements avec les emails (via auth admin)
  const recentSubsWithEmail = await Promise.all(
    (recentSubsRes.data ?? []).map(async (sub) => {
      try {
        const { data } = await admin.auth.admin.getUserById(sub.user_id)
        return { ...sub, email: data.user?.email ?? sub.user_id }
      } catch {
        return { ...sub, email: sub.user_id }
      }
    })
  )

  return {
    totalUsers,
    totalUsersError: !!usersRes.error,
    newUsersThisMonth: newUsersRes.count ?? 0,
    newUsersError: !!newUsersRes.error,
    subsError: !!subsRes.error,
    activeSubscriptions: active,
    pastDue,
    canceled,
    starter,
    pro,
    unreadSupport: supportRes.count ?? 0,
    supportError: !!supportRes.error,
    publishedPosts: blogRes.count ?? 0,
    blogError: !!blogRes.error,
    recentCompanies: recentUsersRes.data ?? [],
    recentCompaniesError: !!recentUsersRes.error,
    recentSubs: recentSubsWithEmail,
    recentSubsError: !!recentSubsRes.error,
    mrr,
    arr,
    churnRate,
    chart: months,
    chartError: !!newSubsRes.error,
  }
}

const UNAVAILABLE = (
  <span className="inline-flex items-center gap-1 text-[var(--q-danger)]">
    <CircleAlert className="size-3.5" aria-hidden />
    Indisponible
  </span>
)

function StatRow({ label, value, error }: { label: string; value: number; error?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3 py-2.5">
      <span className="text-sm text-[var(--q-text-2)]">{label}</span>
      <span className="text-sm font-semibold tabular-nums text-[var(--q-ink)]">{error ? '—' : fmtInt(value)}</span>
    </div>
  )
}

/* ── Page ─────────────────────────────────────────────────────────── */
export default async function AdminOverviewPage() {
  const d = await getOverviewData()

  return (
    <div className="flex flex-col gap-5">
      <PageHeader title="Vue d'ensemble" subtitle="Comptes, abonnements et revenus de la plateforme." />

      <KpiGrid>
        <Kpi
          label="Utilisateurs"
          value={d.totalUsersError ? '—' : fmtInt(d.totalUsers)}
          sub={d.totalUsersError ? UNAVAILABLE : d.newUsersError ? 'inscrits au total' : `+${fmtInt(d.newUsersThisMonth)} ce mois-ci`}
        />
        <Kpi
          label="Abonnés actifs"
          value={d.subsError ? '—' : fmtInt(d.activeSubscriptions)}
          sub={d.subsError ? UNAVAILABLE : `${fmtInt(d.starter)} ${PLANS.starter.name} · ${fmtInt(d.pro)} ${PLANS.pro.name}`}
        />
        <Kpi
          label="Revenu mensuel récurrent"
          value={d.subsError ? '—' : fmtEuro(d.mrr)}
          sub={d.subsError ? UNAVAILABLE : `HT · ${fmtEuro(d.arr)} sur un an`}
        />
        <Kpi
          label="Support non lu"
          value={d.supportError ? '—' : fmtInt(d.unreadSupport)}
          tone={!d.supportError && d.unreadSupport > 0 ? 'warn' : 'default'}
          sub={d.supportError ? UNAVAILABLE : (
            <Link href={d.unreadSupport > 0 ? '/admin/support?status=new' : '/admin/support'} className="q-link text-[13px]">
              {d.unreadSupport > 0 ? 'Lire les messages' : 'Voir le support'}
            </Link>
          )}
        />
      </KpiGrid>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)]">
        <Panel title="Abonnements" action={<Link href="/admin/subscriptions" className="q-link text-[13px]">Tout voir</Link>}>
          {d.subsError ? (
            <LoadError what="les abonnements" compact />
          ) : (
            <div className="divide-y divide-[var(--q-line-soft)] px-5 pb-2">
              <StatRow label="Actifs" value={d.activeSubscriptions} />
              <StatRow label="Paiement en retard" value={d.pastDue} />
              <StatRow label="Résiliés" value={d.canceled} />
              <div className="flex items-center justify-between gap-3 py-2.5">
                <span className="text-sm text-[var(--q-text-2)]">Taux de résiliation</span>
                <span className="text-sm font-semibold tabular-nums text-[var(--q-ink)]">{d.churnRate.toLocaleString('fr-FR', { maximumFractionDigits: 1 })}&nbsp;%</span>
              </div>
              <StatRow label="Articles publiés sur le blog" value={d.publishedPosts} error={d.blogError} />
            </div>
          )}
        </Panel>

        <Panel title="Nouveaux abonnés" action={<span className="text-xs text-[var(--q-text-4)]">6 derniers mois</span>} bodyClassName="px-5 pb-5 pt-3">
          {d.chartError ? (
            <LoadError what="l'historique des abonnements" compact className="!px-0 !pb-0" />
          ) : (
            <BarChart data={d.chart} caption="Nouveaux abonnés par mois" valueName="Nouveaux abonnés" emptyText="Aucun nouvel abonné sur ces six mois." />
          )}
        </Panel>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <Panel title="Inscriptions récentes" action={<Link href="/admin/users" className="q-link text-[13px]">Utilisateurs</Link>}>
          {d.recentCompaniesError ? (
            <LoadError what="les inscriptions" compact />
          ) : d.recentCompanies.length === 0 ? (
            <p className="px-5 pb-6 pt-2 text-sm text-[var(--q-text-4)]">Aucune inscription pour l&apos;instant.</p>
          ) : (
            <ul className="q-list border-t border-[var(--q-line-soft)]">
              {d.recentCompanies.map((c) => (
                <li key={c.id}>
                  <Link href={`/admin/users/${c.user_id}`} className="q-list-row !min-h-[56px] !px-5 !py-2.5">
                    <Initials name={c.name} />
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className="truncate text-sm font-semibold">{c.name || 'Entreprise sans nom'}</span>
                      <span className="text-xs text-[var(--q-text-4)]">Inscrite le {fmtDate(c.created_at)}</span>
                    </span>
                    <ArrowRight className="size-4 shrink-0 text-[var(--q-text-4)]" aria-hidden />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel title="Derniers abonnements" action={<Link href="/admin/subscriptions" className="q-link text-[13px]">Abonnements</Link>}>
          {d.recentSubsError ? (
            <LoadError what="les abonnements" compact />
          ) : d.recentSubs.length === 0 ? (
            <p className="px-5 pb-6 pt-2 text-sm text-[var(--q-text-4)]">Aucun abonnement pour l&apos;instant.</p>
          ) : (
            <ul className="q-list border-t border-[var(--q-line-soft)]">
              {d.recentSubs.map((s) => (
                <li key={s.id}>
                  <Link href={`/admin/users/${s.user_id}`} className="q-list-row !min-h-[56px] !px-5 !py-2.5">
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className="truncate text-sm font-semibold">{s.email}</span>
                      <span className="text-xs text-[var(--q-text-4)]">{planLabel(s.plan)} · {periodLabel(s.billing_period)} · {fmtDate(s.created_at)}</span>
                    </span>
                    <SubscriptionPill status={s.status} />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>

      <p className="text-xs text-[var(--q-text-4)]">
        Revenu estimé à partir des abonnements actifs et de la grille de prix actuelle, hors remises et avoirs.
      </p>
    </div>
  )
}
