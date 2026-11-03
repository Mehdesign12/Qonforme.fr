-- ============================================================
-- Émission par la plateforme agréée (Super PDP) : un envoi par ligne
-- ============================================================
-- À APPLIQUER APRÈS 20261030_pa_connections.sql. Le code fonctionne sans
-- elle : l'envoi par la plateforme n'est alors pas proposé, les factures et
-- les avoirs partent par email comme avant. Idempotente.
--
-- Une ligne par tentative d'envoi d'une facture ou d'un avoir par la
-- plateforme. Une facture sans ligne est partie par email. Une facture
-- rejetée puis corrigée et renvoyée garde sa première tentative
-- (superseded_at posé) : une seule tentative active par document.
--
-- Réservation avant l'appel à la plateforme (phase 'sending') : l'index unique
-- partiel empêche deux envois simultanés du même document.
--
-- La table n'est lisible ni écrivable par un utilisateur (RLS sans politique,
-- droits retirés) : le serveur seul (service_role) y accède, et répond par l'API.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.pa_outbound (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                 UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  provider                TEXT NOT NULL DEFAULT 'superpdp',
  -- 'test' : bac à sable (compte d'essai), 'live' : production
  mode                    TEXT NOT NULL CHECK (mode IN ('test', 'live')),
  document_type           TEXT NOT NULL CHECK (document_type IN ('invoice', 'credit_note')),
  document_id             UUID NOT NULL,
  -- Numéro du document au moment de l'envoi (il ne change plus une fois émis)
  document_number         TEXT NOT NULL,
  attempt                 SMALLINT NOT NULL DEFAULT 1 CHECK (attempt >= 1),
  -- sending : réservé, dépôt en cours ; failed : refusé avant ou au dépôt
  -- (contrôle, annuaire, panne) ; sent : déposé chez la plateforme ;
  -- rejected : rejeté ensuite par une plateforme (renvoi possible après correction)
  phase                   TEXT NOT NULL DEFAULT 'sending'
                            CHECK (phase IN ('sending', 'failed', 'sent', 'rejected')),
  -- Identifiant de la facture chez la plateforme (relève des statuts, encaissement)
  platform_invoice_id     BIGINT,
  -- Adresses de facturation électronique utilisées (annuaire), ex. 0225:552100554
  recipient_address       TEXT,
  sender_address          TEXT,
  -- Dernier statut officiel reçu (ex. fr:205) et historique trié par date :
  -- [{ "id": 123, "code": "fr:205", "at": "…", "text": "…", "reason": "…" }]
  last_status_code        TEXT,
  last_status_at          TIMESTAMPTZ,
  events                  JSONB NOT NULL DEFAULT '[]'::jsonb,
  error                   TEXT,
  deposited_at            TIMESTAMPTZ,
  -- Déclaration de l'encaissement (fr:212) : une seule fois
  payment_reported_at     TIMESTAMPTZ,
  payment_event_id        BIGINT,
  superseded_at           TIMESTAMPTZ,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Une seule tentative active par document
CREATE UNIQUE INDEX IF NOT EXISTS pa_outbound_active_document_idx
  ON public.pa_outbound (document_type, document_id) WHERE superseded_at IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS pa_outbound_attempt_idx
  ON public.pa_outbound (document_type, document_id, attempt);
-- Les statuts relevés retrouvent leur envoi par l'identifiant de la plateforme
CREATE UNIQUE INDEX IF NOT EXISTS pa_outbound_platform_invoice_idx
  ON public.pa_outbound (mode, platform_invoice_id) WHERE platform_invoice_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS pa_outbound_user_idx ON public.pa_outbound (user_id, created_at DESC);

ALTER TABLE public.pa_outbound ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.pa_outbound FROM anon, authenticated;

COMMENT ON TABLE public.pa_outbound IS 'Factures et avoirs envoyés par la plateforme agréée : tentative, identifiant chez la plateforme, statuts reçus, encaissement déclaré';
