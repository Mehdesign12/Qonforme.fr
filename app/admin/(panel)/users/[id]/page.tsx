import { createAdminClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import { ExternalLink } from 'lucide-react'
import { DocStatusPill, Initials, Kpi, KpiGrid, PageHeader, Panel } from '@/components/app/kit'
import { SetCrumb } from '@/components/layout/crumb'
import { InfoList, InfoRow, LoadError, SubscriptionPill, fmtDate, fmtEuro, periodLabel, planLabel } from '@/components/admin/ui'
import AdminChangePlanButton from './AdminChangePlanButton'
import AdminSubscriptionActions from './AdminSubscriptionActions'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Admin — Fiche utilisateur' }

async function getUserData(userId: string) {
  const admin = createAdminClient()

  const [
    authRes,
    companyRes,
    subRes,
    invoicesCountRes,
    quotesCountRes,
    clientsCountRes,
    productsCountRes,
    purchaseOrdersCountRes,
    recentInvoicesRes,
  ] = await Promise.all([
    admin.auth.admin.getUserById(userId),
    admin.from('companies').select('*').eq('user_id', userId).maybeSingle(),
    admin.from('subscriptions').select('*').eq('user_id', userId).maybeSingle(),
    admin.from('invoices').select('id', { count: 'exact', head: true }).eq('user_id', userId),
    admin.from('quotes').select('id', { count: 'exact', head: true }).eq('user_id', userId),
    admin.from('clients').select('id', { count: 'exact', head: true }).eq('user_id', userId),
    admin.from('products').select('id', { count: 'exact', head: true }).eq('user_id', userId),
    admin.from('purchase_orders').select('id', { count: 'exact', head: true }).eq('user_id', userId),
    admin.from('invoices')
      .select('id, invoice_number, total_ttc, status, issue_date')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(5),
  ])

  // Compte introuvable → 404. Toute autre erreur (réseau, API Auth en panne)
  // s'affiche comme telle au lieu de passer pour un compte inexistant.
  if (authRes.error) {
    const status = (authRes.error as { status?: number }).status
    if (status === 404 || status === 400) return { kind: 'missing' as const }
    return { kind: 'error' as const }
  }
  if (!authRes.data.user) return { kind: 'missing' as const }

  const count = (r: { count: number | null; error: unknown }) => (r.error ? null : r.count ?? 0)

  return {
    kind: 'ok' as const,
    auth:           authRes.data.user,
    company:        companyRes.data,
    companyError:   !!companyRes.error,
    subscription:   subRes.data,
    subscriptionError: !!subRes.error,
    counts: {
      invoices:       count(invoicesCountRes),
      quotes:         count(quotesCountRes),
      clients:        count(clientsCountRes),
      products:       count(productsCountRes),
      purchaseOrders: count(purchaseOrdersCountRes),
    },
    recentInvoices: recentInvoicesRes.data ?? [],
    recentInvoicesError: !!recentInvoicesRes.error,
  }
}

function StripeLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className="q-link inline-flex max-w-full items-center gap-1 font-mono text-[13px] !font-medium">
      <span className="truncate">{children}</span>
      <ExternalLink className="size-3.5 shrink-0" aria-hidden />
      <span className="sr-only">(ouvre Stripe dans un nouvel onglet)</span>
    </a>
  )
}

