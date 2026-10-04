import type { Metadata } from "next"
import Link from "next/link"
import { ArrowRight, BookOpen, Compass, FileText, UserPlus } from "lucide-react"
import { DashboardBody } from "@/components/dashboard/DashboardBody"
import { buildDemoDashboardView } from "@/components/dashboard/demo-data"
import { parsePeriod } from "@/components/dashboard/model"
import { MetaPixelEvent } from "@/components/shared/MetaPixelEvent"

/* Titre centré sur la requête visée, « tableau de bord de facturation » (PushRank, 04/10/2026). */
export const metadata: Metadata = {
  title: "Démo du tableau de bord de facturation, sans inscription",
  description: "Essayez le tableau de bord de facturation de Qonforme sans inscription : devis, factures, relances et clients d'un artisan, avec des données d'exemple.",
  alternates: { canonical: "/demo" },
  openGraph: {
    title: "Démo du tableau de bord de facturation | Qonforme",
    images: [{ url: "/api/og?title=D%C3%A9mo%20du%20tableau%20de%20bord&subtitle=Devis%2C%20factures%20et%20relances%20d%27un%20artisan%20%E2%80%94%20sans%20inscription", width: 1200, height: 630 }],
  },
}

/**
 * Sous le tableau de bord de la démo : l'inscription d'abord (PushRank : page
 * qui attire, à renforcer par un appel à l'action), puis le maillage interne.
 */
const CROSS_LINKS = [
  { href: "/signup", Icon: UserPlus, title: "Créer mon compte", text: "Devis gratuits et illimités, sans carte bancaire" },
  { href: "/demo/demarrer", Icon: Compass, title: "Premiers pas d'un compte neuf", text: "L'écran « Par quoi commencer ? »" },
  { href: "/pricing", Icon: ArrowRight, title: "Prêt à démarrer\u00a0?", text: "Voir les tarifs\u00a0: devis gratuits" },
  { href: "/modele", Icon: FileText, title: "Modèles gratuits", text: "Devis et factures avec les mentions obligatoires" },
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
