-- ============================================================
-- Date de paiement des factures (« encaissé » du tableau de bord,
-- DECISIONS-STRATEGIQUES.md § 10 « Pilotage et équipe »)
--
-- À APPLIQUER : Supabase Dashboard → SQL Editor, ou `supabase db push`.
-- Idempotente : peut être rejouée. La colonne existe peut-être déjà (schéma
-- d'origine, créé hors migrations) : elle n'était écrite par aucune route.
--
-- Écrite par PATCH /api/invoices/[id] au passage à « payée », effacée au
-- retour (lib/utils/payment-date.ts). Tant que la colonne manque, le statut
-- change sans date et le tableau de bord n'affiche pas d'encaissé.
-- ============================================================

ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS paid_at TIMESTAMPTZ;

-- Encaissé d'une période : factures payées d'un compte, par date de paiement
CREATE INDEX IF NOT EXISTS idx_invoices_paid_at
  ON public.invoices (user_id, paid_at)
  WHERE status = 'paid' AND paid_at IS NOT NULL;

COMMENT ON COLUMN public.invoices.paid_at IS
  'Date du paiement saisie par l''artisan (« Marquer comme payée » ou virement déclaré), effacée si la facture revient à « envoyée » ou « en retard »';
