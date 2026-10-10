/**
 * Admin › SEO › Articles › Calendrier (planches Articles-calendrier et
 * Mobile-articles) : articles publiés, articles programmés et sujets planifiés
 * du mois, heure de Paris. Primaire « Planifier un sujet » (?planifier=1) ;
 * mois par ?mois=2026-10, statut par ?statut=.
 */
import { redirect } from "next/navigation"
import { isAdminAuthenticated } from "@/lib/admin-require"
import { load, seoDb } from "@/lib/seo/db"
import type { ArticleDisplayStatus } from "@/lib/seo/types"
import { FailureState } from "@/components/admin/seo/SeoStates"
import { ArticlesHeader, ARTICLES_BASE } from "@/components/admin/seo/articles/ArticlesHeader"
import { CalendarView } from "@/components/admin/seo/articles/CalendarView"
import { currentMonth, loadCalendar } from "@/lib/seo/articles/data"
import { parseMonth } from "@/lib/seo/articles/schedule"

export const dynamic = "force-dynamic"
export const metadata = { title: "Admin — SEO, calendrier des articles" }

const STATUSES: ArticleDisplayStatus[] = ["published", "scheduled", "draft", "to_review", "failed"]

type SearchParams = Record<string, string | string[] | undefined>

export default async function SeoArticlesCalendarPage({ searchParams }: { searchParams: SearchParams }) {
  if (!(await isAdminAuthenticated())) redirect("/admin/login")
  const now = new Date()
  const month = parseMonth(typeof searchParams.mois === "string" ? searchParams.mois : null) ?? currentMonth(now)
  const raw = typeof searchParams.statut === "string" ? searchParams.statut : null
  const filter = STATUSES.find((s) => s === raw) ?? null

  const data = await load(() => loadCalendar(seoDb(), month, now, filter))

  return (
    <>
      <ArticlesHeader current="calendrier" action={{ href: `${ARTICLES_BASE}?planifier=1${month !== currentMonth(now) ? `&mois=${month}` : ""}`, label: "Planifier un sujet", icon: "plus" }} />
      {!data.ok ? <FailureState failure={data.failure} what="le calendrier des articles" retryHref={ARTICLES_BASE} /> : <CalendarView data={data.data} filter={filter} />}
    </>
  )
}