export default async function AdminUserDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const data   = await getUserData(id)

  if (data.kind === 'missing') notFound()
  if (data.kind === 'error') {
    return (
      <div className="flex flex-col gap-5">
        <PageHeader title="Fiche utilisateur" backHref="/admin/users" backLabel="Utilisateurs" />
        <LoadError what="ce compte" />
      </div>
    )
  }

  const { auth, company, subscription, counts, recentInvoices } = data

  const fullName = [
    auth.user_metadata?.first_name,
    auth.user_metadata?.last_name,
  ].filter(Boolean).join(' ') || auth.email || id

  const title = company?.name || auth.email || 'Compte sans entreprise'

  return (
    <div className="flex flex-col gap-5">
      <SetCrumb label={title} />
      <PageHeader
        backHref="/admin/users"
        backLabel="Utilisateurs"
        title={
          <span className="flex items-center gap-3">
            <Initials name={title} ink className="!size-11 !rounded-xl !text-sm" />
            <span className="min-w-0 break-words">{title}</span>
          </span>
        }
        subtitle={fullName}
        actions={subscription ? <SubscriptionPill status={subscription.status} /> : <SubscriptionPill status="none" />}
      />

      <KpiGrid className="!grid-cols-2 sm:!grid-cols-3 xl:!grid-cols-5">
        <Kpi label="Factures" value={counts.invoices ?? '—'} />
        <Kpi label="Devis" value={counts.quotes ?? '—'} />
        <Kpi label="Clients" value={counts.clients ?? '—'} />
        <Kpi label="Prestations" value={counts.products ?? '—'} />
        <Kpi label="Bons de commande" value={counts.purchaseOrders ?? '—'} className="max-sm:col-span-2" />
      </KpiGrid>

      <div className="grid gap-5 lg:grid-cols-2">
        <Panel title="Compte">
          <InfoList>
            <InfoRow label="Email">{auth.email}</InfoRow>
            <InfoRow label="Prénom">{auth.user_metadata?.first_name}</InfoRow>
            <InfoRow label="Nom">{auth.user_metadata?.last_name}</InfoRow>
            <InfoRow label="Inscription">{fmtDate(auth.created_at, { day: 'numeric', month: 'long', year: 'numeric' })}</InfoRow>
            <InfoRow label="Dernière connexion">{auth.last_sign_in_at ? fmtDate(auth.last_sign_in_at) : null}</InfoRow>
          </InfoList>
        </Panel>

        <Panel title="Entreprise">
          {data.companyError ? (
            <LoadError what="l'entreprise de ce compte" compact />
          ) : (
            <InfoList>
              <InfoRow label="Raison sociale">{company?.name}</InfoRow>
              <InfoRow label="SIREN">{company?.siren && <span className="font-mono">{company.siren}</span>}</InfoRow>
              <InfoRow label="SIRET">{company?.siret && <span className="font-mono">{company.siret}</span>}</InfoRow>
              <InfoRow label="TVA intracommunautaire">{company?.vat_number && <span className="font-mono">{company.vat_number}</span>}</InfoRow>
              <InfoRow label="Ville">{[company?.city, company?.country].filter(Boolean).join(', ')}</InfoRow>
            </InfoList>
          )}
        </Panel>

        <Panel title="Abonnement">
          {data.subscriptionError ? (
            <LoadError what="l'abonnement de ce compte" compact />
          ) : !subscription ? (
            <p className="px-5 pb-5 text-sm text-[var(--q-text-3)]">
              Aucun abonnement : le compte utilise la version gratuite (devis, clients, brouillons).
            </p>
          ) : (
            <>
              <InfoList>
                <InfoRow label="Formule">{planLabel(subscription.plan)}</InfoRow>
                <InfoRow label="Facturation">{periodLabel(subscription.billing_period)}</InfoRow>
                <InfoRow label="Statut"><SubscriptionPill status={subscription.status} /></InfoRow>
                <InfoRow label="Fin de période">{subscription.current_period_end ? fmtDate(subscription.current_period_end, { day: 'numeric', month: 'long', year: 'numeric' }) : null}</InfoRow>
                <InfoRow label="Abonnement Stripe">
                  {subscription.stripe_subscription_id && (
                    <StripeLink href={`https://dashboard.stripe.com/subscriptions/${subscription.stripe_subscription_id}`}>
                      {subscription.stripe_subscription_id}
                    </StripeLink>
                  )}
                </InfoRow>
                <InfoRow label="Client Stripe">
                  {subscription.stripe_customer_id && (
                    <StripeLink href={`https://dashboard.stripe.com/customers/${subscription.stripe_customer_id}`}>
                      {subscription.stripe_customer_id}
                    </StripeLink>
                  )}
                </InfoRow>
              </InfoList>
              <div className="flex flex-col gap-3 border-t border-[var(--q-line-soft)] px-5 py-4">
                {(subscription.plan === 'starter' || subscription.plan === 'pro') && (
                  <AdminChangePlanButton
                    userId={id}
                    currentPlan={subscription.plan}
                    hasStripeSubscription={!!subscription.stripe_subscription_id && (subscription.status === 'active' || subscription.status === 'past_due')}
                    isDowngrade={subscription.plan === 'pro'}
                  />
                )}
                <AdminSubscriptionActions
                  userId={id}
                  currentStatus={subscription.status}
                  currentPeriodEnd={subscription.current_period_end}
                />
              </div>
            </>
          )}
        </Panel>

        <Panel title="Dernières factures">
          {data.recentInvoicesError ? (
            <LoadError what="les factures de ce compte" compact />
          ) : recentInvoices.length === 0 ? (
            <p className="px-5 pb-5 text-sm text-[var(--q-text-4)]">Aucune facture.</p>
          ) : (
            <ul className="q-list border-t border-[var(--q-line-soft)]">
              {recentInvoices.map(inv => (
                <li key={inv.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-5 py-3">
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate font-mono text-[13px] text-[var(--q-ink)]">{inv.invoice_number || 'Brouillon sans numéro'}</span>
                    <span className="text-xs text-[var(--q-text-4)]">{inv.issue_date ? fmtDate(inv.issue_date) : 'Date non renseignée'}</span>
                  </span>
                  <span className="text-sm font-semibold tabular-nums text-[var(--q-ink)]">
                    {typeof inv.total_ttc === 'number' ? fmtEuro(inv.total_ttc, 2) : '—'}
                  </span>
                  <DocStatusPill kind="invoice" status={inv.status} />
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </div>
  )
}
