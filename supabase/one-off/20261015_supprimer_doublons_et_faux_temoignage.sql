-- Suppression de 4 articles de blog :
--   • 1 faux témoignage (« Jean, plombier artisan depuis 15 ans » : personnage inventé présenté comme un vrai retour d'expérience) ;
--   • 3 doublons à 97-98 % d'un autre article (même texte, même titre) : on garde le premier de chaque paire.
-- À lancer dans Supabase › SQL Editor, AVANT le script de correction des articles.

-- ═════════════════════════════════════════════════════════════
-- 1. VÉRIFICATION : doit renvoyer exactement 4 lignes
-- ═════════════════════════════════════════════════════════════
SELECT id, title, slug, is_published, created_at
FROM public.blog_posts
WHERE slug IN (
  'temoignage-comment-un-plombier-a-divise-par-deux-son-temps-de-facturation-en-6-m-i5akb',
  'facturation-pour-electricien-mentions-specifiques-et-conformite-comparatif-artis-sb1zk',
  'facture-electricien-les-mentions-indispensables-pour-une-conformite-sans-faille--hyotq',
  'facture-electricien-les-10-erreurs-courantes-qui-coutent-cher-et-comment-les-evi-n6hgk'
)
ORDER BY title;

-- ═════════════════════════════════════════════════════════════
-- 2. SUPPRESSION : tout ou rien. Si le nombre supprimé n'est pas 4, rien n'est modifié.
-- ═════════════════════════════════════════════════════════════
DO $$
DECLARE
  n integer;
BEGIN
  DELETE FROM public.blog_posts
  WHERE slug IN (
    'temoignage-comment-un-plombier-a-divise-par-deux-son-temps-de-facturation-en-6-m-i5akb',
    'facturation-pour-electricien-mentions-specifiques-et-conformite-comparatif-artis-sb1zk',
    'facture-electricien-les-mentions-indispensables-pour-une-conformite-sans-faille--hyotq',
    'facture-electricien-les-10-erreurs-courantes-qui-coutent-cher-et-comment-les-evi-n6hgk'
  );
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 4 THEN
    RAISE EXCEPTION 'Attendu : 4 articles supprimés, trouvé : % . Opération annulée.', n;
  END IF;
END
$$;

-- ═════════════════════════════════════════════════════════════
-- 3. CONTRÔLE : les 3 articles conservés doivent être là (3 lignes)
-- ═════════════════════════════════════════════════════════════
SELECT title, slug
FROM public.blog_posts
WHERE slug LIKE 'facturation-pour-electricien-mentions-specifiques-%'
   OR slug LIKE 'facture-electricien-les-mentions-indispensables-%'
   OR slug LIKE 'facture-electricien-les-10-erreurs-courantes-%'
ORDER BY title;
