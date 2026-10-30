-- ============================================================
-- Raccordement à la plateforme agréée (Super PDP)
-- ============================================================
-- À APPLIQUER APRÈS 20261003_received_invoices.sql. Le code fonctionne sans
-- elle : la page « Facturation électronique » garde alors l'import manuel et
-- n'offre pas le raccordement. Idempotente.
--
-- Un raccordement par compte : l'artisan autorise Qonforme (OAuth 2.1,
-- « authorization code ») à lire ses factures reçues sur la plateforme et à y
-- transmettre ses décisions. Les jetons ne sont stockés que chiffrés
-- (AES-256-GCM, clé dérivée d'un secret serveur). La table n'est lisible ni
-- écrivable par un utilisateur (RLS sans politique, droits retirés) : le
-- serveur seul (service_role) y accède, et répond par l'API.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.pa_connections (
  user_id                 UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  provider                TEXT NOT NULL DEFAULT 'superpdp',
  -- 'test' : bac à sable (compte d'essai), 'live' : production
  mode                    TEXT NOT NULL CHECK (mode IN ('test', 'live')),
  -- verifying | manual_review | refused | transfer | directory_missing | active | expired
  status                  TEXT NOT NULL DEFAULT 'verifying',
  siren                   TEXT,
  electronic_address      TEXT,
  platform_company_id     BIGINT,
  company_verification    TEXT,
  identity_verification   TEXT,
  directory_status        TEXT,
  refresh_token_enc       TEXT,
  access_token_enc        TEXT,
  access_expires_at       TIMESTAMPTZ,
  -- Curseurs de relève (identifiants strictement croissants de la plateforme)
  invoices_cursor         BIGINT,
  events_cursor           BIGINT,
  last_check_at           TIMESTAMPTZ,
  last_sync_at            TIMESTAMPTZ,
  last_sync_error         TEXT,
  sync_lock_until         TIMESTAMPTZ,
  active_since            TIMESTAMPTZ,
  -- Notifications par email
  notify_digest           BOOLEAN NOT NULL DEFAULT true,
  notify_each             BOOLEAN NOT NULL DEFAULT false,
  notify_failure          BOOLEAN NOT NULL DEFAULT true,
  notify_email            TEXT,
  activation_notified_at  TIMESTAMPTZ,
  failure_notified_at     TIMESTAMPTZ,
  last_digest_at          TIMESTAMPTZ,
  pending_digest_count    INTEGER NOT NULL DEFAULT 0,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS pa_connections_status_idx ON public.pa_connections (status);

ALTER TABLE public.pa_connections ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.pa_connections FROM anon, authenticated;

COMMENT ON TABLE public.pa_connections IS 'Raccordement de chaque compte à la plateforme agréée (jetons OAuth chiffrés, curseurs de relève, notifications)';
