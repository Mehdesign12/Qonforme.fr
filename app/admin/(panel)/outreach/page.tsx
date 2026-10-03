import { createAdminClient } from '@/lib/supabase/server'
import { isAdminAuthenticated } from '@/lib/admin-require'
import { redirect } from 'next/navigation'
import { Megaphone } from 'lucide-react'
import { METIER_OPTIONS } from '@/lib/scraping/naf-mapping'
import { EmptyState, Kpi, PageHeader, StatusPill, type Tone } from '@/components/app/kit'
import { LoadError, ProspectingNotice, fmtDate, fmtInt, plural } from '@/components/admin/ui'
import OutreachActions from './OutreachActions'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Admin — Campagnes' }

const STATUT_MAP: Record<string, { label: string; tone: Tone }> = {
  brouillon:  { label: 'Brouillon',  tone: 'neutral' },
  planifiee:  { label: 'Planifiée',  tone: 'info' },
  en_cours:   { label: 'En cours',   tone: 'warn' },
  terminee:   { label: 'Terminée',   tone: 'ok' },
  pausee:     { label: 'En pause',   tone: 'neutral' },
}

function StatutPill({ status }: { status: string }) {
  const s = STATUT_MAP[status] ?? STATUT_MAP.brouillon
  return <StatusPill tone={s.tone}>{s.label}</StatusPill>
}

const METIER_LABEL = new Map(METIER_OPTIONS.map((m) => [m.value, m.label]))

function pct(a: number, b: number): string {
  if (b === 0) return '0 %'
  return `${Math.round((a / b) * 100)} %`
}

type Campaign = {
  id: string
  nom: string
  statut: string | null
  metier_cible: string | null
  date_envoi: string | null
  total_envois: number | null
  total_ouverts: number | null
  total_clics: number | null
  total_desabo: number | null
  total_convertis: number | null
}

async function getData() {
  const admin = createAdminClient()

  const { data, error } = await admin
    .from('campaigns')
    .select('*')
    .order('created_at', { ascending: false })

  // KPIs globaux
  const all = (data ?? []) as Campaign[]
  const sum = (key: keyof Campaign) => all.reduce((s, c) => s + (Number(c[key]) || 0), 0)

  return {
    campaigns: all,
    error: !!error,
    kpis: {
      totalEnvois: sum('total_envois'),
      totalOuverts: sum('total_ouverts'),
      totalClics: sum('total_clics'),
      totalDesabo: sum('total_desabo'),
      totalConvertis: sum('total_convertis'),
    },
  }
}

