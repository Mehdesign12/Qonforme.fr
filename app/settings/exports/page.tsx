import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import FecExportSection from './FecExportSection'

export const metadata: Metadata = { title: 'Paramètres — Exports comptables' }
export const dynamic = 'force-dynamic'

export default async function ExportsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  let siren      = ''
  let sirenMissing = true

  if (user) {
    const { data: company } = await supabase
      .from('companies')
      .select('siren')
      .eq('user_id', user.id)
      .single()

    siren        = company?.siren?.replace(/\s/g, '') ?? ''
    sirenMissing = !siren
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
    </div>
  )
}
