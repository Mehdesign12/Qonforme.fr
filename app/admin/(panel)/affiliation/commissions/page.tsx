import Link from "next/link"
import { createAdminClient } from "@/lib/supabase/server"
import { EmptyState, Kpi, KpiGrid, Panel, PageHeader, StatusPill } from "@/components/app/kit"
import { fmtDate } from "@/components/admin/ui"
import { cookies } from "next/headers"
import { AffiliationError, NewBadge, NewTag, newLabel, planText } from "@/components/admin/affiliation/ui"
import { MarkAffSeen } from "@/components/admin/affiliation/MarkSeen"
import { EVENT_KINDS, SEEN_COOKIE, countNew, isNewLine, parseSeen, type EventKind, type Seen } from "@/lib/affiliation/news"
import { PayoutButton } from "@/components/admin/affiliation/client"
import { listCommissions } from "@/lib/affiliation/data"
import { DISPLAY_LABEL, DISPLAY_TONE, commissionTotals, euros, type CommissionDisplay } from "@/lib/affiliation/model"

export const dynamic = "force-dynamic"
export const metadata = { title: "Admin — Commissions" }

const FILTERS: { key: CommissionDisplay | "all"; label: string }[] = [
  { key: "due", label: "À verser" },
  { key: "pending", label: "En attente" },
  { key: "paid_out", label: "Versées" },
  { key: "void", label: "Annulées" },
  { key: "all", label: "Toutes" },
]

export default async function CommissionsPage({ searchParams }: { searchParams: Promise<{ filtre?: string }> }) {
  const { filtre } = await searchParams
  const filter = FILTERS.find((f) => f.key === filtre)?.key ?? "due"
  const res = await listCommissions(createAdminClient())
  // Ce que l'admin avait déjà vu, relu avant que la page ne le marque vu (repères « Nouveau »)
  const seen = parseSeen((await cookies()).get(SEEN_COOKIE)?.value)
  const marked: EventKind[] = filter === "all" ? EVENT_KINDS : EVENT_KINDS.includes(filter as EventKind) ? [filter as EventKind] : []

  return (
    <div className="flex flex-col gap-5">
      <PageHeader title={<>Commissions <span className="q-serif">à verser</span></>} subtitle="Calculées sur les abonnements payés par les inscrits de chaque partenaire." />
      {!res.ok ? <AffiliationError failure={res} /> : <Body lines={res.data.lines} filter={filter} seen={seen} />}
      {res.ok && marked.length > 0 && <MarkAffSeen commissions={marked} />}
    </div>
  )
}

function Body({ lines, filter, seen }: { lines: Extract<Awaited<ReturnType<typeof listCommissions>>, { ok: true }>["data"]["lines"]; filter: CommissionDisplay | "all"; seen: Seen }) {
  const totals = commissionTotals(lines)
  const fresh = countNew(lines, seen)
  const freshOf = (key: CommissionDisplay | "all") => (key === "all" ? fresh.total : key === "paid_out" ? 0 : fresh[key])
  const kpiLabel = (text: string, key: EventKind) => (
    <span className="inline-flex items-center gap-1.5">{text}<NewBadge count={fresh[key]} label={newLabel(fresh[key], "event")} /></span>
  )
  const groups = new Map<string, { name: string; cents: number; count: number }>()
  for (const l of lines) {
    if (!l.livemode || l.display !== "due") continue
    const g = groups.get(l.partner_id) ?? { name: l.partnerName, cents: 0, count: 0 }
    g.cents += l.commission_cents
    g.count++
    groups.set(l.partner_id, g)
  }
  const shown = lines.filter((l) => filter === "all" || l.display === filter)

  return (
    <>
      <KpiGrid>
        <Kpi label={kpiLabel("À verser", "due")} value={euros(totals.due)} sub="garantie de 30 jours passée" tone="ink" />
        <Kpi label={kpiLabel("En attente", "pending")} value={euros(totals.pending)} sub="paiements de moins de 30 jours" />
        <Kpi label="Déjà versées" value={euros(totals.paidOut)} sub="depuis le début" />
        <Kpi label={kpiLabel("Annulées", "void")} value={euros(totals.voided)} sub="abonnements remboursés" />
      </KpiGrid>
      <div className="flex flex-wrap items-start gap-4">
        <Panel title="À verser par partenaire" className="flex-[1_1_300px]" bodyClassName="flex flex-col gap-2 px-5 pb-5 pt-1">
          {groups.size === 0 ? (
            <p className="text-sm text-[var(--q-text-4)]">Rien à verser pour l&apos;instant.</p>
          ) : (
            Array.from(groups.entries()).map(([id, g]) => (
              <div key={id} className="flex items-center gap-3 rounded-xl border border-[var(--q-line)] p-3">
                <div className="min-w-0 flex-1">
                  <Link href={`/admin/affiliation/${id}?onglet=commissions`} className="font-semibold text-[var(--q-ink)] hover:text-[var(--q-accent-strong)]">{g.name}</Link>
                  <div className="text-xs text-[var(--q-text-4)]">{g.count} paiement{g.count > 1 ? "s" : ""}</div>
                </div>
                <span className="font-bold tabular-nums">{euros(g.cents)}</span>
                <PayoutButton partnerId={id} partnerName={g.name} amount={euros(g.cents)} size="sm" />
              </div>
            ))
          )}
        </Panel>
        <div className="flex min-w-0 flex-[999_1_520px] flex-col gap-3">
          <nav aria-label="Filtrer les commissions" className="q-seg self-start">
            {FILTERS.map((f) => (
              <Link key={f.key} href={f.key === "due" ? "/admin/affiliation/commissions" : `/admin/affiliation/commissions?filtre=${f.key}`} aria-current={filter === f.key ? "page" : undefined} className="inline-flex items-center gap-1.5">
                {f.label}
                <NewBadge count={freshOf(f.key)} label={newLabel(freshOf(f.key), "event")} />
              </Link>
            ))}
          </nav>
          <div className="q-card overflow-x-auto">
            {shown.length === 0 ? (
              <EmptyState title="Aucune ligne dans ce filtre" />
            ) : (
              <table className="q-table">
                <thead><tr><th>Paiement du</th><th>Partenaire</th><th>Formule</th><th className="q-num">Payé</th><th className="q-num">Commission</th><th>État</th></tr></thead>
                <tbody>
                  {shown.map((l) => (
                    <tr key={l.id} className={isNewLine(l, seen) ? "bg-[var(--q-info-bg)]" : !l.livemode ? "opacity-60" : undefined}>
                      <td className="tabular-nums"><span className="inline-flex items-center gap-2">{fmtDate(l.paid_at)}{isNewLine(l, seen) && <NewTag />}</span></td>
                      <td>{l.partnerName}</td>
                      <td>{planText(l.plan, l.billing_period)}{!l.livemode && <StatusPill tone="warn" className="ml-2">Essai</StatusPill>}</td>
                      <td className="q-num">{euros(l.amount_paid_cents)}</td>
                      <td className="q-num font-semibold">{l.display === "void" ? "—" : euros(l.commission_cents)}</td>
                      <td><StatusPill tone={DISPLAY_TONE[l.display]}>{DISPLAY_LABEL[l.display]}</StatusPill></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
          <p className="q-field-hint">Le versement se fait par virement, à la main ; « Versé » le note ici. Les paiements du bac à sable (Essai) ne comptent jamais.</p>
        </div>
      </div>
    </>
  )
}
