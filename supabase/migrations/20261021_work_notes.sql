-- ============================================================
-- Notes et tâches avec rappel (par chantier, par client ou libres)
-- ============================================================
-- À APPLIQUER APRÈS 20261021_planning_appointments.sql (fonction
-- check_planning_links). Le code fonctionne sans elle : notes masquées.
-- Idempotente.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.work_notes (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  client_id        UUID REFERENCES public.clients(id) ON DELETE SET NULL,
  chantier_id      UUID,
  kind             TEXT NOT NULL DEFAULT 'note' CHECK (kind IN ('note','task')),
  body             TEXT NOT NULL CHECK (char_length(body) BETWEEN 1 AND 4000),
  due_at           TIMESTAMPTZ,
  remind_at        TIMESTAMPTZ,
  reminder_sent_at TIMESTAMPTZ,
  done_at          TIMESTAMPTZ,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT work_notes_task_fields CHECK (kind = 'task' OR (due_at IS NULL AND remind_at IS NULL AND done_at IS NULL))
);

CREATE INDEX IF NOT EXISTS work_notes_user_idx ON public.work_notes (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS work_notes_chantier_idx ON public.work_notes (chantier_id) WHERE chantier_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS work_notes_client_idx ON public.work_notes (client_id) WHERE client_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS work_notes_reminder_due_idx ON public.work_notes (remind_at)
  WHERE remind_at IS NOT NULL AND reminder_sent_at IS NULL AND done_at IS NULL;

DROP TRIGGER IF EXISTS work_notes_updated_at ON public.work_notes;
CREATE TRIGGER work_notes_updated_at BEFORE UPDATE ON public.work_notes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS work_notes_check_links ON public.work_notes;
CREATE TRIGGER work_notes_check_links BEFORE INSERT OR UPDATE ON public.work_notes
  FOR EACH ROW EXECUTE FUNCTION public.check_planning_links();

ALTER TABLE public.work_notes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "work_notes_own" ON public.work_notes;
CREATE POLICY "work_notes_own" ON public.work_notes
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

COMMENT ON TABLE public.work_notes IS 'Notes et tâches avec rappel, rattachées à un chantier, un client ou libres';
