import { createAdminClient } from '@/lib/supabase/server'
import {
  Users,
  CreditCard,
  UserPlus,
  MessageSquare,
  TrendingUp,
  FileText,
  ArrowUpRight,
  CheckCircle,
  XCircle,
  Clock,
} from 'lucide-react'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Admin — Vue d\'ensemble' }

/* ── KPI Card identique au style dashboard ─────────────────────── */
function KpiCard({
  icon,
  iconBg,
  value,
  label,
  sub,
  badge,
}: {
  icon:    React.ReactNode
  iconBg:  string
  value:   React.ReactNode
  label:   string
  sub?:    string
  badge?:  React.ReactNode
}) {
  return (
    <div
      className="relative overflow-hidden rounded-2xl border p-4 sm:p-5 bg-white/95 dark:bg-[#0F1E35] border-slate-100 dark:border-[#1E3A5F] shadow-[0_2px_12px_rgba(37,99,235,0.06)] dark:shadow-[0_2px_12px_rgba(0,0,0,0.20)]"
      style={{ transition: 'transform 0.15s ease' }}
    >
      <div aria-hidden className="pointer-events-none absolute -right-4 -bottom-4 w-24 h-24 rounded-full"
        style={{ background: 'radial-gradient(circle, rgba(37,99,235,0.05) 0%, transparent 70%)' }}
      />
      <div className="relative z-10">
        <div className="flex items-start justify-between mb-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl" style={{ background: iconBg }}>
            {icon}
          </div>
          {badge}
        </div>
        <p className="font-mono text-xl sm:text-2xl font-extrabold leading-none truncate mb-2 text-[#0F172A] dark:text-[#E2E8F0]">
          {value}
        </p>
        <p className="text-[12px] font-semibold text-slate-500 dark:text-slate-400">{label}</p>
        {sub && <p className="text-[11px] text-slate-300 dark:text-slate-600 mt-0.5">{sub}</p>}
      </div>
    </div>
  )
}

