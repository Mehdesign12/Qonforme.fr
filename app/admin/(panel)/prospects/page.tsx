import { createAdminClient } from '@/lib/supabase/server'
import { isAdminAuthenticated } from '@/lib/admin-require'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { ChevronLeft, ChevronRight, Database, MailCheck } from 'lucide-react'
import { METIER_OPTIONS } from '@/lib/scraping/naf-mapping'
import { EmptyState, Kpi, PageHeader, Panel, StatusPill, type Tone } from '@/components/app/kit'
import {
  FilterBar, FilterSearch, FilterSelect, LoadError, ProspectingNotice, fmtDate, fmtInt, plural,
} from '@/components/admin/ui'
import ProspectsActions from './ProspectsActions'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Admin — Prospects' }

// ── Statuts ────────────────────────────────────────────────────────────────────

const STATUT_MAP: Record<string, { label: string; tone: Tone }> = {
  nouveau:    { label: 'Nouveau',    tone: 'info' },
  contacte:   { label: 'Contacté',   tone: 'warn' },
  relance_1:  { label: 'Relance 1',  tone: 'warn' },
  relance_2:  { label: 'Relance 2',  tone: 'warn' },
  converti:   { label: 'Converti',   tone: 'ok' },
  desabonne:  { label: 'Désabonné',  tone: 'neutral' },
}

function StatutPill({ status }: { status: string }) {
  const s = STATUT_MAP[status] ?? STATUT_MAP.nouveau
  return <StatusPill tone={s.tone}>{s.label}</StatusPill>
}

const METIER_LABEL = new Map(METIER_OPTIONS.map((m) => [m.value, m.label]))
const metierLabel = (m: string | null | undefined) => (m ? METIER_LABEL.get(m) ?? m : 'Métier inconnu')

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

type Prospect = {
  id: string
  nom_entreprise: string | null
  metier_qonforme: string | null
  activite: string | null
  ville: string | null
  departement: string | null
  email: string | null
  email_verified: boolean | null
  statut: string | null
  date_scrape: string | null
}

