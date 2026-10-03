-- ============================================================
-- Lien de paiement par virement et page de règlement
-- ============================================================
-- À APPLIQUER AVANT LA MISE EN LIGNE de la fonction (Supabase Dashboard →
-- SQL Editor, ou `supabase db push`). Le code déjà en production fonctionne
-- sans elle : tant que ces tables et colonnes n'existent pas, aucun lien n'est
-- créé, la fiche facture garde son affichage d'avant et les champs « Titulaire »
-- et « BIC » restent masqués (lib/supabase/schema-guard.ts). Une fois appliquée,
-- tout s'active seul.
--
-- Idempotente : peut être rejouée sans effet de bord.
--
-- Décision : DECISIONS-STRATEGIQUES.md § 12, point 1 (pas de Stripe Connect,
-- le client de l'artisan paie par virement sur l'IBAN de l'artisan).
--
-- Sécurité :
-- - le jeton du lien n'est jamais stocké, seulement son empreinte SHA-256
--   (token_hash) ; il est dérivé d'un secret serveur (lib/payment-link/token.ts) ;
-- - les deux tables ne s'écrivent qu'avec la clé service_role, depuis les
--   routes serveur (lib/payment-link/server.ts) : aucune politique d'écriture
--   pour les utilisateurs, seulement la lecture de leurs propres lignes ;
-- - une seule déclaration de virement ouverte à la fois par facture (index
--   unique partiel), note limitée à 500 caractères, montant positif.
-- ============================================================

-- ------------------------------------------------------------
-- Coordonnées bancaires de l'entreprise (Paramètres › Entreprise)
-- ------------------------------------------------------------
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS bic                 TEXT;
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS bank_account_holder TEXT;

-- ------------------------------------------------------------
-- Liens de paiement : un par facture, stable, désactivable
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.invoice_payment_links (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id   UUID        NOT NULL UNIQUE REFERENCES public.invoices(id) ON DELETE CASCADE,
  user_id      UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  -- Empreinte SHA-256 (hexadécimal) du jeton ; le jeton lui-même n'est jamais stocké
  token_hash   TEXT        NOT NULL UNIQUE CHECK (token_hash ~ '^[0-9a-f]{64}$'),
  -- Sel de dérivation du jeton ; changé quand un lien désactivé est recréé
  nonce        TEXT        NOT NULL CHECK (char_length(nonce) BETWEEN 16 AND 64),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  disabled_at  TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_invoice_payment_links_user_id
  ON public.invoice_payment_links (user_id);

ALTER TABLE public.invoice_payment_links ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "payment_links_select_own" ON public.invoice_payment_links;
CREATE POLICY "payment_links_select_own"
  ON public.invoice_payment_links
  FOR SELECT
  USING (auth.uid() = user_id);

-- ------------------------------------------------------------
-- Virements déclarés par le client depuis la page de règlement
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.invoice_payment_declarations (
  id             UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id     UUID          NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
  user_id        UUID          NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  link_id        UUID          REFERENCES public.invoice_payment_links(id) ON DELETE SET NULL,
  transfer_date  DATE          NOT NULL,
  amount         NUMERIC(12,2) NOT NULL CHECK (amount > 0),
  note           TEXT          CHECK (note IS NULL OR char_length(note) <= 500),
  -- open : à vérifier par l'artisan ; dismissed : « pas reçu » ; confirmed : réservé
  status         TEXT          NOT NULL DEFAULT 'open'
                               CHECK (status IN ('open', 'dismissed', 'confirmed')),
  created_at     TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  resolved_at    TIMESTAMPTZ
);

-- Une seule déclaration ouverte à la fois par facture
CREATE UNIQUE INDEX IF NOT EXISTS uq_invoice_payment_declarations_open
  ON public.invoice_payment_declarations (invoice_id)
  WHERE status = 'open';

CREATE INDEX IF NOT EXISTS idx_invoice_payment_declarations_user_status
  ON public.invoice_payment_declarations (user_id, status);
CREATE INDEX IF NOT EXISTS idx_invoice_payment_declarations_invoice_created
  ON public.invoice_payment_declarations (invoice_id, created_at DESC);

ALTER TABLE public.invoice_payment_declarations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "payment_declarations_select_own" ON public.invoice_payment_declarations;
CREATE POLICY "payment_declarations_select_own"
  ON public.invoice_payment_declarations
  FOR SELECT
  USING (auth.uid() = user_id);

-- Pas de politique INSERT / UPDATE / DELETE : écritures par la clé service_role
-- uniquement (routes /api/regler/* et /api/invoices/[id]/payment-link).
