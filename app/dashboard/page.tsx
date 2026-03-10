import { Suspense } from 'react'
import { DashboardStats } from '@/components/dashboard/DashboardStats'
import { RecentInvoices } from '@/components/dashboard/RecentInvoices'
import { PPFStatusBanner } from '@/components/dashboard/PPFStatusBanner'
import { Skeleton } from '@/components/ui/skeleton'
import DashboardClient from '@/components/dashboard/DashboardClient'
import { createClient } from '@/lib/supabase/server'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Tableau de bord' }
export const dynamic = 'force-dynamic'

interface DashboardPageProps {
  searchParams: Promise<{ welcome?: string }>
}

export default async function DashboardPage({ searchParams }: DashboardPageProps) {
  const params = await searchParams
  const isWelcomeRedirect = params?.welcome === '1'

  let showWelcome = false

  if (isWelcomeRedirect) {
    // Vérifier si l'onboarding n'a pas encore été vu
    try {
      const supabase = await createClient()
      const { data: { user } } = await supabase.auth.getUser()

      if (user) {
        const { data: company } = await supabase
          .from('companies')
          .select('onboarding_seen_at')
          .eq('user_id', user.id)
          .single()

        // Afficher uniquement si jamais vu
        showWelcome = !company?.onboarding_seen_at
      }
    } catch {
      // Non bloquant
    }
  }

  return (
    <DashboardClient showWelcome={showWelcome}>
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
    </DashboardClient>
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
