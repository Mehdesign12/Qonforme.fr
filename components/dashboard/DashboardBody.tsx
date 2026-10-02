/**
 * Mise en page du tableau de bord, commune à /dashboard et /demo : la page
 * réelle et la démo rendent exactement ce composant, seule la vue change
 * (Supabase ou lib/demo/data.ts).
 *
 * Ordinateur (canevas « Tableau de bord ») : date, titre, quatre indicateurs,
 * puis deux colonnes dès 1100 px (graphique + dernières factures | à faire,
 * meilleurs clients, réforme). Mobile (canevas « Mobile — accueil ») : en-tête
 * avec l'entreprise, carte « À encaisser », actions rapides, à faire, dernières
 * factures, puis le reste. Un compte neuf voit les premiers pas (« Onb-8 »).
 */
import Image from "next/image"
import { PageHeader } from "@/components/app/kit"
import { LOGO_Q } from "@/lib/brand"
import type { DashboardView } from "@/components/dashboard/model"
import { DashboardStats, MobileHero } from "@/components/dashboard/DashboardStats"
import { QuickActions } from "@/components/dashboard/QuickActions"
import { RevenueChart } from "@/components/dashboard/RevenueChart"
import { RecentInvoices } from "@/components/dashboard/RecentInvoices"
import { TodoCard } from "@/components/dashboard/TodoCard"
import { TopClients } from "@/components/dashboard/TopClients"
import { ReformCard } from "@/components/dashboard/ReformCard"
import { GettingStarted } from "@/components/dashboard/GettingStarted"

/** Deux colonnes à partir de 1100 px ; en dessous, une seule, « À faire » en premier. */
const SPLIT = "flex flex-col gap-4 md:gap-5 min-[1100px]:grid min-[1100px]:grid-cols-[minmax(0,2fr)_minmax(300px,1fr)] min-[1100px]:items-start"
const COLUMN = "contents min-[1100px]:flex min-[1100px]:min-w-0 min-[1100px]:flex-col min-[1100px]:gap-5"

export function DashboardBody({ view }: { view: DashboardView }) {
  if (view.isNewAccount) return <GettingStarted view={view} />

  return (
    <div className="flex flex-col gap-4 md:gap-5">
      {/* En-tête mobile : date et entreprise */}
      <header className="flex items-center gap-2.5 md:hidden">
        <Image src={LOGO_Q} alt="" width={28} height={28} className="size-7 shrink-0" sizes="28px" />
        <span className="flex min-w-0 flex-col">
          <span className="text-xs text-[var(--q-text-4)]">{view.dateShort}</span>
          <span className="truncate text-base font-semibold text-[var(--q-ink)]">{view.companyName ?? "Tableau de bord"}</span>
        </span>
        <h1 className="sr-only">Tableau de bord</h1>
      </header>

      {/* En-tête ordinateur */}
      <PageHeader className="hidden md:flex" eyebrow={view.dateLong} title="Bonjour, voici votre mois." />

      <DashboardStats kpi={view.kpi} />
      <MobileHero kpi={view.kpi} />
      <QuickActions mode={view.mode} remindHref={view.remindHref} lateCount={view.kpi.late.count} />

      <div className={SPLIT}>
        <div className={COLUMN}>
          <div className="order-3 min-[1100px]:order-none">
            <RevenueChart chart={view.chart} recoveryRate={view.recoveryRate} />
          </div>
          <div className="order-2 min-[1100px]:order-none">
            <RecentInvoices rows={view.recent} mode={view.mode} />
          </div>
        </div>
        <div className={COLUMN}>
          <div className="order-1 min-[1100px]:order-none">
            <TodoCard todos={view.todos} mode={view.mode} />
          </div>
          {view.topClients.length > 0 && (
            <div className="order-4 min-[1100px]:order-none">
              <TopClients clients={view.topClients} />
            </div>
          )}
          <div className="order-5 min-[1100px]:order-none">
            <ReformCard reform={view.reform} mode={view.mode} />
          </div>
        </div>
      </div>
    </div>
  )
}
