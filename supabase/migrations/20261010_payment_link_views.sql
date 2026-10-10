-- ============================================================
-- Suivi d'ouverture des factures : consultations de la page de règlement
-- (DECISIONS-STRATEGIQUES.md § 10 « Suivi d'ouverture des devis et factures »)
--
-- À APPLIQUER APRÈS 20261003_payment_links.sql : Supabase Dashboard → SQL
-- Editor, ou `supabase db push`. Idempotente : peut être rejouée.
--
-- Une consultation est comptée par le navigateur qui affiche la page (pas par
-- les robots des messageries qui vérifient les liens), une fois par tranche de
-- 10 minutes, comme pour les devis (document_signatures.view_count). Aucune
-- donnée sur la personne : ni adresse IP, ni navigateur.
-- Tant que les colonnes manquent, la fiche facture n'affiche pas de suivi.
-- ============================================================

ALTER TABLE public.invoice_payment_links
  ADD COLUMN IF NOT EXISTS view_count      INTEGER     NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS first_viewed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_viewed_at  TIMESTAMPTZ;
