import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import PricingSelector from '@/components/billing/PricingSelector'
import PlanComparison from '@/components/billing/PlanComparison'
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

/** Typographie française : espace insécable avant « ? : ; ! », « € » et « % ». */
const nbsp = (text: string) => text.replace(/ ([?:;!€%])/g, '\u00A0$1')

const FAQ = ([
  { question: "Faut-il une carte bancaire pour commencer ?", reponse: "Non. Les devis sont gratuits et illimités. La carte bancaire ou le prélèvement SEPA ne sont demandés qu'au moment d'envoyer votre première facture." },
  { question: `Que comprend la formule ${essentiel.name} ?`, reponse: `${essentiel.features.map((f, i) => (i === 0 ? f : f.charAt(0).toLowerCase() + f.slice(1))).join(', ')}. ${formatEuros(essentiel.monthlyPrice)} HT par mois, ou ${formatEuros(essentiel.yearlyPrice)} HT par an.` },
  { question: "Et si Qonforme ne me convient pas ?", reponse: `Vous êtes remboursé intégralement dans les ${GUARANTEE_DAYS} jours qui suivent votre premier paiement, sans avoir à vous justifier, directement depuis votre espace. Vos documents restent consultables et téléchargeables.` },
  { question: "Puis-je résilier à tout moment ?", reponse: "Oui, sans engagement. La résiliation se fait depuis Paramètres › Abonnement et prend effet à la fin de la période déjà payée. Vos factures restent consultables après résiliation." },
  { question: "Comment payer ?", reponse: "Par carte bancaire ou par prélèvement SEPA. Les prix sont hors taxes : la TVA à 20 % s'y ajoute." },
  { question: `Quand la formule ${PLANS.pro.name} sera-t-elle disponible ?`, reponse: `Elle ouvrira avec les situations de travaux, la retenue de garantie et l'autoliquidation en sous-traitance, aujourd'hui en préparation. Elle ne sera proposée qu'une fois ces fonctions livrées.` },
  { question: "Qonforme est-il prêt pour la facturation électronique ?", reponse: "Qonforme produit des factures PDF accompagnées de leurs données structurées Factur-X. L'émission via une plateforme agréée, obligatoire pour les TPE à partir de septembre 2027, est en préparation." },
  { question: "Est-ce que Qonforme fonctionne sur mobile ?", reponse: "Oui. Qonforme fonctionne sur téléphone, tablette et ordinateur, et s'installe sur l'écran d'accueil de votre téléphone." },
]).map((f) => ({ question: nbsp(f.question), reponse: nbsp(f.reponse) }))

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
      <div className="relative min-h-screen overflow-x-clip bg-q-bg text-q-ink">
        {/* Halo bleu discret derrière l'en-tête et le titre */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 h-[520px]"
          style={{ background: 'radial-gradient(900px 360px at 50% -80px, rgba(37,99,235,.10), transparent 70%)' }}
        />

        <PublicHeaderWrapper />

        <main className="relative">
          {/* Titre */}
          <header className="mx-auto flex max-w-[1200px] flex-col items-center gap-[18px] px-4 pt-[120px] text-center sm:px-6 sm:pt-[152px]">
            <h1 className="max-w-[860px] font-display text-[clamp(38px,4.6vw,64px)] font-semibold leading-[1.04] tracking-[-0.035em] text-q-ink-strong [text-wrap:balance]">
              <span className="sm:block">Vos devis sont gratuits.</span>{' '}
              <span className="q-serif sm:block">Vous payez quand vous facturez.</span>
            </h1>
            <p className="max-w-[600px] text-[17px] leading-[1.55] text-q-text-3 [text-wrap:pretty] sm:text-lg">
              Commencez sans carte bancaire. Vous choisissez une formule au moment d&apos;envoyer votre première facture.
            </p>
          </header>

          {/* Formules */}
          <section aria-label="Formules" className="mx-auto max-w-[1200px] px-4 pt-8 sm:px-6 sm:pt-10">
            <PricingSelector isAuthenticated={!!user} />
          </section>

          {/* Comparaison */}
          <section aria-labelledby="comparer" className="mx-auto max-w-[1200px] px-4 pt-16 sm:px-6 sm:pt-20">
            <h2 id="comparer" className="mb-6 font-display text-[28px] font-semibold tracking-[-0.025em] text-q-ink-strong sm:text-[32px]">
              Comparer <span className="q-serif">les offres</span>
            </h2>
            <PlanComparison />
            <p className="mt-3.5 text-[13px] leading-relaxed text-q-text-4">
              Prix hors taxes&nbsp;: la TVA à 20&nbsp;% s&apos;y ajoute, le montant TTC est indiqué sous chaque prix. Vos factures restent consultables après résiliation.
            </p>
          </section>

          {/* Questions */}
          <section aria-labelledby="questions" className="mx-auto max-w-[860px] px-4 pb-16 pt-16 sm:px-6 sm:pb-24 sm:pt-20">
            <h2 id="questions" className="mb-3 font-display text-[28px] font-semibold tracking-[-0.025em] text-q-ink-strong sm:text-[32px]">
              Questions sur <span className="q-serif">les offres</span>
            </h2>
            <div className="border-t border-q-line">
              {FAQ.map((f) => (
                <div key={f.question} className="border-b border-q-line py-5">
                  <h3 className="text-base font-semibold text-q-ink">{f.question}</h3>
                  <p className="mt-2 text-[15px] leading-[1.6] text-q-text-3">{f.reponse}</p>
                </div>
              ))}
            </div>
          </section>

        </main>

        <Footer />
      </div>
    </>
  )
}
