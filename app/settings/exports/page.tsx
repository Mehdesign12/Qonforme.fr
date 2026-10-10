import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { ExportsView } from '@/components/settings/ExportsView'

export const metadata: Metadata = { title: 'Exports comptables' }
export const dynamic = 'force-dynamic'

export default async function ExportsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  let siren        = ''
  let sirenMissing = true
  let hasIssued: boolean | null = null

  if (user) {
    const [{ data: company }, { count, error }] = await Promise.all([
      supabase.from('companies').select('siren').eq('user_id', user.id).single(),
      // Factures émises (hors brouillons) : sans aucune, la page montre l'état vide
      supabase.from('invoices').select('id', { count: 'exact', head: true }).eq('user_id', user.id).neq('status', 'draft'),
    ])

    siren        = company?.siren?.replace(/\s/g, '') ?? ''
    sirenMissing = !siren
    // Erreur de lecture : on garde le formulaire plutôt qu'un état vide trompeur
    hasIssued    = error || count === null ? null : count > 0
  }

  return <ExportsView mode="app" siren={siren} sirenMissing={sirenMissing} hasIssued={hasIssued} />
}
