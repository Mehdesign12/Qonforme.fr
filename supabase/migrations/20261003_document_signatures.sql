-- ============================================================
-- Signature en ligne des devis et des bons de commande
-- (DECISIONS-STRATEGIQUES.md § 11 « Signature en ligne : cahier des charges »
--  et § 12 point 4 : signature réservée aux formules Essentiel et Artisan)
--
-- À APPLIQUER AVANT LA MISE EN LIGNE de la fonction : Supabase Dashboard →
-- SQL Editor, ou `supabase db push`. Idempotente : peut être rejouée.
--
-- Tant qu'elle n'est pas appliquée, le code masque la signature en ligne
-- (lib/supabase/schema-guard.ts) : les fiches devis et bons de commande
-- gardent l'accord sur papier, l'envoi par email reste inchangé.
--
-- Écriture réservée au serveur (clé service_role) : les preuves de signature
-- (horodatage, adresse IP, empreinte du document) ne doivent pas pouvoir être
-- écrites depuis un navigateur. L'artisan lit les siennes ; les réglages sont
-- à lui seul.
-- ============================================================

-- ------------------------------------------------------------
-- 1. Un lien par document et par version
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.document_signatures (
  id                   UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id              UUID          NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  document_type        TEXT          NOT NULL CHECK (document_type IN ('quote', 'purchase_order')),
  document_id          UUID          NOT NULL,
  document_number      TEXT          NOT NULL,
  version              INTEGER       NOT NULL DEFAULT 1,
  -- 'sign' : consulter et signer (formules payantes) ; 'view' : consultation seule (compte gratuit)
  mode                 TEXT          NOT NULL DEFAULT 'sign' CHECK (mode IN ('sign', 'view')),
  -- Empreinte SHA-256 du contenu (lignes, montants, client, dates) au moment de la création du lien
  content_sha256       TEXT          NOT NULL,
  -- Jeton : seule son empreinte SHA-256 sert à le retrouver ; la copie chiffrée
  -- (AES-256-GCM, clé côté serveur) permet à l'artisan de recopier son lien.
  token_hash           TEXT          NOT NULL UNIQUE,
  token_ciphertext     TEXT,
  status               TEXT          NOT NULL DEFAULT 'pending'
                                     CHECK (status IN ('pending', 'signed', 'refused', 'disabled', 'superseded')),
  client_kind          TEXT          NOT NULL DEFAULT 'consumer' CHECK (client_kind IN ('consumer', 'business')),
  expires_at           TIMESTAMPTZ   NOT NULL,
  sent_at              TIMESTAMPTZ,
  sent_to              TEXT,
  first_viewed_at      TIMESTAMPTZ,
  last_viewed_at       TIMESTAMPTZ,
  view_count           INTEGER       NOT NULL DEFAULT 0,
  -- Code de vérification à 6 chiffres envoyé par email (empreinte HMAC seulement)
  code_required        BOOLEAN       NOT NULL DEFAULT FALSE,
  code_hash            TEXT,
  code_expires_at      TIMESTAMPTZ,
  code_attempts        INTEGER       NOT NULL DEFAULT 0,
  code_sent_count      INTEGER       NOT NULL DEFAULT 0,
  code_last_sent_at    TIMESTAMPTZ,
  code_sent_to         TEXT,
  code_verified_at     TIMESTAMPTZ,
  -- Signataire et preuve
  signer_name          TEXT,
  signer_email         TEXT,
  signer_role          TEXT,
  signer_company       TEXT,
  client_order_number  TEXT,
  signature_method     TEXT          CHECK (signature_method IN ('drawn', 'typed')),
  signature_image      TEXT,
  signature_context    TEXT          CHECK (signature_context IN ('distance', 'in_person')),
  consents             JSONB         NOT NULL DEFAULT '{}'::jsonb,
  signed_at            TIMESTAMPTZ,
  signer_ip            TEXT,
  signer_user_agent    TEXT,
  document_sha256      TEXT,
  signed_pdf_path      TEXT,
  signed_pdf_sha256    TEXT,
  refused_at           TIMESTAMPTZ,
  refusal_reason       TEXT,
  refusal_message      TEXT,
  disabled_at          TIMESTAMPTZ,
  superseded_at        TIMESTAMPTZ,
  superseded_by        UUID          REFERENCES public.document_signatures(id) ON DELETE SET NULL,
  created_at           TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_document_signatures_document
  ON public.document_signatures (user_id, document_type, document_id, created_at DESC);

-- Un seul lien actif par document
CREATE UNIQUE INDEX IF NOT EXISTS uq_document_signatures_one_pending
  ON public.document_signatures (document_type, document_id)
  WHERE status = 'pending';

-- Fonction partagée (créée par 20250309_create_products.sql) : recréée ici au besoin
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS document_signatures_updated_at ON public.document_signatures;
CREATE TRIGGER document_signatures_updated_at
  BEFORE UPDATE ON public.document_signatures
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.document_signatures ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "document_signatures_select_own" ON public.document_signatures;
CREATE POLICY "document_signatures_select_own"
  ON public.document_signatures
  FOR SELECT
  USING (auth.uid() = user_id);
-- Aucune politique d'écriture : insertions et mises à jour passent par le serveur (service_role).

COMMENT ON TABLE public.document_signatures IS
  'Liens de signature en ligne (signature électronique simple) des devis et bons de commande, et leur dossier de preuve';

-- ------------------------------------------------------------
-- 2. Journal des événements (dossier de preuve)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.document_signature_events (
  id             UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  signature_id   UUID          NOT NULL REFERENCES public.document_signatures(id) ON DELETE CASCADE,
  user_id        UUID          NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type           TEXT          NOT NULL,
  ip             TEXT,
  user_agent     TEXT,
  details        JSONB         NOT NULL DEFAULT '{}'::jsonb,
  created_at     TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_document_signature_events_signature
  ON public.document_signature_events (signature_id, created_at);

ALTER TABLE public.document_signature_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "document_signature_events_select_own" ON public.document_signature_events;
CREATE POLICY "document_signature_events_select_own"
  ON public.document_signature_events
  FOR SELECT
  USING (auth.uid() = user_id);

-- ------------------------------------------------------------
-- 3. Réglages de l'artisan (Paramètres › Modèles de documents)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.signature_settings (
  user_id              UUID          PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  enabled              BOOLEAN       NOT NULL DEFAULT TRUE,
  code_mode            TEXT          NOT NULL DEFAULT 'threshold' CHECK (code_mode IN ('threshold', 'always', 'never')),
  code_threshold_ttc   NUMERIC(12,2) NOT NULL DEFAULT 5000 CHECK (code_threshold_ttc >= 0),
  link_validity_days   INTEGER       NOT NULL DEFAULT 30 CHECK (link_validity_days BETWEEN 1 AND 365),
  created_at           TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

DROP TRIGGER IF EXISTS signature_settings_updated_at ON public.signature_settings;
CREATE TRIGGER signature_settings_updated_at
  BEFORE UPDATE ON public.signature_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.signature_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "signature_settings_own" ON public.signature_settings;
CREATE POLICY "signature_settings_own"
  ON public.signature_settings
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ------------------------------------------------------------
-- 4. PDF signés : stockage privé (aucune politique : service_role seulement)
-- ------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public)
VALUES ('signed-documents', 'signed-documents', FALSE)
ON CONFLICT (id) DO NOTHING;
