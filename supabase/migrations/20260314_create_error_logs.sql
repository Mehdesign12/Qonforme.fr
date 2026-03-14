-- Table de suivi des erreurs métier (complément à Sentry pour les events persistants)
CREATE TABLE public.error_logs (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at  TIMESTAMPTZ NOT NULL    DEFAULT NOW(),
  user_id     UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  type        TEXT        NOT NULL,     -- ex: 'webhook_stripe', 'invoice_create'
  message     TEXT        NOT NULL,
  context     JSONB,                   -- données de contexte libres
  resolved_at TIMESTAMPTZ,             -- NULL = non résolu
  resolved_by UUID        REFERENCES auth.users(id) ON DELETE SET NULL
);

CREATE INDEX error_logs_created_at_idx ON public.error_logs (created_at DESC);
CREATE INDEX error_logs_type_idx       ON public.error_logs (type);
CREATE INDEX error_logs_user_id_idx    ON public.error_logs (user_id);

-- Accès uniquement via service_role (logError utility côté serveur)
-- Aucun accès direct pour les utilisateurs
ALTER TABLE public.error_logs ENABLE ROW LEVEL SECURITY;
