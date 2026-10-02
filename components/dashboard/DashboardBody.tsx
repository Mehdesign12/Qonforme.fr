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
import Link from "next/link"
import { Bell } from "lucide-react"
import { PageHeader } from "@/components/app/kit"
import { LOGO_Q } from "@/lib/brand"
import { cn } from "@/lib/utils"
import { DASH_PERIODS, hrefFor, plural, type DashboardView } from "@/components/dashboard/model"
import { SOLID } from "@/components/dashboard/ui"
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

/**
 * « Ce mois / Trimestre / Année » : change le premier indicateur. Liens
 * (?periode=…) rendus côté serveur, sans JavaScript.
 */
function PeriodSwitch({ view }: { view: DashboardView }) {
  const base = hrefFor(view.mode, "/dashboard")
  return (
    // Fond du canevas (#E9EDF4) : --q-sunken du kit est trop proche du fond de page ici
    <nav aria-label="Période" className="q-seg">
      {DASH_PERIODS.map((p) => {
        const active = p.key === view.period
        return (
          <Link
            key={p.key}
            href={p.key === "mois" ? base : `${base}?periode=${p.key}`}
            aria-current={active ? "true" : undefined}
            className={cn(active && "is-active")}
            scroll={false}
          >
            {p.label}
          </Link>
        )
      })}
    </nav>
  )
}

export function DashboardBody({ view }: { view: DashboardView }) {
  if (view.isNewAccount) return <GettingStarted view={view} />

  const noun = DASH_PERIODS.find((p) => p.key === view.period)?.noun ?? "mois"
  const late = view.kpi.late.count

  return (
    <div className="flex flex-col gap-4 md:gap-5">
      {/* En-tête mobile : date et entreprise */}
      <header className="flex items-center gap-2.5 md:hidden">
        <Image src={LOGO_Q} alt="" width={28} height={28} className="size-7 shrink-0" sizes="28px" />
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="text-[13px] text-[var(--q-text-4)]">{view.dateShort}</span>
          <span className="truncate text-[17px] font-semibold tracking-[-0.01em] text-[var(--q-ink)]">
            {view.companyName ?? "Tableau de bord"}
          </span>
        </span>
        <h1 className="sr-only">Tableau de bord</h1>
        {/* Cloche : factures à surveiller (point si une facture est en retard) */}
        <Link
          href={view.remindHref}
          aria-label={late > 0 ? `À surveiller\u00a0: ${late}\u00a0${plural(late, "facture en retard", "factures en retard")}` : "À surveiller\u00a0: aucune facture en retard"}
          className={cn(SOLID, "relative grid size-10 shrink-0 place-items-center rounded-xl text-[var(--q-text-2)]")}
        >
          <Bell className="size-[18px]" strokeWidth={1.75} aria-hidden />
          {late > 0 && <span className="absolute right-2 top-2 size-2 rounded-full bg-[var(--q-accent)] ring-2 ring-[var(--q-surface)]" aria-hidden />}
        </Link>
      </header>

      {/* En-tête ordinateur */}
      <PageHeader
        className="hidden md:flex"
        eyebrow={view.dateLong}
        title={`Bonjour, voici votre ${noun}.`}
        actions={<PeriodSwitch view={view} />}
      />

      <DashboardStats kpi={view.kpi} period={view.period} />
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
