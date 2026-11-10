import Link from "next/link"
import { notFound } from "next/navigation"
import { ChevronLeft } from "lucide-react"
import { createAdminClient } from "@/lib/supabase/server"
import { EmptyState, Kpi, KpiGrid, Panel, StatusPill } from "@/components/app/kit"
import { fmtDate, fmtInt } from "@/components/admin/ui"
import { SetCrumb } from "@/components/layout/crumb"
import { cookies } from "next/headers"
import { AffiliationError, NewBadge, NewTag, WeeklyBars, newLabel, planText } from "@/components/admin/affiliation/ui"
import { MarkAffSeen } from "@/components/admin/affiliation/MarkSeen"
import { SEEN_COOKIE, isNewLine, isNewSignup, parseSeen } from "@/lib/affiliation/news"
import { EditPartnerButton, LinkGenerator, PagesPanel, PayoutButton, StatsLinkButton } from "@/components/admin/affiliation/client"
import { partnerDetail, recentSignups } from "@/lib/affiliation/data"
import { DISPLAY_LABEL, DISPLAY_TONE, euros, percent, rateText } from "@/lib/affiliation/model"
import { MAIN_PAGES } from "@/lib/seo/links/catalog"
import { cn } from "@/lib/utils"

export const dynamic = "force-dynamic"
export const metadata = { title: "Admin — Partenaire" }

const TABS = [
  { key: "apercu", label: "Aperçu" },
  { key: "pages", label: "Pages et liens" },
  { key: "lien", label: "Générer un lien" },
  { key: "commissions", label: "Commissions" },
] as const
type TabKey = (typeof TABS)[number]["key"]

