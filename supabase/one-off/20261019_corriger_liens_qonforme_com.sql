-- Liens des articles du blog vers « qonforme.com » : un AUTRE site (logiciel mexicain de gestion de la qualité, en espagnol).
-- L'ancien générateur d'articles avait inventé ce domaine pour le bouton « Essayez Qonforme… » de 10 articles ; chaque lien
-- envoyait des lecteurs et du poids SEO à un tiers, et l'un d'eux menait à une page 404 (/essai-gratuit).
-- Correction : ces liens mènent à /signup (création de compte ; l'offre « Devis » à 0 € permet de commencer sans carte bancaire).
-- Le texte des liens ne change pas.
--
-- Un seul bloc, à coller tel quel dans Supabase > SQL Editor puis Run. Résultat attendu : « Success » (message : 10 articles corrigés).
-- Il sauvegarde les articles concernés, puis corrige. Tout ou rien : s'il reste une mention de qonforme.com après la correction
-- (lien sans https, adresse écrite en toutes lettres…), RIEN n'est modifié et le message d'erreur donne l'article.
-- Relançable sans risque : une fois corrigé, plus aucun article ne correspond.
-- Retour arrière : UPDATE public.blog_posts b SET content = s.content FROM public.blog_posts_sauvegarde_20261019 s WHERE s.id = b.id;

CREATE TABLE IF NOT EXISTS public.blog_posts_sauvegarde_20261019 AS
SELECT id, slug, content, now() AS sauvegarde_le
FROM public.blog_posts
WHERE content ~* 'qonforme\.com';
ALTER TABLE public.blog_posts_sauvegarde_20261019 ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.blog_posts_sauvegarde_20261019 FROM anon, authenticated;

DO $correction$
DECLARE
  art record;
  nouveau text;
  restes text := '';
  modifies integer := 0;
BEGIN
  FOR art IN SELECT id, slug, content FROM public.blog_posts WHERE content ~* 'qonforme\.com' LOOP
    -- https://www.qonforme.com, https://qonforme.com/, https://www.qonforme.com/essai-gratuit… (jusqu'à la parenthèse du lien)
    nouveau := regexp_replace(art.content, 'https?://(www\.)?qonforme\.com(/[^)\s"]*)?', '/signup', 'gi');
    IF nouveau ~* 'qonforme\.com' THEN
      restes := restes || E'\n - ' || art.slug;
    ELSIF nouveau <> art.content THEN
      UPDATE public.blog_posts SET content = nouveau WHERE id = art.id;
      modifies := modifies + 1;
    END IF;
  END LOOP;
  IF restes <> '' THEN
    RAISE EXCEPTION 'Rien modifié. Mention de qonforme.com restante (à corriger à la main) :%', restes;
  END IF;
  RAISE NOTICE '% articles corrigés', modifies;
END
$correction$;
