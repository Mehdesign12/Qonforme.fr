-- ============================================================
-- Modèles de mise en page des documents (Paramètres › Modèles de documents)
--
-- À APPLIQUER : Supabase Dashboard → SQL Editor, ou `supabase db push`.
-- Idempotente : peut être rejouée.
--
-- `document_templates` : modèle choisi par type de document, par exemple
-- {"quote": "chantier", "invoice": "chantier", "credit_note": "classique",
--  "purchase_order": "classique"} (lib/pdf/theme.ts). Vide : « Classique »,
-- le rendu d'avant. Tant que la colonne manque, tous les PDF restent au modèle
-- Classique et le choix ne s'affiche pas dans les paramètres.
-- ============================================================

ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS document_templates JSONB NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.companies.document_templates IS
  'Modèle de mise en page par type de document (quote, invoice, credit_note, purchase_order) : classique, chantier, moderne, epure, prestige';
