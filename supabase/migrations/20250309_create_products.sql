-- Migration : Catalogue produits / services
-- À exécuter dans l'éditeur SQL de Supabase

-- ============================================================
-- Table products
-- ============================================================
CREATE TABLE IF NOT EXISTS public.products (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name            TEXT        NOT NULL,
  description     TEXT,
  unit_price_ht   NUMERIC(12,2) NOT NULL DEFAULT 0,
  vat_rate        NUMERIC(5,2)  NOT NULL DEFAULT 20,
  unit            TEXT,                        -- ex: "heure", "jour", "forfait", "pièce"
  reference       TEXT,                        -- référence interne / SKU
  is_active       BOOLEAN     NOT NULL DEFAULT TRUE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index pour les recherches par utilisateur
CREATE INDEX IF NOT EXISTS idx_products_user_id
  ON public.products (user_id);

-- Index pour la recherche full-text sur le nom et la description
CREATE INDEX IF NOT EXISTS idx_products_name
  ON public.products (user_id, name);

-- Trigger de mise à jour automatique de updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS products_updated_at ON public.products;
CREATE TRIGGER products_updated_at
  BEFORE UPDATE ON public.products
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- Row Level Security (RLS)
-- ============================================================
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

-- Chaque utilisateur ne voit que ses propres produits
DROP POLICY IF EXISTS "Users can manage their own products" ON public.products;
CREATE POLICY "Users can manage their own products"
  ON public.products
  FOR ALL
  USING  (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ============================================================
-- Commentaires
-- ============================================================
COMMENT ON TABLE  public.products              IS 'Catalogue de produits et services de chaque utilisateur';
COMMENT ON COLUMN public.products.unit         IS 'Unité de facturation : heure, jour, forfait, pièce…';
COMMENT ON COLUMN public.products.reference    IS 'Référence interne / SKU';
COMMENT ON COLUMN public.products.is_active    IS 'Permet de masquer un produit sans le supprimer';
