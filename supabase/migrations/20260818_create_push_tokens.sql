-- Migration : jetons de notification push (app iOS / Android)
-- À exécuter dans l'éditeur SQL de Supabase

-- ============================================================
-- Table push_tokens
-- ============================================================
-- Un même utilisateur peut avoir plusieurs appareils (iPhone + iPad), et un
-- même appareil peut changer de jeton après réinstallation : la clé d'unicité
-- porte donc sur le jeton, pas sur l'utilisateur.
CREATE TABLE IF NOT EXISTS public.push_tokens (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  token        TEXT        NOT NULL UNIQUE,
  platform     TEXT        NOT NULL CHECK (platform IN ('ios', 'android')),
  device_model TEXT,                        -- ex: "iPhone15,3" — diagnostic
  app_version  TEXT,                        -- version du bundle natif
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Envoi d'une relance : on récupère tous les jetons d'un utilisateur.
CREATE INDEX IF NOT EXISTS idx_push_tokens_user_id
  ON public.push_tokens (user_id);

-- Purge des appareils inactifs (jetons APNs invalidés par Apple).
CREATE INDEX IF NOT EXISTS idx_push_tokens_last_seen
  ON public.push_tokens (last_seen_at);

DROP TRIGGER IF EXISTS push_tokens_updated_at ON public.push_tokens;
CREATE TRIGGER push_tokens_updated_at
  BEFORE UPDATE ON public.push_tokens
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- Row Level Security (RLS)
-- ============================================================
ALTER TABLE public.push_tokens ENABLE ROW LEVEL SECURITY;

-- Un utilisateur ne gère que les appareils rattachés à son compte.
-- L'envoi des notifications passe par le client service_role, qui contourne RLS.
DROP POLICY IF EXISTS "Users can manage their own push tokens" ON public.push_tokens;
CREATE POLICY "Users can manage their own push tokens"
  ON public.push_tokens
  FOR ALL
  USING  (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ============================================================
-- Commentaires
-- ============================================================
COMMENT ON TABLE  public.push_tokens              IS 'Jetons APNs/FCM des appareils sur lesquels Qonforme est installé';
COMMENT ON COLUMN public.push_tokens.token        IS 'Jeton fourni par APNs (iOS) ou FCM (Android) — unique par installation';
COMMENT ON COLUMN public.push_tokens.last_seen_at IS 'Dernier enregistrement du jeton : sert à purger les appareils désinstallés';
