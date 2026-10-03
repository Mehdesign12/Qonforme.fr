-- ============================================================
-- Réception des factures fournisseurs
--
-- À APPLIQUER AVANT LA MISE EN LIGNE de la boîte « Factures reçues »
-- (Supabase Dashboard → SQL Editor, ou `supabase db push`).
--
-- Tant que cette migration n'est pas appliquée, l'application reste
-- fonctionnelle : la page « Factures reçues » affiche « en cours de mise en
-- service » et l'import est désactivé (lib/supabase/schema-guard.ts). Une
-- fois appliquée, tout s'active seul.
--
-- Contenu :
-- 1. received_invoices : une ligne par facture reçue (import manuel ou, plus
--    tard, plateforme agréée), résumé pour la liste + facture lue en JSON ;
-- 2. received_invoice_events : historique horodaté du cycle de vie (statuts
--    202 à 213 des spécifications externes DGFiP v3.2, tableau 8), en ajout
--    seul : ni modification ni suppression par l'utilisateur ;
-- 3. bucket Storage privé « received-invoices » pour le fichier d'origine
--    (PDF ou XML, 4 Mo au plus), rangé sous <user_id>/… ;
-- 4. RLS : chaque utilisateur ne voit et n'écrit que ses propres lignes et
--    fichiers.
--
-- Idempotent : peut être rejouée sans effet de bord.
-- ============================================================

