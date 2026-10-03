import { createAdminClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { ChevronRight, CreditCard, ExternalLink } from 'lucide-react'
import { EmptyState, PageHeader } from '@/components/app/kit'
import {
  FilterBar, FilterSelect, LoadError, StatLink, SubscriptionPill, fmtDate, fmtInt, periodLabel, planLabel, plural,
} from '@/components/admin/ui'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Admin — Abonnements' }

interface SearchParams { status?: string; plan?: string }

const LIMIT = 300

async function getSubscriptions(statusFilter: string, planFilter: string) {
  const admin = createAdminClient()

  let query = admin
    .from('subscriptions')
    .select('id, user_id, plan, billing_period, status, current_period_end, canceled_at, created_at, stripe_subscription_id, stripe_customer_id')
    .order('created_at', { ascending: false })

  if (statusFilter) query = query.eq('status', statusFilter)
  if (planFilter)   query = query.eq('plan', planFilter)

  const { data: subs, error } = await query.limit(LIMIT)
  if (error) return { rows: [], error: true }
  if (!subs?.length) return { rows: [], error: false }

  // Enrichir avec emails (si l'API Auth échoue, on affiche « — »)
  const { data: authData } = await admin.auth.admin.listUsers({ perPage: 1000 })
  const emailMap = new Map((authData?.users ?? []).map(u => [u.id, u.email]))

  // Enrichir avec noms d'entreprise
  const userIds = subs.map(s => s.user_id)
  const { data: companies } = await admin
    .from('companies')
    .select('user_id, name')
    .in('user_id', userIds)
  const companyMap = new Map((companies ?? []).map(c => [c.user_id, c.name]))

  return {
    rows: subs.map(s => ({
      ...s,
      email:       emailMap.get(s.user_id) ?? '—',
      companyName: companyMap.get(s.user_id) || 'Entreprise sans nom',
    })),
    error: false,
  }
}

/**
 * Comptages par statut sur toute la table : avant, ils étaient calculés sur la
 * liste filtrée (« Annulés : 0 » dès qu'on filtrait sur les actifs).
 */
async function getCounts() {
  const admin = createAdminClient()
  const head = () => admin.from('subscriptions').select('id', { count: 'exact', head: true })
  const [all, active, pastDue, canceled] = await Promise.all([
    head(),
    head().eq('status', 'active'),
    head().eq('status', 'past_due'),
    head().eq('status', 'canceled'),
  ])
  const n = (r: { count: number | null; error: unknown }) => (r.error ? '—' : fmtInt(r.count ?? 0))
  return { all: n(all), active: n(active), pastDue: n(pastDue), canceled: n(canceled) }
}

function renewalOf(s: { status: string; canceled_at: string | null; current_period_end: string | null }): string {
  if (s.status === 'canceled') return s.canceled_at ? `Résilié le ${fmtDate(s.canceled_at)}` : 'Résilié'
  return s.current_period_end ? fmtDate(s.current_period_end) : '—'
}

export default async function AdminSubscriptionsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>
}) {
  const params       = await searchParams
  const statusFilter = params.status ?? ''
  const planFilter   = params.plan ?? ''
  const filtered     = !!(statusFilter || planFilter)

  const [{ rows: subs, error }, counts] = await Promise.all([
    getSubscriptions(statusFilter, planFilter),
    getCounts(),
  ])

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Abonnements"
        subtitle={error ? 'Lecture impossible' : `${plural(subs.length, 'abonnement')}${filtered ? ' correspondant aux filtres' : ''}`}
      />

      <nav aria-label="Résumé par statut" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatLink label="Tous" value={counts.all} href="/admin/subscriptions" active={!filtered} />
        <StatLink label="Actifs" value={counts.active} href="/admin/subscriptions?status=active" active={statusFilter === 'active' && !planFilter} />
        <StatLink label="Paiement en retard" value={counts.pastDue} href="/admin/subscriptions?status=past_due" active={statusFilter === 'past_due' && !planFilter} tone={counts.pastDue !== '0' && counts.pastDue !== '—' ? 'warn' : 'default'} />
        <StatLink label="Résiliés" value={counts.canceled} href="/admin/subscriptions?status=canceled" active={statusFilter === 'canceled' && !planFilter} />
      </nav>

      <FilterBar resetHref="/admin/subscriptions" active={filtered} label="Filtrer les abonnements">
        <FilterSelect
          name="status"
          label="Statut"
          defaultValue={statusFilter}
          options={[
            { value: '', label: 'Tous les statuts' },
            { value: 'active', label: 'Actifs' },
            { value: 'past_due', label: 'Paiement en retard' },
            { value: 'canceled', label: 'Résiliés' },
            { value: 'incomplete', label: 'Paiement incomplet' },
            { value: 'trialing', label: 'En essai' },
          ]}
        />
        <FilterSelect
          name="plan"
          label="Formule"
          defaultValue={planFilter}
          options={[
            { value: '', label: 'Toutes les formules' },
            { value: 'starter', label: 'Essentiel' },
            { value: 'pro', label: 'Artisan' },
          ]}
        />
      </FilterBar>

      {error ? (
        <LoadError what="les abonnements" />
      ) : subs.length === 0 ? (
        <div className="q-card">
          <EmptyState
            icon={<CreditCard className="size-5" aria-hidden />}
            title={filtered ? 'Aucun abonnement ne correspond' : 'Aucun abonnement pour l\'instant'}
            text={filtered ? 'Modifiez les filtres ou effacez-les.' : 'Les abonnements souscrits apparaîtront ici.'}
          />
        </div>
      ) : (
        <>
          {/* Tableau (ordinateur) */}
          <section aria-label="Liste des abonnements" className="q-card hidden overflow-hidden md:block">
            <div className="overflow-x-auto">
              <table className="q-table min-w-[820px] [&_th]:border-t-0">
                <thead>
                  <tr className="bg-[var(--q-surface-2)]">
                    <th scope="col">Compte</th>
                    <th scope="col">Formule</th>
                    <th scope="col">Statut</th>
                    <th scope="col">Fin de période</th>
                    <th scope="col">Stripe</th>
                    <th scope="col"><span className="sr-only">Fiche</span></th>
                  </tr>
                </thead>
                <tbody>
                  {subs.map((s) => (
                    <tr key={s.id}>
                      <td className="!py-2.5">
                        <span className="flex min-w-0 flex-col gap-px">
                          <span className="font-semibold">{s.companyName}</span>
                          <span className="text-xs text-[var(--q-text-4)]">{s.email}</span>
                        </span>
                      </td>
                      <td className="!py-2.5 whitespace-nowrap">
                        <span className="font-medium">{planLabel(s.plan)}</span>
                        <span className="text-[13px] text-[var(--q-text-4)]"> · {periodLabel(s.billing_period)}</span>
                      </td>
                      <td className="!py-2.5"><SubscriptionPill status={s.status} /></td>
                      <td className="!py-2.5 whitespace-nowrap text-[13px] text-[var(--q-text-3)]">{renewalOf(s)}</td>
                      <td className="!py-2.5">
                        {s.stripe_subscription_id ? (
                          <a
                            href={`https://dashboard.stripe.com/subscriptions/${s.stripe_subscription_id}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="q-link inline-flex items-center gap-1 text-[13px]"
                          >
                            Ouvrir
                            <ExternalLink className="size-3.5" aria-hidden />
                            <span className="sr-only">l&apos;abonnement dans Stripe (nouvel onglet)</span>
                          </a>
                        ) : <span className="text-[var(--q-placeholder)]">—</span>}
                      </td>
                      <td className="w-px !py-2.5 text-right">
                        <Link href={`/admin/users/${s.user_id}`} className="q-btn q-btn-ghost q-btn-sm">
                          Fiche
                          <ChevronRight aria-hidden />
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {/* Liste (mobile) */}
          <section aria-label="Liste des abonnements" className="q-card q-list overflow-hidden !rounded-[18px] md:hidden">
            {subs.map((s) => (
              <Link key={s.id} href={`/admin/users/${s.user_id}`} className="q-list-row !items-start !gap-3 !px-3.5 !py-3">
                <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="truncate text-[15px] font-semibold">{s.companyName}</span>
                  <span className="truncate text-[13px] text-[var(--q-text-4)]">{s.email}</span>
                  <span className="text-[13px] text-[var(--q-text-3)]">{planLabel(s.plan)} · {periodLabel(s.billing_period)} · {renewalOf(s)}</span>
                </span>
                <SubscriptionPill status={s.status} className="shrink-0" />
              </Link>
            ))}
          </section>
        </>
      )}
    </div>
  )
}
