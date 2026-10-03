-- ============================================================
-- Contrainte d'unicité sur la numérotation des documents
--
-- Contexte : audit de code du 2026-08-31 (voir CLAUDE.md / README.md,
-- section "Suivi des modifications"). Deux bugs corrigés côté application
-- pouvaient produire des numéros de facture/devis/avoir/bon de commande
-- dupliqués (tri texte cassant à 1000, double compteur facture directe vs
-- conversion de devis). Le code applicatif calcule maintenant le bon
-- numéro (lib/utils/document-numbering.ts), mais sans contrainte en base,
-- une course entre deux requêtes concurrentes (double-clic, deux onglets)
-- reste théoriquement possible.
--
-- Cette migration n'a PAS pu être appliquée depuis la session d'audit :
-- le projet Supabase réel de Qonforme n'était pas accessible depuis cet
-- environnement. Les tables companies/clients/invoices/quotes/credit_notes
-- ont par ailleurs été créées directement dans le dashboard Supabase et ne
-- sont pas versionnées ici (voir 20260314_fix_auth_user_trigger.sql) — à
-- appliquer manuellement via Supabase Dashboard → SQL Editor, en vérifiant
-- d'abord qu'aucun doublon n'existe déjà (la contrainte échouerait sinon) :
--
--   SELECT user_id, invoice_number, count(*) FROM invoices
--   GROUP BY user_id, invoice_number HAVING count(*) > 1;
--   (idem pour quote_number / credit_note_number / po_number)
-- ============================================================

-- Rejouable (03/10/2026) : chaque contrainte n'est ajoutée que si elle n'existe
-- pas encore ; 20261003_invoice_number_at_issue_and_reminders.sql pose aussi
-- celle des factures, l'ordre d'application n'a donc pas d'importance.
DO $$
DECLARE
  c RECORD;
BEGIN
  FOR c IN
    SELECT * FROM (VALUES
      ('invoices',        'invoices_user_id_invoice_number_key',          'invoice_number'),
      ('quotes',          'quotes_user_id_quote_number_key',              'quote_number'),
      ('credit_notes',    'credit_notes_user_id_credit_note_number_key',  'credit_note_number'),
      ('purchase_orders', 'purchase_orders_user_id_po_number_key',        'po_number')
    ) AS t(tbl, con, col)
  LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = c.con) THEN
      EXECUTE format('ALTER TABLE public.%I ADD CONSTRAINT %I UNIQUE (user_id, %I)', c.tbl, c.con, c.col);
    END IF;
  END LOOP;
END $$;
