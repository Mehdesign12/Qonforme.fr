import { createAdminClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeft,
  Building2,
  Mail,
  CreditCard,
  FileText,
  ExternalLink,
} from 'lucide-react'

export const dynamic = 'force-dynamic'

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between py-2.5 border-b border-slate-50 dark:border-[#162032] last:border-0">
      <span className="text-[12px] text-slate-400 shrink-0 w-36">{label}</span>
      <span className="text-sm text-foreground text-right">{value || <span className="text-slate-300 dark:text-slate-600">—</span>}</span>
    </div>
  )
}

function SectionCard({ title, icon: Icon, children }: { title: string; icon: React.ElementType; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-slate-100 dark:border-[#1E3A5F] bg-white/95 dark:bg-[#0F1E35] overflow-hidden">
      <div className="px-4 py-3 border-b border-slate-100 dark:border-[#1E3A5F] flex items-center gap-2">
        <Icon className="w-4 h-4 text-slate-400" />
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
      </div>
      <div className="px-4 py-1">{children}</div>
    </div>
  )
}

function StatBadge({ count, label, href }: { count: number; label: string; href?: string }) {
  const content = (
    <div className="flex flex-col items-center justify-center p-4 rounded-xl border border-slate-100 dark:border-[#1E3A5F] bg-slate-50/60 dark:bg-[#162032]/40 text-center hover:border-[#2563EB] dark:hover:border-[#3B82F6] transition-colors cursor-pointer">
      <p className="font-mono text-2xl font-extrabold text-[#0F172A] dark:text-[#E2E8F0]">{count}</p>
      <p className="text-[11px] text-slate-400 mt-0.5">{label}</p>
    </div>
  )
  return href ? <Link href={href}>{content}</Link> : content
}

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

function InvoiceStatusPill({ status }: { status: string }) {
  const map: Record<string, { label: string; className: string }> = {
    draft:    { label: 'Brouillon', className: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400' },
    sent:     { label: 'Envoyée',   className: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' },
    paid:     { label: 'Payée',     className: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' },
    overdue:  { label: 'En retard', className: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' },
    canceled: { label: 'Annulée',   className: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' },
  }
  const s = map[status] ?? { label: status, className: 'bg-slate-100 text-slate-600' }
  return <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ${s.className}`}>{s.label}</span>
}

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
    admin.from('companies').select('*').eq('user_id', userId).single(),
    admin.from('subscriptions').select('*').eq('user_id', userId).single(),
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

  if (authRes.error || !authRes.data.user) return null

  return {
    auth:           authRes.data.user,
    company:        companyRes.data,
    subscription:   subRes.data,
    counts: {
      invoices:       invoicesCountRes.count ?? 0,
      quotes:         quotesCountRes.count ?? 0,
      clients:        clientsCountRes.count ?? 0,
      products:       productsCountRes.count ?? 0,
      purchaseOrders: purchaseOrdersCountRes.count ?? 0,
    },
    recentInvoices: recentInvoicesRes.data ?? [],
  }
}

export default async function AdminUserDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const data   = await getUserData(id)

  if (!data) notFound()

  const { auth, company, subscription, counts, recentInvoices } = data

  const fullName = [
    auth.user_metadata?.first_name,
    auth.user_metadata?.last_name,
  ].filter(Boolean).join(' ') || auth.email || id

  return (
    <div className="space-y-5 max-w-[960px] mx-auto">

      {/* Back */}
      <Link href="/admin/users" className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-foreground transition-colors">
        <ArrowLeft className="w-4 h-4" />
        Retour aux utilisateurs
      </Link>

      {/* Hero */}
      <div className="flex items-center gap-4">
        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-[#EFF6FF] dark:bg-[#1E3A5F] text-[#2563EB] dark:text-[#3B82F6] text-2xl font-extrabold">
          {(company?.name || auth.email || '?').charAt(0).toUpperCase()}
        </div>
        <div>
          <h1 className="text-[20px] font-extrabold text-[#0F172A] dark:text-[#E2E8F0] leading-tight">
            {company?.name || '—'}
          </h1>
          <p className="text-[13px] text-slate-400">{fullName}</p>
        </div>
        {subscription && <StatusPill status={subscription.status} />}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <StatBadge count={counts.invoices}       label="Factures" />
        <StatBadge count={counts.quotes}         label="Devis" />
        <StatBadge count={counts.clients}        label="Clients" />
        <StatBadge count={counts.products}       label="Produits" />
        <StatBadge count={counts.purchaseOrders} label="Bons de commande" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

        {/* Compte */}
        <SectionCard title="Compte" icon={Mail}>
          <InfoRow label="Email"       value={auth.email} />
          <InfoRow label="Prénom"      value={auth.user_metadata?.first_name} />
          <InfoRow label="Nom"         value={auth.user_metadata?.last_name} />
          <InfoRow label="Inscription" value={new Date(auth.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })} />
          <InfoRow label="Dernière connexion" value={auth.last_sign_in_at ? new Date(auth.last_sign_in_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' }) : null} />
        </SectionCard>

        {/* Entreprise */}
        <SectionCard title="Entreprise" icon={Building2}>
          <InfoRow label="Raison sociale" value={company?.name} />
          <InfoRow label="SIREN"          value={company?.siren} />
          <InfoRow label="SIRET"          value={company?.siret} />
          <InfoRow label="TVA intra."     value={company?.vat_number} />
          <InfoRow label="Ville"          value={[company?.city, company?.country].filter(Boolean).join(', ')} />
        </SectionCard>

        {/* Abonnement */}
        {subscription && (
          <SectionCard title="Abonnement" icon={CreditCard}>
            <InfoRow label="Plan"          value={<span className="capitalize">{subscription.plan}</span>} />
            <InfoRow label="Facturation"   value={subscription.billing_period === 'yearly' ? 'Annuelle' : 'Mensuelle'} />
            <InfoRow label="Statut"        value={<StatusPill status={subscription.status} />} />
            <InfoRow label="Renouvellement" value={subscription.current_period_end ? new Date(subscription.current_period_end).toLocaleDateString('fr-FR') : null} />
            <InfoRow label="Stripe sub."   value={
              subscription.stripe_subscription_id ? (
                <a
                  href={`https://dashboard.stripe.com/subscriptions/${subscription.stripe_subscription_id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[#2563EB] hover:underline inline-flex items-center gap-1"
                >
                  {subscription.stripe_subscription_id.slice(0, 20)}…
                  <ExternalLink className="w-3 h-3" />
                </a>
              ) : null
            } />
            <InfoRow label="Stripe customer" value={
              subscription.stripe_customer_id ? (
                <a
                  href={`https://dashboard.stripe.com/customers/${subscription.stripe_customer_id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[#2563EB] hover:underline inline-flex items-center gap-1"
                >
                  {subscription.stripe_customer_id}
                  <ExternalLink className="w-3 h-3" />
                </a>
              ) : null
            } />
          </SectionCard>
        )}

        {/* Dernières factures */}
        <div className="rounded-2xl border border-slate-100 dark:border-[#1E3A5F] bg-white/95 dark:bg-[#0F1E35] overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-100 dark:border-[#1E3A5F] flex items-center gap-2">
            <FileText className="w-4 h-4 text-slate-400" />
            <h3 className="text-sm font-semibold text-foreground">Dernières factures</h3>
          </div>
          {recentInvoices.length === 0 ? (
            <p className="px-4 py-6 text-sm text-slate-400 text-center">Aucune facture</p>
          ) : (
            <table className="w-full text-sm">
              <tbody className="divide-y divide-slate-50 dark:divide-[#1E3A5F]">
                {recentInvoices.map(inv => (
                  <tr key={inv.id} className="hover:bg-slate-50/60 dark:hover:bg-[#162032]/40 transition-colors">
                    <td className="px-4 py-2.5 font-mono text-[12px] text-foreground">{inv.invoice_number}</td>
                    <td className="px-4 py-2.5 text-[12px] text-slate-400">{inv.issue_date ? new Date(inv.issue_date).toLocaleDateString('fr-FR') : '—'}</td>
                    <td className="px-4 py-2.5 font-mono text-[12px] text-right text-foreground">
                      {inv.total_ttc?.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' }) ?? '—'}
                    </td>
                    <td className="px-4 py-2.5 text-right"><InvoiceStatusPill status={inv.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  )
}
