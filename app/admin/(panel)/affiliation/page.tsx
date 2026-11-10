import Link from "next/link"
import { CircleAlert, Link2 } from "lucide-react"
import { createAdminClient } from "@/lib/supabase/server"
import { EmptyState, Kpi, KpiGrid, PageHeader, StatusPill } from "@/components/app/kit"
import { fmtInt } from "@/components/admin/ui"
import { AffiliationError } from "@/components/admin/affiliation/ui"
import { NewPartnerButton } from "@/components/admin/affiliation/client"
import { listPartners } from "@/lib/affiliation/data"
import { euros, percent } from "@/lib/affiliation/model"

export const dynamic = "force-dynamic"
export const metadata = { title: "Admin — Partenaires" }

export default async function AffiliationPage() {
  const res = await listPartners(createAdminClient())

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title={<>Partenaires <span className="q-serif">qui citent Qonforme</span></>}
        subtitle="Les sites qui ont un lien vers Qonforme, ce que ces liens amènent et la commission due."
        actions={res.ok ? <NewPartnerButton /> : undefined}
      />
      {!res.ok ? (
        <AffiliationError failure={res} />
      ) : res.data.length === 0 ? (
        <EmptyState
          icon={<Link2 />}
          title="Aucun partenaire pour l'instant"
          text="Ajoutez un site qui cite Qonforme : vous lui donnerez un lien suivi (?ref=) et verrez ce qu'il amène."
          action={<NewPartnerButton />}
        />
      ) : (
        <List items={res.data} />
      )}
    </div>
  )
}

function List({ items }: { items: Extract<Awaited<ReturnType<typeof listPartners>>, { ok: true }>["data"] }) {
  const active = items.filter((i) => i.partner.status === "active")
  const sum = (f: (i: (typeof items)[number]) => number) => active.reduce((s, i) => s + f(i), 0)
  const visits = sum((i) => i.stats.visits30)
  const signups = sum((i) => i.stats.signups30)
  const missing = sum((i) => i.links.missing)
  const notFollowed = sum((i) => i.links.notFollowed)
  const alerts = [missing ? `${missing} lien${missing > 1 ? "s" : ""} introuvable${missing > 1 ? "s" : ""}` : "", notFollowed ? `${notFollowed} lien${notFollowed > 1 ? "s" : ""} non suivi${notFollowed > 1 ? "s" : ""}` : ""].filter(Boolean)

  return (
    <>
      <KpiGrid>
        <Kpi label="Visites amenées · 30 jours" value={fmtInt(visits)} sub="par les liens ?ref=" />
        <Kpi label="Inscrits · 30 jours" value={fmtInt(signups)} sub={`${percent(signups, visits)} des visites`} />
        <Kpi label="Abonnés payants · 30 jours" value={fmtInt(sum((i) => i.stats.paid30))} sub="Premier paiement ces 30 jours" />
        <Kpi label="Commission à verser" value={euros(sum((i) => i.stats.commissions.due))} sub={`${euros(sum((i) => i.stats.commissions.pending))} en attente (garantie de 30 jours)`} tone="ink" />
      </KpiGrid>
      {alerts.length > 0 && (
        <div role="alert" className="q-banner q-banner-danger items-center">
          <CircleAlert className="size-4 shrink-0" aria-hidden />
          <p><strong>{alerts.join(" · ")}</strong> — contrôle hebdomadaire des pages des partenaires.</p>
        </div>
      )}

      <div className="q-card hidden overflow-x-auto md:block">
        <table className="q-table">
          <thead>
            <tr>
              <th>Partenaire</th><th>Code</th><th className="q-num">Visites 30 j</th><th className="q-num">Inscrits 30 j</th>
              <th className="q-num">Abonnés</th><th className="q-num">À verser</th><th>Liens</th>
            </tr>
          </thead>
          <tbody>
            {items.map(({ partner, stats, links }) => (
              <tr key={partner.id} className={partner.status === "archived" ? "opacity-60" : undefined}>
                <td>
                  <Link href={`/admin/affiliation/${partner.id}`} className="font-semibold text-[var(--q-ink)] hover:text-[var(--q-accent-strong)]">{partner.name}</Link>
                  <div className="text-xs text-[var(--q-text-4)]">{partner.site || "—"}{partner.status === "archived" ? " · archivé" : ""}</div>
                </td>
                <td><span className="font-mono text-[13px] text-[var(--q-text-2)]">{partner.code}</span></td>
                <td className="q-num">{fmtInt(stats.visits30)}</td>
                <td className="q-num">{fmtInt(stats.signups30)}</td>
                <td className="q-num">{fmtInt(stats.paidAll)}</td>
                <td className="q-num font-semibold">{stats.commissions.due ? euros(stats.commissions.due) : "—"}</td>
                <td><StatusPill tone={links.tone}>{links.label}</StatusPill></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ul className="q-card q-list md:hidden">
        {items.map(({ partner, stats, links }) => (
          <li key={partner.id}>
            <Link href={`/admin/affiliation/${partner.id}`} className="q-list-row">
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="truncate font-semibold">{partner.name}</span>
                <span className="truncate text-xs text-[var(--q-text-4)]">{fmtInt(stats.visits30)} visites · {fmtInt(stats.signups30)} inscrits · {fmtInt(stats.paidAll)} abonnés</span>
              </span>
              <span className="flex flex-col items-end gap-1">
                <span className="text-sm font-semibold tabular-nums">{stats.commissions.due ? euros(stats.commissions.due) : "—"}</span>
                <StatusPill tone={links.tone}>{links.label}</StatusPill>
              </span>
            </Link>
          </li>
        ))}
      </ul>
      <p className="q-field-hint">
        Une visite est comptée à l&apos;arrivée sur qonforme.fr avec ?ref=code (ni adresse IP ni identifiant). L&apos;inscrit et l&apos;abonné sont rattachés au partenaire par le code gardé jusqu&apos;à l&apos;inscription (90 jours, dernier lien suivi).
      </p>
    </>
  )
}