const HIDDEN_TARGETS = new Set(["/signup", "/demo", "/blog", "/glossaire", "/plan-du-site"])
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export default async function PartnerPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ onglet?: string }> }) {
  const { id } = await params
  const { onglet } = await searchParams
  if (!UUID.test(id)) notFound()
  const tab: TabKey = (TABS.find((t) => t.key === onglet)?.key ?? "apercu") as TabKey
  const db = createAdminClient()
  const [res, signups] = await Promise.all([partnerDetail(db, id), recentSignups(db)])
  if (!res.ok) return <AffiliationError failure={res} />
  if (!res.data) notFound()
  const { partner, stats, pages, links, weeks, visitsByPath, lines } = res.data
  // Nouveaux événements, relus avant que l'onglet ouvert ne les marque vus
  const seen = parseSeen((await cookies()).get(SEEN_COOKIE)?.value)
  const newSignups = signups.ok ? signups.data.filter((s) => s.partner_id === partner.id && isNewSignup(s, seen)).length : 0
  const newEvents = lines.filter((l) => isNewLine(l, seen)).length
  const c = stats.commissions
  const terms = rateText(partner.commission_rate, partner.commission_months)

  return (
    <div className="flex flex-col gap-5">
      <SetCrumb label={partner.name} />
      <Link href="/admin/affiliation" className="q-link -mb-2 inline-flex items-center gap-1 text-sm"><ChevronLeft className="size-4" aria-hidden />Partenaires</Link>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 flex-col gap-2">
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="q-h1">{partner.name}</h1>
            {partner.status === "archived"
              ? <StatusPill tone="neutral">Archivé</StatusPill>
              : stats.visitsAll > 0 ? <StatusPill tone="ok">Actif</StatusPill> : <StatusPill tone="neutral">En attente de la première visite</StatusPill>}
          </div>
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-[var(--q-text-3)]">
            <span>{partner.site || "Site non renseigné"}</span>
            <span>Code <span className="font-mono text-[var(--q-ink)]">{partner.code}</span></span>
            <span>{partner.contact_email ?? "Contact non renseigné"}</span>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {partner.status === "active" && (
            <StatsLinkButton partnerId={partner.id} partnerName={partner.name} contact={partner.contact_email} createdAt={partner.stats_token_created_at} views={partner.stats_views} />
          )}
          <EditPartnerButton partner={partner} />
        </div>
      </div>

      <nav aria-label="Sections du partenaire" className="q-tabs">
        {TABS.map((t) => (
          <Link key={t.key} href={`/admin/affiliation/${partner.id}${t.key === "apercu" ? "" : `?onglet=${t.key}`}`} aria-current={tab === t.key ? "page" : undefined} scroll={false} className="inline-flex items-center gap-1.5">
            {t.label}
            {t.key === "apercu" && <NewBadge count={newSignups} label={newLabel(newSignups, "signup")} />}
            {t.key === "commissions" && <NewBadge count={newEvents} label={newLabel(newEvents, "event")} />}
            {t.key === "pages" && links.missing > 0 && <span className="q-count !text-[var(--q-danger)]">{links.missing}</span>}
          </Link>
        ))}
      </nav>

      {tab === "apercu" && signups.ok && <MarkAffSeen partnerSignups={partner.id} />}
      {tab === "commissions" && <MarkAffSeen partnerCommissions={partner.id} />}

      {tab === "apercu" && (
        <>
          <KpiGrid>
            <Kpi label="Visites · 30 jours" value={fmtInt(stats.visits30)} sub={`${fmtInt(stats.visitsAll)} depuis le début`} />
            <Kpi label={<span className="inline-flex items-center gap-1.5">Inscrits · 30 jours<NewBadge count={newSignups} label={newLabel(newSignups, "signup")} /></span>} value={fmtInt(stats.signups30)} sub={`${fmtInt(stats.signupsAll)} depuis le début`} />
            <Kpi label="Abonnés payants" value={fmtInt(stats.paidAll)} sub={`dont ${fmtInt(stats.paid30)} ces 30 jours`} />
            <Kpi label="Visite → inscrit" value={percent(stats.signups30, stats.visits30)} sub="sur 30 jours" />
          </KpiGrid>
          <div className="flex flex-wrap items-stretch gap-4">
            <Panel title="Visites par semaine" className="min-w-0 flex-[999_1_420px]" bodyClassName="px-5 pb-5 pt-2">
              <WeeklyBars weeks={weeks} />
            </Panel>
            <Panel title="Commission" className="flex-[1_1_280px]" bodyClassName="flex flex-col gap-3 px-5 pb-5 pt-1 text-sm">
              <div className="flex justify-between"><span className="text-[var(--q-text-3)]">À verser</span><span className="font-bold tabular-nums text-[var(--q-accent-strong)]">{euros(c.due)}</span></div>
              <div className="flex justify-between"><span className="text-[var(--q-text-3)]">En attente (garantie)</span><span className="tabular-nums">{euros(c.pending)}</span></div>
              <div className="flex justify-between"><span className="text-[var(--q-text-3)]">Déjà versée</span><span className="tabular-nums">{euros(c.paidOut)}</span></div>
              <div className="h-px bg-[var(--q-line-soft)]" />
              <p className="q-field-hint">{terms}.</p>
              <Link href={`/admin/affiliation/${partner.id}?onglet=commissions`} className="q-btn q-btn-secondary q-btn-sm self-start">Voir le détail</Link>
            </Panel>
          </div>
          {visitsByPath.length > 0 && (
            <Panel title="Pages d'arrivée · 30 jours" bodyClassName="pb-2">
              <ul className="q-list border-t border-[var(--q-line-soft)]">
                {visitsByPath.slice(0, 10).map((v) => (
                  <li key={v.path} className="flex items-center justify-between gap-3 px-5 py-2.5 text-sm">
                    <span className="truncate font-mono text-[13px]">{v.path}</span>
                    <span className="tabular-nums">{fmtInt(v.count)}</span>
                  </li>
                ))}
              </ul>
            </Panel>
          )}
        </>
      )}

      {tab === "pages" && <PagesPanel partnerId={partner.id} pages={pages} visitsByPath={visitsByPath} />}

      {tab === "lien" && (
        <LinkGenerator
          partnerId={partner.id}
          code={partner.code}
          site={partner.site}
          targets={MAIN_PAGES.filter((p) => !HIDDEN_TARGETS.has(p.path)).map((p) => ({ title: p.title, path: p.path }))}
          recommendations={partner.recommendations}
          recommendationsAt={partner.recommendations_at}
        />
      )}

      {tab === "commissions" && (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-[var(--q-text-3)]">{terms}.</p>
            {c.due > 0 && <PayoutButton partnerId={partner.id} partnerName={partner.name} amount={euros(c.due)} />}
          </div>
          <div className="q-card overflow-x-auto">
            {lines.length === 0 ? (
              <EmptyState title="Aucun abonnement payant venu de ce partenaire" text="Une commission apparaît ici à chaque paiement d'un compte inscrit par son lien." />
            ) : (
              <table className="q-table">
                <thead><tr><th>Paiement du</th><th>Formule</th><th className="q-num">Montant payé</th><th className="q-num">Commission</th><th>État</th></tr></thead>
                <tbody>
                  {lines.map((l) => (
                    <tr key={l.id} className={cn(isNewLine(l, seen) ? "bg-[var(--q-info-bg)]" : !l.livemode && "opacity-60")}>
                      <td className="tabular-nums"><span className="inline-flex items-center gap-2">{fmtDate(l.paid_at)}{isNewLine(l, seen) && <NewTag />}</span></td>
                      <td>{planText(l.plan, l.billing_period)}{!l.livemode && <StatusPill tone="warn" className="ml-2">Essai</StatusPill>}</td>
                      <td className="q-num">{euros(l.amount_paid_cents)}</td>
                      <td className="q-num font-semibold">{l.display === "void" ? "—" : euros(l.commission_cents)}</td>
                      <td>
                        <StatusPill tone={DISPLAY_TONE[l.display]}>{DISPLAY_LABEL[l.display]}</StatusPill>
                        {l.display === "paid_out" && l.payout_at && <span className="ml-2 text-xs text-[var(--q-text-4)]">le {fmtDate(l.payout_at)}</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
          <p className="q-field-hint">
            Calculée sur les sommes réellement payées. Due 30 jours après le paiement (garantie de remboursement) ; un remboursement l&apos;annule. Le versement se fait par virement, puis se note ici. Les paiements du bac à sable (Essai) ne comptent jamais.
          </p>
        </>
      )}
    </div>
  )
}
