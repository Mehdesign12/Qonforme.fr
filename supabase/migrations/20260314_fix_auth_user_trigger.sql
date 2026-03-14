-- ============================================================
-- Fix : "Database error creating new user"
--
-- Cause : un trigger on_auth_user_created / handle_new_user a été
-- configuré via le dashboard Supabase (absent des migrations).
-- Il tente d'insérer dans une table (profiles, users...) qui
-- n'existe pas → rollback → toute création de compte échoue.
--
-- L'app Qonforme crée les données utilisateur manuellement :
--   - /api/company  → table companies
--   - /api/onboarding/seen → table companies
-- Aucun trigger automatique n'est nécessaire.
--
-- À APPLIQUER dans :
--   Supabase Dashboard → SQL Editor → New query → Run
-- OU via : supabase db push (si CLI configuré)
-- ============================================================

-- 1. Supprimer le trigger s'il existe (tous les noms courants)
DROP TRIGGER IF EXISTS on_auth_user_created  ON auth.users;
DROP TRIGGER IF EXISTS on_new_user_created   ON auth.users;
DROP TRIGGER IF EXISTS handle_new_user       ON auth.users;
DROP TRIGGER IF EXISTS create_profile        ON auth.users;
DROP TRIGGER IF EXISTS create_user_profile   ON auth.users;

-- 2. Supprimer les fonctions associées (CASCADE nettoie les dépendances)
DROP FUNCTION IF EXISTS public.handle_new_user()      CASCADE;
DROP FUNCTION IF EXISTS public.on_auth_user_created() CASCADE;
DROP FUNCTION IF EXISTS public.create_user_profile()  CASCADE;
DROP FUNCTION IF EXISTS public.handle_user_signup()   CASCADE;

-- 3. Vérification : lister les triggers restants sur auth.users
--    (doit retourner 0 ligne pour confirmer la suppression)
SELECT trigger_name, event_manipulation, action_statement
FROM information_schema.triggers
WHERE event_object_schema = 'auth'
  AND event_object_table  = 'users';
