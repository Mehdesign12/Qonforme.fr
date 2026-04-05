import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import PricingSelector from '@/components/billing/PricingSelector'
import Link from 'next/link'
import { ArrowRight, Shield, Zap, Lock } from 'lucide-react'
import Footer from '@/components/layout/Footer'
import PublicHeaderWrapper from "@/components/layout/PublicHeaderWrapper"

export const metadata: Metadata = {
  title: 'Tarifs — Qonforme | Facturation dès 9 €/mois',
  description: 'Découvrez les tarifs Qonforme : plan Starter dès 9 €/mois, plan Pro à 19 €/mois. Factur-X conforme, sans engagement. Comparez les fonctionnalités.',
  alternates: { canonical: '/pricing' },
  openGraph: {
    title: 'Tarifs Qonforme — dès 9 €/mois',
    description: 'Facturation électronique conforme dès 9 €/mois. Sans engagement.',
    images: [{ url: '/api/og?title=Tarifs%20Qonforme&subtitle=D%C3%A8s%209%20%E2%82%AC%2Fmois%20%E2%80%94%20Sans%20engagement', width: 1200, height: 630 }],
  },
}
export const dynamic = 'force-dynamic'


const FAQ = [
  { question: "Qonforme est-il conforme à la réforme de facturation électronique 2026 ?", reponse: "Oui, Qonforme génère nativement des factures au format Factur-X EN 16931, le format obligatoire pour la facturation électronique B2B à partir de septembre 2026." },
  { question: "Puis-je essayer Qonforme gratuitement ?", reponse: "Oui, vous pouvez créer un compte et tester Qonforme sans carte bancaire. L'abonnement démarre à partir de 9 €/mois sans engagement." },
  { question: "Quelle est la différence entre le plan Starter et le plan Pro ?", reponse: "Le plan Starter (9 €/mois) couvre la facturation essentielle : 10 factures/mois, devis illimités, Factur-X. Le plan Pro (19 €/mois) ajoute les factures illimitées, relances automatiques, tableau de bord CA et support prioritaire." },
  { question: "Puis-je résilier à tout moment ?", reponse: "Oui, Qonforme est sans engagement. Vous pouvez résilier votre abonnement à tout moment depuis les paramètres de votre compte." },
  { question: "Qonforme gère-t-il l'autoliquidation TVA pour le BTP ?", reponse: "Oui, Qonforme gère automatiquement l'autoliquidation de TVA pour la sous-traitance BTP (article 283-2 nonies du CGI)." },
  { question: "Est-ce que Qonforme fonctionne sur mobile ?", reponse: "Oui, Qonforme est entièrement responsive et fonctionne sur smartphone, tablette et ordinateur." },
]

export default async function PricingPage() {
  // Utilisateur déjà abonné → dashboard
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (user) {
    const { data: sub } = await supabase
      .from('subscriptions')
      .select('status')
      .eq('user_id', user.id)
      .single()
    if (sub?.status === 'active') {
      redirect('/dashboard')
    }
  }

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
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <div className="min-h-screen bg-[#F8FAFC]">
        {/* Header */}
        <PublicHeaderWrapper />

        {/* Hero */}
        <header className="bg-gradient-to-b from-white to-[#F8FAFC] border-b border-[#E2E8F0]">
          <div className="max-w-4xl mx-auto px-4 py-16 text-center">
            <p className="text-sm font-medium text-[#2563EB] mb-3">Tarifs simples, sans surprise</p>
            <h1 className="text-3xl sm:text-4xl font-bold text-[#0F172A] leading-tight">
              Choisissez le plan adapté à votre activité
            </h1>
            <p className="mt-4 text-lg text-slate-600 max-w-2xl mx-auto">
              Facturation électronique conforme Factur-X 2026. Sans engagement, résiliable à tout moment.
            </p>
            {/* Badges réassurance */}
            <div className="mt-6 flex flex-wrap justify-center gap-3">
              {[
                { icon: <Zap className="w-3.5 h-3.5" />, label: "Accès immédiat", color: "text-[#2563EB]", bg: "bg-[#EFF6FF]", border: "border-[#BFDBFE]" },
                { icon: <Shield className="w-3.5 h-3.5" />, label: "Conforme 2026", color: "text-[#059669]", bg: "bg-[#ECFDF5]", border: "border-[#A7F3D0]" },
                { icon: <Lock className="w-3.5 h-3.5" />, label: "Sans engagement", color: "text-slate-500", bg: "bg-white", border: "border-slate-200" },
              ].map((b) => (
                <span key={b.label} className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium ${b.color} ${b.bg} ${b.border}`}>
                  {b.icon} {b.label}
                </span>
              ))}
            </div>
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
            <h2 className="text-2xl font-bold mb-4">Prêt à simplifier votre facturation ?</h2>
            <p className="text-slate-300 mb-8">Créez votre première facture Factur-X en quelques clics.</p>
            <Link href="/signup" className="inline-flex items-center gap-2 px-8 py-3.5 text-sm font-bold bg-[#2563EB] rounded-xl hover:bg-[#1D4ED8] shadow-lg">
              Commencer gratuitement <ArrowRight className="w-4 h-4" />
            </Link>
            <div className="mt-8 flex flex-wrap justify-center gap-x-6 gap-y-2 text-sm text-slate-400">
              <Link href="/facturation" className="hover:text-white">Facturation par métier</Link>
              <Link href="/guide" className="hover:text-white">Guides pratiques</Link>
              <Link href="/comparatif" className="hover:text-white">Comparatifs</Link>
              <Link href="/demo" className="hover:text-white">Démo</Link>
            </div>
          </div>
        </section>

        <Footer />
      </div>
    </>
  )
}
