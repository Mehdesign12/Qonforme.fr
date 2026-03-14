-- ============================================================
-- Fix : ajout des colonnes manquantes sur public.subscriptions
-- Idempotent : safe à re-exécuter plusieurs fois
-- À exécuter dans Supabase Dashboard → SQL Editor
-- ============================================================

-- 1. Colonnes Stripe manquantes
ALTER TABLE public.subscriptions
  ADD COLUMN IF NOT EXISTS stripe_customer_id       TEXT,
  ADD COLUMN IF NOT EXISTS stripe_subscription_id   TEXT,
  ADD COLUMN IF NOT EXISTS stripe_price_id           TEXT;

-- 2. Colonnes plan/période (avec valeurs par défaut pour les lignes existantes)
ALTER TABLE public.subscriptions
  ADD COLUMN IF NOT EXISTS billing_period TEXT NOT NULL DEFAULT 'monthly';

ALTER TABLE public.subscriptions
  DROP CONSTRAINT IF EXISTS subscriptions_billing_period_check;
ALTER TABLE public.subscriptions
  ADD CONSTRAINT subscriptions_billing_period_check
  CHECK (billing_period IN ('monthly', 'yearly'));

-- 3. Contrainte CHECK sur plan (au cas où absente)
ALTER TABLE public.subscriptions
  DROP CONSTRAINT IF EXISTS subscriptions_plan_check;
ALTER TABLE public.subscriptions
  ADD CONSTRAINT subscriptions_plan_check
  CHECK (plan IN ('starter', 'pro'));

-- 4. Contrainte CHECK sur status (au cas où absente)
ALTER TABLE public.subscriptions
  DROP CONSTRAINT IF EXISTS subscriptions_status_check;
ALTER TABLE public.subscriptions
  ADD CONSTRAINT subscriptions_status_check
  CHECK (status IN ('active', 'past_due', 'canceled', 'incomplete'));

-- 5. Colonnes de dates manquantes
ALTER TABLE public.subscriptions
  ADD COLUMN IF NOT EXISTS current_period_end TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS canceled_at        TIMESTAMPTZ;

ALTER TABLE public.subscriptions
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- 6. Index UNIQUE sur user_id (nécessaire pour upsert onConflict: 'user_id')
CREATE UNIQUE INDEX IF NOT EXISTS subscriptions_user_id_idx
  ON public.subscriptions(user_id);

-- 7. Index UNIQUE sur stripe_subscription_id
CREATE UNIQUE INDEX IF NOT EXISTS subscriptions_stripe_subscription_id_idx
  ON public.subscriptions(stripe_subscription_id);

-- 8. Index sur stripe_customer_id (lookup webhook invoice.paid)
CREATE INDEX IF NOT EXISTS subscriptions_stripe_customer_id_idx
  ON public.subscriptions(stripe_customer_id);

-- 9. Index sur status (vérification middleware)
CREATE INDEX IF NOT EXISTS subscriptions_status_idx
  ON public.subscriptions(status);

-- 10. Trigger updated_at automatique
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS subscriptions_updated_at ON public.subscriptions;
CREATE TRIGGER subscriptions_updated_at
  BEFORE UPDATE ON public.subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 11. RLS (idempotent)
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "subscriptions_select_own" ON public.subscriptions;
CREATE POLICY "subscriptions_select_own"
  ON public.subscriptions FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "subscriptions_insert_own" ON public.subscriptions;
CREATE POLICY "subscriptions_insert_own"
  ON public.subscriptions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "subscriptions_update_own" ON public.subscriptions;
CREATE POLICY "subscriptions_update_own"
  ON public.subscriptions FOR UPDATE
  USING (auth.uid() = user_id);

-- Vérification finale : affiche toutes les colonnes de la table
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'subscriptions'
ORDER BY ordinal_position;
