-- Table de suivi des exécutions des crons
-- Permet de voir dans l'admin si les crons tournent correctement sans passer par les logs Vercel

CREATE TABLE public.cron_logs (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at  TIMESTAMPTZ NOT NULL    DEFAULT NOW(),
  job_name    TEXT        NOT NULL,   -- ex: 'send-reminders'
  status      TEXT        NOT NULL,   -- 'ok' | 'error'
  results     JSONB,                  -- résultat détaillé du job (envois, erreurs, etc.)
  duration_ms INTEGER                 -- durée d'exécution en ms
);

CREATE INDEX cron_logs_created_at_idx ON public.cron_logs (created_at DESC);
CREATE INDEX cron_logs_job_name_idx   ON public.cron_logs (job_name);

-- Accès uniquement via service_role
ALTER TABLE public.cron_logs ENABLE ROW LEVEL SECURITY;
