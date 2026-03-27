import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { CheckCircle2, ArrowRight, FileText, HelpCircle, MapPin, Building2 } from "lucide-react"
import { METIERS, getMetierBySlug } from "@/lib/pseo/metiers"
import { VILLES, getVilleBySlug } from "@/lib/pseo/villes"
import Footer from "@/components/layout/Footer"

export function generateStaticParams() {
  const params: { slug: string; ville: string }[] = []
  for (const m of METIERS) {
    for (const v of VILLES) {
      params.push({ slug: m.slug, ville: v.slug })
    }
  }
  return params
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string; ville: string }> }): Promise<Metadata> {
  const { slug, ville } = await params
  const metier = getMetierBySlug(slug)
  const v = getVilleBySlug(ville)
  if (!metier || !v) return {}
  const title = `${metier.nom} a ${v.nom} — Facturation conforme | Qonforme`
  const description = `Logiciel de facturation pour ${metier.nom.toLowerCase()} a ${v.nom} (${v.codePostal}). Devis, factures et obligations legales. Conforme Factur-X 2026.`
  return {
    title,
    description,
    keywords: [...metier.motsCles, `${metier.nom.toLowerCase()} ${v.nom.toLowerCase()}`, `facturation ${v.nom.toLowerCase()}`],
    alternates: { canonical: `/facturation/${slug}/${ville}` },
    openGraph: {
      title,
      description,
      url: `https://qonforme.fr/facturation/${slug}/${ville}`,
      images: [{ url: `/api/og?title=${encodeURIComponent(`${metier.nom} a ${v.nom}`)}&subtitle=${encodeURIComponent(`Facturation conforme Factur-X 2026 — ${v.region}`)}`, width: 1200, height: 630 }],
    },
  }
}

