import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import PricingSelector from '@/components/billing/PricingSelector'
import { canIssueInvoices, safeNextPath } from '@/lib/stripe/access'
import { recoverActiveSubscription } from '@/lib/stripe/recovery'
import AuthLayout from '@/components/auth/AuthLayout'
import { Serif } from '@/components/auth/AuthHeading'

export const metadata: Metadata = {
  title: 'Choisir ma formule — Qonforme',
  robots: { index: false, follow: false },
}
export const dynamic = 'force-dynamic'

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

  const forInvoice = next?.startsWith('/invoices/') ?? false

  return (
    <AuthLayout
      maxWidth="wide"
      // Le lien « Retour » vers `backHref` est affiché par PricingSelector
      bar={{ logoHref: user ? '/dashboard' : '/' }}
    >
      <div className="mx-auto mb-3 max-w-[640px] text-center">
        <h1 className="q-display m-0 text-[30px] leading-[1.08] tracking-[-0.035em] text-q-ink-strong [text-wrap:balance] md:text-[42px]">
          {forInvoice
            ? <>Votre facture est <Serif>prête</Serif>.</>
            : <>Choisissez votre <Serif>formule</Serif>.</>}
        </h1>
        <p className="mt-3 text-[16px] leading-[1.6] text-q-text-3 md:text-[17px]">
          {forInvoice
            ? 'Choisissez votre formule pour l’envoyer. Vos devis restent gratuits.'
            : 'Vos devis sont gratuits. La formule sert à émettre vos factures.'}
        </p>
      </div>

      <PricingSelector isAuthenticated={!!user} backHref={backHref} next={next} showFree={!user} />
    </AuthLayout>
  )
}
