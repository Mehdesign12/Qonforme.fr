/**
 * Admin › SEO › Mots-clés (planches Mots-cles, Mots-cles-detail et
 * Mobile-mots-cles du canevas) : requêtes suivies, mesures de Search Console
 * et de DataForSEO, gains rapides, statut de chaque mot-clé.
 *
 * Filtres et panneau pilotés par l'adresse : `?statut=`, `?intention=`, `?q=`,
 * `?page=`, `?mot-cle=<id>`.
 */
import { redirect } from "next/navigation"
import Link from "next/link"
import { Info, KeyRound, Loader2 } from "lucide-react"
import { isAdminAuthenticated } from "@/lib/admin-require"
import { EmptyState, Kpi, KpiGrid } from "@/components/app/kit"
import { fmtDateTime } from "@/components/admin/ui"
import { SeoHeader, SeoTabs } from "@/components/admin/seo/SeoHeader"
import { FailureState, InfoLine, SeoBanner } from "@/components/admin/seo/SeoStates"
import { load, seoDb } from "@/lib/seo/db"
import { readJob } from "@/lib/seo/cron"
import { isConfigured } from "@/lib/seo/connections"
import { fmtCount } from "@/lib/seo/format"
import { AVAILABLE_MESSAGE, METRICS_JOB, NOT_CONFIGURED_LINE, analysisState, cooldownMessage } from "@/lib/seo/keywords/analysis"
import { gscBounds, keywordPeriod, listAllKeywords, topPageFor, type TopPage } from "@/lib/seo/keywords/data"
import { pageLabel } from "@/lib/seo/keywords/page-label"
import { metricsNote } from "@/lib/seo/keywords/provenance"
import type { KeywordRow } from "@/lib/seo/keywords/types"
import { isQuickWin, keywordKpis } from "@/lib/seo/keywords/rules"
import {
  KEYWORDS_PATH,
  STATUS_SLUGS,
  applySearchAndIntent,
  keywordPage,
  keywordsHref,
  parseKeywordFilters,
  statusCounts,
} from "@/lib/seo/keywords/view"
import { AddKeywordButton } from "@/components/admin/seo/keywords/AddKeywordButton"
import { AnalyzeButton, type AnalyzeAvailability } from "@/components/admin/seo/keywords/AnalyzeButton"
import { KeywordFilters } from "@/components/admin/seo/keywords/KeywordFilters"
import {
  KeywordMobileList,
  KeywordMobileMore,
  KeywordPagination,
  KeywordTable,
  type KeywordListItem,
} from "@/components/admin/seo/keywords/KeywordList"
import { KeywordPanel } from "@/components/admin/seo/keywords/KeywordPanel"

export const dynamic = "force-dynamic"
export const metadata = { title: "Admin — Mots-clés" }

const TITLE = "Mots-clés"
const SUBTITLE = "Les requêtes sur lesquelles vous pouvez gagner du trafic, et quoi faire de chacune."
const NOTE_ID = "note-analyse"
const CONNECTIONS_HREF = "/admin/seo/parametres/connexions"

type Search = Record<string, string | string[] | undefined>

