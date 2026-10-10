import Link from "next/link"
import { redirect } from "next/navigation"
import { ChevronRight } from "lucide-react"
import { isAdminAuthenticated } from "@/lib/admin-require"
import { SeoHeader, SeoTabs, SegmentedLinks } from "@/components/admin/seo/SeoHeader"
import { FailureState } from "@/components/admin/seo/SeoStates"
import { SearchPerformanceCard, SearchPerformanceFailure } from "@/components/admin/seo/performance/SearchPerformanceCard"
import { FilterMenu } from "@/components/admin/seo/performance/FilterMenu"
import { GscTable, type GscTableRow } from "@/components/admin/seo/performance/GscTable"
import { PERFORMANCE_SUBTITLE, PERFORMANCE_TABS, PERFORMANCE_TITLE } from "@/components/admin/seo/performance/tabs"
import { load, seoDb } from "@/lib/seo/db"
import { isConfigured } from "@/lib/seo/connections"
import { fmtRange } from "@/lib/seo/format"
import { PERIODS, parsePeriod } from "@/lib/seo/period"
import { DEVICE_FILTERS } from "@/lib/seo/types"
import {
  COUNTRY_FILTERS,
  countryLabel,
  deviceLabel,
  parseCountry,
  parseDevice,
  parseMetric,
} from "@/lib/seo/search-console/filters"
import { filterValues, readPages, readQueries, readSearchPerformance, ROWS_LIMIT } from "@/lib/seo/search-console/read"
import type { GscTotals } from "@/lib/seo/types"

export const dynamic = "force-dynamic"
export const metadata = { title: "Admin — SEO, performance" }

const BASE = "/admin/seo/performance"

type SearchParams = Record<string, string | string[] | undefined>

function toRows<T extends GscTotals>(rows: T[], keyOf: (r: T) => string): GscTableRow[] {
  return rows.map((r) => ({ key: keyOf(r), clicks: r.clicks, impressions: r.impressions, ctr: r.ctr, position: r.position }))
}

function ListCard({
  id,
  title,
  range,
  children,
  footerLink,
}: {
  id: string
  title: string
  range: string
  children: React.ReactNode
  footerLink: { href: string; label: string }
}) {
  return (
    <section aria-labelledby={id} className="q-card overflow-hidden">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5 px-4 pb-3 pt-4 md:px-5">
        <h2 id={id} className="q-h2">{title}</h2>
        <span className="text-[13px] text-[var(--q-text-4)]">{range}</span>
      </div>
      {children}
      <div className="flex min-h-12 flex-wrap items-center justify-between gap-2 border-t border-[var(--q-line-soft)] px-4 py-2 md:px-5">
        <span className="text-xs text-[var(--q-text-4)]">Google Search Console</span>
        <Link href={footerLink.href} className="q-link inline-flex min-h-11 items-center gap-1 text-sm">
          {footerLink.label}
          <ChevronRight className="size-4" aria-hidden />
        </Link>
      </div>
    </section>
  )
}

export default async function SeoPerformancePage({ searchParams }: { searchParams: SearchParams }) {
  if (!(await isAdminAuthenticated())) redirect("/admin/login")

  const period = parsePeriod(searchParams.periode)
  const metric = parseMetric(searchParams.metrique, "impressions")
  const device = parseDevice(searchParams.appareil)
  const country = parseCountry(searchParams.pays)
  const params = { periode: period, metrique: metric, appareil: device, pays: country }

  const db = seoDb()
  const configured = isConfigured("search_console")
  const perf = await load(() => readSearchPerformance(db, { period, device, country }))
  const lists =
    perf.ok && perf.data.bounds.last
      ? await load(async () => {
          const filters = filterValues(device, country)
          const [pages, queries] = await Promise.all([
            readPages(db, perf.data.period.current, filters),
            readQueries(db, perf.data.period.current, filters),
          ])
          return { pages, queries }
        })
      : null

  const scopeLabel = [countryLabel(country), device !== "all" ? deviceLabel(device) : null].filter(Boolean).join(" · ")

  return (
    <>
      <SeoHeader section="performance" title={PERFORMANCE_TITLE} subtitle={PERFORMANCE_SUBTITLE} />
      <SeoTabs tabs={PERFORMANCE_TABS} current={BASE} label="Sous-onglets de Performance" />

      {!perf.ok ? (
        <SearchPerformanceFailure headingId="t-performance" title="Performance de recherche" failure={perf.failure} retryHref={BASE} />
      ) : (
        <>
          <SearchPerformanceCard
            headingId="t-performance"
            title="Performance de recherche"
            data={perf.data}
            configured={configured}
            metric={metric}
            basePath={BASE}
            params={params}
            scopeLabel={scopeLabel}
            controls={
              <>
                <SegmentedLinks
                  label="Période"
                  options={PERIODS.map((p) => ({ value: p.key, label: p.label }))}
                  current={period}
                  param="periode"
                  basePath={BASE}
                  params={params}
                />
                <FilterMenu
                  label="Appareil"
                  param="appareil"
                  value={device}
                  options={DEVICE_FILTERS.map((d) => ({ value: d.value, label: d.label }))}
                />
                <FilterMenu label="Pays" param="pays" value={country} options={COUNTRY_FILTERS.map((c) => ({ value: c.value, label: c.label }))} />
              </>
            }
          />

          {lists && !lists.ok && (
            <>
              <ListCard id="t-pages" title="Pages" range={fmtRange(perf.data.period.current.from, perf.data.period.current.to)} footerLink={{ href: "/admin/seo/actions", label: "Voir les actions SEO" }}>
                <FailureState bare failure={lists.failure} what="les pages de Search Console" retryHref={BASE} className="border-t border-[var(--q-line-soft)]" />
              </ListCard>
              <ListCard id="t-requetes" title="Requêtes" range={fmtRange(perf.data.period.current.from, perf.data.period.current.to)} footerLink={{ href: "/admin/seo/mots-cles", label: "Voir les mots-clés" }}>
                <FailureState bare failure={lists.failure} what="les requêtes de Search Console" retryHref={BASE} className="border-t border-[var(--q-line-soft)]" />
              </ListCard>
            </>
          )}
          {lists && lists.ok && (
            <>
              <ListCard
                id="t-pages"
                title="Pages"
                range={fmtRange(perf.data.period.current.from, perf.data.period.current.to)}
                footerLink={{ href: "/admin/seo/actions", label: "Voir les actions SEO" }}
              >
                <GscTable
                  kind="page"
                  rows={toRows(lists.data.pages, (r) => r.page)}
                  caption="Pages classées par impressions"
                  searchPlaceholder="Rechercher une page…"
                  truncated={lists.data.pages.length >= ROWS_LIMIT}
                />
              </ListCard>
              <ListCard
                id="t-requetes"
                title="Requêtes"
                range={fmtRange(perf.data.period.current.from, perf.data.period.current.to)}
                footerLink={{ href: "/admin/seo/mots-cles", label: "Voir les mots-clés" }}
              >
                <GscTable
                  kind="query"
                  rows={toRows(lists.data.queries, (r) => r.query)}
                  caption="Requêtes classées par impressions"
                  searchPlaceholder="Rechercher une requête…"
                  truncated={lists.data.queries.length >= ROWS_LIMIT}
                />
              </ListCard>
            </>
          )}
        </>
      )}
    </>
  )
}
