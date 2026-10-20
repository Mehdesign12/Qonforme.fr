import { redirect } from "next/navigation"
import { isAdminAuthenticated } from "@/lib/admin-require"
import { CircleCheck, CircleX } from "lucide-react"
import { PageHeader, Panel, StatusPill } from "@/components/app/kit"
import { ActivityPanels, ModeTabs } from "@/components/admin/payments/ActivityPanels"
import { loadActivity } from "@/lib/stripe/admin-activity"
import { TestAccountsPanel } from "@/components/admin/payments/TestAccountsPanel"
import { listTestAccounts } from "@/lib/stripe/test-accounts"
import { stripeEnvStatus, type StripeMode } from "@/lib/stripe/mode"
import { VAT_COLLECTED } from "@/lib/stripe/plans"

export const dynamic = "force-dynamic"
export const metadata = { title: "Admin — Paiements" }

const MODE_TITLE: Record<StripeMode, string> = {
  live: "Production (vrais clients)",
  test: "Bac à sable (comptes d’essai)",
}

function EnvList({ mode }: { mode: StripeMode }) {
  const items = stripeEnvStatus(mode)
  const complete = items.every((i) => i.present)
  return (
    <Panel
      title={MODE_TITLE[mode]}
      action={<StatusPill tone={complete ? "ok" : "warn"}>{complete ? "Complet" : "Incomplet"}</StatusPill>}
      bodyClassName="px-5 pb-5"
    >
      <ul className="flex flex-col gap-1.5">
        {items.map((item) => (
          <li key={item.name} className="flex items-center gap-2 text-sm">
            {item.present
              ? <CircleCheck className="h-4 w-4 text-[var(--q-ok)]" aria-label="Présente" />
              : <CircleX className="h-4 w-4 text-[var(--q-danger)]" aria-label="Manquante" />}
            <code className="font-mono text-[13px] text-[var(--q-text-2)]">{item.name}</code>
          </li>
        ))}
      </ul>
    </Panel>
  )
}

export default async function AdminPaymentsPage({ searchParams }: { searchParams: Promise<{ mode?: string }> }) {
  if (!(await isAdminAuthenticated())) redirect("/admin/login")

  const { mode: rawMode } = await searchParams
  const mode: StripeMode = rawMode === "test" ? "test" : "live"
  const [accounts, activity] = await Promise.all([listTestAccounts(), loadActivity(mode)])

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Paiements"
        subtitle="Encaissements, remboursements et abonnements Stripe, comptes d’essai"
        actions={<ModeTabs mode={mode} />}
      />

      <ActivityPanels mode={mode} activity={activity} />

      <Panel title="TVA sur l’abonnement" bodyClassName="px-5 pb-5">
        <p className="text-sm text-[var(--q-text-3)]">
          {VAT_COLLECTED
            ? "La TVA est ajoutée au paiement par Stripe Tax, et le numéro de TVA des entreprises est demandé."
            : "Aucune TVA n’est ajoutée au paiement : le prix affiché est le prix payé. Décision du 19/10/2026 (DECISIONS-STRATEGIQUES.md § 14), en attendant l’inscription de la LLC à la TVA."}
        </p>
      </Panel>

      <div className="grid gap-5 lg:grid-cols-2">
        <EnvList mode="live" />
        <EnvList mode="test" />
      </div>
      <p className="-mt-2 text-sm text-[var(--q-text-4)]">
        Seuls les noms des variables sont vérifiés : leurs valeurs ne sont jamais lues ni affichées. Elles se règlent dans Vercel.
      </p>

      {accounts.ok ? (
        <TestAccountsPanel accounts={accounts.data} />
      ) : (
        <div role="alert" className="q-banner q-banner-warn">
          <p>{accounts.error}</p>
        </div>
      )}
    </div>
  )
}
