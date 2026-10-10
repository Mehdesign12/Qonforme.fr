import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import FecExportSection from './FecExportSection'
import SalesJournalSection from './SalesJournalSection'

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

  return (
    <div className="max-w-2xl animate-fade-in">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-[#0F172A] dark:text-[#E2E8F0]">Exports comptables</h1>
        <p className="text-sm text-slate-500 mt-1">
          Fichier des Écritures Comptables (FEC) — requis lors de toute vérification de comptabilité.
        </p>
      </div>
      <FecExportSection sirenMissing={sirenMissing} siren={siren} />
      <div className="mt-6">
        <SalesJournalSection />
      </div>
    </div>
  )
}
