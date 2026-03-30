import { createAdminClient } from '@/lib/supabase/server'
import { isAdminAuthenticated } from '@/lib/admin-require'
import { redirect } from 'next/navigation'
import { Database, Mail, MailCheck, Send, UserCheck, Search, Building2 } from 'lucide-react'
import { METIER_OPTIONS } from '@/lib/scraping/naf-mapping'
import ProspectsActions from './ProspectsActions'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Admin — Prospects' }

// ── Statuts avec couleurs ──────────────────────────────────────────────────────

const STATUT_MAP: Record<string, { label: string; className: string }> = {
  nouveau:    { label: 'Nouveau',    className: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' },
  contacte:   { label: 'Contacté',   className: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400' },
  relance_1:  { label: 'Relance 1',  className: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400' },
  relance_2:  { label: 'Relance 2',  className: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' },
  converti:   { label: 'Converti',   className: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' },
  desabonne:  { label: 'Désabonné',  className: 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-500' },
}

function StatusPill({ status }: { status: string }) {
  const s = STATUT_MAP[status] ?? STATUT_MAP.nouveau
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ${s.className}`}>
      {s.label}
    </span>
  )
}

// ── Départements français (pour le filtre) ─────────────────────────────────────

const DEPARTEMENTS = [
  '01','02','03','04','05','06','07','08','09','10','11','12','13','14','15','16','17','18','19',
  '2A','2B','21','22','23','24','25','26','27','28','29','30','31','32','33','34','35','36','37',
  '38','39','40','41','42','43','44','45','46','47','48','49','50','51','52','53','54','55','56',
  '57','58','59','60','61','62','63','64','65','66','67','68','69','70','71','72','73','74','75',
  '76','77','78','79','80','81','82','83','84','85','86','87','88','89','90','91','92','93','94','95',
  '971','972','973','974','976',
]

// ── Data fetching ──────────────────────────────────────────────────────────────

interface SearchParams {
  q?: string
  metier?: string
  dept?: string
  statut?: string
  email?: string
  page?: string
}

async function getStats(admin: ReturnType<typeof createAdminClient>) {
  const [
    { count: total },
    { count: avecEmail },
    { count: emailVerifie },
    { count: contactes },
    { count: convertis },
  ] = await Promise.all([
    admin.from('prospects').select('*', { head: true, count: 'exact' }),
    admin.from('prospects').select('*', { head: true, count: 'exact' }).not('email', 'is', null),
    admin.from('prospects').select('*', { head: true, count: 'exact' }).eq('email_verified', true),
    admin.from('prospects').select('*', { head: true, count: 'exact' }).in('statut', ['contacte', 'relance_1', 'relance_2']),
    admin.from('prospects').select('*', { head: true, count: 'exact' }).eq('statut', 'converti'),
  ])
  return {
    total: total ?? 0,
    avecEmail: avecEmail ?? 0,
    emailVerifie: emailVerifie ?? 0,
    contactes: contactes ?? 0,
    convertis: convertis ?? 0,
  }
}

async function getMetierDistribution(admin: ReturnType<typeof createAdminClient>) {
  const { data } = await admin
    .rpc('get_prospect_metier_counts' as never)
    .select('*')
    .limit(20)

  // Fallback si la RPC n'existe pas : requête manuelle top 15
  if (!data) {
    const { data: prospects } = await admin
      .from('prospects')
      .select('metier_qonforme')

    if (!prospects) return []

    const counts: Record<string, number> = {}
    for (const p of prospects) {
      const m = (p as { metier_qonforme: string }).metier_qonforme || 'inconnu'
      counts[m] = (counts[m] || 0) + 1
    }

    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 15)
      .map(([metier, count]) => ({ metier, count }))
  }

  return data as { metier: string; count: number }[]
}

const PAGE_SIZE = 50

async function getProspects(
  admin: ReturnType<typeof createAdminClient>,
  params: SearchParams,
) {
  const page = Math.max(1, parseInt(params.page ?? '1', 10))
  const offset = (page - 1) * PAGE_SIZE

  let query = admin
    .from('prospects')
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(offset, offset + PAGE_SIZE - 1)

  if (params.q) {
    query = query.or(`nom_entreprise.ilike.%${params.q}%,ville.ilike.%${params.q}%,email.ilike.%${params.q}%`)
  }
  if (params.metier) query = query.eq('metier_qonforme', params.metier)
  if (params.dept) query = query.eq('departement', params.dept)
  if (params.statut) query = query.eq('statut', params.statut)
  if (params.email === 'oui') query = query.not('email', 'is', null)
  if (params.email === 'non') query = query.is('email', null)
  if (params.email === 'verifie') query = query.eq('email_verified', true)

  const { data, count } = await query
  return { prospects: data ?? [], total: count ?? 0, page, totalPages: Math.ceil((count ?? 0) / PAGE_SIZE) }
}

// ── Page ────────────────────────────────────────────────────────────────────────

export default async function AdminProspectsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>
}) {
  if (!(await isAdminAuthenticated())) redirect('/admin/login')

  const params = await searchParams
  const admin = createAdminClient()

  const [stats, distribution, { prospects, total, page, totalPages }] = await Promise.all([
    getStats(admin),
    getMetierDistribution(admin),
    getProspects(admin, params),
  ])

  const hasFilters = !!(params.q || params.metier || params.dept || params.statut || params.email)
  const maxBar = Math.max(...distribution.map((d) => d.count), 1)

  return (
    <div className="space-y-5 max-w-[1200px] mx-auto">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[22px] font-extrabold text-[#0F172A] dark:text-[#E2E8F0] leading-tight">
            Prospects B2B
          </h1>
          <p className="text-[13px] text-slate-400 mt-0.5">
            Base de données Sirene — {stats.total.toLocaleString('fr-FR')} prospects
          </p>
        </div>
        <ProspectsActions />
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {[
          { icon: <Database className="w-5 h-5 text-[#2563EB]" />, bg: 'linear-gradient(135deg, #EFF6FF 0%, #DBEAFE 100%)', value: stats.total.toLocaleString('fr-FR'), label: 'Total prospects' },
          { icon: <Mail className="w-5 h-5 text-[#059669]" />, bg: 'linear-gradient(135deg, #ECFDF5 0%, #D1FAE5 100%)', value: stats.avecEmail.toLocaleString('fr-FR'), label: 'Avec email' },
          { icon: <MailCheck className="w-5 h-5 text-[#0891B2]" />, bg: 'linear-gradient(135deg, #ECFEFF 0%, #CFFAFE 100%)', value: stats.emailVerifie.toLocaleString('fr-FR'), label: 'Email vérifié' },
          { icon: <Send className="w-5 h-5 text-[#D97706]" />, bg: 'linear-gradient(135deg, #FFFBEB 0%, #FEF3C7 100%)', value: stats.contactes.toLocaleString('fr-FR'), label: 'Contactés' },
          { icon: <UserCheck className="w-5 h-5 text-[#7C3AED]" />, bg: 'linear-gradient(135deg, #F5F3FF 0%, #EDE9FE 100%)', value: stats.convertis.toLocaleString('fr-FR'), label: 'Convertis' },
        ].map((kpi) => (
          <div key={kpi.label} className="rounded-2xl border border-slate-100 dark:border-[#1E3A5F] bg-white/95 dark:bg-[#0F1E35] p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl" style={{ background: kpi.bg }}>
                {kpi.icon}
              </div>
              <div>
                <p className="text-2xl font-extrabold text-[#0F172A] dark:text-[#E2E8F0]">{kpi.value}</p>
                <p className="text-[11px] text-slate-400 font-medium">{kpi.label}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Répartition par métier */}
      {distribution.length > 0 && (
        <div className="rounded-2xl border border-slate-100 dark:border-[#1E3A5F] bg-white/95 dark:bg-[#0F1E35] p-4">
          <h2 className="text-[13px] font-bold text-slate-500 uppercase tracking-wider mb-3 flex items-center gap-2">
            <Building2 className="w-4 h-4" />
            Répartition par métier (top {distribution.length})
          </h2>
          <div className="space-y-1.5">
            {distribution.map((d) => (
              <div key={d.metier} className="flex items-center gap-3 text-sm">
                <span className="w-40 truncate text-[12px] font-medium text-slate-600 dark:text-slate-400">{d.metier}</span>
                <div className="flex-1 h-5 bg-slate-100 dark:bg-[#162032] rounded-full overflow-hidden">
                  <div
                    className="h-full bg-[#2563EB]/80 rounded-full"
                    style={{ width: `${Math.max((d.count / maxBar) * 100, 2)}%` }}
                  />
                </div>
                <span className="text-[12px] font-bold text-slate-500 w-16 text-right">{d.count.toLocaleString('fr-FR')}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Filtres */}
      <form method="GET" className="flex flex-wrap gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            name="q"
            defaultValue={params.q ?? ''}
            placeholder="Rechercher par nom, ville ou email…"
            className="w-full h-9 pl-9 pr-3 text-sm rounded-lg border border-border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
        <select
          name="metier"
          defaultValue={params.metier ?? ''}
          className="h-9 px-3 text-sm rounded-lg border border-border bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
        >
          <option value="">Tous les métiers</option>
          {METIER_OPTIONS.map((m) => (
            <option key={m.value} value={m.value}>{m.label}</option>
          ))}
        </select>
        <select
          name="dept"
          defaultValue={params.dept ?? ''}
          className="h-9 px-3 text-sm rounded-lg border border-border bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
        >
          <option value="">Tous les départements</option>
          {DEPARTEMENTS.map((d) => (
            <option key={d} value={d}>{d}</option>
          ))}
        </select>
        <select
          name="statut"
          defaultValue={params.statut ?? ''}
          className="h-9 px-3 text-sm rounded-lg border border-border bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
        >
          <option value="">Tous les statuts</option>
          <option value="nouveau">Nouveau</option>
          <option value="contacte">Contacté</option>
          <option value="relance_1">Relance 1</option>
          <option value="relance_2">Relance 2</option>
          <option value="converti">Converti</option>
          <option value="desabonne">Désabonné</option>
        </select>
        <select
          name="email"
          defaultValue={params.email ?? ''}
          className="h-9 px-3 text-sm rounded-lg border border-border bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
        >
          <option value="">Email (tous)</option>
          <option value="oui">Avec email</option>
          <option value="non">Sans email</option>
          <option value="verifie">Email vérifié</option>
        </select>
        <button
          type="submit"
          className="h-9 px-4 text-sm font-medium rounded-lg bg-[#2563EB] text-white hover:bg-[#1d4ed8] transition-colors"
        >
          Filtrer
        </button>
        {hasFilters && (
          <a href="/admin/prospects" className="h-9 px-4 text-sm font-medium rounded-lg border border-border text-foreground hover:bg-muted flex items-center transition-colors">
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
                <th className="text-left px-4 py-3 text-[11px] font-semibold text-slate-500 uppercase tracking-wider hidden md:table-cell">Activité</th>
                <th className="text-left px-4 py-3 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Ville</th>
                <th className="text-left px-4 py-3 text-[11px] font-semibold text-slate-500 uppercase tracking-wider hidden lg:table-cell">Email</th>
                <th className="text-left px-4 py-3 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Statut</th>
                <th className="text-left px-4 py-3 text-[11px] font-semibold text-slate-500 uppercase tracking-wider hidden md:table-cell">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50 dark:divide-[#1E3A5F]">
              {prospects.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-16 text-center text-sm text-slate-400">
                    <Database className="w-8 h-8 mx-auto mb-2 opacity-30" />
                    {hasFilters ? 'Aucun prospect ne correspond aux filtres' : 'Aucun prospect. Lancez une extraction Sirene.'}
                  </td>
                </tr>
              ) : prospects.map((p) => (
                <tr key={(p as Record<string, string>).id} className="hover:bg-slate-50/60 dark:hover:bg-[#162032]/40 transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2.5">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#EFF6FF] dark:bg-[#1E3A5F] text-[#2563EB] dark:text-[#3B82F6] text-xs font-bold">
                        {((p as Record<string, string>).nom_entreprise ?? '?').charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <p className="font-medium text-foreground text-[13px]">{(p as Record<string, string>).nom_entreprise}</p>
                        <p className="text-[11px] text-slate-400">{(p as Record<string, string>).metier_qonforme}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-[12px] text-slate-500 dark:text-slate-400 hidden md:table-cell">
                    {(p as Record<string, string>).activite ?? '—'}
                  </td>
                  <td className="px-4 py-3">
                    <p className="text-[12px] text-foreground">{(p as Record<string, string>).ville ?? '—'}</p>
                    <p className="text-[11px] text-slate-400">{(p as Record<string, string>).departement ?? ''}</p>
                  </td>
                  <td className="px-4 py-3 text-[12px] text-slate-500 dark:text-slate-400 hidden lg:table-cell">
                    {(p as Record<string, string>).email ? (
                      <span className="flex items-center gap-1">
                        {(p as Record<string, string>).email}
                        {(p as Record<string, boolean>).email_verified && (
                          <span className="inline-block w-1.5 h-1.5 rounded-full bg-green-500" title="Vérifié" />
                        )}
                      </span>
                    ) : (
                      <span className="text-slate-300 dark:text-slate-600">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <StatusPill status={(p as Record<string, string>).statut ?? 'nouveau'} />
                  </td>
                  <td className="px-4 py-3 text-[12px] text-slate-400 hidden md:table-cell">
                    {(p as Record<string, string>).date_scrape
                      ? new Date((p as Record<string, string>).date_scrape).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
                      : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100 dark:border-[#1E3A5F]">
            <p className="text-[12px] text-slate-400">
              {total.toLocaleString('fr-FR')} résultat(s) — Page {page}/{totalPages}
            </p>
            <div className="flex gap-1.5">
              {page > 1 && (
                <a
                  href={`/admin/prospects?${new URLSearchParams({ ...params, page: String(page - 1) }).toString()}`}
                  className="h-8 px-3 text-[12px] font-medium rounded-lg border border-border text-foreground hover:bg-muted flex items-center transition-colors"
                >
                  ← Précédent
                </a>
              )}
              {page < totalPages && (
                <a
                  href={`/admin/prospects?${new URLSearchParams({ ...params, page: String(page + 1) }).toString()}`}
                  className="h-8 px-3 text-[12px] font-medium rounded-lg bg-[#2563EB] text-white hover:bg-[#1d4ed8] flex items-center transition-colors"
                >
                  Suivant →
                </a>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
