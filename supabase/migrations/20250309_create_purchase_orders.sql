-- Migration : Bons de commande
-- À exécuter dans l'éditeur SQL de Supabase

-- ============================================================
-- Table purchase_orders
-- ============================================================
CREATE TABLE IF NOT EXISTS public.purchase_orders (
  id                    UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               UUID          NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  client_id             UUID          REFERENCES public.clients(id) ON DELETE SET NULL,
  po_number             TEXT          NOT NULL,        -- ex : BC-2026-001
  status                TEXT          NOT NULL DEFAULT 'draft'
                                      CHECK (status IN ('draft','sent','confirmed','cancelled')),
  issue_date            DATE          NOT NULL,
  delivery_date         DATE,                          -- date de livraison souhaitée
  reference             TEXT,                          -- référence commande du client
  lines                 JSONB         NOT NULL DEFAULT '[]',
  subtotal_ht           NUMERIC(12,2) NOT NULL DEFAULT 0,
  total_vat             NUMERIC(12,2) NOT NULL DEFAULT 0,
  total_ttc             NUMERIC(12,2) NOT NULL DEFAULT 0,
  notes                 TEXT,
  sent_at               TIMESTAMPTZ,
  confirmed_at          TIMESTAMPTZ,
  created_at            TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

-- Unicité du numéro par utilisateur
CREATE UNIQUE INDEX IF NOT EXISTS uq_purchase_orders_po_number
  ON public.purchase_orders (user_id, po_number);

-- Index courants
CREATE INDEX IF NOT EXISTS idx_purchase_orders_user_id
  ON public.purchase_orders (user_id);
CREATE INDEX IF NOT EXISTS idx_purchase_orders_client_id
  ON public.purchase_orders (client_id);
CREATE INDEX IF NOT EXISTS idx_purchase_orders_status
  ON public.purchase_orders (user_id, status);

-- Trigger updated_at (réutilise la fonction déjà créée pour products)
DROP TRIGGER IF EXISTS purchase_orders_updated_at ON public.purchase_orders;
CREATE TRIGGER purchase_orders_updated_at
  BEFORE UPDATE ON public.purchase_orders
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- Row Level Security
-- ============================================================
ALTER TABLE public.purchase_orders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage their own purchase orders" ON public.purchase_orders;
CREATE POLICY "Users can manage their own purchase orders"
  ON public.purchase_orders
  FOR ALL
  USING  (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ============================================================
-- Commentaires
-- ============================================================
COMMENT ON TABLE  public.purchase_orders                 IS 'Bons de commande émis par les utilisateurs';
COMMENT ON COLUMN public.purchase_orders.po_number       IS 'Numéro séquentiel : BC-YYYY-NNN';
COMMENT ON COLUMN public.purchase_orders.status          IS 'draft | sent | confirmed | cancelled';
COMMENT ON COLUMN public.purchase_orders.delivery_date   IS 'Date de livraison souhaitée (optionnel)';
COMMENT ON COLUMN public.purchase_orders.reference       IS 'Référence de commande fournie par le client (optionnel)';
COMMENT ON COLUMN public.purchase_orders.lines           IS 'Tableau JSONB des lignes de commande';
