import { redirect } from 'next/navigation'
import { stripe } from '@/lib/stripe/client'

export const dynamic = 'force-dynamic'

interface ReturnPageProps {
  searchParams: Promise<{ session_id?: string }>
}

export default async function PricingReturnPage({ searchParams }: ReturnPageProps) {
  const { session_id } = await searchParams

  if (!session_id) {
    redirect('/pricing')
  }

  try {
    const session = await stripe.checkout.sessions.retrieve(session_id)

    if (session.status === 'complete') {
      // Paiement réussi → dashboard (le modal d'onboarding s'affiche si onboarding_seen_at est NULL)
      redirect('/dashboard')
    } else if (session.status === 'open') {
      // Session encore ouverte → retour pricing
      redirect('/pricing')
    } else {
      // Expired ou autre → retour pricing
      redirect('/pricing')
    }
  } catch {
    redirect('/pricing')
  }
}
