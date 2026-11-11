-- ============================================================
-- Formules offertes par l'admin (testeurs, comptes de démonstration)
-- Rejouable. À exécuter dans Supabase › SQL Editor.
-- ============================================================
--
-- Une formule offerte est une ligne de `subscriptions` sans abonnement Stripe
-- (stripe_subscription_id vide), marquée `granted_by_admin`. Elle donne les
-- mêmes droits qu'une formule payée (statut « active »), jusqu'à
-- `current_period_end` (vide : sans limite). La tâche planifiée
-- /api/cron/onboarding la passe en « canceled » à son échéance.
-- Si le compte prend ensuite un abonnement payant, le webhook Stripe pose un
-- stripe_subscription_id : la ligne n'est plus traitée comme offerte.

ALTER TABLE public.subscriptions
  ADD COLUMN IF NOT EXISTS granted_by_admin BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS granted_note     TEXT,
  ADD COLUMN IF NOT EXISTS granted_at       TIMESTAMPTZ;

COMMENT ON COLUMN public.subscriptions.granted_by_admin IS
  'Formule offerte par l''admin, sans paiement (testeurs). Vraie seulement sans stripe_subscription_id.';
COMMENT ON COLUMN public.subscriptions.granted_note IS
  'Note de l''admin sur la formule offerte (ex. « Testeur »). Jamais montrée au compte.';

CREATE INDEX IF NOT EXISTS subscriptions_granted_idx
  ON public.subscriptions (current_period_end)
  WHERE granted_by_admin AND stripe_subscription_id IS NULL;
