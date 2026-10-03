import type { Metadata } from "next"
import Link from "next/link"
import { ArrowRight, BookOpen, Compass } from "lucide-react"
import { DashboardBody } from "@/components/dashboard/DashboardBody"
import { buildDemoDashboardView } from "@/components/dashboard/demo-data"
import { parsePeriod } from "@/components/dashboard/model"
import { MetaPixelEvent } from "@/components/shared/MetaPixelEvent"

export const metadata: Metadata = {
  title: "Démo interactive — Qonforme",
  description: "Explorez la démo de Qonforme : devis, factures, clients et bons de commande d'un artisan du bâtiment, avec des données d'exemple, et sans inscription.",
  alternates: { canonical: "/demo" },
  openGraph: {
    images: [{ url: "/api/og?title=D%C3%A9mo%20interactive&subtitle=Devis%2C%20factures%20et%20clients%20d%27un%20artisan%20%E2%80%94%20sans%20inscription", width: 1200, height: 630 }],
  },
}

/** Liens de maillage interne (premiers pas, tarifs, blog), sous le tableau de bord de la démo. */
const CROSS_LINKS = [
  { href: "/demo/demarrer", Icon: Compass, title: "Premiers pas d'un compte neuf", text: "L'écran « Par quoi commencer ? »" },
  { href: "/pricing", Icon: ArrowRight, title: "Prêt à démarrer\u00a0?", text: "Voir les tarifs\u00a0: devis gratuits" },
  { href: "/blog", Icon: BookOpen, title: "Guides et conseils", text: "Tout savoir sur la facturation électronique" },
]

/** Démo : même tableau de bord que /dashboard (DashboardBody), données fictives de lib/demo/data.ts. */
export default function DemoDashboardPage({ searchParams }: { searchParams: { periode?: string } }) {
  const view = buildDemoDashboardView(parsePeriod(searchParams?.periode))

  return (
    <>
      <MetaPixelEvent event="ViewContent" data={{ content_name: 'Demo', content_category: 'demo' }} />
      <DashboardBody view={view} />

      <nav aria-label="Aller plus loin" className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {CROSS_LINKS.map(({ href, Icon, title, text }) => (
          <Link
            key={href}
            href={href}
            className="q-card group flex items-center gap-4 p-5 transition-colors hover:border-[var(--q-field)]"
          >
            <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-[var(--q-wash)] text-[var(--q-accent-strong)]">
              <Icon className="size-[18px]" strokeWidth={1.75} aria-hidden />
            </span>
            <span className="flex min-w-0 flex-col gap-0.5">
              <span className="text-[15px] font-semibold text-[var(--q-ink)] group-hover:text-[var(--q-accent-strong)]">{title}</span>
              <span className="text-[13px] text-[var(--q-text-4)]">{text}</span>
            </span>
          </Link>
        ))}
      </nav>
    </>
  )
}
