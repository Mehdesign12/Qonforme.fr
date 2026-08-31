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

ALTER TABLE invoices
  ADD CONSTRAINT invoices_user_id_invoice_number_key UNIQUE (user_id, invoice_number);

ALTER TABLE quotes
  ADD CONSTRAINT quotes_user_id_quote_number_key UNIQUE (user_id, quote_number);

ALTER TABLE credit_notes
  ADD CONSTRAINT credit_notes_user_id_credit_note_number_key UNIQUE (user_id, credit_note_number);

ALTER TABLE purchase_orders
  ADD CONSTRAINT purchase_orders_user_id_po_number_key UNIQUE (user_id, po_number);
