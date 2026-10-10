import Link from "next/link"
import { redirect } from "next/navigation"
import { Sparkles } from "lucide-react"
import { isAdminAuthenticated } from "@/lib/admin-require"
import { SeoHeader, SegmentedLinks } from "@/components/admin/seo/SeoHeader"
import { MigrationPending } from "@/components/admin/seo/SeoStates"
import { SearchPerformanceCard, SearchPerformanceFailure } from "@/components/admin/seo/performance/SearchPerformanceCard"
import { AnalyzeButton } from "@/components/admin/seo/overview/AnalyzeButton"
import { ArticlesCard, PrioritiesCard, VisibilityCard } from "@/components/admin/seo/overview/OverviewCards"
import { load, seoDb } from "@/lib/seo/db"
import { isConfigured } from "@/lib/seo/connections"
import { PERIODS, parsePeriod } from "@/lib/seo/period"
import { countryLabel, DEFAULT_COUNTRY, DEFAULT_DEVICE, parseMetric } from "@/lib/seo/search-console/filters"
import { readSearchPerformance } from "@/lib/seo/search-console/read"
import { readArticlesSummary, readGeoSnapshot, readPriorities } from "@/lib/seo/overview"

export const dynamic = "force-dynamic"
export const metadata = { title: "Admin — SEO, vue d'ensemble" }

const BASE = "/admin/seo"
const GENERATE_HREF = "/admin/seo/articles/liste?generer=1"

type SearchParams = Record<string, string | string[] | undefined>

export default async function SeoOverviewPage({ searchParams }: { searchParams: SearchParams }) {
  if (!(await isAdminAuthenticated())) redirect("/admin/login")

  const period = parsePeriod(searchParams.periode)
  const metric = parseMetric(searchParams.metrique, "clics")
  const params = { periode: period, metrique: metric }

  const db = seoDb()
  const now = new Date()
  const configured = isConfigured("search_console")
  // Même périmètre par défaut que Performance › Recherche Google : France, tous appareils
  const [perf, priorities, articles, geo] = await Promise.all([
    load(() => readSearchPerformance(db, { period, device: DEFAULT_DEVICE, country: DEFAULT_COUNTRY, now })),
    load(() => readPriorities(db)),
    load(() => readArticlesSummary(db)),
    load(() => readGeoSnapshot(db)),
  ])
  const migrationPending = [perf, priorities, articles, geo].some((r) => !r.ok && r.failure === "migration_pending")

  const header = (
    <SeoHeader
      section="overview"
      title="Vue d'ensemble"
      subtitle="Vos performances de recherche et vos prochaines priorités."
      actions={
        // Migration en attente : aucune action (elles ne pourraient qu'échouer), sur ordinateur comme sur téléphone
        migrationPending ? undefined : (
          <div className="hidden items-center gap-2 md:flex">
            <AnalyzeButton />
            <Link href={GENERATE_HREF} className="q-btn q-btn-primary">
              <Sparkles aria-hidden />
              Générer un article
            </Link>
          </div>
        )
      }
    />
  )

  if (migrationPending) {
    return (
      <>
        {header}
        <MigrationPending />
      </>
    )
  }

  return (
    <>
      {header}

      {/* Téléphone : action principale d'abord, pleine largeur */}
      <div className="flex flex-col gap-2 md:hidden">
        <Link href={GENERATE_HREF} className="q-btn q-btn-primary q-btn-lg w-full">
          <Sparkles aria-hidden />
          Générer un article
        </Link>
        <AnalyzeButton className="q-btn-lg w-full" />
      </div>

      {perf.ok ? (
        <SearchPerformanceCard
          headingId="t-perf"
          title="Performances"
          subtitle="Suivez votre trafic de recherche et vos positions dans le temps."
          data={perf.data}
          configured={configured}
          metric={metric}
          basePath={BASE}
          params={params}
          scopeLabel={countryLabel(DEFAULT_COUNTRY)}
          controls={
            <SegmentedLinks
              label="Période"
              options={PERIODS.map((p) => ({ value: p.key, label: p.label }))}
              current={period}
              param="periode"
              basePath={BASE}
              params={params}
            />
          }
        />
      ) : (
        <SearchPerformanceFailure
          headingId="t-perf"
          title="Performances"
          subtitle="Suivez votre trafic de recherche et vos positions dans le temps."
          failure={perf.failure}
          retryHref={BASE}
        />
      )}

      <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,320px),1fr))] items-stretch gap-4">
        <PrioritiesCard data={priorities} />
        <ArticlesCard data={articles} now={now} />
        <VisibilityCard data={geo} />
      </div>
    </>
  )
}
