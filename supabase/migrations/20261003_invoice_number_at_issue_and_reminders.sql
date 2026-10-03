-- ============================================================
-- À APPLIQUER AVANT LA MISE EN LIGNE DE LA FONCTION (le code tourne déjà sans
-- elle : il garde alors le comportement d'avant, voir plus bas).
-- Supabase Dashboard → SQL Editor, ou `supabase db push`. Idempotente : peut
-- être rejouée sans effet.
--
-- 1. Numéro de facture attribué à l'émission
--    Un brouillon de facture n'a plus de numéro : il le reçoit au moment où il
--    est émis (envoi par email ou « Marquer comme envoyée »), dans l'ordre des
--    émissions (CGI, annexe II, art. 242 nonies A, I, 7° : « un numéro unique
--    basé sur une séquence chronologique et continue » ; BOFiP
--    BOI-TVA-DECLA-30-20-20-10, §§ 70 à 90). Voir lib/utils/document-numbering.ts.
--    Sans cette migration, la colonne refuse un numéro vide : le code numérote
--    encore à la création, comme avant.
--
-- 2. Relances réglables (factures et devis)
--    Réglages par entreprise (table reminder_settings) et journal des relances
--    envoyées (table document_reminders), qui garantit qu'une même relance ne
--    part jamais deux fois. Voir lib/reminders/ et app/api/cron/send-reminders.
--    Sans cette migration, le cron garde J+30 et J+45 sur les factures, comme avant.
--
-- Avant d'appliquer, vérifier qu'aucun numéro de facture n'est en double (la
-- contrainte d'unicité ne serait alors pas posée, un avertissement le signale) :
--   SELECT user_id, invoice_number, count(*) FROM invoices
--   GROUP BY user_id, invoice_number HAVING count(*) > 1;
-- ============================================================

-- ── 1. Numérotation à l'émission ────────────────────────────────────────────

-- Un brouillon peut ne pas avoir de numéro
ALTER TABLE public.invoices ALTER COLUMN invoice_number DROP NOT NULL;

-- Unicité du numéro par compte (déjà prévue par 20260901_unique_document_numbers.sql,
-- reprise ici si elle n'a pas été appliquée). Postgres admet plusieurs NULL :
-- les brouillons sans numéro ne se gênent pas.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.invoices'::regclass
      AND conname = 'invoices_user_id_invoice_number_key'
  ) THEN
    IF EXISTS (
      SELECT 1 FROM public.invoices
      WHERE invoice_number IS NOT NULL
      GROUP BY user_id, invoice_number HAVING count(*) > 1
    ) THEN
      RAISE WARNING 'Numéros de facture en double : contrainte invoices_user_id_invoice_number_key non posée. Corriger les doublons puis rejouer la migration.';
    ELSE
      ALTER TABLE public.invoices
        ADD CONSTRAINT invoices_user_id_invoice_number_key UNIQUE (user_id, invoice_number);
    END IF;
  END IF;
END $$;

-- Une facture sortie du brouillon a toujours un numéro (NOT VALID : contrôle
-- les écritures à venir sans relire l'historique, déjà numéroté à la création)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.invoices'::regclass
      AND conname = 'invoices_issued_has_number'
  ) THEN
    ALTER TABLE public.invoices
      ADD CONSTRAINT invoices_issued_has_number
      CHECK (status = 'draft' OR invoice_number IS NOT NULL) NOT VALID;
  END IF;
END $$;

-- ── 2. Réglages des relances, par compte ────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.reminder_settings (
  user_id                   uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  -- Relances des factures impayées
  invoice_reminders_enabled boolean   NOT NULL DEFAULT true,
  -- Rappel avant échéance (jours avant la date d'échéance), NULL = pas de rappel
  before_due_days           integer   NULL,
  -- Relances après échéance (jours après la date d'échéance) ; par défaut J+30 et J+45
  after_due_days            integer[] NOT NULL DEFAULT ARRAY[30, 45],
  -- Relance des devis envoyés sans réponse : désactivée par défaut
  quote_followup_enabled    boolean   NOT NULL DEFAULT false,
  quote_followup_days       integer   NOT NULL DEFAULT 7,
  quote_followup_max        integer   NOT NULL DEFAULT 1,
  created_at                timestamptz NOT NULL DEFAULT now(),
  updated_at                timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT reminder_settings_before_due_days_check
    CHECK (before_due_days IS NULL OR before_due_days IN (1, 3, 5, 7)),
  CONSTRAINT reminder_settings_after_due_days_check
    CHECK (after_due_days <@ ARRAY[7, 15, 30, 45]),
  CONSTRAINT reminder_settings_quote_followup_days_check
    CHECK (quote_followup_days IN (3, 5, 7, 10, 15)),
  CONSTRAINT reminder_settings_quote_followup_max_check
    CHECK (quote_followup_max IN (1, 2))
);

ALTER TABLE public.reminder_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "reminder_settings_select_own" ON public.reminder_settings;
CREATE POLICY "reminder_settings_select_own" ON public.reminder_settings
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "reminder_settings_insert_own" ON public.reminder_settings;
CREATE POLICY "reminder_settings_insert_own" ON public.reminder_settings
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "reminder_settings_update_own" ON public.reminder_settings;
CREATE POLICY "reminder_settings_update_own" ON public.reminder_settings
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ── 3. Journal des relances envoyées ────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.document_reminders (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  document_type text NOT NULL CHECK (document_type IN ('invoice', 'quote')),
  document_id   uuid NOT NULL,
  -- Étape du planning : before_3, after_7, after_15, after_30, after_45,
  -- quote_1, quote_2 ; « manual » pour une relance envoyée à la main
  stage         text NOT NULL,
  -- auto (cron), manual (bouton « Relancer »), legacy (reprise des anciennes colonnes)
  origin        text NOT NULL DEFAULT 'auto' CHECK (origin IN ('auto', 'manual', 'legacy')),
  sent_to       text NULL,
  sent_at       timestamptz NOT NULL DEFAULT now()
);

-- Une étape automatique ne part qu'une fois par document : le cron réserve la
-- ligne avant d'envoyer l'email, une seconde exécution concurrente est refusée.
CREATE UNIQUE INDEX IF NOT EXISTS document_reminders_stage_once
  ON public.document_reminders (document_type, document_id, stage)
  WHERE origin <> 'manual';

CREATE INDEX IF NOT EXISTS document_reminders_document
  ON public.document_reminders (document_id);

ALTER TABLE public.document_reminders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "document_reminders_select_own" ON public.document_reminders;
CREATE POLICY "document_reminders_select_own" ON public.document_reminders
  FOR SELECT USING (auth.uid() = user_id);

-- Relance manuelle (route utilisateur) : le compte n'écrit que ses propres lignes
DROP POLICY IF EXISTS "document_reminders_insert_own" ON public.document_reminders;
CREATE POLICY "document_reminders_insert_own" ON public.document_reminders
  FOR INSERT WITH CHECK (auth.uid() = user_id AND origin = 'manual');

-- Reprise des relances déjà envoyées par l'ancien cron (colonnes de la facture) :
-- la relance 1 compte pour l'étape J+30, la relance 2 pour l'étape J+45, comme
-- avant. Elles ne repartiront donc pas. Une fois le journal en place, le code
-- n'écrit plus ces colonnes ; les factures qui ont déjà des lignes au journal
-- sont ignorées (migration rejouée).
INSERT INTO public.document_reminders (user_id, document_type, document_id, stage, origin, sent_at)
SELECT i.user_id, 'invoice', i.id, 'after_30', 'legacy', i.reminder_1_sent_at
FROM public.invoices i
WHERE i.reminder_1_sent_at IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM public.document_reminders r WHERE r.document_id = i.id AND r.origin <> 'legacy')
ON CONFLICT DO NOTHING;

INSERT INTO public.document_reminders (user_id, document_type, document_id, stage, origin, sent_at)
SELECT i.user_id, 'invoice', i.id, 'after_45', 'legacy', i.reminder_2_sent_at
FROM public.invoices i
WHERE i.reminder_2_sent_at IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM public.document_reminders r WHERE r.document_id = i.id AND r.origin <> 'legacy')
ON CONFLICT DO NOTHING;
