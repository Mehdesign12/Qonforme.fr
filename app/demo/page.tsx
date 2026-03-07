export const dynamic = "force-dynamic"

import { DashboardStats } from "@/components/dashboard/DashboardStats"
import { RecentInvoices } from "@/components/dashboard/RecentInvoices"
import { PPFStatusBanner } from "@/components/dashboard/PPFStatusBanner"

export default function DemoDashboardPage() {
  return (
    <div className="space-y-6 animate-fade-in">
      <PPFStatusBanner connected={false} />
      <DashboardStats />
      <div>
        <h2 className="text-base font-semibold text-[#0F172A] mb-3">Dernières factures</h2>
        <RecentInvoices />
      </div>
    </div>
  )
}
