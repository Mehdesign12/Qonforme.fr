-- ============================================================
-- Formule Artisan : chantiers, factures d'acompte, situations de travaux,
-- facture de solde et retenue de garantie
-- ============================================================
-- À APPLIQUER AVANT LA MISE EN LIGNE de la fonction (Supabase Dashboard →
-- SQL Editor, ou `supabase db push`). Le code déjà en production fonctionne
-- sans elle : tant que ces tables et colonnes n'existent pas, la page
-- Chantiers et les panneaux « Facturation du chantier » restent masqués ou
-- expliquent que la fonction n'est pas encore active, et les factures gardent
-- leur fonctionnement actuel (création, envoi, PDF). Une fois appliquée, tout
-- s'active seul (lib/supabase/schema-guard.ts).
--
-- Idempotente : peut être rejouée sans effet de bord.
--
-- 1. Table chantiers (par propriétaire, RLS) : nom, client, adresse, dates,
--    statut, date de réception, retenue de garantie (mode, taux de 5 % au
--    plus — loi n° 71-584 du 16 juillet 1971, art. 1er —, date de libération),
--    sous-traitance (autoliquidation proposée par défaut).
--
-- 2. chantier_id sur les devis, factures, avoirs et bons de commande : un
--    document se rattache à un chantier (et s'en détache) sans que son contenu
--    change. Le chantier imprimé sur une facture vient de son billing_context,
--    figé à l'émission, jamais de cette colonne.
--
-- 3. Sur les factures :
--    - invoice_kind : standard, deposit (acompte, type Factur-X 386),
--      situation, final (solde) ;
--    - quote_id : devis d'origine d'un acompte, d'une situation ou d'un solde ;
--    - billing_context : avancement, acomptes repris, retenue (JSON, lu par
--      lib/artisan/billing.ts) ;
--    - retention_amount : retenue de garantie TTC de la facture.
--    Le déclencheur freeze_invoice_billing fige invoice_kind, billing_context
--    et retention_amount dès que la facture quitte le brouillon : une facture
--    émise ne change plus (CGI, ann. II, art. 242 nonies A ; CLAUDE.md).
--
-- 4. Un document ne peut se rattacher qu'à un chantier (ou un devis) de son
--    propriétaire : déclencheur check_document_links.
-- ============================================================

-- ── 1. Chantiers ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.chantiers (
  id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  client_id             UUID        REFERENCES public.clients(id) ON DELETE SET NULL,
  name                  TEXT        NOT NULL,
  address               TEXT,
  zip_code              TEXT,
  city                  TEXT,
  start_date            DATE,
  end_date              DATE,
  status                TEXT        NOT NULL DEFAULT 'preparation',
  reception_date        DATE,
  retention_mode        TEXT        NOT NULL DEFAULT 'aucune',
  retention_rate        NUMERIC(4,2) NOT NULL DEFAULT 0,
  retention_released_at DATE,
  subcontracting        BOOLEAN     NOT NULL DEFAULT FALSE,
  notes                 TEXT,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'public.chantiers'::regclass AND conname = 'chantiers_name_length') THEN
    ALTER TABLE public.chantiers ADD CONSTRAINT chantiers_name_length CHECK (char_length(btrim(name)) BETWEEN 1 AND 160);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'public.chantiers'::regclass AND conname = 'chantiers_status_check') THEN
    ALTER TABLE public.chantiers ADD CONSTRAINT chantiers_status_check CHECK (status IN ('preparation', 'in_progress', 'received', 'closed'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'public.chantiers'::regclass AND conname = 'chantiers_retention_mode_check') THEN
    ALTER TABLE public.chantiers ADD CONSTRAINT chantiers_retention_mode_check CHECK (retention_mode IN ('aucune', 'retenue', 'caution'));
  END IF;
  -- Loi n° 71-584 du 16 juillet 1971, art. 1er : 5 % au plus
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'public.chantiers'::regclass AND conname = 'chantiers_retention_rate_check') THEN
    ALTER TABLE public.chantiers ADD CONSTRAINT chantiers_retention_rate_check CHECK (retention_rate >= 0 AND retention_rate <= 5);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'public.chantiers'::regclass AND conname = 'chantiers_dates_check') THEN
    ALTER TABLE public.chantiers ADD CONSTRAINT chantiers_dates_check CHECK (start_date IS NULL OR end_date IS NULL OR end_date >= start_date);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'public.chantiers'::regclass AND conname = 'chantiers_text_lengths') THEN
    ALTER TABLE public.chantiers ADD CONSTRAINT chantiers_text_lengths CHECK (
      coalesce(char_length(address), 0) <= 200 AND coalesce(char_length(city), 0) <= 200
      AND coalesce(char_length(zip_code), 0) <= 10 AND coalesce(char_length(notes), 0) <= 2000
    );
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS chantiers_user_created_idx ON public.chantiers (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS chantiers_client_idx ON public.chantiers (client_id);

COMMENT ON TABLE public.chantiers IS
  'Chantiers (formule Artisan) : regroupent devis, acomptes, situations, factures, avoirs et retenue de garantie. Voir lib/artisan/chantier.ts';

ALTER TABLE public.chantiers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "chantiers_select_own" ON public.chantiers;
CREATE POLICY "chantiers_select_own" ON public.chantiers
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "chantiers_insert_own" ON public.chantiers;
CREATE POLICY "chantiers_insert_own" ON public.chantiers
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "chantiers_update_own" ON public.chantiers;
CREATE POLICY "chantiers_update_own" ON public.chantiers
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "chantiers_delete_own" ON public.chantiers;
CREATE POLICY "chantiers_delete_own" ON public.chantiers
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

DROP TRIGGER IF EXISTS chantiers_updated_at ON public.chantiers;
CREATE TRIGGER chantiers_updated_at
  BEFORE UPDATE ON public.chantiers
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ── 2. Rattachement des documents ──────────────────────────────────────────

ALTER TABLE public.quotes          ADD COLUMN IF NOT EXISTS chantier_id UUID REFERENCES public.chantiers(id) ON DELETE SET NULL;
ALTER TABLE public.invoices        ADD COLUMN IF NOT EXISTS chantier_id UUID REFERENCES public.chantiers(id) ON DELETE SET NULL;
ALTER TABLE public.credit_notes    ADD COLUMN IF NOT EXISTS chantier_id UUID REFERENCES public.chantiers(id) ON DELETE SET NULL;
ALTER TABLE public.purchase_orders ADD COLUMN IF NOT EXISTS chantier_id UUID REFERENCES public.chantiers(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS quotes_chantier_idx          ON public.quotes (chantier_id) WHERE chantier_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS invoices_chantier_idx        ON public.invoices (chantier_id) WHERE chantier_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS credit_notes_chantier_idx    ON public.credit_notes (chantier_id) WHERE chantier_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS purchase_orders_chantier_idx ON public.purchase_orders (chantier_id) WHERE chantier_id IS NOT NULL;

-- ── 3. Factures d'acompte, situations, solde, retenue de garantie ──────────

ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS quote_id         UUID REFERENCES public.quotes(id) ON DELETE SET NULL;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS invoice_kind     TEXT NOT NULL DEFAULT 'standard';
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS billing_context  JSONB;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS retention_amount NUMERIC(12,2) NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS invoices_quote_idx ON public.invoices (quote_id) WHERE quote_id IS NOT NULL;

-- Un seul brouillon d'acompte, de situation ou de solde à la fois par devis :
-- l'avancement et les reprises d'acompte se calculent sur les factures émises,
-- deux brouillons simultanés factureraient deux fois la même part.
CREATE UNIQUE INDEX IF NOT EXISTS invoices_one_artisan_draft_per_quote
  ON public.invoices (quote_id)
  WHERE status = 'draft' AND invoice_kind <> 'standard' AND quote_id IS NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'public.invoices'::regclass AND conname = 'invoices_kind_check') THEN
    ALTER TABLE public.invoices ADD CONSTRAINT invoices_kind_check CHECK (invoice_kind IN ('standard', 'deposit', 'situation', 'final'));
  END IF;
  -- Une facture de la formule Artisan porte toujours son contexte ; une facture ordinaire jamais
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'public.invoices'::regclass AND conname = 'invoices_billing_context_shape') THEN
    ALTER TABLE public.invoices ADD CONSTRAINT invoices_billing_context_shape CHECK (
      (invoice_kind = 'standard' AND billing_context IS NULL)
      OR (invoice_kind <> 'standard' AND billing_context IS NOT NULL
          AND jsonb_typeof(billing_context) = 'object'
          AND billing_context ->> 'kind' = invoice_kind
          AND octet_length(billing_context::text) <= 65536)
    );
  END IF;
  -- Retenue : jamais négative, jamais plus que la facture
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'public.invoices'::regclass AND conname = 'invoices_retention_amount_check') THEN
    ALTER TABLE public.invoices ADD CONSTRAINT invoices_retention_amount_check CHECK (
      retention_amount >= 0 AND (retention_amount = 0 OR retention_amount <= total_ttc)
    );
  END IF;