async function getStats(admin: ReturnType<typeof createAdminClient>) {
  const results = await Promise.all([
    admin.from('prospects').select('*', { head: true, count: 'exact' }),
    admin.from('prospects').select('*', { head: true, count: 'exact' }).not('email', 'is', null),
    admin.from('prospects').select('*', { head: true, count: 'exact' }).eq('email_verified', true),
    admin.from('prospects').select('*', { head: true, count: 'exact' }).in('statut', ['contacte', 'relance_1', 'relance_2']),
    admin.from('prospects').select('*', { head: true, count: 'exact' }).eq('statut', 'converti'),
  ])
  const [total, avecEmail, emailVerifie, contactes, convertis] = results.map((r) => (r.error ? null : r.count ?? 0))
  return { total, avecEmail, emailVerifie, contactes, convertis }
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

/** Clause ilike pour .or() : motif entre guillemets doubles, car PostgREST lit ',' '(' ')' '.' ':' comme séparateurs. */
function ilikeClause(column: string, term: string): string {
  const pattern = `%${term.replace(/[\\%_]/g, (c) => `\\${c}`)}%`
  return `${column}.ilike."${pattern.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`
}

async function getProspects(
  admin: ReturnType<typeof createAdminClient>,
  params: SearchParams,
) {
  const page = Math.max(1, parseInt(params.page ?? '1', 10) || 1)
  const offset = (page - 1) * PAGE_SIZE

  let query = admin
    .from('prospects')
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(offset, offset + PAGE_SIZE - 1)

  const q = params.q?.trim()
  if (q) {
    // Avant : le terme était collé tel quel dans le filtre, et une virgule ou une parenthèse le cassait
    query = query.or([ilikeClause('nom_entreprise', q), ilikeClause('ville', q), ilikeClause('email', q)].join(','))
  }
  if (params.metier) query = query.eq('metier_qonforme', params.metier)
  if (params.dept) query = query.eq('departement', params.dept)
  if (params.statut) query = query.eq('statut', params.statut)
  if (params.email === 'oui') query = query.not('email', 'is', null)
  if (params.email === 'non') query = query.is('email', null)
  if (params.email === 'verifie') query = query.eq('email_verified', true)

  const { data, count, error } = await query
  return {
    prospects: (data ?? []) as Prospect[],
    total: count ?? 0,
    page,
    totalPages: Math.ceil((count ?? 0) / PAGE_SIZE),
    error: !!error,
  }
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

  const [stats, distribution, { prospects, total, page, totalPages, error }] = await Promise.all([
    getStats(admin),
    getMetierDistribution(admin),
    getProspects(admin, params),
  ])

  const hasFilters = !!(params.q || params.metier || params.dept || params.statut || params.email)
  const maxBar = Math.max(...distribution.map((d) => d.count), 1)
  const n = (v: number | null) => (v === null ? '—' : fmtInt(v))
  const pageHref = (p: number) => {
    const qs = new URLSearchParams()
    for (const [k, v] of Object.entries(params)) if (v && k !== 'page') qs.set(k, String(v))
    qs.set('page', String(p))
    return `/admin/prospects?${qs.toString()}`
  }

  return (
    <div className="flex flex-col gap-5">
      <ProspectingNotice />

      <PageHeader
        title="Prospects"
        subtitle={stats.total === null ? 'Base Sirene' : `Base Sirene : ${plural(stats.total, 'entreprise')}`}
        actions={<ProspectsActions />}
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Kpi label="Prospects" value={n(stats.total)} />
        <Kpi label="Avec email" value={n(stats.avecEmail)} />
        <Kpi label="Email vérifié" value={n(stats.emailVerifie)} />
        <Kpi label="Contactés" value={n(stats.contactes)} />
        <Kpi label="Convertis" value={n(stats.convertis)} className="col-span-2 lg:col-span-1" />
      </div>

      {distribution.length > 0 && (
        <Panel title={`Répartition par métier (${distribution.length} premiers)`} bodyClassName="flex flex-col gap-2 px-5 pb-5 pt-2">
          {distribution.map((d) => (
            <div key={d.metier} className="grid grid-cols-[minmax(0,9rem)_minmax(0,1fr)_auto] items-center gap-3 sm:grid-cols-[minmax(0,14rem)_minmax(0,1fr)_auto]">
              <span className="truncate text-[13px] text-[var(--q-text-2)]" title={metierLabel(d.metier)}>{metierLabel(d.metier)}</span>
              <span className="q-progress !h-2.5" aria-hidden>
                <span style={{ width: `${Math.max((d.count / maxBar) * 100, 2)}%` }} />
              </span>
              <span className="w-14 text-right text-[13px] font-semibold tabular-nums text-[var(--q-ink)]">{fmtInt(d.count)}</span>
            </div>
          ))}
        </Panel>
      )}

      <FilterBar resetHref="/admin/prospects" active={hasFilters} label="Filtrer les prospects">
        <FilterSearch defaultValue={params.q ?? ''} placeholder="Nom, ville ou email…" label="Rechercher un prospect" />
        <FilterSelect name="metier" label="Métier" defaultValue={params.metier ?? ''} options={[{ value: '', label: 'Tous les métiers' }, ...METIER_OPTIONS]} />
        <FilterSelect name="dept" label="Département" defaultValue={params.dept ?? ''} options={[{ value: '', label: 'Tous les départements' }, ...DEPARTEMENTS.map((d) => ({ value: d, label: d }))]} />
        <FilterSelect
          name="statut"
          label="Statut"
          defaultValue={params.statut ?? ''}
          options={[{ value: '', label: 'Tous les statuts' }, ...Object.entries(STATUT_MAP).map(([value, s]) => ({ value, label: s.label }))]}
        />
        <FilterSelect
          name="email"
          label="Email"
          defaultValue={params.email ?? ''}
          options={[
            { value: '', label: 'Email : tous' },
            { value: 'oui', label: 'Avec email' },
            { value: 'non', label: 'Sans email' },
            { value: 'verifie', label: 'Email vérifié' },
          ]}
        />
      </FilterBar>

      {error ? (
        <LoadError what="les prospects" />
      ) : prospects.length === 0 ? (
        <div className="q-card">
          <EmptyState
            icon={<Database className="size-5" aria-hidden />}
            title={hasFilters ? 'Aucun prospect ne correspond' : 'Aucun prospect'}
            text={hasFilters ? 'Modifiez les filtres ou effacez-les.' : 'La base est vide.'}
          />
        </div>
      ) : (
        <>
          {/* Tableau (ordinateur) */}
          <section aria-label="Prospects" className="q-card hidden overflow-hidden md:block">
            <div className="overflow-x-auto">
              <table className="q-table min-w-[920px] [&_th]:border-t-0">
                <thead>
                  <tr className="bg-[var(--q-surface-2)]">
                    <th scope="col">Entreprise</th>
                    <th scope="col">Activité</th>
                    <th scope="col">Ville</th>
                    <th scope="col">Email</th>
                    <th scope="col">Statut</th>
                    <th scope="col">Extraction</th>
                  </tr>
                </thead>
                <tbody>
                  {prospects.map((p) => (
                    <tr key={p.id}>
                      <td className="!py-2.5">
                        <span className="flex min-w-0 flex-col gap-px">
                          <span className="font-semibold">{p.nom_entreprise || 'Sans nom'}</span>
                          <span className="text-xs text-[var(--q-text-4)]">{metierLabel(p.metier_qonforme)}</span>
                        </span>
                      </td>
                      <td className="max-w-[200px] !py-2.5 text-[13px] text-[var(--q-text-3)]">{p.activite ?? '—'}</td>
                      <td className="!py-2.5">
                        <span className="flex flex-col gap-px">
                          <span className="text-[13px]">{p.ville ?? '—'}</span>
                          <span className="text-xs text-[var(--q-text-4)]">{p.departement ?? ''}</span>
                        </span>
                      </td>
                      <td className="!py-2.5 text-[13px] text-[var(--q-text-2)]">
                        {p.email ? (
                          <span className="inline-flex items-center gap-1.5">
                            {p.email}
                            {p.email_verified && (
                              <MailCheck className="size-3.5 shrink-0 text-[var(--q-ok)]" aria-label="Email vérifié" />
                            )}
                          </span>
                        ) : <span className="text-[var(--q-placeholder)]">—</span>}
                      </td>
                      <td className="!py-2.5"><StatutPill status={p.statut ?? 'nouveau'} /></td>
                      <td className="!py-2.5 whitespace-nowrap text-[13px] text-[var(--q-text-3)]">{fmtDate(p.date_scrape)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {/* Liste (mobile) */}
          <ul aria-label="Prospects" className="q-card q-list overflow-hidden !rounded-[18px] md:hidden">
            {prospects.map((p) => (
              <li key={p.id} className="flex items-start gap-3 px-3.5 py-3">
                <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="truncate text-[15px] font-semibold text-[var(--q-ink)]">{p.nom_entreprise || 'Sans nom'}</span>
                  <span className="truncate text-[13px] text-[var(--q-text-4)]">
                    {[metierLabel(p.metier_qonforme), [p.ville, p.departement].filter(Boolean).join(' ')].filter(Boolean).join(' · ')}
                  </span>
                  {p.email && <span className="truncate text-[13px] text-[var(--q-text-3)]">{p.email}</span>}
                </span>
                <StatutPill status={p.statut ?? 'nouveau'} />
              </li>
            ))}
          </ul>

          {totalPages > 1 && (
            <nav aria-label="Pagination" className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-[13px] text-[var(--q-text-4)]">
                {plural(total, 'résultat')} · page {fmtInt(page)} sur {fmtInt(totalPages)}
              </p>
              <div className="flex gap-2">
                {page > 1 && (
                  <Link href={pageHref(page - 1)} className="q-btn q-btn-secondary q-btn-sm">
                    <ChevronLeft aria-hidden />
                    Précédente
                  </Link>
                )}
                {page < totalPages && (
                  <Link href={pageHref(page + 1)} className="q-btn q-btn-secondary q-btn-sm">
                    Suivante
                    <ChevronRight aria-hidden />
                  </Link>
                )}
              </div>
            </nav>
          )}
        </>
      )}
    </div>
  )
}
