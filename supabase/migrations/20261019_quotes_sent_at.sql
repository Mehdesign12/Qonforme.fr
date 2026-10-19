-- ============================================================
-- Date d'envoi des devis (colonne `sent_at`, absente de la table `quotes`)
--
-- À APPLIQUER : Supabase Dashboard → SQL Editor, ou `supabase db push`.
-- Idempotente : peut être rejouée. Aucune donnée existante n'est modifiée.
--
-- Constat du 19/10/2026 sur le site en ligne : la table `quotes` n'avait pas cette
-- colonne, que les factures et les bons de commande ont. Conséquences :
--   - un devis envoyé par email restait « Brouillon » après rechargement de la page
--     (la mise à jour du statut et de la date d'envoi échouait en bloc) ;
--   - la cloche « À surveiller » répondait 500 (elle lit `quotes.sent_at`) ;
--   - la page Relances ne pouvait pas lister les devis sans réponse.
-- Le code fonctionne aussi sans cette colonne (statut posé seul, cloche sur la date
-- d'émission) ; la colonne rend la date d'envoi exacte.
-- ============================================================

ALTER TABLE public.quotes
  ADD COLUMN IF NOT EXISTS sent_at TIMESTAMPTZ;

COMMENT ON COLUMN public.quotes.sent_at IS
  'Date du dernier envoi du devis au client (email). NULL : jamais envoyé, ou envoyé avant l''ajout de la colonne.';
