-- ============================================================
-- À APPLIQUER AVANT LA MISE EN LIGNE DE LA FONCTION (le code tourne déjà sans
-- elle : tant qu'elle manque, rien de nouveau ne part et l'écran de démarrage
-- n'affiche ni le devis d'essai ni le rappel).
-- Supabase Dashboard → SQL Editor, ou `supabase db push`. Idempotente : peut
-- être rejouée sans effet.
--
-- Démarrage d'un compte neuf (DECISIONS-STRATEGIQUES.md § 8 et § 10) :
--
-- 1. onboarding_journeys : les comptes qui reçoivent la séquence d'emails de
--    démarrage. Une ligne n'est créée qu'à l'inscription (app/api/auth/signup),
--    APRÈS l'application de cette migration : les comptes existants n'y sont
--    jamais, donc ne reçoivent rien quand la migration est appliquée. Aucune
--    reprise de l'existant n'est faite ici, volontairement.
-- 2. onboarding_emails : journal de la séquence. Une étape ne part qu'une fois
--    par compte (contrainte d'unicité, réservée AVANT l'envoi par le cron).
-- 3. email_preferences : désinscription des conseils de démarrage (lien signé
--    dans chaque email, réglage dans Paramètres › Relances). Pas de ligne =
--    abonné. Les emails transactionnels ne sont pas concernés.
-- 4. onboarding_reminders : rappel « Je le ferai plus tard », un seul en attente
--    par compte, envoyé par le cron app/api/cron/onboarding.
-- 5. trial_quote_sends : devis d'essai envoyés à soi-même (limite de 3 par
--    24 heures). Le devis d'essai n'est jamais enregistré dans `quotes`.
--
-- Toutes ces tables s'écrivent côté serveur (clé service_role) ; le compte
-- connecté ne peut que lire ses propres lignes.
--
-- Après application : programmer le cron (voir app/api/cron/onboarding/route.ts),
-- toutes les 15 minutes, avec l'en-tête Authorization: Bearer {CRON_SECRET}.
-- ============================================================

-- ── 1. Comptes inscrits dans la séquence ────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.onboarding_journeys (
  user_id     uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  enrolled_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS onboarding_journeys_enrolled_at
  ON public.onboarding_journeys (enrolled_at);

ALTER TABLE public.onboarding_journeys ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "onboarding_journeys_select_own" ON public.onboarding_journeys;
CREATE POLICY "onboarding_journeys_select_own" ON public.onboarding_journeys
  FOR SELECT USING (auth.uid() = user_id);

-- ── 2. Journal de la séquence ───────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.onboarding_emails (
  id      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  step    text NOT NULL CHECK (step IN ('welcome', 'first_quote', 'nudge_7d', 'quote_to_invoice', 'essentiel')),
  sent_to text NULL,
  sent_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT onboarding_emails_step_once UNIQUE (user_id, step)
);

ALTER TABLE public.onboarding_emails ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "onboarding_emails_select_own" ON public.onboarding_emails;
CREATE POLICY "onboarding_emails_select_own" ON public.onboarding_emails
  FOR SELECT USING (auth.uid() = user_id);

-- ── 3. Préférences d'emails ─────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.email_preferences (
  user_id           uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  -- Conseils de démarrage (séquence). Ne concerne ni l'envoi des documents, ni
  -- les copies, ni les relances de factures, ni les emails de sécurité.
  onboarding_emails boolean NOT NULL DEFAULT true,
  unsubscribed_at   timestamptz NULL,
  updated_at        timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.email_preferences ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "email_preferences_select_own" ON public.email_preferences;
CREATE POLICY "email_preferences_select_own" ON public.email_preferences
  FOR SELECT USING (auth.uid() = user_id);

-- ── 4. Rappel « Je le ferai plus tard » ─────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.onboarding_reminders (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  -- Étape visée par le lien de l'email
  target       text NOT NULL CHECK (target IN ('quote', 'trial', 'invoice', 'dashboard')),
  remind_at    timestamptz NOT NULL,
  -- pending (programmé), sending (réservé par le cron), sent, cancelled,
  -- expired (cron arrêté plus de 24 heures : on n'envoie pas un rappel périmé)
  status       text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sending', 'sent', 'cancelled', 'expired')),
  created_at   timestamptz NOT NULL DEFAULT now(),
  sent_at      timestamptz NULL,
  cancelled_at timestamptz NULL
);

-- Un seul rappel en attente par compte
CREATE UNIQUE INDEX IF NOT EXISTS onboarding_reminders_one_pending
  ON public.onboarding_reminders (user_id) WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS onboarding_reminders_due
  ON public.onboarding_reminders (remind_at) WHERE status = 'pending';

ALTER TABLE public.onboarding_reminders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "onboarding_reminders_select_own" ON public.onboarding_reminders;
CREATE POLICY "onboarding_reminders_select_own" ON public.onboarding_reminders
  FOR SELECT USING (auth.uid() = user_id);

-- ── 5. Devis d'essai envoyés à soi-même ─────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.trial_quote_sends (
  id      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  sent_to text NULL,
  sent_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS trial_quote_sends_user_time
  ON public.trial_quote_sends (user_id, sent_at DESC);

ALTER TABLE public.trial_quote_sends ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "trial_quote_sends_select_own" ON public.trial_quote_sends;
CREATE POLICY "trial_quote_sends_select_own" ON public.trial_quote_sends
  FOR SELECT USING (auth.uid() = user_id);
