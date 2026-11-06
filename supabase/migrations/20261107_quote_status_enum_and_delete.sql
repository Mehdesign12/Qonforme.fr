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

-- 1. Valeurs du type énuméré (seulement s'il existe)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace
             WHERE t.typname = 'quote_status' AND n.nspname = 'public' AND t.typtype = 'e') THEN
    EXECUTE 'ALTER TYPE public.quote_status ADD VALUE IF NOT EXISTS ''withdrawn''';
    EXECUTE 'ALTER TYPE public.quote_status ADD VALUE IF NOT EXISTS ''superseded''';
  END IF;
END $$;

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
