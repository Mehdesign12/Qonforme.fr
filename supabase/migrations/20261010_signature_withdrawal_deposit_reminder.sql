-- ============================================================
-- Signature en ligne : rétractation en ligne, acompte après signature,
-- relance avant expiration (DECISIONS-STRATEGIQUES.md § 11)
--
-- À APPLIQUER APRÈS 20261003_document_signatures.sql : Supabase Dashboard →
-- SQL Editor, ou `supabase db push`. Idempotente : peut être rejouée.
--
-- Tant qu'elle n'est pas appliquée, le code garde le comportement d'avant
-- (lib/supabase/schema-guard.ts) : rétractation par le formulaire de l'email,
-- pas d'acompte proposé, pas de relance avant expiration.
-- ============================================================

-- ------------------------------------------------------------
-- 1. Liens de signature : rétractation, acompte, relance
-- ------------------------------------------------------------
ALTER TABLE public.document_signatures
  -- Rétractation du particulier (C. consom. art. L221-18 à L221-21)
  ADD COLUMN IF NOT EXISTS withdrawn_at              TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS withdrawal_name           TEXT,
  ADD COLUMN IF NOT EXISTS withdrawal_message        TEXT,
  ADD COLUMN IF NOT EXISTS withdrawal_ip             TEXT,
  ADD COLUMN IF NOT EXISTS withdrawal_user_agent     TEXT,
  -- Relance avant expiration (une seule par lien)
  ADD COLUMN IF NOT EXISTS expiry_reminder_sent_at   TIMESTAMPTZ,
  -- Acompte figé à la signature : montant, taux, référence du virement
  ADD COLUMN IF NOT EXISTS deposit_amount            NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS deposit_percent           NUMERIC(5,2),
  ADD COLUMN IF NOT EXISTS deposit_reference         TEXT,
  -- Signé sur place chez un particulier : demande d'acompte différée à J+8 (art. L221-10)
  ADD COLUMN IF NOT EXISTS deposit_request_on        DATE,
  ADD COLUMN IF NOT EXISTS deposit_requested_at      TIMESTAMPTZ;

-- Nouveau statut « withdrawn » (rétracté)
ALTER TABLE public.document_signatures DROP CONSTRAINT IF EXISTS document_signatures_status_check;
ALTER TABLE public.document_signatures ADD CONSTRAINT document_signatures_status_check
  CHECK (status IN ('pending', 'signed', 'refused', 'disabled', 'superseded', 'withdrawn'));

-- Lectures du cron quotidien (/api/cron/send-reminders)
CREATE INDEX IF NOT EXISTS idx_document_signatures_expiry_reminder
  ON public.document_signatures (expires_at)
  WHERE status = 'pending' AND expiry_reminder_sent_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_document_signatures_deposit_request
  ON public.document_signatures (deposit_request_on)
  WHERE status = 'signed' AND deposit_requested_at IS NULL AND deposit_request_on IS NOT NULL;

-- ------------------------------------------------------------
-- 2. Réglages : relance avant expiration, acompte par défaut
-- ------------------------------------------------------------
ALTER TABLE public.signature_settings
  ADD COLUMN IF NOT EXISTS expiry_reminder_enabled   BOOLEAN       NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS expiry_reminder_days      INTEGER       NOT NULL DEFAULT 3,
  ADD COLUMN IF NOT EXISTS deposit_percent           NUMERIC(5,2)  NOT NULL DEFAULT 0;

ALTER TABLE public.signature_settings DROP CONSTRAINT IF EXISTS signature_settings_expiry_reminder_days_check;
ALTER TABLE public.signature_settings ADD CONSTRAINT signature_settings_expiry_reminder_days_check
  CHECK (expiry_reminder_days BETWEEN 1 AND 30);

ALTER TABLE public.signature_settings DROP CONSTRAINT IF EXISTS signature_settings_deposit_percent_check;
ALTER TABLE public.signature_settings ADD CONSTRAINT signature_settings_deposit_percent_check
  CHECK (deposit_percent >= 0 AND deposit_percent <= 100);

-- ------------------------------------------------------------
-- 3. Devis : statut « withdrawn » (rétracté par le client)
-- ------------------------------------------------------------
-- La table des devis a été créée hors migrations : on ne connaît pas le nom
-- de sa contrainte de statut. Chaque contrainte CHECK qui porte sur le statut
-- est remplacée par la même liste, plus « withdrawn ». Sans contrainte
-- existante, rien n'est ajouté (aucune restriction nouvelle).
DO $$
DECLARE
  c RECORD;
  dropped BOOLEAN := FALSE;
BEGIN
  FOR c IN
    SELECT conname
    FROM pg_constraint
    WHERE conrelid = 'public.quotes'::regclass
      AND contype = 'c'
      AND pg_get_constraintdef(oid) ILIKE '%status%'
      AND pg_get_constraintdef(oid) ILIKE '%accepted%'
  LOOP
    EXECUTE format('ALTER TABLE public.quotes DROP CONSTRAINT %I', c.conname);
    dropped := TRUE;
  END LOOP;

  IF dropped THEN
    ALTER TABLE public.quotes ADD CONSTRAINT quotes_status_check
      CHECK (status IN ('draft', 'sent', 'accepted', 'rejected', 'withdrawn')) NOT VALID;
  END IF;
END $$;