-- ------------------------------------------------------------
-- 1. Factures reçues
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.received_invoices (
  id                  UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             UUID          NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  source              TEXT          NOT NULL DEFAULT 'import' CHECK (source IN ('import', 'platform')),
  format              TEXT          NOT NULL CHECK (format IN ('facturx', 'cii', 'ubl', 'pdf')),
  document_type       TEXT          NOT NULL DEFAULT '380' CHECK (document_type ~ '^[0-9]{3}$'),
  invoice_number      TEXT          NOT NULL CHECK (char_length(invoice_number) BETWEEN 1 AND 60),
  -- Numéro normalisé et clé d'unicité (fournisseur + numéro + année, règle DGFiP)
  number_key          TEXT          NOT NULL,
  dedup_key           TEXT          NOT NULL,
  issue_date          DATE          NOT NULL,
  due_date            DATE,
  currency            TEXT          NOT NULL DEFAULT 'EUR' CHECK (currency ~ '^[A-Z]{3}$'),
  supplier_name       TEXT          NOT NULL CHECK (char_length(supplier_name) BETWEEN 1 AND 200),
  supplier_siren      TEXT          CHECK (supplier_siren ~ '^[0-9]{9}$'),
  supplier_vat_number TEXT          CHECK (char_length(supplier_vat_number) <= 20),
  buyer_name          TEXT          CHECK (char_length(buyer_name) <= 200),
  buyer_siren         TEXT          CHECK (buyer_siren ~ '^[0-9]{9}$'),
  total_ht            NUMERIC(14,2) NOT NULL,
  total_vat           NUMERIC(14,2) NOT NULL,
  total_ttc           NUMERIC(14,2) NOT NULL,
  amount_due          NUMERIC(14,2) NOT NULL,
  -- Facture lue (parties, lignes, ventilation de TVA…), null pour une saisie manuelle
  data                JSONB,
  -- Contrôles faits à l'import
  checks              JSONB         NOT NULL DEFAULT '[]'::jsonb,
  status              TEXT          NOT NULL DEFAULT 'received' CHECK (status IN (
                        'received', 'made_available', 'in_hand', 'approved', 'partially_approved',
                        'disputed', 'suspended', 'completed', 'refused', 'payment_sent', 'cashed', 'rejected')),
  status_reason_code  TEXT          CHECK (char_length(status_reason_code) <= 40),
  status_reason       TEXT          CHECK (char_length(status_reason) <= 1000),
  status_changed_at   TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  -- Fichier d'origine dans le bucket privé « received-invoices »
  file_path           TEXT,
  file_name           TEXT          CHECK (char_length(file_name) <= 200),
  file_mime           TEXT          CHECK (file_mime IN ('application/pdf', 'application/xml')),
  file_size           INTEGER       CHECK (file_size BETWEEN 0 AND 4194304),
  file_sha256         TEXT          CHECK (file_sha256 ~ '^[0-9a-f]{64}$'),
  has_pdf             BOOLEAN       NOT NULL DEFAULT FALSE,
  -- Plateforme agréée : identifiant de la facture chez elle (null pour un import)
  platform_id         TEXT          CHECK (char_length(platform_id) <= 200),
  received_at         TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  created_at          TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

-- Une même facture (fournisseur, numéro, année) n'est enregistrée qu'une fois par compte
CREATE UNIQUE INDEX IF NOT EXISTS uq_received_invoices_dedup
  ON public.received_invoices (user_id, dedup_key);
CREATE UNIQUE INDEX IF NOT EXISTS uq_received_invoices_platform
  ON public.received_invoices (user_id, platform_id) WHERE platform_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_received_invoices_user_issue
  ON public.received_invoices (user_id, issue_date DESC);
CREATE INDEX IF NOT EXISTS idx_received_invoices_user_number
  ON public.received_invoices (user_id, number_key);

ALTER TABLE public.received_invoices ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "received_invoices_select_own" ON public.received_invoices;
CREATE POLICY "received_invoices_select_own" ON public.received_invoices
  FOR SELECT TO authenticated USING (user_id = auth.uid());

DROP POLICY IF EXISTS "received_invoices_insert_own" ON public.received_invoices;
CREATE POLICY "received_invoices_insert_own" ON public.received_invoices
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "received_invoices_update_own" ON public.received_invoices;
CREATE POLICY "received_invoices_update_own" ON public.received_invoices
  FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "received_invoices_delete_own" ON public.received_invoices;
CREATE POLICY "received_invoices_delete_own" ON public.received_invoices
  FOR DELETE TO authenticated USING (user_id = auth.uid());

-- ------------------------------------------------------------
-- 2. Historique du cycle de vie (ajout seul)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.received_invoice_events (
  id              UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id      UUID          NOT NULL REFERENCES public.received_invoices(id) ON DELETE CASCADE,
  user_id         UUID          NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status          TEXT          NOT NULL CHECK (status IN (
                    'received', 'made_available', 'in_hand', 'approved', 'partially_approved',
                    'disputed', 'suspended', 'completed', 'refused', 'payment_sent', 'cashed', 'rejected')),
  -- Code de la norme (« 205 »), null pour un import manuel
  code            TEXT          CHECK (code ~ '^[0-9]{3}$'),
  reason_code     TEXT          CHECK (char_length(reason_code) <= 40),
  reason          TEXT          CHECK (char_length(reason) <= 1000),
  -- Qui a posé le statut : l'artisan, la plateforme, ou l'import du fichier
  actor           TEXT          NOT NULL CHECK (actor IN ('user', 'platform', 'import')),
  -- Transmis à la plateforme agréée (null : resté dans Qonforme)
  transmitted_at  TIMESTAMPTZ,
  created_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_received_invoice_events_invoice
  ON public.received_invoice_events (invoice_id, created_at);

ALTER TABLE public.received_invoice_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "received_invoice_events_select_own" ON public.received_invoice_events;
CREATE POLICY "received_invoice_events_select_own" ON public.received_invoice_events
  FOR SELECT TO authenticated USING (user_id = auth.uid());

-- Ajout seulement sur ses propres factures ; aucune politique UPDATE ni DELETE :
-- l'historique ne se réécrit pas (la suppression d'une facture l'emporte par cascade).
DROP POLICY IF EXISTS "received_invoice_events_insert_own" ON public.received_invoice_events;
CREATE POLICY "received_invoice_events_insert_own" ON public.received_invoice_events
  FOR INSERT TO authenticated WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.received_invoices r
      WHERE r.id = received_invoice_events.invoice_id AND r.user_id = auth.uid()
    )
  );

-- ------------------------------------------------------------
-- 3. Fichiers d'origine : bucket privé, 4 Mo, PDF ou XML
-- ------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('received-invoices', 'received-invoices', FALSE, 4194304, ARRAY['application/pdf', 'application/xml'])
ON CONFLICT (id) DO UPDATE
  SET public = FALSE,
      file_size_limit = EXCLUDED.file_size_limit,
      allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Chaque utilisateur ne lit, n'ajoute et ne retire que les fichiers de son dossier <user_id>/…
-- Pas de politique UPDATE : un fichier reçu ne se remplace pas.
DROP POLICY IF EXISTS "received_invoices_files_select_own" ON storage.objects;
CREATE POLICY "received_invoices_files_select_own" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'received-invoices' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "received_invoices_files_insert_own" ON storage.objects;
CREATE POLICY "received_invoices_files_insert_own" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'received-invoices' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "received_invoices_files_delete_own" ON storage.objects;
CREATE POLICY "received_invoices_files_delete_own" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'received-invoices' AND (storage.foldername(name))[1] = auth.uid()::text);
