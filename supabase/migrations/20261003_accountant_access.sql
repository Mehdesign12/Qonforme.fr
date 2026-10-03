-- ============================================================
-- Accès du comptable : invitations, accès en lecture, journal
-- ============================================================
-- À APPLIQUER AVANT LA MISE EN LIGNE de la fonction (Supabase Dashboard →
-- SQL Editor, ou `supabase db push`). Le code déjà en production fonctionne
-- sans elle : tant que ces tables n'existent pas, Paramètres › Accès comptable
-- dit que la fonction n'est pas encore activée, aucune invitation ne part et
-- l'espace comptable (/comptable) reste vide (lib/supabase/schema-guard.ts).
-- Une fois appliquée, tout s'active seul.
--
-- Idempotente : peut être rejouée sans effet de bord.
--
-- Décision : DECISIONS-STRATEGIQUES.md § 10 (« Accès pour le comptable »,
-- « Exports comptables ») et § 3 (prescription par les comptables).
--
-- Sécurité :
-- - aucune politique RLS sur ces deux tables : ni lecture ni écriture depuis
--   le navigateur. Tout passe par les routes serveur (clé service_role,
--   lib/accountant/server.ts), qui vérifient l'utilisateur à chaque requête ;
-- - les politiques des tables existantes (invoices, credit_notes, clients,
--   companies…) ne changent pas : le comptable ne lit jamais ces tables avec
--   sa propre session, seulement par ces routes, filtrées sur le compte de
--   l'entreprise qui l'a invité ;
-- - le jeton d'invitation n'est jamais stocké, seulement son empreinte
--   SHA-256 (token_hash), effacée à l'acceptation ou à la révocation ;
-- - une révocation (revoked_at) coupe l'accès à la requête suivante.
-- ============================================================

-- ------------------------------------------------------------
-- Accès : une ligne par invitation, devenue accès une fois acceptée
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.accountant_accesses (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Compte de l'entreprise (l'artisan) qui donne l'accès
  owner_id       UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  -- Adresse invitée, en minuscules ; le comptable accepte avec un compte à cette adresse
  email          TEXT        NOT NULL CHECK (char_length(email) BETWEEN 3 AND 254 AND email = lower(email)),
  -- Nom ou cabinet, facultatif (affiché à l'artisan)
  label          TEXT        CHECK (label IS NULL OR char_length(label) <= 80),
  -- Empreinte SHA-256 (hexadécimal) du jeton ; NULL une fois acceptée ou révoquée
  token_hash     TEXT        UNIQUE CHECK (token_hash IS NULL OR token_hash ~ '^[0-9a-f]{64}$'),
  invited_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at     TIMESTAMPTZ NOT NULL,
  -- Compte du comptable, posé à l'acceptation
  accountant_id  UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  accepted_at    TIMESTAMPTZ,
  last_seen_at   TIMESTAMPTZ,
  revoked_at     TIMESTAMPTZ,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT accountant_accesses_not_self CHECK (accountant_id IS NULL OR accountant_id <> owner_id)
);

-- Une seule invitation ou un seul accès en cours par adresse et par entreprise
CREATE UNIQUE INDEX IF NOT EXISTS uq_accountant_accesses_live_email
  ON public.accountant_accesses (owner_id, email)
  WHERE revoked_at IS NULL;

-- Un comptable n'a qu'un accès en cours par entreprise
CREATE UNIQUE INDEX IF NOT EXISTS uq_accountant_accesses_live_accountant
  ON public.accountant_accesses (owner_id, accountant_id)
  WHERE revoked_at IS NULL AND accountant_id IS NOT NULL;

-- Dossiers d'un comptable
CREATE INDEX IF NOT EXISTS idx_accountant_accesses_accountant
  ON public.accountant_accesses (accountant_id)
  WHERE revoked_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_accountant_accesses_owner_created
  ON public.accountant_accesses (owner_id, created_at DESC);

ALTER TABLE public.accountant_accesses ENABLE ROW LEVEL SECURITY;
-- Aucune politique : accès par la clé service_role uniquement.

-- ------------------------------------------------------------
-- Journal : invitations, acceptations, révocations, consultations et exports
-- ------------------------------------------------------------
-- Conservé un an (purge faite par le serveur à chaque écriture), dans la
-- fourchette de six mois à un an que recommande la CNIL pour les journaux
-- d'accès (recommandation relative aux mesures de journalisation, délibération
-- n° 2021-122 du 14 octobre 2021).
CREATE TABLE IF NOT EXISTS public.accountant_access_events (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  access_id    UUID        NOT NULL REFERENCES public.accountant_accesses(id) ON DELETE CASCADE,
  owner_id     UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  -- Auteur : l'artisan (invitation, révocation) ou le comptable (le reste)
  actor_id     UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  action       TEXT        NOT NULL CHECK (action IN (
                 'invited', 'reinvited', 'cancelled', 'accepted', 'revoked',
                 'viewed', 'export_fec', 'export_csv', 'export_pdf_zip'
               )),
  period_from  DATE,
  period_to    DATE,
  detail       TEXT        CHECK (detail IS NULL OR char_length(detail) <= 200),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_accountant_access_events_owner_created
  ON public.accountant_access_events (owner_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_accountant_access_events_access_action
  ON public.accountant_access_events (access_id, action, created_at DESC);

ALTER TABLE public.accountant_access_events ENABLE ROW LEVEL SECURITY;
-- Aucune politique : accès par la clé service_role uniquement.
