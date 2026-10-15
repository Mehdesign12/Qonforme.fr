-- Correction des erreurs juridiques dans 18 articles du blog (anciens seuils de TVA et de micro-entreprise,
-- seuil de devis de 150 € supprimé en 2017, promesses de « certification »).
-- À lancer dans Supabase › SQL Editor, en trois temps.

-- ═════════════════════════════════════════════════════════════
-- 1. VÉRIFICATION (ne modifie rien) : chaque ligne « requis » doit avoir au moins 1 occurrence.
--    Les lignes « optionnel » peuvent être à 0 (le chiffre n'est tout simplement pas dans l'article).
-- ═════════════════════════════════════════════════════════════
WITH regles(slug, motif, remplacement, type) AS (VALUES
  ('comptabilite-simplifiee-pour-artisan-en-2026-le-guide-essentiel-pour-une-gestion-cp7bj', '91[\s\u00a0\u202f]?900', '85 000', 'o'),
  ('comptabilite-simplifiee-pour-artisan-en-2026-le-guide-essentiel-pour-une-gestion-cp7bj', '36[\s\u00a0\u202f]?800', '37 500', 'o'),
  ('comptabilite-simplifiee-pour-artisan-en-2026-le-guide-essentiel-pour-une-gestion-cp7bj', '101[\s\u00a0\u202f]?000', '93 500', 'o'),
  ('comptabilite-simplifiee-pour-artisan-en-2026-le-guide-essentiel-pour-une-gestion-cp7bj', '39[\s\u00a0\u202f]?100', '41 250', 'o'),
  ('comptabilite-simplifiee-pour-artisan-en-2026-le-guide-essentiel-pour-une-gestion-cp7bj', '188[\s\u00a0\u202f]?700', '203 100', 'r'),
  ('comptabilite-simplifiee-pour-artisan-en-2026-le-guide-essentiel-pour-une-gestion-cp7bj', '77[\s\u00a0\u202f]?700', '83 600', 'o'),
  ('comptabilite-simplifiee-pour-artisan-en-2026-le-guide-essentiel-pour-une-gestion-cp7bj', 'prestations[\s\u00a0\u202f]+de[\s\u00a0\u202f]+services[\s\u00a0\u202f]+en[\s\u00a0\u202f]+20(23|24)', 'prestations de services', 'o'),
  ('facturation-auto-entrepreneur-artisan-7-erreurs-courantes-qui-coutent-cher-et-co-d6vju', '91[\s\u00a0\u202f]?900', '85 000', 'o'),
  ('facturation-auto-entrepreneur-artisan-7-erreurs-courantes-qui-coutent-cher-et-co-d6vju', '36[\s\u00a0\u202f]?800', '37 500', 'r'),
  ('facturation-auto-entrepreneur-artisan-7-erreurs-courantes-qui-coutent-cher-et-co-d6vju', '101[\s\u00a0\u202f]?000', '93 500', 'o'),
  ('facturation-auto-entrepreneur-artisan-7-erreurs-courantes-qui-coutent-cher-et-co-d6vju', '39[\s\u00a0\u202f]?100', '41 250', 'o'),
  ('facturation-auto-entrepreneur-artisan-7-erreurs-courantes-qui-coutent-cher-et-co-d6vju', '188[\s\u00a0\u202f]?700', '203 100', 'o'),
  ('facturation-auto-entrepreneur-artisan-7-erreurs-courantes-qui-coutent-cher-et-co-d6vju', '77[\s\u00a0\u202f]?700', '83 600', 'o'),
  ('facturation-auto-entrepreneur-artisan-7-erreurs-courantes-qui-coutent-cher-et-co-d6vju', 'prestations[\s\u00a0\u202f]+de[\s\u00a0\u202f]+services[\s\u00a0\u202f]+en[\s\u00a0\u202f]+20(23|24)', 'prestations de services', 'o'),
  ('facturation-pour-electricien-vos-questions-nos-reponses-pour-une-conformite-impe-cv7on', '91[\s\u00a0\u202f]?900', '85 000', 'o'),
  ('facturation-pour-electricien-vos-questions-nos-reponses-pour-une-conformite-impe-cv7on', '36[\s\u00a0\u202f]?800', '37 500', 'r'),
  ('facturation-pour-electricien-vos-questions-nos-reponses-pour-une-conformite-impe-cv7on', '101[\s\u00a0\u202f]?000', '93 500', 'o'),
  ('facturation-pour-electricien-vos-questions-nos-reponses-pour-une-conformite-impe-cv7on', '39[\s\u00a0\u202f]?100', '41 250', 'o'),
  ('facturation-pour-electricien-vos-questions-nos-reponses-pour-une-conformite-impe-cv7on', '188[\s\u00a0\u202f]?700', '203 100', 'o'),
  ('facturation-pour-electricien-vos-questions-nos-reponses-pour-une-conformite-impe-cv7on', '77[\s\u00a0\u202f]?700', '83 600', 'o'),
  ('facturation-pour-electricien-vos-questions-nos-reponses-pour-une-conformite-impe-cv7on', 'prestations[\s\u00a0\u202f]+de[\s\u00a0\u202f]+services[\s\u00a0\u202f]+en[\s\u00a0\u202f]+20(23|24)', 'prestations de services', 'o'),
  ('facturation-pour-electricien-vos-questions-nos-reponses-pour-une-conformite-impe-cy3go', '91[\s\u00a0\u202f]?900', '85 000', 'o'),
  ('facturation-pour-electricien-vos-questions-nos-reponses-pour-une-conformite-impe-cy3go', '36[\s\u00a0\u202f]?800', '37 500', 'r'),
  ('facturation-pour-electricien-vos-questions-nos-reponses-pour-une-conformite-impe-cy3go', '101[\s\u00a0\u202f]?000', '93 500', 'o'),
  ('facturation-pour-electricien-vos-questions-nos-reponses-pour-une-conformite-impe-cy3go', '39[\s\u00a0\u202f]?100', '41 250', 'o'),
  ('facturation-pour-electricien-vos-questions-nos-reponses-pour-une-conformite-impe-cy3go', '188[\s\u00a0\u202f]?700', '203 100', 'o'),
  ('facturation-pour-electricien-vos-questions-nos-reponses-pour-une-conformite-impe-cy3go', '77[\s\u00a0\u202f]?700', '83 600', 'o'),
  ('facturation-pour-electricien-vos-questions-nos-reponses-pour-une-conformite-impe-cy3go', 'prestations[\s\u00a0\u202f]+de[\s\u00a0\u202f]+services[\s\u00a0\u202f]+en[\s\u00a0\u202f]+20(23|24)', 'prestations de services', 'o'),
  ('tva-artisan-les-9-erreurs-fatales-a-eviter-taux-exonerations-mentions-d0xf4', '91[\s\u00a0\u202f]?900', '85 000', 'o'),
  ('tva-artisan-les-9-erreurs-fatales-a-eviter-taux-exonerations-mentions-d0xf4', '36[\s\u00a0\u202f]?800', '37 500', 'r'),
  ('tva-artisan-les-9-erreurs-fatales-a-eviter-taux-exonerations-mentions-d0xf4', '101[\s\u00a0\u202f]?000', '93 500', 'o'),
  ('tva-artisan-les-9-erreurs-fatales-a-eviter-taux-exonerations-mentions-d0xf4', '39[\s\u00a0\u202f]?100', '41 250', 'o'),
  ('tva-artisan-les-9-erreurs-fatales-a-eviter-taux-exonerations-mentions-d0xf4', '188[\s\u00a0\u202f]?700', '203 100', 'o'),
  ('tva-artisan-les-9-erreurs-fatales-a-eviter-taux-exonerations-mentions-d0xf4', '77[\s\u00a0\u202f]?700', '83 600', 'o'),
  ('tva-artisan-les-9-erreurs-fatales-a-eviter-taux-exonerations-mentions-d0xf4', 'prestations[\s\u00a0\u202f]+de[\s\u00a0\u202f]+services[\s\u00a0\u202f]+en[\s\u00a0\u202f]+20(23|24)', 'prestations de services', 'o'),
  ('facture-electricien-le-guide-pratique-etape-par-etape-pour-une-conformite-impecc-7qwbs', 'dépassant[\s\u00a0\u202f]+un[\s\u00a0\u202f]+certain[\s\u00a0\u202f]+montant[\s\u00a0\u202f]+\(généralement[\s\u00a0\u202f]+150[\s\u00a0\u202f]*€[\s\u00a0\u202f]+TTC\),[\s\u00a0\u202f]+ou[\s\u00a0\u202f]+si[\s\u00a0\u202f]+le[\s\u00a0\u202f]+client[\s\u00a0\u202f]+le[\s\u00a0\u202f]+demande,[\s\u00a0\u202f]+un[\s\u00a0\u202f]+devis[\s\u00a0\u202f]+écrit[\s\u00a0\u202f]+et[\s\u00a0\u202f]+détaillé[\s\u00a0\u202f]+est[\s\u00a0\u202f]+obligatoire', 'chez un particulier, un devis écrit et détaillé est obligatoire avant toute intervention, quel qu''en soit le montant', 'r'),
  ('facture-electricien-les-10-erreurs-courantes-qui-coutent-cher-et-comment-les-evi-i1nyj', 'dès[\s\u00a0\u202f]+que[\s\u00a0\u202f]+le[\s\u00a0\u202f]+montant[\s\u00a0\u202f]+estimé[\s\u00a0\u202f]+des[\s\u00a0\u202f]+travaux[\s\u00a0\u202f]+dépasse[\s\u00a0\u202f]+150[\s\u00a0\u202f]*€[\s\u00a0\u202f]+TTC,[\s\u00a0\u202f]+ou[\s\u00a0\u202f]+si[\s\u00a0\u202f]+le[\s\u00a0\u202f]+client[\s\u00a0\u202f]+en[\s\u00a0\u202f]+fait[\s\u00a0\u202f]+la[\s\u00a0\u202f]+demande', 'chez un particulier, avant toute intervention, quel qu''en soit le montant', 'r'),
  ('facture-electricien-les-10-erreurs-courantes-qui-coutent-cher-et-comment-les-evi-n6hgk', 'dès[\s\u00a0\u202f]+que[\s\u00a0\u202f]+le[\s\u00a0\u202f]+montant[\s\u00a0\u202f]+estimé[\s\u00a0\u202f]+des[\s\u00a0\u202f]+travaux[\s\u00a0\u202f]+dépasse[\s\u00a0\u202f]+150[\s\u00a0\u202f]*€[\s\u00a0\u202f]+TTC,[\s\u00a0\u202f]+ou[\s\u00a0\u202f]+si[\s\u00a0\u202f]+le[\s\u00a0\u202f]+client[\s\u00a0\u202f]+en[\s\u00a0\u202f]+fait[\s\u00a0\u202f]+la[\s\u00a0\u202f]+demande', 'chez un particulier, avant toute intervention, quel qu''en soit le montant', 'r'),
  ('configurer-ses-premieres-factures-electroniques-la-checklist-complete-pour-tpe-e-nfeh7', 'doit[\s\u00a0\u202f]+être[\s\u00a0\u202f]+certifié[\s\u00a0\u202f]+pour[\s\u00a0\u202f]+émettre[\s\u00a0\u202f]+des[\s\u00a0\u202f]+factures[\s\u00a0\u202f]+au[\s\u00a0\u202f]+format[\s\u00a0\u202f]+Factur-X', 'doit émettre des factures au format Factur-X', 'r'),
  ('creer-une-facture-factur-x-conforme-en-5-minutes-le-guide-ultime-pour-tpe-et-art-dq3db', 'Sélectionner[\s\u00a0\u202f]+un[\s\u00a0\u202f]+logiciel[\s\u00a0\u202f]+certifié[\s\u00a0\u202f]+et[\s\u00a0\u202f]+adapté[\s\u00a0\u202f]+à[\s\u00a0\u202f]+vos[\s\u00a0\u202f]+besoins', 'Sélectionner un logiciel adapté à vos besoins', 'r'),
  ('facturation-numerique-les-7-erreurs-fatales-des-artisans-et-tpe-et-comment-les-e-xkwpg', 'logiciel[\s\u00a0\u202f]+de[\s\u00a0\u202f]+facturation[\s\u00a0\u202f]+électronique[\s\u00a0\u202f]+certifié', 'logiciel de facturation électronique adapté', 'r'),
  ('facturation-numerique-les-7-erreurs-fatales-des-artisans-et-tpe-et-comment-les-e-xkwpg', 'une[\s\u00a0\u202f]+solution[\s\u00a0\u202f]+certifiée[\s\u00a0\u202f]+et[\s\u00a0\u202f]+pensée[\s\u00a0\u202f]+pour[\s\u00a0\u202f]+les[\s\u00a0\u202f]+artisans', 'une solution pensée pour les artisans', 'r'),
  ('facturation-pour-electricien-vos-questions-nos-reponses-pour-une-conformite-impe-cy3go', 'si[\s\u00a0\u202f]+le[\s\u00a0\u202f]+montant[\s\u00a0\u202f]+estimé[\s\u00a0\u202f]+dépasse[\s\u00a0\u202f]+un[\s\u00a0\u202f]+certain[\s\u00a0\u202f]+seuil[\s\u00a0\u202f]+\(généralement[\s\u00a0\u202f]+150[\s\u00a0\u202f]*€[\s\u00a0\u202f]+TTC\)[\s\u00a0\u202f]+ou[\s\u00a0\u202f]+si[\s\u00a0\u202f]+le[\s\u00a0\u202f]+client[\s\u00a0\u202f]+en[\s\u00a0\u202f]+fait[\s\u00a0\u202f]+la[\s\u00a0\u202f]+demande', 'chez un particulier, quel que soit le montant', 'r'),
  ('devis-et-factures-maitrisez-les-differences-juridiques-essentielles-pour-artisan-2vdr4', 'si[\s\u00a0\u202f]+le[\s\u00a0\u202f]+montant[\s\u00a0\u202f]+estimé[\s\u00a0\u202f]+dépasse[\s\u00a0\u202f]+un[\s\u00a0\u202f]+certain[\s\u00a0\u202f]+seuil[\s\u00a0\u202f]+\(généralement[\s\u00a0\u202f]+150[\s\u00a0\u202f]*€[\s\u00a0\u202f]+TTC,[\s\u00a0\u202f]+mais[\s\u00a0\u202f]+des[\s\u00a0\u202f]+règles[\s\u00a0\u202f]+spécifiques[\s\u00a0\u202f]+peuvent[\s\u00a0\u202f]+s[''’]appliquer[\s\u00a0\u202f]+selon[\s\u00a0\u202f]+le[\s\u00a0\u202f]+secteur\)', 'chez un particulier : dans le bâtiment, le devis est dû quel que soit le montant (arrêté du 24 janvier 2017)', 'r'),
  ('facture-electricien-les-mentions-indispensables-pour-une-conformite-sans-faille--2jg54', 'les[\s\u00a0\u202f]+prestations[\s\u00a0\u202f]+de[\s\u00a0\u202f]+services[\s\u00a0\u202f]+dont[\s\u00a0\u202f]+le[\s\u00a0\u202f]+prix[\s\u00a0\u202f]+dépasse[\s\u00a0\u202f]+un[\s\u00a0\u202f]+certain[\s\u00a0\u202f]+seuil[\s\u00a0\u202f]+\(généralement[\s\u00a0\u202f]+150[\s\u00a0\u202f]*€[\s\u00a0\u202f]+TTC[\s\u00a0\u202f]+pour[\s\u00a0\u202f]+les[\s\u00a0\u202f]+prestations[\s\u00a0\u202f]+de[\s\u00a0\u202f]+dépannage,[\s\u00a0\u202f]+de[\s\u00a0\u202f]+réparation[\s\u00a0\u202f]+et[\s\u00a0\u202f]+d[''’]entretien\),[\s\u00a0\u202f]+un[\s\u00a0\u202f]+devis[\s\u00a0\u202f]+détaillé[\s\u00a0\u202f]+est[\s\u00a0\u202f]+obligatoire\.[\s\u00a0\u202f]+Même[\s\u00a0\u202f]+pour[\s\u00a0\u202f]+des[\s\u00a0\u202f]+montants[\s\u00a0\u202f]+inférieurs,[\s\u00a0\u202f]+un[\s\u00a0\u202f]+devis[\s\u00a0\u202f]+est[\s\u00a0\u202f]+fortement[\s\u00a0\u202f]+recommandé', 'les prestations de dépannage, de réparation et d''entretien chez un particulier, un devis détaillé est obligatoire, quel qu''en soit le montant', 'r'),
  ('facture-electricien-les-mentions-indispensables-pour-une-conformite-sans-faille--hyotq', 'les[\s\u00a0\u202f]+prestations[\s\u00a0\u202f]+de[\s\u00a0\u202f]+services[\s\u00a0\u202f]+dont[\s\u00a0\u202f]+le[\s\u00a0\u202f]+prix[\s\u00a0\u202f]+dépasse[\s\u00a0\u202f]+un[\s\u00a0\u202f]+certain[\s\u00a0\u202f]+seuil[\s\u00a0\u202f]+\(généralement[\s\u00a0\u202f]+150[\s\u00a0\u202f]*€[\s\u00a0\u202f]+TTC[\s\u00a0\u202f]+pour[\s\u00a0\u202f]+les[\s\u00a0\u202f]+prestations[\s\u00a0\u202f]+de[\s\u00a0\u202f]+dépannage,[\s\u00a0\u202f]+de[\s\u00a0\u202f]+réparation[\s\u00a0\u202f]+et[\s\u00a0\u202f]+d[''’]entretien\),[\s\u00a0\u202f]+un[\s\u00a0\u202f]+devis[\s\u00a0\u202f]+détaillé[\s\u00a0\u202f]+est[\s\u00a0\u202f]+obligatoire\.[\s\u00a0\u202f]+Même[\s\u00a0\u202f]+pour[\s\u00a0\u202f]+des[\s\u00a0\u202f]+montants[\s\u00a0\u202f]+inférieurs,[\s\u00a0\u202f]+un[\s\u00a0\u202f]+devis[\s\u00a0\u202f]+est[\s\u00a0\u202f]+fortement[\s\u00a0\u202f]+recommandé', 'les prestations de dépannage, de réparation et d''entretien chez un particulier, un devis détaillé est obligatoire, quel qu''en soit le montant', 'r'),
  ('archivage-de-vos-factures-le-guide-pratique-pour-artisans-et-tpe-face-aux-obliga-88sil', 'Découvrez[\s\u00a0\u202f]+Qonforme[\s\u00a0\u202f]+et[\s\u00a0\u202f]+commencez[\s\u00a0\u202f]+votre[\s\u00a0\u202f]+essai[\s\u00a0\u202f]+gratuit[\s\u00a0\u202f]+dès[\s\u00a0\u202f]+maintenant', 'Découvrez Qonforme et commencez gratuitement avec les devis dès maintenant', 'r'),
  ('creer-une-facture-factur-x-conforme-en-5-minutes-le-guide-ultime-pour-tpe-et-art-dq3db', 'Un[\s\u00a0\u202f]+essai[\s\u00a0\u202f]+gratuit[\s\u00a0\u202f]+vous[\s\u00a0\u202f]+permettra[\s\u00a0\u202f]+de[\s\u00a0\u202f]+tester[\s\u00a0\u202f]+sa[\s\u00a0\u202f]+simplicité[\s\u00a0\u202f]+d[''’]utilisation[\s\u00a0\u202f]+et[\s\u00a0\u202f]+de[\s\u00a0\u202f]+vous[\s\u00a0\u202f]+assurer[\s\u00a0\u202f]+qu[''’]il[\s\u00a0\u202f]+répond[\s\u00a0\u202f]+parfaitement[\s\u00a0\u202f]+à[\s\u00a0\u202f]+vos[\s\u00a0\u202f]+attentes', 'Les devis gratuits et illimités vous permettent de tester sa simplicité d''utilisation et de vous assurer qu''il répond à vos attentes', 'r'),
  ('facturation-pour-electricien-mentions-specifiques-et-conformite-comparatif-artis-2lrtr', 'si[\s\u00a0\u202f]+le[\s\u00a0\u202f]+montant[\s\u00a0\u202f]+estimé[\s\u00a0\u202f]+dépasse[\s\u00a0\u202f]+un[\s\u00a0\u202f]+certain[\s\u00a0\u202f]+seuil[\s\u00a0\u202f]+\(souvent[\s\u00a0\u202f]+150[\s\u00a0\u202f]*€[\s\u00a0\u202f]+TTC,[\s\u00a0\u202f]+mais[\s\u00a0\u202f]+peut[\s\u00a0\u202f]+varier\)\.[\s\u00a0\u202f]+Il[\s\u00a0\u202f]+est[\s\u00a0\u202f]+également[\s\u00a0\u202f]+obligatoire[\s\u00a0\u202f]+si[\s\u00a0\u202f]+le[\s\u00a0\u202f]+client[\s\u00a0\u202f]+en[\s\u00a0\u202f]+fait[\s\u00a0\u202f]+la[\s\u00a0\u202f]+demande,[\s\u00a0\u202f]+quel[\s\u00a0\u202f]+que[\s\u00a0\u202f]+soit[\s\u00a0\u202f]+le[\s\u00a0\u202f]+montant', 'chez un particulier, quel qu''en soit le montant. Il est également obligatoire dès que le client en fait la demande', 'r'),
  ('facturation-pour-electricien-mentions-specifiques-et-conformite-comparatif-artis-sb1zk', 'si[\s\u00a0\u202f]+le[\s\u00a0\u202f]+montant[\s\u00a0\u202f]+estimé[\s\u00a0\u202f]+dépasse[\s\u00a0\u202f]+un[\s\u00a0\u202f]+certain[\s\u00a0\u202f]+seuil[\s\u00a0\u202f]+\(souvent[\s\u00a0\u202f]+150[\s\u00a0\u202f]*€[\s\u00a0\u202f]+TTC,[\s\u00a0\u202f]+mais[\s\u00a0\u202f]+peut[\s\u00a0\u202f]+varier\)\.[\s\u00a0\u202f]+Il[\s\u00a0\u202f]+est[\s\u00a0\u202f]+également[\s\u00a0\u202f]+obligatoire[\s\u00a0\u202f]+si[\s\u00a0\u202f]+le[\s\u00a0\u202f]+client[\s\u00a0\u202f]+en[\s\u00a0\u202f]+fait[\s\u00a0\u202f]+la[\s\u00a0\u202f]+demande,[\s\u00a0\u202f]+quel[\s\u00a0\u202f]+que[\s\u00a0\u202f]+soit[\s\u00a0\u202f]+le[\s\u00a0\u202f]+montant', 'chez un particulier, quel qu''en soit le montant. Il est également obligatoire dès que le client en fait la demande', 'r'),
  ('facture-electricien-le-calendrier-chronologique-des-mentions-specifiques-et-de-l-xf4k9', 'obligatoire[\s\u00a0\u202f]+pour[\s\u00a0\u202f]+toute[\s\u00a0\u202f]+prestation[\s\u00a0\u202f]+dont[\s\u00a0\u202f]+le[\s\u00a0\u202f]+montant[\s\u00a0\u202f]+estimé[\s\u00a0\u202f]+dépasse[\s\u00a0\u202f]+150[\s\u00a0\u202f]*€[\s\u00a0\u202f]+TTC,[\s\u00a0\u202f]+ou[\s\u00a0\u202f]+si[\s\u00a0\u202f]+le[\s\u00a0\u202f]+client[\s\u00a0\u202f]+en[\s\u00a0\u202f]+fait[\s\u00a0\u202f]+la[\s\u00a0\u202f]+demande,[\s\u00a0\u202f]+quelle[\s\u00a0\u202f]+que[\s\u00a0\u202f]+soit[\s\u00a0\u202f]+la[\s\u00a0\u202f]+somme', 'obligatoire pour toute prestation de dépannage, de réparation ou d''entretien chez un particulier, quel qu''en soit le montant, et dès que le client en fait la demande', 'r'),
  ('facture-electricien-les-mentions-indispensables-pour-une-conformite-sans-faille--2jg54', 'Non,[\s\u00a0\u202f]+pas[\s\u00a0\u202f]+pour[\s\u00a0\u202f]+toutes\.[\s\u00a0\u202f]+Un[\s\u00a0\u202f]+devis[\s\u00a0\u202f]+est[\s\u00a0\u202f]+obligatoire[\s\u00a0\u202f]+pour[\s\u00a0\u202f]+les[\s\u00a0\u202f]+prestations[\s\u00a0\u202f]+de[\s\u00a0\u202f]+dépannage,[\s\u00a0\u202f]+de[\s\u00a0\u202f]+réparation[\s\u00a0\u202f]+et[\s\u00a0\u202f]+d[''’]entretien[\s\u00a0\u202f]+dont[\s\u00a0\u202f]+le[\s\u00a0\u202f]+montant[\s\u00a0\u202f]+dépasse[\s\u00a0\u202f]+150[\s\u00a0\u202f]*€[\s\u00a0\u202f]+TTC\.[\s\u00a0\u202f]+Cependant,[\s\u00a0\u202f]+il[\s\u00a0\u202f]+est[\s\u00a0\u202f]+fortement[\s\u00a0\u202f]+recommandé[\s\u00a0\u202f]+d[''’]établir[\s\u00a0\u202f]+un[\s\u00a0\u202f]+devis[\s\u00a0\u202f]+pour[\s\u00a0\u202f]+toute[\s\u00a0\u202f]+intervention,[\s\u00a0\u202f]+quelle[\s\u00a0\u202f]+que[\s\u00a0\u202f]+soit[\s\u00a0\u202f]+sa[\s\u00a0\u202f]+valeur', 'Oui, chez un particulier. Un devis est obligatoire pour les prestations de dépannage, de réparation et d''entretien, quel qu''en soit le montant (arrêté du 24 janvier 2017). Il est de toute façon fortement recommandé d''en établir un pour toute intervention', 'r'),
  ('facture-electricien-les-mentions-indispensables-pour-une-conformite-sans-faille--hyotq', 'Non,[\s\u00a0\u202f]+pas[\s\u00a0\u202f]+pour[\s\u00a0\u202f]+toutes\.[\s\u00a0\u202f]+Un[\s\u00a0\u202f]+devis[\s\u00a0\u202f]+est[\s\u00a0\u202f]+obligatoire[\s\u00a0\u202f]+pour[\s\u00a0\u202f]+les[\s\u00a0\u202f]+prestations[\s\u00a0\u202f]+de[\s\u00a0\u202f]+dépannage,[\s\u00a0\u202f]+de[\s\u00a0\u202f]+réparation[\s\u00a0\u202f]+et[\s\u00a0\u202f]+d[''’]entretien[\s\u00a0\u202f]+dont[\s\u00a0\u202f]+le[\s\u00a0\u202f]+montant[\s\u00a0\u202f]+dépasse[\s\u00a0\u202f]+150[\s\u00a0\u202f]*€[\s\u00a0\u202f]+TTC\.[\s\u00a0\u202f]+Cependant,[\s\u00a0\u202f]+il[\s\u00a0\u202f]+est[\s\u00a0\u202f]+fortement[\s\u00a0\u202f]+recommandé[\s\u00a0\u202f]+d[''’]établir[\s\u00a0\u202f]+un[\s\u00a0\u202f]+devis[\s\u00a0\u202f]+pour[\s\u00a0\u202f]+toute[\s\u00a0\u202f]+intervention,[\s\u00a0\u202f]+quelle[\s\u00a0\u202f]+que[\s\u00a0\u202f]+soit[\s\u00a0\u202f]+sa[\s\u00a0\u202f]+valeur', 'Oui, chez un particulier. Un devis est obligatoire pour les prestations de dépannage, de réparation et d''entretien, quel qu''en soit le montant (arrêté du 24 janvier 2017). Il est de toute façon fortement recommandé d''en établir un pour toute intervention', 'r')
)
SELECT left(r.slug, 45) AS article,
       CASE r.type WHEN 'r' THEN 'requis' ELSE 'optionnel' END AS type,
       left(r.motif, 40) AS motif,
       r.remplacement AS devient,
       CASE WHEN p.id IS NULL THEN -1
            ELSE (SELECT count(*) FROM regexp_matches(p.content, r.motif, 'g')) END AS occurrences  -- -1 = article introuvable
