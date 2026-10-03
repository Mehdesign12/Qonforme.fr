import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { hasDossiers } from '@/lib/accountant/server'
import DashboardClient from '@/components/dashboard/DashboardClient'
import { DashboardBody } from '@/components/dashboard/DashboardBody'
import { DashboardSkeleton } from '@/components/dashboard/DashboardSkeleton'
import { getDashboardView } from '@/components/dashboard/data'
import { parsePeriod, todayInParis, type DashPeriod, type DashboardInput } from '@/components/dashboard/model'

export const metadata: Metadata = { title: 'Tableau de bord' }
export const dynamic = 'force-dynamic'

export default async function DashboardPage({ searchParams }: { searchParams: { periode?: string; depuis?: string } }) {
  const period = parsePeriod(searchParams?.periode)
  let userId: string | null = null
  let firstName = ''
  let company: DashboardInput['company'] = null
  let showWelcome = false
  let companyMissing = false
  let startScreen = false

  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (user) {
      userId = user.id
      // Prénom depuis user_metadata (titre d'accueil d'un compte neuf)
      firstName = (user.user_metadata?.first_name as string) || ''

      // Vérifier que la société existe — si non, renvoyer vers la création
      const { data, error: companyError } = await supabase
        .from('companies')
        .select('name, siren, address, zip_code, city, onboarding_seen_at')
        .eq('user_id', user.id)
        .single()

      // PGRST116 = aucune ligne → société jamais créée ; une autre erreur (réseau) ne redirige pas
      if (!data && (!companyError || companyError.code === 'PGRST116')) companyMissing = true

      if (data) {
        company = { name: data.name, siren: data.siren, address: data.address, zip_code: data.zip_code, city: data.city }
        // Premiers pas pas encore vus
        showWelcome = !data.onboarding_seen_at
        // Compte neuf (ni devis ni facture), premier passage : écran « Par quoi
        // commencer ? » (app/demarrer), une seule fois, jamais depuis cet écran
        if (showWelcome && searchParams?.depuis !== 'demarrer') {
          const [quotes, invoices] = await Promise.all([
            supabase.from('quotes').select('id', { count: 'exact', head: true }).eq('user_id', user.id),
            supabase.from('invoices').select('id', { count: 'exact', head: true }).eq('user_id', user.id),
          ])
          startScreen = !quotes.error && !invoices.error && quotes.count === 0 && invoices.count === 0
        }
      }
    }
  } catch {
    // Non bloquant
  }

  // Hors du try/catch : redirect() lève une exception que le catch avalait.
  // Un comptable invité n'a pas d'entreprise : il va à son espace (lib/accountant).
  if (companyMissing) redirect(userId && (await hasDossiers(userId)) ? '/comptable' : '/signup/company')
  if (startScreen) redirect('/demarrer')

  return (
    <Suspense fallback={<DashboardSkeleton />}>
      <DashboardContent userId={userId} firstName={firstName} company={company} showWelcome={showWelcome} period={period} />
    </Suspense>
  )
}

/** Données (requêtes en parallèle) puis rendu, diffusé après le squelette. */
async function DashboardContent({
  userId,
  firstName,
  company,
  showWelcome,
  period,
}: {
  userId: string | null
  firstName: string
  company: DashboardInput['company']
  showWelcome: boolean
  period: DashPeriod
}) {
  const supabase = await createClient()
  const view = await getDashboardView({ supabase, userId, firstName, company, today: todayInParis(), period })

  return (
    <DashboardClient showWelcome={showWelcome} inline={view.isNewAccount}>
      <DashboardBody view={view} />
    </DashboardClient>
  )
}
