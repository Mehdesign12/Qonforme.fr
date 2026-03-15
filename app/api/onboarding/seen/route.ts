import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/server'

export async function POST() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }

    const admin = createAdminClient()
    const { data: updated, error } = await admin
      .from('companies')
      .update({
        onboarding_seen_at: new Date().toISOString(),
      })
      .eq('user_id', user.id)
      .select('id')

    if (error) {
      console.error('[onboarding/seen] Erreur update:', error)
      return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
    }

    if (!updated || updated.length === 0) {
      // Aucune ligne affectée : la company n'existe pas encore (race condition
      // webhook Stripe) ou user_id ne correspond à aucune ligne.
      // Non bloquant pour l'UX — le localStorage client prend le relais.
      console.warn('[onboarding/seen] 0 lignes mises à jour pour user_id:', user.id)
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[onboarding/seen] Exception:', err)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
