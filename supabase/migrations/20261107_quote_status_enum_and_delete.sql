-- ============================================================
-- Statuts des devis et suppression des brouillons de devis
--
-- À APPLIQUER SEULE (Supabase Dashboard → SQL Editor, puis « Run »), après
-- 20261106_quote_revisions.sql. Idempotente : peut être rejouée.
--
-- Constaté en production le 06/11/2026 avec un compte de test :
--   1. Le statut des devis est un type énuméré (`quote_status`), pas une
--      contrainte CHECK : les migrations 20261010 et 20261106 ne pouvaient donc
--      pas y ajouter de valeur. « withdrawn » (rétractation en ligne d'un
--      particulier) et « superseded » (devis remplacé par sa correction) étaient
--      refusés par la base (« invalid input value for enum quote_status »).
--   2. Aucune règle d'accès (RLS) n'autorise la suppression d'un devis : un
--      brouillon « supprimé » restait en base. La route passe désormais par le
--      serveur ; la règle ci-dessous est ajoutée par sûreté.
-- ============================================================

-- 1. Valeurs du type énuméré de la colonne quotes.status (quel que soit son schéma)
DO $$
DECLARE
  t regtype;
BEGIN
  SELECT a.atttypid::regtype INTO t
  FROM pg_attribute a
  JOIN pg_type ty ON ty.oid = a.atttypid
  WHERE a.attrelid = 'public.quotes'::regclass AND a.attname = 'status' AND ty.typtype = 'e';
  IF t IS NOT NULL THEN
    EXECUTE format('ALTER TYPE %s ADD VALUE IF NOT EXISTS %L', t, 'withdrawn');
    EXECUTE format('ALTER TYPE %s ADD VALUE IF NOT EXISTS %L', t, 'superseded');
    RAISE NOTICE 'Type % complété : withdrawn, superseded', t;
  ELSE
    RAISE NOTICE 'quotes.status n''est pas un type énuméré : rien à ajouter';
  END IF;
END $$;

-- Vérification (doit lister withdrawn et superseded) :
--   SELECT e.enumlabel FROM pg_enum e
--   JOIN pg_attribute a ON a.atttypid = e.enumtypid
--   WHERE a.attrelid = 'public.quotes'::regclass AND a.attname = 'status'
--   ORDER BY e.enumsortorder;

-- 2. Suppression de ses propres brouillons de devis
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies
                 WHERE schemaname = 'public' AND tablename = 'quotes' AND policyname = 'quotes_delete_own_draft') THEN
    CREATE POLICY quotes_delete_own_draft ON public.quotes
      FOR DELETE TO authenticated
      USING (auth.uid() = user_id AND status::text = 'draft');
  END IF;
END $$;