END $$;

COMMENT ON COLUMN public.invoices.invoice_kind IS
  'standard, deposit (facture d''acompte, Factur-X 386), situation, final (solde). Figé à l''émission (freeze_invoice_billing)';
COMMENT ON COLUMN public.invoices.billing_context IS
  'Devis, chantier, avancement, acomptes repris et retenue de garantie, figés à l''émission. Voir lib/artisan/billing.ts';
COMMENT ON COLUMN public.invoices.retention_amount IS
  'Retenue de garantie TTC (loi n° 71-584 du 16 juillet 1971) : ne change ni le total TTC ni le montant dû déclaré';

-- Une facture émise ne change plus : nature, contexte et retenue figés dès
-- qu'elle quitte le brouillon (le statut lu par to_jsonb, comme
-- freeze_document_legal_snapshot). Le rattachement à un chantier ou à un devis
-- (chantier_id, quote_id) reste libre : il ne change pas le document.
CREATE OR REPLACE FUNCTION public.freeze_invoice_billing()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  IF (to_jsonb(OLD) ->> 'status') IS DISTINCT FROM 'draft' THEN
    NEW.invoice_kind     := OLD.invoice_kind;
    NEW.billing_context  := OLD.billing_context;
    NEW.retention_amount := OLD.retention_amount;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS invoices_freeze_billing ON public.invoices;
