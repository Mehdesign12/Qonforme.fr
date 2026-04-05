import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { CheckCircle2, XCircle, ArrowRight } from "lucide-react"
import { COMPARATIFS, getComparatifBySlug, QONFORME_FEATURES } from "@/lib/pseo/comparatifs"
import Footer from "@/components/layout/Footer"
import PublicHeaderWrapper from "@/components/layout/PublicHeaderWrapper"


export function generateStaticParams() {
  return COMPARATIFS.map(c => ({ slug: c.slug }))
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params
  const comp = getComparatifBySlug(slug)
  if (!comp) return {}
  const title = `Qonforme vs ${comp.nom} — Comparatif 2026 | Qonforme`
  return {
    title,
    description: comp.description,
    keywords: comp.motsCles,
    alternates: { canonical: `/comparatif/${comp.slug}` },
    openGraph: {
      title,
      description: comp.description,
      url: `https://qonforme.fr/comparatif/${comp.slug}`,
      images: [{ url: `/api/og?title=${encodeURIComponent(`Qonforme vs ${comp.nom}`)}&subtitle=${encodeURIComponent("Comparatif facturation 2026")}`, width: 1200, height: 630 }],
    },
  }
}

function BoolIcon({ value }: { value: boolean }) {
  return value
    ? <CheckCircle2 className="w-5 h-5 text-[#059669]" />
    : <XCircle className="w-5 h-5 text-[#DC2626]" />
}

const FEATURE_ROWS: { label: string; key: keyof typeof QONFORME_FEATURES }[] = [
  { label: "Format Factur-X", key: "facturX" },
  { label: "Facturation electronique 2026", key: "factureElectronique" },
  { label: "Export FEC comptable", key: "exportFec" },
  { label: "Devis", key: "devis" },
  { label: "Avoirs / notes de credit", key: "avoirs" },
  { label: "Relances impayes", key: "relances" },
  { label: "Multi-utilisateur", key: "multiUtilisateur" },
  { label: "API ouverte", key: "apiOuverte" },
  { label: "Support francais", key: "supportFrancais" },
]

