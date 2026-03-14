import { Suspense } from 'react'
import { DashboardStats } from '@/components/dashboard/DashboardStats'
import { RecentInvoices } from '@/components/dashboard/RecentInvoices'
import { PPFStatusBanner } from '@/components/dashboard/PPFStatusBanner'
import { QuickActions } from '@/components/dashboard/QuickActions'
import { RevenueChartServer } from '@/components/dashboard/RevenueChartServer'
import { Skeleton } from '@/components/ui/skeleton'
import DashboardClient from '@/components/dashboard/DashboardClient'
import { createClient } from '@/lib/supabase/server'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Tableau de bord' }
export const dynamic = 'force-dynamic'

/* ── Emoji + sous-titre selon l'heure du jour (UTC+1 approx.) ── */
function getGreeting(firstName: string): { emoji: string; greeting: string; sub: string } {
  const hour = new Date().getUTCHours() + 1 // UTC+1 approx.
  if (hour >= 5 && hour < 12) {
    return {
      emoji:    "☀️",
      greeting: `Bonjour, ${firstName || "vous"} !`,
      sub:      "Bonne journée — voici un résumé de votre activité.",
    }
  } else if (hour >= 12 && hour < 18) {
    return {
      emoji:    "👋",
      greeting: `Bon après-midi, ${firstName || "vous"} !`,
      sub:      "Voici l'état de votre activité en ce moment.",
    }
  } else {
    return {
      emoji:    "🌙",
      greeting: `Bonsoir, ${firstName || "vous"} !`,
      sub:      "Voici un résumé de votre journée.",
    }
  }
}

export default async function DashboardPage() {
  let showWelcome = false
  let firstName   = ""

  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (user) {
      // Récupérer le prénom depuis user_metadata
      firstName = (user.user_metadata?.first_name as string) || ""

      // Afficher le modal d'onboarding si l'utilisateur ne l'a pas encore vu,
      // sans dépendre du paramètre ?welcome=1 (race condition avec le webhook Stripe)
      const { data: company } = await supabase
        .from('companies')
        .select('onboarding_seen_at')
        .eq('user_id', user.id)
        .single()
      showWelcome = !company?.onboarding_seen_at
    }
  } catch {
    // Non bloquant
  }

  const { emoji, greeting, sub } = getGreeting(firstName)

  return (
    <DashboardClient showWelcome={showWelcome}>
      <div className="space-y-5 max-w-[1200px] mx-auto">

        {/* ── Bloc d'accueil ── */}
        <div className="flex items-center gap-3 pt-1 pb-1">
          <span
            className="text-3xl leading-none select-none"
            role="img"
            aria-label="emoji accueil"
          >
            {emoji}
          </span>
          <div>
            <h2 className="text-[22px] sm:text-[26px] font-extrabold text-[#0F172A] dark:text-[#E2E8F0] leading-tight tracking-tight">
              {greeting}
            </h2>
            <p className="text-[13px] text-slate-400 dark:text-slate-500 mt-0.5">{sub}</p>
          </div>
        </div>

        {/* ── Bannière PPF ── */}
        <PPFStatusBanner connected={false} />

        {/* ── KPIs ── */}
        <Suspense fallback={<StatsLoading />}>
          <DashboardStats />
        </Suspense>

        {/* ── Chart + Actions rapides ── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 lg:gap-5">

          {/* Chart CA 6 mois — 2/3 */}
          <div className="lg:col-span-2">
            <Suspense fallback={<ChartLoading />}>
              <RevenueChartServer />
            </Suspense>
          </div>

          {/* Actions rapides — 1/3 */}
          <div className="lg:col-span-1">
            <QuickActionsCard />
          </div>
        </div>

        {/* ── Dernières factures ── */}
        <Suspense fallback={<TableLoading />}>
          <RecentInvoices />
        </Suspense>

      </div>
    </DashboardClient>
  )
}

/* ─── Sous-composant QuickActions dans une carte ── */
function QuickActionsCard() {
  return (
    <div
      className="rounded-2xl border border-white/60 dark:border-[#1E3A5F]/50 p-4 h-full"
      style={{
        background: 'var(--card-glass-bg)',
        boxShadow:  'var(--card-glass-shadow)',
        minHeight:            '260px',
      }}
    >
      <QuickActions />
    </div>
  )
}

/* ─── Skeletons ── */
function StatsLoading() {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <Skeleton key={i} className="h-32 rounded-2xl bg-white/60" />
      ))}
    </div>
  )
}

function ChartLoading() {
  return <Skeleton className="h-[228px] rounded-2xl bg-white/60" />
}

function TableLoading() {
  return (
    <div className="rounded-2xl overflow-hidden">
      <Skeleton className="h-12 rounded-t-2xl rounded-b-none bg-white/60" />
      {Array.from({ length: 5 }).map((_, i) => (
        <Skeleton key={i} className="h-[58px] rounded-none bg-white/40 border-t border-white/60" />
      ))}
    </div>
  )
}