CREATE TRIGGER invoices_freeze_billing
  BEFORE UPDATE ON public.invoices
  FOR EACH ROW EXECUTE FUNCTION public.freeze_invoice_billing();

-- ── 4. Rattachements limités aux documents du même propriétaire ────────────
-- Une clé étrangère ne passe pas par la RLS : sans ce contrôle, un document
-- pourrait viser le chantier (ou le devis) d'un autre compte. SECURITY INVOKER :
-- côté navigateur, la RLS limite encore la lecture aux lignes de l'utilisateur.
CREATE OR REPLACE FUNCTION public.check_document_links()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE
  doc JSONB := to_jsonb(NEW);
  old_doc JSONB := CASE WHEN TG_OP = 'UPDATE' THEN to_jsonb(OLD) ELSE '{}'::jsonb END;
BEGIN
  IF (doc ->> 'chantier_id') IS NOT NULL
     AND (doc ->> 'chantier_id') IS DISTINCT FROM (old_doc ->> 'chantier_id')
     AND NOT EXISTS (
       SELECT 1 FROM public.chantiers ch
       WHERE ch.id = (doc ->> 'chantier_id')::uuid AND ch.user_id = NEW.user_id
     ) THEN
    RAISE EXCEPTION 'Chantier introuvable' USING ERRCODE = '23503';
  END IF;
  IF TG_TABLE_NAME = 'invoices'
     AND (doc ->> 'quote_id') IS NOT NULL
     AND (doc ->> 'quote_id') IS DISTINCT FROM (old_doc ->> 'quote_id')
     AND NOT EXISTS (
       SELECT 1 FROM public.quotes q
       WHERE q.id = (doc ->> 'quote_id')::uuid AND q.user_id = NEW.user_id
     ) THEN
    RAISE EXCEPTION 'Devis introuvable' USING ERRCODE = '23503';
  END IF;
  IF TG_TABLE_NAME = 'chantiers'
     AND (doc ->> 'client_id') IS NOT NULL
     AND (doc ->> 'client_id') IS DISTINCT FROM (old_doc ->> 'client_id')
     AND NOT EXISTS (
       SELECT 1 FROM public.clients c
       WHERE c.id = (doc ->> 'client_id')::uuid AND c.user_id = NEW.user_id
     ) THEN
    RAISE EXCEPTION 'Client introuvable' USING ERRCODE = '23503';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS quotes_check_links ON public.quotes;
CREATE TRIGGER quotes_check_links
  BEFORE INSERT OR UPDATE ON public.quotes
  FOR EACH ROW EXECUTE FUNCTION public.check_document_links();

DROP TRIGGER IF EXISTS invoices_check_links ON public.invoices;
CREATE TRIGGER invoices_check_links
  BEFORE INSERT OR UPDATE ON public.invoices
  FOR EACH ROW EXECUTE FUNCTION public.check_document_links();

DROP TRIGGER IF EXISTS credit_notes_check_links ON public.credit_notes;
CREATE TRIGGER credit_notes_check_links
  BEFORE INSERT OR UPDATE ON public.credit_notes
  FOR EACH ROW EXECUTE FUNCTION public.check_document_links();

DROP TRIGGER IF EXISTS purchase_orders_check_links ON public.purchase_orders;
CREATE TRIGGER purchase_orders_check_links
  BEFORE INSERT OR UPDATE ON public.purchase_orders
  FOR EACH ROW EXECUTE FUNCTION public.check_document_links();

DROP TRIGGER IF EXISTS chantiers_check_links ON public.chantiers;
CREATE TRIGGER chantiers_check_links
  BEFORE INSERT OR UPDATE ON public.chantiers
  FOR EACH ROW EXECUTE FUNCTION public.check_document_links();
