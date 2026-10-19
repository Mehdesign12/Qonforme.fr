/**
 * Gestion des comptes d'essai Stripe (Admin › Paiements). Serveur seulement :
 * clé service_role, appelé par les routes /api/admin/stripe-test-accounts.
 *
 * Un compte d'essai paie dans le bac à sable (lib/stripe/mode.ts). Le retirer de
 * la liste efface aussi son abonnement d'essai : un abonnement fictif ne doit
 * jamais laisser un accès « payé » à un compte revenu en production.
 */
import { createAdminClient } from '@/lib/supabase/server'
import { isMissingSchema } from './test-users'

export interface TestAccount {
  userId: string
  email: string
  addedAt: string
  subscription: { plan: string; status: string; livemode: boolean } | null
}

export type TestAccountResult<T> =
  | { ok: true; data: T }
  | { ok: false; status: number; error: string }

const MIGRATION_MISSING =
  "La migration 20261019_stripe_test_mode.sql n'est pas encore appliquée dans Supabase."
const READ_FAILED = 'Lecture impossible. Réessayez dans un instant.'

/** Retrouve un compte par son adresse email (Auth admin, au plus 10 000 comptes lus). */
async function findUserByEmail(email: string): Promise<{ id: string; email: string } | null> {
  const admin = createAdminClient()
  const wanted = email.trim().toLowerCase()
  for (let page = 1; page <= 10; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 })
    if (error) throw new Error(error.message)
    const found = data.users.find((u) => u.email?.toLowerCase() === wanted)
    if (found) return { id: found.id, email: found.email ?? wanted }
    if (data.users.length < 1000) return null
  }
  return null
}

async function emailOf(userId: string): Promise<string> {
  const admin = createAdminClient()
  const { data } = await admin.auth.admin.getUserById(userId)
  return data?.user?.email ?? '(compte supprimé)'
}

export async function listTestAccounts(): Promise<TestAccountResult<TestAccount[]>> {
  const admin = createAdminClient()
  const { data: rows, error } = await admin
    .from('stripe_test_users')
    .select('user_id, added_at')
    .order('added_at', { ascending: false })

  if (error) {
    if (isMissingSchema(error)) return { ok: false, status: 409, error: MIGRATION_MISSING }
    console.error('[stripe/test-accounts] Lecture impossible:', error)
    return { ok: false, status: 503, error: READ_FAILED }
  }

  const accounts: TestAccount[] = []
  for (const row of rows ?? []) {
    const { data: sub } = await admin
      .from('subscriptions')
      .select('plan, status, livemode')
      .eq('user_id', row.user_id)
      .maybeSingle()
    accounts.push({
      userId: row.user_id,
      email: await emailOf(row.user_id),
      addedAt: row.added_at,
      subscription: sub ? { plan: sub.plan, status: sub.status, livemode: sub.livemode !== false } : null,
    })
  }
  return { ok: true, data: accounts }
}

export async function addTestAccount(email: string): Promise<TestAccountResult<TestAccount>> {
  const clean = email.trim()
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clean)) {
    return { ok: false, status: 400, error: 'Adresse email invalide.' }
  }

  let user: { id: string; email: string } | null
  try {
    user = await findUserByEmail(clean)
  } catch (err) {
    console.error('[stripe/test-accounts] Recherche du compte impossible:', err)
    return { ok: false, status: 503, error: READ_FAILED }
  }
  if (!user) {
    return { ok: false, status: 404, error: "Aucun compte Qonforme avec cette adresse. Créez-le d'abord sur le site." }
  }

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('stripe_test_users')
    .upsert({ user_id: user.id }, { onConflict: 'user_id' })
    .select('added_at')
    .single()

  if (error) {
    if (isMissingSchema(error)) return { ok: false, status: 409, error: MIGRATION_MISSING }
    console.error('[stripe/test-accounts] Ajout impossible:', error)
    return { ok: false, status: 500, error: "L'ajout n'a pas pu aboutir. Réessayez." }
  }
  return { ok: true, data: { userId: user.id, email: user.email, addedAt: data.added_at, subscription: null } }
}

/** Retire un compte d'essai et efface son abonnement d'essai (jamais un abonnement de production). */
export async function removeTestAccount(userId: string): Promise<TestAccountResult<{ deletedSubscription: boolean }>> {
  const admin = createAdminClient()

  const { error } = await admin.from('stripe_test_users').delete().eq('user_id', userId)
  if (error) {
    if (isMissingSchema(error)) return { ok: false, status: 409, error: MIGRATION_MISSING }
    console.error('[stripe/test-accounts] Retrait impossible:', error)
    return { ok: false, status: 500, error: "Le retrait n'a pas pu aboutir. Réessayez." }
  }

  const { data: deleted, error: subError } = await admin
    .from('subscriptions')
    .delete()
    .eq('user_id', userId)
    .eq('livemode', false)
    .select('id')
  if (subError) {
    console.error("[stripe/test-accounts] Suppression de l'abonnement d'essai impossible:", subError)
    return { ok: false, status: 500, error: "Compte retiré, mais son abonnement d'essai n'a pas pu être effacé. Utilisez « Supprimer les abonnements d'essai »." }
  }
  return { ok: true, data: { deletedSubscription: (deleted?.length ?? 0) > 0 } }
}

/** Efface tous les abonnements du bac à sable. Ne touche jamais `livemode = true`. */
export async function purgeTestSubscriptions(): Promise<TestAccountResult<{ deleted: number }>> {
  const admin = createAdminClient()
  const { data, error } = await admin.from('subscriptions').delete().eq('livemode', false).select('id')
  if (error) {
    if (isMissingSchema(error)) return { ok: false, status: 409, error: MIGRATION_MISSING }
    console.error("[stripe/test-accounts] Purge impossible:", error)
    return { ok: false, status: 500, error: "La suppression n'a pas pu aboutir. Réessayez." }
  }
  return { ok: true, data: { deleted: data?.length ?? 0 } }
}
