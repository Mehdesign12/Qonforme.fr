-- ============================================================
-- « Corriger ce devis » : nouvelle version d'un devis envoyé
--
-- À APPLIQUER : Supabase Dashboard → SQL Editor, ou `supabase db push`.
-- Idempotente : peut être rejouée. Aucune donnée existante n'est modifiée.
--
-- Un devis envoyé ne se modifie pas (lib/utils/document-status.ts). Pour le
-- corriger, l'artisan crée une nouvelle version en brouillon, liée à l'ancienne
-- (`revises_quote_id`). Quand cette nouvelle version part chez le client,
-- l'ancienne passe au statut « superseded » (Remplacé) et pointe vers elle
-- (`superseded_by_quote_id`) ; son lien de signature est fermé.
-- Sans cette migration, le bouton « Corriger ce devis » répond qu'il n'est pas
-- encore activé ; rien d'autre ne change.
-- ============================================================

ALTER TABLE public.quotes
  ADD COLUMN IF NOT EXISTS revises_quote_id       UUID REFERENCES public.quotes(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS revises_quote_number   TEXT,
  ADD COLUMN IF NOT EXISTS superseded_by_quote_id UUID REFERENCES public.quotes(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS superseded_at          TIMESTAMPTZ;

COMMENT ON COLUMN public.quotes.revises_quote_id IS
  'Devis que cette version corrige (« Corriger ce devis »). NULL : devis ordinaire.';
COMMENT ON COLUMN public.quotes.revises_quote_number IS
  'Numéro du devis corrigé, imprimé sur le PDF (« Annule et remplace le devis n° … »).';
COMMENT ON COLUMN public.quotes.superseded_by_quote_id IS
  'Version qui a remplacé ce devis, posée à l''envoi de la correction.';
COMMENT ON COLUMN public.quotes.superseded_at IS
  'Date à laquelle ce devis a été remplacé par sa correction.';

-- Une seule correction par devis : la suivante se fait à partir de la nouvelle version
CREATE UNIQUE INDEX IF NOT EXISTS quotes_revises_quote_id_key
  ON public.quotes (revises_quote_id)
  WHERE revises_quote_id IS NOT NULL;

-- ------------------------------------------------------------
-- Nouveau statut « superseded » (remplacé par une correction)
-- ------------------------------------------------------------
-- Même méthode que la migration 20261010 : chaque contrainte CHECK qui porte
-- sur le statut des devis est remplacée par la même liste, plus « superseded ».
-- Sans contrainte existante, rien n'est ajouté.
DO $$
DECLARE
  c RECORD;
  dropped BOOLEAN := FALSE;
BEGIN
  FOR c IN
    SELECT conname
    FROM pg_constraint
    WHERE conrelid = 'public.quotes'::regclass
      AND contype = 'c'
      AND pg_get_constraintdef(oid) ILIKE '%status%'
      AND pg_get_constraintdef(oid) ILIKE '%accepted%'
  LOOP
    EXECUTE format('ALTER TABLE public.quotes DROP CONSTRAINT %I', c.conname);
    dropped := TRUE;
  END LOOP;

  IF dropped THEN
    ALTER TABLE public.quotes ADD CONSTRAINT quotes_status_check
      CHECK (status IN ('draft', 'sent', 'accepted', 'rejected', 'withdrawn', 'superseded')) NOT VALID;
  END IF;
END $$;