/* ── Status pill ────────────────────────────────────────────────── */
function StatusPill({ status }: { status: string }) {
  const map: Record<string, { label: string; className: string }> = {
    active:     { label: 'Actif',       className: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' },
    past_due:   { label: 'Retard',      className: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400' },
    canceled:   { label: 'Annulé',      className: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' },
    incomplete: { label: 'Incomplet',   className: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400' },
    trialing:   { label: 'Essai',       className: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' },
  }
  const s = map[status] ?? { label: status, className: 'bg-slate-100 text-slate-600' }
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ${s.className}`}>
      {s.label}
    </span>
  )
}

/* ── Data fetching ─────────────────────────────────────────────── */
async function getOverviewData() {
  const admin = createAdminClient()
  const now   = new Date()
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()

  const [
    usersRes,
    newUsersRes,
    subsRes,
    supportRes,
    blogRes,
    recentUsersRes,
    recentSubsRes,
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
  ])

  // Compter les abonnements par statut
  const subs     = subsRes.data ?? []
  const active   = subs.filter(s => s.status === 'active').length
  const pastDue  = subs.filter(s => s.status === 'past_due').length
  const canceled = subs.filter(s => s.status === 'canceled').length
  const starter  = subs.filter(s => s.status === 'active' && s.plan === 'starter').length
  const pro      = subs.filter(s => s.status === 'active' && s.plan === 'pro').length

  // Total users (Supabase Admin API renvoie le total dans la pagination)
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
    newUsersThisMonth: newUsersRes.count ?? 0,
    activeSubscriptions: active,
    pastDue,
    canceled,
    starter,
    pro,
    unreadSupport: supportRes.count ?? 0,
    publishedPosts: blogRes.count ?? 0,
    recentCompanies: recentUsersRes.data ?? [],
    recentSubs: recentSubsWithEmail,
  }
}

/* ── Page ─────────────────────────────────────────────────────────── */
export default async function AdminOverviewPage() {
  const d = await getOverviewData()

  return (
    <div className="space-y-6 max-w-[1200px] mx-auto">

      {/* Header */}
      <div className="flex items-center gap-3 pt-1">
        <div>
          <h1 className="text-[22px] sm:text-[26px] font-extrabold text-[#0F172A] dark:text-[#E2E8F0] leading-tight tracking-tight">
            Vue d&apos;ensemble
          </h1>
          <p className="text-[13px] text-slate-400 dark:text-slate-500 mt-0.5">
            Données en temps réel de la plateforme Qonforme
          </p>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <KpiCard
          iconBg="linear-gradient(135deg, #EFF6FF 0%, #DBEAFE 100%)"
          icon={<Users className="w-4 h-4 text-[#2563EB]" />}
          value={d.totalUsers.toLocaleString('fr-FR')}
          label="Utilisateurs"
          sub="inscrits au total"
          badge={d.newUsersThisMonth > 0 ? (
            <span className="inline-flex items-center gap-0.5 text-[11px] font-bold rounded-full px-2 py-0.5 bg-[#D1FAE5] text-[#065F46]">
              <ArrowUpRight className="w-3 h-3" />
              +{d.newUsersThisMonth} ce mois
            </span>
          ) : undefined}
        />
        <KpiCard
          iconBg="linear-gradient(135deg, #D1FAE5 0%, #A7F3D0 100%)"
          icon={<CreditCard className="w-4 h-4 text-[#059669]" />}
          value={d.activeSubscriptions.toLocaleString('fr-FR')}
          label="Abonnements actifs"
          sub={`${d.starter} starter · ${d.pro} pro`}
        />
        <KpiCard
          iconBg="linear-gradient(135deg, #FEF3C7 0%, #FDE68A 100%)"
          icon={<UserPlus className="w-4 h-4 text-[#D97706]" />}
          value={d.newUsersThisMonth}
          label="Nouveaux ce mois"
          sub="inscriptions récentes"
        />
        <KpiCard
          iconBg={d.unreadSupport > 0
            ? 'linear-gradient(135deg, #FEE2E2 0%, #FECACA 100%)'
            : 'linear-gradient(135deg, #EDE9FE 0%, #DDD6FE 100%)'
          }
          icon={<MessageSquare className={`w-4 h-4 ${d.unreadSupport > 0 ? 'text-[#EF4444]' : 'text-[#7C3AED]'}`} />}
          value={d.unreadSupport}
          label="Messages non lus"
          sub="bug reports + contact"
        />
      </div>

      {/* Statut abonnements + Blog */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
        <div className="rounded-2xl border p-4 bg-white/95 dark:bg-[#0F1E35] border-slate-100 dark:border-[#1E3A5F]">
          <div className="flex items-center gap-2 mb-3">
            <CheckCircle className="w-4 h-4 text-green-500" />
            <span className="text-sm font-semibold text-foreground">Actifs</span>
            <span className="ml-auto font-mono font-bold text-[#0F172A] dark:text-[#E2E8F0]">{d.activeSubscriptions}</span>
          </div>
          <div className="flex items-center gap-2 mb-3">
            <Clock className="w-4 h-4 text-yellow-500" />
            <span className="text-sm font-semibold text-foreground">En retard</span>
            <span className="ml-auto font-mono font-bold text-[#0F172A] dark:text-[#E2E8F0]">{d.pastDue}</span>
          </div>
          <div className="flex items-center gap-2">
            <XCircle className="w-4 h-4 text-red-500" />
            <span className="text-sm font-semibold text-foreground">Annulés</span>
            <span className="ml-auto font-mono font-bold text-[#0F172A] dark:text-[#E2E8F0]">{d.canceled}</span>
          </div>
        </div>
        <div className="rounded-2xl border p-4 bg-white/95 dark:bg-[#0F1E35] border-slate-100 dark:border-[#1E3A5F]">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Plans actifs</p>
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-foreground">Starter</span>
            <span className="font-mono font-bold text-[#0F172A] dark:text-[#E2E8F0]">{d.starter}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-foreground">Pro</span>
            <span className="font-mono font-bold text-[#0F172A] dark:text-[#E2E8F0]">{d.pro}</span>
          </div>
        </div>
        <div className="rounded-2xl border p-4 bg-white/95 dark:bg-[#0F1E35] border-slate-100 dark:border-[#1E3A5F]">
          <div className="flex items-center gap-2 mb-1">
            <FileText className="w-4 h-4 text-[#2563EB]" />
            <span className="text-sm font-semibold text-foreground">Articles publiés</span>
          </div>
          <p className="font-mono text-3xl font-extrabold text-[#0F172A] dark:text-[#E2E8F0] mt-2">{d.publishedPosts}</p>
          <p className="text-[11px] text-slate-400 mt-1">sur le blog Qonforme</p>
        </div>
      </div>

      {/* Dernières inscriptions + derniers abonnements */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-5">

        {/* Dernières entreprises inscrites */}
        <div className="rounded-2xl border bg-white/95 dark:bg-[#0F1E35] border-slate-100 dark:border-[#1E3A5F] overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-100 dark:border-[#1E3A5F] flex items-center gap-2">
            <UserPlus className="w-4 h-4 text-slate-400" />
            <h3 className="text-sm font-semibold text-foreground">Inscriptions récentes</h3>
          </div>
          <div className="divide-y divide-slate-50 dark:divide-[#1E3A5F]">
            {d.recentCompanies.length === 0 ? (
              <p className="px-4 py-6 text-sm text-slate-400 text-center">Aucune inscription</p>
            ) : d.recentCompanies.map((c) => (
              <div key={c.id} className="flex items-center gap-3 px-4 py-3 hover:bg-slate-50/60 dark:hover:bg-[#162032]/40 transition-colors">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#EFF6FF] dark:bg-[#1E3A5F] text-[#2563EB] dark:text-[#3B82F6] text-xs font-bold">
                  {(c.name || '?').charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{c.name || '—'}</p>
                  <p className="text-[11px] text-slate-400">
                    {new Date(c.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </p>
                </div>
                <a href={`/admin/users/${c.user_id}`} className="text-[11px] text-[#2563EB] hover:underline shrink-0">Voir →</a>
              </div>
            ))}
          </div>
        </div>

        {/* Derniers abonnements */}
        <div className="rounded-2xl border bg-white/95 dark:bg-[#0F1E35] border-slate-100 dark:border-[#1E3A5F] overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-100 dark:border-[#1E3A5F] flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-slate-400" />
            <h3 className="text-sm font-semibold text-foreground">Derniers abonnements</h3>
          </div>
          <div className="divide-y divide-slate-50 dark:divide-[#1E3A5F]">
            {d.recentSubs.length === 0 ? (
              <p className="px-4 py-6 text-sm text-slate-400 text-center">Aucun abonnement</p>
            ) : d.recentSubs.map((s) => (
              <div key={s.id} className="flex items-center gap-3 px-4 py-3 hover:bg-slate-50/60 dark:hover:bg-[#162032]/40 transition-colors">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{s.email}</p>
                  <p className="text-[11px] text-slate-400 capitalize">{s.plan} · {s.billing_period === 'yearly' ? 'annuel' : 'mensuel'}</p>
                </div>
                <StatusPill status={s.status} />
              </div>
            ))}
          </div>
        </div>
      </div>

    </div>
  )
}
