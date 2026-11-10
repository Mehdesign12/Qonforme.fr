/**
 * Page privée de statistiques d'un partenaire : /partenaire/<jeton>.
 * Sans compte : le jeton (192 bits, seul son hachage est gardé) suffit. Ni
 * référencement, ni traceur, ni cache du service worker, ni Referer. Le
 * partenaire n'y voit que des totaux : jamais un nom, une adresse ou un document.
 */
import type { Metadata } from "next"
import Link from "next/link"
import { createAdminClient } from "@/lib/supabase/server"
import { partnerByToken, partnerDetail } from "@/lib/affiliation/data"
import { rateText } from "@/lib/affiliation/model"
import { MAIN_PAGES } from "@/lib/seo/links/catalog"
import { planText } from "@/components/admin/affiliation/ui"
import { PartnerStatsView, type PartnerView } from "@/components/affiliation/PartnerStatsView"
import { PUBLISHER } from "@/lib/legal/publisher"

export const dynamic = "force-dynamic"
export const metadata: Metadata = {
  title: "Espace partenaire",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
}

const TARGETS = new Set(["/", "/logiciel-devis-gratuit", "/modele", "/logiciel-gestion-batiment", "/logiciel-relance-factures-impayees", "/logiciel-dematerialisation-factures", "/pricing", "/outils"])

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-[100dvh] bg-[var(--q-bg)] px-4 pb-16 pt-4 md:px-6">
      <div className="mx-auto flex max-w-[1120px] flex-col gap-6">
        <header className="flex flex-wrap items-center gap-3 rounded-full border border-[var(--q-line)] bg-[var(--q-surface)] px-4 py-2.5 [box-shadow:var(--q-shadow-float)]">
          <span aria-hidden className="grid size-7 place-items-center rounded-lg bg-[var(--q-accent)] font-display text-base font-bold text-white">Q</span>
          <span className="font-display text-[17px] font-bold">Qonforme</span>
          <span className="text-sm text-[var(--q-text-4)]">Espace partenaire</span>
          <span className="q-pill q-pill-neutral ml-auto">Lien privé</span>
        </header>
        {children}
      </div>
    </div>
  )
}

export default async function PartnerStatsPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const db = createAdminClient()
  const found = await partnerByToken(db, token)
  if (!found.ok || !found.data) {
    return (
      <Shell>
        <div className="q-card flex flex-col items-start gap-3 p-6 md:p-8">
          <h1 className="q-h1">{found.ok ? "Ce lien ne marche plus." : "Statistiques indisponibles."}</h1>
          <p className="text-[15px] text-[var(--q-text-3)]">
            {found.ok
              ? "Il a été remplacé ou révoqué. Répondez à l'email qui vous l'a envoyé pour en recevoir un nouveau."
              : "Elles n'ont pas pu être lues pour le moment. Réessayez dans un instant."}
          </p>
          <Link href="/" className="q-link text-sm">qonforme.fr</Link>
        </div>
      </Shell>
    )
  }
  const detail = await partnerDetail(db, found.data.id)
  if (!detail.ok || !detail.data) {
    return (
      <Shell>
        <div className="q-card p-6"><p>Statistiques indisponibles pour le moment. Réessayez dans un instant.</p></div>
      </Shell>
    )
  }
  const { partner, stats, pages, weeks, visitsByPath, lines } = detail.data
  const live = lines.filter((l) => l.livemode)
  const visits = new Map(visitsByPath.map((v) => [v.path, v.count]))
  const targets = MAIN_PAGES.filter((p) => TARGETS.has(p.path)).map((p) => ({ title: p.title, path: p.path }))
  for (const r of partner.recommendations) if (!targets.some((t) => t.path === r.targetPath)) targets.push({ title: r.targetTitle, path: r.targetPath })

  const view: PartnerView = {
    name: partner.name,
    code: partner.code,
    terms: rateText(partner.commission_rate, partner.commission_months),
    stats,
    weeks,
    pages: pages
      .filter((p) => p.status === "found" || p.status === "missing")
      .map((p) => ({ url: p.url, target: p.target_path, found: p.status === "found", visits: p.target_path ? visits.get(p.target_path) ?? 0 : null })),
    lines: live.map((l) => ({ id: l.id, date: l.paid_at, plan: planText(l.plan, l.billing_period), paid: l.amount_paid_cents, commission: l.commission_cents, display: l.display })),
    targets,
  }

  return (
    <Shell>
      <PartnerStatsView view={view} />
      <footer className="flex flex-wrap justify-between gap-3 text-[13px] text-[var(--q-text-4)]">
        <span>Ce lien est personnel : ne le publiez pas. Une question ? Répondez à l&apos;email qui vous l&apos;a envoyé.</span>
        <span>Qonforme, édité par {PUBLISHER.name}</span>
      </footer>
    </Shell>
  )
}
