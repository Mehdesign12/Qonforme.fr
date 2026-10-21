-- ============================================================
-- Documents scannés (devis reçus, bons de commande, bons de livraison)
-- ============================================================
-- À APPLIQUER APRÈS 20261021_planning_appointments.sql et
-- 20261021_work_notes.sql. Le code fonctionne sans elle : scan masqué.
-- Fichiers : bucket privé, dossier <user_id>/<document_id>/<page>.webp.
-- Idempotente.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.scanned_documents (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  client_id    UUID REFERENCES public.clients(id) ON DELETE SET NULL,
  chantier_id  UUID,
  note_id      UUID REFERENCES public.work_notes(id) ON DELETE SET NULL,
  kind         TEXT NOT NULL DEFAULT 'other' CHECK (kind IN ('quote_received','purchase_order','delivery_note','other')),
  status       TEXT NOT NULL DEFAULT 'to_classify' CHECK (status IN ('to_classify','classified')),
  title        TEXT CHECK (title IS NULL OR char_length(title) <= 200),
  supplier     TEXT CHECK (supplier IS NULL OR char_length(supplier) <= 200),
  doc_number   TEXT CHECK (doc_number IS NULL OR char_length(doc_number) <= 80),
  doc_date     DATE,
  amount_cents BIGINT CHECK (amount_cents IS NULL OR amount_cents >= 0),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS scanned_documents_user_idx ON public.scanned_documents (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS scanned_documents_chantier_idx ON public.scanned_documents (chantier_id) WHERE chantier_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS scanned_documents_todo_idx ON public.scanned_documents (user_id) WHERE status = 'to_classify';

DROP TRIGGER IF EXISTS scanned_documents_updated_at ON public.scanned_documents;
CREATE TRIGGER scanned_documents_updated_at BEFORE UPDATE ON public.scanned_documents
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS scanned_documents_check_links ON public.scanned_documents;
CREATE TRIGGER scanned_documents_check_links BEFORE INSERT OR UPDATE ON public.scanned_documents
  FOR EACH ROW EXECUTE FUNCTION public.check_planning_links();

ALTER TABLE public.scanned_documents ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "scanned_documents_own" ON public.scanned_documents;
CREATE POLICY "scanned_documents_own" ON public.scanned_documents
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS public.scanned_document_pages (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id  UUID NOT NULL REFERENCES public.scanned_documents(id) ON DELETE CASCADE,
  user_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  position     SMALLINT NOT NULL CHECK (position BETWEEN 1 AND 30),
  storage_path TEXT NOT NULL,
  mime         TEXT NOT NULL DEFAULT 'image/webp',
  bytes        INTEGER NOT NULL CHECK (bytes > 0),
  width        INTEGER,
  height       INTEGER,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (document_id, position)
);

CREATE INDEX IF NOT EXISTS scanned_document_pages_user_idx ON public.scanned_document_pages (user_id);

ALTER TABLE public.scanned_document_pages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "scanned_document_pages_own" ON public.scanned_document_pages;
CREATE POLICY "scanned_document_pages_own" ON public.scanned_document_pages
  FOR ALL USING (auth.uid() = user_id)
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (SELECT 1 FROM public.scanned_documents d WHERE d.id = document_id AND d.user_id = auth.uid())
  );

-- Bucket privé : 8 Mo par page, images ou PDF
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('scanned-documents', 'scanned-documents', FALSE, 8388608,
        ARRAY['image/webp','image/jpeg','image/png','application/pdf'])
ON CONFLICT (id) DO UPDATE
  SET public = FALSE,
      file_size_limit = EXCLUDED.file_size_limit,
      allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "scanned_documents_files_select_own" ON storage.objects;
CREATE POLICY "scanned_documents_files_select_own" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'scanned-documents' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "scanned_documents_files_insert_own" ON storage.objects;
CREATE POLICY "scanned_documents_files_insert_own" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'scanned-documents' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "scanned_documents_files_delete_own" ON storage.objects;
CREATE POLICY "scanned_documents_files_delete_own" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'scanned-documents' AND (storage.foldername(name))[1] = auth.uid()::text);

COMMENT ON TABLE public.scanned_documents IS 'Documents photographiés ou scannés (devis reçus, bons de commande, bons de livraison)';
