import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import Image from 'next/image'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import PricingSelector from '@/components/billing/PricingSelector'
import { canIssueInvoices, safeNextPath } from '@/lib/stripe/access'
import { recoverActiveSubscription } from '@/lib/stripe/recovery'

export const metadata: Metadata = {
  title: 'Choisir ma formule — Qonforme',
  robots: { index: false, follow: false },
}
export const dynamic = 'force-dynamic'

const LOGO_LONG_BLEU = 'https://lxnowrmyyaylvnognifu.supabase.co/storage/v1/object/public/Logos/Logo%20long%20bleu.webp'

/**
 * Choix de la formule, pour un compte connecté.
 * On y arrive depuis le mur de paiement d'une facture (`next` = la facture),
 * depuis Paramètres › Abonnement ou depuis la page Tarifs. Ce n'est plus une
 * étape de l'inscription : les devis sont gratuits, la formule se choisit à la
 * première facture.
 */
export default async function ChoosePlanPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>
}) {
  const { next: rawNext } = await searchParams
  const next = safeNextPath(rawNext)

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  let alreadyActive = false
  if (user) {
    const { data: sub } = await supabase
      .from('subscriptions')
      .select('status, stripe_customer_id')
      .eq('user_id', user.id)
      .maybeSingle()

    alreadyActive = canIssueInvoices(sub?.status)
    if (!alreadyActive && sub?.stripe_customer_id) {
      alreadyActive = await recoverActiveSubscription(user.id, sub.stripe_customer_id)
    }
  }

  // Hors de tout try/catch : redirect() lève une exception interne de Next.js
  if (alreadyActive) redirect(next ?? '/settings/billing')

  const backHref = next ?? (user ? '/dashboard' : '/')

  return (
    <div className="min-h-[100dvh] bg-[#F8FAFC]">
      <div
        className="mx-auto w-full max-w-[1080px] px-4 sm:px-6 pb-12"
        style={{ paddingTop: 'max(20px, env(safe-area-inset-top, 20px))' }}
      >
        <div className="flex justify-center mb-8">
          <Link href={user ? '/dashboard' : '/'} aria-label="Qonforme">
            <Image src={LOGO_LONG_BLEU} alt="Qonforme" width={180} height={44} className="h-8 lg:h-9 w-auto" sizes="180px" priority />
          </Link>
        </div>

        <div className="text-center mb-8">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#0F172A]">
            {next?.startsWith('/invoices/') ? 'Votre facture est prête.' : 'Choisissez votre formule'}
          </h1>
          <p className="mt-2 text-[15px] text-slate-500">
            {next?.startsWith('/invoices/')
              ? 'Choisissez votre formule pour l’envoyer. Vos devis restent gratuits.'
              : 'Vos devis sont gratuits. La formule sert à émettre vos factures.'}
          </p>
        </div>

        <PricingSelector isAuthenticated={!!user} backHref={backHref} next={next} showFree={!user} />
      </div>
    </div>
  )
}
