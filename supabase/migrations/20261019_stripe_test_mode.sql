-- ============================================================
-- Mode essai Stripe : comptes d'essai et mode des abonnements
-- ============================================================
-- À APPLIQUER AVANT D'UTILISER Admin › Paiements (Supabase Dashboard → SQL
-- Editor). Le code déjà en production fonctionne sans elle : tant que la table
-- et la colonne n'existent pas, tous les comptes paient en production, comme
-- avant, et rien d'autre ne change.
--
-- Idempotente : peut être rejouée sans effet de bord.
--
-- Décision : DECISIONS-STRATEGIQUES.md § 14 (variante B : des comptes d'essai
-- paient dans le bac à sable Stripe, tous les autres restent en production).
--
-- - stripe_test_users : les utilisateurs qui paient dans le bac à sable Stripe.
--   Écrite et lue par le serveur seulement (clé service_role), comme les tables
--   seo_* : RLS sans politique et droits retirés aux rôles publics.
-- - subscriptions.livemode : false pour un abonnement du bac à sable. Vrai par
--   défaut : tous les abonnements existants sont des abonnements de production.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.stripe_test_users (
  user_id   UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  added_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.stripe_test_users ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.stripe_test_users FROM anon, authenticated;

ALTER TABLE public.subscriptions
  ADD COLUMN IF NOT EXISTS livemode BOOLEAN NOT NULL DEFAULT true;

COMMENT ON COLUMN public.subscriptions.livemode IS
  'false : abonnement du bac à sable Stripe (compte d''essai). true : production.';
