import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import PricingSelector from '@/components/billing/PricingSelector'
import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import Footer from '@/components/layout/Footer'
import PublicHeaderWrapper from '@/components/layout/PublicHeaderWrapper'
import { MetaPixelEvent } from '@/components/shared/MetaPixelEvent'
import { PLANS, formatEuros } from '@/lib/stripe/plans'
import { GUARANTEE_DAYS } from '@/lib/stripe/access'

export const metadata: Metadata = {
  title: 'Tarifs — Qonforme | Devis gratuits, factures dès 10 € HT/mois',
  description: 'Devis gratuits et illimités, sans carte bancaire. Formule Essentiel à 12 € HT par mois, 10 € à l’année, pour envoyer vos factures. Sans engagement.',
  alternates: { canonical: '/pricing' },
  openGraph: {
    title: 'Tarifs Qonforme — devis gratuits',
    description: 'Devis gratuits et illimités. Formule Essentiel dès 10 € HT par mois pour envoyer vos factures. Sans engagement.',
    images: [{ url: '/api/og?title=Tarifs%20Qonforme&subtitle=Devis%20gratuits%20%E2%80%94%20factures%20d%C3%A8s%2010%20%E2%82%AC%20HT%2Fmois', width: 1200, height: 630 }],
  },
}
export const dynamic = 'force-dynamic'

const essentiel = PLANS.starter

const FAQ = [
  { question: "Faut-il une carte bancaire pour commencer ?", reponse: "Non. Les devis sont gratuits et illimités. La carte bancaire ou le prélèvement SEPA ne sont demandés qu'au moment d'envoyer votre première facture." },
  { question: `Que comprend la formule ${essentiel.name} ?`, reponse: `${essentiel.features.join(', ')}. ${formatEuros(essentiel.monthlyPrice)} HT par mois, ou ${formatEuros(essentiel.yearlyPrice)} HT par an.` },
  { question: "Et si Qonforme ne me convient pas ?", reponse: `Vous êtes remboursé intégralement dans les ${GUARANTEE_DAYS} jours qui suivent votre premier paiement, sans avoir à vous justifier, directement depuis votre espace. Vos documents restent consultables et téléchargeables.` },
  { question: "Puis-je résilier à tout moment ?", reponse: "Oui, sans engagement. La résiliation se fait depuis Paramètres › Abonnement et prend effet à la fin de la période déjà payée. Vos factures restent consultables après résiliation." },
  { question: "Comment payer ?", reponse: "Par carte bancaire ou par prélèvement SEPA. Les prix sont hors taxes : la TVA à 20 % s'y ajoute." },
  { question: `Quand la formule ${PLANS.pro.name} sera-t-elle disponible ?`, reponse: `Elle ouvrira avec les situations de travaux, la retenue de garantie et l'autoliquidation en sous-traitance, aujourd'hui en préparation. Elle ne sera proposée qu'une fois ces fonctions livrées.` },
  { question: "Qonforme est-il prêt pour la facturation électronique ?", reponse: "Qonforme produit des factures PDF accompagnées de leurs données structurées Factur-X. L'émission via une plateforme agréée, obligatoire pour les TPE à partir de septembre 2027, est en préparation." },
  { question: "Est-ce que Qonforme fonctionne sur mobile ?", reponse: "Oui. Qonforme fonctionne sur téléphone, tablette et ordinateur, et s'installe sur l'écran d'accueil de votre téléphone." },
]

export default async function PricingPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: FAQ.map(f => ({
      "@type": "Question",
      name: f.question,
      acceptedAnswer: { "@type": "Answer", text: f.reponse },
    })),
  }

  return (
    <>
      <MetaPixelEvent event="ViewContent" data={{ content_name: 'Pricing', content_category: 'pricing' }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <div className="min-h-screen bg-[#F8FAFC]">
        {/* Header */}
        <PublicHeaderWrapper />

        {/* Hero */}
        <header className="bg-gradient-to-b from-white to-[#F8FAFC] border-b border-[#E2E8F0]">
          <div className="max-w-4xl mx-auto px-4 pt-24 pb-14 sm:pt-28 sm:pb-16 text-center">
            <h1 className="text-3xl sm:text-4xl font-bold text-[#0F172A] leading-tight tracking-tight">
              Vos devis sont gratuits.<br className="hidden sm:block" /> Vous payez quand vous facturez.
            </h1>
            <p className="mt-4 text-lg text-slate-600 max-w-2xl mx-auto">
              Commencez sans carte bancaire. Vous choisissez une formule au moment d&apos;envoyer votre première facture.
            </p>
          </div>
        </header>

        {/* Plans */}
        <section className="max-w-[1080px] mx-auto px-4 sm:px-6 py-12">
          <PricingSelector isAuthenticated={!!user} />
        </section>

        {/* FAQ */}
        <section className="bg-white border-y border-[#E2E8F0]">
          <div className="max-w-3xl mx-auto px-4 py-16">
            <h2 className="text-2xl font-bold text-[#0F172A] text-center mb-10">Questions fréquentes</h2>
            <div className="space-y-4">
              {FAQ.map((f, i) => (
                <div key={i} className="rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] p-5">
                  <h3 className="font-semibold text-[#0F172A] mb-2">{f.question}</h3>
                  <p className="text-sm text-slate-600 leading-relaxed">{f.reponse}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="bg-[#0F172A] text-white">
          <div className="max-w-3xl mx-auto px-4 py-16 text-center">
            <h2 className="text-2xl font-bold mb-4">Votre premier devis, en quelques minutes</h2>
            <p className="text-slate-300 mb-8">Gratuit, sans carte bancaire, avec les mentions obligatoires de votre métier.</p>
            <Link href="/signup" className="inline-flex items-center gap-2 px-8 py-3.5 text-sm font-bold bg-[#2563EB] rounded-xl hover:bg-[#1D4ED8] shadow-lg">
              Commencer gratuitement <ArrowRight className="w-4 h-4" />
            </Link>
            <div className="mt-8 flex flex-wrap justify-center gap-x-6 gap-y-2 text-sm text-slate-400">
              <Link href="/facturation" className="hover:text-white">Facturation par métier</Link>
              <Link href="/guide" className="hover:text-white">Guides pratiques</Link>
              <Link href="/demo" className="hover:text-white">Démo</Link>
            </div>
          </div>
        </section>

        <Footer />
      </div>
    </>
  )
}
