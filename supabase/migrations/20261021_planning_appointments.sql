-- ============================================================
-- Planning : rendez-vous (visite, chantier, livraison)
-- ============================================================
-- À APPLIQUER AVANT LA MISE EN LIGNE de la fonction (Supabase Dashboard →
-- SQL Editor). Le code en production fonctionne sans elle : tant que la table
-- n'existe pas, le planning reste masqué. Idempotente.
-- Crée aussi check_planning_links(), réutilisée par work_notes et
-- scanned_documents : le client et le chantier liés appartiennent au
-- propriétaire de la ligne (le chantier n'est vérifié que si la table existe).
-- ============================================================

CREATE OR REPLACE FUNCTION public.check_planning_links()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE ok boolean;
BEGIN
  IF NEW.client_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.clients c WHERE c.id = NEW.client_id AND c.user_id = NEW.user_id
  ) THEN
    RAISE EXCEPTION 'Client introuvable' USING ERRCODE = '23503';
  END IF;
  IF NEW.chantier_id IS NOT NULL AND to_regclass('public.chantiers') IS NOT NULL THEN
    EXECUTE 'SELECT EXISTS (SELECT 1 FROM public.chantiers h WHERE h.id = $1 AND h.user_id = $2)'
      INTO ok USING NEW.chantier_id, NEW.user_id;
    IF NOT ok THEN
      RAISE EXCEPTION 'Chantier introuvable' USING ERRCODE = '23503';
    END IF;
  END IF;
  RETURN NEW;
END $$;

CREATE TABLE IF NOT EXISTS public.appointments (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id            UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  client_id          UUID REFERENCES public.clients(id) ON DELETE SET NULL,
  chantier_id        UUID,
  kind               TEXT NOT NULL DEFAULT 'visite' CHECK (kind IN ('visite','chantier','livraison')),
  title              TEXT NOT NULL CHECK (char_length(title) BETWEEN 1 AND 200),
  starts_at          TIMESTAMPTZ NOT NULL,
  ends_at            TIMESTAMPTZ NOT NULL,
  address            TEXT CHECK (address IS NULL OR char_length(address) <= 300),
  notes              TEXT CHECK (notes IS NULL OR char_length(notes) <= 2000),
  status             TEXT NOT NULL DEFAULT 'planned' CHECK (status IN ('planned','done','cancelled')),
  reminder_minutes   INTEGER CHECK (reminder_minutes IS NULL OR reminder_minutes BETWEEN 0 AND 10080),
  reminder_sent_at   TIMESTAMPTZ,
  notify_client      BOOLEAN NOT NULL DEFAULT FALSE,
  client_notified_at TIMESTAMPTZ,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT appointments_time_order CHECK (ends_at > starts_at)
);

CREATE INDEX IF NOT EXISTS appointments_user_start_idx ON public.appointments (user_id, starts_at);
CREATE INDEX IF NOT EXISTS appointments_reminder_due_idx ON public.appointments (starts_at)
  WHERE reminder_minutes IS NOT NULL AND reminder_sent_at IS NULL AND status = 'planned';

DROP TRIGGER IF EXISTS appointments_updated_at ON public.appointments;
CREATE TRIGGER appointments_updated_at BEFORE UPDATE ON public.appointments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS appointments_check_links ON public.appointments;
CREATE TRIGGER appointments_check_links BEFORE INSERT OR UPDATE ON public.appointments
  FOR EACH ROW EXECUTE FUNCTION public.check_planning_links();

ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "appointments_own" ON public.appointments;
CREATE POLICY "appointments_own" ON public.appointments
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

COMMENT ON TABLE public.appointments IS 'Rendez-vous du planning de l''artisan (visite, chantier, livraison)';
