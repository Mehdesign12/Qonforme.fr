import { createAdminClient } from '@/lib/supabase/server'
import { isAdminAuthenticated } from '@/lib/admin-require'
import { redirect } from 'next/navigation'
import { Megaphone, Send, Eye, MousePointerClick, UserX, UserCheck } from 'lucide-react'
import OutreachActions from './OutreachActions'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Admin — Outreach' }

const STATUT_MAP: Record<string, { label: string; className: string }> = {
  brouillon:  { label: 'Brouillon',  className: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400' },
  planifiee:  { label: 'Planifiée',  className: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' },
  en_cours:   { label: 'En cours',   className: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' },
  terminee:   { label: 'Terminée',   className: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400' },
  pausee:     { label: 'Pausée',     className: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400' },
}

function StatusPill({ status }: { status: string }) {
  const s = STATUT_MAP[status] ?? STATUT_MAP.brouillon
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ${s.className}`}>
      {s.label}
    </span>
  )
}

function pct(a: number, b: number): string {
  if (b === 0) return '0%'
  return `${Math.round((a / b) * 100)}%`
}

async function getData() {
  const admin = createAdminClient()

  const { data: campaigns } = await admin
    .from('campaigns')
    .select('*')
    .order('created_at', { ascending: false })

  // KPIs globaux
  const all = campaigns ?? []
  const totalEnvois = all.reduce((s, c) => s + ((c as Record<string, number>).total_envois ?? 0), 0)
  const totalOuverts = all.reduce((s, c) => s + ((c as Record<string, number>).total_ouverts ?? 0), 0)
  const totalClics = all.reduce((s, c) => s + ((c as Record<string, number>).total_clics ?? 0), 0)
  const totalDesabo = all.reduce((s, c) => s + ((c as Record<string, number>).total_desabo ?? 0), 0)
  const totalConvertis = all.reduce((s, c) => s + ((c as Record<string, number>).total_convertis ?? 0), 0)

  return {
    campaigns: all,
    kpis: { totalEnvois, totalOuverts, totalClics, totalDesabo, totalConvertis },
  }
}

export default async function AdminOutreachPage() {
  if (!(await isAdminAuthenticated())) redirect('/admin/login')

  const { campaigns, kpis } = await getData()

  return (
    <div className="space-y-5 max-w-[1200px] mx-auto">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[22px] font-extrabold text-[#0F172A] dark:text-[#E2E8F0] leading-tight">
            Outreach B2B
          </h1>
          <p className="text-[13px] text-slate-400 mt-0.5">
            {campaigns.length} campagne(s) — {kpis.totalEnvois.toLocaleString('fr-FR')} emails envoyés
          </p>
        </div>
        <OutreachActions />
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {[
          { icon: <Send className="w-5 h-5 text-[#2563EB]" />, bg: 'linear-gradient(135deg, #EFF6FF 0%, #DBEAFE 100%)', value: kpis.totalEnvois.toLocaleString('fr-FR'), label: 'Envoyés' },
          { icon: <Eye className="w-5 h-5 text-[#059669]" />, bg: 'linear-gradient(135deg, #ECFDF5 0%, #D1FAE5 100%)', value: `${kpis.totalOuverts.toLocaleString('fr-FR')} (${pct(kpis.totalOuverts, kpis.totalEnvois)})`, label: 'Ouverts' },
          { icon: <MousePointerClick className="w-5 h-5 text-[#D97706]" />, bg: 'linear-gradient(135deg, #FFFBEB 0%, #FEF3C7 100%)', value: `${kpis.totalClics.toLocaleString('fr-FR')} (${pct(kpis.totalClics, kpis.totalEnvois)})`, label: 'Cliqués' },
          { icon: <UserCheck className="w-5 h-5 text-[#7C3AED]" />, bg: 'linear-gradient(135deg, #F5F3FF 0%, #EDE9FE 100%)', value: kpis.totalConvertis.toLocaleString('fr-FR'), label: 'Convertis' },
          { icon: <UserX className="w-5 h-5 text-[#EF4444]" />, bg: 'linear-gradient(135deg, #FEF2F2 0%, #FECACA 100%)', value: `${kpis.totalDesabo.toLocaleString('fr-FR')} (${pct(kpis.totalDesabo, kpis.totalEnvois)})`, label: 'Désabonnés' },
        ].map((kpi) => (
          <div key={kpi.label} className="rounded-2xl border border-slate-100 dark:border-[#1E3A5F] bg-white/95 dark:bg-[#0F1E35] p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl" style={{ background: kpi.bg }}>
                {kpi.icon}
              </div>
              <div>
                <p className="text-lg font-extrabold text-[#0F172A] dark:text-[#E2E8F0]">{kpi.value}</p>
                <p className="text-[11px] text-slate-400 font-medium">{kpi.label}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Campaigns Table */}
      <div className="rounded-2xl border border-slate-100 dark:border-[#1E3A5F] bg-white/95 dark:bg-[#0F1E35] overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-100 dark:border-[#1E3A5F] flex items-center gap-2">
          <Megaphone className="w-4 h-4 text-[#2563EB]" />
          <h2 className="text-[13px] font-bold text-slate-500 uppercase tracking-wider">Campagnes</h2>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 dark:border-[#1E3A5F] bg-slate-50/80 dark:bg-[#162032]/60">
                <th className="text-left px-4 py-3 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Campagne</th>
                <th className="text-left px-4 py-3 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Cible</th>
                <th className="text-left px-4 py-3 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Statut</th>
                <th className="text-right px-4 py-3 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Envoyés</th>
                <th className="text-right px-4 py-3 text-[11px] font-semibold text-slate-500 uppercase tracking-wider hidden md:table-cell">Ouverts</th>
                <th className="text-right px-4 py-3 text-[11px] font-semibold text-slate-500 uppercase tracking-wider hidden md:table-cell">Clics</th>
                <th className="text-right px-4 py-3 text-[11px] font-semibold text-slate-500 uppercase tracking-wider hidden lg:table-cell">Convertis</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50 dark:divide-[#1E3A5F]">
              {campaigns.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-16 text-center text-sm text-slate-400">
                    <Megaphone className="w-8 h-8 mx-auto mb-2 opacity-30" />
                    Aucune campagne. Créez votre première campagne d&apos;outreach.
                  </td>
                </tr>
              ) : campaigns.map((c) => {
                const campaign = c as Record<string, unknown>
                const envois = (campaign.total_envois as number) ?? 0
                const ouverts = (campaign.total_ouverts as number) ?? 0
                const clics = (campaign.total_clics as number) ?? 0
                const convertis = (campaign.total_convertis as number) ?? 0

                return (
                  <tr key={campaign.id as string} className="hover:bg-slate-50/60 dark:hover:bg-[#162032]/40 transition-colors">
                    <td className="px-4 py-3">
                      <p className="font-medium text-foreground text-[13px]">{campaign.nom as string}</p>
                      <p className="text-[11px] text-slate-400">
                        {campaign.date_envoi
                          ? new Date(campaign.date_envoi as string).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })
                          : 'Non planifiée'}
                      </p>
                    </td>
                    <td className="px-4 py-3 text-[12px] text-slate-500">
                      {(campaign.metier_cible as string) || 'Tous métiers'}
                    </td>
                    <td className="px-4 py-3">
                      <StatusPill status={(campaign.statut as string) ?? 'brouillon'} />
                    </td>
                    <td className="px-4 py-3 text-right font-medium text-[13px]">
                      {envois.toLocaleString('fr-FR')}
                    </td>
                    <td className="px-4 py-3 text-right text-[12px] text-slate-500 hidden md:table-cell">
                      {ouverts.toLocaleString('fr-FR')} <span className="text-slate-400">({pct(ouverts, envois)})</span>
                    </td>
                    <td className="px-4 py-3 text-right text-[12px] text-slate-500 hidden md:table-cell">
                      {clics.toLocaleString('fr-FR')} <span className="text-slate-400">({pct(clics, envois)})</span>
                    </td>
                    <td className="px-4 py-3 text-right text-[12px] text-slate-500 hidden lg:table-cell">
                      {convertis.toLocaleString('fr-FR')}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <OutreachActions campaignId={campaign.id as string} campaignStatut={campaign.statut as string} inline />
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
