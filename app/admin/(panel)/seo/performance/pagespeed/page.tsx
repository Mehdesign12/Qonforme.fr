import { redirect } from "next/navigation"
import { isAdminAuthenticated } from "@/lib/admin-require"
import { SeoHeader, SeoTabs, SegmentedLinks } from "@/components/admin/seo/SeoHeader"
import { FailureState, InfoLine, SeoBanner } from "@/components/admin/seo/SeoStates"
import { FilterMenu } from "@/components/admin/seo/performance/FilterMenu"
import { MeasureButton } from "@/components/admin/seo/performance/MeasureButton"
import { PageDetailCard, TrackedPagesCard } from "@/components/admin/seo/performance/PageSpeedViews"
import { MOBILE_SEG_CLASS, PERFORMANCE_SUBTITLE, PERFORMANCE_TABS, PERFORMANCE_TITLE } from "@/components/admin/seo/performance/tabs"
import { load, seoDb } from "@/lib/seo/db"
import { isConfigured } from "@/lib/seo/connections"
import { getSettings } from "@/lib/seo/settings"
import { readPageSpeedHistory } from "@/lib/seo/pagespeed/read"
import { STRATEGIES, STRATEGY_LABELS, type PageSpeedStrategy } from "@/lib/seo/pagespeed/parse"

export const dynamic = "force-dynamic"
export const metadata = { title: "Admin — SEO, PageSpeed" }

const BASE = "/admin/seo/performance/pagespeed"

type SearchParams = Record<string, string | string[] | undefined>

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v)

function parseStrategy(v: string | string[] | undefined): PageSpeedStrategy {
  return first(v) === "desktop" ? "desktop" : "mobile"
}

export default async function SeoPageSpeedPage({ searchParams }: { searchParams: SearchParams }) {
  if (!(await isAdminAuthenticated())) redirect("/admin/login")

  const strategy = parseStrategy(searchParams.appareil)
  const db = seoDb()
  const data = await load(async () => {
    const settings = (await getSettings(db, "pagespeed")).value
    const histories = await readPageSpeedHistory(
      db,
      settings.pages.map((p) => p.path),
      strategy,
    )
    return { settings, histories }
  })

  const header = (
    <>
      <SeoHeader section="performance" title={PERFORMANCE_TITLE} subtitle={PERFORMANCE_SUBTITLE} />
      <SeoTabs tabs={PERFORMANCE_TABS} current="/admin/seo/performance/pagespeed" label="Sous-onglets de Performance" />
    </>
  )

  if (!data.ok) {
    return (
      <>
        {header}
        <section aria-labelledby="pages-suivies" className="q-card overflow-hidden">
          <h2 id="pages-suivies" className="q-h2 px-4 pb-4 pt-4 md:px-5">
            Pages suivies
          </h2>
          <FailureState bare failure={data.failure} what="les mesures PageSpeed" retryHref={BASE} className="border-t border-[var(--q-line-soft)]" />
        </section>
      </>
    )
  }

  const { settings, histories } = data.data
  const pages = settings.pages
  const requested = first(searchParams.chemin)
  const selectedPage = pages.find((p) => p.path === requested) ?? pages[0] ?? null
  const selectedHistory = selectedPage ? histories[selectedPage.path] : undefined
  const params = { chemin: selectedPage?.path, appareil: strategy }

  return (
    <>
      {header}

      {selectedPage && (
        <div className="q-card flex flex-col gap-3 px-4 py-3.5 md:flex-row md:flex-wrap md:items-center md:justify-between md:px-5">
          <div className={`flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center ${MOBILE_SEG_CLASS}`}>
            <FilterMenu
              label="Page"
              param="chemin"
              value={selectedPage.path}
              size="md"
              mono
              options={pages.map((p) => ({ value: p.path, label: p.label === p.path ? p.path : `${p.path} · ${p.label}` }))}
              className="w-full sm:w-auto sm:max-w-[360px]"
            />
            <SegmentedLinks
              label="Appareil"
              options={STRATEGIES.map((s) => ({ value: s, label: STRATEGY_LABELS[s] }))}
              current={strategy}
              param="appareil"
              basePath={BASE}
              params={params}
            />
          </div>
          <MeasureButton path={selectedPage.path} strategy={strategy} variant="primary" className="h-12 w-full md:h-10 md:w-auto" />
        </div>
      )}

      {!isConfigured("pagespeed") && (
        <InfoLine>Clé PAGESPEED_API_KEY absente : les mesures restent possibles, avec un quota très faible.</InfoLine>
      )}

      {selectedHistory?.current && !selectedHistory.current.field && (
        <SeoBanner tone="info" title="Données terrain indisponibles">
          Le trafic est trop faible pour le rapport d&apos;expérience utilisateur Chrome. Les mesures ci-dessous sont des mesures de
          laboratoire.
        </SeoBanner>
      )}

      <TrackedPagesCard
        pages={pages}
        histories={histories}
        strategy={strategy}
        selected={selectedPage?.path ?? null}
        basePath={BASE}
        weekly={settings.weekly}
      />

      {selectedPage && <PageDetailCard page={selectedPage} history={selectedHistory} strategy={strategy} />}
    </>
  )
}
