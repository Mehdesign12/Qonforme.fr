import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import PricingSelector from '@/components/billing/PricingSelector'
import StepIndicator from '@/components/auth/StepIndicator'
import Image from 'next/image'
import Link from 'next/link'

export const metadata: Metadata = { title: 'Choisir un plan — Qonforme' }
export const dynamic = 'force-dynamic'

const LOGO_LONG_BLEU = 'https://lxnowrmyyaylvnognifu.supabase.co/storage/v1/object/public/Logos/Logo%20long%20bleu.webp'
const PICTO_Q        = 'https://lxnowrmyyaylvnognifu.supabase.co/storage/v1/object/public/Logos/Logo%20bleu%20Qonforme%20PNG.webp'

const STEPS = [
  { label: 'Ton compte' },
  { label: 'Ton entreprise' },
  { label: 'Ton plan' },
]

export default async function PricingPage() {
  // Rediriger les utilisateurs avec un abonnement actif vers le dashboard
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

  return (
    /*
     * min-h = 100dvh pour couvrir exactement le viewport mobile (barre Safari incluse).
     * overflow-x-hidden évite tout scroll horizontal accidentel.
     */
    <div className="relative min-h-[100dvh] flex flex-col overflow-x-hidden">

      {/* ── Fond dégradé (identique AuthLayout) ──────────────────────────── */}
      <div aria-hidden className="pointer-events-none select-none fixed inset-0 z-0"
        style={{ background: 'linear-gradient(135deg, #EFF6FF 0%, #DBEAFE 30%, #EEF2FF 60%, #F0F9FF 85%, #F8FAFC 100%)' }}
      />
      <div aria-hidden className="pointer-events-none select-none fixed -top-32 -left-32 z-0 w-[480px] h-[480px] rounded-full"
        style={{ background: 'radial-gradient(circle at center, rgba(37,99,235,0.13) 0%, rgba(37,99,235,0.04) 55%, transparent 75%)' }}
      />
      <div aria-hidden className="pointer-events-none select-none fixed -bottom-24 -right-24 z-0 w-[420px] h-[420px] rounded-full"
        style={{ background: 'radial-gradient(circle at center, rgba(99,102,241,0.10) 0%, rgba(37,99,235,0.04) 50%, transparent 72%)' }}
      />
      {/* Grille de points — masquée sur mobile pour alléger le rendu */}
      <div aria-hidden className="pointer-events-none select-none fixed inset-0 z-0 hidden sm:block"
        style={{
          backgroundImage: 'radial-gradient(circle, rgba(37,99,235,0.08) 1px, transparent 1px)',
          backgroundSize: '32px 32px',
          maskImage: 'radial-gradient(ellipse 80% 80% at 50% 50%, black 40%, transparent 100%)',
        }}
      />
      {/* Filigrane Q — plus petit sur mobile */}
      <div aria-hidden className="pointer-events-none select-none fixed inset-0 z-0 flex items-center justify-center" style={{ opacity: 0.045 }}>
        <Image
          src={PICTO_Q}
          alt=""
          width={900}
          height={900}
          className="w-[340px] sm:w-[560px] lg:w-[900px]"
          unoptimized
          priority
        />
      </div>

      {/* ── Header : logo + StepIndicator ────────────────────────────────── */}
      {/*
       * pt-[env(safe-area-inset-top)] assure que le logo ne passe pas
       * sous la Dynamic Island / notch sur iPhone en mode Safari plein écran.
       */}
      <div
        className="relative z-10 flex flex-col items-center px-4"
        style={{ paddingTop: 'max(20px, env(safe-area-inset-top, 20px))' }}
      >
        <Link href="/" aria-label="Retour à l'accueil" className="mb-5 lg:mb-7">
          <Image
            src={LOGO_LONG_BLEU}
            alt="Qonforme"
            width={180}
            height={44}
            /* Plus petit sur mobile pour laisser de l'espace */
            className="h-8 lg:h-10 w-auto drop-shadow-sm"
            priority
            unoptimized
          />
        </Link>
        <StepIndicator steps={STEPS} current={2} />
      </div>

      {/* ── Contenu ───────────────────────────────────────────────────────── */}
      {/*
       * Sur mobile : px-4 serré, pb avec safe-area pour ne pas masquer le CTA sticky.
       * Sur desktop : max-w-[1080px] centré, padding généreux.
       */}
      <div className="relative z-10 flex-1 w-full max-w-[1080px] mx-auto px-4 sm:px-6 lg:px-6 pb-4 lg:pb-12">
        <PricingSelector />
      </div>
    </div>
  )
}
