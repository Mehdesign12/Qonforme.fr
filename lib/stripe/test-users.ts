/**
 * Comptes d'essai : les utilisateurs qui paient dans le bac à sable Stripe
 * (lib/stripe/mode.ts). Table `stripe_test_users`, écrite et lue par le serveur
 * seulement (clé service_role), migration 20261019_stripe_test_mode.sql.
 *
 * Règle de sûreté : en cas de doute, production. Table absente (migration pas
 * encore appliquée) : tout le monde est en production. Lecture en échec : on le
 * dit (null) plutôt que de deviner ; l'appelant refuse alors d'ouvrir le paiement.
 */
import { createAdminClient } from '@/lib/supabase/server'
import type { StripeMode } from './mode'

interface DbError { code?: string; message?: string }

/** Table ou colonne introuvable : migration pas encore appliquée. */
export function isMissingSchema(error: DbError | null | undefined): boolean {
  if (!error) return false
  const text = `${error.code ?? ''} ${error.message ?? ''}`
  return /42P01|42703|PGRST204|PGRST205|schema cache|does not exist/i.test(text)
}

/** Mode d'un utilisateur. `null` : lecture impossible (ne pas ouvrir de paiement). */
export async function getUserStripeMode(userId: string): Promise<StripeMode | null> {
  try {
    const admin = createAdminClient()
    const { data, error } = await admin
      .from('stripe_test_users')
      .select('user_id')
      .eq('user_id', userId)
      .maybeSingle()

    if (error) {
      if (isMissingSchema(error)) return 'live'
      console.error('[stripe/test-users] Lecture impossible:', error)
      return null
    }
    return data ? 'test' : 'live'
  } catch (err) {
    // Client d'administration impossible à créer (variables manquantes) : mode illisible
    console.error('[stripe/test-users] Lecture impossible:', err)
    return null
  }
}
