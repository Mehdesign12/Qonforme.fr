-- ============================================================
-- Chantiers : regroupe devis et factures d'une même opération
-- (marché, lots, retenue de garantie, autoliquidation).
--
-- NON APPLIQUÉE automatiquement : à exécuter dans Supabase Dashboard →
-- SQL Editor, puis activer la fonction dans Vercel avec la variable
-- d'environnement NEXT_PUBLIC_FEATURE_CHANTIERS=true (voir lib/features.ts).
-- Tant que la variable n'est pas définie, les pages et l'API Chantiers
-- restent masquées : rien ne lit cette table.
--
-- Idempotente : peut être rejouée sans effet de bord.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.chantiers (
  id                UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID          NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  client_id         UUID          REFERENCES public.clients(id) ON DELETE SET NULL,
  name              TEXT          NOT NULL,
  address           TEXT,
  start_date        DATE,
  end_date          DATE,
  status            TEXT          NOT NULL DEFAULT 'todo'
                    CHECK (status IN ('todo', 'active', 'done', 'archived')),
  -- [{ "label": "Doublages et isolation", "amount_ht": 14200 }]
  lots              JSONB         NOT NULL DEFAULT '[]'::jsonb,
  retenue_garantie  BOOLEAN       NOT NULL DEFAULT FALSE,
  retenue_rate      NUMERIC(5,2)  NOT NULL DEFAULT 5,
  autoliquidation   BOOLEAN       NOT NULL DEFAULT FALSE,
  notes             TEXT,
  created_at        TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_chantiers_user_id ON public.chantiers (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_chantiers_client_id ON public.chantiers (client_id);

-- updated_at automatique (fonction créée par 20250309_create_products.sql)
DROP TRIGGER IF EXISTS chantiers_updated_at ON public.chantiers;
CREATE TRIGGER chantiers_updated_at
  BEFORE UPDATE ON public.chantiers
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.chantiers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage their own chantiers" ON public.chantiers;
CREATE POLICY "Users can manage their own chantiers"
  ON public.chantiers
  FOR ALL
  USING  (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ── Rattachement des devis et factures ─────────────────────────
ALTER TABLE public.quotes   ADD COLUMN IF NOT EXISTS chantier_id UUID REFERENCES public.chantiers(id) ON DELETE SET NULL;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS chantier_id UUID REFERENCES public.chantiers(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_quotes_chantier_id   ON public.quotes (chantier_id)   WHERE chantier_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_invoices_chantier_id ON public.invoices (chantier_id) WHERE chantier_id IS NOT NULL;

COMMENT ON TABLE  public.chantiers                  IS 'Chantiers : marché, lots et documents d''une même opération';
COMMENT ON COLUMN public.chantiers.lots             IS 'Lots du marché : [{label, amount_ht}]';
COMMENT ON COLUMN public.chantiers.retenue_garantie IS 'Retenue de garantie (loi du 16 juillet 1971), au taux retenue_rate';
COMMENT ON COLUMN public.chantiers.autoliquidation  IS 'Sous-traitance BTP : TVA autoliquidée (CGI art. 283-2 nonies)';