FROM regles r
LEFT JOIN public.blog_posts p ON p.slug = r.slug
ORDER BY r.slug, r.type DESC, r.motif;

-- ═════════════════════════════════════════════════════════════
-- 2. SAUVEGARDE de l'état actuel des 18 articles (à lancer avant l'étape 3)
--    Pour revenir en arrière : UPDATE public.blog_posts b SET content = s.content
--                              FROM public.blog_posts_sauvegarde_20261015 s WHERE s.id = b.id;
-- ═════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.blog_posts_sauvegarde_20261015 AS
SELECT id, slug, content, now() AS sauvegarde_le
FROM public.blog_posts
WHERE slug IN (
    'comptabilite-simplifiee-pour-artisan-en-2026-le-guide-essentiel-pour-une-gestion-cp7bj',
    'configurer-ses-premieres-factures-electroniques-la-checklist-complete-pour-tpe-e-nfeh7',
    'creer-une-facture-factur-x-conforme-en-5-minutes-le-guide-ultime-pour-tpe-et-art-dq3db',
    'facturation-auto-entrepreneur-artisan-7-erreurs-courantes-qui-coutent-cher-et-co-d6vju',
    'facturation-numerique-les-7-erreurs-fatales-des-artisans-et-tpe-et-comment-les-e-xkwpg',
    'facturation-pour-electricien-vos-questions-nos-reponses-pour-une-conformite-impe-cv7on',
    'facturation-pour-electricien-vos-questions-nos-reponses-pour-une-conformite-impe-cy3go',
    'facture-electricien-le-guide-pratique-etape-par-etape-pour-une-conformite-impecc-7qwbs',
    'facture-electricien-les-10-erreurs-courantes-qui-coutent-cher-et-comment-les-evi-i1nyj',
    'facture-electricien-les-10-erreurs-courantes-qui-coutent-cher-et-comment-les-evi-n6hgk',
    'tva-artisan-les-9-erreurs-fatales-a-eviter-taux-exonerations-mentions-d0xf4',
    'devis-et-factures-maitrisez-les-differences-juridiques-essentielles-pour-artisan-2vdr4',
    'facture-electricien-les-mentions-indispensables-pour-une-conformite-sans-faille--2jg54',
    'facture-electricien-les-mentions-indispensables-pour-une-conformite-sans-faille--hyotq',
    'archivage-de-vos-factures-le-guide-pratique-pour-artisans-et-tpe-face-aux-obliga-88sil',
    'facturation-pour-electricien-mentions-specifiques-et-conformite-comparatif-artis-2lrtr',
    'facturation-pour-electricien-mentions-specifiques-et-conformite-comparatif-artis-sb1zk',
    'facture-electricien-le-calendrier-chronologique-des-mentions-specifiques-et-de-l-xf4k9'
);
-- Table interne : fermée à l'API publique, comme les autres tables sensibles du projet.
ALTER TABLE public.blog_posts_sauvegarde_20261015 ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.blog_posts_sauvegarde_20261015 FROM anon, authenticated;

