-- ============================================================
-- Abonnements : écriture réservée au serveur
--
-- Les politiques « subscriptions_insert_own » et « subscriptions_update_own »
-- laissaient n'importe quel utilisateur connecté écrire sa propre ligne depuis
-- son navigateur (clé anon + son jeton de session), par exemple :
--   supabase.from('subscriptions').upsert({ user_id: <lui>, status: 'active', plan: 'pro' })
-- et ainsi passer le mur de paiement sans jamais payer.
--
-- Toutes les écritures légitimes passent par le serveur avec la clé
-- service_role, qui ignore la RLS : webhook Stripe, route de paiement, page de
-- retour après paiement, page Abonnement, administration. Seule la lecture de
-- sa propre ligne reste ouverte à l'utilisateur.
--
-- Idempotent : sans effet si les politiques n'existent pas.
-- À appliquer : Supabase Dashboard → SQL Editor, ou `supabase db push`.
-- ============================================================

DROP POLICY IF EXISTS "subscriptions_insert_own" ON public.subscriptions;
DROP POLICY IF EXISTS "subscriptions_update_own" ON public.subscriptions;
