-- Correction juridique de 15 articles du blog (seuils de TVA et de micro, seuil de devis de 150 €, « certifié », « essai gratuit »).
-- Un seul bloc, à coller tel quel dans Supabase > SQL Editor puis Run.
-- Il sauvegarde les articles, puis corrige. Tout ou rien : si un passage « requis » est introuvable, RIEN n'est modifié
-- et le message d'erreur dit lequel (« Rien modifié. Passages introuvables… »). Résultat attendu : « Success ».
-- Retour arrière : UPDATE public.blog_posts b SET content = s.content FROM public.blog_posts_sauvegarde_20261015 s WHERE s.id = b.id;

CREATE TABLE IF NOT EXISTS public.blog_posts_sauvegarde_20261015 AS
SELECT id, slug, content, now() AS sauvegarde_le
FROM public.blog_posts
WHERE slug ~ '-(2jg54|2lrtr|2vdr4|7qwbs|88sil|cp7bj|cv7on|cy3go|d0xf4|d6vju|dq3db|i1nyj|nfeh7|xf4k9|xkwpg)$';
ALTER TABLE public.blog_posts_sauvegarde_20261015 ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.blog_posts_sauvegarde_20261015 FROM anon, authenticated;

DO $correction$
DECLARE
  -- {fin du slug, motif, remplacement, r = requis / o = optionnel} ; dans un motif : _ = espace(s), ~ = espace facultatif
  regles text[] := ARRAY[
    ARRAY['cp7bj', '91~900', '85 000', 'o'],
    ARRAY['cp7bj', '36~800', '37 500', 'o'],
    ARRAY['cp7bj', '101~000', '93 500', 'o'],
    ARRAY['cp7bj', '39~100', '41 250', 'o'],
    ARRAY['cp7bj', '188~700', '203 100', 'r'],
    ARRAY['cp7bj', '77~700', '83 600', 'o'],
    ARRAY['cp7bj', 'prestations_de_services_en_20(23|24)', 'prestations de services', 'o'],
    ARRAY['d6vju', '91~900', '85 000', 'o'],
    ARRAY['d6vju', '36~800', '37 500', 'r'],
    ARRAY['d6vju', '101~000', '93 500', 'o'],
    ARRAY['d6vju', '39~100', '41 250', 'o'],
    ARRAY['d6vju', '188~700', '203 100', 'o'],
    ARRAY['d6vju', '77~700', '83 600', 'o'],
    ARRAY['d6vju', 'prestations_de_services_en_20(23|24)', 'prestations de services', 'o'],
    ARRAY['cv7on', '91~900', '85 000', 'o'],
    ARRAY['cv7on', '36~800', '37 500', 'r'],
    ARRAY['cv7on', '101~000', '93 500', 'o'],
    ARRAY['cv7on', '39~100', '41 250', 'o'],
    ARRAY['cv7on', '188~700', '203 100', 'o'],
    ARRAY['cv7on', '77~700', '83 600', 'o'],
    ARRAY['cv7on', 'prestations_de_services_en_20(23|24)', 'prestations de services', 'o'],
    ARRAY['cy3go', '91~900', '85 000', 'o'],
    ARRAY['cy3go', '36~800', '37 500', 'r'],
    ARRAY['cy3go', '101~000', '93 500', 'o'],
    ARRAY['cy3go', '39~100', '41 250', 'o'],
    ARRAY['cy3go', '188~700', '203 100', 'o'],
    ARRAY['cy3go', '77~700', '83 600', 'o'],
    ARRAY['cy3go', 'prestations_de_services_en_20(23|24)', 'prestations de services', 'o'],
    ARRAY['d0xf4', '91~900', '85 000', 'o'],
    ARRAY['d0xf4', '36~800', '37 500', 'r'],
    ARRAY['d0xf4', '101~000', '93 500', 'o'],
    ARRAY['d0xf4', '39~100', '41 250', 'o'],
    ARRAY['d0xf4', '188~700', '203 100', 'o'],
    ARRAY['d0xf4', '77~700', '83 600', 'o'],
    ARRAY['d0xf4', 'prestations_de_services_en_20(23|24)', 'prestations de services', 'o'],
    ARRAY['7qwbs', 'dépassant_un_certain_montant_\(généralement_150~€_TTC\),_ou_si_le_client_le_demande,_un_devis_écrit_et_détaillé_est_obligatoire', 'chez un particulier, un devis écrit et détaillé est obligatoire avant toute intervention, quel qu''en soit le montant', 'r'],
    ARRAY['i1nyj', 'dès_que_le_montant_estimé_des_travaux_dépasse_150~€_TTC,_ou_si_le_client_en_fait_la_demande', 'chez un particulier, avant toute intervention, quel qu''en soit le montant', 'r'],
    ARRAY['nfeh7', 'doit_être_certifié_pour_émettre_des_factures_au_format_Factur-X', 'doit émettre des factures au format Factur-X', 'r'],
    ARRAY['dq3db', 'Sélectionner_un_logiciel_certifié_et_adapté_à_vos_besoins', 'Sélectionner un logiciel adapté à vos besoins', 'r'],
    ARRAY['xkwpg', 'logiciel_de_facturation_électronique_certifié', 'logiciel de facturation électronique adapté', 'r'],
    ARRAY['xkwpg', 'une_solution_certifiée_et_pensée_pour_les_artisans', 'une solution pensée pour les artisans', 'r'],
    ARRAY['cy3go', 'si_le_montant_estimé_dépasse_un_certain_seuil_\(généralement_150~€_TTC\)_ou_si_le_client_en_fait_la_demande', 'chez un particulier, quel que soit le montant', 'r'],
    ARRAY['2vdr4', 'si_le_montant_estimé_dépasse_un_certain_seuil_\(généralement_150~€_TTC,_mais_des_règles_spécifiques_peuvent_s[''’]appliquer_selon_le_secteur\)', 'chez un particulier : dans le bâtiment, le devis est dû quel que soit le montant (arrêté du 24 janvier 2017)', 'r'],
    ARRAY['2jg54', 'les_prestations_de_services_dont_le_prix_dépasse_un_certain_seuil_\(généralement_150~€_TTC_pour_les_prestations_de_dépannage,_de_réparation_et_d[''’]entretien\),_un_devis_détaillé_est_obligatoire\._Même_pour_des_montants_inférieurs,_un_devis_est_fortement_recommandé', 'les prestations de dépannage, de réparation et d''entretien chez un particulier, un devis détaillé est obligatoire, quel qu''en soit le montant', 'r'],
    ARRAY['88sil', 'Découvrez_Qonforme_et_commencez_votre_essai_gratuit_dès_maintenant', 'Découvrez Qonforme et commencez gratuitement avec les devis dès maintenant', 'r'],
    ARRAY['dq3db', 'Un_essai_gratuit_vous_permettra_de_tester_sa_simplicité_d[''’]utilisation_et_de_vous_assurer_qu[''’]il_répond_parfaitement_à_vos_attentes', 'Les devis gratuits et illimités vous permettent de tester sa simplicité d''utilisation et de vous assurer qu''il répond à vos attentes', 'r'],
    ARRAY['2lrtr', 'si_le_montant_estimé_dépasse_un_certain_seuil_\(souvent_150~€_TTC,_mais_peut_varier\)\._Il_est_également_obligatoire_si_le_client_en_fait_la_demande,_quel_que_soit_le_montant', 'chez un particulier, quel qu''en soit le montant. Il est également obligatoire dès que le client en fait la demande', 'r'],
    ARRAY['xf4k9', 'obligatoire_pour_toute_prestation_dont_le_montant_estimé_dépasse_150~€_TTC,_ou_si_le_client_en_fait_la_demande,_quelle_que_soit_la_somme', 'obligatoire pour toute prestation de dépannage, de réparation ou d''entretien chez un particulier, quel qu''en soit le montant, et dès que le client en fait la demande', 'r'],
    ARRAY['2jg54', 'Non,_pas_pour_toutes\._Un_devis_est_obligatoire_pour_les_prestations_de_dépannage,_de_réparation_et_d[''’]entretien_dont_le_montant_dépasse_150~€_TTC\._Cependant,_il_est_fortement_recommandé_d[''’]établir_un_devis_pour_toute_intervention,_quelle_que_soit_sa_valeur', 'Oui, chez un particulier. Un devis est obligatoire pour les prestations de dépannage, de réparation et d''entretien, quel qu''en soit le montant (arrêté du 24 janvier 2017). Il est de toute façon fortement recommandé d''en établir un pour toute intervention', 'r']
  ];
  r text[];
  art record;
  motif text;
  nouveau text;
  absents text := '';
  modifies integer := 0;
BEGIN
  FOR art IN SELECT id, slug, content FROM public.blog_posts WHERE slug ~ '-(2jg54|2lrtr|2vdr4|7qwbs|88sil|cp7bj|cv7on|cy3go|d0xf4|d6vju|dq3db|i1nyj|nfeh7|xf4k9|xkwpg)$' LOOP
    nouveau := art.content;
    FOREACH r SLICE 1 IN ARRAY regles LOOP
      IF art.slug LIKE '%-' || r[1] THEN
        motif := replace(replace(r[2], '_', '[\s\u00a0\u202f]+'), '~', '[\s\u00a0\u202f]?');
        IF nouveau ~ motif THEN
          nouveau := regexp_replace(nouveau, motif, r[3], 'g');
        ELSIF r[4] = 'r' THEN
          absents := absents || E'\n - ' || r[1] || ' : ' || left(r[2], 60);
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
