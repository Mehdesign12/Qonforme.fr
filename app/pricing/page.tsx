import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import PricingSelector from '@/components/billing/PricingSelector'
import Link from 'next/link'
import { stripe } from '@/lib/stripe/client'
import { upsertSubscription } from '@/lib/stripe/subscription'
import { getPlanByPriceId, type PlanId, type BillingPeriod } from '@/lib/stripe/plans'

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
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  // backHref pour le bouton "Retour" dans PricingSelector :
  // — utilisateur connecté → /settings/billing (évite la boucle de redirection)
  // — visiteur anonyme → / (landing page)
  let backHref = '/'

  if (user) {
    backHref = '/settings/billing'

    const { data: sub } = await supabase
      .from('subscriptions')
      .select('status, stripe_customer_id, stripe_subscription_id')
      .eq('user_id', user.id)
      .single()

    if (sub?.status === 'active') {
      redirect('/dashboard')
    }

    // ── Recovery automatique ────────────────────────────────────────────────
    // Si l'abonnement est "incomplete" (webhook non reçu ou erreur réseau) mais
    // que l'utilisateur a un stripe_customer_id, on interroge Stripe directement
    // pour trouver un abonnement actif et récupérer l'accès sans intervention.
    if (sub?.stripe_customer_id) {
      try {
        const stripeCustomerSubs = await stripe.subscriptions.list({
          customer: sub.stripe_customer_id,
          status: 'active',
          limit: 1,
        })

        if (stripeCustomerSubs.data.length > 0) {
          const stripeSub = stripeCustomerSubs.data[0]
          const priceId = stripeSub.items.data[0]?.price.id

          if (priceId) {
            const planInfo = getPlanByPriceId(priceId)
            const metaPlan = stripeSub.metadata?.plan
            const resolvedPlan: PlanId | undefined =
              planInfo?.plan ??
              (metaPlan === 'starter' || metaPlan === 'pro' ? (metaPlan as PlanId) : undefined)
            const resolvedPeriod: BillingPeriod =
              planInfo?.period ??
              (stripeSub.metadata?.billing_period === 'yearly' ? 'yearly' : 'monthly')

            if (resolvedPlan) {
              // Extraire current_period_end depuis l'item (Stripe API 2025)
              const item = stripeSub.items?.data?.[0]
              const ts = item
                ? (item as unknown as { current_period_end?: number }).current_period_end
                : null
              const currentPeriodEnd = ts ? new Date(ts * 1000) : null

              await upsertSubscription({
                userId:               user.id,
                stripeCustomerId:     sub.stripe_customer_id!,
                stripeSubscriptionId: stripeSub.id,
                stripePriceId:        priceId,
                plan:                 resolvedPlan,
                billingPeriod:        resolvedPeriod,
                status:               'active',
                currentPeriodEnd,
              })

              console.log(`[pricing] Recovery OK — user ${user.id} → plan ${resolvedPlan}`)
              redirect('/dashboard')
            }
          }
        }
      } catch (err) {
        // Stripe inaccessible ou données incomplètes → on affiche la page normalement
        console.error('[pricing] Recovery check failed:', err)
      }
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
      <MetaPixelEvent event="ViewContent" data={{ content_name: 'Pricing', content_category: 'pricing' }} />
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

      {/* ── Contenu ───────────────────────────────────────────────────────── */}
      {/*
       * Sur mobile : px-4 serré, pb avec safe-area pour ne pas masquer le CTA sticky.
       * Sur desktop : max-w-[1080px] centré, padding généreux.
       */}
      <div className="relative z-10 flex-1 w-full max-w-[1080px] mx-auto px-4 sm:px-6 lg:px-6 pb-4 lg:pb-12">
        <PricingSelector backHref={backHref} />
      </div>
    </>
  )
}
