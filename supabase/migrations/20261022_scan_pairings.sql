-- ============================================================
-- Appairage du téléphone pour le scan de documents
-- ============================================================
-- À APPLIQUER APRÈS 20261021_scanned_documents.sql. Le code fonctionne sans
-- elle : le QR code du scan mène alors à la page Documents (connexion requise
-- sur le téléphone), sans appairage. Idempotente.
--
-- Un appairage est un jeton à usage limité créé sur l'ordinateur (QR code) :
-- le téléphone qui le présente peut envoyer des documents scannés au compte,
-- et rien d'autre, pendant 15 minutes au plus. Seule l'empreinte SHA-256 du
-- jeton est stockée ; la table n'est lisible ni écrivable par un utilisateur
-- (RLS sans politique, droits retirés) : le serveur seul (service_role) y accède.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.scan_pairings (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  token_hash  TEXT NOT NULL UNIQUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at  TIMESTAMPTZ NOT NULL,
  claimed_at  TIMESTAMPTZ,
  revoked_at  TIMESTAMPTZ,
  CONSTRAINT scan_pairings_ttl CHECK (expires_at > created_at)
);

CREATE INDEX IF NOT EXISTS scan_pairings_user_idx ON public.scan_pairings (user_id, created_at DESC);

ALTER TABLE public.scan_pairings ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.scan_pairings FROM anon, authenticated;

-- Les documents reçus par un appairage le portent (la page de l'ordinateur les compte)
ALTER TABLE public.scanned_documents
  ADD COLUMN IF NOT EXISTS pairing_id UUID REFERENCES public.scan_pairings(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS scanned_documents_pairing_idx ON public.scanned_documents (pairing_id) WHERE pairing_id IS NOT NULL;

COMMENT ON TABLE public.scan_pairings IS 'Appairages QR code ordinateur → téléphone pour le scan de documents (jeton haché, 15 minutes)';
