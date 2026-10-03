-- ============================================================
-- Mentions du bâtiment automatiques : profil légal de l'entreprise et
-- mentions figées à l'émission des documents
-- ============================================================
-- À APPLIQUER AVANT LA MISE EN LIGNE de la fonction (Supabase Dashboard →
-- SQL Editor, ou `supabase db push`). Le code déjà en production fonctionne
-- sans elle : tant que ces colonnes n'existent pas, les réglages « Activité et
-- statut » et « Assurance professionnelle » restent masqués, et les documents
-- gardent leurs mentions d'avant (le texte libre des modèles). Une fois
-- appliquée, tout s'active seul (lib/supabase/schema-guard.ts).
--
-- Idempotente : peut être rejouée sans effet de bord.
--
-- 1. companies.legal_profile (JSON) : métier principal, régime de TVA (franchise
--    en base ou TVA facturée), forme juridique (micro-entreprise, entrepreneur
--    individuel, société avec forme, capital et ville du greffe RCS),
--    assurance décennale et responsabilité civile professionnelle (assureur,
--    coordonnées, n° de contrat, couverture géographique). Lu par
--    lib/legal/profile.ts, qui n'en garde que les champs connus.
--
-- 2. legal_snapshot sur invoices, quotes, purchase_orders et credit_notes :
--    au moment où un document est émis (il quitte le brouillon ; un avoir est
--    émis dès sa création), un déclencheur y fige le nom de l'entreprise, ses
--    mentions libres et son profil légal. Les PDF et l'aperçu d'un document
--    émis lisent ces mentions-là, plus jamais les réglages du jour : changer
--    d'assureur ou de régime de TVA ne modifie pas une facture déjà émise.
--    Le déclencheur est seul à écrire la colonne : une valeur envoyée par
--    l'API est ignorée, et un instantané posé ne change plus.
--    Un document émis avant cette migration n'a pas d'instantané : il garde
--    ses mentions libres, sans le profil saisi ensuite.
-- ============================================================

-- ── 1. Profil légal de l'entreprise ─────────────────────────────────────────

ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS legal_profile JSONB;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.companies'::regclass
      AND conname = 'companies_legal_profile_shape'
  ) THEN
    ALTER TABLE public.companies
      ADD CONSTRAINT companies_legal_profile_shape
      CHECK (
        legal_profile IS NULL
        OR (jsonb_typeof(legal_profile) = 'object' AND octet_length(legal_profile::text) <= 8192)
      );
  END IF;
END $$;

COMMENT ON COLUMN public.companies.legal_profile IS
  'Profil légal (métier, régime de TVA, forme juridique, assurances) : mentions automatiques des documents. Voir lib/legal/profile.ts';

-- ── 2. Mentions figées à l'émission ─────────────────────────────────────────

ALTER TABLE public.invoices        ADD COLUMN IF NOT EXISTS legal_snapshot JSONB;
ALTER TABLE public.quotes          ADD COLUMN IF NOT EXISTS legal_snapshot JSONB;
ALTER TABLE public.purchase_orders ADD COLUMN IF NOT EXISTS legal_snapshot JSONB;
ALTER TABLE public.credit_notes    ADD COLUMN IF NOT EXISTS legal_snapshot JSONB;

COMMENT ON COLUMN public.invoices.legal_snapshot IS
  'Nom, mentions libres et profil légal de l''entreprise au moment de l''émission (déclencheur freeze_document_legal_snapshot)';
COMMENT ON COLUMN public.quotes.legal_snapshot IS
  'Nom, mentions libres et profil légal de l''entreprise au moment de l''émission (déclencheur freeze_document_legal_snapshot)';
COMMENT ON COLUMN public.purchase_orders.legal_snapshot IS
  'Nom, mentions libres et profil légal de l''entreprise au moment de l''émission (déclencheur freeze_document_legal_snapshot)';
COMMENT ON COLUMN public.credit_notes.legal_snapshot IS
  'Nom, mentions libres et profil légal de l''entreprise au moment de l''émission (déclencheur freeze_document_legal_snapshot)';

-- Le statut est lu par to_jsonb : credit_notes n'a pas de colonne status (un
-- avoir est émis dès sa création), et NEW.status y échouerait.
-- SECURITY DEFINER : l'entreprise est lue même si celui qui émet ne peut pas
-- la lire (route publique de signature, par exemple). Sans risque de fuite :
-- seule l'entreprise du propriétaire de la ligne (NEW.user_id) est lue, et
-- seulement copiée dans cette ligne, que l'auteur a déjà le droit d'écrire.
-- Une fonction qui renvoie TRIGGER ne peut pas être appelée directement.
CREATE OR REPLACE FUNCTION public.freeze_document_legal_snapshot()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  new_status TEXT;
  old_status TEXT;
  issuing    BOOLEAN;
  c          RECORD;
BEGIN
  new_status := to_jsonb(NEW) ->> 'status';
  IF TG_OP = 'UPDATE' THEN
    old_status := to_jsonb(OLD) ->> 'status';
    -- Un instantané posé ne change plus ; sans instantané, seule l'émission en pose un
    IF OLD.legal_snapshot IS NOT NULL THEN
      NEW.legal_snapshot := OLD.legal_snapshot;
      RETURN NEW;
    END IF;
    -- (avoir sans statut : jamais d'émission par une mise à jour)
    issuing := COALESCE(old_status = 'draft', FALSE) AND new_status IS DISTINCT FROM 'draft';
  ELSE
    -- Création : un avoir (sans statut) est émis ; un brouillon ne l'est pas
    issuing := new_status IS DISTINCT FROM 'draft';
  END IF;

  IF NOT issuing THEN
    NEW.legal_snapshot := NULL;
    RETURN NEW;
  END IF;

  SELECT name, legal_notice, legal_profile INTO c
  FROM public.companies
  WHERE user_id = NEW.user_id
  LIMIT 1;

  NEW.legal_snapshot := jsonb_build_object(
    'v',            1,
    'name',         c.name,
    'legal_notice', c.legal_notice,
    'profile',      c.legal_profile,
    'frozen_at',    now()
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS invoices_legal_snapshot ON public.invoices;
CREATE TRIGGER invoices_legal_snapshot
  BEFORE INSERT OR UPDATE ON public.invoices
  FOR EACH ROW EXECUTE FUNCTION public.freeze_document_legal_snapshot();

DROP TRIGGER IF EXISTS quotes_legal_snapshot ON public.quotes;
CREATE TRIGGER quotes_legal_snapshot
  BEFORE INSERT OR UPDATE ON public.quotes
  FOR EACH ROW EXECUTE FUNCTION public.freeze_document_legal_snapshot();

DROP TRIGGER IF EXISTS purchase_orders_legal_snapshot ON public.purchase_orders;
CREATE TRIGGER purchase_orders_legal_snapshot
  BEFORE INSERT OR UPDATE ON public.purchase_orders
  FOR EACH ROW EXECUTE FUNCTION public.freeze_document_legal_snapshot();

DROP TRIGGER IF EXISTS credit_notes_legal_snapshot ON public.credit_notes;
CREATE TRIGGER credit_notes_legal_snapshot
  BEFORE INSERT OR UPDATE ON public.credit_notes
  FOR EACH ROW EXECUTE FUNCTION public.freeze_document_legal_snapshot();
