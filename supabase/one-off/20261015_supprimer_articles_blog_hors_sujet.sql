-- Suppression des 5 articles de blog hors sujet (hors bâtiment).
-- À lancer dans Supabase › SQL Editor, en deux temps.

-- ─────────────────────────────────────────────────────────────
-- 1. VÉRIFICATION : doit renvoyer exactement 5 lignes
-- ─────────────────────────────────────────────────────────────
SELECT id, title, slug, is_published, created_at
FROM public.blog_posts
WHERE slug IN (
  'agent-immobilier-evitez-ces-9-erreurs-fatales-dans-la-facturation-de-vos-commiss-diw9e',
  'facturation-pour-avocat-le-guide-chronologique-convention-tva-notes-d-honoraires-y027h',
  'femme-de-menage-entreprise-de-nettoyage-maitrisez-cesu-credit-d-impot-et-factura-nusj2',
  'tva-boulangerie-7-erreurs-frequentes-a-eviter-pour-maitriser-vos-taux-5-5-10-20-syukc',
  'chauffeur-vtc-le-guide-pratique-pour-une-facturation-et-une-comptabilite-impecca-y34zn'
)
ORDER BY title;

-- ─────────────────────────────────────────────────────────────
-- 2. SUPPRESSION : à lancer seulement si les 5 lignes ci-dessus sont les bonnes.
--    Si le nombre de lignes supprimées n'est pas 5, tout est annulé.
-- ─────────────────────────────────────────────────────────────
DO $$
DECLARE
  n integer;
BEGIN
  DELETE FROM public.blog_posts
  WHERE slug IN (
    'agent-immobilier-evitez-ces-9-erreurs-fatales-dans-la-facturation-de-vos-commiss-diw9e',
    'facturation-pour-avocat-le-guide-chronologique-convention-tva-notes-d-honoraires-y027h',
    'femme-de-menage-entreprise-de-nettoyage-maitrisez-cesu-credit-d-impot-et-factura-nusj2',
    'tva-boulangerie-7-erreurs-frequentes-a-eviter-pour-maitriser-vos-taux-5-5-10-20-syukc',
    'chauffeur-vtc-le-guide-pratique-pour-une-facturation-et-une-comptabilite-impecca-y34zn'
  );
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 5 THEN
    RAISE EXCEPTION 'Attendu : 5 articles supprimés, trouvé : % . Opération annulée.', n;
  END IF;
END
$$;

-- Contrôle : doit renvoyer 0 ligne
SELECT count(*) AS articles_restants
FROM public.blog_posts
WHERE slug LIKE 'chauffeur-vtc-%'
   OR slug LIKE 'agent-immobilier-%'
   OR slug LIKE 'facturation-pour-avocat-%'
   OR slug LIKE 'femme-de-menage-%'
   OR slug LIKE 'tva-boulangerie-%';

-- ─────────────────────────────────────────────────────────────
-- Variante réversible (au lieu de supprimer) : dépublier seulement.
-- ─────────────────────────────────────────────────────────────
-- UPDATE public.blog_posts SET is_published = false
-- WHERE slug IN ( … les 5 adresses ci-dessus … );
