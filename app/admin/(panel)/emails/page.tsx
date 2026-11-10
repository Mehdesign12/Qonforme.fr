import Link from 'next/link'
import { Mail } from 'lucide-react'
import { createAdminClient } from '@/lib/supabase/server'
import { EmptyState, PageHeader, StatusPill } from '@/components/app/kit'
import { LoadError } from '@/components/admin/ui'
import { CATEGORY_LABELS } from '@/components/admin/emails/track'
import { templateLabel } from '@/lib/email/account-templates'
import { loadEmailStats, STEP_WINDOW_DAYS, type TemplateStats } from '@/lib/admin/email-stats'
import { cn } from '@/lib/utils'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Admin — Emails' }

const PERIODS = [7, 30, 90] as const

const pct = (n: number, d: number) => (d ? `${Math.round((n / d) * 100)} %` : '—')

function Reached({ s }: { s: TemplateStats }) {
  if (s.reached === null) return <span className="text-[var(--q-placeholder)]">Pas d&apos;étape mesurée</span>
  const share = s.sent ? s.reached / s.sent : 0
  return (
    <span className="flex min-w-[140px] items-center gap-2">
      <span className="font-semibold tabular-nums text-[var(--q-ok,var(--q-ink))]">{s.reached} / {s.sent}</span>
      <span aria-hidden className="h-1.5 flex-1 overflow-hidden rounded-full bg-[var(--q-sunken)]">
        <span className="block h-full rounded-full bg-[var(--q-accent)]" style={{ width: `${Math.round(share * 100)}%` }} />
      </span>
    </span>
  )
}

export default async function AdminEmailsPage({ searchParams }: { searchParams: Promise<{ jours?: string }> }) {
  const params = await searchParams
  const days = PERIODS.includes(Number(params.jours) as (typeof PERIODS)[number]) ? Number(params.jours) : 30
  const result = await loadEmailStats(createAdminClient(), days)

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Emails"
        subtitle={`Emails envoyés aux comptes, ${days} derniers jours`}
        actions={
          <div className="flex gap-1.5" role="group" aria-label="Période">
            {PERIODS.map((p) => (
              <Link
                key={p}
                href={`/admin/emails?jours=${p}`}
                aria-current={p === days ? 'page' : undefined}
                className={cn(
                  'inline-flex h-8 items-center rounded-full border px-3 text-[13px]',
                  p === days ? 'border-[var(--q-accent)] font-semibold text-[var(--q-accent-strong)]' : 'border-[var(--q-line)] text-[var(--q-text-2)] hover:bg-[var(--q-hover)]',
                )}
              >
                {p} jours
              </Link>
            ))}
          </div>
        }
      />

      {result.kind === 'unavailable' ? (
        <p role="status" className="q-banner q-banner-warn">
          Journal des emails pas encore activé : la migration <span className="font-mono">20261110_account_emails.sql</span> n&apos;est pas appliquée.
        </p>
      ) : result.kind === 'error' ? (
        <LoadError what="les emails envoyés" />
      ) : result.stats.length === 0 ? (
        <div className="q-card">
          <EmptyState icon={<Mail className="size-5" aria-hidden />} title="Aucun email sur la période" text="Les emails de démarrage, de reprise et ceux envoyés à la main apparaîtront ici." />
        </div>
      ) : (
        <>
          <section aria-label="Mesures par modèle" className="q-card hidden overflow-hidden md:block">
            <div className="overflow-x-auto">
              <table className="q-table min-w-[900px] [&_th]:border-t-0">
                <thead>
                  <tr className="bg-[var(--q-surface-2)]">
                    <th scope="col">Modèle</th>
                    <th scope="col">Envoyés</th>
                    <th scope="col">Rejetés</th>
                    <th scope="col">Cliqués</th>
                    <th scope="col">Étape franchie sous {STEP_WINDOW_DAYS} jours</th>
                  </tr>
                </thead>
                <tbody>
                  {result.stats.map((s) => {
                    const cat = CATEGORY_LABELS[s.category] ?? { label: s.category, tone: 'neutral' as const }
                    return (
                      <tr key={s.template}>
                        <td className="!py-2.5">
                          <span className="flex flex-col items-start gap-1">
                            <span className="font-semibold text-[var(--q-ink)]">{templateLabel(s.template)}</span>
                            <StatusPill tone={cat.tone} className="!h-5 !text-[11px]">{cat.label}</StatusPill>
                          </span>
                        </td>
                        <td className="!py-2.5 tabular-nums">{s.sent}</td>
                        <td className="!py-2.5 tabular-nums">{s.bounced}</td>
                        <td className="!py-2.5 tabular-nums">{s.clicked} <span className="text-[var(--q-text-3)]">({pct(s.clicked, s.sent)})</span></td>
                        <td className="!py-2.5"><Reached s={s} /></td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </section>

          <section aria-label="Mesures par modèle" className="q-card q-list overflow-hidden !rounded-[18px] md:hidden">
            {result.stats.map((s) => (
              <div key={s.template} className="flex flex-col gap-1.5 px-4 py-3">
                <span className="text-[15px] font-semibold">{templateLabel(s.template)}</span>
                <span className="text-[13px] text-[var(--q-text-3)]">
                  {s.sent} envoyés · {s.clicked} cliqués · {s.bounced} rejetés
                </span>
                <Reached s={s} />
              </div>
            ))}
          </section>

          <p className="max-w-3xl text-[13px] leading-relaxed text-[var(--q-text-3)]">
            La dernière colonne compte les comptes qui ont fait le geste visé dans les {STEP_WINDOW_DAYS} jours suivant l&apos;email (devis créé, devis envoyé, facture créée, abonnement). Pour les emails « entreprise », c&apos;est la présence d&apos;un SIREN aujourd&apos;hui : sa date d&apos;enregistrement n&apos;est pas gardée. Les clics passent par les liens de l&apos;email ; les ouvertures ne sont pas suivies.
          </p>
        </>
      )}
    </div>
  )
}