export default async function ComparatifPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const comp = getComparatifBySlug(slug)
  if (!comp) notFound()

  const jsonLd = [
    {
      "@context": "https://schema.org",
      "@type": "Article",
      headline: `Qonforme vs ${comp.nom} — Comparatif facturation 2026`,
      description: comp.description,
      publisher: { "@type": "Organization", name: "Qonforme", url: "https://qonforme.fr" },
    },
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Accueil", item: "https://qonforme.fr" },
        { "@type": "ListItem", position: 2, name: "Comparatifs", item: "https://qonforme.fr/comparatif" },
        { "@type": "ListItem", position: 3, name: `vs ${comp.nom}`, item: `https://qonforme.fr/comparatif/${comp.slug}` },
      ],
    },
  ]

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <div className="min-h-screen bg-[#F8FAFC]">
        {/* Nav */}
        <PublicHeaderWrapper />

        {/* Breadcrumb */}
        <div className="max-w-5xl mx-auto px-4 pt-6">
          <nav className="flex items-center gap-2 text-sm text-slate-400">
            <Link href="/" className="hover:text-[#2563EB]">Accueil</Link>
            <span>/</span>
            <Link href="/comparatif" className="hover:text-[#2563EB]">Comparatifs</Link>
            <span>/</span>
            <span className="text-[#0F172A] font-medium">vs {comp.nom}</span>
          </nav>
        </div>

        {/* Hero */}
        <header className="max-w-5xl mx-auto px-4 py-12 text-center">
          <p className="text-sm font-medium text-[#2563EB] mb-3">Comparatif 2026</p>
          <h1 className="text-3xl sm:text-4xl font-bold text-[#0F172A] leading-tight">
            Qonforme vs {comp.nom}
          </h1>
          <p className="mt-4 text-lg text-slate-600 max-w-2xl mx-auto">{comp.description}</p>
        </header>

        {/* Prix */}
        <section className="max-w-5xl mx-auto px-4 pb-12">
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="rounded-xl border-2 border-[#2563EB] bg-white p-6 shadow-sm">
              <p className="text-xs font-bold text-[#2563EB] uppercase tracking-wide mb-1">Qonforme</p>
              <p className="text-2xl font-bold text-[#0F172A]">{QONFORME_FEATURES.prix}</p>
              <p className="text-sm text-slate-500 mt-1">{QONFORME_FEATURES.prixDetail}</p>
              <p className="text-sm text-slate-500 mt-1">Essai : {QONFORME_FEATURES.essaiGratuit}</p>
            </div>
            <div className="rounded-xl border border-[#E2E8F0] bg-white p-6 shadow-sm">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-1">{comp.nom}</p>
              <p className="text-2xl font-bold text-[#0F172A]">{comp.prix}</p>
              <p className="text-sm text-slate-500 mt-1">{comp.prixDetail}</p>
              <p className="text-sm text-slate-500 mt-1">Essai : {comp.essaiGratuit}</p>
            </div>
          </div>
        </section>

        {/* Tableau comparatif */}
        <section className="max-w-5xl mx-auto px-4 pb-12">
          <h2 className="text-2xl font-bold text-[#0F172A] mb-6">Comparatif des fonctionnalites</h2>
          <div className="rounded-xl border border-[#E2E8F0] overflow-hidden bg-white shadow-sm">
            {/* Header */}
            <div className="grid grid-cols-3 bg-[#F8FAFC] border-b border-[#E2E8F0] p-4">
              <div className="text-sm font-bold text-slate-500">Fonctionnalite</div>
              <div className="text-sm font-bold text-[#2563EB] text-center">Qonforme</div>
              <div className="text-sm font-bold text-slate-500 text-center">{comp.nom}</div>
            </div>
            {/* Rows */}
            {FEATURE_ROWS.map((row) => (
              <div key={row.key} className="grid grid-cols-3 border-b border-[#F1F5F9] p-4 items-center">
                <div className="text-sm text-slate-700">{row.label}</div>
                <div className="flex justify-center"><BoolIcon value={QONFORME_FEATURES[row.key] as boolean} /></div>
                <div className="flex justify-center"><BoolIcon value={comp[row.key] as boolean} /></div>
              </div>
            ))}
          </div>
        </section>

        {/* Points forts / faibles du concurrent */}
        <section className="max-w-5xl mx-auto px-4 pb-12">
          <div className="grid sm:grid-cols-2 gap-6">
            <div className="rounded-xl border border-[#E2E8F0] bg-white p-6 shadow-sm">
              <h3 className="font-bold text-[#0F172A] mb-4">Points forts de {comp.nom}</h3>
              <div className="space-y-2">
                {comp.pointsForts.map((p, i) => (
                  <div key={i} className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-[#059669] mt-0.5 shrink-0" />
                    <p className="text-sm text-slate-700">{p}</p>
                  </div>
                ))}
              </div>
            </div>
            <div className="rounded-xl border border-[#E2E8F0] bg-white p-6 shadow-sm">
              <h3 className="font-bold text-[#0F172A] mb-4">Points faibles de {comp.nom}</h3>
              <div className="space-y-2">
                {comp.pointsFaibles.map((p, i) => (
                  <div key={i} className="flex items-start gap-2">
                    <XCircle className="w-4 h-4 text-[#DC2626] mt-0.5 shrink-0" />
                    <p className="text-sm text-slate-700">{p}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* Conclusion */}
        <section className="max-w-5xl mx-auto px-4 pb-12">
          <div className="rounded-xl bg-[#EFF6FF] border border-[#BFDBFE] p-6">
            <h2 className="font-bold text-[#0F172A] mb-2">Notre verdict</h2>
            <p className="text-sm text-slate-700 leading-relaxed">{comp.conclusion}</p>
          </div>
        </section>

        {/* Autres comparatifs */}
        <section className="max-w-5xl mx-auto px-4 pb-12">
          <h2 className="text-xl font-bold text-[#0F172A] mb-6">Autres comparatifs</h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {COMPARATIFS.filter(c => c.slug !== comp.slug).slice(0, 4).map((c) => (
              <Link
                key={c.slug}
                href={`/comparatif/${c.slug}`}
                className="group rounded-xl border border-[#E2E8F0] bg-white p-4 text-center text-sm font-semibold text-[#0F172A] hover:border-[#2563EB]/30 hover:text-[#2563EB] hover:shadow-md transition-all"
              >
                vs {c.nom}
              </Link>
            ))}
          </div>
        </section>

        {/* CTA */}
        <section className="bg-[#0F172A] text-white">
          <div className="max-w-5xl mx-auto px-4 py-16 text-center">
            <h2 className="text-2xl font-bold mb-4">Pret a essayer Qonforme ?</h2>
            <p className="text-slate-300 mb-8 max-w-xl mx-auto">Creez vos factures conformes Factur-X en quelques clics. Sans engagement.</p>
            <Link href="/signup" className="inline-flex items-center gap-2 px-8 py-3.5 text-sm font-bold bg-[#2563EB] rounded-xl hover:bg-[#1D4ED8] shadow-lg">
              Commencer gratuitement <ArrowRight className="w-4 h-4" />
            </Link>
            <div className="mt-12 flex flex-wrap justify-center gap-x-6 gap-y-2 text-sm text-slate-400">
              <Link href="/comparatif" className="hover:text-white">Tous les comparatifs</Link>
              <Link href="/facturation" className="hover:text-white">Facturation par metier</Link>
              <Link href="/pricing" className="hover:text-white">Tarifs</Link>
            </div>
          </div>
        </section>

        <Footer />
      </div>
    </>
  )
}