export default async function AdminOutreachPage() {
  if (!(await isAdminAuthenticated())) redirect('/admin/login')

  const { campaigns, kpis, error } = await getData()
  const running = campaigns.filter((c) => c.statut === 'en_cours')

  return (
    <div className="flex flex-col gap-5">
      <ProspectingNotice>
        {running.length > 0 && (
          <p className="text-[13px] font-semibold">
            {plural(running.length, 'campagne est encore en cours', 'campagnes sont encore en cours')} : mettez-{running.length > 1 ? 'les' : 'la'} en pause ci-dessous.
          </p>
        )}
      </ProspectingNotice>

      <PageHeader
        title="Campagnes"
        subtitle={error ? 'Lecture impossible' : `${plural(campaigns.length, 'campagne')} · ${plural(kpis.totalEnvois, 'email envoyé', 'emails envoyés')}`}
        actions={<OutreachActions />}
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Kpi label="Envoyés" value={error ? '—' : fmtInt(kpis.totalEnvois)} />
        <Kpi label="Ouverts" value={error ? '—' : fmtInt(kpis.totalOuverts)} sub={error ? undefined : pct(kpis.totalOuverts, kpis.totalEnvois)} />
        <Kpi label="Cliqués" value={error ? '—' : fmtInt(kpis.totalClics)} sub={error ? undefined : pct(kpis.totalClics, kpis.totalEnvois)} />
        <Kpi label="Convertis" value={error ? '—' : fmtInt(kpis.totalConvertis)} />
        <Kpi label="Désabonnés" value={error ? '—' : fmtInt(kpis.totalDesabo)} sub={error ? undefined : pct(kpis.totalDesabo, kpis.totalEnvois)} className="col-span-2 lg:col-span-1" />
      </div>

      {error ? (
        <LoadError what="les campagnes" />
      ) : campaigns.length === 0 ? (
        <div className="q-card">
          <EmptyState icon={<Megaphone className="size-5" aria-hidden />} title="Aucune campagne" text="Aucune campagne n'a été créée." />
        </div>
      ) : (
        <>
          {/* Tableau (ordinateur) */}
          <section aria-label="Campagnes" className="q-card hidden overflow-hidden md:block">
            <div className="overflow-x-auto">
              <table className="q-table min-w-[900px] [&_th]:border-t-0">
                <thead>
                  <tr className="bg-[var(--q-surface-2)]">
                    <th scope="col">Campagne</th>
                    <th scope="col">Cible</th>
                    <th scope="col">Statut</th>
                    <th scope="col" className="is-num">Envoyés</th>
                    <th scope="col" className="is-num">Ouverts</th>
                    <th scope="col" className="is-num">Clics</th>
                    <th scope="col" className="is-num">Convertis</th>
                    <th scope="col"><span className="sr-only">Action</span></th>
                  </tr>
                </thead>
                <tbody>
                  {campaigns.map((c) => {
                    const envois = c.total_envois ?? 0
                    const ouverts = c.total_ouverts ?? 0
                    const clics = c.total_clics ?? 0
                    return (
                      <tr key={c.id}>
                        <td className="!py-2.5">
                          <span className="flex flex-col gap-px">
                            <span className="font-semibold">{c.nom}</span>
                            <span className="text-xs text-[var(--q-text-4)]">{c.date_envoi ? `Lancée le ${fmtDate(c.date_envoi)}` : 'Non planifiée'}</span>
                          </span>
                        </td>
                        <td className="!py-2.5 text-[13px] text-[var(--q-text-3)]">{c.metier_cible ? METIER_LABEL.get(c.metier_cible) ?? c.metier_cible : 'Tous métiers'}</td>
                        <td className="!py-2.5"><StatutPill status={c.statut ?? 'brouillon'} /></td>
                        <td className="is-num !py-2.5 font-semibold">{fmtInt(envois)}</td>
                        <td className="is-num !py-2.5 text-[var(--q-text-2)]">{fmtInt(ouverts)} <span className="text-[var(--q-text-4)]">({pct(ouverts, envois)})</span></td>
                        <td className="is-num !py-2.5 text-[var(--q-text-2)]">{fmtInt(clics)} <span className="text-[var(--q-text-4)]">({pct(clics, envois)})</span></td>
                        <td className="is-num !py-2.5 text-[var(--q-text-2)]">{fmtInt(c.total_convertis ?? 0)}</td>
                        <td className="w-px whitespace-nowrap !py-2.5 text-right">
                          <OutreachActions campaignId={c.id} campaignStatut={c.statut ?? 'brouillon'} inline />
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </section>

          {/* Liste (mobile) */}
          <ul aria-label="Campagnes" className="q-card q-list overflow-hidden !rounded-[18px] md:hidden">
            {campaigns.map((c) => {
              const envois = c.total_envois ?? 0
              return (
                <li key={c.id} className="flex flex-col gap-2 px-3.5 py-3">
                  <div className="flex items-start gap-3">
                    <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                      <span className="truncate text-[15px] font-semibold text-[var(--q-ink)]">{c.nom}</span>
                      <span className="truncate text-[13px] text-[var(--q-text-4)]">
                        {(c.metier_cible ? METIER_LABEL.get(c.metier_cible) ?? c.metier_cible : 'Tous métiers')} · {plural(envois, 'envoi')} · {pct(c.total_ouverts ?? 0, envois)} d&apos;ouverture
                      </span>
                    </span>
                    <StatutPill status={c.statut ?? 'brouillon'} />
                  </div>
                  <div className="-ml-2"><OutreachActions campaignId={c.id} campaignStatut={c.statut ?? 'brouillon'} inline /></div>
                </li>
              )
            })}
          </ul>
        </>
      )}
    </div>
  )
}