export default async function MetierVillePage({ params }: { params: Promise<{ slug: string; ville: string }> }) {
  const { slug, ville } = await params
  const metier = getMetierBySlug(slug)
  const v = getVilleBySlug(ville)
  if (!metier || !v) notFound()

  // Villes proches : 4 autres villes de la même région, sinon les premières disponibles
  const villesProches = VILLES
    .filter(vp => vp.slug !== v.slug)
    .sort((a, b) => (a.region === v.region ? -1 : 1) - (b.region === v.region ? -1 : 1))
    .slice(0, 4)

  // Métiers proches dans la même ville
  const metiersProchesVille = metier.metiersProches.slice(0, 4)

  const jsonLd = [
    {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: metier.faq.slice(0, 3).map(f => ({
        "@type": "Question",
        name: f.question,
        acceptedAnswer: { "@type": "Answer", text: f.reponse },
      })),
    },
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Accueil", item: "https://qonforme.fr" },
        { "@type": "ListItem", position: 2, name: "Facturation par metier", item: "https://qonforme.fr/facturation" },
        { "@type": "ListItem", position: 3, name: metier.nom, item: `https://qonforme.fr/facturation/${metier.slug}` },
        { "@type": "ListItem", position: 4, name: v.nom, item: `https://qonforme.fr/facturation/${metier.slug}/${v.slug}` },
      ],
    },
    {
      "@context": "https://schema.org",
      "@type": "LocalBusiness",
      name: `${metier.nom} — Facturation Qonforme`,
      description: `Logiciel de facturation pour ${metier.nom.toLowerCase()} a ${v.nom}`,
      areaServed: { "@type": "City", name: v.nom },
    },
  ]

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <div className="min-h-screen bg-[#F8FAFC]">
        {/* Nav */}
        <nav className="border-b border-[#E2E8F0] bg-white">
          <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between">
            <Link href="/" className="text-xl font-bold text-[#0F172A]">Qonforme</Link>
            <div className="flex items-center gap-4">
              <Link href="/pricing" className="text-sm text-slate-600 hover:text-[#2563EB]">Tarifs</Link>
              <Link href="/signup" className="px-4 py-2 text-sm font-semibold text-white bg-[#2563EB] rounded-lg hover:bg-[#1D4ED8]">Essayer gratuitement</Link>
            </div>
          </div>
        </nav>

        {/* Breadcrumb */}
        <div className="max-w-5xl mx-auto px-4 pt-6">
          <nav className="flex items-center gap-2 text-sm text-slate-400">
            <Link href="/" className="hover:text-[#2563EB]">Accueil</Link>
            <span>/</span>
            <Link href="/facturation" className="hover:text-[#2563EB]">Facturation</Link>
            <span>/</span>
            <Link href={`/facturation/${metier.slug}`} className="hover:text-[#2563EB]">{metier.nom}</Link>
            <span>/</span>
            <span className="text-[#0F172A] font-medium">{v.nom}</span>
          </nav>
        </div>

        {/* Hero */}
        <header className="bg-gradient-to-b from-white to-[#F8FAFC] border-b border-[#E2E8F0]">
          <div className="max-w-5xl mx-auto px-4 py-16 text-center">
            <div className="inline-flex items-center gap-2 text-sm font-medium text-[#2563EB] mb-3">
              <MapPin className="w-4 h-4" />
              {v.nom} · {v.region}
            </div>
            <h1 className="text-3xl sm:text-4xl font-bold text-[#0F172A] leading-tight">
              Logiciel de facturation pour {metier.nom.toLowerCase()} a {v.nom}
            </h1>
            <p className="mt-4 text-lg text-slate-600 max-w-2xl mx-auto">
              Creez et envoyez vos factures et devis {metier.nom.toLowerCase()} a {v.nom} et en {v.region}. Conforme Factur-X 2026, adapte aux professionnels du {v.codePostal}.
            </p>
            <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
              <Link href="/signup" className="px-6 py-3 text-sm font-bold text-white bg-[#2563EB] rounded-xl hover:bg-[#1D4ED8] shadow-sm">
                Creer mon premier document
              </Link>
              <Link href="/demo" className="px-6 py-3 text-sm font-semibold text-slate-600 bg-white border border-[#E2E8F0] rounded-xl hover:bg-[#F8FAFC]">
                Voir la demo
              </Link>
            </div>
          </div>
        </header>

        {/* Infos locales */}
        <section className="max-w-5xl mx-auto px-4 py-12">
          <h2 className="text-2xl font-bold text-[#0F172A] mb-6 flex items-center gap-2">
            <Building2 className="w-6 h-6 text-[#2563EB]" />
            Ressources locales a {v.nom}
          </h2>
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="bg-white rounded-xl border border-[#E2E8F0] p-5 shadow-sm">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-2">Chambre de Commerce</p>
              <p className="text-sm text-[#0F172A] font-semibold">{v.cci}</p>
              <p className="mt-1 text-sm text-slate-500">Accompagnement creation d&apos;entreprise, formalites et formations pour les professionnels du {v.codePostal}.</p>
            </div>
            <div className="bg-white rounded-xl border border-[#E2E8F0] p-5 shadow-sm">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-2">Chambre des metiers</p>
              <p className="text-sm text-[#0F172A] font-semibold">{v.chambreMetiers}</p>
              <p className="mt-1 text-sm text-slate-500">Immatriculation, stage de preparation, accompagnement des artisans en {v.region}.</p>
            </div>
          </div>
        </section>

        {/* Features du métier */}
        <section className="max-w-5xl mx-auto px-4 py-12">
          <h2 className="text-2xl font-bold text-[#0F172A] mb-8">Fonctionnalites pour {metier.nom.toLowerCase()}s a {v.nom}</h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {metier.features.slice(0, 6).map((f, i) => (
              <div key={i} className="bg-white rounded-xl border border-[#E2E8F0] p-6 shadow-sm">
                <div className="w-10 h-10 rounded-lg bg-[#EFF6FF] flex items-center justify-center mb-4">
                  <FileText className="w-5 h-5 text-[#2563EB]" />
                </div>
                <h3 className="font-semibold text-[#0F172A] mb-2">{f.titre}</h3>
                <p className="text-sm text-slate-600 leading-relaxed">{f.texte}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Obligations */}
        <section className="bg-white border-y border-[#E2E8F0]">
          <div className="max-w-5xl mx-auto px-4 py-12">
            <h2 className="text-2xl font-bold text-[#0F172A] mb-6">Obligations legales pour {metier.nom.toLowerCase()}s</h2>
            <div className="space-y-3">
              {metier.obligations.map((o, i) => (
                <div key={i} className="flex items-start gap-3 p-4 bg-[#F8FAFC] rounded-xl">
                  <CheckCircle2 className="w-5 h-5 text-[#059669] mt-0.5 shrink-0" />
                  <p className="text-sm text-slate-700">{o}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* FAQ (3 premières du métier) */}
        <section className="max-w-5xl mx-auto px-4 py-12">
          <h2 className="text-2xl font-bold text-[#0F172A] mb-6 flex items-center gap-2">
            <HelpCircle className="w-6 h-6 text-[#2563EB]" />
            Questions frequentes
          </h2>
          <div className="space-y-4">
            {metier.faq.slice(0, 3).map((f, i) => (
              <div key={i} className="bg-white rounded-xl border border-[#E2E8F0] p-6 shadow-sm">
                <h3 className="font-semibold text-[#0F172A] mb-2">{f.question}</h3>
                <p className="text-sm text-slate-600 leading-relaxed">{f.reponse}</p>
              </div>
            ))}
          </div>
          <div className="mt-4 text-center">
            <Link href={`/facturation/${metier.slug}`} className="text-sm font-semibold text-[#2563EB] hover:underline">
              Voir toutes les FAQ {metier.nom.toLowerCase()} →
            </Link>
          </div>
        </section>

        {/* Maillage : même métier dans d'autres villes */}
        <section className="bg-white border-y border-[#E2E8F0]">
          <div className="max-w-5xl mx-auto px-4 py-12">
            <h2 className="text-xl font-bold text-[#0F172A] mb-6">{metier.nom} dans d&apos;autres villes</h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {villesProches.map((vp) => (
                <Link
                  key={vp.slug}
                  href={`/facturation/${metier.slug}/${vp.slug}`}
                  className="group rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] p-3 text-center text-sm font-semibold text-[#0F172A] hover:border-[#2563EB]/30 hover:text-[#2563EB] hover:shadow-md transition-all"
                >
                  {vp.nom}
                </Link>
              ))}
            </div>
          </div>
        </section>

        {/* Maillage : autres métiers dans la même ville */}
        <section className="max-w-5xl mx-auto px-4 py-12">
          <h2 className="text-xl font-bold text-[#0F172A] mb-6">Autres metiers a {v.nom}</h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {metiersProchesVille.map((ms) => {
              const mp = getMetierBySlug(ms)
              if (!mp) return null
              return (
                <Link
                  key={ms}
                  href={`/facturation/${ms}/${v.slug}`}
                  className="group rounded-xl border border-[#E2E8F0] bg-white p-3 text-center text-sm font-semibold text-[#0F172A] hover:border-[#2563EB]/30 hover:text-[#2563EB] hover:shadow-md transition-all"
                >
                  {mp.nom}
                </Link>
              )
            })}
          </div>
        </section>

        {/* CTA */}
        <section className="bg-[#0F172A] text-white">
          <div className="max-w-5xl mx-auto px-4 py-16 text-center">
            <h2 className="text-2xl font-bold mb-4">Pret a facturer a {v.nom} ?</h2>
            <p className="text-slate-300 mb-8 max-w-xl mx-auto">Creez vos factures et devis conformes en quelques clics. Factur-X 2026.</p>
            <Link href="/signup" className="inline-flex items-center gap-2 px-8 py-3.5 text-sm font-bold bg-[#2563EB] rounded-xl hover:bg-[#1D4ED8] shadow-lg">
              Commencer gratuitement <ArrowRight className="w-4 h-4" />
            </Link>
            <div className="mt-12 flex flex-wrap justify-center gap-x-6 gap-y-2 text-sm text-slate-400">
              <Link href={`/facturation/${metier.slug}`} className="hover:text-white">{metier.nom} (national)</Link>
              <Link href="/facturation" className="hover:text-white">Tous les metiers</Link>
              <Link href="/guide/mentions-obligatoires-facture" className="hover:text-white">Mentions obligatoires</Link>
              <Link href="/pricing" className="hover:text-white">Tarifs</Link>
            </div>
          </div>
        </section>

        <Footer />
      </div>
    </>
  )
}