export default async function SeoKeywordsPage({ searchParams }: { searchParams: Promise<Search> | Search }) {
  if (!(await isAdminAuthenticated())) redirect("/admin/login")
  const filters = parseKeywordFilters(await searchParams)
  const now = new Date()
  const db = seoDb()
  const dataForSeo = isConfigured("dataforseo")
  const searchConsole = isConfigured("search_console")

  const loaded = await load(async () => {
    const [keywords, bounds, job] = await Promise.all([listAllKeywords(db), gscBounds(db), readJob(db, METRICS_JOB)])
    return { keywords, bounds, job }
  })

  if (!loaded.ok) {
    return (
      <>
        <SeoHeader section="keywords" title={TITLE} subtitle={SUBTITLE} />
        <FailureState failure={loaded.failure} what="les mots-clés" retryHref={KEYWORDS_PATH} />
      </>
    )
  }

  const { keywords, bounds, job } = loaded.data
  const period = keywordPeriod(bounds, now)
  const analysis = analysisState(job, now)
  const availability: AnalyzeAvailability = !dataForSeo ? "not_configured" : analysis.kind === "available" ? "available" : analysis.kind

  /* ---------------- Liste ---------------- */
  const base = applySearchAndIntent(keywords, filters)
  const counts = statusCounts(base)
  const view = keywordPage(keywords, filters)
  const kpis = keywordKpis(keywords, view.shown)
  const listFilters = { statut: filters.statut, intention: filters.intention, q: filters.q }
  const toItem = (row: KeywordRow): KeywordListItem => ({
    row,
    quickWin: isQuickWin(row),
    target: pageLabel(row.target_path),
    href: keywordsHref({ ...listFilters, page: view.requestedPage, selected: row.id }),
    selected: row.id === filters.selected,
  })
  const items = view.pageRows.map(toItem)
  const mobileItems = view.mobileRows.map(toItem)
  const keywordFilters = <KeywordFilters q={filters.q} intention={filters.intention ?? ""} />
  const filtered = Boolean(filters.statut || filters.intention || filters.q)

  /* ---------------- Panneau ---------------- */
  const selected = filters.selected ? keywords.find((k) => k.id === filters.selected) ?? null : null
  let topPage: TopPage | null = null
  let topPageFailed = false
  if (selected && period) {
    const res = await load(() => topPageFor(db, selected.keyword, period))
    if (res.ok) topPage = res.data
    else topPageFailed = true
  }

  /* ---------------- En-tête ---------------- */
  // Bouton désactivé : relié à la ligne d'information visible qui dit pourquoi (délai, analyse en cours, DataForSEO absent).
  const analyzeButton = (className?: string, label?: string) => (
    <AnalyzeButton
      availability={availability}
      describedBy={availability === "available" ? undefined : NOTE_ID}
      label={label}
      className={className}
    />
  )

  const infoLine = !dataForSeo ? null : analysis.kind === "cooldown" ? (
    cooldownMessage(analysis.nextDay)
  ) : analysis.kind === "running" ? (
    analysis.startedAt ? `Analyse en cours depuis le ${fmtDateTime(analysis.startedAt)}.` : "Analyse en cours."
  ) : (
    AVAILABLE_MESSAGE
  )

  return (
    <>
      <SeoHeader
        section="keywords"
        title={TITLE}
        subtitle={SUBTITLE}
        actions={
          <>
            {analyzeButton("hidden md:inline-flex")}
            <AddKeywordButton className="hidden md:inline-flex" />
          </>
        }
      />
      <AddKeywordButton className="q-btn-lg w-full md:hidden" />

      {!dataForSeo && (
        <InfoLine id={NOTE_ID} className="-mt-2 text-[13px] md:text-sm">
          {NOT_CONFIGURED_LINE}{" "}
          <Link href={CONNECTIONS_HREF} className="q-link">
            Ouvrir Paramètres › Connexions
          </Link>
        </InfoLine>
      )}

      {infoLine && (
        <p id={NOTE_ID} className="-mt-2 flex items-start gap-2 text-[13px] text-[var(--q-text-3)] md:text-sm">
          {analysis.kind === "running" ? (
            <Loader2 className="mt-0.5 size-4 shrink-0 animate-spin" aria-hidden />
          ) : (
            <Info className="mt-0.5 size-4 shrink-0" aria-hidden />
          )}
          <span>{infoLine}</span>
        </p>
      )}

      {analysis.kind === "available" && analysis.failed && (
        <SeoBanner
          tone="danger"
          title="L'analyse n'a pas pu aboutir"
          action={dataForSeo ? analyzeButton(undefined, "Relancer l'analyse") : undefined}
        >
          <p>La recherche s&apos;est interrompue avant la fin. Les mots-clés déjà suivis sont conservés.</p>
          {analysis.failed.error && (
            <p className="mt-1 text-[var(--q-text-3)]">
              {analysis.failed.at ? `${fmtDateTime(analysis.failed.at)} : ` : ""}
              {analysis.failed.error}
            </p>
          )}
        </SeoBanner>
      )}

      {!period &&
        (searchConsole ? (
          <InfoLine className="text-[13px] md:text-sm">
            Les positions et impressions arrivent après la première synchronisation de Search Console.
          </InfoLine>
        ) : (
          <InfoLine className="text-[13px] md:text-sm">
            Connectez Search Console pour voir vos clics et vos positions.{" "}
            <Link href={CONNECTIONS_HREF} className="q-link">
              Ouvrir Paramètres › Connexions
            </Link>
          </InfoLine>
        ))}

      <section aria-label="Indicateurs des mots-clés">
        <KpiGrid>
          <Kpi
            label="Gains rapides"
            value={fmtCount(kpis.quickWins)}
            sub={
              kpis.firstQuickWin ? (
                <span className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
                  Volume, facilité&nbsp;:
                  <span className="font-mono text-xs text-[var(--q-text-3)] [overflow-wrap:anywhere]">{kpis.firstQuickWin}</span>
                </span>
              ) : (
                "Volume d'au moins 100, difficulté de 20 au plus"
              )
            }
          />
          <Kpi label="Mots-clés suivis" value={fmtCount(kpis.tracked)} sub="Tous statuts confondus" />
          <Kpi label="Volume cumulé" value={kpis.volume === null ? "—" : fmtCount(kpis.volume)} sub="Somme des volumes connus de la liste affichée" />
          <Kpi label="Déjà en première page" value={fmtCount(kpis.firstPage)} sub="Position 10 ou mieux" />
        </KpiGrid>
      </section>

      <section aria-labelledby="titre-liste" className="q-card overflow-hidden">
        <h2 id="titre-liste" className="sr-only md:not-sr-only md:px-5 md:pb-2 md:pt-4 md:text-base md:font-semibold md:text-[var(--q-ink)]">
          Mots-clés suivis
        </h2>
        {/* Ordre de lecture = ordre affiché : recherche puis onglets sur téléphone, onglets puis recherche sur ordinateur. */}
        <div className="px-4 pb-2 pt-4 md:hidden">{keywordFilters}</div>
        <div>
          <SeoTabs
            label="Filtrer par statut"
            className="px-1 md:px-3 [&>a]:h-11 md:[&>a]:h-10"
            current={keywordsHref({ statut: filters.statut, intention: filters.intention, q: filters.q })}
            tabs={[
              { href: keywordsHref({ intention: filters.intention, q: filters.q }), label: "Tous", count: counts.all },
              ...STATUS_SLUGS.map((s) => ({
                href: keywordsHref({ statut: s.status, intention: filters.intention, q: filters.q }),
                label: s.label,
                count: counts[s.status],
              })),
            ]}
          />
        </div>
        <div className="hidden px-5 py-3.5 md:block">{keywordFilters}</div>

        {keywords.length === 0 ? (
          <EmptyState
            className="py-10"
            icon={<KeyRound className="size-5" aria-hidden />}
            title="Aucun mot-clé suivi"
            text="Ajoutez un mot-clé, ou attendez la synchronisation de Search Console : les requêtes d'au moins 3 impressions y sont proposées comme candidats."
          />
        ) : view.shown.length === 0 ? (
          <EmptyState
            className="py-10"
            icon={<KeyRound className="size-5" aria-hidden />}
            title="Aucun mot-clé ne correspond à ces filtres"
            action={
              filtered ? (
                <Link href={KEYWORDS_PATH} className="q-btn q-btn-secondary">
                  Effacer les filtres
                </Link>
              ) : undefined
            }
          />
        ) : (
          <>
            <KeywordTable items={items} />
            <KeywordMobileList items={mobileItems} />
          </>
        )}

        {view.shown.length > 0 && (
          <>
            <KeywordPagination
              className="hidden md:flex"
              from={view.from}
              to={view.to}
              total={view.shown.length}
              prevHref={view.page > 1 ? keywordsHref({ ...listFilters, page: view.page - 1 }) : null}
              nextHref={view.page < view.pageCount ? keywordsHref({ ...listFilters, page: view.page + 1 }) : null}
            />
            <KeywordMobileMore
              className="md:hidden"
              shown={view.mobileRows.length}
              total={view.shown.length}
              moreHref={view.mobileNextPage ? keywordsHref({ ...listFilters, page: view.mobileNextPage }) : null}
            />
          </>
        )}
      </section>

      {selected && (
        <KeywordPanel
          key={selected.id}
          keyword={selected}
          quickWin={isQuickWin(selected)}
          target={pageLabel(selected.target_path)}
          topPage={topPage}
          topPageFailed={topPageFailed}
          period={period}
          gscConfigured={searchConsole}
          metricsNote={metricsNote(selected, dataForSeo)}
          closeHref={keywordsHref({ ...listFilters, page: view.requestedPage })}
          topicsHref="/admin/seo/articles/sujets"
        />
      )}
    </>
  )
}
