import { Suspense } from "react"
import { DashboardStats } from "@/components/dashboard/DashboardStats"
import { RecentInvoices } from "@/components/dashboard/RecentInvoices"
import { PPFStatusBanner } from "@/components/dashboard/PPFStatusBanner"
import { Skeleton } from "@/components/ui/skeleton"
import type { Metadata } from "next"

export const metadata: Metadata = { title: "Tableau de bord" }

export default function DashboardPage() {
  return (
    <div className="space-y-6 animate-fade-in">
      {/* Bannière statut PPF */}
      <PPFStatusBanner connected={false} />

      {/* KPIs */}
      <Suspense fallback={<StatsLoading />}>
        <DashboardStats />
      </Suspense>

      {/* Dernières factures */}
      <div>
        <h2 className="text-base font-semibold text-[#0F172A] mb-3">Dernières factures</h2>
        <Suspense fallback={<TableLoading />}>
          <RecentInvoices />
        </Suspense>
      </div>
    </div>
  )
}

function StatsLoading() {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <Skeleton key={i} className="h-28 rounded-xl" />
      ))}
    </div>
  )
}

function TableLoading() {
  return (
    <div className="space-y-2">
      {Array.from({ length: 5 }).map((_, i) => (
        <Skeleton key={i} className="h-14 rounded-lg" />
      ))}
    </div>
  )
}
