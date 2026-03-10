-- ============================================================
-- Migration : table subscriptions (Stripe Billing)
-- ============================================================

CREATE TABLE IF NOT EXISTS public.subscriptions (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                  UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Identifiants Stripe
  stripe_customer_id       TEXT,
  stripe_subscription_id   TEXT UNIQUE,
  stripe_price_id          TEXT,

  -- Plan & période
  plan                     TEXT NOT NULL DEFAULT 'starter'
                             CHECK (plan IN ('starter', 'pro')),
  billing_period           TEXT NOT NULL DEFAULT 'monthly'
                             CHECK (billing_period IN ('monthly', 'yearly')),

  -- Statut de l'abonnement
  -- active        : paiement OK, accès complet
  -- past_due      : paiement en échec, accès bloqué
  -- canceled      : abonnement annulé, accès bloqué
  -- incomplete    : checkout initié mais paiement pas encore validé
  status                   TEXT NOT NULL DEFAULT 'incomplete'
                             CHECK (status IN ('active', 'past_due', 'canceled', 'incomplete')),

  -- Dates
  current_period_end       TIMESTAMPTZ,
  canceled_at              TIMESTAMPTZ,
  created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index pour les lookups fréquents
CREATE UNIQUE INDEX IF NOT EXISTS subscriptions_user_id_idx ON public.subscriptions(user_id);
CREATE INDEX IF NOT EXISTS subscriptions_stripe_customer_id_idx ON public.subscriptions(stripe_customer_id);
CREATE INDEX IF NOT EXISTS subscriptions_status_idx ON public.subscriptions(status);

-- Trigger : updated_at automatique
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

-- RLS : chaque utilisateur ne voit que sa propre subscription
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

-- Le service_role (webhooks) peut tout faire sans RLS
-- (les webhooks utilisent supabaseAdmin avec service_role_key)