-- ═════════════════════════════════════════════════════════════
-- 3. CORRECTION. Tout ou rien : si une règle « requise » ne trouve pas son passage,
--    rien n'est modifié et le message dit lequel (cet article est alors à corriger à la main).
-- ═════════════════════════════════════════════════════════════
DO $correction$
DECLARE
  regles text[] := ARRAY[
  ARRAY['comptabilite-simplifiee-pour-artisan-en-2026-le-guide-essentiel-pour-une-gestion-cp7bj', '91[\s\u00a0\u202f]?900', '85 000', 'o'],
  ARRAY['comptabilite-simplifiee-pour-artisan-en-2026-le-guide-essentiel-pour-une-gestion-cp7bj', '36[\s\u00a0\u202f]?800', '37 500', 'o'],
  ARRAY['comptabilite-simplifiee-pour-artisan-en-2026-le-guide-essentiel-pour-une-gestion-cp7bj', '101[\s\u00a0\u202f]?000', '93 500', 'o'],
  ARRAY['comptabilite-simplifiee-pour-artisan-en-2026-le-guide-essentiel-pour-une-gestion-cp7bj', '39[\s\u00a0\u202f]?100', '41 250', 'o'],
  ARRAY['comptabilite-simplifiee-pour-artisan-en-2026-le-guide-essentiel-pour-une-gestion-cp7bj', '188[\s\u00a0\u202f]?700', '203 100', 'r'],
  ARRAY['comptabilite-simplifiee-pour-artisan-en-2026-le-guide-essentiel-pour-une-gestion-cp7bj', '77[\s\u00a0\u202f]?700', '83 600', 'o'],
  ARRAY['comptabilite-simplifiee-pour-artisan-en-2026-le-guide-essentiel-pour-une-gestion-cp7bj', 'prestations[\s\u00a0\u202f]+de[\s\u00a0\u202f]+services[\s\u00a0\u202f]+en[\s\u00a0\u202f]+20(23|24)', 'prestations de services', 'o'],
  ARRAY['facturation-auto-entrepreneur-artisan-7-erreurs-courantes-qui-coutent-cher-et-co-d6vju', '91[\s\u00a0\u202f]?900', '85 000', 'o'],
  ARRAY['facturation-auto-entrepreneur-artisan-7-erreurs-courantes-qui-coutent-cher-et-co-d6vju', '36[\s\u00a0\u202f]?800', '37 500', 'r'],
  ARRAY['facturation-auto-entrepreneur-artisan-7-erreurs-courantes-qui-coutent-cher-et-co-d6vju', '101[\s\u00a0\u202f]?000', '93 500', 'o'],
  ARRAY['facturation-auto-entrepreneur-artisan-7-erreurs-courantes-qui-coutent-cher-et-co-d6vju', '39[\s\u00a0\u202f]?100', '41 250', 'o'],
  ARRAY['facturation-auto-entrepreneur-artisan-7-erreurs-courantes-qui-coutent-cher-et-co-d6vju', '188[\s\u00a0\u202f]?700', '203 100', 'o'],
  ARRAY['facturation-auto-entrepreneur-artisan-7-erreurs-courantes-qui-coutent-cher-et-co-d6vju', '77[\s\u00a0\u202f]?700', '83 600', 'o'],
  ARRAY['facturation-auto-entrepreneur-artisan-7-erreurs-courantes-qui-coutent-cher-et-co-d6vju', 'prestations[\s\u00a0\u202f]+de[\s\u00a0\u202f]+services[\s\u00a0\u202f]+en[\s\u00a0\u202f]+20(23|24)', 'prestations de services', 'o'],
  ARRAY['facturation-pour-electricien-vos-questions-nos-reponses-pour-une-conformite-impe-cv7on', '91[\s\u00a0\u202f]?900', '85 000', 'o'],
  ARRAY['facturation-pour-electricien-vos-questions-nos-reponses-pour-une-conformite-impe-cv7on', '36[\s\u00a0\u202f]?800', '37 500', 'r'],
  ARRAY['facturation-pour-electricien-vos-questions-nos-reponses-pour-une-conformite-impe-cv7on', '101[\s\u00a0\u202f]?000', '93 500', 'o'],
  ARRAY['facturation-pour-electricien-vos-questions-nos-reponses-pour-une-conformite-impe-cv7on', '39[\s\u00a0\u202f]?100', '41 250', 'o'],
  ARRAY['facturation-pour-electricien-vos-questions-nos-reponses-pour-une-conformite-impe-cv7on', '188[\s\u00a0\u202f]?700', '203 100', 'o'],
  ARRAY['facturation-pour-electricien-vos-questions-nos-reponses-pour-une-conformite-impe-cv7on', '77[\s\u00a0\u202f]?700', '83 600', 'o'],
  ARRAY['facturation-pour-electricien-vos-questions-nos-reponses-pour-une-conformite-impe-cv7on', 'prestations[\s\u00a0\u202f]+de[\s\u00a0\u202f]+services[\s\u00a0\u202f]+en[\s\u00a0\u202f]+20(23|24)', 'prestations de services', 'o'],
  ARRAY['facturation-pour-electricien-vos-questions-nos-reponses-pour-une-conformite-impe-cy3go', '91[\s\u00a0\u202f]?900', '85 000', 'o'],
  ARRAY['facturation-pour-electricien-vos-questions-nos-reponses-pour-une-conformite-impe-cy3go', '36[\s\u00a0\u202f]?800', '37 500', 'r'],
  ARRAY['facturation-pour-electricien-vos-questions-nos-reponses-pour-une-conformite-impe-cy3go', '101[\s\u00a0\u202f]?000', '93 500', 'o'],
  ARRAY['facturation-pour-electricien-vos-questions-nos-reponses-pour-une-conformite-impe-cy3go', '39[\s\u00a0\u202f]?100', '41 250', 'o'],
  ARRAY['facturation-pour-electricien-vos-questions-nos-reponses-pour-une-conformite-impe-cy3go', '188[\s\u00a0\u202f]?700', '203 100', 'o'],
  ARRAY['facturation-pour-electricien-vos-questions-nos-reponses-pour-une-conformite-impe-cy3go', '77[\s\u00a0\u202f]?700', '83 600', 'o'],
  ARRAY['facturation-pour-electricien-vos-questions-nos-reponses-pour-une-conformite-impe-cy3go', 'prestations[\s\u00a0\u202f]+de[\s\u00a0\u202f]+services[\s\u00a0\u202f]+en[\s\u00a0\u202f]+20(23|24)', 'prestations de services', 'o'],
  ARRAY['tva-artisan-les-9-erreurs-fatales-a-eviter-taux-exonerations-mentions-d0xf4', '91[\s\u00a0\u202f]?900', '85 000', 'o'],
  ARRAY['tva-artisan-les-9-erreurs-fatales-a-eviter-taux-exonerations-mentions-d0xf4', '36[\s\u00a0\u202f]?800', '37 500', 'r'],
  ARRAY['tva-artisan-les-9-erreurs-fatales-a-eviter-taux-exonerations-mentions-d0xf4', '101[\s\u00a0\u202f]?000', '93 500', 'o'],
  ARRAY['tva-artisan-les-9-erreurs-fatales-a-eviter-taux-exonerations-mentions-d0xf4', '39[\s\u00a0\u202f]?100', '41 250', 'o'],
  ARRAY['tva-artisan-les-9-erreurs-fatales-a-eviter-taux-exonerations-mentions-d0xf4', '188[\s\u00a0\u202f]?700', '203 100', 'o'],
  ARRAY['tva-artisan-les-9-erreurs-fatales-a-eviter-taux-exonerations-mentions-d0xf4', '77[\s\u00a0\u202f]?700', '83 600', 'o'],
  ARRAY['tva-artisan-les-9-erreurs-fatales-a-eviter-taux-exonerations-mentions-d0xf4', 'prestations[\s\u00a0\u202f]+de[\s\u00a0\u202f]+services[\s\u00a0\u202f]+en[\s\u00a0\u202f]+20(23|24)', 'prestations de services', 'o'],
  ARRAY['facture-electricien-le-guide-pratique-etape-par-etape-pour-une-conformite-impecc-7qwbs', 'dépassant[\s\u00a0\u202f]+un[\s\u00a0\u202f]+certain[\s\u00a0\u202f]+montant[\s\u00a0\u202f]+\(généralement[\s\u00a0\u202f]+150[\s\u00a0\u202f]*€[\s\u00a0\u202f]+TTC\),[\s\u00a0\u202f]+ou[\s\u00a0\u202f]+si[\s\u00a0\u202f]+le[\s\u00a0\u202f]+client[\s\u00a0\u202f]+le[\s\u00a0\u202f]+demande,[\s\u00a0\u202f]+un[\s\u00a0\u202f]+devis[\s\u00a0\u202f]+écrit[\s\u00a0\u202f]+et[\s\u00a0\u202f]+détaillé[\s\u00a0\u202f]+est[\s\u00a0\u202f]+obligatoire', 'chez un particulier, un devis écrit et détaillé est obligatoire avant toute intervention, quel qu''en soit le montant', 'r'],
  ARRAY['facture-electricien-les-10-erreurs-courantes-qui-coutent-cher-et-comment-les-evi-i1nyj', 'dès[\s\u00a0\u202f]+que[\s\u00a0\u202f]+le[\s\u00a0\u202f]+montant[\s\u00a0\u202f]+estimé[\s\u00a0\u202f]+des[\s\u00a0\u202f]+travaux[\s\u00a0\u202f]+dépasse[\s\u00a0\u202f]+150[\s\u00a0\u202f]*€[\s\u00a0\u202f]+TTC,[\s\u00a0\u202f]+ou[\s\u00a0\u202f]+si[\s\u00a0\u202f]+le[\s\u00a0\u202f]+client[\s\u00a0\u202f]+en[\s\u00a0\u202f]+fait[\s\u00a0\u202f]+la[\s\u00a0\u202f]+demande', 'chez un particulier, avant toute intervention, quel qu''en soit le montant', 'r'],
  ARRAY['facture-electricien-les-10-erreurs-courantes-qui-coutent-cher-et-comment-les-evi-n6hgk', 'dès[\s\u00a0\u202f]+que[\s\u00a0\u202f]+le[\s\u00a0\u202f]+montant[\s\u00a0\u202f]+estimé[\s\u00a0\u202f]+des[\s\u00a0\u202f]+travaux[\s\u00a0\u202f]+dépasse[\s\u00a0\u202f]+150[\s\u00a0\u202f]*€[\s\u00a0\u202f]+TTC,[\s\u00a0\u202f]+ou[\s\u00a0\u202f]+si[\s\u00a0\u202f]+le[\s\u00a0\u202f]+client[\s\u00a0\u202f]+en[\s\u00a0\u202f]+fait[\s\u00a0\u202f]+la[\s\u00a0\u202f]+demande', 'chez un particulier, avant toute intervention, quel qu''en soit le montant', 'r'],
  ARRAY['configurer-ses-premieres-factures-electroniques-la-checklist-complete-pour-tpe-e-nfeh7', 'doit[\s\u00a0\u202f]+être[\s\u00a0\u202f]+certifié[\s\u00a0\u202f]+pour[\s\u00a0\u202f]+émettre[\s\u00a0\u202f]+des[\s\u00a0\u202f]+factures[\s\u00a0\u202f]+au[\s\u00a0\u202f]+format[\s\u00a0\u202f]+Factur-X', 'doit émettre des factures au format Factur-X', 'r'],
  ARRAY['creer-une-facture-factur-x-conforme-en-5-minutes-le-guide-ultime-pour-tpe-et-art-dq3db', 'Sélectionner[\s\u00a0\u202f]+un[\s\u00a0\u202f]+logiciel[\s\u00a0\u202f]+certifié[\s\u00a0\u202f]+et[\s\u00a0\u202f]+adapté[\s\u00a0\u202f]+à[\s\u00a0\u202f]+vos[\s\u00a0\u202f]+besoins', 'Sélectionner un logiciel adapté à vos besoins', 'r'],
  ARRAY['facturation-numerique-les-7-erreurs-fatales-des-artisans-et-tpe-et-comment-les-e-xkwpg', 'logiciel[\s\u00a0\u202f]+de[\s\u00a0\u202f]+facturation[\s\u00a0\u202f]+électronique[\s\u00a0\u202f]+certifié', 'logiciel de facturation électronique adapté', 'r'],
  ARRAY['facturation-numerique-les-7-erreurs-fatales-des-artisans-et-tpe-et-comment-les-e-xkwpg', 'une[\s\u00a0\u202f]+solution[\s\u00a0\u202f]+certifiée[\s\u00a0\u202f]+et[\s\u00a0\u202f]+pensée[\s\u00a0\u202f]+pour[\s\u00a0\u202f]+les[\s\u00a0\u202f]+artisans', 'une solution pensée pour les artisans', 'r'],
  ARRAY['facturation-pour-electricien-vos-questions-nos-reponses-pour-une-conformite-impe-cy3go', 'si[\s\u00a0\u202f]+le[\s\u00a0\u202f]+montant[\s\u00a0\u202f]+estimé[\s\u00a0\u202f]+dépasse[\s\u00a0\u202f]+un[\s\u00a0\u202f]+certain[\s\u00a0\u202f]+seuil[\s\u00a0\u202f]+\(généralement[\s\u00a0\u202f]+150[\s\u00a0\u202f]*€[\s\u00a0\u202f]+TTC\)[\s\u00a0\u202f]+ou[\s\u00a0\u202f]+si[\s\u00a0\u202f]+le[\s\u00a0\u202f]+client[\s\u00a0\u202f]+en[\s\u00a0\u202f]+fait[\s\u00a0\u202f]+la[\s\u00a0\u202f]+demande', 'chez un particulier, quel que soit le montant', 'r'],
  ARRAY['devis-et-factures-maitrisez-les-differences-juridiques-essentielles-pour-artisan-2vdr4', 'si[\s\u00a0\u202f]+le[\s\u00a0\u202f]+montant[\s\u00a0\u202f]+estimé[\s\u00a0\u202f]+dépasse[\s\u00a0\u202f]+un[\s\u00a0\u202f]+certain[\s\u00a0\u202f]+seuil[\s\u00a0\u202f]+\(généralement[\s\u00a0\u202f]+150[\s\u00a0\u202f]*€[\s\u00a0\u202f]+TTC,[\s\u00a0\u202f]+mais[\s\u00a0\u202f]+des[\s\u00a0\u202f]+règles[\s\u00a0\u202f]+spécifiques[\s\u00a0\u202f]+peuvent[\s\u00a0\u202f]+s[''’]appliquer[\s\u00a0\u202f]+selon[\s\u00a0\u202f]+le[\s\u00a0\u202f]+secteur\)', 'chez un particulier : dans le bâtiment, le devis est dû quel que soit le montant (arrêté du 24 janvier 2017)', 'r'],
  ARRAY['facture-electricien-les-mentions-indispensables-pour-une-conformite-sans-faille--2jg54', 'les[\s\u00a0\u202f]+prestations[\s\u00a0\u202f]+de[\s\u00a0\u202f]+services[\s\u00a0\u202f]+dont[\s\u00a0\u202f]+le[\s\u00a0\u202f]+prix[\s\u00a0\u202f]+dépasse[\s\u00a0\u202f]+un[\s\u00a0\u202f]+certain[\s\u00a0\u202f]+seuil[\s\u00a0\u202f]+\(généralement[\s\u00a0\u202f]+150[\s\u00a0\u202f]*€[\s\u00a0\u202f]+TTC[\s\u00a0\u202f]+pour[\s\u00a0\u202f]+les[\s\u00a0\u202f]+prestations[\s\u00a0\u202f]+de[\s\u00a0\u202f]+dépannage,[\s\u00a0\u202f]+de[\s\u00a0\u202f]+réparation[\s\u00a0\u202f]+et[\s\u00a0\u202f]+d[''’]entretien\),[\s\u00a0\u202f]+un[\s\u00a0\u202f]+devis[\s\u00a0\u202f]+détaillé[\s\u00a0\u202f]+est[\s\u00a0\u202f]+obligatoire\.[\s\u00a0\u202f]+Même[\s\u00a0\u202f]+pour[\s\u00a0\u202f]+des[\s\u00a0\u202f]+montants[\s\u00a0\u202f]+inférieurs,[\s\u00a0\u202f]+un[\s\u00a0\u202f]+devis[\s\u00a0\u202f]+est[\s\u00a0\u202f]+fortement[\s\u00a0\u202f]+recommandé', 'les prestations de dépannage, de réparation et d''entretien chez un particulier, un devis détaillé est obligatoire, quel qu''en soit le montant', 'r'],
  ARRAY['facture-electricien-les-mentions-indispensables-pour-une-conformite-sans-faille--hyotq', 'les[\s\u00a0\u202f]+prestations[\s\u00a0\u202f]+de[\s\u00a0\u202f]+services[\s\u00a0\u202f]+dont[\s\u00a0\u202f]+le[\s\u00a0\u202f]+prix[\s\u00a0\u202f]+dépasse[\s\u00a0\u202f]+un[\s\u00a0\u202f]+certain[\s\u00a0\u202f]+seuil[\s\u00a0\u202f]+\(généralement[\s\u00a0\u202f]+150[\s\u00a0\u202f]*€[\s\u00a0\u202f]+TTC[\s\u00a0\u202f]+pour[\s\u00a0\u202f]+les[\s\u00a0\u202f]+prestations[\s\u00a0\u202f]+de[\s\u00a0\u202f]+dépannage,[\s\u00a0\u202f]+de[\s\u00a0\u202f]+réparation[\s\u00a0\u202f]+et[\s\u00a0\u202f]+d[''’]entretien\),[\s\u00a0\u202f]+un[\s\u00a0\u202f]+devis[\s\u00a0\u202f]+détaillé[\s\u00a0\u202f]+est[\s\u00a0\u202f]+obligatoire\.[\s\u00a0\u202f]+Même[\s\u00a0\u202f]+pour[\s\u00a0\u202f]+des[\s\u00a0\u202f]+montants[\s\u00a0\u202f]+inférieurs,[\s\u00a0\u202f]+un[\s\u00a0\u202f]+devis[\s\u00a0\u202f]+est[\s\u00a0\u202f]+fortement[\s\u00a0\u202f]+recommandé', 'les prestations de dépannage, de réparation et d''entretien chez un particulier, un devis détaillé est obligatoire, quel qu''en soit le montant', 'r'],
  ARRAY['archivage-de-vos-factures-le-guide-pratique-pour-artisans-et-tpe-face-aux-obliga-88sil', 'Découvrez[\s\u00a0\u202f]+Qonforme[\s\u00a0\u202f]+et[\s\u00a0\u202f]+commencez[\s\u00a0\u202f]+votre[\s\u00a0\u202f]+essai[\s\u00a0\u202f]+gratuit[\s\u00a0\u202f]+dès[\s\u00a0\u202f]+maintenant', 'Découvrez Qonforme et commencez gratuitement avec les devis dès maintenant', 'r'],
  ARRAY['creer-une-facture-factur-x-conforme-en-5-minutes-le-guide-ultime-pour-tpe-et-art-dq3db', 'Un[\s\u00a0\u202f]+essai[\s\u00a0\u202f]+gratuit[\s\u00a0\u202f]+vous[\s\u00a0\u202f]+permettra[\s\u00a0\u202f]+de[\s\u00a0\u202f]+tester[\s\u00a0\u202f]+sa[\s\u00a0\u202f]+simplicité[\s\u00a0\u202f]+d[''’]utilisation[\s\u00a0\u202f]+et[\s\u00a0\u202f]+de[\s\u00a0\u202f]+vous[\s\u00a0\u202f]+assurer[\s\u00a0\u202f]+qu[''’]il[\s\u00a0\u202f]+répond[\s\u00a0\u202f]+parfaitement[\s\u00a0\u202f]+à[\s\u00a0\u202f]+vos[\s\u00a0\u202f]+attentes', 'Les devis gratuits et illimités vous permettent de tester sa simplicité d''utilisation et de vous assurer qu''il répond à vos attentes', 'r'],
  ARRAY['facturation-pour-electricien-mentions-specifiques-et-conformite-comparatif-artis-2lrtr', 'si[\s\u00a0\u202f]+le[\s\u00a0\u202f]+montant[\s\u00a0\u202f]+estimé[\s\u00a0\u202f]+dépasse[\s\u00a0\u202f]+un[\s\u00a0\u202f]+certain[\s\u00a0\u202f]+seuil[\s\u00a0\u202f]+\(souvent[\s\u00a0\u202f]+150[\s\u00a0\u202f]*€[\s\u00a0\u202f]+TTC,[\s\u00a0\u202f]+mais[\s\u00a0\u202f]+peut[\s\u00a0\u202f]+varier\)\.[\s\u00a0\u202f]+Il[\s\u00a0\u202f]+est[\s\u00a0\u202f]+également[\s\u00a0\u202f]+obligatoire[\s\u00a0\u202f]+si[\s\u00a0\u202f]+le[\s\u00a0\u202f]+client[\s\u00a0\u202f]+en[\s\u00a0\u202f]+fait[\s\u00a0\u202f]+la[\s\u00a0\u202f]+demande,[\s\u00a0\u202f]+quel[\s\u00a0\u202f]+que[\s\u00a0\u202f]+soit[\s\u00a0\u202f]+le[\s\u00a0\u202f]+montant', 'chez un particulier, quel qu''en soit le montant. Il est également obligatoire dès que le client en fait la demande', 'r'],
  ARRAY['facturation-pour-electricien-mentions-specifiques-et-conformite-comparatif-artis-sb1zk', 'si[\s\u00a0\u202f]+le[\s\u00a0\u202f]+montant[\s\u00a0\u202f]+estimé[\s\u00a0\u202f]+dépasse[\s\u00a0\u202f]+un[\s\u00a0\u202f]+certain[\s\u00a0\u202f]+seuil[\s\u00a0\u202f]+\(souvent[\s\u00a0\u202f]+150[\s\u00a0\u202f]*€[\s\u00a0\u202f]+TTC,[\s\u00a0\u202f]+mais[\s\u00a0\u202f]+peut[\s\u00a0\u202f]+varier\)\.[\s\u00a0\u202f]+Il[\s\u00a0\u202f]+est[\s\u00a0\u202f]+également[\s\u00a0\u202f]+obligatoire[\s\u00a0\u202f]+si[\s\u00a0\u202f]+le[\s\u00a0\u202f]+client[\s\u00a0\u202f]+en[\s\u00a0\u202f]+fait[\s\u00a0\u202f]+la[\s\u00a0\u202f]+demande,[\s\u00a0\u202f]+quel[\s\u00a0\u202f]+que[\s\u00a0\u202f]+soit[\s\u00a0\u202f]+le[\s\u00a0\u202f]+montant', 'chez un particulier, quel qu''en soit le montant. Il est également obligatoire dès que le client en fait la demande', 'r'],
  ARRAY['facture-electricien-le-calendrier-chronologique-des-mentions-specifiques-et-de-l-xf4k9', 'obligatoire[\s\u00a0\u202f]+pour[\s\u00a0\u202f]+toute[\s\u00a0\u202f]+prestation[\s\u00a0\u202f]+dont[\s\u00a0\u202f]+le[\s\u00a0\u202f]+montant[\s\u00a0\u202f]+estimé[\s\u00a0\u202f]+dépasse[\s\u00a0\u202f]+150[\s\u00a0\u202f]*€[\s\u00a0\u202f]+TTC,[\s\u00a0\u202f]+ou[\s\u00a0\u202f]+si[\s\u00a0\u202f]+le[\s\u00a0\u202f]+client[\s\u00a0\u202f]+en[\s\u00a0\u202f]+fait[\s\u00a0\u202f]+la[\s\u00a0\u202f]+demande,[\s\u00a0\u202f]+quelle[\s\u00a0\u202f]+que[\s\u00a0\u202f]+soit[\s\u00a0\u202f]+la[\s\u00a0\u202f]+somme', 'obligatoire pour toute prestation de dépannage, de réparation ou d''entretien chez un particulier, quel qu''en soit le montant, et dès que le client en fait la demande', 'r'],
  ARRAY['facture-electricien-les-mentions-indispensables-pour-une-conformite-sans-faille--2jg54', 'Non,[\s\u00a0\u202f]+pas[\s\u00a0\u202f]+pour[\s\u00a0\u202f]+toutes\.[\s\u00a0\u202f]+Un[\s\u00a0\u202f]+devis[\s\u00a0\u202f]+est[\s\u00a0\u202f]+obligatoire[\s\u00a0\u202f]+pour[\s\u00a0\u202f]+les[\s\u00a0\u202f]+prestations[\s\u00a0\u202f]+de[\s\u00a0\u202f]+dépannage,[\s\u00a0\u202f]+de[\s\u00a0\u202f]+réparation[\s\u00a0\u202f]+et[\s\u00a0\u202f]+d[''’]entretien[\s\u00a0\u202f]+dont[\s\u00a0\u202f]+le[\s\u00a0\u202f]+montant[\s\u00a0\u202f]+dépasse[\s\u00a0\u202f]+150[\s\u00a0\u202f]*€[\s\u00a0\u202f]+TTC\.[\s\u00a0\u202f]+Cependant,[\s\u00a0\u202f]+il[\s\u00a0\u202f]+est[\s\u00a0\u202f]+fortement[\s\u00a0\u202f]+recommandé[\s\u00a0\u202f]+d[''’]établir[\s\u00a0\u202f]+un[\s\u00a0\u202f]+devis[\s\u00a0\u202f]+pour[\s\u00a0\u202f]+toute[\s\u00a0\u202f]+intervention,[\s\u00a0\u202f]+quelle[\s\u00a0\u202f]+que[\s\u00a0\u202f]+soit[\s\u00a0\u202f]+sa[\s\u00a0\u202f]+valeur', 'Oui, chez un particulier. Un devis est obligatoire pour les prestations de dépannage, de réparation et d''entretien, quel qu''en soit le montant (arrêté du 24 janvier 2017). Il est de toute façon fortement recommandé d''en établir un pour toute intervention', 'r'],
  ARRAY['facture-electricien-les-mentions-indispensables-pour-une-conformite-sans-faille--hyotq', 'Non,[\s\u00a0\u202f]+pas[\s\u00a0\u202f]+pour[\s\u00a0\u202f]+toutes\.[\s\u00a0\u202f]+Un[\s\u00a0\u202f]+devis[\s\u00a0\u202f]+est[\s\u00a0\u202f]+obligatoire[\s\u00a0\u202f]+pour[\s\u00a0\u202f]+les[\s\u00a0\u202f]+prestations[\s\u00a0\u202f]+de[\s\u00a0\u202f]+dépannage,[\s\u00a0\u202f]+de[\s\u00a0\u202f]+réparation[\s\u00a0\u202f]+et[\s\u00a0\u202f]+d[''’]entretien[\s\u00a0\u202f]+dont[\s\u00a0\u202f]+le[\s\u00a0\u202f]+montant[\s\u00a0\u202f]+dépasse[\s\u00a0\u202f]+150[\s\u00a0\u202f]*€[\s\u00a0\u202f]+TTC\.[\s\u00a0\u202f]+Cependant,[\s\u00a0\u202f]+il[\s\u00a0\u202f]+est[\s\u00a0\u202f]+fortement[\s\u00a0\u202f]+recommandé[\s\u00a0\u202f]+d[''’]établir[\s\u00a0\u202f]+un[\s\u00a0\u202f]+devis[\s\u00a0\u202f]+pour[\s\u00a0\u202f]+toute[\s\u00a0\u202f]+intervention,[\s\u00a0\u202f]+quelle[\s\u00a0\u202f]+que[\s\u00a0\u202f]+soit[\s\u00a0\u202f]+sa[\s\u00a0\u202f]+valeur', 'Oui, chez un particulier. Un devis est obligatoire pour les prestations de dépannage, de réparation et d''entretien, quel qu''en soit le montant (arrêté du 24 janvier 2017). Il est de toute façon fortement recommandé d''en établir un pour toute intervention', 'r']
  ];
  r text[];
  art record;
  nouveau text;
  absents text := '';
  modifies integer := 0;
BEGIN
  FOR art IN SELECT id, slug, content FROM public.blog_posts WHERE slug IN (
    'comptabilite-simplifiee-pour-artisan-en-2026-le-guide-essentiel-pour-une-gestion-cp7bj',
    'configurer-ses-premieres-factures-electroniques-la-checklist-complete-pour-tpe-e-nfeh7',
    'creer-une-facture-factur-x-conforme-en-5-minutes-le-guide-ultime-pour-tpe-et-art-dq3db',
    'facturation-auto-entrepreneur-artisan-7-erreurs-courantes-qui-coutent-cher-et-co-d6vju',
    'facturation-numerique-les-7-erreurs-fatales-des-artisans-et-tpe-et-comment-les-e-xkwpg',
    'facturation-pour-electricien-vos-questions-nos-reponses-pour-une-conformite-impe-cv7on',
    'facturation-pour-electricien-vos-questions-nos-reponses-pour-une-conformite-impe-cy3go',
    'facture-electricien-le-guide-pratique-etape-par-etape-pour-une-conformite-impecc-7qwbs',
    'facture-electricien-les-10-erreurs-courantes-qui-coutent-cher-et-comment-les-evi-i1nyj',
    'facture-electricien-les-10-erreurs-courantes-qui-coutent-cher-et-comment-les-evi-n6hgk',
    'tva-artisan-les-9-erreurs-fatales-a-eviter-taux-exonerations-mentions-d0xf4',
    'devis-et-factures-maitrisez-les-differences-juridiques-essentielles-pour-artisan-2vdr4',
    'facture-electricien-les-mentions-indispensables-pour-une-conformite-sans-faille--2jg54',
    'facture-electricien-les-mentions-indispensables-pour-une-conformite-sans-faille--hyotq',
    'archivage-de-vos-factures-le-guide-pratique-pour-artisans-et-tpe-face-aux-obliga-88sil',
    'facturation-pour-electricien-mentions-specifiques-et-conformite-comparatif-artis-2lrtr',
    'facturation-pour-electricien-mentions-specifiques-et-conformite-comparatif-artis-sb1zk',
    'facture-electricien-le-calendrier-chronologique-des-mentions-specifiques-et-de-l-xf4k9'
  ) LOOP
    nouveau := art.content;
    FOREACH r SLICE 1 IN ARRAY regles LOOP
      IF r[1] = art.slug THEN
        IF nouveau ~ r[2] THEN
          nouveau := regexp_replace(nouveau, r[2], r[3], 'g');
        ELSIF r[4] = 'r' THEN
          absents := absents || E'\n - ' || left(art.slug, 50) || ' : ' || left(r[2], 50);
        END IF;
      END IF;
    END LOOP;
    IF nouveau <> art.content THEN
      UPDATE public.blog_posts SET content = nouveau WHERE id = art.id;
      modifies := modifies + 1;
    END IF;
  END LOOP;
  IF absents <> '' THEN
    RAISE EXCEPTION 'Rien modifié. Passages introuvables (à corriger à la main) :%', absents;
  END IF;
  RAISE NOTICE '% articles corrigés', modifies;
END
$correction$;
